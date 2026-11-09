import os
import pytest
from unittest.mock import patch, MagicMock
from app.core.config import settings
from app.core.database import SessionLocal, Base, engine
from app.models import ProviderCredential, User
from app.services.credential_manager import (
    CredentialManagerService,
    EncryptionConfigurationError,
    credential_manager,
    SUPPORTED_PROVIDERS
)
from app.services.gemini_service import GeminiVisionService
from app.services.elevenlabs_service import ElevenLabsService

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        # Clean up any test credentials
        session.query(ProviderCredential).delete()
        session.commit()
        yield session
    finally:
        session.query(ProviderCredential).delete()
        session.commit()
        session.close()

def test_encryption_and_decryption_roundtrip():
    cm = CredentialManagerService()
    test_key = "AIzaSyD-TestKey-9876543210abcdef"
    
    # 1. Encrypt
    encrypted = cm.encrypt_key(test_key)
    assert encrypted != test_key
    assert len(encrypted) > len(test_key)
    assert "9876543210" not in encrypted

    # 2. Decrypt
    decrypted = cm.decrypt_key(encrypted)
    assert decrypted == test_key

def test_missing_encryption_key_error():
    cm = CredentialManagerService()
    orig_key = settings.CREDENTIAL_ENCRYPTION_KEY
    orig_sec = settings.SECRET_KEY
    try:
        settings.CREDENTIAL_ENCRYPTION_KEY = ""
        settings.SECRET_KEY = ""
        cm._cipher = None
        with pytest.raises(EncryptionConfigurationError) as exc:
            cm.get_cipher()
        assert "CREDENTIAL_ENCRYPTION_KEY is not configured" in str(exc.value)
    finally:
        settings.CREDENTIAL_ENCRYPTION_KEY = orig_key
        settings.SECRET_KEY = orig_sec
        cm._cipher = None

def test_masked_string_never_exposes_key():
    raw_key = "AIzaSyD-1234567890abcdefABCDEF12345"
    masked = CredentialManagerService.generate_masked_string(raw_key)
    assert masked.startswith("••••••••••••")
    assert masked.endswith("2345")
    # Verify full secret body is never present
    assert "1234567890abcdef" not in masked
    assert "AIzaSyD" not in masked

def test_save_update_and_delete_credential(db_session):
    cm = CredentialManagerService()

    # 1. Save new credential
    rec = cm.save_credential(
        db=db_session,
        provider="gemini",
        raw_key="AIzaSyD-GeminiTestSecretKey-9988"
    )
    assert rec.provider == "gemini"
    assert rec.is_active is True
    assert rec.key_suffix == "9988"
    assert rec.masked_key == "••••••••••••9988"
    assert "GeminiTestSecretKey" not in rec.encrypted_api_key

    # Retrieve decrypted
    active_key = cm.get_active_api_key(db_session, "gemini")
    assert active_key == "AIzaSyD-GeminiTestSecretKey-9988"

    # 2. Update credential
    updated_rec = cm.save_credential(
        db=db_session,
        provider="gemini",
        raw_key="AIzaSyD-GeminiNewSecretKey-1122"
    )
    assert updated_rec.key_suffix == "1122"
    assert updated_rec.masked_key == "••••••••••••1122"
    active_key_updated = cm.get_active_api_key(db_session, "gemini")
    assert active_key_updated == "AIzaSyD-GeminiNewSecretKey-1122"

    # 3. Check public provider status does not contain plaintext
    status = cm.get_provider_status(db_session, "gemini")
    assert status.is_configured is True
    assert status.masked_key == "••••••••••••1122"
    # Verify no raw key attribute exists on schema
    assert not hasattr(status, "api_key")
    assert not hasattr(status, "encrypted_api_key")

    # 4. Delete credential
    deleted = cm.delete_credential(db_session, "gemini")
    assert deleted is True
    assert cm.get_active_api_key(db_session, "gemini") is None or cm.get_active_api_key(db_session, "gemini") == settings.get_effective_gemini_key()

def test_save_invalid_key_raises_error(db_session):
    cm = CredentialManagerService()
    # Key too short
    with pytest.raises(ValueError) as exc:
        cm.save_credential(db_session, "gemini", "short")
    assert "too short" in str(exc.value)

    # Unsupported provider
    with pytest.raises(ValueError) as exc:
        cm.save_credential(db_session, "unsupported_provider", "valid_length_key_1234")
    assert "Unsupported provider" in str(exc.value)

