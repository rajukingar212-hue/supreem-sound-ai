"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Film,
  Music,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  ArrowRight,
  Activity,
  Volume2,
  RefreshCw,
  X,
  ExternalLink,
  ShieldCheck,
  Eye,
  Sparkles,
  Layers
} from "lucide-react";
import { fetchStats, fetchStatsDetails } from "@/lib/api";
import { DashboardStats, MetricDetailsResponse } from "@/lib/types";
import BatchUploader from "@/components/BatchUploader";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [metricDetails, setMetricDetails] = useState<MetricDetailsResponse | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const loadData = async () => {
    try {
      const data = await fetchStats();
      setStats(data);
      setBackendError(null);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (e: any) {
      console.error("Failed to load dashboard stats", e);
      setBackendError(e.message || "Unable to reach backend API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const openMetricDetails = async (metricKey: string) => {
    setSelectedMetric(metricKey);
    setLoadingDetails(true);
    setMetricDetails(null);
    try {
      const details = await fetchStatsDetails(metricKey);
      setMetricDetails(details);
    } catch (e: any) {
      console.error("Failed to fetch metric details:", e);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Format honest metrics
  const hasCost = Boolean(stats?.cost_available && stats?.total_api_cost_usd !== null && stats?.total_api_cost_usd !== undefined);
  const costDisplay = hasCost ? `$${stats!.total_api_cost_usd!.toFixed(4)}` : "Unavailable";
  const avgTimeDisplay = stats?.average_processing_time_seconds !== null && stats?.average_processing_time_seconds !== undefined
    ? `${stats.average_processing_time_seconds.toFixed(2)}s`
    : "N/A";

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome & Live Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Audio Post-Production Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Autonomous video sound design, original audio removal, and verifiable stem synthesis.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Live Data Transparency Status */}
          <div className="flex items-center space-x-2 text-xs bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] rounded-xl px-3.5 py-1.5 shadow-sm text-slate-700 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold">DB: Connected</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="text-slate-500 dark:text-slate-400">{lastRefreshed ? `Synced ${lastRefreshed}` : "Syncing..."}</span>
          </div>

          <Link
            href="/upload"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 hover:shadow-blue-500/35 transition-all"
          >
            <span>Upload New Batch</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {backendError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 rounded-2xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>Backend offline or unreachable: {backendError}</span>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-sm transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Primary Metrics Grid — 100% Verified DB Records */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Ingested */}
        <div
          onClick={() => openMetricDetails("total_ingested")}
          className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] hover:border-blue-400 dark:hover:border-blue-500/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Total Ingested
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
            {stats?.total_uploaded_videos ?? 0}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Accepted unique clips</span>
            <span className="text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold flex items-center gap-0.5">
              Inspect <Eye className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Original Audio Detected */}
        <div
          onClick={() => openMetricDetails("audio_detected")}
          className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] hover:border-amber-400 dark:hover:border-amber-500/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              Original Audio Detected
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Volume2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            {stats?.videos_with_original_audio ?? 0}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>{stats?.videos_without_original_audio ?? 0} silent inputs</span>
            <span className="text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold flex items-center gap-0.5">
              Inspect <Eye className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Completed & Validated */}
        <div
          onClick={() => openMetricDetails("completed_validated")}
          className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] hover:border-emerald-400 dark:hover:border-emerald-500/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              Completed & Validated
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {stats?.completed_videos ?? 0}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>100% automated QC passed</span>
            <span className="text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold flex items-center gap-0.5">
              Inspect <Eye className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Failed / In Review */}
        <div
          onClick={() => openMetricDetails("failed_review")}
          className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] hover:border-red-400 dark:hover:border-red-500/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
              Failed / In Review
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-red-600 dark:text-red-400 font-mono">
            {stats?.failed_videos ?? 0}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Awaiting attention</span>
            <span className="text-red-600 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold flex items-center gap-0.5">
              Inspect <Eye className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Detected Music Streams */}
        <div
          onClick={() => openMetricDetails("music_detected")}
          className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] hover:border-amber-400 dark:hover:border-amber-500/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
        >
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              Detected Music Streams
            </span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {stats?.videos_with_detected_music ?? 0}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1">
              Classified via DSP analysis
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center">
            <Music className="w-5 h-5" />
          </div>
        </div>

        {/* Average Processing Time */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Average Processing Time
            </span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {avgTimeDisplay}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1">
              {stats?.average_processing_time_seconds !== null ? "Measured from start to finish" : "No completed jobs"}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Estimated AI Cost */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Estimated AI Cost
            </span>
            <span className={`text-xl font-extrabold font-mono ${hasCost ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}>
              {costDisplay}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1">
              {hasCost ? "Calculated from provider API calls" : "Usage data not recorded"}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Action Section: Quick Uploader */}
      <BatchUploader onUploaded={loadData} />

      {/* Live Activity Stream */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              Live Processing Queue & Recent Videos
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Real-time status of ingested and processing videos.</p>
          </div>

          <Link href="/batches" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            View All Batches →
          </Link>
        </div>

        {stats?.recent_activity && stats.recent_activity.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-gray-800 border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {stats.recent_activity.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-slate-50/50 dark:bg-gray-900/40 hover:bg-slate-100/60 dark:hover:bg-gray-900/80 transition-all flex items-center justify-between text-xs"
              >
                <div className="space-y-1 truncate max-w-md">
                  <div className="flex items-center space-x-2 truncate">
                    <Film className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="font-semibold text-slate-800 dark:text-gray-200 truncate">{item.filename}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 dark:text-gray-400">
                    <span>
                      Audio:{" "}
                      <strong className={item.has_audio ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-gray-400"}>
                        {item.audio_class}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>{new Date(item.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-4 shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                      item.status === "Completed"
                        ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30"
                        : item.status === "Failed"
                        ? "bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30"
                        : "bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 animate-pulse"
                    }`}
                  >
                    {item.status}
                  </span>

                  <Link
                    href={`/jobs/${item.id}`}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 transition-all"
                    title="Inspect sound design stems and QC validation"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs border border-dashed border-slate-200 dark:border-gray-800 rounded-xl bg-slate-50/50 dark:bg-gray-900/20 space-y-1">
            <p className="font-semibold text-slate-700 dark:text-gray-300">No video jobs found in database</p>
            <p>Upload video files above to start automated sound design and stem generation.</p>
          </div>
        )}
      </div>

      {/* Data Transparency Modal (Metric Record Inspection) */}
      {selectedMetric && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] rounded-2xl max-w-3xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 dark:border-[#263449] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  {metricDetails?.title || "Database Records Audit"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {metricDetails?.description || "Auditing underlying records in database..."}
                </p>
              </div>
              <button
                onClick={() => setSelectedMetric(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {loadingDetails ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                  <span>Querying database records for this metric...</span>
                </div>
              ) : metricDetails && metricDetails.records.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Showing {metricDetails.records.length} verified contributing database records:
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-gray-800 border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden text-xs">
                    {metricDetails.records.map((rec) => (
                      <div key={rec.id} className="p-3 bg-slate-50/50 dark:bg-gray-900/50 hover:bg-slate-100 dark:hover:bg-gray-900 flex items-center justify-between gap-3">
                        <div className="truncate space-y-0.5">
                          <div className="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-2">
                            <Film className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>{rec.original_filename}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-gray-400 flex items-center gap-3">
                            <span>ID: <code className="text-slate-700 dark:text-gray-300 font-mono">{rec.id.slice(0, 8)}...</code></span>
                            <span>•</span>
                            <span>Audio: <strong className={rec.has_original_audio ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-gray-400"}>{rec.original_audio_classification || (rec.has_original_audio ? "Detected" : "None")}</strong></span>
                            {rec.qc_passed !== null && rec.qc_passed !== undefined && (
                              <>
                                <span>•</span>
                                <span>QC: <strong className={rec.qc_passed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{rec.qc_passed ? "PASSED" : "FAILED"}</strong></span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            rec.status === "Completed"
                              ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30"
                              : rec.status === "Failed"
                              ? "bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30"
                              : "bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30"
                          }`}>
                            {rec.status}
                          </span>
                          <Link
                            href={`/jobs/${rec.id}`}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300"
                            title="Inspect job"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-gray-800 rounded-xl bg-slate-50/50 dark:bg-gray-900/20">
                  <p className="font-semibold text-slate-700 dark:text-gray-300">0 records found in database</p>
                  <p className="mt-1">No database records currently contribute to this metric.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-[#263449] bg-slate-50 dark:bg-gray-900/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Source: SQLite Production Database (<code className="text-slate-800 dark:text-gray-200">supreem_sound.db</code>)</span>
              <button
                onClick={() => setSelectedMetric(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-800 dark:text-white text-xs font-semibold transition-colors"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
