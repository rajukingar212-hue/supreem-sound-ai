from typing import List, Optional
from pydantic import BaseModel, Field

class SoundEventSchema(BaseModel):
    event_id: str = Field(description="Unique identifier for the sound event (e.g., event_01)")
    start_time_ms: int = Field(ge=0, le=10000, description="Start time in milliseconds (0 to 10000)")
    end_time_ms: int = Field(ge=0, le=10000, description="End time in milliseconds (0 to 10000)")
    sound_category: str = Field(description="Category (e.g., Ambient soundscapes, Foley / movement, Impacts / collisions)")
    visual_action: str = Field(description="Detailed visual cue or visible action causing the sound")
    sound_description: str = Field(description="Accurate description of the actual acoustic sound")
    generation_prompt: str = Field(description="Optimized prompt for ElevenLabs sound generation")
    priority: int = Field(default=3, ge=1, le=5, description="Mix priority (1-5)")
    confidence: float = Field(default=0.9, ge=0.0, le=1.0, description="AI confidence score")
    intended_track: str = Field(description="Assigned stem track (e.g., Stem 1 - Ambience, Stem 2 - Foley, Stem 3 - Impacts)")
    estimated_distance: str = Field(default="mid", description="near, mid, or distant")
    acoustic_environment: str = Field(default="natural", description="Room acoustics / outdoor description")
    suggested_gain_db: float = Field(default=-3.0, ge=-24.0, le=0.0, description="Suggested gain in dB")

class SoundEventTimelineSchema(BaseModel):
    clip_description: str = Field(description="Summary of the 10-second scene")
    acoustic_perspective: str = Field(description="Overall acoustic setting and reverberant environment")
    events: List[SoundEventSchema] = Field(description="List of sound events (minimum 3 distinct tracks)")