def test_pipeline_services_retrieve_db_credentials(db_session):
    cm = CredentialManagerService()
    gemini_svc = GeminiVisionService()
    eleven_svc = ElevenLabsService()

    # Save credentials into database
    cm.save_credential(db_session, "gemini", "AIzaSyD-DynamicDbKey-7777")
    cm.save_credential(db_session, "elevenlabs", "sk_dynamic_eleven_key_8888")

    # Verify Gemini service dynamically loads DB key
    assert gemini_svc.get_api_key(db=db_session) == "AIzaSyD-DynamicDbKey-7777"
    assert gemini_svc.is_configured(db=db_session) is True

    # Verify ElevenLabs service dynamically loads DB key
    assert eleven_svc.get_api_key(db=db_session) == "sk_dynamic_eleven_key_8888"
    assert eleven_svc.is_configured(db=db_session) is True

    # Delete Gemini key from DB and verify it halts / updates immediately
    cm.delete_credential(db_session, "gemini")
    db_gemini_key = cm.get_active_api_key(db_session, "gemini")
    assert db_gemini_key != "AIzaSyD-DynamicDbKey-7777"

def test_genuine_connection_test_invalid_keys(db_session):
    """
    Test that invalid keys genuinely fail and produce accurate diagnostics.
    NOTE: These are genuine network calls testing real provider rejections for invalid keys.
    """
    cm = CredentialManagerService()

    # 1. ElevenLabs test with invalid key
    el_result = cm._test_elevenlabs_connection("sk_invalid_test_key_0000000000000000")
    assert el_result.status in ("invalid_key", "failed")
    assert "Invalid ElevenLabs API key" in el_result.message or "failed" in el_result.message

    # 2. Gemini test with invalid key
    gem_result = cm._test_gemini_connection("AIzaSyD-InvalidKeyForTesting1234567890")
    assert gem_result.status in ("invalid_key", "failed")
    assert "Invalid Google Gemini API key" in gem_result.message or "failed" in gem_result.message

