from typing import List, Optional
import datetime
from pydantic import BaseModel, ConfigDict

class BatchCreate(BaseModel):
    name: Optional[str] = None

class BatchSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    created_at: datetime.datetime
    status: str
    total_videos: int
    completed_videos: int
    failed_videos: int

class BatchDetail(BatchSummary):
    jobs: List["JobSummary"] = []

from app.schemas.video_job import JobSummary
BatchDetail.model_rebuild()

