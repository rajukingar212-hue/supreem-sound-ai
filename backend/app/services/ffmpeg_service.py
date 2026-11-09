import os
import sys
import json
import shutil
import subprocess
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List

logger = logging.getLogger("supreem.ffmpeg")

def get_ffmpeg_paths() -> Tuple[str, str]:
    """Find ffmpeg and ffprobe executables on system or via static_ffmpeg."""
    ffmpeg_exe = shutil.which("ffmpeg")
    ffprobe_exe = shutil.which("ffprobe")
    
    if not ffmpeg_exe or not ffprobe_exe:
        try:
            import static_ffmpeg
            static_ffmpeg.add_paths()
            ffmpeg_exe = shutil.which("ffmpeg")
            ffprobe_exe = shutil.which("ffprobe")
        except Exception as e:
            logger.warning(f"Failed to load static_ffmpeg: {e}")
            
    if not ffmpeg_exe:
        raise RuntimeError("FFmpeg executable not found. Ensure FFmpeg is installed and added to PATH.")
    if not ffprobe_exe:
        raise RuntimeError("FFprobe executable not found. Ensure FFprobe is installed and added to PATH.")
        
    return ffmpeg_exe, ffprobe_exe

class FFmpegService:
    def __init__(self):
        self.ffmpeg_path, self.ffprobe_path = get_ffmpeg_paths()

    def probe(self, file_path: str) -> Dict[str, Any]:
        """Run ffprobe with JSON output to inspect container and stream details."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        cmd = [
            self.ffprobe_path,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            file_path
        ]
        
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
        if result.returncode != 0:
            raise RuntimeError(f"FFprobe failed on {file_path}: {result.stderr}")
            
        try:
            data = json.loads(result.stdout)
            return data
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Failed to parse FFprobe JSON: {e}")

    def inspect_media(self, file_path: str) -> Dict[str, Any]:
        """High-level inspection of video and audio streams."""
        probe_data = self.probe(file_path)
        streams = probe_data.get("streams", [])
        fmt = probe_data.get("format", {})
        
        video_streams = [s for s in streams if s.get("codec_type") == "video"]
        audio_streams = [s for s in streams if s.get("codec_type") == "audio"]
        
        has_video = len(video_streams) > 0
        has_audio = len(audio_streams) > 0
        
        video_info = {}
        if has_video:
            vs = video_streams[0]
            # Calculate FPS
            fps = 30.0
            r_frame_rate = vs.get("r_frame_rate", "30/1")
            if "/" in r_frame_rate:
                num, den = r_frame_rate.split("/")
                if float(den) > 0:
                    fps = round(float(num) / float(den), 3)
            elif r_frame_rate:
                fps = round(float(r_frame_rate), 3)
                
            video_info = {
                "width": int(vs.get("width", 0)),
                "height": int(vs.get("height", 0)),
                "codec": vs.get("codec_name", "unknown"),
                "fps": fps,
                "duration": float(vs.get("duration") or fmt.get("duration", 0.0)),
                "bitrate": int(vs.get("bit_rate") or fmt.get("bit_rate", 0)),
                "pix_fmt": vs.get("pix_fmt", "yuv420p")
            }
            
        audio_info_list = []
        for s in audio_streams:
            audio_info_list.append({
                "stream_index": int(s.get("index", 0)),
                "codec": s.get("codec_name", "unknown"),
                "sample_rate": int(s.get("sample_rate", 48000)),
                "channels": int(s.get("channels", 2)),
                "bitrate": int(s.get("bit_rate", 0)) if s.get("bit_rate") else None,
                "duration": float(s.get("duration") or fmt.get("duration", 0.0)),
                "start_time": float(s.get("start_time", 0.0))
            })
            
        return {
            "file_path": file_path,
            "container_format": fmt.get("format_name", ""),
            "duration": float(fmt.get("duration", 0.0)),
            "size_bytes": int(fmt.get("size", os.path.getsize(file_path))),
            "has_video": has_video,
            "has_audio": has_audio,
            "audio_stream_count": len(audio_streams),
            "video": video_info,
            "audio_streams": audio_info_list
        }

    def extract_audio(self, video_path: str, output_wav_path: str, sample_rate: int = 48000) -> str:
        """Extract first audio stream from video to a standardized WAV file for classification."""
        os.makedirs(os.path.dirname(output_wav_path), exist_ok=True)
        cmd = [
            self.ffmpeg_path,
            "-y",
            "-i", video_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", str(sample_rate),
            "-ac", "2",
            output_wav_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
        if res.returncode != 0:
            raise RuntimeError(f"Failed to extract audio from {video_path}: {res.stderr}")
        return output_wav_path

    def strip_audio_from_video(self, input_video_path: str, output_video_path: str) -> str:
        """Completely strip all audio streams from video using -an (zero audio leak)."""
        os.makedirs(os.path.dirname(output_video_path), exist_ok=True)
        cmd = [
            self.ffmpeg_path,
            "-y",
            "-i", input_video_path,
            "-an",
            "-c:v", "copy",
            output_video_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
        if res.returncode != 0:
            # Fallback with re-encode if copy fails
            cmd = [
                self.ffmpeg_path,
                "-y",
                "-i", input_video_path,
                "-an",
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                output_video_path
            ]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
            if res.returncode != 0:
                raise RuntimeError(f"Failed to strip audio from video: {res.stderr}")
                
        # Validate that output video has zero audio streams
        check = self.inspect_media(output_video_path)
        if check["has_audio"]:
            raise RuntimeError(f"Audio strip failure: {output_video_path} still contains audio streams!")
            
        return output_video_path

    def render_final_video(
        self,
        video_source_path: str,
        audio_mixdown_path: str,
        output_mp4_path: str,
        target_duration: float = 10.0,
        target_fps: int = 30
    ) -> str:
        """
        Multiplex visual video with newly created Mixdown.wav.
        Enforces exact 10.000s duration, constant frame rate (H.264), and stereo AAC audio.
        Guarantees original audio is absent.
        """
        os.makedirs(os.path.dirname(output_mp4_path), exist_ok=True)
        
        # Check source video duration
        meta = self.inspect_media(video_source_path)
        source_dur = meta["duration"]
        
        # Video filter: trim or pad to exact 10.000s, conform to target fps and yuv420p
        # If video is shorter than 10.0s, loop or extend last frame with tpad
        vf = f"fps={target_fps},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p"
        if source_dur < target_duration:
            pad_dur = target_duration - source_dur
            vf += f",tpad=stop_mode=clone:stop_duration={pad_dur:.3f}"
        
        cmd = [
            self.ffmpeg_path,
            "-y",
            "-ss", "0.0",
            "-t", f"{target_duration:.3f}",
            "-i", video_source_path,
            "-ss", "0.0",
            "-t", f"{target_duration:.3f}",
            "-i", audio_mixdown_path,
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-vf", vf,
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "18",
            "-c:a", "aac",
            "-b:a", "320k",
            "-ar", "48000",
            "-ac", "2",
            "-shortest",
            "-movflags", "+faststart",
            output_mp4_path
        ]
        
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
        if res.returncode != 0:
            raise RuntimeError(f"Final video multiplexing failed: {res.stderr}")
            
        # Verify rendered MP4 specs
        out_meta = self.inspect_media(output_mp4_path)
        if not out_meta["has_video"] or not out_meta["has_audio"]:
            raise RuntimeError("Final MP4 is missing video or audio stream!")
        if out_meta["video"]["codec"] != "h264":
            raise RuntimeError(f"Expected H.264 video codec, got {out_meta['video']['codec']}")
        if out_meta["audio_streams"][0]["codec"] != "aac":
            raise RuntimeError(f"Expected AAC audio codec, got {out_meta['audio_streams'][0]['codec']}")
        if abs(out_meta["duration"] - target_duration) > 0.15:
            logger.warning(f"Rendered video duration {out_meta['duration']}s slightly deviates from {target_duration}s")
            
        return output_mp4_path

    def extract_keyframes(self, video_path: str, output_dir: str, num_frames: int = 10) -> List[str]:
        """Extract evenly distributed keyframes across the 10s video for visual analysis."""
        os.makedirs(output_dir, exist_ok=True)
        meta = self.inspect_media(video_path)
        duration = max(1.0, meta["duration"])
        interval = duration / (num_frames + 1)
        
        frame_paths = []
        for i in range(1, num_frames + 1):
            timestamp = i * interval
            frame_path = os.path.join(output_dir, f"frame_{i:02d}.jpg")
            cmd = [
                self.ffmpeg_path,
                "-y",
                "-ss", f"{timestamp:.3f}",
                "-i", video_path,
                "-vframes", "1",
                "-q:v", "2",
                frame_path
            ]
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
            if os.path.exists(frame_path) and os.path.getsize(frame_path) > 0:
                frame_paths.append(frame_path)
                
        return frame_paths

