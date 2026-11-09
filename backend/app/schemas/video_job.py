from typing import List, Optional, Dict, Any
import datetime
from pydantic import BaseModel, ConfigDict
from app.models import JobStatus
from app.schemas.qc import QCReportSchema
from app.schemas.sound_event import SoundEventSchema

class JobSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    batch_id: Optional[str] = None
    original_filename: str
    original_basename: str
    status: JobStatus
    progress_percent: float
    current_stage_detail: str
    has_original_audio: bool
    original_audio_classification: str
    original_audio_removed: bool
    created_at: datetime.datetime
    processing_time_seconds: Optional[float] = None
    estimated_api_cost_usd: float = 0.0

class StemSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    stem_id: str
    filename: str
    relative_path: str
    category: str
    surface_material: Optional[str] = None
    sample_rate: int
    bit_depth: int
    channels: int
    sample_count: int
    duration_seconds: float
    true_peak_dbtp: Optional[float] = None
    rms_dbfs: Optional[float] = None

class ArtifactSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    artifact_type: str
    filename: str
    file_size_bytes: int
    mime_type: str

class JobDetail(JobSummary):
    model_config = ConfigDict(from_attributes=True)
    error_message: Optional[str] = None
    started_at: Optional[datetime.datetime] = None
    completed_at: Optional[datetime.datetime] = None
    retry_count: int
    
    # Source Video Info
    source_duration: Optional[float] = None
    source_resolution: Optional[str] = None
    source_fps: Optional[float] = None
    source_codec: Optional[str] = None
    
    # Original Audio Analysis
    audio_analysis_details: Optional[Dict[str, Any]] = None
    
    # Timeline & Stems
    sound_events: List[SoundEventSchema] = []
    stems: List[StemSummary] = []
    mixdown_path: Optional[str] = None
    final_video_path: Optional[str] = None
    zip_package_path: Optional[str] = None
    
    # QC Result
    qc_result: Optional[QCReportSchema] = None
    artifacts: List[ArtifactSummary] = []
