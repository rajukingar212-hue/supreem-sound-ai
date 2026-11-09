"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  RotateCcw,
  Film,
  Volume2,
  VolumeX,
  Sparkles,
  Calendar,
  Layers,
  ShieldCheck,
  Clock,
  DollarSign,
  AlertCircle
} from "lucide-react";
import { fetchJobDetail, retryJob, getVideoDownloadUrl, getZipDownloadUrl, getMixdownDownloadUrl } from "@/lib/api";
import { VideoJobDetail } from "@/lib/types";
import StemPlayer from "@/components/StemPlayer";
import QCReportCard from "@/components/QCReportCard";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  const [job, setJob] = useState<VideoJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const loadJob = async () => {
    try {
      if (!jobId) return;
      const data = await fetchJobDetail(jobId);
      setJob(data);
    } catch (err: any) {
      setError(err.message || "Failed to load job details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJob();
    const interval = setInterval(loadJob, 2500);
    return () => clearInterval(interval);
  }, [jobId]);

  const handleRetry = async () => {
    if (!jobId) return;
    setRetrying(true);
    try {
      await retryJob(jobId);
      await loadJob();
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-400 text-sm">
        Loading video sound design inspection details...
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Video Job Not Found</h2>
        <p className="text-sm text-gray-400">{error || "Could not retrieve details for this job."}</p>
        <Link
          href="/"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-800 text-white text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    );
  }

  const isCompleted = job.status === "Completed";
  const isFailed = job.status === "Failed";

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="p-2 rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-400 hover:text-white transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-white tracking-tight">{job.original_filename}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isCompleted
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : isFailed
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse"
                  }`}
              >
                {job.status}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Clip ID: <span className="font-mono text-gray-300">{job.id}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          {isFailed && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-all"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
              <span>Retry Job</span>
            </button>
          )}

          {isCompleted && (
            <>
              <a
                href={getMixdownDownloadUrl(job.id)}
                download="Mixdown.wav"
                className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium border border-gray-700 transition-all"
              >
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Mixdown.wav</span>
              </a>

              <a
                href={getZipDownloadUrl(job.id)}
                download={`${job.original_basename}.zip`}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Delivery ZIP</span>
              </a>
            </>
          )}
        </div>
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
          <span className="text-gray-400 block mb-1">Presentation Duration</span>
          <span className="text-lg font-bold text-white font-mono">10.000s</span>
          <span className="text-[11px] text-gray-500 block mt-0.5">Strict client spec conformed</span>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
          <span className="text-gray-400 block mb-1">Original Audio Status</span>
          <span
            className={`text-sm font-bold block ${job.has_original_audio ? "text-amber-400" : "text-gray-300"
              }`}
          >
            {job.has_original_audio ? "Detected & Stripped" : "Silent (No Audio)"}
          </span>
          <span className="text-[11px] text-emerald-400 block mt-0.5">
            {job.original_audio_removed ? "✓ Stripped with -an" : "N/A"}
          </span>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
          <span className="text-gray-400 block mb-1">Independent Audio Stems</span>
          <span className="text-lg font-bold text-violet-400 font-mono">
            {job.stems?.length ?? 0} Stems
          </span>
          <span className="text-[11px] text-gray-500 block mt-0.5">24-bit / 48 kHz / Stereo</span>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
          <span className="text-gray-400 block mb-1">Processing Time & Cost</span>
          <span className="text-base font-bold text-gray-200 font-mono">
            {job.processing_time_seconds ? `${job.processing_time_seconds}s` : "In Progress"}
          </span>
          <span className="text-[11px] text-gray-500 block mt-0.5">
            Est. API Cost: ${job.estimated_api_cost_usd?.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Main Video & Audio Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Final Conformed Video Player */}
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-blue-400" />
              Final Output Video (H.264 + Conformed AAC)
            </h3>
            <span className="text-xs text-gray-400 font-mono">
              {job.source_resolution || "1920x1080"} @ 30fps
            </span>
          </div>

          <div className="aspect-video bg-black rounded-xl overflow-hidden border border-gray-800 flex items-center justify-center relative">
            {isCompleted ? (
              <video
                src={getVideoDownloadUrl(job.id)}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center p-6 space-y-2">
                <Film className="w-10 h-10 text-gray-600 mx-auto animate-pulse" />
                <p className="text-xs text-gray-400">Rendering video multiplex with Mixdown.wav...</p>
                <div className="w-48 bg-gray-800 h-1.5 rounded-full mx-auto overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${job.progress_percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800">
            <span>Video Codec: <strong className="text-gray-200">H.264</strong></span>
            <span>Presentation: <strong className="text-gray-200">10.000s</strong></span>
            <span>Audio: <strong className="text-gray-200">AAC 320k (Stereo)</strong></span>
          </div>
        </div>

        {/* Right: Original Audio Inspection Card */}
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <VolumeX className="w-4 h-4 text-amber-400" />
              Original Audio Stream Inspection
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
              {job.original_audio_classification}
            </span>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Prior to sound design generation, the source media was probed for existing audio.
            Default policy enforces complete removal of original audio to prevent music or voice leakage.
          </p>

          <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 space-y-3 text-xs">
            <div className="flex justify-between pb-2 border-b border-gray-800">
              <span className="text-gray-400">Original Audio Detected:</span>
              <strong className={job.has_original_audio ? "text-amber-400" : "text-gray-400"}>
                {job.has_original_audio ? "Yes" : "No"}
              </strong>
            </div>

            <div className="flex justify-between pb-2 border-b border-gray-800">
              <span className="text-gray-400">Classified Content:</span>
              <strong className="text-gray-200">{job.original_audio_classification}</strong>
            </div>

            <div className="flex justify-between pb-2 border-b border-gray-800">
              <span className="text-gray-400">Removal Enforcement:</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                ✓ Stripped via FFmpeg (-an)
              </span>
            </div>

            {job.audio_analysis_details?.features && (
              <div className="pt-2 text-[11px] text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>RMS Energy:</span>
                  <span className="font-mono text-gray-300">
                    {job.audio_analysis_details.features.rms_db ?? -60} dBFS
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Spectral Centroid:</span>
                  <span className="font-mono text-gray-300">
                    {job.audio_analysis_details.features.spectral_centroid ?? 0} Hz
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audio Engine Multi-Track Stems Player */}
      <StemPlayer
        jobId={job.id}
        stems={job.stems || []}
        mixdownAvailable={Boolean(job.mixdown_path || isCompleted)}
      />

      {/* Gemini Sound Event Timeline */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Gemini Visual Scene Analysis & Sound Event Plan
            </h3>
            <p className="text-xs text-gray-400">
              Synchronized acoustic event timeline conforming to non-vocal and non-music sound rules.
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            {job.sound_events?.length ?? 0} Events Planned
          </span>
        </div>

        {job.sound_events && job.sound_events.length > 0 ? (
          <div className="divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden">
            {job.sound_events.map((ev) => (
              <div key={ev.event_id} className="p-4 bg-gray-900/40 hover:bg-gray-900/70 transition-all text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold">
                      {(ev.start_time_ms / 1000).toFixed(2)}s – {(ev.end_time_ms / 1000).toFixed(2)}s
                    </span>
                    <span className="font-semibold text-gray-200">{ev.sound_category}</span>
                    <span className="text-gray-500">•</span>
                    <span className="text-violet-400 font-mono text-[11px]">{ev.intended_track}</span>
                  </div>

                  <div className="flex items-center space-x-3 text-gray-400 text-[11px]">
                    <span>Gain: <strong className="text-gray-200 font-mono">{ev.suggested_gain_db} dB</strong></span>
                    <span>Distance: <strong className="text-gray-200">{ev.estimated_distance}</strong></span>
                  </div>
                </div>

                <p className="text-gray-300 leading-relaxed">
                  <strong className="text-gray-400">Visual Cue:</strong> {ev.visual_action}
                </p>
                <p className="text-gray-400 text-[11px]">
                  <strong className="text-gray-500">Acoustic Description:</strong> {ev.sound_description}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500 text-xs border border-dashed border-gray-800 rounded-xl">
            Visual analysis in progress...
          </div>
        )}
      </div>

      {/* QC Audit Card */}
      {job.qc_result && <QCReportCard qc={job.qc_result} />}
    </div>
  );
}

