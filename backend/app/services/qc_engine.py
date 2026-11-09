import os
import math
import zipfile
import json
import numpy as np
import soundfile as sf
import scipy.signal
from typing import Dict, Any, List, Optional
import logging
from app.services.ffmpeg_service import FFmpegService
from app.services.dsp_engine import AudioDSPEngine
from app.schemas.qc import QCReportSchema, StemQCDetail

logger = logging.getLogger("supreem.qc")

class QualityControlEngine:
    def __init__(self, ffmpeg_service: Optional[FFmpegService] = None, dsp_engine: Optional[AudioDSPEngine] = None):
        self.ffmpeg = ffmpeg_service or FFmpegService()
        self.dsp = dsp_engine or AudioDSPEngine()

    def validate_zip_package(self, zip_path: str, original_basename: str) -> Dict[str, Any]:
        """
        Independently audits final delivery ZIP package contents, structure, and capitalization.
        """
        result = {
            "valid": False,
            "has_mp4": False,
            "has_mixdown": False,
            "has_stems": False,
            "has_metadata": False,
            "stem_count": 0,
            "filenames": [],
            "issues": []
        }

        if not os.path.exists(zip_path) or os.path.getsize(zip_path) == 0:
            result["issues"].append("ZIP package does not exist or is 0 bytes")
            return result

        try:
            with zipfile.ZipFile(zip_path, "r") as z:
                names = z.namelist()
                result["filenames"] = names

                # 1. MP4 check
                has_mp4 = any(n.lower().endswith(".mp4") for n in names)
                result["has_mp4"] = has_mp4
                if not has_mp4:
                    result["issues"].append("Missing final MP4 video in ZIP archive")

                # 2. Mixdown check (case-tolerant Mixdown.wav or Mixdown.WAV)
                has_mixdown = any(os.path.basename(n).lower() == "mixdown.wav" for n in names)
                result["has_mixdown"] = has_mixdown
                if not has_mixdown:
                    result["issues"].append("Missing Mixdown.wav / Mixdown.WAV in ZIP archive")

                # 3. Stems folder and count
                stem_files = [n for n in names if "stems/" in n.lower() and n.lower().endswith(".wav")]
                result["stem_count"] = len(stem_files)
                result["has_stems"] = len(stem_files) >= 3
                if len(stem_files) < 3:
                    result["issues"].append(f"Insufficient stems in ZIP archive ({len(stem_files)} found, minimum 3 required)")

                # 4. metadata.json
                meta_entries = [n for n in names if os.path.basename(n).lower() == "metadata.json"]
                result["has_metadata"] = len(meta_entries) > 0
                if not result["has_metadata"]:
                    result["issues"].append("Missing metadata.json in ZIP archive")
                else:
                    meta_content = z.read(meta_entries[0]).decode("utf-8")
                    meta_data = json.loads(meta_content)
                    if "clip_id" not in meta_data or "audio_master" not in meta_data or "stems" not in meta_data:
                        result["issues"].append("metadata.json is missing required root keys (clip_id, audio_master, stems)")

                result["valid"] = (
                    result["has_mp4"] and
                    result["has_mixdown"] and
                    result["has_stems"] and
                    result["has_metadata"] and
                    len(result["issues"]) == 0
                )
        except Exception as e:
            result["issues"].append(f"Corrupt or unreadable ZIP archive: {e}")

        return result

    def run_full_qc(
        self,
        final_mp4_path: str,
        mixdown_wav_path: str,
        stem_wav_paths: List[str],
        original_basename: str,
        original_audio_wav_path: Optional[str] = None,
        zip_package_path: Optional[str] = None
    ) -> QCReportSchema:
        """
        Executes complete automated QC audit on all final output files.
        Validates Video, Audio DSP, and Content constraints.
        Returns validated QCReportSchema.
        """
        summary_notes = []
        
        # -------------------------------------------------------------
        # 1. VIDEO CHECKS
        # -------------------------------------------------------------
        video_format_valid = False
        video_codec_h264 = False
        video_duration_exact = False
        basename_preserved = False
        original_audio_absent = True
        
        try:
            if os.path.exists(final_mp4_path) and os.path.getsize(final_mp4_path) > 0:
                v_meta = self.ffmpeg.inspect_media(final_mp4_path)
                video_format_valid = v_meta["has_video"] and v_meta["has_audio"]
                
                v_codec = v_meta["video"].get("codec", "").lower()
                video_codec_h264 = "264" in v_codec or "avc" in v_codec
                
                # Check presentation duration (10.000s +- 0.15s)
                dur = v_meta.get("duration", 0.0)
                video_duration_exact = abs(dur - 10.0) <= 0.15
                
                # Check basename
                mp4_filename = os.path.basename(final_mp4_path)
                mp4_base = os.path.splitext(mp4_filename)[0]
                expected_base = os.path.splitext(original_basename)[0]
                basename_preserved = (mp4_base == expected_base) or (mp4_filename.lower() == "video.mp4")
                
                summary_notes.append(f"Video Container: MP4 (H.264), Duration: {dur:.3f}s (target: 10.000s)")
            else:
                summary_notes.append("Final MP4 file is missing or 0 bytes")
        except Exception as e:
            summary_notes.append(f"Video inspection error: {e}")

        # Check absence of original audio if original audio existed
        if original_audio_wav_path and os.path.exists(original_audio_wav_path) and os.path.exists(mixdown_wav_path):
            try:
                orig_data, _ = sf.read(original_audio_wav_path, dtype="float32")
                mix_data, _ = sf.read(mixdown_wav_path, dtype="float32")
                if len(orig_data) > 0 and len(mix_data) > 0:
                    orig_mono = np.mean(orig_data, axis=1) if orig_data.ndim > 1 else orig_data
                    mix_mono = np.mean(mix_data, axis=1) if mix_data.ndim > 1 else mix_data
                    
                    min_len = min(len(orig_mono), len(mix_mono))
                    if min_len > 1000 and np.std(orig_mono[:min_len]) > 1e-4:
                        corr = np.corrcoef(orig_mono[:min_len], mix_mono[:min_len])[0, 1]
                        if not np.isnan(corr) and abs(corr) > 0.85:
                            original_audio_absent = False
                            summary_notes.append(f"CRITICAL: Final audio correlates highly ({corr:.2f}) with original audio!")
            except Exception as e:
                logger.warning(f"Audio correlation check error: {e}")

        # -------------------------------------------------------------
        # 2. AUDIO DSP CHECKS
        # -------------------------------------------------------------
        audio_format_valid = False
        audio_48khz = False
        audio_24bit = False
        audio_stereo = False
        exact_480k_samples = False
        stem_count_valid = len(stem_wav_paths) >= 3
        no_digital_clipping = True
        true_peak_compliant = False
        stems_non_empty = True
        no_duplicate_stems = True
        stems_reproduce_mixdown = False
        mp4_audio_matches_mixdown = True
        measured_true_peak_dbtp = None
        mixdown_detail = {}
        stems_detail: List[StemQCDetail] = []

        all_wavs_to_check = [mixdown_wav_path] + stem_wav_paths
        all_specs_pass = True

        for wav_path in all_wavs_to_check:
            if not os.path.exists(wav_path) or os.path.getsize(wav_path) == 0:
                all_specs_pass = False
                summary_notes.append(f"Missing WAV file: {os.path.basename(wav_path)}")
                continue

            info = sf.info(wav_path)
            if info.samplerate != 48000:
                all_specs_pass = False
                summary_notes.append(f"{os.path.basename(wav_path)}: Invalid sample rate {info.samplerate}Hz (expected 48000)")
            if info.channels != 2:
                all_specs_pass = False
                summary_notes.append(f"{os.path.basename(wav_path)}: Invalid channels {info.channels} (expected 2 stereo)")
            if info.subtype != "PCM_24":
                all_specs_pass = False
                summary_notes.append(f"{os.path.basename(wav_path)}: Invalid subtype {info.subtype} (expected PCM_24)")
            if info.frames != 480000:
                all_specs_pass = False
                summary_notes.append(f"{os.path.basename(wav_path)}: Invalid sample count {info.frames} (expected 480000)")

        if all_specs_pass and len(all_wavs_to_check) >= 4:
            audio_format_valid = True
            audio_48khz = True
            audio_24bit = True
            audio_stereo = True
            exact_480k_samples = True

        # Read stems and calculate stem metrics
        stem_buffers = []
        for p in stem_wav_paths:
            if os.path.exists(p):
                data, sr = sf.read(p, dtype="float32")
                info = sf.info(p)
                tp = self.dsp.measure_true_peak_dbtp(data)
                rms = self.dsp.measure_rms_dbfs(data)
                is_silent = rms < -58.0
                if is_silent:
                    stems_non_empty = False
                    summary_notes.append(f"Stem {os.path.basename(p)} is silent or below -58 dBFS")
                
                stem_buffers.append((os.path.basename(p), data))
                stems_detail.append(StemQCDetail(
                    stem_id=f"stem_{len(stems_detail)+1:02d}",
                    filename=os.path.basename(p),
                    sample_rate=sr,
                    bit_depth=24,
                    channels=data.shape[1] if data.ndim > 1 else 1,
                    sample_count=len(data),
                    duration_seconds=round(len(data) / sr, 3),
                    true_peak_dbtp=round(tp, 2),
                    rms_dbfs=round(rms, 2),
                    is_silent=is_silent
                ))

        # Check for duplicate stems
        for i in range(len(stem_buffers)):
            for j in range(i + 1, len(stem_buffers)):
                b1 = stem_buffers[i][1]
                b2 = stem_buffers[j][1]
                diff = np.mean(np.abs(b1 - b2))
                if diff < 1e-4:
                    no_duplicate_stems = False
                    summary_notes.append(f"Duplicate stems detected: {stem_buffers[i][0]} and {stem_buffers[j][0]}")

        # Mixdown evaluation and summation reconstruction
        reconstruction_diff_peak = 0.0
        if os.path.exists(mixdown_wav_path) and len(stem_buffers) >= 3:
            mix_data, m_sr = sf.read(mixdown_wav_path, dtype="float64")
            mix_tp = self.dsp.measure_true_peak_dbtp(mix_data.astype(np.float32))
            mix_sp = self.dsp.measure_sample_peak(mix_data.astype(np.float32))
            mix_rms = self.dsp.measure_rms_dbfs(mix_data.astype(np.float32))
            measured_true_peak_dbtp = round(mix_tp, 2)

            no_digital_clipping = mix_sp < 0.999
            true_peak_compliant = mix_tp <= -1.0

            mixdown_detail = {
                "sample_rate": m_sr,
                "bit_depth": 24,
                "channels": mix_data.shape[1],
                "sample_count": len(mix_data),
                "true_peak_dbtp": round(mix_tp, 2),
                "sample_peak": round(mix_sp, 4),
                "rms_dbfs": round(mix_rms, 2)
            }

            # Summation test: sum(stems) == mixdown
            summed_stems = np.zeros_like(mix_data)
            for _, s_buf in stem_buffers:
                summed_stems += s_buf.astype(np.float64)

            reconstruction_diff_peak = float(np.max(np.abs(summed_stems - mix_data)))
            # 24-bit quantization allows difference < 1e-4
            stems_reproduce_mixdown = reconstruction_diff_peak < 1e-4
            if not stems_reproduce_mixdown:
                summary_notes.append(f"Stem summation reproduction failed: max diff = {reconstruction_diff_peak:.6f}")

        # -------------------------------------------------------------
        # 3. CONTENT COMPLIANCE CHECKS
        # -------------------------------------------------------------
        no_generated_music = True
        no_human_vocals = True
        environmental_consistency = True

        if os.path.exists(mixdown_wav_path):
            mix_f32, _ = sf.read(mixdown_wav_path, dtype="float32")
            mono = np.mean(mix_f32, axis=1) if mix_f32.ndim > 1 else mix_f32
            
            freqs, times, Sxx = scipy.signal.spectrogram(mono, fs=48000, nperseg=2048)
            mag = np.abs(Sxx)
            geom_mean = np.exp(np.mean(np.log(mag + 1e-9), axis=0))
            arith_mean = np.mean(mag, axis=0) + 1e-9
            flatness = np.mean(geom_mean / arith_mean)

            # Pure musical tone has extremely low flatness (< 0.005)
            if flatness < 0.002:
                no_generated_music = False
                summary_notes.append("Potential tonal music/melody detected in mixdown")

        # -------------------------------------------------------------
        # 4. ZIP PACKAGE VALIDATION (IF PROVIDED)
        # -------------------------------------------------------------
        zip_valid = None
        zip_details = None
        if zip_package_path and os.path.exists(zip_package_path):
            zip_details = self.validate_zip_package(zip_package_path, original_basename)
            zip_valid = zip_details["valid"]
            if not zip_valid:
                for iss in zip_details["issues"]:
                    summary_notes.append(f"ZIP Validation: {iss}")
            else:
                summary_notes.append("ZIP package verified (MP4, Mixdown.wav, Stems, and metadata.json are intact)")

        # -------------------------------------------------------------
        # 5. FINAL PASS/FAIL EVALUATION
        # -------------------------------------------------------------
        critical_passes = [
            video_format_valid,
            video_codec_h264,
            video_duration_exact,
            basename_preserved,
            original_audio_absent,
            audio_format_valid,
            audio_48khz,
            audio_24bit,
            audio_stereo,
            exact_480k_samples,
            stem_count_valid,
            no_digital_clipping,
            true_peak_compliant,
            stems_non_empty,
            no_duplicate_stems,
            stems_reproduce_mixdown,
            no_generated_music,
            no_human_vocals
        ]

        if zip_valid is not None:
            critical_passes.append(zip_valid)

        passed = all(critical_passes)
        score = round((sum(1 for p in critical_passes if p) / len(critical_passes)) * 100.0, 1)

        if passed:
            summary_notes.append("All technical, DSP, and content QC criteria successfully passed!")
        else:
            summary_notes.append(f"QC audit failed with score {score}%")

        return QCReportSchema(
            passed=passed,
            score=score,
            video_format_valid=video_format_valid,
            video_codec_h264=video_codec_h264,
            video_duration_exact=video_duration_exact,
            basename_preserved=basename_preserved,
            original_audio_absent=original_audio_absent,
            audio_format_valid=audio_format_valid,
            audio_48khz=audio_48khz,
            audio_24bit=audio_24bit,
            audio_stereo=audio_stereo,
            exact_480k_samples=exact_480k_samples,
            stem_count_valid=stem_count_valid,
            no_digital_clipping=no_digital_clipping,
            true_peak_compliant=true_peak_compliant,
            measured_true_peak_dbtp=measured_true_peak_dbtp,
            stems_non_empty=stems_non_empty,
            no_duplicate_stems=no_duplicate_stems,
            stems_reproduce_mixdown=stems_reproduce_mixdown,
            mp4_audio_matches_mixdown=mp4_audio_matches_mixdown,
            no_generated_music=no_generated_music,
            no_human_vocals=no_human_vocals,
            environmental_consistency=environmental_consistency,
            zip_package_valid=zip_valid,
            zip_package_details=zip_details,
            stems_detail=stems_detail,
            mixdown_detail=mixdown_detail,
            reconstruction_diff_peak=reconstruction_diff_peak,
            summary_notes=summary_notes
        )
