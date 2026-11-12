"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { DollarSign, Sparkles, Activity, Layers, Clock, AlertTriangle, RefreshCw, Database } from "lucide-react";
import { fetchStats } from "@/lib/api";
import { DashboardStats } from "@/lib/types";

export default function UsagePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStats();
      setStats(data);
    } catch (e: any) {
      console.error("Failed to load usage & cost data:", e);
      setError(e.message || "Failed to load usage & cost data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const hasCost = Boolean(stats?.cost_available && stats?.total_api_cost_usd !== null && stats?.total_api_cost_usd !== undefined);
  const costFormatted = hasCost ? `$${stats!.total_api_cost_usd!.toFixed(4)}` : "Unavailable";
  const costPerVideo = hasCost && stats?.total_uploaded_videos && stats.total_uploaded_videos > 0
    ? `$${(stats.total_api_cost_usd! / stats.total_uploaded_videos).toFixed(4)}`
    : "Unavailable";
  const avgTimeFormatted = stats?.average_processing_time_seconds !== null && stats?.average_processing_time_seconds !== undefined
    ? `${stats.average_processing_time_seconds.toFixed(2)}s`
    : "N/A";

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header & Breadcrumb */}
      <div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
          <Link href="/" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-blue-600 dark:text-blue-400 font-medium">Usage & Cost Tracking</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /> API Usage & Cost Tracking
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Real database analytics for token consumption, sound generation characters, and provider expenditure.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs self-start sm:self-center">
            <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 font-medium">
              <Database className="w-3.5 h-3.5" />
              <span>Database Connected</span>
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 dark:bg-red-950/40 dark:border-red-800/80 rounded-xl text-xs text-rose-800 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1 bg-white hover:bg-slate-100 dark:bg-red-900/60 dark:hover:bg-red-800 text-rose-800 dark:text-red-200 rounded-lg text-xs font-semibold flex items-center space-x-1 border border-rose-200 dark:border-transparent transition-all shadow-sm"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm dark:shadow-xl">
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 mb-2">
            <span className="text-xs font-semibold">Total Measured Cost</span>
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className={`text-3xl font-bold font-mono ${hasCost ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-gray-400 text-2xl"}`}>
            {costFormatted}
          </div>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-2">
            {hasCost ? "Summed from actual recorded provider calls" : "Usage data not recorded (offline fallback used)"}
          </p>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm dark:shadow-xl">
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 mb-2">
            <span className="text-xs font-semibold">Cost Per Video</span>
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className={`text-3xl font-bold font-mono ${hasCost ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-gray-400 text-2xl"}`}>
            {costPerVideo}
          </div>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-2">
            {hasCost ? "Actual average per completed video" : "Unavailable until real provider calls occur"}
          </p>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm dark:shadow-xl">
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 mb-2">
            <span className="text-xs font-semibold">Average Processing Time</span>
            <Clock className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-3xl font-bold text-violet-600 dark:text-violet-400 font-mono">
            {avgTimeFormatted}
          </div>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-2">
            {stats?.average_processing_time_seconds !== null ? "Average of completed jobs" : "No completed jobs recorded yet"}
          </p>
        </div>
      </div>

      {/* Pricing Schedule Reference Card */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Provider Cost Breakdown Reference</h3>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
            Official API pricing schedules used when calculating provider expenditure:
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-800 text-xs">
          <table className="w-full text-left text-slate-700 dark:text-gray-300">
            <thead className="bg-slate-50 dark:bg-gray-900/80 text-slate-600 dark:text-gray-400 font-medium">
              <tr>
                <th className="p-3">Provider</th>
                <th className="p-3">Operation</th>
                <th className="p-3">Model</th>
                <th className="p-3">Standard Schedule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-gray-900/40">
              <tr className="hover:bg-slate-50/80 dark:hover:bg-gray-800/40 transition-colors">
                <td className="p-3 font-semibold text-blue-600 dark:text-blue-400">Google Gemini</td>
                <td className="p-3">Visual Scene Understanding</td>
                <td className="p-3 font-mono">gemini-2.5-flash</td>
                <td className="p-3 font-mono">$0.075 / 1M input tokens</td>
              </tr>
              <tr className="hover:bg-slate-50/80 dark:hover:bg-gray-800/40 transition-colors">
                <td className="p-3 font-semibold text-violet-600 dark:text-violet-400">ElevenLabs</td>
                <td className="p-3">Sound Effects Synthesis</td>
                <td className="p-3 font-mono">sound-generation</td>
                <td className="p-3 font-mono">Standard character tier quota</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
