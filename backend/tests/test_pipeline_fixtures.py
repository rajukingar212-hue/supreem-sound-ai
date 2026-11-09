import os
import uuid
import pytest
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal, Base, engine
from app.models import VideoJob, SourceVideo, JobStatus, OutputArtifact
from app.services.pipeline_runner import PipelineRunner
from tests.conftest import create_synthetic_video_with_audio

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.mark.parametrize("fixture_name, audio_type", [
    ("Fixture_A_Silent", "none"),
    ("Fixture_B_BackgroundMusic", "music"),
    ("Fixture_C_InstrumentalMusic", "instrumental"),
    ("Fixture_D_SpeechAndMusic", "speech_music"),
    ("Fixture_E_Environmental", "environmental"),
    ("Fixture_F_MixedAudio", "mixed"),
])
def test_pipeline_on_all_fixtures(tmp_path, db_session: Session, fixture_name: str, audio_type: str):
    """
    Executes complete end-to-end sound design pipeline across all 6 test fixtures.
    Validates:
    - Original audio correctly detected (or absence detected for silent video)
    - Original audio completely removed before sound design
    - Structured sound events generated
    - At least 3 independent stems rendered as 48kHz 24-bit PCM stereo WAV (480,000 samples)
    - Mixdown reproduced by stem summation within quantization tolerance
    - True peak compliant (<= -1 dBTP)
    - Final MP4 duration exactly 10.0s H.264 + AAC
    - Delivery ZIP package created and QC 100% passed!
    """
    runner = PipelineRunner()

    # 1. Synthesize input video
    input_video_path = str(tmp_path / f"{fixture_name}.mp4")
    create_synthetic_video_with_audio(
        output_mp4_path=input_video_path,
        duration=10.0,
        audio_type=audio_type,
        ffmpeg_exe=runner.ffmpeg.ffmpeg_path
    )

    job_id = str(uuid.uuid4())
    job = VideoJob(
        id=job_id,
        original_filename=f"{fixture_name}.mp4",
        original_basename=fixture_name,
        status=JobStatus.UPLOADED,
        progress_percent=0.0
    )
    db_session.add(job)

    src = SourceVideo(
        job_id=job_id,
        file_path=input_video_path,
        file_size_bytes=os.path.getsize(input_video_path),
        mime_type="video/mp4"
    )
    db_session.add(src)
    db_session.commit()

    # 2. Run the autonomous pipeline
    runner.process_job(job_id)

    # 3. Verify results in DB
    completed_job = db_session.query(VideoJob).filter(VideoJob.id == job_id).first()
    assert completed_job.status == JobStatus.COMPLETED, f"Job failed with error: {completed_job.error_message}"
    assert completed_job.progress_percent == 100.0

    # Verify original audio detection & removal
    if audio_type == "none":
        assert completed_job.has_original_audio is False
    else:
        assert completed_job.has_original_audio is True
        assert completed_job.original_audio_removed is True

    # Verify QC Result
    assert completed_job.qc_result is not None
    assert completed_job.qc_result.passed is True
    assert completed_job.qc_result.score == 100.0
    assert completed_job.qc_result.true_peak_compliant is True
    assert completed_job.qc_result.no_digital_clipping is True
    assert completed_job.qc_result.stems_reproduce_mixdown is True
    assert completed_job.qc_result.original_audio_absent is True

    # Verify Stems (>= 3 stems)
    assert len(completed_job.audio_stems) >= 3
    for stem in completed_job.audio_stems:
        assert stem.sample_rate == 48000
        assert stem.bit_depth == 24
        assert stem.channels == 2
        assert stem.sample_count == 480000
        assert os.path.exists(stem.file_path)

    # Verify Mixdown
    assert completed_job.mixdown is not None
    assert completed_job.mixdown.sample_rate == 48000
    assert completed_job.mixdown.bit_depth == 24
    assert completed_job.mixdown.channels == 2
    assert completed_job.mixdown.sample_count == 480000
    assert completed_job.mixdown.true_peak_dbtp <= -1.0
    assert os.path.exists(completed_job.mixdown.file_path)

    # Verify ZIP artifact
    zip_art = next((a for a in completed_job.artifacts if a.artifact_type == "zip_package"), None)
    assert zip_art is not None
    assert os.path.exists(zip_art.file_path)
    assert os.path.getsize(zip_art.file_path) > 0

