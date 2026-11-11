from typing import Optional, Dict, Any, List
from pydantic import BaseModel

class DashboardStatsSchema(BaseModel):
    total_uploaded_videos: int
    videos_with_original_audio: int
    videos_without_original_audio: int
    videos_with_detected_music: int
    videos_processing: int
    completed_videos: int
    failed_videos: int
    average_processing_time_seconds: Optional[float] = None
    total_api_cost_usd: Optional[float] = None
    cost_available: bool = False
    database_status: str = "Connected"
    last_updated: Optional[str] = None
    overall_completion_percentage: float
    recent_activity: List[Dict[str, Any]] = []

class MetricDetailItem(BaseModel):
    id: str
    original_filename: str
    status: str
    created_at: Optional[str] = None
    completed_at: Optional[str] = None
    processing_time_seconds: Optional[float] = None
    has_original_audio: bool = False
    original_audio_classification: Optional[str] = None
    qc_passed: Optional[bool] = None
    qc_score: Optional[float] = None

class MetricDetailsResponse(BaseModel):
    metric: str
    title: str
    description: str
    count: int
    records: List[MetricDetailItem] = []
