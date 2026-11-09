import os
import zipfile
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import Batch, VideoJob, JobStatus, User, OutputArtifact
from app.schemas.batch import BatchCreate, BatchSummary, BatchDetail
from app.api.auth import get_current_user

router = APIRouter(prefix="/batches", tags=["Batches"])

@router.get("", response_model=List[BatchSummary])
def list_batches(db: Session = Depends(get_db)):
    batches = db.query(Batch).order_by(Batch.created_at.desc()).all()
    return batches

@router.post("", response_model=BatchSummary)
def create_batch(batch_in: BatchCreate, db: Session = Depends(get_db), user: Optional[User] = Depends(get_current_user)):
    batch = Batch(
        name=batch_in.name or f"Batch {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M')}",
        user_id=user.id if user else None
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch

@router.get("/{batch_id}", response_model=BatchDetail)
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch

@router.post("/{batch_id}/start")
def start_batch_processing(batch_id: str, db: Session = Depends(get_db)):
    from app.services.task_manager import task_manager
    
    # Pre-flight credential check when real API keys are enforced
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

    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    queued_count = 0
    for job in batch.jobs:
        if job.status in (JobStatus.UPLOADED, JobStatus.FAILED):
            task_manager.submit_job(job.id)
            queued_count += 1

    batch.status = "Processing"
    db.commit()
    return {"message": f"Successfully queued {queued_count} videos for processing", "queued_count": queued_count}

@router.get("/{batch_id}/download-all")
def download_all_completed_zips(batch_id: str, db: Session = Depends(get_db)):
    """Package all completed per-video ZIPs into a single combined batch archive."""
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    completed_jobs = db.query(VideoJob).filter(
        VideoJob.batch_id == batch_id,
        VideoJob.status == JobStatus.COMPLETED
    ).all()

    if not completed_jobs:
        raise HTTPException(status_code=400, detail="No completed videos in this batch to download")

    batch_zip_path = str(settings.OUTPUTS_DIR / f"batch_{batch_id}_all_completed.zip")
    with zipfile.ZipFile(batch_zip_path, "w", compression=zipfile.ZIP_DEFLATED) as master_zip:
        for job in completed_jobs:
            zip_art = db.query(OutputArtifact).filter(
                OutputArtifact.job_id == job.id,
                OutputArtifact.artifact_type == "zip_package"
            ).first()
            if zip_art and os.path.exists(zip_art.file_path):
                master_zip.write(zip_art.file_path, arcname=zip_art.filename)

    return FileResponse(
        batch_zip_path,
        media_type="application/zip",
        filename=f"batch_{batch.name.replace(' ', '_')}_completed.zip"
    )

