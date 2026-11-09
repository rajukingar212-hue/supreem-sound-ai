import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.core.database import SessionLocal
from app.models import VideoJob

router = APIRouter(prefix="/events", tags=["Real-time Events"])

async def event_generator():
    """Stream live job status and progress every 1.5 seconds."""
    while True:
        try:
            db = SessionLocal()
            active_jobs = db.query(VideoJob).order_by(VideoJob.created_at.desc()).limit(20).all()
            data = [
                {
                    "id": j.id,
                    "batch_id": j.batch_id,
                    "filename": j.original_filename,
                    "status": str(j.status.value) if hasattr(j.status, 'value') else str(j.status),
                    "progress": j.progress_percent,
                    "stage": j.current_stage_detail,
                    "has_audio": j.has_original_audio,
                    "audio_class": j.original_audio_classification,
                    "processing_time": j.processing_time_seconds
                }
                for j in active_jobs
            ]
            db.close()
            yield f"data: {json.dumps(data)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            
        await asyncio.sleep(1.5)

@router.get("")
async def stream_job_events():
    return StreamingResponse(event_generator(), media_type="text/event-stream")

