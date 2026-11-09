import os
from fastapi import APIRouter, HTTPException, Depends
import httpx
from app.core.config import settings
from app.schemas.settings import SettingsUpdateSchema, SettingsResponseSchema

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=SettingsResponseSchema)
def get_current_settings():
    return SettingsResponseSchema(
        gemini_configured=settings.is_gemini_ready(),
        masked_gemini_key=settings.get_masked_gemini_key(),
        gemini_model=settings.GEMINI_MODEL,
        elevenlabs_configured=settings.is_elevenlabs_ready(),
        masked_elevenlabs_key=settings.get_masked_elevenlabs_key(),
        elevenlabs_model_id=settings.ELEVENLABS_MODEL_ID,
        replace_all_original_audio=settings.REPLACE_ALL_ORIGINAL_AUDIO,
        target_true_peak_dbtp=settings.TARGET_TRUE_PEAK_DBTP,
        max_true_peak_dbtp=settings.MAX_TRUE_PEAK_DBTP,
        min_stem_count=settings.MIN_STEM_COUNT,
        worker_concurrency=settings.WORKER_CONCURRENCY,
        ai_request_concurrency=settings.AI_REQUEST_CONCURRENCY,
        require_real_api_keys=settings.REQUIRE_REAL_API_KEYS,
        allow_offline_fallback=settings.ALLOW_OFFLINE_FALLBACK
    )

@router.post("", response_model=SettingsResponseSchema)
def update_settings(update_data: SettingsUpdateSchema):
    if update_data.gemini_api_key is not None:
        cleaned_gemini = update_data.gemini_api_key.strip()
        settings.GEMINI_API_KEY = cleaned_gemini or None
        if cleaned_gemini:
            os.environ["GEMINI_API_KEY"] = cleaned_gemini
        else:
            os.environ.pop("GEMINI_API_KEY", None)

    if update_data.gemini_model is not None:
        settings.GEMINI_MODEL = update_data.gemini_model

    if update_data.elevenlabs_api_key is not None:
        cleaned_el = update_data.elevenlabs_api_key.strip()
        settings.ELEVENLABS_API_KEY = cleaned_el or None
        if cleaned_el:
            os.environ["ELEVENLABS_API_KEY"] = cleaned_el
        else:
            os.environ.pop("ELEVENLABS_API_KEY", None)

    if update_data.elevenlabs_model_id is not None:
        settings.ELEVENLABS_MODEL_ID = update_data.elevenlabs_model_id

    if update_data.replace_all_original_audio is not None:
        settings.REPLACE_ALL_ORIGINAL_AUDIO = update_data.replace_all_original_audio

    if update_data.target_true_peak_dbtp is not None:
        settings.TARGET_TRUE_PEAK_DBTP = update_data.target_true_peak_dbtp

    if update_data.max_true_peak_dbtp is not None:
        settings.MAX_TRUE_PEAK_DBTP = update_data.max_true_peak_dbtp

    if update_data.min_stem_count is not None:
        settings.MIN_STEM_COUNT = update_data.min_stem_count

    if update_data.require_real_api_keys is not None:
        settings.REQUIRE_REAL_API_KEYS = update_data.require_real_api_keys

    if update_data.allow_offline_fallback is not None:
        settings.ALLOW_OFFLINE_FALLBACK = update_data.allow_offline_fallback

    return get_current_settings()

@router.post("/test-connection")
def test_provider_connections():
    """Verify Gemini and ElevenLabs API credentials."""
    results = {}
    
    # Test ElevenLabs
    el_key = settings.get_effective_elevenlabs_key()
    if el_key and len(el_key.strip()) > 8:
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get("https://api.elevenlabs.io/v1/user", headers={"xi-api-key": el_key.strip()})
                if resp.status_code == 200:
                    data = resp.json()
                    tier = data.get("subscription", {}).get("tier", "standard")
                    char_count = data.get("subscription", {}).get("character_count", 0)
                    char_limit = data.get("subscription", {}).get("character_limit", 0)
                    results["elevenlabs"] = {
                        "status": "connected",
                        "tier": tier,
                        "character_usage": f"{char_count} / {char_limit}"
                    }
                else:
                    results["elevenlabs"] = {"status": "error", "detail": f"ElevenLabs API returned HTTP {resp.status_code}: {resp.text[:120]}"}
        except Exception as e:
            results["elevenlabs"] = {"status": "error", "detail": str(e)}
    else:
        results["elevenlabs"] = {"status": "not_configured", "detail": "No API key supplied (operating in offline fallback mode)"}

    # Test Gemini
    gem_key = settings.get_effective_gemini_key()
    if gem_key and len(gem_key.strip()) > 8:
        try:
            from google import genai
            client = genai.Client(api_key=gem_key.strip())
            # Ping with minimal model query
            results["gemini"] = {"status": "connected", "model": settings.GEMINI_MODEL}
        except Exception as e:
            results["gemini"] = {"status": "error", "detail": str(e)}
    else:
        results["gemini"] = {"status": "not_configured", "detail": "No API key supplied (operating in offline fallback mode)"}

    return results
