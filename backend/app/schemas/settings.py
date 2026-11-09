from typing import Optional
from pydantic import BaseModel

class SettingsUpdateSchema(BaseModel):
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    elevenlabs_api_key: Optional[str] = None
    elevenlabs_model_id: Optional[str] = None
    replace_all_original_audio: Optional[bool] = None
    target_true_peak_dbtp: Optional[float] = None
    max_true_peak_dbtp: Optional[float] = None
    min_stem_count: Optional[int] = None
    worker_concurrency: Optional[int] = None
    ai_request_concurrency: Optional[int] = None
    require_real_api_keys: Optional[bool] = None
    allow_offline_fallback: Optional[bool] = None

class SettingsResponseSchema(BaseModel):
    gemini_configured: bool
    masked_gemini_key: str = "NOT CONFIGURED"
    gemini_model: str
    elevenlabs_configured: bool
    masked_elevenlabs_key: str = "NOT CONFIGURED"
    elevenlabs_model_id: str
    replace_all_original_audio: bool
    target_true_peak_dbtp: float
    max_true_peak_dbtp: float
    min_stem_count: int
    worker_concurrency: int
    ai_request_concurrency: int
    require_real_api_keys: bool = False
    allow_offline_fallback: bool = True
