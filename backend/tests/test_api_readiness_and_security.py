import os
import pytest
from app.core.config import Settings, settings
from app.services.gemini_service import GeminiVisionService
from app.services.elevenlabs_service import ElevenLabsService
from app.services.qc_engine import QualityControlEngine

def test_key_masking_security():
    test_key = "AIzaSyD-1234567890abcdefABCDEF12345"
    masked = Settings.mask_key(test_key)
    assert "..." in masked
    assert masked.startswith("AIza")
    assert masked.endswith("2345")
    assert len(masked) < len(test_key)
    # Full secret is never present
    assert "1234567890abcdef" not in masked

    assert Settings.mask_key(None) == "NOT CONFIGURED"
    assert Settings.mask_key("") == "NOT CONFIGURED"
    assert Settings.mask_key("short") == "NOT CONFIGURED"

def test_api_readiness_validation():
    readiness = settings.validate_api_readiness()
    assert "gemini" in readiness
    assert "elevenlabs" in readiness
    assert "environment" in readiness
    assert "require_real_api_keys" in readiness
    assert isinstance(readiness["gemini"]["configured"], bool)
    assert isinstance(readiness["elevenlabs"]["configured"], bool)

def test_gemini_offline_mode_and_enforcement():
    # In offline fallback mode with no keys, should produce valid 3+ track timeline
    gemini_svc = GeminiVisionService(api_key=None)
    assert not gemini_svc.is_configured()

    # Fallback generates valid 3+ tracks
    timeline = gemini_svc.analyze_video_frames(
        frame_paths=[],
        video_metadata={"duration": 10.0},
        original_basename="test_water_action"
    )
    assert len(timeline.events) >= 3
    tracks = set(e.intended_track for e in timeline.events)
    assert len(tracks) >= 3

    # Now test when real API keys are strictly required
    orig_req = settings.REQUIRE_REAL_API_KEYS
    try:
        settings.REQUIRE_REAL_API_KEYS = True
        with pytest.raises(RuntimeError) as exc_info:
            gemini_svc.analyze_video_frames(
                frame_paths=[],
                video_metadata={"duration": 10.0},
                original_basename="test_water_action"
            )
        assert "Google Gemini API key is missing" in str(exc_info.value)
    finally:
        settings.REQUIRE_REAL_API_KEYS = orig_req

def test_elevenlabs_offline_mode_and_enforcement():
    # In offline fallback mode with no keys, should synthesize procedural audio
    el_svc = ElevenLabsService(api_key=None)
    assert not el_svc.is_configured()

    pcm, meta = el_svc.generate_sound_effect(
        prompt="Ocean waves crashing",
        duration_seconds=3.0,
        category="Ambience"
    )
    assert pcm.shape == (144000, 2)  # 3s * 48000
    assert meta["provider"] == "procedural_dsp"

    # Now test when real API keys are strictly required
    orig_req = settings.REQUIRE_REAL_API_KEYS
    try:
        settings.REQUIRE_REAL_API_KEYS = True
        with pytest.raises(RuntimeError) as exc_info:
            el_svc.generate_sound_effect(
                prompt="Ocean waves crashing",
                duration_seconds=3.0
            )
        assert "ElevenLabs API key is missing" in str(exc_info.value)
    finally:
        settings.REQUIRE_REAL_API_KEYS = orig_req

def test_zip_archive_independent_qc(tmp_path):
    import zipfile
    import json
    from app.services.qc_engine import QualityControlEngine

    qc = QualityControlEngine()
    zip_path = str(tmp_path / "test_package.zip")

    # Create dummy compliant ZIP
    with zipfile.ZipFile(zip_path, "w") as z:
        z.writestr("test_video.mp4", b"dummy mp4 data")
        z.writestr("Mixdown.wav", b"dummy mixdown data")
        z.writestr("Stems/stem_01.wav", b"stem 1")
        z.writestr("Stems/stem_02.wav", b"stem 2")
        z.writestr("Stems/stem_03.wav", b"stem 3")
        meta = {
            "clip_id": "test_123",
            "audio_master": {"file_path": "Mixdown.wav"},
            "stems": [{"stem_id": "stem_01"}, {"stem_id": "stem_02"}, {"stem_id": "stem_03"}]
        }
        z.writestr("metadata.json", json.dumps(meta))

    result = qc.validate_zip_package(zip_path, "test_video")
    assert result["valid"] is True
    assert result["has_mp4"] is True
    assert result["has_mixdown"] is True
    assert result["has_stems"] is True
    assert result["stem_count"] == 3
    assert result["has_metadata"] is True
    assert len(result["issues"]) == 0

def test_celery_task_registration():
    from app.core.celery_app import celery_app
    from app.tasks import process_video_job
    assert "app.tasks.process_video_job" in celery_app.tasks
    assert celery_app.conf.worker_concurrency == settings.WORKER_CONCURRENCY

