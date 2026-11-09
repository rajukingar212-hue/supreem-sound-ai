import os
import concurrent.futures
import logging
from app.core.config import settings
from app.services.pipeline_runner import PipelineRunner

logger = logging.getLogger("supreem.task_manager")

class BackgroundTaskManager:
    def __init__(self, max_workers: int = 4):
        self.executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="supreem_worker"
        )
        self.runner = PipelineRunner()

    def submit_job(self, job_id: str):
        """
        Submit video processing job.
        If CELERY_ENABLED environment variable is true, dispatches to Celery task queue.
        Otherwise executes via in-process background ThreadPoolExecutor.
        """
        use_celery = os.environ.get("USE_CELERY", "false").lower() in ("true", "1", "yes")
        if use_celery:
            try:
                from app.tasks import process_video_job
                process_video_job.delay(job_id)
                logger.info(f"Dispatched job {job_id} to Celery queue.")
                return
            except Exception as e:
                logger.warning(f"Could not dispatch to Celery ({e}). Falling back to in-process executor.")

        logger.info(f"Submitting job {job_id} to background worker pool...")
        self.executor.submit(self.runner.process_job, job_id)

task_manager = BackgroundTaskManager(max_workers=settings.WORKER_CONCURRENCY)
