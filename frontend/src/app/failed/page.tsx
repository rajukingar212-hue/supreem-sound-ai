"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Film, ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import { fetchJobs, retryJob } from "@/lib/api";
import { VideoJobDetail } from "@/lib/types";

export default function FailedJobsPage() {
  const [jobs, setJobs] = useState<VideoJobDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<Record<string, boolean>>({});

  const loadJobs = async () => {
    try {
      const data = await fetchJobs(undefined, "Failed");
      setJobs(data);
    } catch (e) {
      console.error("Failed to load failed jobs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleRetry = async (jobId: string) => {
    setRetrying((prev) => ({ ...prev, [jobId]: true }));
    try {
      await retryJob(jobId);
      await loadJobs();
    } catch (e: any) {
      alert(`Retry failed: ${e.message}`);
    } finally {
      setRetrying((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header & Breadcrumb */}
      <div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
          <Link href="/" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-rose-600 dark:text-rose-400 font-medium">Review Queue</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400" /> Failed Jobs & Review Queue
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Review rejected videos, inspect error trace logs, and initiate isolated retries without affecting other jobs.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl">
          <Loader2 className="w-7 h-7 animate-spin text-rose-600 dark:text-rose-500" />
          <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">Checking failed job queue...</span>
        </div>
      ) : jobs.length > 0 ? (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-white dark:bg-[#111827] border border-rose-200 dark:border-red-500/30 rounded-2xl p-6 shadow-sm dark:shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-rose-300 dark:hover:border-red-500/50 transition-all"
            >
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center space-x-2 flex-wrap gap-2">
                  <Film className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{job.original_filename}</h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30">
                    Retries: {job.retry_count}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-rose-50 dark:bg-red-950/30 border border-rose-200 dark:border-red-800/40 text-xs text-rose-900 dark:text-red-300 font-mono break-words">
                  {job.error_message || "Quality Control or pipeline stage execution failed"}
                </div>
              </div>

              <div className="flex items-center space-x-3 shrink-0 pt-2 md:pt-0">
                <Link
                  href={`/jobs/${job.id}`}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:bg-gray-800 dark:hover:bg-gray-750 dark:border-gray-700 text-slate-800 dark:text-gray-200 text-xs font-medium transition-all"
                >
                  Inspect Error
                </Link>

                <button
                  onClick={() => handleRetry(job.id)}
                  disabled={retrying[job.id]}
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-500/20 transition-all"
                >
                  {retrying[job.id] ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  <span>Retry Job</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-16 text-center rounded-2xl bg-white dark:bg-[#111827]/60 border border-dashed border-slate-300 dark:border-gray-800 space-y-4">
          <AlertTriangle className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-300">Review Queue Empty</h3>
            <p className="text-xs text-slate-500 dark:text-gray-500 max-w-sm mx-auto">
              No failed or quarantined jobs detected. All video processing and QC tasks have succeeded.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

