"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileVideo, X, Play, CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { uploadVideos } from "@/lib/api";

export default function BatchUploader({ onUploaded }: { onUploaded?: () => void }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [autoStart, setAutoStart] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const valid = Array.from(incoming).filter((f) => {
      const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
      return [".mp4", ".mov", ".m4v", ".mkv", ".webm"].includes(ext);
    });
    setFiles((prev) => [...prev, ...valid]);
    setError(null);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Please select at least one video file");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      await uploadVideos(files, undefined, autoStart);
      setFiles([]);
      if (onUploaded) onUploaded();
      router.push("/batches");
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] rounded-2xl p-6 sm:p-7 shadow-sm transition-all duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Batch Video Ingestion
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Conforms clips to 10.0s timeline, strips existing audio, and plans multi-layer stem synthesis.
          </p>
        </div>
        <span className="self-start sm:self-auto text-[11px] px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 font-semibold font-mono">
          Max 500 MB / clip
        </span>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-600/10 shadow-lg scale-[1.01]"
            : "border-slate-300 dark:border-[#263449] hover:border-blue-500/70 bg-slate-50/70 dark:bg-[#151F30]/40 hover:bg-slate-50 dark:hover:bg-[#151F30]/70"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".mp4,.mov,.m4v,.mkv,.webm"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white mx-auto flex items-center justify-center mb-3.5 shadow-md shadow-blue-500/25">
          <UploadCloud className="w-7 h-7" />
        </div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Drag & drop video files here, or <span className="text-blue-600 dark:text-blue-400 underline font-bold">browse local files</span>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
          Supported: MP4, MOV (Auto-conformed to 10.0s timeline @ 48kHz 24-bit audio)
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            <span>Selected Files ({files.length})</span>
            <button
              type="button"
              onClick={() => setFiles([])}
              className="text-red-500 hover:text-red-600 text-[11px]"
            >
              Clear All
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#151F30] border border-slate-200 dark:border-[#263449] text-xs"
              >
                <div className="flex items-center space-x-2.5 truncate max-w-sm sm:max-w-md">
                  <FileVideo className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{file.name}</span>
                  <span className="text-[11px] text-slate-400 font-mono">({formatFileSize(file.size)})</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bottom Options & Submit */}
      <div className="mt-6 pt-5 border-t border-slate-200 dark:border-[#263449] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 select-none">
          <input
            type="checkbox"
            checked={autoStart}
            onChange={(e) => setAutoStart(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 dark:bg-slate-900"
          />
          <span>Start sound design pipeline automatically after upload</span>
        </label>

        <button
          type="button"
          onClick={handleUpload}
          disabled={isUploading || files.length === 0}
          className={`inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all ${
            files.length === 0 || isUploading
              ? "bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60"
              : "bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0"
          }`}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Uploading & Queuing...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Ingest & Process ({files.length})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
