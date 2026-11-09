import os
import io
import time
import math
import subprocess
import logging
import httpx
import numpy as np
import soundfile as sf
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.core.config import settings
from app.services.dsp_engine import AudioDSPEngine

logger = logging.getLogger("supreem.elevenlabs")

class ElevenLabsService:
    def __init__(self, api_key: Optional[str] = None, dsp_engine: Optional[AudioDSPEngine] = None):
        self._initial_api_key = api_key
        self.api_key = api_key or settings.get_effective_elevenlabs_key()
        self.base_url = settings.ELEVENLABS_BASE_URL
        self.dsp = dsp_engine or AudioDSPEngine()

    def get_api_key(self, db: Optional[Session] = None) -> Optional[str]:
        if self._initial_api_key:
            return self._initial_api_key
        if db:
            from app.services.credential_manager import credential_manager
            db_key = credential_manager.get_active_api_key(db, "elevenlabs")
            if db_key:
                return db_key
        return settings.get_effective_elevenlabs_key()

    def is_configured(self, db: Optional[Session] = None) -> bool:
        k = self.get_api_key(db)
        return bool(k and len(k.strip()) > 8)

    def generate_sound_effect(
        self,
        prompt: str,
        duration_seconds: float,
        category: str = "SFX",
        description: str = "",
        max_retries: int = 3,
        db: Optional[Session] = None
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Generates sound effect from prompt.
        If ElevenLabs API is configured, calls the official sound-generation endpoint.
        Otherwise or on exhausted retries, synthesizes a high-fidelity acoustic fallback.
        Returns: (stereo_48khz_float_pcm, metadata_dict)
        """
        # Clamp duration to ElevenLabs supported range (0.5 to 11.0 seconds)
        req_duration = max(0.5, min(10.0, float(duration_seconds)))
        effective_key = self.get_api_key(db)
        masked = settings.mask_key(effective_key)

        if effective_key and len(effective_key.strip()) > 8:
            logger.info(f"Initiating ElevenLabs sound generation (key: {masked}, prompt: '{prompt[:40]}...', dur: {req_duration:.1f}s)...")
            last_err = None
            for attempt in range(1, max_retries + 1):
                try:
                    pcm_audio, meta = self._call_elevenlabs_api(prompt, req_duration, api_key=effective_key)
                    logger.info(f"ElevenLabs sound effect synthesized successfully ({len(pcm_audio)} samples, {pcm_audio.shape[1]}ch).")
                    return pcm_audio, meta
                except httpx.HTTPStatusError as e:
                    last_err = e
                    status = e.response.status_code
                    if status in (429, 500, 502, 503, 504):
                        sleep_time = (2 ** attempt) + (0.2 * attempt)
                        logger.warning(f"ElevenLabs HTTP status {status}, retrying in {sleep_time:.1f}s (attempt {attempt}/{max_retries})...")
                        time.sleep(sleep_time)
                    else:
                        logger.error(f"ElevenLabs unrecoverable HTTP status {status}: {e}")
                        break
                except Exception as e:
                    last_err = e
                    logger.error(f"ElevenLabs call failed on attempt {attempt}: {e}")
                    time.sleep(1.0 * attempt)

            is_production = settings.ENVIRONMENT.lower() == "production"
            if settings.REQUIRE_REAL_API_KEYS or is_production or not settings.ALLOW_OFFLINE_FALLBACK:
                raise RuntimeError(f"ElevenLabs sound generation failed and offline fallback is disabled: {last_err}")
            
            logger.warning("ElevenLabs retries exhausted. Using procedural acoustic generator fallback.")
        else:
            is_production = settings.ENVIRONMENT.lower() == "production"
            if settings.REQUIRE_REAL_API_KEYS or is_production or not settings.ALLOW_OFFLINE_FALLBACK:
                raise RuntimeError(
                    "ElevenLabs API key is missing. In production mode, an active API credential is strictly required. "
                    "Please configure ELEVENLABS_API_KEY in Settings -> API Keys before processing."
                )
            logger.info(f"ElevenLabs API key not configured. Synthesizing procedural acoustic SFX for '{prompt[:35]}...'")

        # Fallback procedural generation
        audio = self.dsp.generate_procedural_fallback_audio(
            category=category,
            duration_sec=req_duration,
            description=description or prompt
        )
        metadata = {
            "provider": "procedural_dsp",
            "model": "supreem_acoustic_synth_v1",
            "prompt": prompt,
            "duration_seconds": req_duration,
            "estimated_cost_usd": 0.0
        }
        return audio, metadata

    def _call_elevenlabs_api(
        self,
        prompt: str,
        duration_seconds: float,
        api_key: Optional[str] = None
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Call ElevenLabs POST /v1/sound-generation endpoint."""
        key_to_use = api_key or self.api_key
        endpoint = f"{self.base_url}/sound-generation"
        headers = {
            "xi-api-key": key_to_use,
            "Content-Type": "application/json"
        }
        payload = {
            "text": prompt,
            "duration_seconds": round(duration_seconds, 1),
            "prompt_influence": 0.5
        }

        with httpx.Client(timeout=45.0) as client:
            resp = client.post(endpoint, json=payload, headers=headers)
            resp.raise_for_status()
            audio_bytes = resp.content

        if not audio_bytes or len(audio_bytes) < 128:
            raise ValueError(f"Received invalid or empty audio payload from ElevenLabs ({len(audio_bytes) if audio_bytes else 0} bytes)")

        # Decode received audio format (MP3 or WAV)
        try:
            bio = io.BytesIO(audio_bytes)
            data, sr = sf.read(bio, dtype="float32")
        except Exception as decode_err:
            logger.warning(f"soundfile decode failed ({decode_err}), using FFmpeg pipe decode fallback...")
            data, sr = self._decode_audio_with_ffmpeg(audio_bytes)

        # Conform to 48 kHz stereo
        conformed = self.dsp.resample_and_conform_audio(
            audio_data=data,
            source_sr=sr,
            target_sr=48000,
            target_channels=2
        )
        
        # Apply smooth micro-fades
        final_audio = self.dsp.apply_fades(conformed)

        # Estimate API usage cost (~ $0.005 per generation)
        meta = {
            "provider": "elevenlabs",
            "model": "eleven_sound_effects_v1",
            "prompt": prompt,
            "duration_seconds": duration_seconds,
            "characters": len(prompt),
            "estimated_cost_usd": 0.005
        }
        return final_audio, meta

    def _decode_audio_with_ffmpeg(self, audio_bytes: bytes) -> Tuple[np.ndarray, int]:
        """Decode any audio bytes format to float32 PCM array using FFmpeg pipe."""
        cmd = [
            "ffmpeg",
            "-y",
            "-i", "pipe:0",
            "-f", "f32le",
            "-acodec", "pcm_f32le",
            "-ar", "48000",
            "-ac", "2",
            "pipe:1"
        ]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out, err = proc.communicate(input=audio_bytes)
        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg audio decode failed: {err.decode('utf-8', errors='ignore')}")

        pcm_data = np.frombuffer(out, dtype=np.float32).reshape(-1, 2)
        return pcm_data, 48000
