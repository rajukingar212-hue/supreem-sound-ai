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
    <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header & Mode Switch */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-violet-400" />
            Audio Engine Stems & Mixdown Monitor
          </h3>
          <p className="text-xs text-gray-400">
            Conforms to 48,000 Hz, 24-bit PCM, Stereo, exactly 480,000 samples.
          </p>
        </div>

        <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-1 text-xs">
          <button
            onClick={() => {
              if (isPlaying) togglePlay();
              setActiveTab("mixdown");
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === "mixdown"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Mixdown.wav
          </button>
          <button
            onClick={() => {
              if (isPlaying) togglePlay();
              setActiveTab("stems");
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === "stems"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Multi-Track Stems ({stems.length})
          </button>
        </div>
      </div>

      {/* Main Transport Controls */}
      <div className="flex items-center space-x-4 bg-gray-900/60 p-4 rounded-xl border border-gray-800/80">
        <button
          onClick={togglePlay}
          className="w-12 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 transition-all shrink-0"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        <button
          onClick={() => handleSeek(0)}
          className="p-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-all shrink-0"
          title="Restart"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Timeline Slider */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono text-gray-400">
            <span>{currentTime.toFixed(2)}s</span>
            <span className="text-gray-500">
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
            className="w-full accent-blue-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
          />
        </div>

        {/* Master Volume */}
        <div className="flex items-center space-x-2 shrink-0 pl-2 border-l border-gray-800">
          <Volume2 className="w-4 h-4 text-gray-400" />
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
            className="w-20 accent-blue-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
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
                    ? "bg-gray-900/30 border-gray-800/40 opacity-50"
                    : "bg-gray-900/70 border-gray-800 hover:border-gray-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold uppercase">
                      {stem.stem_id}
                    </span>
                    <span className="text-xs font-semibold text-gray-200 truncate">{stem.filename}</span>
                    <span className="text-[11px] text-gray-500">({stem.category})</span>
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-gray-400 font-mono text-[11px]">
                      Peak: <strong className="text-gray-200">{stem.true_peak_dbtp ?? -3.5} dBTP</strong>
                    </span>
                    <button
                      onClick={() => toggleStemMute(stem.id)}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                        isMuted
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
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
                    className="w-32 accent-violet-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
                  />
                  <div className="flex-1 h-3 rounded bg-gray-800 overflow-hidden relative">
                    {/* Simulated Waveform block representing 10s */}
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-600/50 to-blue-500/50"
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
        <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/40">
              <span className="text-gray-400 block mb-1">Standard</span>
              <span className="font-semibold text-emerald-400">48,000 Hz / 24-bit</span>
            </div>
            <div className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/40">
              <span className="text-gray-400 block mb-1">Sample Count</span>
              <span className="font-semibold text-gray-200">480,000 Stereo</span>
            </div>
            <div className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/40">
              <span className="text-gray-400 block mb-1">Target True Peak</span>
              <span className="font-semibold text-blue-400">-3.5 dBTP (Ceiling -1)</span>
            </div>
            <div className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/40">
              <span className="text-gray-400 block mb-1">Summation Contract</span>
              <span className="font-semibold text-purple-400">Σ Stems = Mixdown</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

