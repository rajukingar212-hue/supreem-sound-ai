"use client";

import React, { useEffect, useState } from "react";
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
      console.error(e);
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">API Usage & Cost Tracking</h1>
          <p className="text-sm text-gray-400 mt-1">
            Real database analytics for token consumption, sound generation characters, and provider expenditure.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Database className="w-3 h-3" />
            <span>Database Connected</span>
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-950/40 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800 text-red-200 rounded-lg text-xs font-semibold flex items-center space-x-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold">Total Measured Cost</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className={`text-3xl font-bold font-mono ${hasCost ? "text-emerald-400" : "text-gray-400 text-2xl"}`}>
            {costFormatted}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {hasCost ? "Summed from actual recorded provider calls" : "Usage data not recorded (offline fallback used)"}
          </p>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold">Cost Per Video</span>
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div className={`text-3xl font-bold font-mono ${hasCost ? "text-white" : "text-gray-400 text-2xl"}`}>
            {costPerVideo}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {hasCost ? "Actual average per completed video" : "Unavailable until real provider calls occur"}
          </p>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold">Average Processing Time</span>
            <Clock className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-3xl font-bold text-violet-400 font-mono">
            {avgTimeFormatted}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {stats?.average_processing_time_seconds !== null ? "Average of completed jobs" : "No completed jobs recorded yet"}
          </p>
        </div>
      </div>

      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-semibold text-white">Provider Cost Breakdown Reference</h3>
        <p className="text-xs text-gray-400">
          Official API pricing schedules used when calculating provider expenditure:
        </p>
        <div className="overflow-x-auto rounded-xl border border-gray-800 text-xs">
          <table className="w-full text-left text-gray-300">
            <thead className="bg-gray-900/80 text-gray-400 font-medium">
              <tr>
                <th className="p-3">Provider</th>
                <th className="p-3">Operation</th>
                <th className="p-3">Model</th>
                <th className="p-3">Standard Schedule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/40">
              <tr>
                <td className="p-3 font-semibold text-blue-400">Google Gemini</td>
                <td className="p-3">Visual Scene Understanding</td>
                <td className="p-3 font-mono">gemini-2.5-flash</td>
                <td className="p-3 font-mono">$0.075 / 1M input tokens</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-violet-400">ElevenLabs</td>
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
