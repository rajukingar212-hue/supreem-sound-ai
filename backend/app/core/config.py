import os
from pathlib import Path
from typing import List, Optional, Dict
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

BASE_DIR = Path(__file__).resolve().parent.parent.parent
WORKSPACE_DIR = BASE_DIR.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(WORKSPACE_DIR / ".env"), str(BASE_DIR / ".env")),
        extra="allow",
        case_sensitive=False
    )

    PROJECT_NAME: str = "Supreem Sound AI"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field(default="development", description="development | staging | production")
    API_V1_PREFIX: str = "/api"
    
    # Storage Paths
    BASE_DIR: Path = BASE_DIR
    STORAGE_DIR: Path = BASE_DIR / "storage"
    UPLOADS_DIR: Path = STORAGE_DIR / "uploads"
    TEMP_DIR: Path = STORAGE_DIR / "temp"
    OUTPUTS_DIR: Path = STORAGE_DIR / "outputs"
    
    # Database
    DATABASE_URL: str = Field(
        default=f"sqlite:///{BASE_DIR}/storage/supreem_sound.db",
        description="Database connection URL"
    )
    
    # Redis
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL for Celery / Caching"
    )
    
    # Security
    SECRET_KEY: str = Field(
        default="supreem-sound-ai-production-super-secret-key-change-in-prod-2026",
        description="Secret key for JWT tokens"
    )
    CREDENTIAL_ENCRYPTION_KEY: Optional[str] = Field(
        default=None,
        description="Dedicated server-side encryption key for provider credentials at rest"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    ALGORITHM: str = "HS256"
    INITIAL_ADMIN_PASSWORD: Optional[str] = None
    
    # Audio DSP Standards (Normative specs)
    SAMPLE_RATE: int = 48000
    AUDIO_CHANNELS: int = 2
    AUDIO_BIT_DEPTH: int = 24
    DURATION_SECONDS: float = 10.0
    EXACT_SAMPLE_COUNT: int = 480000  # 48000 * 10
    
    TARGET_TRUE_PEAK_DBTP: float = -3.5
    MAX_TRUE_PEAK_DBTP: float = -1.0
    MIN_STEM_COUNT: int = 3
    
    # Audio Removal Policy
    REPLACE_ALL_ORIGINAL_AUDIO: bool = True
    ALLOW_ENVIRONMENTAL_AUDIO_PRESERVATION: bool = False
    
    # AI Providers
    GEMINI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    
    ELEVENLABS_API_KEY: Optional[str] = None
    ELEVENLABS_MODEL_ID: str = "eleven_multilingual_v2"
    ELEVENLABS_BASE_URL: str = "https://api.elevenlabs.io/v1"
    
    # Enforcement & Fallback Policies
    REQUIRE_REAL_API_KEYS: bool = False
    ALLOW_OFFLINE_FALLBACK: bool = True

    # Job Concurrency & Retries
    MAX_RETRIES: int = 3
    WORKER_CONCURRENCY: int = 4
    AI_REQUEST_CONCURRENCY: int = 2
    
    # Upload Limits
    MAX_UPLOAD_SIZE_BYTES: int = 500 * 1024 * 1024  # 500 MB
    ALLOWED_VIDEO_EXTENSIONS: List[str] = [".mp4", ".mov", ".m4v", ".mkv", ".webm"]
    ALLOWED_VIDEO_MIME_TYPES: List[str] = [
        "video/mp4",
        "video/quicktime",
        "video/x-matroska",
        "video/webm"
    ]

    def init_storage(self):
        self.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        self.TEMP_DIR.mkdir(parents=True, exist_ok=True)
        self.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

    def get_effective_gemini_key(self) -> Optional[str]:
        return self.GEMINI_API_KEY or self.GOOGLE_API_KEY or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    def get_effective_elevenlabs_key(self) -> Optional[str]:
        return self.ELEVENLABS_API_KEY or os.environ.get("ELEVENLABS_API_KEY")

    def is_gemini_ready(self) -> bool:
        k = self.get_effective_gemini_key()
        return bool(k and len(k.strip()) > 8)

    def is_elevenlabs_ready(self) -> bool:
        k = self.get_effective_elevenlabs_key()
        return bool(k and len(k.strip()) > 8)

    @staticmethod
    def mask_key(key: Optional[str]) -> str:
        """Safely mask key for display or logging (never leaks full credential)."""
        if not key or len(key.strip()) < 8:
            return "NOT CONFIGURED"
        k = key.strip()
        prefix = k[:4]
        suffix = k[-4:]
        return f"{prefix}...{suffix}"

    def get_masked_gemini_key(self) -> str:
        return self.mask_key(self.get_effective_gemini_key())

    def get_masked_elevenlabs_key(self) -> str:
        return self.mask_key(self.get_effective_elevenlabs_key())

    def validate_api_readiness(self) -> Dict[str, Any]:
        """Check credentials and report status with actionable guidance."""
        gemini_ok = self.is_gemini_ready()
        eleven_ok = self.is_elevenlabs_ready()
        return {
            "gemini": {
                "configured": gemini_ok,
                "masked_key": self.get_masked_gemini_key(),
                "model": self.GEMINI_MODEL,
                "status": "ready" if gemini_ok else "missing_key",
                "message": "Gemini API key is configured and ready" if gemini_ok else "GEMINI_API_KEY is not set in environment or settings"
            },
            "elevenlabs": {
                "configured": eleven_ok,
                "masked_key": self.get_masked_elevenlabs_key(),
                "model_id": self.ELEVENLABS_MODEL_ID,
                "status": "ready" if eleven_ok else "missing_key",
                "message": "ElevenLabs API key is configured and ready" if eleven_ok else "ELEVENLABS_API_KEY is not set in environment or settings"
            },
            "environment": self.ENVIRONMENT,
            "require_real_api_keys": self.REQUIRE_REAL_API_KEYS,
            "allow_offline_fallback": self.ALLOW_OFFLINE_FALLBACK
        }

settings = Settings()
settings.init_storage()
