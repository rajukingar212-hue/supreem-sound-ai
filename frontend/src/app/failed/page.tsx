"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Film, ArrowRight, Loader2 } from "lucide-react";
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
      console.error(e);
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
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Failed Jobs & Review Queue</h1>
        <p className="text-sm text-gray-400 mt-1">
          Review failed videos, inspect error trace logs, and initiate isolated retries.
        </p>
      </div>

      {jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-[#111827] border border-red-500/30 rounded-2xl p-6 shadow-xl flex items-center justify-between"
            >
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center space-x-2">
                  <Film className="w-4 h-4 text-red-400" />
                  <h3 className="text-sm font-bold text-white">{job.original_filename}</h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                    Retries: {job.retry_count}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 font-mono">
                  {job.error_message || "Quality Control or pipeline stage execution failed"}
                </div>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <Link
                  href={`/jobs/${job.id}`}
                  className="px-3.5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium"
                >
                  Inspect Error
                </Link>

                <button
                  onClick={() => handleRetry(job.id)}
                  disabled={retrying[job.id]}
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-all"
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
        <div className="p-12 text-center text-gray-500 text-sm border border-dashed border-gray-800 rounded-2xl bg-[#111827]/40">
          No failed jobs! All processing jobs have succeeded.
        </div>
      )}
    </div>
  );
}

