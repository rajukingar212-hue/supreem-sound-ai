import os
import sys
import zipfile
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.config import settings
from app.core.database import SessionLocal, Base, engine
from app.models import Batch, VideoJob, SourceVideo, JobStatus, OutputArtifact
from app.services.pipeline_runner import PipelineRunner
from app.services.ffmpeg_service import FFmpegService

def run_e2e_demo():
    print("=" * 60)
    print("🚀 SUPREEM SOUND AI — END-TO-END DEMO EXECUTION")
    print("=" * 60)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 1. Extract sample clip from references/Good examples.zip
    workspace_dir = Path(__file__).resolve().parent.parent
    ref_zip = workspace_dir / "references" / "Good examples.zip"
    demo_input_dir = settings.UPLOADS_DIR
    demo_input_dir.mkdir(parents=True, exist_ok=True)
    demo_video_path = demo_input_dir / "desert_scene_demo.mp4"

    if ref_zip.exists():
        print(f"Extracting test clip from {ref_zip.name}...")
        with zipfile.ZipFile(ref_zip, "r") as outer_zip:
            nested_name = [n for n in outer_zip.namelist() if "3bc58bdf" in n and n.endswith(".zip")][0]
            outer_zip.extract(nested_name, demo_input_dir)
            nested_path = demo_input_dir / nested_name
            with zipfile.ZipFile(nested_path, "r") as inner_zip:
                inner_vids = [n for n in inner_zip.namelist() if n.endswith("Video.mp4")]
                with inner_zip.open(inner_vids[0]) as vf, open(demo_video_path, "wb") as out_f:
                    out_f.write(vf.read())
            if nested_path.exists():
                os.remove(nested_path)
    else:
        print("Creating synthetic input clip...")
        from tests.conftest import create_synthetic_video_with_audio
        create_synthetic_video_with_audio(str(demo_video_path), 10.0, "mixed")

    print(f"Demo video ready at: {demo_video_path} ({os.path.getsize(demo_video_path)} bytes)")

    # 2. Ingest into database
    import time
    job_id = f"demo_desert_{int(time.time())}"

    job = VideoJob(
        id=job_id,
        original_filename="desert_scene_demo.mp4",
        original_basename="desert_scene_demo",
        status=JobStatus.UPLOADED,
        progress_percent=0.0
    )
    db.add(job)

    src = SourceVideo(
        job_id=job_id,
        file_path=str(demo_video_path),
        file_size_bytes=os.path.getsize(demo_video_path),
        mime_type="video/mp4"
    )
    db.add(src)
    db.commit()

    # 3. Process video job through master autonomous pipeline
    print("\nStarting autonomous sound design pipeline...")
    runner = PipelineRunner()
    runner.process_job(job_id)

    # 4. Verify completion and report
    completed_job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
    print("\n" + "=" * 60)
    print("✨ DEMO EXECUTION RESULTS")
    print("=" * 60)
    print(f"Status:                      {completed_job.status.value}")
    print(f"Original Audio Detected:     {completed_job.has_original_audio}")
    print(f"Original Audio Classified:   {completed_job.original_audio_classification}")
    print(f"Original Audio Removed:      {completed_job.original_audio_removed} (via FFmpeg -an)")
    print(f"Processing Duration:         {completed_job.processing_time_seconds}s")
    print(f"Sound Events Planned:        {len(completed_job.sound_events)}")
    print(f"Independent Stems Rendered:  {len(completed_job.audio_stems)}")
    print(f"Mixdown True Peak:           {completed_job.mixdown.true_peak_dbtp} dBTP (Target -3.5, Max -1.0)")
    print(f"Mixdown Reconstruction Diff: {completed_job.mixdown.reconstruction_max_diff:.6e} (tolerance < 1e-4)")
    print(f"QC Audit Result:             {'PASSED (Score: ' + str(completed_job.qc_result.score) + '%)' if completed_job.qc_result.passed else 'FAILED'}")

    zip_art = db.query(OutputArtifact).filter(
        OutputArtifact.job_id == job_id,
        OutputArtifact.artifact_type == "zip_package"
    ).first()
    if zip_art:
        print(f"\n📦 Final Delivery ZIP Created: {zip_art.file_path}")
        print(f"   Size: {zip_art.file_size_bytes:,} bytes")
        with zipfile.ZipFile(zip_art.file_path, "r") as z:
            print("   ZIP Package Entries:")
            for item in z.infolist():
                print(f"     • {item.filename:<32} ({item.file_size:,} bytes)")

    print("\nDemonstration completed successfully!")

if __name__ == "__main__":
    run_e2e_demo()

