import os
import numpy as np
import soundfile as sf
from scipy.signal import spectrogram
from typing import Dict, Any, Tuple
from app.models import AudioClassificationCategory

class AudioClassifierService:
    def __init__(self, silence_threshold_db: float = -55.0):
        self.silence_threshold_db = silence_threshold_db

    def analyze_audio_file(self, audio_wav_path: Optional[str]) -> Dict[str, Any]:
        """
        Classify original audio stream.
        Identifies music, vocals, speech, ambience, sfx, mechanical, silence or mixed.
        """
        if not audio_wav_path or not os.path.exists(audio_wav_path) or os.path.getsize(audio_wav_path) == 0:
            return {
                "category": AudioClassificationCategory.NONE.value,
                "confidence": 1.0,
                "detected_music": False,
                "detected_speech": False,
                "detected_vocals": False,
                "detected_environmental": False,
                "detected_silence": True,
                "rms_db": -100.0,
                "spectral_centroid": 0.0,
                "features": {"details": "No audio stream present in source file"}
            }

        try:
            data, sr = sf.read(audio_wav_path, dtype="float32")
        except Exception as e:
            return {
                "category": AudioClassificationCategory.SILENCE.value,
                "confidence": 0.8,
                "detected_music": False,
                "detected_speech": False,
                "detected_vocals": False,
                "detected_environmental": False,
                "detected_silence": True,
                "rms_db": -100.0,
                "spectral_centroid": 0.0,
                "features": {"error": f"Failed to read audio: {str(e)}"}
            }

        # Convert to mono for feature analysis
        if data.ndim > 1:
            mono = np.mean(data, axis=1)
        else:
            mono = data

        if len(mono) == 0:
            return {
                "category": AudioClassificationCategory.SILENCE.value,
                "confidence": 1.0,
                "detected_music": False,
                "detected_speech": False,
                "detected_vocals": False,
                "detected_environmental": False,
                "detected_silence": True,
                "rms_db": -100.0,
                "spectral_centroid": 0.0,
                "features": {"details": "Empty audio stream"}
            }

        # 1. RMS Energy
        rms = float(np.sqrt(np.mean(mono ** 2)) + 1e-9)
        rms_db = float(20.0 * np.log10(rms))

        if rms_db < self.silence_threshold_db:
            return {
                "category": AudioClassificationCategory.SILENCE.value,
                "confidence": 0.99,
                "detected_music": False,
                "detected_speech": False,
                "detected_vocals": False,
                "detected_environmental": False,
                "detected_silence": True,
                "rms_db": round(rms_db, 2),
                "spectral_centroid": 0.0,
                "features": {"rms_db": round(rms_db, 2)}
            }

        # 2. Spectral analysis via FFT
        n_fft = 2048
        hop_length = 512
        freqs, times, Sxx = spectrogram(mono, fs=sr, nperseg=n_fft, noverlap=n_fft - hop_length)
        magnitude = np.abs(Sxx) + 1e-9

        # Spectral Centroid
        freq_weights = freqs[:, np.newaxis]
        spectral_centroid = float(np.mean(np.sum(freq_weights * magnitude, axis=0) / np.sum(magnitude, axis=0)))

        # Spectral Flatness (Wiener entropy: geometric mean / arithmetic mean)
        geom_mean = np.exp(np.mean(np.log(magnitude), axis=0))
        arith_mean = np.mean(magnitude, axis=0)
        spectral_flatness = float(np.mean(geom_mean / arith_mean))

        # Zero Crossing Rate
        zero_crossings = np.sum(np.abs(np.diff(np.signbit(mono)))) / len(mono)

        # Spectral energy distribution across key frequency bands
        # Low: 20-250 Hz (bass, mechanical)
        # Mid: 250-2500 Hz (speech, melody, vocals)
        # High: 2500-12000 Hz (air, sibilance, percussion)
        low_idx = (freqs >= 20) & (freqs < 250)
        mid_idx = (freqs >= 250) & (freqs < 2500)
        high_idx = (freqs >= 2500) & (freqs < 12000)

        total_mag = np.sum(magnitude)
        low_ratio = float(np.sum(magnitude[low_idx, :]) / total_mag)
        mid_ratio = float(np.sum(magnitude[mid_idx, :]) / total_mag)
        high_ratio = float(np.sum(magnitude[high_idx, :]) / total_mag)

        # Temporal envelope variance (rhythm / speech modulation)
        frame_energies = np.sum(magnitude ** 2, axis=0)
        energy_std = float(np.std(frame_energies) / (np.mean(frame_energies) + 1e-9))

        # Harmonics vs Noise: ratio of peak harmonics to average spectral background
        harmonic_ratio = float(np.mean(np.max(magnitude, axis=0) / (np.mean(magnitude, axis=0) + 1e-9)))

        # Classification Heuristics
        detected_music = False
        detected_speech = False
        detected_vocals = False
        detected_environmental = False
        detected_mechanical = False
        detected_sfx = False

        # Strong harmonic ratio + steady rhythm = Music / Instrumental
        if harmonic_ratio > 4.5 and spectral_flatness < 0.15:
            if mid_ratio > 0.45 and energy_std > 0.8:
                detected_vocals = True
                detected_music = True
            else:
                detected_music = True

        # Mid-band concentration + distinct syllable modulation = Speech
        if 0.35 < mid_ratio < 0.75 and 0.6 < energy_std < 2.5 and spectral_centroid < 3200 and not detected_music:
            detected_speech = True

        # High flatness + low harmonic ratio = Environmental Ambience (wind, rain, surf)
        if spectral_flatness > 0.25 and harmonic_ratio < 3.2:
            detected_environmental = True

        # Impulsive transients + high dynamic range = Object SFX
        if energy_std > 2.5 and zero_crossings > 0.08:
            detected_sfx = True

        # Low-frequency rumble + steady energy = Mechanical / Engine
        if low_ratio > 0.55 and energy_std < 0.6:
            detected_mechanical = True

        # Determine primary category
        if detected_music and (detected_speech or detected_vocals):
            category = AudioClassificationCategory.MIXED_AUDIO.value
            confidence = 0.92
        elif detected_music and detected_vocals:
            category = AudioClassificationCategory.SONGS.value
            confidence = 0.90
        elif detected_music:
            category = AudioClassificationCategory.BACKGROUND_MUSIC.value
            confidence = 0.88
        elif detected_speech or detected_vocals:
            category = AudioClassificationCategory.HUMAN_SPEECH.value
            confidence = 0.89
        elif detected_environmental and detected_sfx:
            category = AudioClassificationCategory.MIXED_AUDIO.value
            confidence = 0.85
        elif detected_environmental:
            category = AudioClassificationCategory.ENVIRONMENTAL_AMBIENCE.value
            confidence = 0.87
        elif detected_mechanical:
            category = AudioClassificationCategory.MECHANICAL_SOUNDS.value
            confidence = 0.86
        elif detected_sfx:
            category = AudioClassificationCategory.OBJECT_SFX.value
            confidence = 0.84
        else:
            category = AudioClassificationCategory.MIXED_AUDIO.value
            confidence = 0.75

        features = {
            "rms_db": round(rms_db, 2),
            "spectral_centroid": round(spectral_centroid, 2),
            "spectral_flatness": round(spectral_flatness, 4),
            "zero_crossing_rate": round(float(zero_crossings), 4),
            "harmonic_ratio": round(harmonic_ratio, 2),
            "energy_variance": round(energy_std, 2),
            "low_band_ratio": round(low_ratio, 3),
            "mid_band_ratio": round(mid_ratio, 3),
            "high_band_ratio": round(high_ratio, 3)
        }

        return {
            "category": category,
            "confidence": confidence,
            "detected_music": detected_music,
            "detected_speech": detected_speech,
            "detected_vocals": detected_vocals,
            "detected_environmental": detected_environmental,
            "detected_silence": False,
            "rms_db": round(rms_db, 2),
            "spectral_centroid": round(spectral_centroid, 2),
            "features": features
        }

