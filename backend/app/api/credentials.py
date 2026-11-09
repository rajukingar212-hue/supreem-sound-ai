from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import User
from app.api.auth import get_current_user, get_current_admin_user
from app.schemas.credential import (
    ProviderCredentialCreate,
    ProviderCredentialUpdate,
    ProviderDetailResponse,
    ProviderListResponse,
    ProviderTestResult
)
from app.services.credential_manager import (
    credential_manager,
    EncryptionConfigurationError,
    SUPPORTED_PROVIDERS
)

router = APIRouter(prefix="/credentials", tags=["API Credentials Management"])

@router.get("", response_model=ProviderListResponse)
def list_provider_credentials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    List all supported external AI providers with their current configuration status.
    Returns masked keys only (e.g. ••••••••••••1234). Plaintext keys are never returned.
    """
    providers = credential_manager.list_all_providers(db)
    total_configured = sum(1 for p in providers if p.is_configured)
    return ProviderListResponse(
        providers=providers,
        total_configured=total_configured,
        strict_mode_enabled=settings.REQUIRE_REAL_API_KEYS
    )

@router.get("/{provider}", response_model=ProviderDetailResponse)
def get_provider_credential(
    provider: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get status and masked information for a single provider."""
    provider_key = provider.lower().strip()
    if provider_key not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider '{provider}' is not supported. Supported: {list(SUPPORTED_PROVIDERS.keys())}"
        )
    return credential_manager.get_provider_status(db, provider_key)

@router.post("/{provider}", response_model=ProviderDetailResponse)
def save_provider_credential(
    provider: str,
    payload: ProviderCredentialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Encrypts and persists a provider API credential.
    Plaintext key is encrypted at rest using server-side AES-256 Fernet encryption.
    Plaintext key is never returned in the response or stored in plain text.
    """
    provider_key = provider.lower().strip()
    if provider_key not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider '{provider}'. Supported: {list(SUPPORTED_PROVIDERS.keys())}"
        )

    try:
        credential_manager.save_credential(
            db=db,
            provider=provider_key,
            raw_key=payload.api_key,
            extra_config=payload.extra_config,
            is_active=payload.is_active
        )
        return credential_manager.get_provider_status(db, provider_key)
    except EncryptionConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{provider}")
def delete_provider_credential(
    provider: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Deletes the stored API credential for the specified provider.
    Subsequent processing jobs will cease using this provider unless configured via environment.
    """
    provider_key = provider.lower().strip()
    if provider_key not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider '{provider}' not found"
        )

    deleted = credential_manager.delete_credential(db, provider_key)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No stored credential found for provider '{provider}'"
        )

    return {
        "message": f"Successfully deleted API credential for {SUPPORTED_PROVIDERS[provider_key]['name']}.",
        "provider": provider_key
    }

@router.post("/{provider}/test", response_model=ProviderTestResult)
def test_provider_connection(
    provider: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Executes a genuine authenticated connection test against the provider.
    Gemini: Queries lightweight model metadata.
    ElevenLabs: Queries authenticated user subscription details (does NOT synthesize audio).
    Updates test record in database.
    """
    provider_key = provider.lower().strip()
    if provider_key not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider '{provider}' is not supported"
        )

    result = credential_manager.test_provider_connection(db, provider_key)
    return result

