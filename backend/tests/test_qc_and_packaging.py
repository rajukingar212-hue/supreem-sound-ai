import os
import zipfile
import pytest
import numpy as np
import soundfile as sf

from app.services.ffmpeg_service import FFmpegService
from app.services.dsp_engine import AudioDSPEngine
from app.services.qc_engine import QualityControlEngine
from app.services.packaging_service import PackagingService
from tests.conftest import create_synthetic_video_with_audio

def test_full_qc_pass_and_packaging(tmp_path):
    ffmpeg = FFmpegService()
    dsp = AudioDSPEngine()
    qc = QualityControlEngine(ffmpeg_service=ffmpeg, dsp_engine=dsp)
    packaging = PackagingService()

    # 1. Synthesize 3 stems and balanced Mixdown
    stems_dir = str(tmp_path / "Stems")
    mix_path = str(tmp_path / "Mixdown.wav")

    s1 = dsp.create_empty_stem_buffer()
    s1 = dsp.place_sound_on_stem(s1, dsp.generate_procedural_fallback_audio("ambience", 10.0, "wind"), 0, -6.0)

    s2 = dsp.create_empty_stem_buffer()
    s2 = dsp.place_sound_on_stem(s2, dsp.generate_procedural_fallback_audio("footsteps", 3.0, "sand steps"), 2000, -4.0)

    s3 = dsp.create_empty_stem_buffer()
    s3 = dsp.place_sound_on_stem(s3, dsp.generate_procedural_fallback_audio("metal", 2.0, "clash"), 5000, -3.0)

    stem_buffers = [
        ("stem_01", "desert_ambience.wav", s1),
        ("stem_02", "footsteps_on_sand.wav", s2),
        ("stem_03", "metal_object_impact.wav", s3),
    ]

    mix_res = dsp.balance_and_export_stems(stem_buffers, stems_dir, mix_path)
    stem_paths = [s["file_path"] for s in mix_res["stems"]]

    # 2. Render Final MP4
    clean_src = str(tmp_path / "clean_source.mp4")
    create_synthetic_video_with_audio(clean_src, duration=10.0, audio_type="none", ffmpeg_exe=ffmpeg.ffmpeg_path)

    final_mp4 = str(tmp_path / "desert_scene.mp4")
    ffmpeg.render_final_video(
        video_source_path=clean_src,
        audio_mixdown_path=mix_path,
        output_mp4_path=final_mp4,
        target_duration=10.0,
        target_fps=30
    )

    # 3. Run QC Audit
    qc_report = qc.run_full_qc(
        final_mp4_path=final_mp4,
        mixdown_wav_path=mix_path,
        stem_wav_paths=stem_paths,
        original_basename="desert_scene",
        original_audio_wav_path=None
    )

    assert qc_report.passed is True
    assert qc_report.score == 100.0
    assert qc_report.true_peak_compliant is True
    assert qc_report.no_digital_clipping is True
    assert qc_report.stems_reproduce_mixdown is True
    assert qc_report.video_duration_exact is True
    assert qc_report.audio_format_valid is True

    # 4. Package into ZIP
    meta_dict = packaging.build_metadata_json(
        clip_id="test_clip_123",
        original_basename="desert_scene",
        video_specs={"width": 640, "height": 360, "fps": 30},
        stems_info=[s.model_dump() for s in qc_report.stems_detail],
        sound_events=[{"intended_track": "Stem 1", "sound_category": "Ambience", "sound_description": "Desert wind"}]
    )

    zip_path = str(tmp_path / "desert_scene.zip")
    packaging.create_video_package(
        job_id="test_clip_123",
        original_basename="desert_scene",
        final_mp4_path=final_mp4,
        mixdown_wav_path=mix_path,
        stem_paths=stem_paths,
        output_zip_path=zip_path,
        metadata_dict=meta_dict
    )

    assert os.path.exists(zip_path)
    assert os.path.getsize(zip_path) > 0

    # 5. Verify ZIP contents
    with zipfile.ZipFile(zip_path, "r") as z:
        names = z.namelist()
        assert "desert_scene.mp4" in names
        assert "Mixdown.wav" in names
        assert "metadata.json" in names
        assert any("Stems/" in n for n in names)
        assert len([n for n in names if n.startswith("Stems/") and n.endswith(".wav")]) >= 3

