import os
import sys
import time
import datetime
import traceback
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
import soundfile as sf
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import (
    JobStatus, VideoJob, SourceVideo, OriginalAudioStream,
    OriginalAudioAnalysis, SoundEvent, GeneratedSound, AudioStem,
    Mixdown, OutputArtifact, QCResult, ProviderUsage, JobError, Batch
)
from app.services.ffmpeg_service import FFmpegService
from app.services.audio_classifier import AudioClassifierService
from app.services.gemini_service import GeminiVisionService
from app.services.elevenlabs_service import ElevenLabsService
from app.services.dsp_engine import AudioDSPEngine
from app.services.qc_engine import QualityControlEngine
from app.services.packaging_service import PackagingService

logger = logging.getLogger("supreem.pipeline")

class PipelineRunner:
    def __init__(self):
        self.ffmpeg = FFmpegService()
        self.classifier = AudioClassifierService()
        self.dsp = AudioDSPEngine()
        self.gemini = GeminiVisionService()
        self.elevenlabs = ElevenLabsService(dsp_engine=self.dsp)
        self.qc = QualityControlEngine(ffmpeg_service=self.ffmpeg, dsp_engine=self.dsp)
        self.packaging = PackagingService()

    def process_job(self, job_id: str):
        """
        Main execution pipeline for a video job.
        Implements complete 10-step autonomous sound design and QC workflow.
        """
        db: Session = SessionLocal()
        start_time = time.time()
        
        try:
            job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
            if not job:
                logger.error(f"Job {job_id} not found in database.")
                return

            job.started_at = datetime.datetime.now(datetime.timezone.utc)
            
            # Pre-flight credential check when real API keys are enforced
            if settings.REQUIRE_REAL_API_KEYS:
                missing = []
                if not self.gemini.is_configured(db=db):
                    missing.append("Google Gemini API Key")
                if not self.elevenlabs.is_configured(db=db):
                    missing.append("ElevenLabs API Key")
                if missing:
                    raise RuntimeError(
                        f"Missing required API credentials ({', '.join(missing)}). Please configure credentials in Settings -> API Keys."
                    )

            job.status = JobStatus.INSPECTING_ORIGINAL_AUDIO
            job.progress_percent = 5.0
            job.current_stage_detail = "Probing video and audio streams"
            db.commit()

            # Job temporary workspace
            job_temp_dir = settings.TEMP_DIR / job_id
            job_temp_dir.mkdir(parents=True, exist_ok=True)
            job_output_dir = settings.OUTPUTS_DIR / job_id
            job_output_dir.mkdir(parents=True, exist_ok=True)
            stems_output_dir = job_output_dir / "Stems"
            stems_output_dir.mkdir(parents=True, exist_ok=True)

            source_video = job.source_video
            if not source_video or not os.path.exists(source_video.file_path):
                raise FileNotFoundError(f"Source video file not found for job {job_id}")

            source_path = source_video.file_path

            # -------------------------------------------------------------
            # STEP 1: PROBE & INSPECT ORIGINAL AUDIO
            # -------------------------------------------------------------
            logger.info(f"[{job_id}] Step 1: Probing original media...")
            media_info = self.ffmpeg.inspect_media(source_path)
            
            source_video.duration_seconds = media_info.get("duration", 0.0)
            if media_info.get("video"):
                source_video.width = media_info["video"].get("width")
                source_video.height = media_info["video"].get("height")
                source_video.fps = media_info["video"].get("fps")
                source_video.video_codec = media_info["video"].get("codec")
                source_video.video_bitrate = media_info["video"].get("bitrate")

            has_audio = media_info.get("has_audio", False)
            source_video.has_audio = has_audio
            source_video.audio_streams_count = media_info.get("audio_stream_count", 0)
            job.has_original_audio = has_audio

            extracted_audio_wav = None
            if has_audio:
                # Store audio stream records
                for a_str in media_info.get("audio_streams", []):
                    astream_rec = OriginalAudioStream(
                        source_video_id=source_video.id,
                        stream_index=a_str["stream_index"],
                        codec_name=a_str["codec"],
                        sample_rate=a_str["sample_rate"],
                        channels=a_str["channels"],
                        bitrate=a_str.get("bitrate"),
                        duration_seconds=a_str.get("duration")
                    )
                    db.add(astream_rec)

                # Extract audio to temporary WAV for classification
                extracted_audio_wav = str(job_temp_dir / "extracted_original_audio.wav")
                self.ffmpeg.extract_audio(source_path, extracted_audio_wav)

            # Classify audio
            classification = self.classifier.analyze_audio_file(extracted_audio_wav)
            job.original_audio_classification = classification["category"]

            analysis_rec = OriginalAudioAnalysis(
                job_id=job.id,
                category=classification["category"],
                confidence=classification["confidence"],
                detected_music=classification["detected_music"],
                detected_speech=classification["detected_speech"],
                detected_vocals=classification["detected_vocals"],
                detected_environmental=classification["detected_environmental"],
                detected_silence=classification["detected_silence"],
                rms_db=classification.get("rms_db"),
                spectral_centroid=classification.get("spectral_centroid"),
                features_json=classification.get("features"),
                extracted_audio_path=extracted_audio_wav
            )
            db.add(analysis_rec)
            db.commit()

            # -------------------------------------------------------------
            # STEP 2: REMOVE ORIGINAL AUDIO (DEFAULT POLICY = ENABLED)
            # -------------------------------------------------------------
            job.status = JobStatus.REMOVING_ORIGINAL_AUDIO
            job.progress_percent = 15.0
            job.current_stage_detail = "Removing original audio stream"
            db.commit()

            clean_video_path = str(job_temp_dir / "clean_video_no_audio.mp4")
            logger.info(f"[{job_id}] Step 2: Stripping all original audio streams from {source_path}...")
            self.ffmpeg.strip_audio_from_video(source_path, clean_video_path)
            job.original_audio_removed = True
            db.commit()

            # -------------------------------------------------------------
            # STEP 3: VISUAL ANALYSIS & SOUND EVENT PLANNING (GEMINI)
            # -------------------------------------------------------------
            job.status = JobStatus.ANALYZING_VIDEO
            job.progress_percent = 25.0
            job.current_stage_detail = "Performing visual analysis and sound event planning"
            db.commit()

            logger.info(f"[{job_id}] Step 3: Extracting keyframes and analyzing visual cues...")
            frames_dir = str(job_temp_dir / "frames")
            keyframes = self.ffmpeg.extract_keyframes(clean_video_path, frames_dir, num_frames=10)

            timeline = self.gemini.analyze_video_frames(
                frame_paths=keyframes,
                video_metadata=media_info,
                original_basename=job.original_basename,
                db=db
            )

            # Record planned sound events in database
            saved_events = []
            for ev in timeline.events:
                sev = SoundEvent(
                    job_id=job.id,
                    event_id=ev.event_id,
                    start_time_ms=ev.start_time_ms,
                    end_time_ms=ev.end_time_ms,
                    duration_ms=max(100, ev.end_time_ms - ev.start_time_ms),
                    sound_category=ev.sound_category,
                    visual_action=ev.visual_action,
                    sound_description=ev.sound_description,
                    generation_prompt=ev.generation_prompt,
                    priority=ev.priority,
                    confidence=ev.confidence,
                    intended_track=ev.intended_track,
                    estimated_distance=ev.estimated_distance,
                    acoustic_environment=ev.acoustic_environment,
                    suggested_gain_db=ev.suggested_gain_db
                )
                db.add(sev)
                saved_events.append(sev)
            db.commit()

            # -------------------------------------------------------------
            # STEP 4: AI SOUND EFFECT GENERATION (ELEVENLABS)
            # -------------------------------------------------------------
            job.status = JobStatus.GENERATING_SOUNDS
            job.progress_percent = 40.0
            job.current_stage_detail = "Synthesizing individual sound effects"
            db.commit()

            total_cost = 0.0
            event_audio_map = {}  # event_id -> (audio_pcm_array, metadata)

            for idx, ev in enumerate(saved_events):
                pct = 40.0 + (30.0 * (idx / len(saved_events)))
                job.progress_percent = round(pct, 1)
                job.current_stage_detail = f"Generating sound {idx+1}/{len(saved_events)}: {ev.sound_description[:40]}..."
                db.commit()

                duration_sec = ev.duration_ms / 1000.0
                pcm_audio, meta = self.elevenlabs.generate_sound_effect(
                    prompt=ev.generation_prompt,
                    duration_seconds=duration_sec,
                    category=ev.sound_category,
                    description=ev.sound_description,
                    db=db
                )

                event_audio_map[ev.id] = (pcm_audio, meta)
                total_cost += meta.get("estimated_cost_usd", 0.0)

                # Record sound record
                snd_path = str(job_temp_dir / f"sound_{ev.event_id}.wav")
                sf_meta = sf.write(snd_path, pcm_audio, 48000, subtype="PCM_24")
                
                gen_snd = GeneratedSound(
                    event_id=ev.id,
                    file_path=snd_path,
                    sample_rate=48000,
                    channels=2,
                    duration_seconds=duration_sec,
                    provider=meta.get("provider", "elevenlabs"),
                    model_used=meta.get("model")
                )
                db.add(gen_snd)

                # Usage entry
                usage = ProviderUsage(
                    job_id=job.id,
                    provider=meta.get("provider", "elevenlabs"),
                    operation="sound_generation",
                    audio_characters=meta.get("characters", len(ev.generation_prompt)),
                    audio_duration_seconds=duration_sec,
                    estimated_cost_usd=meta.get("estimated_cost_usd", 0.0)
                )
                db.add(usage)

            job.estimated_api_cost_usd = total_cost
            db.commit()

            # -------------------------------------------------------------
            # STEP 5: BUILD SAMPLE-ACCURATE STEMS & MIXING
            # -------------------------------------------------------------
            job.status = JobStatus.BUILDING_STEMS
            job.progress_percent = 72.0
            job.current_stage_detail = "Assembling sample-accurate audio stems"
            db.commit()

            # Group events into at least 3 distinct stems
            # Collect unique tracks
            track_names = []
            for ev in saved_events:
                t_name = ev.intended_track
                if t_name not in track_names:
                    track_names.append(t_name)

            # Ensure at least 3 stems
            while len(track_names) < 3:
                track_names.append(f"Stem {len(track_names)+1} - Supplemental Detail")

            # Allocate buffers
            stem_buffers = []  # list of (stem_id, filename, buffer)
            stem_meta_records = []

            for s_idx, t_name in enumerate(track_names):
                stem_id = f"stem_{s_idx+1:02d}"
                clean_title = "".join(c if c.isalnum() or c in (" ", "_", "-") else "" for c in t_name.split("-")[-1].strip().lower()).replace(" ", "_")
                filename = f"{clean_title}.wav" if clean_title else f"stem_{s_idx+1:02d}.wav"
                
                buffer = self.dsp.create_empty_stem_buffer()

                # Find events allocated to this track
                matching_evs = [e for e in saved_events if e.intended_track == t_name]
                for mev in matching_evs:
                    if mev.id in event_audio_map:
                        snd_pcm, _ = event_audio_map[mev.id]
                        buffer = self.dsp.place_sound_on_stem(
                            stem_buffer=buffer,
                            sound_data=snd_pcm,
                            start_ms=mev.start_time_ms,
                            gain_db=mev.suggested_gain_db
                        )

                # If buffer is still empty (e.g. supplemental stem), add subtle acoustic texture
                if np.max(np.abs(buffer)) < 1e-4:
                    tex = self.dsp.generate_procedural_fallback_audio("ambience", 10.0, "subtle room resonance")
                    buffer = self.dsp.place_sound_on_stem(buffer, tex, 0, gain_db=-18.0)

                stem_buffers.append((stem_id, filename, buffer))
                stem_meta_records.append({
                    "stem_id": stem_id,
                    "filename": filename,
                    "category": t_name
                })

            job.status = JobStatus.MIXING
            job.progress_percent = 80.0
            job.current_stage_detail = "Balancing stems and rendering Mixdown.wav"
            db.commit()

            mixdown_path = str(job_output_dir / "Mixdown.wav")
            mix_result = self.dsp.balance_and_export_stems(
                stem_buffers=stem_buffers,
                output_stems_dir=str(stems_output_dir),
                mixdown_output_path=mixdown_path
            )

            # Record Stems in DB
            saved_stem_models = []
            for s_info in mix_result["stems"]:
                stem_rec = AudioStem(
                    job_id=job.id,
                    stem_index=int(s_info["stem_id"].split("_")[-1]),
                    stem_id=s_info["stem_id"],
                    filename=s_info["filename"],
                    relative_path=f"Stems/{s_info['filename']}",
                    file_path=s_info["file_path"],
                    category=next((r["category"] for r in stem_meta_records if r["stem_id"] == s_info["stem_id"]), "SFX"),
                    sample_rate=s_info["sample_rate"],
                    bit_depth=s_info["bit_depth"],
                    channels=s_info["channels"],
                    sample_count=s_info["sample_count"],
                    duration_seconds=s_info["duration_seconds"],
                    true_peak_dbtp=s_info["true_peak_dbtp"],
                    rms_dbfs=s_info["rms_dbfs"]
                )
                db.add(stem_rec)
                saved_stem_models.append(stem_rec)

            # Record Mixdown in DB
            mix_rec = Mixdown(
                job_id=job.id,
                file_path=mixdown_path,
                filename="Mixdown.wav",
                sample_rate=mix_result["sample_rate"],
                bit_depth=mix_result["bit_depth"],
                channels=mix_result["channels"],
                sample_count=mix_result["sample_count"],
                duration_seconds=mix_result["duration_seconds"],
                true_peak_dbtp=mix_result["true_peak_dbtp"],
                rms_dbfs=mix_result["rms_dbfs"],
                reconstruction_max_diff=mix_result["reconstruction_max_diff"],
                is_clipping=mix_result["is_clipping"]
            )
            db.add(mix_rec)
            db.commit()

            # -------------------------------------------------------------
            # STEP 6: RENDER FINAL MP4 VIDEO
            # -------------------------------------------------------------
            job.status = JobStatus.RENDERING_VIDEO
            job.progress_percent = 88.0
            job.current_stage_detail = "Multiplexing final H.264 video with Mixdown.wav"
            db.commit()

            final_mp4_name = f"{job.original_basename}.mp4" if not job.original_basename.lower().endswith(".mp4") else job.original_basename
            final_mp4_path = str(job_output_dir / final_mp4_name)
            
            logger.info(f"[{job_id}] Step 6: Multiplexing final MP4 to {final_mp4_path}...")
            self.ffmpeg.render_final_video(
                video_source_path=clean_video_path,
                audio_mixdown_path=mixdown_path,
                output_mp4_path=final_mp4_path,
                target_duration=10.0,
                target_fps=30
            )

            # Record final MP4 artifact
            db.add(OutputArtifact(
                job_id=job.id,
                artifact_type="final_mp4",
                filename=final_mp4_name,
                file_path=final_mp4_path,
                file_size_bytes=os.path.getsize(final_mp4_path),
                mime_type="video/mp4"
            ))
            db.add(OutputArtifact(
                job_id=job.id,
                artifact_type="mixdown_wav",
                filename="Mixdown.wav",
                file_path=mixdown_path,
                file_size_bytes=os.path.getsize(mixdown_path),
                mime_type="audio/wav"
            ))
            for sm in saved_stem_models:
                db.add(OutputArtifact(
                    job_id=job.id,
                    artifact_type="stem_wav",
                    filename=sm.filename,
                    file_path=sm.file_path,
                    file_size_bytes=os.path.getsize(sm.file_path),
                    mime_type="audio/wav"
                ))
            db.commit()

            # -------------------------------------------------------------
            # STEP 7: AUTOMATED QUALITY CONTROL (QC)
            # -------------------------------------------------------------
            job.status = JobStatus.VALIDATING
            job.progress_percent = 94.0
            job.current_stage_detail = "Performing rigorous multi-tier QC validation"
            db.commit()

            stem_file_paths = [s.file_path for s in saved_stem_models]
            qc_report = self.qc.run_full_qc(
                final_mp4_path=final_mp4_path,
                mixdown_wav_path=mixdown_path,
                stem_wav_paths=stem_file_paths,
                original_basename=job.original_basename,
                original_audio_wav_path=extracted_audio_wav
            )

            qc_rec = QCResult(
                job_id=job.id,
                passed=qc_report.passed,
                score=qc_report.score,
                video_format_valid=qc_report.video_format_valid,
                video_codec_h264=qc_report.video_codec_h264,
                video_duration_exact=qc_report.video_duration_exact,
                basename_preserved=qc_report.basename_preserved,
                original_audio_absent=qc_report.original_audio_absent,
                audio_format_valid=qc_report.audio_format_valid,
                audio_48khz=qc_report.audio_48khz,
                audio_24bit=qc_report.audio_24bit,
                audio_stereo=qc_report.audio_stereo,
                exact_480k_samples=qc_report.exact_480k_samples,
                stem_count_valid=qc_report.stem_count_valid,
                no_digital_clipping=qc_report.no_digital_clipping,
                true_peak_compliant=qc_report.true_peak_compliant,
                measured_true_peak_dbtp=qc_report.measured_true_peak_dbtp,
                stems_non_empty=qc_report.stems_non_empty,
                no_duplicate_stems=qc_report.no_duplicate_stems,
                stems_reproduce_mixdown=qc_report.stems_reproduce_mixdown,
                mp4_audio_matches_mixdown=qc_report.mp4_audio_matches_mixdown,
                no_generated_music=qc_report.no_generated_music,
                no_human_vocals=qc_report.no_human_vocals,
                environmental_consistency=qc_report.environmental_consistency,
                details_json=qc_report.model_dump(),
                report_text="\n".join(qc_report.summary_notes)
            )
            db.add(qc_rec)
            db.commit()

            if not qc_report.passed:
                raise RuntimeError(f"Automated QC verification failed: {qc_report.summary_notes}")

            # -------------------------------------------------------------
            # STEP 8: PACKAGING & ZIP CREATION
            # -------------------------------------------------------------
            job.status = JobStatus.PACKAGING
            job.progress_percent = 97.0
            job.current_stage_detail = "Creating delivery ZIP archive and metadata.json"
            db.commit()

            metadata_dict = self.packaging.build_metadata_json(
                clip_id=job.id,
                original_basename=job.original_basename,
                video_specs={"width": source_video.width or 1920, "height": source_video.height or 1080, "fps": 30},
                stems_info=[s.model_dump() for s in qc_report.stems_detail],
                sound_events=[{"intended_track": e.intended_track, "sound_category": e.sound_category, "sound_description": e.sound_description, "start_time_ms": e.start_time_ms, "end_time_ms": e.end_time_ms} for e in saved_events]
            )

            zip_filename = f"{job.original_basename}.zip"
            zip_path = str(job_output_dir / zip_filename)
            self.packaging.create_video_package(
                job_id=job.id,
                original_basename=job.original_basename,
                final_mp4_path=final_mp4_path,
                mixdown_wav_path=mixdown_path,
                stem_paths=stem_file_paths,
                output_zip_path=zip_path,
                metadata_dict=metadata_dict
            )

            # Audit ZIP package contents and capitalization
            zip_audit = self.qc.validate_zip_package(zip_path, job.original_basename)
            if not zip_audit["valid"]:
                raise RuntimeError(f"Automated ZIP package QC audit failed: {zip_audit['issues']}")
            logger.info(f"[{job_id}] ZIP package passed independent integrity QC ({len(zip_audit['filenames'])} items).")

            db.add(OutputArtifact(
                job_id=job.id,
                artifact_type="zip_package",
                filename=zip_filename,
                file_path=zip_path,
                file_size_bytes=os.path.getsize(zip_path),
                mime_type="application/zip"
            ))

            # -------------------------------------------------------------
            # STEP 9: COMPLETION & CLEANUP
            # -------------------------------------------------------------
            elapsed = time.time() - start_time
            job.status = JobStatus.COMPLETED
            job.progress_percent = 100.0
            job.current_stage_detail = "Successfully completed with full QC pass"
            job.completed_at = datetime.datetime.now(datetime.timezone.utc)
            job.processing_time_seconds = round(elapsed, 2)
            db.commit()

            # Update batch stats if part of batch
            if job.batch_id:
                batch = db.query(Batch).filter(Batch.id == job.batch_id).first()
                if batch:
                    batch.completed_videos = db.query(VideoJob).filter(VideoJob.batch_id == batch.id, VideoJob.status == JobStatus.COMPLETED).count()
                    batch.failed_videos = db.query(VideoJob).filter(VideoJob.batch_id == batch.id, VideoJob.status == JobStatus.FAILED).count()
                    if batch.completed_videos + batch.failed_videos >= batch.total_videos:
                        batch.status = "Completed" if batch.failed_videos == 0 else "Completed with errors"
                    db.commit()

            logger.info(f"[{job_id}] Pipeline completed successfully in {elapsed:.2f}s!")

        except Exception as e:
            elapsed = time.time() - start_time
            tb = traceback.format_exc()
            logger.error(f"[{job_id}] Pipeline failed: {e}\n{tb}")
            
            try:
                job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
                if job:
                    job.status = JobStatus.FAILED
                    job.error_message = str(e)
                    job.current_stage_detail = f"Failed: {str(e)[:100]}"
                    job.processing_time_seconds = round(elapsed, 2)
                    
                    err = JobError(
                        job_id=job.id,
                        stage=str(job.status),
                        error_type=type(e).__name__,
                        message=str(e),
                        traceback=tb
                    )
                    db.add(err)

                    if job.batch_id:
                        batch = db.query(Batch).filter(Batch.id == job.batch_id).first()
                        if batch:
                            batch.failed_videos = db.query(VideoJob).filter(VideoJob.batch_id == batch.id, VideoJob.status == JobStatus.FAILED).count()
                            if batch.completed_videos + batch.failed_videos >= batch.total_videos:
                                batch.status = "Completed with errors"

                    db.commit()
            except Exception as dbe:
                logger.error(f"Failed to record job failure in db: {dbe}")

        finally:
            db.close()
