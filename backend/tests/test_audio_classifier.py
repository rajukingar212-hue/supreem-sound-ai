import os
import pytest
import numpy as np
import soundfile as sf
from app.services.audio_classifier import AudioClassifierService
from app.models import AudioClassificationCategory

def test_classify_none_and_silence(tmp_path):
    classifier = AudioClassifierService()
    
    # 1. Non-existent file
    res = classifier.analyze_audio_file(None)
    assert res["category"] == AudioClassificationCategory.NONE.value
    assert res["detected_silence"] is True
    assert res["confidence"] == 1.0

    # 2. Silent audio file
    silent_wav = str(tmp_path / "silent.wav")
    sr = 48000
    silent_data = np.zeros((sr * 2, 2), dtype=np.float32)
    sf.write(silent_wav, silent_data, sr, subtype="PCM_24")

    res_silent = classifier.analyze_audio_file(silent_wav)
    assert res_silent["category"] == AudioClassificationCategory.SILENCE.value
    assert res_silent["detected_silence"] is True
    assert res_silent["rms_db"] < -60.0

def test_classify_music(tmp_path):
    classifier = AudioClassifierService()
    music_wav = str(tmp_path / "music.wav")
    sr = 48000
    t = np.linspace(0, 3.0, sr * 3, endpoint=False)
    
    # Harmonic chords with low flatness
    harmonic_chord = (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 554.37 * t) + np.sin(2 * np.pi * 659.25 * t)) * 0.25
    stereo_music = np.column_stack((harmonic_chord, harmonic_chord)).astype(np.float32)
    sf.write(music_wav, stereo_music, sr, subtype="PCM_24")

    res = classifier.analyze_audio_file(music_wav)
    assert res["detected_music"] is True
    assert res["category"] in (AudioClassificationCategory.BACKGROUND_MUSIC.value, AudioClassificationCategory.INSTRUMENTAL_MUSIC.value, AudioClassificationCategory.MIXED_AUDIO.value)

def test_classify_environmental(tmp_path):
    classifier = AudioClassifierService()
    env_wav = str(tmp_path / "ambient.wav")
    sr = 48000
    # Wideband ambient noise (wind/surf)
    noise = np.random.randn(sr * 3, 2).astype(np.float32) * 0.15
    sf.write(env_wav, noise, sr, subtype="PCM_24")

    res = classifier.analyze_audio_file(env_wav)
    assert res["detected_environmental"] is True or res["category"] in (AudioClassificationCategory.ENVIRONMENTAL_AMBIENCE.value, AudioClassificationCategory.MIXED_AUDIO.value)

