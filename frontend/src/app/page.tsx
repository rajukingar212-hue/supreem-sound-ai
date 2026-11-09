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
  Play,
  ArrowRight,
  TrendingUp,
  Activity,
  VolumeX,
  Volume2
} from "lucide-react";
import { fetchStats } from "@/lib/api";
import { DashboardStats } from "@/lib/types";
import BatchUploader from "@/components/BatchUploader";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await fetchStats();
      setStats(data);
    } catch (e) {
      console.error("Failed to load dashboard stats", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Audio Post-Production Console
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Automated video sound design, original audio removal, and stem generation.
          </p>
        </div>

        <Link
          href="/upload"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 transition-all"
        >
          <span>Upload New Batch</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium">Total Ingested</span>
            <Film className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {stats?.total_uploaded_videos ?? 0}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Conformed to 10.0s timeline</p>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium">Original Audio Detected</span>
            <Volume2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {stats?.videos_with_original_audio ?? 0}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            {stats?.videos_without_original_audio ?? 0} silent inputs
          </p>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium">Completed & Validated</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {stats?.completed_videos ?? 0}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">100% automated QC passed</p>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium">Failed / In Review</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400 font-mono">
            {stats?.failed_videos ?? 0}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Requires user attention</p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400 block mb-1">Detected Music Streams</span>
            <span className="text-lg font-bold text-gray-200 font-mono">
              {stats?.videos_with_detected_music ?? 0}
            </span>
            <span className="text-[11px] text-gray-500 block">Stripped before new sound design</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Music className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400 block mb-1">Average Processing Time</span>
            <span className="text-lg font-bold text-gray-200 font-mono">
              {stats?.average_processing_time_seconds ?? 0}s
            </span>
            <span className="text-[11px] text-gray-500 block">End-to-end per 10s video</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400 block mb-1">Estimated AI Cost</span>
            <span className="text-lg font-bold text-gray-200 font-mono">
              ${stats?.total_api_cost_usd?.toFixed(4) ?? "0.0000"}
            </span>
            <span className="text-[11px] text-gray-500 block">Gemini Vision + ElevenLabs SFX</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Action Section: Quick Uploader */}
      <BatchUploader onUploaded={loadData} />

      {/* Live Activity Stream */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Live Processing Queue & Recent Videos
            </h3>
            <p className="text-xs text-gray-400">Real-time status of ingested and processing videos.</p>
          </div>

          <Link href="/batches" className="text-xs text-blue-400 hover:underline">
            View All Batches →
          </Link>
        </div>

        {stats?.recent_activity && stats.recent_activity.length > 0 ? (
          <div className="divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden">
            {stats.recent_activity.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-gray-900/40 hover:bg-gray-900/80 transition-all flex items-center justify-between text-xs"
              >
                <div className="space-y-1 truncate max-w-md">
                  <div className="flex items-center space-x-2 truncate">
                    <Film className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="font-semibold text-gray-200 truncate">{item.filename}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-gray-400">
                    <span>
                      Audio:{" "}
                      <strong className={item.has_audio ? "text-amber-400" : "text-gray-400"}>
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
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : item.status === "Failed"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse"
                    }`}
                  >
                    {item.status} ({item.progress}%)
                  </span>

                  <Link
                    href={`/jobs/${item.id}`}
                    className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium"
                  >
                    Inspect
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 text-xs border border-dashed border-gray-800 rounded-xl">
            No video jobs processed yet. Drag & drop videos above to start automatic processing.
          </div>
        )}
      </div>
    </div>
  );
}

