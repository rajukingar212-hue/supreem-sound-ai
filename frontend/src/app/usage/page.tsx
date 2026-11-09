"use client";

import React, { useEffect, useState } from "react";
import { DollarSign, Sparkles, Activity, Layers, Clock } from "lucide-react";
import { fetchStats } from "@/lib/api";
import { DashboardStats } from "@/lib/types";

export default function UsagePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetchStats().then(setStats).catch(console.error);
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">API Usage & Cost Tracking</h1>
        <p className="text-sm text-gray-400 mt-1">
          Monitor token consumption, audio generation characters, and estimated provider expenditure.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold">Total Estimated Cost</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-400 font-mono">
            ${stats?.total_api_cost_usd?.toFixed(4) || "0.0000"}
          </div>
          <p className="text-xs text-gray-500 mt-2">Combined Gemini Vision + ElevenLabs</p>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold">Cost Per 10s Video</span>
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white font-mono">
            ${stats?.total_uploaded_videos ? (stats.total_api_cost_usd / stats.total_uploaded_videos).toFixed(4) : "0.0150"}
          </div>
          <p className="text-xs text-gray-500 mt-2">Average across completed batches</p>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold">Average Render Time</span>
            <Clock className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-3xl font-bold text-violet-400 font-mono">
            {stats?.average_processing_time_seconds || "0.0"}s
          </div>
          <p className="text-xs text-gray-500 mt-2">From ingestion to final ZIP export</p>
        </div>
      </div>

      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-semibold text-white">Provider Cost Breakdown Reference</h3>
        <div className="overflow-x-auto rounded-xl border border-gray-800 text-xs">
          <table className="w-full text-left text-gray-300">
            <thead className="bg-gray-900/80 text-gray-400 font-medium">
              <tr>
                <th className="p-3">Provider</th>
                <th className="p-3">Operation</th>
                <th className="p-3">Model</th>
                <th className="p-3">Typical Cost per Call</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/40">
              <tr>
                <td className="p-3 font-semibold text-blue-400">Google Gemini</td>
                <td className="p-3">Visual Video Scene & Action Analysis</td>
                <td className="p-3 font-mono">gemini-2.5-flash</td>
                <td className="p-3 font-mono">~$0.002 / video</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-violet-400">ElevenLabs</td>
                <td className="p-3">Sound Effects Synthesis (3+ stems)</td>
                <td className="p-3 font-mono">sound-generation</td>
                <td className="p-3 font-mono">~$0.005 / sound event</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

