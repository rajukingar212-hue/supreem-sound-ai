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
  AlertCircle,
  Loader2
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
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center p-16 space-y-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl">
        <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-500" />
        <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">Loading video sound design inspection details...</span>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-xl mx-auto p-12 text-center rounded-2xl bg-white dark:bg-[#111827] border border-rose-200 dark:border-red-500/30 space-y-4 shadow-sm dark:shadow-xl">
        <AlertCircle className="w-12 h-12 text-rose-500 dark:text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Video Job Not Found</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error || "Could not retrieve details for this job."}</p>
        <Link
          href="/"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-800 dark:text-white text-xs font-semibold transition-all"
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
      {/* Top Navigation & Breadcrumbs */}
      <div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
          <Link href="/" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-blue-600 dark:text-blue-400 font-medium truncate max-w-xs">{job.original_filename}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-gray-800 pb-5">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:bg-slate-200 dark:hover:bg-gray-800 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center space-x-3 flex-wrap gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{job.original_filename}</h1>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${isCompleted
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                    : isFailed
                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30"
                      : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30 animate-pulse"
                    }`}
                >
                  {job.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                Clip ID: <span className="font-mono text-slate-700 dark:text-gray-300">{job.id}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            {isFailed && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-500/20 transition-all"
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
                  className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-800 dark:text-gray-200 text-xs font-medium border border-slate-200 dark:border-gray-700 transition-all"
                >
                  <Volume2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Mixdown.wav</span>
                </a>

                <a
                  href={getZipDownloadUrl(job.id)}
                  download={`${job.original_basename}.zip`}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Delivery ZIP</span>
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm dark:shadow-xl">
          <span className="text-slate-500 dark:text-gray-400 block mb-1">Presentation Duration</span>
          <span className="text-lg font-bold text-slate-900 dark:text-white font-mono">
            {job.source_duration != null ? `${job.source_duration.toFixed(3)}s` : "10.000s"}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-gray-500 block mt-0.5">Strict client spec conformed</span>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm dark:shadow-xl">
          <span className="text-slate-500 dark:text-gray-400 block mb-1">Original Audio Status</span>
          <span
            className={`text-sm font-bold block ${job.has_original_audio ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-gray-300"
              }`}
          >
            {job.has_original_audio ? "Detected & Stripped" : "Silent (No Audio)"}
          </span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block mt-0.5 font-medium">
            {job.original_audio_removed ? "✓ Stripped with -an" : "N/A"}
          </span>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm dark:shadow-xl">
          <span className="text-slate-500 dark:text-gray-400 block mb-1">Independent Audio Stems</span>
          <span className="text-lg font-bold text-violet-600 dark:text-violet-400 font-mono">
            {job.stems?.length ?? 0} Stems
          </span>
          <span className="text-[11px] text-slate-400 dark:text-gray-500 block mt-0.5">24-bit / 48 kHz / Stereo</span>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm dark:shadow-xl">
          <span className="text-slate-500 dark:text-gray-400 block mb-1">Processing Time & Cost</span>
          <span className="text-base font-bold text-slate-800 dark:text-gray-200 font-mono">
            {job.processing_time_seconds != null ? `${job.processing_time_seconds}s` : "In Progress"}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-gray-500 block mt-0.5">
            Est. API Cost: {job.estimated_api_cost_usd != null ? `$${job.estimated_api_cost_usd.toFixed(4)}` : "Unavailable"}
          </span>
        </div>
      </div>

      {/* Main Video & Audio Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Final Conformed Video Player */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Final Output Video (H.264 + Conformed AAC)
            </h3>
            <span className="text-xs text-slate-500 dark:text-gray-400 font-mono">
              {job.source_resolution || "1920x1080"} @ 30fps
            </span>
          </div>

          <div className="aspect-video bg-black rounded-xl overflow-hidden border border-slate-200 dark:border-gray-800 flex items-center justify-center relative shadow-inner">
            {isCompleted ? (
              <video
                src={getVideoDownloadUrl(job.id)}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center p-6 space-y-2">
                <Film className="w-10 h-10 text-slate-400 dark:text-gray-600 mx-auto animate-pulse" />
                <p className="text-xs text-slate-500 dark:text-gray-400">Rendering video multiplex with Mixdown.wav...</p>
                <div className="w-48 bg-slate-200 dark:bg-gray-800 h-1.5 rounded-full mx-auto overflow-hidden">
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${job.progress_percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400 pt-3 border-t border-slate-100 dark:border-gray-800">
            <span>Video Codec: <strong className="text-slate-800 dark:text-gray-200">H.264</strong></span>
            <span>Presentation: <strong className="text-slate-800 dark:text-gray-200">10.000s</strong></span>
            <span>Audio: <strong className="text-slate-800 dark:text-gray-200">AAC 320k (Stereo)</strong></span>
          </div>
        </div>

        {/* Right: Original Audio Inspection Card */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <VolumeX className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Original Audio Stream Inspection
            </h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30">
              {job.original_audio_classification}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed">
            Prior to sound design generation, the source media was probed for existing audio.
            Default policy enforces complete removal of original audio to prevent music or voice leakage.
          </p>

          <div className="bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-800 rounded-xl p-4 space-y-3 text-xs">
            <div className="flex justify-between pb-2 border-b border-slate-200 dark:border-gray-800">
              <span className="text-slate-500 dark:text-gray-400">Original Audio Detected:</span>
              <strong className={job.has_original_audio ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-gray-400"}>
                {job.has_original_audio ? "Yes" : "No"}
              </strong>
            </div>

            <div className="flex justify-between pb-2 border-b border-slate-200 dark:border-gray-800">
              <span className="text-slate-500 dark:text-gray-400">Classified Content:</span>
              <strong className="text-slate-800 dark:text-gray-200">{job.original_audio_classification}</strong>
            </div>

            <div className="flex justify-between pb-2 border-b border-slate-200 dark:border-gray-800">
              <span className="text-slate-500 dark:text-gray-400">Removal Enforcement:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                ✓ Stripped via FFmpeg (-an)
              </span>
            </div>

            {job.audio_analysis_details?.features && (
              <div className="pt-2 text-[11px] text-slate-500 dark:text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>RMS Energy:</span>
                  <span className="font-mono text-slate-700 dark:text-gray-300">
                    {job.audio_analysis_details.features.rms_db != null ? `${job.audio_analysis_details.features.rms_db.toFixed(1)} dBFS` : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Spectral Centroid:</span>
                  <span className="font-mono text-slate-700 dark:text-gray-300">
                    {job.audio_analysis_details.features.spectral_centroid != null ? `${Math.round(job.audio_analysis_details.features.spectral_centroid)} Hz` : "N/A"}
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
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
              Gemini Visual Scene Analysis & Sound Event Plan
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              Synchronized acoustic event timeline conforming to non-vocal and non-music sound rules.
            </p>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20 self-start sm:self-center">
            {job.sound_events?.length ?? 0} Events Planned
          </span>
        </div>

        {job.sound_events && job.sound_events.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-gray-800 border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {job.sound_events.map((ev) => (
              <div key={ev.event_id} className="p-4 bg-slate-50/50 dark:bg-gray-900/40 hover:bg-slate-100/70 dark:hover:bg-gray-900/70 transition-all text-xs space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-transparent font-semibold">
                      {(ev.start_time_ms / 1000).toFixed(2)}s – {(ev.end_time_ms / 1000).toFixed(2)}s
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-gray-200">{ev.sound_category}</span>
                    <span className="text-slate-400 dark:text-gray-500">•</span>
                    <span className="text-violet-600 dark:text-violet-400 font-mono text-[11px]">{ev.intended_track}</span>
                  </div>

                  <div className="flex items-center space-x-3 text-slate-500 dark:text-gray-400 text-[11px]">
                    <span>Gain: <strong className="text-slate-800 dark:text-gray-200 font-mono">{ev.suggested_gain_db} dB</strong></span>
                    <span>Distance: <strong className="text-slate-800 dark:text-gray-200">{ev.estimated_distance}</strong></span>
                  </div>
                </div>

                <p className="text-slate-700 dark:text-gray-300 leading-relaxed">
                  <strong className="text-slate-500 dark:text-gray-400">Visual Cue:</strong> {ev.visual_action}
                </p>
                <p className="text-slate-500 dark:text-gray-400 text-[11px]">
                  <strong className="text-slate-400 dark:text-gray-500">Acoustic Description:</strong> {ev.sound_description}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 dark:text-gray-500 text-xs border border-dashed border-slate-300 dark:border-gray-800 rounded-xl">
            Visual analysis in progress...
          </div>
        )}
      </div>

      {/* QC Audit Card */}
      {job.qc_result && <QCReportCard qc={job.qc_result} />}
    </div>
  );
}

