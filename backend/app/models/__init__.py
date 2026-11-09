import enum
import datetime
import uuid
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    ForeignKey, Text, JSON, Enum
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

class JobStatus(str, enum.Enum):
    UPLOADED = "Uploaded"
    INSPECTING_ORIGINAL_AUDIO = "Inspecting Original Audio"
    REMOVING_ORIGINAL_AUDIO = "Removing Original Audio"
    ANALYZING_VIDEO = "Analyzing Video"
    GENERATING_SOUNDS = "Generating Sounds"
    BUILDING_STEMS = "Building Stems"
    MIXING = "Mixing"
    RENDERING_VIDEO = "Rendering Video"
    VALIDATING = "Validating"
    PACKAGING = "Packaging"
    COMPLETED = "Completed"
    RETRYING = "Retrying"
    FAILED = "Failed"

class AudioClassificationCategory(str, enum.Enum):
    BACKGROUND_MUSIC = "Background music"
    INSTRUMENTAL_MUSIC = "Instrumental music"
    SONGS = "Songs"
    HUMAN_SPEECH = "Human speech"
    HUMAN_VOCALS = "Human vocals"
    ENVIRONMENTAL_AMBIENCE = "Environmental ambience"
    OBJECT_SFX = "Object sound effects"
    MECHANICAL_SOUNDS = "Mechanical sounds"
    MIXED_AUDIO = "Mixed audio"
    SILENCE = "Silence"
    NONE = "None (No audio stream)"

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)

    batches = relationship("Batch", back_populates="user", cascade="all, delete-orphan")

class Batch(Base):
    __tablename__ = "batches"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=utc_now)
    status = Column(String(50), default="Pending")
    total_videos = Column(Integer, default=0)
    completed_videos = Column(Integer, default=0)
    failed_videos = Column(Integer, default=0)

    user = relationship("User", back_populates="batches")
    jobs = relationship("VideoJob", back_populates="batch", cascade="all, delete-orphan")

class VideoJob(Base):
    __tablename__ = "video_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    batch_id = Column(String(36), ForeignKey("batches.id"), nullable=True, index=True)
    original_filename = Column(String(255), nullable=False)
    original_basename = Column(String(255), nullable=False)
    status = Column(Enum(JobStatus), default=JobStatus.UPLOADED, index=True)
    progress_percent = Column(Float, default=0.0)
    current_stage_detail = Column(String(255), default="Awaiting processing")
    
    # Flags & Config
    has_original_audio = Column(Boolean, default=False)
    original_audio_classification = Column(String(100), default="Pending Inspection")
    original_audio_removed = Column(Boolean, default=False)
    replace_all_original_audio = Column(Boolean, default=True)
    
    # Timing & Metrics
    retry_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    processing_time_seconds = Column(Float, nullable=True)
    estimated_api_cost_usd = Column(Float, default=0.0)
    
    # Relationships
    batch = relationship("Batch", back_populates="jobs")
    source_video = relationship("SourceVideo", uselist=False, back_populates="job", cascade="all, delete-orphan")
    audio_analysis = relationship("OriginalAudioAnalysis", uselist=False, back_populates="job", cascade="all, delete-orphan")
    sound_events = relationship("SoundEvent", back_populates="job", cascade="all, delete-orphan")
    audio_stems = relationship("AudioStem", back_populates="job", cascade="all, delete-orphan")
    mixdown = relationship("Mixdown", uselist=False, back_populates="job", cascade="all, delete-orphan")
    artifacts = relationship("OutputArtifact", back_populates="job", cascade="all, delete-orphan")
    qc_result = relationship("QCResult", uselist=False, back_populates="job", cascade="all, delete-orphan")
    job_errors = relationship("JobError", back_populates="job", cascade="all, delete-orphan")

