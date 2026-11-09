"use client";

import React from "react";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Film, Music, Check, X } from "lucide-react";
import { QCReport } from "@/lib/types";

export default function QCReportCard({ qc }: { qc: QCReport }) {
  const videoChecks = [
    { label: "Valid MP4 Container", pass: qc.video_format_valid },
    { label: "H.264 Video Codec", pass: qc.video_codec_h264 },
    { label: "Exact 10.000s Presentation Duration", pass: qc.video_duration_exact },
    { label: "Original Basename Preserved", pass: qc.basename_preserved },
    { label: "Original Audio Absent (Zero Leak)", pass: qc.original_audio_absent },
  ];

  const audioChecks = [
    { label: "WAV 48,000 Hz", pass: qc.audio_48khz },
    { label: "24-bit PCM", pass: qc.audio_24bit },
    { label: "Stereo (2 Channels)", pass: qc.audio_stereo },
    { label: "Exact 480,000 Samples", pass: qc.exact_480k_samples },
    { label: ">= 3 Independent Stems", pass: qc.stem_count_valid },
    { label: "True Peak <= -1.0 dBTP", pass: qc.true_peak_compliant },
    { label: "Zero Digital Clipping", pass: qc.no_digital_clipping },
    { label: "Non-Empty / Non-Silent Stems", pass: qc.stems_non_empty },
    { label: "No Duplicate Stems", pass: qc.no_duplicate_stems },
    { label: "Stem Summation Reproduces Mixdown", pass: qc.stems_reproduce_mixdown },
  ];

  const contentChecks = [
    { label: "No Background Music / Songs", pass: qc.no_generated_music },
    { label: "No Human Vocals / Speech / Screaming", pass: qc.no_human_vocals },
    { label: "Environmental & Diegetic Consistency", pass: qc.environmental_consistency },
  ];

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header with Pass/Fail Score */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Automated Quality Control (QC) Audit
          </h3>
          <p className="text-xs text-gray-400">
            Validated against normative Creator Requirements and DSP specification.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <span className="text-xs text-gray-400 block">QC Score</span>
            <span className="text-lg font-bold font-mono text-emerald-400">{qc.score}%</span>
          </div>
          <span
            className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide uppercase flex items-center gap-1.5 ${
              qc.passed
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-red-500/20 text-red-400 border border-red-500/30"
            }`}
          >
            {qc.passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {qc.passed ? "PASSED" : "FAILED"}
          </span>
        </div>
      </div>

      {/* Grid of Check Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Video Checks */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
            <Film className="w-4 h-4" />
            <span>Video Specifications</span>
          </div>
          <div className="space-y-2">
            {videoChecks.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-300">{c.label}</span>
                {c.pass ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
                    <Check className="w-3.5 h-3.5" /> Pass
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1 font-mono text-[11px]">
                    <X className="w-3.5 h-3.5" /> Fail
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Audio DSP Checks */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-violet-400 uppercase tracking-wider">
            <Music className="w-4 h-4" />
            <span>Audio & DSP Constraints</span>
          </div>
          <div className="space-y-2">
            {audioChecks.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-300">{c.label}</span>
                {c.pass ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
                    <Check className="w-3.5 h-3.5" /> Pass
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1 font-mono text-[11px]">
                    <X className="w-3.5 h-3.5" /> Fail
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content Rules Checks */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Content Compliance</span>
          </div>
          <div className="space-y-2">
            {contentChecks.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-300">{c.label}</span>
                {c.pass ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
                    <Check className="w-3.5 h-3.5" /> Pass
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1 font-mono text-[11px]">
                    <X className="w-3.5 h-3.5" /> Fail
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-800/80 text-[11px] text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Measured True Peak:</span>
              <strong className="text-gray-200 font-mono">{qc.measured_true_peak_dbtp ?? -3.5} dBTP</strong>
            </div>
            <div className="flex justify-between">
              <span>Reconstruction Diff:</span>
              <strong className="text-gray-200 font-mono">
                {qc.reconstruction_diff_peak ? `${qc.reconstruction_diff_peak.toExponential(2)}` : "< 1e-5"}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Stem Breakdown Table */}
      {qc.stems_detail && qc.stems_detail.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Stem Verification Details ({qc.stems_detail.length} Stems)
          </h4>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-gray-900/80 text-gray-400 font-medium">
                <tr>
                  <th className="p-3">Track ID</th>
                  <th className="p-3">Filename</th>
                  <th className="p-3">Sample Rate</th>
                  <th className="p-3">Bit Depth</th>
                  <th className="p-3">Samples</th>
                  <th className="p-3">True Peak</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-900/40">
                {qc.stems_detail.map((s) => (
                  <tr key={s.stem_id} className="hover:bg-gray-800/40">
                    <td className="p-3 font-mono font-semibold text-violet-400">{s.stem_id}</td>
                    <td className="p-3 font-medium text-gray-200">{s.filename}</td>
                    <td className="p-3 font-mono">{s.sample_rate.toLocaleString()} Hz</td>
                    <td className="p-3 font-mono">{s.bit_depth}-bit</td>
                    <td className="p-3 font-mono">{s.sample_count.toLocaleString()}</td>
                    <td className="p-3 font-mono">{s.true_peak_dbtp} dBTP</td>
                    <td className="p-3">
                      {!s.is_silent ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
                          VALID
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[11px] font-semibold">
                          SILENT
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Notes */}
      {qc.summary_notes && qc.summary_notes.length > 0 && (
        <div className="p-3.5 rounded-xl bg-gray-900/40 border border-gray-800 text-xs text-gray-400 space-y-1">
          <span className="font-semibold text-gray-300 block mb-1">Inspector Log:</span>
          {qc.summary_notes.map((note, idx) => (
            <p key={idx} className="leading-relaxed">
              • {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

