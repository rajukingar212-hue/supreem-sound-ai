"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, Download, Film, CheckCircle2, AlertTriangle, Loader2, Sparkles, ExternalLink } from "lucide-react";
import { fetchBatchDetail, startBatch, getBatchZipDownloadUrl } from "@/lib/api";
import { BatchSummary, VideoJobDetail } from "@/lib/types";

export default function BatchDetailPage() {
  const params = useParams();
  const batchId = params?.id as string;

  const [batch, setBatch] = useState<BatchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const loadBatch = async () => {
    try {
      if (!batchId) return;
      const data = await fetchBatchDetail(batchId);
      setBatch(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatch();
    const interval = setInterval(loadBatch, 2500);
    return () => clearInterval(interval);
  }, [batchId]);

  const handleStart = async () => {
    if (!batchId) return;
    setStarting(true);
    try {
      await startBatch(batchId);
      await loadBatch();
    } catch (err: any) {
      alert(`Error starting batch: ${err.message}`);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center p-16 space-y-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl">
        <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-500" />
        <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">Loading batch details...</span>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="max-w-7xl mx-auto p-12 text-center rounded-2xl bg-white dark:bg-[#111827] border border-rose-200 dark:border-red-500/30 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Batch Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">The requested batch ID does not exist in the database.</p>
        <Link
          href="/batches"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
        >
          <span>Return to Batches</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Top Banner & Breadcrumb */}
      <div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
          <Link href="/batches" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">Batches</Link>
          <span>/</span>
          <span className="text-blue-600 dark:text-blue-400 font-medium truncate max-w-xs">{batch.name}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-gray-800 pb-5">
          <div className="flex items-center space-x-4">
            <Link
              href="/batches"
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:bg-slate-200 dark:hover:bg-gray-800 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
              title="Back to Batches"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{batch.name}</h1>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                Batch ID: <span className="font-mono text-slate-700 dark:text-gray-300">{batch.id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {batch.completed_videos > 0 && (
              <a
                href={getBatchZipDownloadUrl(batch.id)}
                download={`batch_${batch.name}.zip`}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download All Completed ZIPs</span>
              </a>
            )}

            <button
              onClick={handleStart}
              disabled={starting || batch.status === "Processing"}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
            >
              {starting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              <span>Process Batch</span>
            </button>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl">
        <div className="p-4 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Videos in this Batch ({batch.jobs?.length || 0})
          </h2>
          <div className="flex items-center space-x-3 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {batch.completed_videos} completed
            </span>
            <span className="text-slate-300 dark:text-gray-700">•</span>
            <span className="text-rose-600 dark:text-rose-400 font-medium">
              {batch.failed_videos} failed
            </span>
          </div>
        </div>

        {batch.jobs && batch.jobs.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-gray-800/80">
            {batch.jobs.map((job) => (
              <div
                key={job.id}
                className="p-4 hover:bg-slate-50/80 dark:hover:bg-gray-900/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 truncate max-w-lg">
                  <div className="flex items-center space-x-2 truncate">
                    <Film className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="font-semibold text-slate-900 dark:text-gray-200 truncate">
                      {job.original_filename}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 dark:text-gray-400">
                    <span>
                      Audio:{" "}
                      <strong className={job.has_original_audio ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-500 dark:text-gray-500"}>
                        {job.original_audio_classification}
                      </strong>
                    </span>
                    <span>•</span>
                    <span className="text-slate-500 dark:text-gray-400 font-mono">
                      {job.current_stage_detail}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${
                      job.status === "Completed"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                        : job.status === "Failed"
                        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30"
                        : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30 animate-pulse"
                    }`}
                  >
                    {job.status} ({job.progress_percent}%)
                  </span>

                  <Link
                    href={`/jobs/${job.id}`}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-700 text-slate-800 dark:text-gray-200 text-xs font-medium transition-all"
                  >
                    Inspect
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-gray-500">No videos in this batch yet.</div>
        )}
      </div>
    </div>
  );
}

