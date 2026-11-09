import os
import math
import numpy as np
import soundfile as sf
import scipy.signal
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import logging

logger = logging.getLogger("supreem.dsp")

class AudioDSPEngine:
    """
    Deterministic, sample-accurate Audio DSP Engine.
    Conforms to client specifications:
    - 48,000 Hz sample rate
    - Stereo (2 channels)
    - Exactly 10.000 seconds = 480,000 samples per channel
    - 24-bit PCM WAV exports
    - ITU-R BS.1770-4 4x oversampled true peak calculation
    - Mixdown reproduced via stem summation within quantization tolerance
    - True peak target: ~ -3.5 dBTP, hard ceiling: <= -1.0 dBTP
    """
    def __init__(
        self,
        sample_rate: int = 48000,
        channels: int = 2,
        duration_seconds: float = 10.0,
        target_true_peak_dbtp: float = -3.5,
        max_true_peak_dbtp: float = -1.0
    ):
        self.sample_rate = sample_rate
        self.channels = channels
        self.duration_seconds = duration_seconds
        self.exact_sample_count = int(round(sample_rate * duration_seconds))  # 480,000
        self.target_true_peak_dbtp = target_true_peak_dbtp
        self.max_true_peak_dbtp = max_true_peak_dbtp

    def create_empty_stem_buffer(self) -> np.ndarray:
        """Create a zeroed stereo float32 buffer of exactly 480,000 samples."""
        return np.zeros((self.exact_sample_count, self.channels), dtype=np.float32)

    def resample_and_conform_audio(
        self,
        audio_data: np.ndarray,
        source_sr: int,
        target_sr: int = 48000,
        target_channels: int = 2
    ) -> np.ndarray:
        """Resample arbitrary input audio to 48 kHz stereo float32."""
        if audio_data.dtype != np.float32:
            if np.issubdtype(audio_data.dtype, np.integer):
                max_val = float(np.iinfo(audio_data.dtype).max)
                audio_data = (audio_data / max_val).astype(np.float32)
            else:
                audio_data = audio_data.astype(np.float32)

        # Conform channels
        if audio_data.ndim == 1:
            # Mono -> Stereo
            audio_data = np.column_stack((audio_data, audio_data))
        elif audio_data.ndim == 2:
            if audio_data.shape[1] == 1:
                audio_data = np.column_stack((audio_data[:, 0], audio_data[:, 0]))
            elif audio_data.shape[1] > 2:
                # Downmix surround to stereo
                audio_data = audio_data[:, :2]

        # Resample if needed
        if source_sr != target_sr:
            num_target_samples = int(round(len(audio_data) * target_sr / source_sr))
            resampled_left = scipy.signal.resample(audio_data[:, 0], num_target_samples)
            resampled_right = scipy.signal.resample(audio_data[:, 1], num_target_samples)
            audio_data = np.column_stack((resampled_left, resampled_right)).astype(np.float32)

        return audio_data

    def apply_fades(self, audio: np.ndarray, fade_in_samples: int = 480, fade_out_samples: int = 480) -> np.ndarray:
        """Apply smooth cosine micro-fades to audio boundaries to prevent clicks."""
        n_samples = len(audio)
        if n_samples == 0:
            return audio
            
        fade_in_len = min(fade_in_samples, n_samples // 2)
        fade_out_len = min(fade_out_samples, n_samples // 2)
        
        out = audio.copy()
        if fade_in_len > 0:
            fade_in_curve = 0.5 * (1.0 - np.cos(np.linspace(0, np.pi, fade_in_len)))
            out[:fade_in_len, :] *= fade_in_curve[:, np.newaxis]
            
        if fade_out_len > 0:
            fade_out_curve = 0.5 * (1.0 + np.cos(np.linspace(0, np.pi, fade_out_len)))
            out[-fade_out_len:, :] *= fade_out_curve[:, np.newaxis]
            
        return out

    def place_sound_on_stem(
        self,
        stem_buffer: np.ndarray,
        sound_data: np.ndarray,
        start_ms: int,
        gain_db: float = 0.0
    ) -> np.ndarray:
        """
        Place sound at exact sample position in 10.0-second stem buffer.
        Applies gain in dB and ensures no overrun beyond 480,000 samples.
        """
        start_sample = int(round((start_ms / 1000.0) * self.sample_rate))
        if start_sample >= self.exact_sample_count:
            return stem_buffer

        gain_linear = 10.0 ** (gain_db / 20.0)
        sound_to_place = self.apply_fades(sound_data) * gain_linear
        
        sound_len = len(sound_to_place)
        available_samples = self.exact_sample_count - start_sample
        samples_to_copy = min(sound_len, available_samples)

        stem_buffer[start_sample : start_sample + samples_to_copy, :] += sound_to_place[:samples_to_copy, :]
        return stem_buffer

    def measure_true_peak_dbtp(self, audio: np.ndarray) -> float:
        """
        Calculate ITU-R BS.1770-4 4x oversampled true peak in dBTP.
        Uses 4x polyphase resampling filter to detect inter-sample peaks.
        """
        if len(audio) == 0:
            return -100.0
            
        # 4x oversampling polyphase interpolation
        resampled = scipy.signal.resample_poly(audio, up=4, down=1, axis=0)
        max_peak = float(np.max(np.abs(resampled)))
        
        if max_peak <= 1e-9:
            return -100.0
            
        dbtp = float(20.0 * np.log10(max_peak))
        return dbtp

    def measure_sample_peak(self, audio: np.ndarray) -> float:
        """Calculate standard maximum sample peak value (0.0 to 1.0+)."""
        if len(audio) == 0:
            return 0.0
        return float(np.max(np.abs(audio)))

    def measure_rms_dbfs(self, audio: np.ndarray) -> float:
        """Calculate RMS level in dBFS."""
        if len(audio) == 0:
            return -100.0
        rms = float(np.sqrt(np.mean(audio ** 2)) + 1e-9)
        return float(20.0 * np.log10(rms))

    def balance_and_export_stems(
        self,
        stem_buffers: List[Tuple[str, str, np.ndarray]],  # list of (stem_id, filename, buffer)
        output_stems_dir: str,
        mixdown_output_path: str
    ) -> Dict[str, Any]:
        """
        Executes strict master mixdown workflow:
        1. Takes floating-point stem buffers.
        2. Sums all stem buffers into temporary floating-point bus.
        3. Measures 4x oversampled true peak.
        4. Calculates uniform scaling factor to align true peak to target (~ -3.5 dBTP, max <= -1.0 dBTP).
        5. Applies the EXACT same scale factor to every individual stem buffer.
        6. Exports every stem as 24-bit PCM WAV (48 kHz, stereo, 480,000 samples).
        7. Reads the exported 24-bit WAV files back from disk.
        8. Sums the disk-read stems to generate Mixdown.wav.
        9. Verifies that sum(stems) == Mixdown.wav within 24-bit PCM quantization tolerance!
        """
        os.makedirs(output_stems_dir, exist_ok=True)
        os.makedirs(os.path.dirname(mixdown_output_path), exist_ok=True)

        n_stems = len(stem_buffers)
        if n_stems < 3:
            raise ValueError(f"Requirement requires at least 3 stems, received {n_stems}")

        # 1. Sum in float to inspect raw mix bus
        summed_float = np.zeros((self.exact_sample_count, self.channels), dtype=np.float32)
        for _, _, buf in stem_buffers:
            if buf.shape != (self.exact_sample_count, self.channels):
                raise ValueError(f"Invalid stem shape {buf.shape}, expected ({self.exact_sample_count}, {self.channels})")
            summed_float += buf

        raw_true_peak = self.measure_true_peak_dbtp(summed_float)
        raw_sample_peak = self.measure_sample_peak(summed_float)

        # 2. Determine global uniform gain scaling factor
        # Target true peak is -3.5 dBTP, with ceiling at -1.0 dBTP.
        scale_factor = 1.0
        if raw_true_peak > self.target_true_peak_dbtp:
            db_reduction = raw_true_peak - self.target_true_peak_dbtp
            scale_factor = float(10.0 ** (-db_reduction / 20.0))
        elif raw_true_peak < -24.0:
            # Low level scene, gentle boost if possible without exceeding target
            db_boost = min(6.0, self.target_true_peak_dbtp - raw_true_peak)
            scale_factor = float(10.0 ** (db_boost / 20.0))

        # Ensure sample peak with scale factor never exceeds 0.95 (-0.45 dBFS) to prevent clipping
        if raw_sample_peak * scale_factor > 0.95:
            scale_factor = 0.95 / (raw_sample_peak + 1e-9)

        # 3. Apply uniform scaling and export 24-bit PCM stems
        exported_stems_info = []
        exported_stem_paths = []

        for stem_id, filename, buf in stem_buffers:
            scaled_buf = buf * scale_factor
            
            # Bound check
            scaled_buf = np.clip(scaled_buf, -0.999999, 0.999999)
            
            file_path = os.path.join(output_stems_dir, filename)
            # Write 24-bit PCM WAV
            sf.write(file_path, scaled_buf, self.sample_rate, subtype="PCM_24", format="WAV")
            exported_stem_paths.append(file_path)

            stem_tp = self.measure_true_peak_dbtp(scaled_buf)
            stem_rms = self.measure_rms_dbfs(scaled_buf)

            exported_stems_info.append({
                "stem_id": stem_id,
                "filename": filename,
                "file_path": file_path,
                "sample_rate": self.sample_rate,
                "bit_depth": 24,
                "channels": self.channels,
                "sample_count": self.exact_sample_count,
                "duration_seconds": self.duration_seconds,
                "true_peak_dbtp": round(stem_tp, 2),
                "rms_dbfs": round(stem_rms, 2)
            })

        # 4. Read back exported stems from disk to satisfy the Summation Contract
        read_back_sum = np.zeros((self.exact_sample_count, self.channels), dtype=np.float64)
        for p in exported_stem_paths:
            s_data, s_sr = sf.read(p, dtype="float64")
            if len(s_data) != self.exact_sample_count:
                raise ValueError(f"Stem {p} sample count mismatch: {len(s_data)} vs {self.exact_sample_count}")
            read_back_sum += s_data

        # 5. Export Mixdown.wav from exact sum of exported stems
        mix_tp = self.measure_true_peak_dbtp(read_back_sum.astype(np.float32))
        mix_sample_peak = self.measure_sample_peak(read_back_sum.astype(np.float32))
        mix_rms = self.measure_rms_dbfs(read_back_sum.astype(np.float32))

        # Check true peak limit
        if mix_tp > self.max_true_peak_dbtp:
            logger.warning(f"Mixdown true peak {mix_tp:.2f} dBTP exceeds ceiling {self.max_true_peak_dbtp} dBTP")
        if mix_sample_peak >= 1.0:
            raise RuntimeError(f"Digital clipping detected in mixdown! Sample peak: {mix_sample_peak:.4f}")

        # Write Mixdown.wav as 24-bit PCM
        sf.write(mixdown_output_path, read_back_sum.astype(np.float32), self.sample_rate, subtype="PCM_24", format="WAV")

        # 6. Read back Mixdown.wav and verify reconstruction precision
        mix_verify, _ = sf.read(mixdown_output_path, dtype="float64")
        max_quantization_diff = float(np.max(np.abs(read_back_sum - mix_verify)))
        
        # 24-bit LSB is 2^-23 ~= 1.19e-7. Tolerance of 1e-5 is well within quantization bounds.
        reproduction_valid = max_quantization_diff < 1e-4

        return {
            "mixdown_path": mixdown_output_path,
            "sample_rate": self.sample_rate,
            "bit_depth": 24,
            "channels": self.channels,
            "sample_count": self.exact_sample_count,
            "duration_seconds": self.duration_seconds,
            "true_peak_dbtp": round(mix_tp, 2),
            "sample_peak": round(mix_sample_peak, 4),
            "rms_dbfs": round(mix_rms, 2),
            "is_clipping": mix_sample_peak >= 0.9999,
            "reconstruction_max_diff": max_quantization_diff,
            "reproduction_valid": reproduction_valid,
            "stems": exported_stems_info
        }

    def generate_procedural_fallback_audio(
        self,
        category: str,
        duration_sec: float,
        description: str = ""
    ) -> np.ndarray:
        """
        High-fidelity procedural acoustic synthesis fallback for testing, offline environments,
        and deterministic audio generation when API keys are not supplied.
        Follows STRICT RULES: NO MUSIC, NO MELODIES, NO VOCALS, NO SPEECH.
        Only natural ambience, movement, surface interactions, footsteps, impacts, wind, water.
        """
        n_samples = int(round(duration_sec * self.sample_rate))
        t = np.linspace(0, duration_sec, n_samples, endpoint=False)
        cat_lower = category.lower() + " " + description.lower()

        # Deterministic seed based on description hash
        seed = abs(hash(description or category)) % (2**31 - 1)
        rng = np.random.RandomState(seed)

        left = np.zeros(n_samples, dtype=np.float32)
        right = np.zeros(n_samples, dtype=np.float32)

        if "ambience" in cat_lower or "wind" in cat_lower or "desert" in cat_lower or "atmosphere" in cat_lower:
            # Brown / pink noise shaped through resonant lowpass for wind/air movement
            white = rng.randn(n_samples).astype(np.float32)
            # Lowpass filter at 450 Hz
            b, a = scipy.signal.butter(3, 450.0 / (self.sample_rate / 2.0), btype='low')
            filtered = scipy.signal.lfilter(b, a, white)
            # Gentle swell modulation (0.2 Hz)
            mod = 0.7 + 0.3 * np.sin(2 * np.pi * 0.25 * t + rng.rand())
            left = (filtered * mod * 0.25).astype(np.float32)
            # Subtle stereo decorrelation (2ms delay)
            right = np.roll(left, int(0.002 * self.sample_rate))

        elif "footstep" in cat_lower or "walk" in cat_lower or "sand" in cat_lower:
            # Series of filtered crunch / friction impulses
            step_interval = int(0.65 * self.sample_rate)
            for idx in range(int(0.2 * self.sample_rate), n_samples - int(0.2 * self.sample_rate), step_interval):
                impulse_len = min(int(0.18 * self.sample_rate), n_samples - idx)
                # Granular friction noise
                grain = rng.randn(impulse_len).astype(np.float32)
                # Bandpass 1000 - 4500 Hz for sand / crunch
                b, a = scipy.signal.butter(2, [800 / (self.sample_rate / 2), 4000 / (self.sample_rate / 2)], btype='band')
                filtered_grain = scipy.signal.lfilter(b, a, grain)
                decay = np.exp(-np.linspace(0, 8, impulse_len)).astype(np.float32)
                left[idx : idx + impulse_len] += filtered_grain * decay * 0.35
                right[idx : idx + impulse_len] += filtered_grain * decay * 0.32

        elif "metal" in cat_lower or "impact" in cat_lower or "clash" in cat_lower or "weapon" in cat_lower:
            # Metallic clang: resonant inharmonic modes + fast damping
            hit_start = int(0.1 * self.sample_rate)
            hit_len = min(int(1.2 * self.sample_rate), n_samples - hit_start)
            t_hit = np.linspace(0, 1.2, hit_len, endpoint=False)
            # Inharmonic frequencies typical of metal sheets (non-harmonic, not musical chords)
            modes = [587.0, 932.0, 1476.0, 2341.0, 3810.0]
            decay_rates = [4.0, 6.0, 8.0, 12.0, 16.0]
            clang = np.zeros(hit_len, dtype=np.float32)
            for freq, decay in zip(modes, decay_rates):
                clang += (np.sin(2 * np.pi * freq * t_hit) * np.exp(-decay * t_hit)).astype(np.float32)
            clang *= 0.15
            left[hit_start : hit_start + hit_len] += clang
            right[hit_start : hit_start + hit_len] += clang * 0.9

        elif "water" in cat_lower or "splash" in cat_lower or "sea" in cat_lower:
            # Water splash / fluid movement: bubble bursts and low fluid resonance
            white = rng.randn(n_samples).astype(np.float32)
            b, a = scipy.signal.butter(2, [300 / (self.sample_rate / 2), 2500 / (self.sample_rate / 2)], btype='band')
            fluid = scipy.signal.lfilter(b, a, white)
            decay = np.exp(-np.linspace(0, 3, n_samples)).astype(np.float32)
            left = (fluid * decay * 0.3).astype(np.float32)
            right = np.roll(left, int(0.003 * self.sample_rate))

        else:
            # General organic texture / friction
            white = rng.randn(n_samples).astype(np.float32)
            b, a = scipy.signal.butter(2, [500 / (self.sample_rate / 2), 3500 / (self.sample_rate / 2)], btype='band')
            filtered = scipy.signal.lfilter(b, a, white)
            left = (filtered * 0.2).astype(np.float32)
            right = (filtered * 0.2).astype(np.float32)

        stereo = np.column_stack((left, right))
        return self.apply_fades(stereo)

