import os
import pytest
from app.services.ffmpeg_service import FFmpegService
from tests.conftest import create_synthetic_video_with_audio

def test_ffmpeg_probe_and_audio_stripping(tmp_path):
    ffmpeg = FFmpegService()

    # 1. Synthesize video with music audio
    test_video_path = str(tmp_path / "music_input.mp4")
    create_synthetic_video_with_audio(
        test_video_path,
        duration=10.0,
        audio_type="music",
        ffmpeg_exe=ffmpeg.ffmpeg_path
    )

    # 2. Inspect with ffprobe
    meta = ffmpeg.inspect_media(test_video_path)
    assert meta["has_video"] is True
    assert meta["has_audio"] is True
    assert meta["audio_stream_count"] >= 1
    assert meta["video"]["codec"] == "h264"
    assert abs(meta["duration"] - 10.0) < 0.2

    # 3. Extract audio
    extracted_wav = str(tmp_path / "extracted.wav")
    ffmpeg.extract_audio(test_video_path, extracted_wav)
    assert os.path.exists(extracted_wav)
    assert os.path.getsize(extracted_wav) > 0

    # 4. Strip audio completely (-an)
    stripped_video_path = str(tmp_path / "stripped.mp4")
    ffmpeg.strip_audio_from_video(test_video_path, stripped_video_path)
    
    # 5. Verify stripped video has ZERO audio streams
    stripped_meta = ffmpeg.inspect_media(stripped_video_path)
    assert stripped_meta["has_video"] is True
    assert stripped_meta["has_audio"] is False
    assert stripped_meta["audio_stream_count"] == 0

def test_ffmpeg_render_final_video_with_mixdown(tmp_path):
    ffmpeg = FFmpegService()
    
    # Synthesize clean stripped video
    source_video = str(tmp_path / "clean_source.mp4")
    create_synthetic_video_with_audio(source_video, duration=10.0, audio_type="none", ffmpeg_exe=ffmpeg.ffmpeg_path)

    # Synthesize mixdown wav
    import soundfile as sf
    import numpy as np
    mix_wav = str(tmp_path / "Mixdown.wav")
    sr = 48000
    noise = np.random.randn(sr * 10, 2).astype(np.float32) * 0.1
    sf.write(mix_wav, noise, sr, subtype="PCM_24")

    # Render final MP4
    final_mp4 = str(tmp_path / "final_desert_scene.mp4")
    ffmpeg.render_final_video(
        video_source_path=source_video,
        audio_mixdown_path=mix_wav,
        output_mp4_path=final_mp4,
        target_duration=10.0,
        target_fps=30
    )

    assert os.path.exists(final_mp4)
    out_meta = ffmpeg.inspect_media(final_mp4)
    assert out_meta["has_video"] is True
    assert out_meta["has_audio"] is True
    assert out_meta["video"]["codec"] == "h264"
    assert out_meta["audio_streams"][0]["codec"] == "aac"
    assert out_meta["audio_streams"][0]["sample_rate"] == 48000
    assert abs(out_meta["duration"] - 10.0) <= 0.15

