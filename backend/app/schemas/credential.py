from typing import Optional, Dict, Any, List
import datetime
from pydantic import BaseModel, ConfigDict, Field

class ProviderCredentialCreate(BaseModel):
    api_key: str = Field(min_length=6, description="Plaintext API key provided by administrator")
    extra_config: Optional[Dict[str, Any]] = Field(default=None, description="Optional provider extra parameters (e.g. model name)")
    is_active: bool = Field(default=True)

class ProviderCredentialUpdate(BaseModel):
    api_key: Optional[str] = Field(default=None, min_length=6)
    extra_config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class ProviderTestResult(BaseModel):
    provider: str
    status: str  # "connected", "invalid_key", "quota_exceeded", "rate_limited", "connection_timeout", "model_unavailable", "failed"
    message: str
    tested_at: datetime.datetime
    details: Optional[Dict[str, Any]] = None
    character_quota: Optional[str] = None
    tier: Optional[str] = None
    model: Optional[str] = None

class ProviderMetaSchema(BaseModel):
    provider_id: str
    name: str
    description: str
    icon_type: str  # "gemini" | "elevenlabs" | "generic"
    help_url: str
    capabilities: List[str]
    default_model: Optional[str] = None

class ProviderDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    provider_id: str
    name: str
    description: str
    icon_type: str
    help_url: str
    capabilities: List[str]
    is_configured: bool
    is_active: bool = True
    masked_key: Optional[str] = None
    key_prefix: Optional[str] = None
    key_suffix: Optional[str] = None
    last_tested_at: Optional[datetime.datetime] = None
    last_test_status: Optional[str] = None
    last_test_details: Optional[str] = None
    extra_config: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

class ProviderListResponse(BaseModel):
    providers: List[ProviderDetailResponse]
    total_configured: int
    strict_mode_enabled: bool

