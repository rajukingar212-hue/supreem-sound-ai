"use client";

import React from "react";
import Link from "next/link";
import { UploadCloud, CheckCircle2, Shield, Sparkles } from "lucide-react";
import BatchUploader from "@/components/BatchUploader";

export default function UploadPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header & Breadcrumb */}
      <div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
          <Link href="/" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-blue-600 dark:text-blue-400 font-medium">Batch Upload</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <UploadCloud className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Batch Video Ingestion
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Upload video clips to automatically synthesize sample-accurate, diegetic sound design and 48kHz audio stems.
            </p>
          </div>
        </div>
      </div>

      {/* Main Upload Dropzone */}
      <BatchUploader />

      {/* Specifications & Pipeline Guarantee Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] shadow-sm dark:shadow-md space-y-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-900 dark:text-white">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Format Support</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Accepts MP4, MOV, MKV, and WebM containers up to 500MB per file with automatic frame rate alignment.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] shadow-sm dark:shadow-md space-y-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-900 dark:text-white">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Stem Synthesis</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Generates 4 discrete stems (Ambiance, Foley, Music, Voice) normalized to EBU R128 (-16 LUFS broadcast master).
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] shadow-sm dark:shadow-md space-y-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-900 dark:text-white">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Strict Diegetic Policy</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            100% natural, visual-event aligned audio. Zero synthetic voice clone hallucinations or unsolicited dialogue.
          </p>
        </div>
      </div>
    </div>
  );
}

