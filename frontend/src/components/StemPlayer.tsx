"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, RotateCcw, Sliders, Music2 } from "lucide-react";
import { StemSummary } from "@/lib/types";
import { getMixdownDownloadUrl, getStemDownloadUrl } from "@/lib/api";

interface StemPlayerProps {
  jobId: string;
  stems: StemSummary[];
  mixdownAvailable: boolean;
}

export default function StemPlayer({ jobId, stems, mixdownAvailable }: StemPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(10.0);
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [mutedStems, setMutedStems] = useState<Record<string, boolean>>({});
  const [stemVolumes, setStemVolumes] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<"mixdown" | "stems">("mixdown");

  const mixdownAudioRef = useRef<HTMLAudioElement | null>(null);
  const stemAudioRefs = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    // Initialize default volumes
    const initialVols: Record<string, number> = {};
    stems.forEach((s) => {
      initialVols[s.id] = 0.8;
    });
    setStemVolumes(initialVols);
  }, [stems]);

  const togglePlay = () => {
    if (activeTab === "mixdown") {
      if (mixdownAudioRef.current) {
        if (isPlaying) {
          mixdownAudioRef.current.pause();
        } else {
          mixdownAudioRef.current.play();
        }
      }
    } else {
      // Stems multi-track play
      Object.values(stemAudioRefs.current).forEach((audio) => {
        if (audio) {
          if (isPlaying) {
            audio.pause();
          } else {
            audio.play();
          }
        }
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (mixdownAudioRef.current) mixdownAudioRef.current.currentTime = newTime;
    Object.values(stemAudioRefs.current).forEach((audio) => {
      if (audio) audio.currentTime = newTime;
    });
  };

  const toggleStemMute = (stemId: string) => {
    setMutedStems((prev) => ({ ...prev, [stemId]: !prev[stemId] }));
  };

  const handleStemVolumeChange = (stemId: string, val: number) => {
    setStemVolumes((prev) => ({ ...prev, [stemId]: val }));
    const audio = stemAudioRefs.current[stemId];
    if (audio) audio.volume = val;
  };

  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-6">
      {/* Header & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            Audio Engine Stems & Mixdown Monitor
          </h3>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
            Conforms to 48,000 Hz, 24-bit PCM, Stereo, exactly 480,000 samples.
          </p>
        </div>

        <div className="flex items-center bg-slate-100 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-1 text-xs shrink-0">
          <button
            onClick={() => {
              if (isPlaying) togglePlay();
              setActiveTab("mixdown");
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === "mixdown"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Mixdown.wav
          </button>
          <button
            onClick={() => {
              if (isPlaying) togglePlay();
              setActiveTab("stems");
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === "stems"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Multi-Track Stems ({stems.length})
          </button>
        </div>
      </div>

      {/* Main Transport Controls */}
      <div className="flex items-center space-x-4 bg-slate-50 dark:bg-gray-900/60 p-4 rounded-xl border border-slate-200/90 dark:border-gray-800/80">
        <button
          onClick={togglePlay}
          className="w-12 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 transition-all shrink-0"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        <button
          onClick={() => handleSeek(0)}
          className="p-2.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 transition-all shrink-0"
          title="Restart"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Timeline Slider */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-gray-400">
            <span>{currentTime.toFixed(2)}s</span>
            <span className="text-slate-400 dark:text-gray-500 text-[11px]">
              Sample: {Math.floor(currentTime * 48000).toLocaleString()} / 480,000
            </span>
            <span>10.00s</span>
          </div>
          <input
            type="range"
            min={0}
            max={10.0}
            step={0.01}
            value={currentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="w-full accent-blue-600 dark:accent-blue-500 h-1.5 bg-slate-200 dark:bg-gray-700 rounded-lg cursor-pointer"
          />
        </div>

        {/* Master Volume */}
        <div className="flex items-center space-x-2 shrink-0 pl-2 border-l border-slate-200 dark:border-gray-800">
          <Volume2 className="w-4 h-4 text-slate-500 dark:text-gray-400" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={masterVolume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setMasterVolume(val);
              if (mixdownAudioRef.current) mixdownAudioRef.current.volume = val;
            }}
            className="w-20 accent-blue-600 dark:accent-blue-500 h-1.5 bg-slate-200 dark:bg-gray-700 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Mixdown Audio Element */}
      {mixdownAvailable && (
        <audio
          ref={mixdownAudioRef}
          src={getMixdownDownloadUrl(jobId)}
          onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget.currentTime)}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Multi-Track Stems View */}
      {activeTab === "stems" ? (
        <div className="space-y-3">
          {stems.map((stem) => {
            const isMuted = mutedStems[stem.id] || false;
            const vol = stemVolumes[stem.id] ?? 0.8;

            return (
              <div
                key={stem.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isMuted
                    ? "bg-slate-50/50 dark:bg-gray-900/30 border-slate-200/50 dark:border-gray-800/40 opacity-50"
                    : "bg-slate-50 dark:bg-gray-900/70 border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 font-semibold uppercase">
                      {stem.stem_id}
                    </span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-gray-200 truncate">{stem.filename}</span>
                    <span className="text-[11px] text-slate-500 dark:text-gray-500">({stem.category})</span>
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-slate-500 dark:text-gray-400 font-mono text-[11px]">
                      Peak: <strong className="text-slate-800 dark:text-gray-200">{stem.true_peak_dbtp != null ? `${stem.true_peak_dbtp.toFixed(2)} dBTP` : "N/A"}</strong>
                    </span>
                    <button
                      onClick={() => toggleStemMute(stem.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                        isMuted
                          ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      {isMuted ? "MUTED" : "MUTE"}
                    </button>
                  </div>
                </div>

                {/* Track Audio Element & Volume */}
                <div className="flex items-center space-x-3">
                  <audio
                    ref={(el) => {
                      if (el) stemAudioRefs.current[stem.id] = el;
                    }}
                    src={getStemDownloadUrl(stem.id)}
                    muted={isMuted}
                    onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget.currentTime)}
                    onEnded={() => setIsPlaying(false)}
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : vol}
                    disabled={isMuted}
                    onChange={(e) => handleStemVolumeChange(stem.id, parseFloat(e.target.value))}
                    className="w-32 accent-violet-600 dark:accent-violet-500 h-1.5 bg-slate-200 dark:bg-gray-700 rounded-lg cursor-pointer"
                  />
                  <div className="flex-1 h-3 rounded-md bg-slate-200 dark:bg-gray-800 overflow-hidden relative">
                    {/* Simulated Waveform block representing 10s */}
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-600 to-blue-500 opacity-60"
                      style={{ width: `${(currentTime / 10.0) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Mixdown Overview View */
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-800 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white dark:bg-gray-800/40 border border-slate-200 dark:border-gray-700/40 shadow-sm">
              <span className="text-slate-500 dark:text-gray-400 block mb-1">Standard</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">48,000 Hz / 24-bit</span>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-gray-800/40 border border-slate-200 dark:border-gray-700/40 shadow-sm">
              <span className="text-slate-500 dark:text-gray-400 block mb-1">Sample Count</span>
              <span className="font-semibold text-slate-800 dark:text-gray-200">480,000 Stereo</span>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-gray-800/40 border border-slate-200 dark:border-gray-700/40 shadow-sm">
              <span className="text-slate-500 dark:text-gray-400 block mb-1">Target True Peak</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">-3.5 dBTP (Ceiling -1)</span>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-gray-800/40 border border-slate-200 dark:border-gray-700/40 shadow-sm">
              <span className="text-slate-500 dark:text-gray-400 block mb-1">Summation Contract</span>
              <span className="font-semibold text-purple-600 dark:text-purple-400">Σ Stems = Mixdown</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

