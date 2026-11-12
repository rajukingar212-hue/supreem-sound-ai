"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { FolderKanban, Play, CheckCircle2, AlertTriangle, ArrowRight, Download, Loader2, Sparkles } from "lucide-react";
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
      console.error("Failed to load batches:", e);
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
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header & Breadcrumb */}
      <div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
          <Link href="/" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-blue-600 dark:text-blue-400 font-medium">Batch Monitor</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <FolderKanban className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Batch Processing Monitor
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Supervise multi-video ingestion batches. Asynchronous workers isolate clip failures to guarantee pipeline uptime.
            </p>
          </div>

          <Link
            href="/upload"
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>New Upload</span>
          </Link>
        </div>
      </div>

      {loading && batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-500" />
          <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">Loading batches...</span>
        </div>
      ) : batches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {batches.map((b) => {
            const isProcessing = b.status === "Processing";
            const isCompleted = b.status.startsWith("Completed");
            const hasCompletedVideos = b.completed_videos > 0;
            const progressPercent = b.total_videos > 0 ? (b.completed_videos / b.total_videos) * 100 : 0;

            return (
              <div
                key={b.id}
                className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] rounded-2xl p-6 shadow-sm dark:shadow-xl flex flex-col justify-between space-y-6 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {new Date(b.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isCompleted
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                          : isProcessing
                          ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30 animate-pulse"
                          : "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">{b.name}</h3>
                    <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate mt-0.5">ID: {b.id}</p>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Progress</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {b.completed_videos} / {b.total_videos} videos ({Math.round(progressPercent)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/80 dark:border-gray-700/60">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-sky-400 dark:from-blue-500 dark:to-emerald-400 h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${progressPercent}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-gray-800 flex items-center justify-between">
                  <Link
                    href={`/batches/${b.id}`}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 group"
                  >
                    <span>View Jobs</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>

                  <div className="flex items-center space-x-2">
                    {hasCompletedVideos && (
                      <a
                        href={getBatchZipDownloadUrl(b.id)}
                        download={`batch_${b.id}.zip`}
                        className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/80 dark:text-emerald-300 transition-colors"
                        title="Download All Completed ZIPs"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}

                    {!isCompleted && !isProcessing && (
                      <button
                        onClick={() => handleStart(b.id)}
                        disabled={starting[b.id]}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
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
        <div className="p-16 text-center rounded-2xl bg-white dark:bg-[#111827]/60 border border-dashed border-slate-300 dark:border-gray-800 space-y-4">
          <FolderKanban className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-300">No Batches Recorded</h3>
            <p className="text-xs text-slate-500 dark:text-gray-500 max-w-sm mx-auto">
              Create a batch by uploading video clips to trigger autonomous sound design and stem isolation.
            </p>
          </div>
          <Link
            href="/upload"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
          >
            <span>Upload Videos</span>
          </Link>
        </div>
      )}
    </div>
  );
}

