from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models import VideoJob, JobStatus, OriginalAudioAnalysis, ProviderUsage
from app.schemas.stats import DashboardStatsSchema

router = APIRouter(prefix="/stats", tags=["Dashboard Statistics"])

@router.get("", response_model=DashboardStatsSchema)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_uploaded = db.query(VideoJob).count()
    with_audio = db.query(VideoJob).filter(VideoJob.has_original_audio == True).count()
    without_audio = db.query(VideoJob).filter(VideoJob.has_original_audio == False).count()
    
    music_detected = db.query(OriginalAudioAnalysis).filter(OriginalAudioAnalysis.detected_music == True).count()
    
    processing = db.query(VideoJob).filter(
        VideoJob.status.notin_([JobStatus.UPLOADED, JobStatus.COMPLETED, JobStatus.FAILED])
    ).count()
    
    completed = db.query(VideoJob).filter(VideoJob.status == JobStatus.COMPLETED).count()
    failed = db.query(VideoJob).filter(VideoJob.status == JobStatus.FAILED).count()
    
    # Average processing time
    avg_time = db.query(func.avg(VideoJob.processing_time_seconds)).filter(
        VideoJob.status == JobStatus.COMPLETED
    ).scalar() or 0.0

    # Total estimated cost
    total_cost = db.query(func.sum(VideoJob.estimated_api_cost_usd)).scalar() or 0.0

    overall_completion = 0.0
    if total_uploaded > 0:
        overall_completion = round((completed / total_uploaded) * 100.0, 1)

    # Recent activities
    recent_jobs = db.query(VideoJob).order_by(VideoJob.created_at.desc()).limit(10).all()
    recent_activity = [
        {
            "id": j.id,
            "filename": j.original_filename,
            "status": str(j.status.value) if hasattr(j.status, 'value') else str(j.status),
            "progress": j.progress_percent,
            "has_audio": j.has_original_audio,
            "audio_class": j.original_audio_classification,
            "created_at": j.created_at.isoformat() if j.created_at else None
        }
        for j in recent_jobs
    ]

    return DashboardStatsSchema(
        total_uploaded_videos=total_uploaded,
        videos_with_original_audio=with_audio,
        videos_without_original_audio=without_audio,
        videos_with_detected_music=music_detected,
        videos_processing=processing,
        completed_videos=completed,
        failed_videos=failed,
        average_processing_time_seconds=round(float(avg_time), 2),
        total_api_cost_usd=round(float(total_cost), 4),
        overall_completion_percentage=overall_completion,
        recent_activity=recent_activity
    )

