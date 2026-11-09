import os
import shutil
import pytest
import numpy as np
import soundfile as sf
import subprocess
from pathlib import Path

from app.core.config import settings
from app.services.ffmpeg_service import FFmpegService
from app.services.dsp_engine import AudioDSPEngine
from app.core.database import SessionLocal, Base, engine

@pytest.fixture(scope="session", autouse=True)
def init_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    # Keep db for inspection or clean up if desired

@pytest.fixture(scope="session")
def fixtures_dir(tmp_path_factory):
    dir_path = tmp_path_factory.mktemp("fixtures")
    return dir_path

def create_synthetic_video_with_audio(
    output_mp4_path: str,
    duration: float = 10.0,
    audio_type: str = "none",  # "none", "music", "instrumental", "speech_music", "environmental", "mixed"
    ffmpeg_exe: str = "ffmpeg"
):
    """
    Synthesizes valid test video clips matching Fixtures A through F:
    A. Silent video with no audio stream
    B. Video containing background music
    C. Video containing instrumental music
    D. Video containing speech and music
    E. Video containing original environmental sounds
    F. Video containing mixed music, voices, and environmental sounds
    """
    os.makedirs(os.path.dirname(output_mp4_path), exist_ok=True)
    temp_wav = output_mp4_path + ".temp.wav"
    sr = 48000
    n_samples = int(duration * sr)
    t = np.linspace(0, duration, n_samples, endpoint=False)
    
    has_audio = (audio_type != "none")
    
    if has_audio:
        audio = np.zeros((n_samples, 2), dtype=np.float32)
        
        if audio_type == "music":
            # Multi-tone harmonic chords + steady tempo beat
            chord = (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 554.37 * t) + np.sin(2 * np.pi * 659.25 * t)) * 0.15
            beat = (np.sin(2 * np.pi * 120 * t) * (np.sin(2 * np.pi * 2 * t) > 0.8)) * 0.2
            audio[:, 0] = chord + beat
            audio[:, 1] = chord + beat

        elif audio_type == "instrumental":
            # Piano / acoustic guitar arpeggio harmonics
            mel = (np.sin(2 * np.pi * 261.63 * t) + np.sin(2 * np.pi * 329.63 * t) + np.sin(2 * np.pi * 392.00 * t)) * 0.2
            audio[:, 0] = mel
            audio[:, 1] = mel

        elif audio_type == "speech_music":
            # Background harmonic music + 3-5 Hz modulated speech formant band
            music_bed = np.sin(2 * np.pi * 220 * t) * 0.08
            speech_mod = np.sin(2 * np.pi * 4 * t)  # 4 Hz syllable cadence
            speech_formant = (np.sin(2 * np.pi * 800 * t) + np.sin(2 * np.pi * 1800 * t)) * (speech_mod > 0) * 0.2
            audio[:, 0] = music_bed + speech_formant
            audio[:, 1] = music_bed + speech_formant

        elif audio_type == "environmental":
            # Ambient filtered noise (wind / surf)
            noise = np.random.randn(n_samples).astype(np.float32) * 0.12
            audio[:, 0] = noise
            audio[:, 1] = np.roll(noise, 100)

        elif audio_type == "mixed":
            # Music + speech + noise bursts
            music_bed = np.sin(2 * np.pi * 330 * t) * 0.08
            speech = np.sin(2 * np.pi * 1200 * t) * (np.sin(2 * np.pi * 3 * t) > 0) * 0.15
            env = np.random.randn(n_samples).astype(np.float32) * 0.05
            audio[:, 0] = music_bed + speech + env
            audio[:, 1] = music_bed + speech + env

        sf.write(temp_wav, audio, sr, subtype="PCM_24")

    # Generate synthetic MP4 using lavfi color pattern
    if has_audio:
        cmd = [
            ffmpeg_exe, "-y",
            "-f", "lavfi", "-i", f"color=c=navy:s=640x360:r=30:d={duration}",
            "-i", temp_wav,
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            output_mp4_path
        ]
    else:
        cmd = [
            ffmpeg_exe, "-y",
            "-f", "lavfi", "-i", f"color=c=navy:s=640x360:r=30:d={duration}",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            output_mp4_path
        ]

    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    
    if os.path.exists(temp_wav):
        os.remove(temp_wav)

    return output_mp4_path

