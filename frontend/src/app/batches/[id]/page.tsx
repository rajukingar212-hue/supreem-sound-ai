"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, Download, Film, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
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
    return <div className="p-8 text-center text-sm text-gray-400">Loading batch details...</div>;
  }

  if (!batch) {
    return <div className="p-8 text-center text-sm text-red-400">Batch not found.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/batches"
            className="p-2 rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-400 hover:text-white transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">{batch.name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Batch ID: <span className="font-mono text-gray-300">{batch.id}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {batch.completed_videos > 0 && (
            <a
              href={getBatchZipDownloadUrl(batch.id)}
              download={`batch_${batch.name}.zip`}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download All Completed ZIPs</span>
            </a>
          )}

          <button
            onClick={handleStart}
            disabled={starting || batch.status === "Processing"}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-all"
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

      {/* Jobs Table */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            Videos in this Batch ({batch.jobs?.length || 0})
          </h2>
          <span className="text-xs text-gray-400">
            {batch.completed_videos} completed, {batch.failed_videos} failed
          </span>
        </div>

        {batch.jobs && batch.jobs.length > 0 ? (
          <div className="divide-y divide-gray-800">
            {batch.jobs.map((job) => (
              <div
                key={job.id}
                className="p-4 hover:bg-gray-900/60 transition-all flex items-center justify-between text-xs"
              >
                <div className="space-y-1 truncate max-w-md">
                  <div className="flex items-center space-x-2 truncate">
                    <Film className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="font-semibold text-gray-200 truncate">
                      {job.original_filename}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-gray-400">
                    <span>
                      Audio:{" "}
                      <strong className={job.has_original_audio ? "text-amber-400" : "text-gray-400"}>
                        {job.original_audio_classification}
                      </strong>
                    </span>
                    <span>•</span>
                    <span className="text-gray-500 font-mono">
                      {job.current_stage_detail}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-4 shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                      job.status === "Completed"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : job.status === "Failed"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse"
                    }`}
                  >
                    {job.status} ({job.progress_percent}%)
                  </span>

                  <Link
                    href={`/jobs/${job.id}`}
                    className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium"
                  >
                    Inspect
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-gray-500">No videos in this batch yet.</div>
        )}
      </div>
    </div>
  );
}

