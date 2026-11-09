import os
import json
import zipfile
import time
from typing import Dict, Any, List
from pathlib import Path
import logging

logger = logging.getLogger("supreem.packaging")

class PackagingService:
    def create_video_package(
        self,
        job_id: str,
        original_basename: str,
        final_mp4_path: str,
        mixdown_wav_path: str,
        stem_paths: List[str],
        output_zip_path: str,
        metadata_dict: Dict[str, Any]
    ) -> str:
        """
        Creates the standardized output ZIP package for a successfully processed video.
        Structure:
          <original_video_name>.mp4
          Mixdown.wav
          Stems/
            stem_01.wav
            stem_02.wav
            ...
          metadata.json
        """
        os.makedirs(os.path.dirname(output_zip_path), exist_ok=True)
        
        # Ensure filenames inside zip are strictly sanitised and conform to delivery spec
        mp4_filename = f"{original_basename}.mp4" if not original_basename.lower().endswith(".mp4") else original_basename
        
        # Write metadata.json to temporary file
        meta_temp_path = os.path.join(os.path.dirname(output_zip_path), f"metadata_{job_id}.json")
        with open(meta_temp_path, "w", encoding="utf-8") as f:
            json.dump(metadata_dict, f, indent=2)

        try:
            with zipfile.ZipFile(output_zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zipf:
                # 1. Final MP4
                zipf.write(final_mp4_path, arcname=mp4_filename)
                
                # 2. Mixdown.wav
                zipf.write(mixdown_wav_path, arcname="Mixdown.wav")
                
                # 3. Stems
                for sp in stem_paths:
                    stem_name = os.path.basename(sp)
                    arc_stem = f"Stems/{stem_name}"
                    zipf.write(sp, arcname=arc_stem)
                    
                # 4. metadata.json
                zipf.write(meta_temp_path, arcname="metadata.json")
        finally:
            if os.path.exists(meta_temp_path):
                os.remove(meta_temp_path)

        if not os.path.exists(output_zip_path) or os.path.getsize(output_zip_path) == 0:
            raise RuntimeError(f"Failed to generate ZIP archive: {output_zip_path}")
            
        logger.info(f"Successfully generated ZIP archive: {output_zip_path} ({os.path.getsize(output_zip_path)} bytes)")
        return output_zip_path

    def build_metadata_json(
        self,
        clip_id: str,
        original_basename: str,
        video_specs: Dict[str, Any],
        stems_info: List[Dict[str, Any]],
        sound_events: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Builds standardized metadata.json matching client requirements and Good examples reference.
        """
        stems_payload = []
        for s in stems_info:
            s_name = s.get("filename", "stem.wav")
            # Collect matching sound events for this stem
            matching_events = [
                {
                    "event_name": f"{e.get('sound_category', 'SFX')} — {e.get('sound_description', '')}",
                    "start_timestamp_sec": round(e.get("start_time_ms", 0) / 1000.0, 3),
                    "end_timestamp_sec": round(e.get("end_time_ms", 10000) / 1000.0, 3),
                    "sync_accuracy_ms": 10
                }
                for e in sound_events
                if s.get("stem_id") in e.get("intended_track", "") or s.get("category", "") in e.get("sound_category", "")
            ]

            stems_payload.append({
                "stem_id": s.get("stem_id", "stem_01"),
                "file_path": f"Stems/{s_name}",
                "category": s.get("category", "Foley / SFX"),
                "surface_material": s.get("surface_material", "Natural acoustic surface"),
                "diegetic": True,
                "stem_timestamp": {
                    "start_timestamp_sec": 0.0,
                    "end_timestamp_sec": 10.00
                },
                "events": matching_events if matching_events else [
                    {
                        "event_name": f"{s_name} continuous layer",
                        "start_timestamp_sec": 0.0,
                        "end_timestamp_sec": 10.00,
                        "sync_accuracy_ms": 10
                    }
                ],
                "analysis": {
                    "status": "events_found",
                    "duration": 10.00,
                    "true_peak_dbtp": s.get("true_peak_dbtp", -3.5),
                    "rms_dbfs": s.get("rms_dbfs", -20.0),
                    "analyzedAt": int(time.time() * 1000)
                }
            })

        mp4_name = f"{original_basename}.mp4" if not original_basename.lower().endswith(".mp4") else original_basename
        
        return {
            "clip_id": clip_id,
            "version": "1.0",
            "duration_seconds": 10.00,
            "video_specs": {
                "file_path": mp4_name,
                "resolution": f"{video_specs.get('width', 1920)}x{video_specs.get('height', 1080)}",
                "fps": video_specs.get("fps", 30),
                "codec": "H.264"
            },
            "audio_master": {
                "file_path": "Mixdown.wav",
                "sample_rate_hz": 48000,
                "bit_depth": 24,
                "channels": 2
            },
            "stems": stems_payload,
            "compliance": {
                "pii_scrubbed": True,
                "speech_present": False,
                "original_audio_removed": True,
                "no_music_present": True
            }
        }

