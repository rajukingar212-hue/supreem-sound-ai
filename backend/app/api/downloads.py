import os
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import VideoJob, OutputArtifact, AudioStem

router = APIRouter(prefix="/downloads", tags=["Downloads & Media Serving"])

@router.get("/video/{job_id}")
def download_final_video(job_id: str, db: Session = Depends(get_db)):
    """Serve or stream final H.264 MP4."""
    art = db.query(OutputArtifact).filter(
        OutputArtifact.job_id == job_id,
        OutputArtifact.artifact_type == "final_mp4"
    ).first()
    if not art or not os.path.exists(art.file_path):
        raise HTTPException(status_code=404, detail="Final video MP4 not found")
        
    return FileResponse(
        art.file_path,
        media_type="video/mp4",
        filename=art.filename
    )

@router.get("/mixdown/{job_id}")
def download_mixdown(job_id: str, db: Session = Depends(get_db)):
    """Serve or stream Mixdown.wav."""
    art = db.query(OutputArtifact).filter(
        OutputArtifact.job_id == job_id,
        OutputArtifact.artifact_type == "mixdown_wav"
    ).first()
    if not art or not os.path.exists(art.file_path):
        raise HTTPException(status_code=404, detail="Mixdown.wav not found")
        
    return FileResponse(
        art.file_path,
        media_type="audio/wav",
        filename="Mixdown.wav"
    )

@router.get("/stem/{stem_id}")
def download_stem(stem_id: str, db: Session = Depends(get_db)):
    """Serve individual Stem WAV."""
    stem = db.query(AudioStem).filter(AudioStem.id == stem_id).first()
    if not stem or not os.path.exists(stem.file_path):
        raise HTTPException(status_code=404, detail="Stem WAV not found")
        
    return FileResponse(
        stem.file_path,
        media_type="audio/wav",
        filename=stem.filename
    )

@router.get("/zip/{job_id}")
def download_video_zip(job_id: str, db: Session = Depends(get_db)):
    """Serve the final delivery ZIP package for this video."""
    art = db.query(OutputArtifact).filter(
        OutputArtifact.job_id == job_id,
        OutputArtifact.artifact_type == "zip_package"
    ).first()
    if not art or not os.path.exists(art.file_path):
        raise HTTPException(status_code=404, detail="ZIP package not found")
        
    return FileResponse(
        art.file_path,
        media_type="application/zip",
        filename=art.filename
    )

