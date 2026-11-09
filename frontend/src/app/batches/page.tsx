"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { FolderKanban, Play, CheckCircle2, AlertTriangle, ArrowRight, Download, Loader2 } from "lucide-react";
import { fetchBatches, startBatch, getBatchZipDownloadUrl } from "@/lib/api";
import { BatchSummary } from "@/lib/types";

export default function BatchesPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<Record<string, boolean>>({});

  const loadBatches = async () => {
    try {
      const data = await fetchBatches();
      setBatches(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
    const interval = setInterval(loadBatches, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async (batchId: string) => {
    setStarting((prev) => ({ ...prev, [batchId]: true }));
    try {
      await startBatch(batchId);
      await loadBatches();
    } catch (err: any) {
      alert(`Error starting batch: ${err.message}`);
    } finally {
      setStarting((prev) => ({ ...prev, [batchId]: false }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Batch Processing Monitor</h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage batches of video clips. Failures in one clip do not halt other jobs.
          </p>
        </div>

        <Link
          href="/upload"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20"
        >
          <span>New Upload</span>
        </Link>
      </div>

      {batches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {batches.map((b) => {
            const isProcessing = b.status === "Processing";
            const isCompleted = b.status.startsWith("Completed");
            const hasCompletedVideos = b.completed_videos > 0;

            return (
              <div
                key={b.id}
                className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-gray-400">
                      {new Date(b.created_at).toLocaleDateString()}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isCompleted
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : isProcessing
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse"
                          : "bg-gray-800 text-gray-300"
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white truncate">{b.name}</h3>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Progress</span>
                      <span>
                        {b.completed_videos} / {b.total_videos} videos
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full transition-all duration-300"
                        style={{
                          width: `${b.total_videos > 0 ? (b.completed_videos / b.total_videos) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-800 flex items-center justify-between">
                  <Link
                    href={`/batches/${b.id}`}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <span>View Jobs</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <div className="flex items-center space-x-2">
                    {hasCompletedVideos && (
                      <a
                        href={getBatchZipDownloadUrl(b.id)}
                        download={`batch_${b.id}.zip`}
                        className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200"
                        title="Download All Completed ZIPs"
                      >
                        <Download className="w-4 h-4 text-emerald-400" />
                      </a>
                    )}

                    {!isCompleted && !isProcessing && (
                      <button
                        onClick={() => handleStart(b.id)}
                        disabled={starting[b.id]}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all"
                      >
                        {starting[b.id] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>Start</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center text-gray-500 text-sm border border-dashed border-gray-800 rounded-2xl bg-[#111827]/40">
          No batches found. Create a batch by uploading videos.
        </div>
      )}
    </div>
  );
}

