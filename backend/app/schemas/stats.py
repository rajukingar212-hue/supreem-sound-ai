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
    average_processing_time_seconds: float
    total_api_cost_usd: float
    overall_completion_percentage: float
    recent_activity: List[Dict[str, Any]] = []