class SourceVideo(Base):
    __tablename__ = "source_videos"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("video_jobs.id"), nullable=False, index=True)
    file_path = Column(String(512), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=True)
    
    # Visual specs
    duration_seconds = Column(Float, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    fps = Column(Float, nullable=True)
    video_codec = Column(String(50), nullable=True)
    video_bitrate = Column(Integer, nullable=True)
    
    # Audio specs
    has_audio = Column(Boolean, default=False)
    audio_streams_count = Column(Integer, default=0)
    audio_codec = Column(String(50), nullable=True)
    audio_sample_rate = Column(Integer, nullable=True)
    audio_channels = Column(Integer, nullable=True)
    audio_duration_seconds = Column(Float, nullable=True)
    
    job = relationship("VideoJob", back_populates="source_video")
    audio_streams = relationship("OriginalAudioStream", back_populates="source_video", cascade="all, delete-orphan")

class OriginalAudioStream(Base):
    __tablename__ = "original_audio_streams"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    source_video_id = Column(String(36), ForeignKey("source_videos.id"), nullable=False, index=True)
    stream_index = Column(Integer, default=0)
    codec_name = Column(String(50), nullable=False)
    sample_rate = Column(Integer, nullable=False)
    channels = Column(Integer, nullable=False)
    bitrate = Column(Integer, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    start_time_seconds = Column(Float, default=0.0)

    source_video = relationship("SourceVideo", back_populates="audio_streams")

class OriginalAudioAnalysis(Base):
    __tablename__ = "original_audio_analyses"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("video_jobs.id"), nullable=False, index=True)
    category = Column(String(100), nullable=False)
    confidence = Column(Float, default=1.0)
    detected_music = Column(Boolean, default=False)
    detected_speech = Column(Boolean, default=False)
    detected_vocals = Column(Boolean, default=False)
    detected_environmental = Column(Boolean, default=False)
    detected_silence = Column(Boolean, default=False)
    rms_db = Column(Float, nullable=True)
    spectral_centroid = Column(Float, nullable=True)
    features_json = Column(JSON, nullable=True)
    extracted_audio_path = Column(String(512), nullable=True)
    cleaned_after_processing = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)

    job = relationship("VideoJob", back_populates="audio_analysis")

class SoundEvent(Base):
    __tablename__ = "sound_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("video_jobs.id"), nullable=False, index=True)
    event_id = Column(String(100), nullable=False)
    start_time_ms = Column(Integer, nullable=False)
    end_time_ms = Column(Integer, nullable=False)
    duration_ms = Column(Integer, nullable=False)
    sound_category = Column(String(100), nullable=False)
    visual_action = Column(Text, nullable=False)
    sound_description = Column(Text, nullable=False)
    generation_prompt = Column(Text, nullable=False)
    priority = Column(Integer, default=3)
    confidence = Column(Float, default=0.9)
    intended_track = Column(String(100), nullable=False)
    estimated_distance = Column(String(50), default="mid")
    acoustic_environment = Column(String(100), default="natural")
    suggested_gain_db = Column(Float, default=-3.0)

    job = relationship("VideoJob", back_populates="sound_events")
    generated_sound = relationship("GeneratedSound", uselist=False, back_populates="event", cascade="all, delete-orphan")

class GeneratedSound(Base):
    __tablename__ = "generated_sounds"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    event_id = Column(String(36), ForeignKey("sound_events.id"), nullable=False, index=True)
    file_path = Column(String(512), nullable=False)
    sample_rate = Column(Integer, default=48000)
    channels = Column(Integer, default=2)
    duration_seconds = Column(Float, nullable=False)
    provider = Column(String(50), default="elevenlabs")
    model_used = Column(String(50), nullable=True)
    provider_audio_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=utc_now)

    event = relationship("SoundEvent", back_populates="generated_sound")

class AudioStem(Base):
    __tablename__ = "audio_stems"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("video_jobs.id"), nullable=False, index=True)
    stem_index = Column(Integer, nullable=False)
    stem_id = Column(String(50), nullable=False)  # stem_01, stem_02, etc.
    filename = Column(String(255), nullable=False)  # e.g., desert_ambience.wav
    relative_path = Column(String(255), nullable=False)  # Stems/desert_ambience.wav
    file_path = Column(String(512), nullable=False)
    category = Column(String(100), nullable=False)
    surface_material = Column(String(100), nullable=True)
    sample_rate = Column(Integer, default=48000)
    bit_depth = Column(Integer, default=24)
    channels = Column(Integer, default=2)
    sample_count = Column(Integer, default=480000)
    duration_seconds = Column(Float, default=10.0)
    true_peak_dbtp = Column(Float, nullable=True)
    rms_dbfs = Column(Float, nullable=True)

    job = relationship("VideoJob", back_populates="audio_stems")

