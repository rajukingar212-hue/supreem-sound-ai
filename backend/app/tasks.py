import logging
from app.core.celery_app import celery_app
from app.services.pipeline_runner import PipelineRunner

logger = logging.getLogger("supreem.celery_task")

@celery_app.task(name="app.tasks.process_video_job", bind=True, max_retries=3)
def process_video_job(self, job_id: str):
    """Celery background task for video job processing."""
    logger.info(f"Celery worker received job {job_id} (attempt {self.request.retries + 1})")
    runner = PipelineRunner()
    try:
        runner.process_job(job_id)
        return {"status": "success", "job_id": job_id}
    except Exception as exc:
        logger.error(f"Celery task execution failed for job {job_id}: {exc}")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=10 * (2 ** self.request.retries))
        raise exc

