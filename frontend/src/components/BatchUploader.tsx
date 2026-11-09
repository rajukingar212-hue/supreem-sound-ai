"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileVideo, X, Play, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { uploadVideos } from "@/lib/api";

export default function BatchUploader({ onUploaded }: { onUploaded?: () => void }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [batchName, setBatchName] = useState("");
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
    <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Batch Video Ingestion</h2>
          <p className="text-xs text-gray-400">
            Upload MP4 or MOV files. Videos may contain background music, dialogue, or no audio.
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
          Max 500 MB per clip
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
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-blue-500 bg-blue-500/10"
            : "border-gray-700 hover:border-gray-600 bg-gray-900/40"
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
        <div className="w-12 h-12 rounded-xl bg-gray-800 text-blue-400 mx-auto flex items-center justify-center mb-3">
          <UploadCloud className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-gray-200">
          Drag & drop video files here, or <span className="text-blue-400 underline">browse</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">MP4, MOV (Conformed to 10.0s presentation timeline)</p>
      </div>

      {/* Selected Files List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Selected Videos ({files.length})</span>
            <button
              onClick={() => setFiles([])}
              className="text-red-400 hover:underline"
            >
              Clear all
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700/60 text-xs"
              >
                <div className="flex items-center space-x-2 truncate">
                  <FileVideo className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="font-medium text-gray-200 truncate">{file.name}</span>
                  <span className="text-gray-500 shrink-0">
                    ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="p-1 hover:text-red-400 text-gray-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between">
        <label className="flex items-center space-x-2 cursor-pointer text-xs text-gray-300">
          <input
            type="checkbox"
            checked={autoStart}
            onChange={(e) => setAutoStart(e.target.checked)}
            className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0"
          />
          <span>Start Automatic Processing immediately</span>
        </label>

        <button
          onClick={handleUpload}
          disabled={files.length === 0 || isUploading}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 text-white text-sm font-medium shadow-lg shadow-blue-500/20 transition-all"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Uploading & Queuing...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Start Processing {files.length > 0 ? `(${files.length})` : ""}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

