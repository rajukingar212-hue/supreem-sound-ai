"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sliders,
  Key,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Sun,
  Moon,
  Laptop
} from "lucide-react";
import { fetchSettings, updateSettings, testConnection } from "@/lib/api";
import { SettingsData } from "@/lib/types";
import ThemeToggle from "@/components/ThemeToggle";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [geminiKey, setGeminiKey] = useState("");
  const [elevenlabsKey, setElevenlabsKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, any> | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSettings();
      setSettings(data);
    } catch (e: any) {
      console.error("Failed to load settings:", e);
      setError(e.message || "Unable to connect to the backend settings API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload: any = {
        ...settings,
      };
      if (geminiKey) payload.gemini_api_key = geminiKey;
      if (elevenlabsKey) payload.elevenlabs_api_key = elevenlabsKey;

      const updated = await updateSettings(payload);
      setSettings(updated);
      setGeminiKey("");
      setElevenlabsKey("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const res = await testConnection();
      setTestResults(res);
    } catch (e: any) {
      alert(`Connection test error: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Settings & Configuration</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure DSP tolerances, audio replacement enforcement policies, and external AI providers.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] rounded-2xl shadow-sm">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">Loading settings & DSP policies...</span>
          <span className="text-xs text-slate-400">Connecting to backend at http://localhost:8000/api</span>
        </div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Settings & Configuration</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure DSP tolerances, audio replacement enforcement policies, and external AI providers.
          </p>

          {/* Tab Navigation */}
          <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-[#263449] mt-6 pb-2">
            <Link
              href="/settings"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 transition-all flex items-center space-x-2"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>General & DSP Policies</span>
            </Link>
            <Link
              href="/settings/api-keys"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all flex items-center space-x-2"
            >
              <Key className="w-3.5 h-3.5" />
              <span>API Keys & Credentials</span>
            </Link>
          </div>
        </div>

        <div className="p-8 rounded-2xl bg-white dark:bg-[#111827] border border-red-200 dark:border-red-500/30 shadow-sm space-y-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Backend Connection Error</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed">
            {error || "Unable to retrieve settings from the backend API."}
          </p>
          <p className="text-[11px] text-slate-400">
            Please make sure the FastAPI backend is running (<code className="text-blue-500 font-mono">http://127.0.0.1:8000</code>).
          </p>
          <div className="pt-2">
            <button
              onClick={loadSettings}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/25 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Settings & Configuration</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure DSP tolerances, audio replacement enforcement policies, and external AI providers.
        </p>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-[#263449] mt-6 pb-2">
          <Link
            href="/settings"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 transition-all flex items-center space-x-2"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>General & DSP Policies</span>
          </Link>
          <Link
            href="/settings/api-keys"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all flex items-center space-x-2"
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys & Credentials</span>
          </Link>
        </div>
      </div>

      {/* Theme & Appearance Section */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            Platform Theme & Appearance
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Choose between Electric Blue Dark mode, clean Light mode, or automatic System preference.
          </p>
        </div>
        <ThemeToggle variant="segmented" />
      </div>

      {/* Dedicated API Keys Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 border border-blue-200 dark:border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">Dedicated API Keys Management</h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              Manage AES-256 encrypted credentials, view live provider status, and run real connection tests.
            </p>
          </div>
        </div>
        <Link
          href="/settings/api-keys"
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all shrink-0 self-start sm:self-auto"
        >
          <span>Open API Keys</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* AI Provider Keys */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-800 pb-4">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">AI Provider Credentials</h2>
          </div>

          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs font-semibold text-slate-700 dark:text-gray-200 border border-slate-300 dark:border-gray-700 transition-all"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-blue-500" />}
            <span>Test API Connections</span>
          </button>
        </div>

        {/* Test results banner */}
        {testResults && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-gray-300 font-medium">Google Gemini API:</span>
              <span className={`font-semibold ${testResults.gemini?.status === "connected" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {testResults.gemini?.status === "connected" ? "✓ Connected" : testResults.gemini?.detail || "Not Configured (Offline Fallback)"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-gray-300 font-medium">ElevenLabs SFX API:</span>
              <span className={`font-semibold ${testResults.elevenlabs?.status === "connected" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {testResults.elevenlabs?.status === "connected" ? "✓ Connected" : testResults.elevenlabs?.detail || "Not Configured (Offline Fallback)"}
              </span>
            </div>
          </div>
        )}

        {/* Gemini */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center justify-between">
            <span>Google Gemini API Key</span>
            <span className="text-[11px] font-mono text-slate-500 dark:text-gray-400">
              {settings.gemini_configured ? `✓ Configured (${settings.masked_gemini_key || "active"})` : "Not configured (Using Offline Fallback)"}
            </span>
          </label>
          <input
            type="password"
            placeholder={settings.gemini_configured ? "••••••••••••••••••••••••••••••••" : "AIzaSy..."}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#151F30] border border-slate-300 dark:border-[#263449] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
          />
        </div>

        {/* ElevenLabs */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center justify-between">
            <span>ElevenLabs API Key</span>
            <span className="text-[11px] font-mono text-slate-500 dark:text-gray-400">
              {settings.elevenlabs_configured ? `✓ Configured (${settings.masked_elevenlabs_key || "active"})` : "Not configured (Using Offline Fallback)"}
            </span>
          </label>
          <input
            type="password"
            placeholder={settings.elevenlabs_configured ? "••••••••••••••••••••••••••••••••" : "sk_..."}
            value={elevenlabsKey}
            onChange={(e) => setElevenlabsKey(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#151F30] border border-slate-300 dark:border-[#263449] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
          />
        </div>

        {/* Real API Enforcement Policy */}
        <div className="pt-3 border-t border-slate-200 dark:border-gray-800">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings.require_real_api_keys)}
              onChange={(e) =>
                setSettings({ ...settings, require_real_api_keys: e.target.checked })
              }
              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 dark:bg-slate-900"
            />
            <div>
              <span className="text-xs font-semibold text-slate-800 dark:text-gray-200 block">
                Require Real AI Credentials (Enforce Strict Production Mode)
              </span>
              <span className="text-[11px] text-slate-500 dark:text-gray-400 block leading-relaxed mt-0.5">
                When enabled, processing will fail immediately with an explicit error if Gemini or ElevenLabs keys are not configured or invalid, preventing procedural offline fallback.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* DSP & Audio Policy Settings */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-gray-800 pb-4">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Audio Removal & DSP Policies</h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.replace_all_original_audio}
              onChange={(e) =>
                setSettings({ ...settings, replace_all_original_audio: e.target.checked })
              }
              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 dark:bg-slate-900"
            />
            <div>
              <span className="text-xs font-semibold text-slate-800 dark:text-gray-200 block">
                Replace All Original Audio (Mandatory Default)
              </span>
              <span className="text-[11px] text-slate-500 dark:text-gray-400 block leading-relaxed mt-0.5">
                Completely removes original background music, songs, vocal dialogue, and sound effects using FFmpeg -an.
              </span>
            </div>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-gray-800">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">Target True Peak (dBTP)</label>
              <input
                type="number"
                step="0.1"
                value={settings.target_true_peak_dbtp}
                onChange={(e) =>
                  setSettings({ ...settings, target_true_peak_dbtp: parseFloat(e.target.value) })
                }
                className="w-full bg-slate-50 dark:bg-[#151F30] border border-slate-300 dark:border-[#263449] rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white font-mono"
              />
              <span className="text-[11px] text-slate-500 dark:text-gray-400 block mt-1">Default: -3.5 dBTP</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">Maximum Hard Ceiling (dBTP)</label>
              <input
                type="number"
                step="0.1"
                value={settings.max_true_peak_dbtp}
                onChange={(e) =>
                  setSettings({ ...settings, max_true_peak_dbtp: parseFloat(e.target.value) })
                }
                className="w-full bg-slate-50 dark:bg-[#151F30] border border-slate-300 dark:border-[#263449] rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white font-mono"
              />
              <span className="text-[11px] text-slate-500 dark:text-gray-400 block mt-1">Never exceed: -1.0 dBTP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2">
        {saveSuccess ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" /> Settings saved successfully
          </span>
        ) : (
          <span />
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>Save Settings</span>
        </button>
      </div>
    </div>
  );
}
