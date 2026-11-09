from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class StemQCDetail(BaseModel):
    stem_id: str
    filename: str
    sample_rate: int
    bit_depth: int
    channels: int
    sample_count: int
    duration_seconds: float
    true_peak_dbtp: float
    rms_dbfs: float
    is_silent: bool

class QCReportSchema(BaseModel):
    passed: bool
    score: float
    
    # Video Checks
    video_format_valid: bool
    video_codec_h264: bool
    video_duration_exact: bool
    basename_preserved: bool
    original_audio_absent: bool
    
    # Audio Checks
    audio_format_valid: bool
    audio_48khz: bool
    audio_24bit: bool
    audio_stereo: bool
    exact_480k_samples: bool
    stem_count_valid: bool
    no_digital_clipping: bool
    true_peak_compliant: bool
    measured_true_peak_dbtp: Optional[float] = None
    stems_non_empty: bool
    no_duplicate_stems: bool
    stems_reproduce_mixdown: bool
    mp4_audio_matches_mixdown: bool
    
    # Content Checks
    no_generated_music: bool
    no_human_vocals: bool
    environmental_consistency: bool
    
    # Details & Metrics
    zip_package_valid: Optional[bool] = None
    zip_package_details: Optional[Dict[str, Any]] = None
    stems_detail: List[StemQCDetail] = []
    mixdown_detail: Optional[Dict[str, Any]] = None
    reconstruction_diff_peak: float = 0.0
    summary_notes: List[str] = []

