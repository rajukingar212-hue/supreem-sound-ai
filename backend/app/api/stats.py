import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

from app.core.database import get_db
from app.models import (
    VideoJob, JobStatus, OriginalAudioAnalysis, ProviderUsage, QCResult
)
from app.schemas.stats import (
    DashboardStatsSchema, MetricDetailsResponse, MetricDetailItem
)

router = APIRouter(prefix="/stats", tags=["Dashboard Statistics"])

@router.get("", response_model=DashboardStatsSchema)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    100% database-driven mathematical statistics.
    All metrics are directly derived from actual database records.
    Never uses hardcoded, estimated, or fabricated numbers.
    """
    # Total unique ingested videos successfully accepted by the application
    total_uploaded = db.query(VideoJob).count()

    # Original audio stream detection verified by FFprobe
    with_audio = db.query(VideoJob).filter(VideoJob.has_original_audio == True).count()
    without_audio = db.query(VideoJob).filter(VideoJob.has_original_audio == False).count()

    # Actual music streams detected by audio classification service
    music_detected = db.query(OriginalAudioAnalysis).filter(OriginalAudioAnalysis.detected_music == True).count()

    # Jobs currently in progress
    processing = db.query(VideoJob).filter(
        VideoJob.status.notin_([JobStatus.UPLOADED, JobStatus.COMPLETED, JobStatus.FAILED])
    ).count()

    # Completed & Validated: processing completed AND final automated QC passed
    completed = (
        db.query(VideoJob)
        .join(QCResult, VideoJob.id == QCResult.job_id)
        .filter(VideoJob.status == JobStatus.COMPLETED, QCResult.passed == True)
        .count()
    )

    # Failed / In Review: jobs that failed execution OR jobs where final QC failed
    failed = (
        db.query(VideoJob)
        .outerjoin(QCResult, VideoJob.id == QCResult.job_id)
        .filter(
            or_(
                VideoJob.status == JobStatus.FAILED,
                and_(VideoJob.status == JobStatus.COMPLETED, QCResult.passed == False)
            )
        )
        .count()
    )

    # Average processing time: calculate exclusively from completed jobs with recorded duration > 0
    avg_time_query = (
        db.query(func.avg(VideoJob.processing_time_seconds))
        .filter(VideoJob.status == JobStatus.COMPLETED, VideoJob.processing_time_seconds > 0)
        .scalar()
    )
    avg_time = round(float(avg_time_query), 2) if (avg_time_query is not None and avg_time_query > 0) else None

    # Estimated AI Cost: calculate ONLY from actual recorded provider usage records
    provider_usage_count = db.query(ProviderUsage).count()
    if provider_usage_count > 0:
        total_cost_query = db.query(func.sum(ProviderUsage.estimated_cost_usd)).scalar() or 0.0
        total_cost = round(float(total_cost_query), 4)
        cost_available = True
    else:
        total_cost = None
        cost_available = False

    overall_completion = 0.0
    if total_uploaded > 0:
        overall_completion = round((completed / total_uploaded) * 100.0, 1)

    # Recent activities (genuine database records only)
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
        average_processing_time_seconds=avg_time,
        total_api_cost_usd=total_cost,
        cost_available=cost_available,
        database_status="Connected",
        last_updated=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        overall_completion_percentage=overall_completion,
        recent_activity=recent_activity
    )

@router.get("/details", response_model=MetricDetailsResponse)
def get_metric_details(
    metric: str = Query(..., description="total_ingested | audio_detected | completed_validated | failed_review | music_detected"),
    db: Session = Depends(get_db)
):
    """
    Transparent data audit endpoint.
    Returns the exact database records contributing to a specific metric.
    """
    metric_key = metric.lower().strip()

    title = ""
    description = ""
    jobs_query = db.query(VideoJob)

    if metric_key == "total_ingested":
        title = "Total Ingested Videos"
        description = "Unique videos successfully accepted and recorded in the database."
        jobs = jobs_query.order_by(VideoJob.created_at.desc()).all()

    elif metric_key == "audio_detected":
        title = "Original Audio Detected"
        description = "Videos whose original audio streams were detected by FFprobe inspection."
        jobs = jobs_query.filter(VideoJob.has_original_audio == True).order_by(VideoJob.created_at.desc()).all()

    elif metric_key == "completed_validated":
        title = "Completed & Validated"
        description = "Videos that completed the sound design pipeline and passed 100% of automated QC checks."
        jobs = (
            jobs_query
            .join(QCResult, VideoJob.id == QCResult.job_id)
            .filter(VideoJob.status == JobStatus.COMPLETED, QCResult.passed == True)
            .order_by(VideoJob.completed_at.desc().nullslast())
            .all()
        )

    elif metric_key == "failed_review":
        title = "Failed / In Review Queue"
        description = "Videos that failed processing or failed QC validation, requiring review or retry."
        jobs = (
            jobs_query
            .outerjoin(QCResult, VideoJob.id == QCResult.job_id)
            .filter(
                or_(
                    VideoJob.status == JobStatus.FAILED,
                    and_(VideoJob.status == JobStatus.COMPLETED, QCResult.passed == False)
                )
            )
            .order_by(VideoJob.created_at.desc())
            .all()
        )

    elif metric_key == "music_detected":
        title = "Detected Music Streams"
        description = "Videos where audio classification detected background music, instrumental music, or songs."
        jobs = (
            jobs_query
            .join(OriginalAudioAnalysis, VideoJob.id == OriginalAudioAnalysis.job_id)
            .filter(OriginalAudioAnalysis.detected_music == True)
            .order_by(VideoJob.created_at.desc())
            .all()
        )

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown metric '{metric}'. Supported: total_ingested, audio_detected, completed_validated, failed_review, music_detected"
        )

    records = []
    for j in jobs:
        qc_passed = j.qc_result.passed if j.qc_result else None
        qc_score = j.qc_result.score if j.qc_result else None
        records.append(
            MetricDetailItem(
                id=j.id,
                original_filename=j.original_filename,
                status=str(j.status.value) if hasattr(j.status, 'value') else str(j.status),
                created_at=j.created_at.isoformat() if j.created_at else None,
                completed_at=j.completed_at.isoformat() if j.completed_at else None,
                processing_time_seconds=j.processing_time_seconds,
                has_original_audio=j.has_original_audio,
                original_audio_classification=j.original_audio_classification,
                qc_passed=qc_passed,
                qc_score=qc_score
            )
        )

    return MetricDetailsResponse(
        metric=metric_key,
        title=title,
        description=description,
        count=len(records),
        records=records
    )
