import os
import re
import base64
import hashlib
import json
import logging
import datetime
from typing import Optional, Dict, Any, List
import httpx
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings
from app.models import ProviderCredential, utc_now
from app.schemas.credential import (
    ProviderDetailResponse, ProviderTestResult, ProviderMetaSchema
)

logger = logging.getLogger("supreem.credentials")

class EncryptionConfigurationError(RuntimeError):
    """Raised when server-side credential encryption key is missing or invalid."""
    pass

def sanitize_secret_from_text(text: str) -> str:
    """Removes any raw API keys or tokens from log or error messages."""
    if not text:
        return ""
    # Redact Google API keys (AIzaSy...)
    sanitized = re.sub(r'AIza[0-9A-Za-z-_]{30,}', '[REDACTED_GEMINI_KEY]', text)
    # Redact ElevenLabs keys (sk_...)
    sanitized = re.sub(r'sk_[0-9A-Za-z-_]{20,}', '[REDACTED_ELEVENLABS_KEY]', sanitized)
    # Redact Bearer tokens
    sanitized = re.sub(r'Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*', 'Bearer [REDACTED_TOKEN]', sanitized)
    return sanitized

# Extensible Provider Registry
SUPPORTED_PROVIDERS: Dict[str, Dict[str, Any]] = {
    "gemini": {
        "name": "Google Gemini API",
        "description": "Visual scene analysis, object & environmental motion tracking, audio-visual event planning, and synchronized sound event descriptions.",
        "icon_type": "gemini",
        "help_url": "https://aistudio.google.com/apikey",
        "capabilities": [
            "Video Scene Understanding",
            "Object Motion Tracking",
            "Environmental Sound Cue Detection",
            "Timestamped Sound Event Planning"
        ],
        "default_model": "gemini-2.5-flash"
    },
    "elevenlabs": {
        "name": "ElevenLabs Sound Effects API",
        "description": "Text-to-sound-effects synthesis, realistic foley generation, material impact rendering, and high-fidelity environmental audio assets.",
        "icon_type": "elevenlabs",
        "help_url": "https://elevenlabs.io/app/sound-effects",
        "capabilities": [
            "AI Sound Effects Generation",
            "Environmental Ambience Synthesis",
            "Foley & Surface Interaction Audio",
            "Material Impact Resonance"
        ],
        "default_model": "eleven_multilingual_v2"
    }
}

