import os
import pytest
import numpy as np
import soundfile as sf
from app.services.dsp_engine import AudioDSPEngine

def test_dsp_sample_accurate_timelines(tmp_path):
    dsp = AudioDSPEngine(sample_rate=48000, channels=2, duration_seconds=10.0)
    
    assert dsp.exact_sample_count == 480000
    
    # 1. Create empty stem buffer
    buf = dsp.create_empty_stem_buffer()
    assert buf.shape == (480000, 2)
    assert buf.dtype == np.float32
    assert np.all(buf == 0.0)

    # 2. Place sound at 2000 ms (sample 96,000)
    sound_len = 48000  # 1 second
    sound_pcm = np.ones((sound_len, 2), dtype=np.float32) * 0.5
    
    buf = dsp.place_sound_on_stem(buf, sound_pcm, start_ms=2000, gain_db=0.0)
    assert np.max(buf[:96000]) == 0.0
    assert np.max(buf[96000 : 96000 + 48000]) > 0.4
    assert np.max(buf[96000 + 48000:]) == 0.0

def test_dsp_mixdown_summation_contract_and_true_peak(tmp_path):
    dsp = AudioDSPEngine(sample_rate=48000, channels=2, duration_seconds=10.0)
    
    stems_dir = str(tmp_path / "Stems")
    mix_path = str(tmp_path / "Mixdown.wav")

    # Build 3 distinct stems
    stem1 = dsp.create_empty_stem_buffer()
    snd1 = dsp.generate_procedural_fallback_audio("ambience", 10.0, "desert wind")
    stem1 = dsp.place_sound_on_stem(stem1, snd1, 0, gain_db=-6.0)

    stem2 = dsp.create_empty_stem_buffer()
    snd2 = dsp.generate_procedural_fallback_audio("footsteps", 3.0, "footsteps on sand")
    stem2 = dsp.place_sound_on_stem(stem2, snd2, 1500, gain_db=-4.0)

    stem3 = dsp.create_empty_stem_buffer()
    snd3 = dsp.generate_procedural_fallback_audio("metal", 2.0, "metal sheet clash")
    stem3 = dsp.place_sound_on_stem(stem3, snd3, 4000, gain_db=-3.0)

    stem_buffers = [
        ("stem_01", "desert_ambience.wav", stem1),
        ("stem_02", "footsteps_on_sand.wav", stem2),
        ("stem_03", "metal_object_impact.wav", stem3),
    ]

    res = dsp.balance_and_export_stems(stem_buffers, stems_dir, mix_path)

    # Validate results
    assert res["reproduction_valid"] is True
    assert res["reconstruction_max_diff"] < 1e-4  # Exact within 24-bit quantization
    assert res["true_peak_dbtp"] <= -1.0  # Strict ceiling compliance
    assert res["sample_rate"] == 48000
    assert res["bit_depth"] == 24
    assert res["channels"] == 2
    assert res["sample_count"] == 480000

    # Verify exported files on disk
    assert os.path.exists(mix_path)
    mix_info = sf.info(mix_path)
    assert mix_info.samplerate == 48000
    assert mix_info.channels == 2
    assert mix_info.subtype == "PCM_24"
    assert mix_info.frames == 480000

    for s_info in res["stems"]:
        p = s_info["file_path"]
        assert os.path.exists(p)
        info = sf.info(p)
        assert info.samplerate == 48000
        assert info.channels == 2
        assert info.subtype == "PCM_24"
        assert info.frames == 480000