class Mixdown(Base):
    __tablename__ = "mixdowns"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("video_jobs.id"), nullable=False, index=True)
    file_path = Column(String(512), nullable=False)
    filename = Column(String(100), default="Mixdown.wav")
    sample_rate = Column(Integer, default=48000)
    bit_depth = Column(Integer, default=24)
    channels = Column(Integer, default=2)
    sample_count = Column(Integer, default=480000)
    duration_seconds = Column(Float, default=10.0)
    true_peak_dbtp = Column(Float, nullable=False)
    rms_dbfs = Column(Float, nullable=False)
    reconstruction_max_diff = Column(Float, default=0.0)
    is_clipping = Column(Boolean, default=False)

    job = relationship("VideoJob", back_populates="mixdown")

class OutputArtifact(Base):
    __tablename__ = "output_artifacts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("video_jobs.id"), nullable=False, index=True)
    artifact_type = Column(String(50), nullable=False)  # final_mp4, mixdown_wav, stem_wav, zip_package, metadata_json
    filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=utc_now)

    job = relationship("VideoJob", back_populates="artifacts")

class QCResult(Base):
    __tablename__ = "qc_results"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("video_jobs.id"), nullable=False, index=True)
    passed = Column(Boolean, default=False)
    score = Column(Float, default=100.0)
    
    # Technical checks
    video_format_valid = Column(Boolean, default=False)
    video_codec_h264 = Column(Boolean, default=False)
    video_duration_exact = Column(Boolean, default=False)
    basename_preserved = Column(Boolean, default=False)
    original_audio_absent = Column(Boolean, default=False)
    
    audio_format_valid = Column(Boolean, default=False)
    audio_48khz = Column(Boolean, default=False)
    audio_24bit = Column(Boolean, default=False)
    audio_stereo = Column(Boolean, default=False)
    exact_480k_samples = Column(Boolean, default=False)
    stem_count_valid = Column(Boolean, default=False)
    no_digital_clipping = Column(Boolean, default=False)
    true_peak_compliant = Column(Boolean, default=False)
    measured_true_peak_dbtp = Column(Float, nullable=True)
    stems_non_empty = Column(Boolean, default=False)
    no_duplicate_stems = Column(Boolean, default=False)
    stems_reproduce_mixdown = Column(Boolean, default=False)
    mp4_audio_matches_mixdown = Column(Boolean, default=False)
    
    # Content checks
    no_generated_music = Column(Boolean, default=False)
    no_human_vocals = Column(Boolean, default=False)
    environmental_consistency = Column(Boolean, default=False)
    
    details_json = Column(JSON, nullable=True)
    report_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    job = relationship("VideoJob", back_populates="qc_result")

class ProviderUsage(Base):
    __tablename__ = "provider_usage"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("video_jobs.id"), nullable=True, index=True)
    provider = Column(String(50), nullable=False)  # "gemini" or "elevenlabs"
    operation = Column(String(100), nullable=False)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    audio_characters = Column(Integer, default=0)
    audio_duration_seconds = Column(Float, default=0.0)
    estimated_cost_usd = Column(Float, default=0.0)
    created_at = Column(DateTime, default=utc_now)

class JobError(Base):
    __tablename__ = "job_errors"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("video_jobs.id"), nullable=False, index=True)
    stage = Column(String(100), nullable=False)
    error_type = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    traceback = Column(Text, nullable=True)
    retryable = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)

    job = relationship("VideoJob", back_populates="job_errors")



class ProviderCredential(Base):
    __tablename__ = "provider_credentials"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    provider = Column(String(50), unique=True, index=True, nullable=False)  # "gemini", "elevenlabs"
    encrypted_api_key = Column(Text, nullable=False)
    key_prefix = Column(String(10), nullable=True)     # e.g., "AIza" or "sk_"
    key_suffix = Column(String(10), nullable=True)     # e.g., "1234"
    masked_key = Column(String(40), nullable=False)    # e.g., "••••••••••••1234"
    is_active = Column(Boolean, default=True)
    last_tested_at = Column(DateTime, nullable=True)
    last_test_status = Column(String(50), nullable=True) # "connected", "invalid_key", "quota_exceeded", "rate_limited", "failed", "untested"
    last_test_details = Column(Text, nullable=True)
    extra_config = Column(JSON, nullable=True)         # Provider-specific config (model, endpoint, etc.)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