def test_controlled_mock_connection_tests():
    """
    Controlled unit mock test verifying successful connection handling and parsing.
    Clearly designated as a MOCK test.
    """
    cm = CredentialManagerService()

    # Mock ElevenLabs 200 OK profile response
    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "subscription": {
                "tier": "creator",
                "character_count": 15420,
                "character_limit": 100000,
                "can_extend_character_limit": True
            }
        }
        mock_get.return_value = mock_resp

        res = cm._test_elevenlabs_connection("sk_mock_valid_key_1234")
        assert res.status == "connected"
        assert res.tier == "creator"
        assert "15,420" in res.character_quota

    # Mock Gemini model metadata response
    with patch("google.genai.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_model = MagicMock()
        mock_model.display_name = "Gemini 2.5 Flash"
        mock_model.input_token_limit = 1048576
        mock_client.models.get.return_value = mock_model
        mock_client_cls.return_value = mock_client

        res = cm._test_gemini_connection("AIzaSyD-MockValidKey", model="gemini-2.5-flash")
        assert res.status == "connected"
        assert "Gemini 2.5 Flash" in res.message



def test_production_mandates_encryption_key_and_rejects_secret_key_fallback():
    cm = CredentialManagerService()
    orig_env = settings.ENVIRONMENT
    orig_key = settings.CREDENTIAL_ENCRYPTION_KEY
    orig_sec = settings.SECRET_KEY

    try:
        settings.ENVIRONMENT = "production"
        settings.CREDENTIAL_ENCRYPTION_KEY = ""
        settings.SECRET_KEY = "supreem-prod-secret-key-1234567890"
        cm._cipher = None

        with pytest.raises(EncryptionConfigurationError) as exc:
            cm.get_cipher()
        assert "CREDENTIAL_ENCRYPTION_KEY is mandatory in production" in str(exc.value)
        assert "Falling back to application SECRET_KEY" in str(exc.value)
    finally:
        settings.ENVIRONMENT = orig_env
        settings.CREDENTIAL_ENCRYPTION_KEY = orig_key
        settings.SECRET_KEY = orig_sec
        cm._cipher = None

def test_production_requires_encryption_key_distinct_from_secret_key():
    cm = CredentialManagerService()
    orig_env = settings.ENVIRONMENT
    orig_key = settings.CREDENTIAL_ENCRYPTION_KEY
    orig_sec = settings.SECRET_KEY

    try:
        settings.ENVIRONMENT = "production"
        shared_key = "shared-secret-key-that-must-be-distinct-123"
        settings.CREDENTIAL_ENCRYPTION_KEY = shared_key
        settings.SECRET_KEY = shared_key
        cm._cipher = None

        with pytest.raises(EncryptionConfigurationError) as exc:
            cm.get_cipher()
        assert "must be separate and distinct" in str(exc.value)
    finally:
        settings.ENVIRONMENT = orig_env
        settings.CREDENTIAL_ENCRYPTION_KEY = orig_key
        settings.SECRET_KEY = orig_sec
        cm._cipher = None

def test_production_deleting_credential_does_not_resurrect_env_secret(db_session):
    cm = CredentialManagerService()
    orig_env = settings.ENVIRONMENT
    orig_gem = settings.GEMINI_API_KEY
    orig_enc = settings.CREDENTIAL_ENCRYPTION_KEY
    orig_sec = settings.SECRET_KEY

    try:
        settings.ENVIRONMENT = "production"
        settings.SECRET_KEY = "supreem-sound-production-secret-key-123"
        settings.CREDENTIAL_ENCRYPTION_KEY = "dedicated-production-encryption-key-456"
        settings.GEMINI_API_KEY = "AIzaSyD-OldStaleEnvKey-123456"
        cm._cipher = None

        # 1. Save valid key into DB
        cm.save_credential(db_session, "gemini", "AIzaSyD-ActiveDbKey-9999")
        assert cm.get_active_api_key(db_session, "gemini") == "AIzaSyD-ActiveDbKey-9999"

        # 2. Delete credential from DB
        cm.delete_credential(db_session, "gemini")

        # 3. In production mode, get_active_api_key MUST NOT resurrect stale .env key!
        resurrected = cm.get_active_api_key(db_session, "gemini")
        assert resurrected is None
        status = cm.get_provider_status(db_session, "gemini")
        assert status.is_configured is False
        assert status.last_test_status == "not_configured"
    finally:
        settings.ENVIRONMENT = orig_env
        settings.GEMINI_API_KEY = orig_gem
        settings.CREDENTIAL_ENCRYPTION_KEY = orig_enc
        settings.SECRET_KEY = orig_sec
        cm._cipher = None

def test_api_keys_sanitization_from_error_messages():
    from app.services.credential_manager import sanitize_secret_from_text

    raw_err1 = "Google API failed: 400 ClientError with key AIzaSyD-Secret1234567890abcdefABCDEF12345 in query."
    clean1 = sanitize_secret_from_text(raw_err1)
    assert "AIzaSyD" not in clean1
    assert "[REDACTED_GEMINI_KEY]" in clean1

    raw_err2 = "ElevenLabs HTTP 401: Unauthorized for key sk_live_secret_key_1234567890abcdef."
    clean2 = sanitize_secret_from_text(raw_err2)
    assert "sk_live_secret" not in clean2
    assert "[REDACTED_ELEVENLABS_KEY]" in clean2

def test_admin_authorization_enforced():
    from app.api.auth import get_current_admin_user
    from fastapi import HTTPException

    # 1. Unauthenticated user raises 401
    with pytest.raises(HTTPException) as exc1:
        get_current_admin_user(current_user=None)
    assert exc1.value.status_code == 401

    # 2. Non-superuser raises 403 Forbidden
    regular_user = User(
        email="regular@supreemsound.ai",
        is_superuser=False
    )
    with pytest.raises(HTTPException) as exc2:
        get_current_admin_user(current_user=regular_user)
    assert exc2.value.status_code == 403
    assert "Administrator authorization required" in exc2.value.detail

    # 3. Superuser allowed
    admin_user = User(
        email="admin@supreemsound.ai",
        is_superuser=True
    )
    assert get_current_admin_user(current_user=admin_user) == admin_user


def test_updating_credential_immediately_affects_subsequent_pipeline_jobs(db_session):
    cm = CredentialManagerService()
    gemini_svc = GeminiVisionService()
    eleven_svc = ElevenLabsService()

    # Initial state: Key A
    cm.save_credential(db_session, "gemini", "AIzaSyD-Version1-GeminiKey-1111")
    cm.save_credential(db_session, "elevenlabs", "sk_version1_eleven_key_1111")
    
    assert gemini_svc.get_api_key(db=db_session) == "AIzaSyD-Version1-GeminiKey-1111"
    assert eleven_svc.get_api_key(db=db_session) == "sk_version1_eleven_key_1111"

    # Administrator updates keys in dashboard: Key B
    cm.save_credential(db_session, "gemini", "AIzaSyD-Version2-GeminiKey-2222")
    cm.save_credential(db_session, "elevenlabs", "sk_version2_eleven_key_2222")

    # Subsequent processing job execution immediately receives Key B without server restart
    assert gemini_svc.get_api_key(db=db_session) == "AIzaSyD-Version2-GeminiKey-2222"
    assert eleven_svc.get_api_key(db=db_session) == "sk_version2_eleven_key_2222"


def test_production_mode_strictly_rejects_mock_or_procedural_fallback(db_session):
    cm = CredentialManagerService()
    gemini_svc = GeminiVisionService()
    eleven_svc = ElevenLabsService()

    orig_env = settings.ENVIRONMENT
    orig_gem = settings.GEMINI_API_KEY
    orig_el = settings.ELEVENLABS_API_KEY
    orig_enc = settings.CREDENTIAL_ENCRYPTION_KEY
    orig_sec = settings.SECRET_KEY

    try:
        settings.ENVIRONMENT = "production"
        settings.SECRET_KEY = "supreem-sound-prod-secret-key-12345"
        settings.CREDENTIAL_ENCRYPTION_KEY = "dedicated-prod-encryption-key-67890"
        settings.GEMINI_API_KEY = None
        settings.ELEVENLABS_API_KEY = None
        cm._cipher = None

        # Gemini: In production with missing key, must raise clear RuntimeError
        with pytest.raises(RuntimeError) as exc_gem:
            gemini_svc.analyze_video_frames(
                frame_paths=[],
                video_metadata={"duration": 10.0},
                original_basename="desert_clip",
                db=db_session
            )
        assert "Google Gemini API key is missing. In production mode" in str(exc_gem.value)

        # ElevenLabs: In production with missing key, must raise clear RuntimeError
        with pytest.raises(RuntimeError) as exc_el:
            eleven_svc.generate_sound_effect(
                prompt="Metal sheet clang",
                duration_seconds=2.0,
                db=db_session
            )
        assert "ElevenLabs API key is missing. In production mode" in str(exc_el.value)
    finally:
        settings.ENVIRONMENT = orig_env
        settings.GEMINI_API_KEY = orig_gem
        settings.ELEVENLABS_API_KEY = orig_el
        settings.CREDENTIAL_ENCRYPTION_KEY = orig_enc
        settings.SECRET_KEY = orig_sec
        cm._cipher = None


def test_database_migration_on_fresh_database(tmp_path):
    from alembic.config import Config
    from alembic import command
    from sqlalchemy import create_engine, inspect

    fresh_db_path = tmp_path / "fresh_migrated.db"
    fresh_url = f"sqlite:///{fresh_db_path}"

    alembic_cfg = Config(str(settings.BASE_DIR / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(settings.BASE_DIR / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", fresh_url)

    # Run upgrade head on fresh database
    command.upgrade(alembic_cfg, "head")

    # Verify tables created
    test_engine = create_engine(fresh_url)
    inspector = inspect(test_engine)
    tables = inspector.get_table_names()

    assert "users" in tables
    assert "batches" in tables
    assert "video_jobs" in tables
    assert "source_videos" in tables
    assert "provider_credentials" in tables
    assert "audio_stems" in tables
    assert "mixdowns" in tables
    assert "output_artifacts" in tables
    assert "qc_results" in tables

    # Verify columns in provider_credentials table
    cols = [c["name"] for c in inspector.get_columns("provider_credentials")]
    assert "encrypted_api_key" in cols
    assert "masked_key" in cols
    assert "is_active" in cols
    assert "last_test_status" in cols
