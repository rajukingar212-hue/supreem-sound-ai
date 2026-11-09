import os
import shutil
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import Batch, VideoJob, SourceVideo, JobStatus, User, OutputArtifact, QCResult
from app.schemas.video_job import JobSummary, JobDetail, StemSummary, ArtifactSummary
from app.schemas.sound_event import SoundEventSchema
from app.schemas.qc import QCReportSchema
from app.services.task_manager import task_manager

router = APIRouter(prefix="/jobs", tags=["Video Jobs"])

@router.get("", response_model=List[JobSummary])
def list_jobs(
    batch_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(VideoJob)
    if batch_id:
        query = query.filter(VideoJob.batch_id == batch_id)
    if status_filter:
        query = query.filter(VideoJob.status == status_filter)
    jobs = query.order_by(VideoJob.created_at.desc()).all()
    return jobs

@router.post("/upload", response_model=List[JobSummary])
async def upload_videos(
    files: List[UploadFile] = File(...),
    batch_id: Optional[str] = Form(None),
    auto_start: bool = Form(False),
    db: Session = Depends(get_db)
):
    """
    Handle single or multiple video uploads.
    Validates file extensions, file sizes, creates database records,
    and optionally triggers automatic processing.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    # If no batch_id specified, create or attach to active batch
    if not batch_id:
        new_batch = Batch(name=f"Upload Batch ({len(files)} videos)")
        db.add(new_batch)
        db.commit()
        db.refresh(new_batch)
        batch_id = new_batch.id
    else:
        new_batch = db.query(Batch).filter(Batch.id == batch_id).first()

    created_jobs = []

    for file in files:
        filename = file.filename or "video.mp4"
        ext = os.path.splitext(filename)[1].lower()
        if ext not in settings.ALLOWED_VIDEO_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format {ext}. Allowed formats: {', '.join(settings.ALLOWED_VIDEO_EXTENSIONS)}"
            )

        job_id = str(uuid.uuid4())
        basename = os.path.splitext(filename)[0]
        
        # Save file securely to uploads folder
        safe_filename = f"{job_id}_{filename}"
        dest_path = settings.UPLOADS_DIR / safe_filename

        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = os.path.getsize(dest_path)
        if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
            os.remove(dest_path)
            raise HTTPException(status_code=400, detail=f"File {filename} exceeds 500 MB limit")

        job = VideoJob(
            id=job_id,
            batch_id=batch_id,
            original_filename=filename,
            original_basename=basename,
            status=JobStatus.UPLOADED,
            progress_percent=0.0,
            current_stage_detail="Uploaded and queued for processing"
        )
        db.add(job)

        src = SourceVideo(
            job_id=job_id,
            file_path=str(dest_path),
            file_size_bytes=file_size,
            mime_type=file.content_type
        )
        db.add(src)
        created_jobs.append(job)

    if new_batch:
        new_batch.total_videos = db.query(VideoJob).filter(VideoJob.batch_id == batch_id).count()

    db.commit()

    # If auto-start requested, submit to background manager
    if auto_start:
        for job in created_jobs:
            task_manager.submit_job(job.id)

    return created_jobs

@router.post("/{job_id}/start")
def start_job(job_id: str, db: Session = Depends(get_db)):
    if settings.REQUIRE_REAL_API_KEYS:
        from app.services.credential_manager import credential_manager
        missing = []
        if not credential_manager.get_active_api_key(db, "gemini"):
            missing.append("Google Gemini API Key")
        if not credential_manager.get_active_api_key(db, "elevenlabs"):
            missing.append("ElevenLabs API Key")
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot start processing: Missing required API keys ({', '.join(missing)}). Please configure your API credentials in Settings -> API Keys."
            )

    job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    task_manager.submit_job(job.id)
    return {"message": "Job successfully queued for processing", "job_id": job.id}

@router.post("/{job_id}/retry")
def retry_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = JobStatus.RETRYING
    job.retry_count += 1
    job.error_message = None
    db.commit()

    task_manager.submit_job(job.id)
    return {"message": "Job re-queued for processing", "job_id": job.id, "retry_count": job.retry_count}

@router.get("/{job_id}", response_model=JobDetail)
def get_job_detail(job_id: str, db: Session = Depends(get_db)):
    job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Map details
    src = job.source_video
    src_duration = src.duration_seconds if src else None
    src_res = f"{src.width}x{src.height}" if src and src.width else None
    src_fps = src.fps if src else None
    src_codec = src.video_codec if src else None

    # Stems
    stems_out = [
        StemSummary(
            id=s.id,
            stem_id=s.stem_id,
            filename=s.filename,
            relative_path=s.relative_path,
            category=s.category,
            surface_material=s.surface_material,
            sample_rate=s.sample_rate,
            bit_depth=s.bit_depth,
            channels=s.channels,
            sample_count=s.sample_count,
            duration_seconds=s.duration_seconds,
            true_peak_dbtp=s.true_peak_dbtp,
            rms_dbfs=s.rms_dbfs
        )
        for s in job.audio_stems
    ]

    # Artifacts
    artifacts_out = [
        ArtifactSummary(
            id=a.id,
            artifact_type=a.artifact_type,
            filename=a.filename,
            file_size_bytes=a.file_size_bytes,
            mime_type=a.mime_type
        )
        for a in job.artifacts
    ]

    # Paths
    mix_path = job.mixdown.file_path if job.mixdown else None
    mp4_art = next((a.file_path for a in job.artifacts if a.artifact_type == "final_mp4"), None)
    zip_art = next((a.file_path for a in job.artifacts if a.artifact_type == "zip_package"), None)

    # QC Report
    qc_out = None
    if job.qc_result and job.qc_result.details_json:
        qc_out = QCReportSchema.model_validate(job.qc_result.details_json)

    # Audio analysis
    analysis_dict = None
    if job.audio_analysis:
        analysis_dict = {
            "category": job.audio_analysis.category,
            "confidence": job.audio_analysis.confidence,
            "detected_music": job.audio_analysis.detected_music,
            "detected_speech": job.audio_analysis.detected_speech,
            "detected_vocals": job.audio_analysis.detected_vocals,
            "detected_environmental": job.audio_analysis.detected_environmental,
            "detected_silence": job.audio_analysis.detected_silence,
            "rms_db": job.audio_analysis.rms_db,
            "spectral_centroid": job.audio_analysis.spectral_centroid,
            "features": job.audio_analysis.features_json
        }

    return JobDetail(
        id=job.id,
        batch_id=job.batch_id,
        original_filename=job.original_filename,
        original_basename=job.original_basename,
        status=job.status,
        progress_percent=job.progress_percent,
        current_stage_detail=job.current_stage_detail,
        has_original_audio=job.has_original_audio,
        original_audio_classification=job.original_audio_classification,
        original_audio_removed=job.original_audio_removed,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        processing_time_seconds=job.processing_time_seconds,
        estimated_api_cost_usd=job.estimated_api_cost_usd,
        error_message=job.error_message,
        retry_count=job.retry_count,
        source_duration=src_duration,
        source_resolution=src_res,
        source_fps=src_fps,
        source_codec=src_codec,
        audio_analysis_details=analysis_dict,
        sound_events=[
            SoundEventSchema(
                event_id=e.event_id,
                start_time_ms=e.start_time_ms,
                end_time_ms=e.end_time_ms,
                sound_category=e.sound_category,
                visual_action=e.visual_action,
                sound_description=e.sound_description,
                generation_prompt=e.generation_prompt,
                priority=e.priority,
                confidence=e.confidence,
                intended_track=e.intended_track,
                estimated_distance=e.estimated_distance,
                acoustic_environment=e.acoustic_environment,
                suggested_gain_db=e.suggested_gain_db
            )
            for e in job.sound_events
        ],
        stems=stems_out,
        mixdown_path=mix_path,
        final_video_path=mp4_art,
        zip_package_path=zip_art,
        qc_result=qc_out,
        artifacts=artifacts_out
    )