class CredentialManagerService:
    def __init__(self):
        self._cipher: Optional[Fernet] = None

    def get_cipher(self) -> Fernet:
        """
        Derives a deterministic 256-bit AES Fernet key from CREDENTIAL_ENCRYPTION_KEY.
        In production:
        1. CREDENTIAL_ENCRYPTION_KEY is strictly mandatory.
        2. Never silently falls back to SECRET_KEY.
        3. Encryption key must be separate and distinct from application SECRET_KEY.
        """
        if self._cipher is not None:
            return self._cipher

        is_production = settings.ENVIRONMENT.lower() == "production"
        enc_key = settings.CREDENTIAL_ENCRYPTION_KEY or os.environ.get("CREDENTIAL_ENCRYPTION_KEY")

        if is_production:
            if not enc_key or len(enc_key.strip()) < 16:
                raise EncryptionConfigurationError(
                    "CREDENTIAL_ENCRYPTION_KEY is mandatory in production. "
                    "Falling back to application SECRET_KEY for credential encryption is strictly prohibited in production mode. "
                    "Please configure a dedicated CREDENTIAL_ENCRYPTION_KEY (at least 16 chars or 32 url-safe base64 bytes) in your server environment."
                )
            if enc_key.strip() == settings.SECRET_KEY.strip():
                raise EncryptionConfigurationError(
                    "CREDENTIAL_ENCRYPTION_KEY must be separate and distinct from application SECRET_KEY in production."
                )
            key_source = enc_key.strip()
        else:
            # Development mode: use CREDENTIAL_ENCRYPTION_KEY if set, otherwise fallback to SECRET_KEY for local convenience
            key_source = enc_key or settings.SECRET_KEY or os.environ.get("SECRET_KEY")
            if not key_source or len(key_source.strip()) < 8:
                raise EncryptionConfigurationError(
                    "CREDENTIAL_ENCRYPTION_KEY is not configured on the server. "
                    "Plaintext storage of API keys is strictly prohibited. "
                    "Please configure CREDENTIAL_ENCRYPTION_KEY in your environment or .env."
                )
            key_source = key_source.strip()

        # Derive cryptographically secure 32-byte key via SHA-256 and url-safe base64
        digest = hashlib.sha256(key_source.encode("utf-8")).digest()
        fernet_key = base64.urlsafe_b64encode(digest)
        self._cipher = Fernet(fernet_key)
        return self._cipher

    def encrypt_key(self, raw_key: str) -> str:
        """Encrypts plaintext API key into an authenticated ciphertext string."""
        if not raw_key or not raw_key.strip():
            raise ValueError("API key cannot be empty")
        cipher = self.get_cipher()
        return cipher.encrypt(raw_key.strip().encode("utf-8")).decode("utf-8")

    def decrypt_key(self, encrypted_token: str) -> str:
        """Decrypts ciphertext token into original plaintext API key."""
        cipher = self.get_cipher()
        try:
            return cipher.decrypt(encrypted_token.encode("utf-8")).decode("utf-8")
        except InvalidToken:
            raise ValueError("Failed to decrypt API key: invalid ciphertext token or encryption key mismatch")

    @staticmethod
    def generate_masked_string(raw_key: str) -> str:
        """Generates standard masked display value (e.g. ••••••••••••1234)."""
        clean = raw_key.strip()
        if len(clean) <= 4:
            return "••••"
        suffix = clean[-4:]
        return f"••••••••••••{suffix}"

    def get_active_api_key(self, db: Session, provider: str) -> Optional[str]:
        """
        Retrieves decrypted API key for provider.
        Priority:
        1. Database encrypted credential (if active).
        2. In production: NEVER falls back to .env (deleting dashboard credential stops usage).
        3. In development only: fallback to .env for local setup convenience.
        """
        provider_key = provider.lower().strip()
        
        # 1. Check Database
        record = db.query(ProviderCredential).filter(
            ProviderCredential.provider == provider_key,
            ProviderCredential.is_active == True
        ).first()

        if record and record.encrypted_api_key:
            try:
                decrypted = self.decrypt_key(record.encrypted_api_key)
                if decrypted and len(decrypted.strip()) > 5:
                    return decrypted.strip()
            except Exception as e:
                logger.error(f"Failed to decrypt DB credential for {provider}: {sanitize_secret_from_text(str(e))}")

        # In production mode: DB encrypted credentials are the ONLY authoritative source!
        # Deleting a dashboard credential must NOT silently reactivate an old .env key.
        is_production = settings.ENVIRONMENT.lower() == "production"
        if is_production:
            return None

        # 2. Development mode fallback to environment
        if provider_key == "gemini":
            env_key = settings.get_effective_gemini_key()
            if env_key and len(env_key.strip()) > 5:
                return env_key.strip()
        elif provider_key == "elevenlabs":
            env_key = settings.get_effective_elevenlabs_key()
            if env_key and len(env_key.strip()) > 5:
                return env_key.strip()

        return None

    def save_credential(
        self,
        db: Session,
        provider: str,
        raw_key: str,
        extra_config: Optional[Dict[str, Any]] = None,
        is_active: bool = True
    ) -> ProviderCredential:
        """
        Encrypts and securely persists external provider credential to database.
        Never stores plaintext keys.
        """
        provider_key = provider.lower().strip()
        if provider_key not in SUPPORTED_PROVIDERS:
            raise ValueError(f"Unsupported provider '{provider}'. Supported providers: {list(SUPPORTED_PROVIDERS.keys())}")

        cleaned_key = raw_key.strip()
        if len(cleaned_key) < 8:
            raise ValueError("API key is too short. Please provide a valid credential.")

        encrypted_val = self.encrypt_key(cleaned_key)
        prefix = cleaned_key[:4] if len(cleaned_key) >= 8 else cleaned_key[:2]
        suffix = cleaned_key[-4:]
        masked = self.generate_masked_string(cleaned_key)

        record = db.query(ProviderCredential).filter(ProviderCredential.provider == provider_key).first()
        if record:
            record.encrypted_api_key = encrypted_val
            record.key_prefix = prefix
            record.key_suffix = suffix
            record.masked_key = masked
            record.is_active = is_active
            if extra_config is not None:
                record.extra_config = extra_config
            record.updated_at = utc_now()
        else:
            record = ProviderCredential(
                provider=provider_key,
                encrypted_api_key=encrypted_val,
                key_prefix=prefix,
                key_suffix=suffix,
                masked_key=masked,
                is_active=is_active,
                extra_config=extra_config,
                last_test_status="untested"
            )
            db.add(record)

        db.commit()
        db.refresh(record)
        logger.info(f"Securely saved encrypted credential for {provider_key} (masked: {masked}).")
        return record

    def delete_credential(self, db: Session, provider: str) -> bool:
        """Removes stored credential for provider from database."""
        provider_key = provider.lower().strip()
        record = db.query(ProviderCredential).filter(ProviderCredential.provider == provider_key).first()
        if not record:
            return False

        db.delete(record)
        db.commit()
        logger.info(f"Deleted stored credential for provider '{provider_key}'.")
        return True

    def get_provider_status(self, db: Session, provider: str) -> ProviderDetailResponse:
        """
        Builds public, safe provider status response (never exposes plaintext key).
        Accurately reflects whether a usable credential exists.
        """
        provider_key = provider.lower().strip()
        meta = SUPPORTED_PROVIDERS.get(provider_key, {
            "name": provider_key.title(),
            "description": f"Integration with {provider_key}",
            "icon_type": "generic",
            "help_url": "",
            "capabilities": [],
            "default_model": None
        })

        record = db.query(ProviderCredential).filter(ProviderCredential.provider == provider_key).first()
        is_configured = False
        masked = None
        prefix = None
        suffix = None
        is_active = True
        last_tested = None
        last_status = "not_configured"
        last_details = None
        extra_cfg = None
        created_at = None
        updated_at = None

        if record and record.is_active:
            is_configured = True
            masked = record.masked_key
            prefix = record.key_prefix
            suffix = record.key_suffix
            is_active = record.is_active
            last_tested = record.last_tested_at
            last_status = record.last_test_status or "untested"
            last_details = record.last_test_details
            extra_cfg = record.extra_config
            created_at = record.created_at
            updated_at = record.updated_at
        else:
            # In development only: check if configured in environment (.env fallback)
            is_production = settings.ENVIRONMENT.lower() == "production"
            if not is_production:
                active_key = self.get_active_api_key(db, provider_key)
                if active_key:
                    is_configured = True
                    masked = self.generate_masked_string(active_key)
                    prefix = active_key[:4]
                    suffix = active_key[-4:]
                    last_status = "configured_in_env"
                    last_details = "Configured via local development environment (.env)"

        return ProviderDetailResponse(
            provider_id=provider_key,
            name=meta["name"],
            description=meta["description"],
            icon_type=meta["icon_type"],
            help_url=meta["help_url"],
            capabilities=meta["capabilities"],
            is_configured=is_configured,
            is_active=is_active,
            masked_key=masked,
            key_prefix=prefix,
            key_suffix=suffix,
            last_tested_at=last_tested,
            last_test_status=last_status,
            last_test_details=last_details,
            extra_config=extra_cfg,
            created_at=created_at,
            updated_at=updated_at
        )

    def list_all_providers(self, db: Session) -> List[ProviderDetailResponse]:
        """Returns status for all supported providers."""
        return [self.get_provider_status(db, p) for p in SUPPORTED_PROVIDERS.keys()]

    def test_provider_connection(self, db: Session, provider: str) -> ProviderTestResult:
        """
        Executes a genuine authenticated connection test against the provider API.
        Does not fabricate success.
        Updates test history on the database credential record.
        """
        provider_key = provider.lower().strip()
        active_key = self.get_active_api_key(db, provider_key)
        now = utc_now()

        if not active_key:
            return ProviderTestResult(
                provider=provider_key,
                status="not_configured",
                message=f"No API key is configured for {SUPPORTED_PROVIDERS.get(provider_key, {}).get('name', provider_key)}.",
                tested_at=now
            )

        if provider_key == "gemini":
            result = self._test_gemini_connection(active_key)
        elif provider_key == "elevenlabs":
            result = self._test_elevenlabs_connection(active_key)
        else:
            result = ProviderTestResult(
                provider=provider_key,
                status="unsupported",
                message=f"Connection testing not implemented for provider '{provider_key}'.",
                tested_at=now
            )

        # Update record in DB if exists
        record = db.query(ProviderCredential).filter(ProviderCredential.provider == provider_key).first()
        if record:
            record.last_tested_at = now
            record.last_test_status = result.status
            record.last_test_details = result.message
            db.commit()

        return result

    def _test_gemini_connection(self, api_key: str, model: str = "gemini-2.5-flash") -> ProviderTestResult:
        """Performs a genuine lightweight authenticated test against Google Gemini API."""
        now = utc_now()
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            # Lightweight authenticated metadata query: query model info
            model_info = client.models.get(model=model)
            display_name = getattr(model_info, "display_name", model)

            return ProviderTestResult(
                provider="gemini",
                status="connected",
                message=f"Connection successful! Verified access to Google Gemini model '{display_name}'.",
                tested_at=now,
                model=model,
                details={
                    "model": model,
                    "display_name": display_name,
                    "input_token_limit": getattr(model_info, "input_token_limit", "N/A")
                }
            )
        except Exception as e:
            raw_err = str(e)
            sanitized_err = sanitize_secret_from_text(raw_err)
            err_lower = sanitized_err.lower()
            logger.warning(f"Gemini connection test error: {sanitized_err}")

            if "api_key_invalid" in err_lower or "api key not valid" in err_lower or "400" in err_lower or "403" in err_lower:
                status = "invalid_key"
                msg = "Invalid Google Gemini API key. Please verify your API key from Google AI Studio."
            elif "429" in err_lower or "resource_exhausted" in err_lower or "quota" in err_lower:
                status = "quota_exceeded"
                msg = "Google Gemini API quota exceeded or rate limit reached on your Google Cloud project."
            elif "not_found" in err_lower or "404" in err_lower:
                status = "model_unavailable"
                msg = f"Model '{model}' is unavailable on your Google Cloud region or API version."
            elif "timeout" in err_lower or "deadline" in err_lower or "connection" in err_lower:
                status = "connection_timeout"
                msg = "Connection timed out while contacting Google Gemini API servers. Check network connectivity."
            else:
                status = "failed"
                msg = f"Gemini connection check failed: {sanitized_err[:160]}"

            return ProviderTestResult(
                provider="gemini",
                status=status,
                message=msg,
                tested_at=now,
                details={"raw_error": sanitized_err[:250]}
            )

    def _test_elevenlabs_connection(self, api_key: str) -> ProviderTestResult:
        """Performs a genuine lightweight authenticated test against ElevenLabs API."""
        now = utc_now()
        endpoint = "https://api.elevenlabs.io/v1/user"
        headers = {
            "xi-api-key": api_key,
            "Accept": "application/json"
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(endpoint, headers=headers)
                
                if resp.status_code == 200:
                    data = resp.json()
                    sub = data.get("subscription", {})
                    tier = sub.get("tier", "standard")
                    char_count = sub.get("character_count", 0)
                    char_limit = sub.get("character_limit", 0)
                    quota_str = f"{char_count:,} / {char_limit:,} characters used"

                    return ProviderTestResult(
                        provider="elevenlabs",
                        status="connected",
                        message=f"Connection successful! ElevenLabs subscription active ({tier} tier).",
                        tested_at=now,
                        tier=tier,
                        character_quota=quota_str,
                        details={
                            "tier": tier,
                            "character_count": char_count,
                            "character_limit": char_limit,
                            "can_extend_character_limit": sub.get("can_extend_character_limit", False)
                        }
                    )
                elif resp.status_code == 401:
                    return ProviderTestResult(
                        provider="elevenlabs",
                        status="invalid_key",
                        message="Invalid ElevenLabs API key. Please check your key from the ElevenLabs console.",
                        tested_at=now
                    )
                elif resp.status_code == 429:
                    return ProviderTestResult(
                        provider="elevenlabs",
                        status="rate_limited",
                        message="ElevenLabs API rate limit or character quota reached.",
                        tested_at=now
                    )
                else:
                    sanitized_body = sanitize_secret_from_text(resp.text[:120])
                    return ProviderTestResult(
                        provider="elevenlabs",
                        status="failed",
                        message=f"ElevenLabs returned HTTP {resp.status_code}: {sanitized_body}",
                        tested_at=now
                    )
        except httpx.TimeoutException:
            return ProviderTestResult(
                provider="elevenlabs",
                status="connection_timeout",
                message="Request to ElevenLabs API timed out (10s threshold). Please check your internet connection.",
                tested_at=now
            )
        except Exception as e:
            return ProviderTestResult(
                provider="elevenlabs",
                status="failed",
                message=f"ElevenLabs connection test failed: {sanitize_secret_from_text(str(e))}",
                tested_at=now
            )

credential_manager = CredentialManagerService()
