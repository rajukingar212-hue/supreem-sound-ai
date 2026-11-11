"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Sliders, Key, Shield, CheckCircle2, AlertCircle, AlertTriangle, Loader2, Sparkles, ArrowRight, RefreshCw } from "lucide-react";
import { fetchSettings, updateSettings, testConnection } from "@/lib/api";
import { SettingsData } from "@/lib/types";

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
          <h1 className="text-2xl font-bold tracking-tight text-white">Settings & Configuration</h1>
          <p className="text-sm text-gray-400 mt-1">
            Configure DSP tolerances, audio replacement enforcement policies, and external AI providers.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-[#111827] border border-gray-800 rounded-2xl">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          <span className="text-sm text-gray-300 font-medium">Loading settings & DSP policies...</span>
          <span className="text-xs text-gray-500">Connecting to backend at http://localhost:8000/api</span>
        </div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Settings & Configuration</h1>
          <p className="text-sm text-gray-400 mt-1">
            Configure DSP tolerances, audio replacement enforcement policies, and external AI providers.
          </p>

          {/* Tab Navigation */}
          <div className="flex items-center space-x-2 border-b border-gray-800 mt-6 pb-2">
            <Link
              href="/settings"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600/20 text-blue-400 border border-blue-500/30 transition-all flex items-center space-x-2"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>General & DSP Policies</span>
            </Link>
            <Link
              href="/settings/api-keys"
              className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all flex items-center space-x-2"
            >
              <Key className="w-3.5 h-3.5 text-gray-400" />
              <span>API Keys & Credentials</span>
            </Link>
          </div>
        </div>

        <div className="p-8 rounded-2xl bg-[#111827] border border-red-500/30 shadow-xl space-y-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-base font-bold text-white">Backend Connection Error</h2>
          <p className="text-xs text-gray-300 max-w-lg mx-auto leading-relaxed">
            {error || "Unable to retrieve settings from the backend API."}
          </p>
          <p className="text-[11px] text-gray-500">
            Please make sure the FastAPI backend is running (<code className="text-blue-400">http://127.0.0.1:8000</code>).
          </p>
          <div className="pt-2">
            <button
              onClick={loadSettings}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
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
        <h1 className="text-2xl font-bold tracking-tight text-white">Settings & Configuration</h1>
        <p className="text-sm text-gray-400 mt-1">
          Configure DSP tolerances, audio replacement enforcement policies, and external AI providers.
        </p>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 border-b border-gray-800 mt-6 pb-2">
          <Link
            href="/settings"
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600/20 text-blue-400 border border-blue-500/30 transition-all flex items-center space-x-2"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>General & DSP Policies</span>
          </Link>
          <Link
            href="/settings/api-keys"
            className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all flex items-center space-x-2"
          >
            <Key className="w-3.5 h-3.5 text-gray-400" />
            <span>API Keys & Credentials</span>
          </Link>
        </div>
      </div>

      {/* Dedicated API Keys Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/30 border border-blue-500/30 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Dedicated API Keys Management</h3>
            <p className="text-[11px] text-gray-300 mt-0.5">
              Manage encrypted credentials, view live connection status, and test Gemini & ElevenLabs APIs.
            </p>
          </div>
        </div>
        <Link
          href="/settings/api-keys"
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all shrink-0"
        >
          <span>Open API Keys Section</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* AI Provider Keys */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">AI Provider Credentials</h2>
          </div>

          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-200 border border-gray-700 transition-all"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-blue-400" />}
            <span>Test API Connections</span>
          </button>
        </div>

        {/* Test results banner */}
        {testResults && (
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Google Gemini API:</span>
              <span className={`font-semibold ${testResults.gemini?.status === "connected" ? "text-emerald-400" : "text-amber-400"}`}>
                {testResults.gemini?.status === "connected" ? "✓ Connected" : testResults.gemini?.detail || "Not Configured (Using Offline Fallback)"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">ElevenLabs SFX API:</span>
              <span className={`font-semibold ${testResults.elevenlabs?.status === "connected" ? "text-emerald-400" : "text-amber-400"}`}>
                {testResults.elevenlabs?.status === "connected" ? "✓ Connected" : testResults.elevenlabs?.detail || "Not Configured (Using Offline Fallback)"}
              </span>
            </div>
          </div>
        )}

        {/* Gemini */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-300 flex items-center justify-between">
            <span>Google Gemini API Key</span>
            <span className="text-[11px] font-mono text-gray-400">
              {settings.gemini_configured ? `✓ Configured (${settings.masked_gemini_key || "active"})` : "Not configured (Using Offline Fallback)"}
            </span>
          </label>
          <input
            type="password"
            placeholder={settings.gemini_configured ? "••••••••••••••••••••••••••••••••" : "AIzaSy..."}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* ElevenLabs */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-300 flex items-center justify-between">
            <span>ElevenLabs API Key</span>
            <span className="text-[11px] font-mono text-gray-400">
              {settings.elevenlabs_configured ? `✓ Configured (${settings.masked_elevenlabs_key || "active"})` : "Not configured (Using Offline Fallback)"}
            </span>
          </label>
          <input
            type="password"
            placeholder={settings.elevenlabs_configured ? "••••••••••••••••••••••••••••••••" : "sk_..."}
            value={elevenlabsKey}
            onChange={(e) => setElevenlabsKey(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Real API Enforcement Policy */}
        <div className="pt-2 border-t border-gray-800/80">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings.require_real_api_keys)}
              onChange={(e) =>
                setSettings({ ...settings, require_real_api_keys: e.target.checked })
              }
              className="mt-0.5 rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-0"
            />
            <div>
              <span className="text-xs font-semibold text-gray-200 block">
                Require Real AI Credentials (Enforce Strict Production Mode)
              </span>
              <span className="text-[11px] text-gray-400 block leading-relaxed mt-0.5">
                When enabled, processing will fail immediately with an explicit error if Gemini or ElevenLabs keys are not configured or invalid, preventing procedural offline fallback.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* DSP & Audio Policy Settings */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center space-x-2 border-b border-gray-800 pb-4">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-semibold text-white">Audio Removal & DSP Policies</h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.replace_all_original_audio}
              onChange={(e) =>
                setSettings({ ...settings, replace_all_original_audio: e.target.checked })
              }
              className="mt-0.5 rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-0"
            />
            <div>
              <span className="text-xs font-semibold text-gray-200 block">
                Replace All Original Audio (Mandatory Default)
              </span>
              <span className="text-[11px] text-gray-400 block leading-relaxed mt-0.5">
                Completely removes original background music, songs, vocal dialogue, and sound effects using FFmpeg -an.
              </span>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
            <div>
              <label className="text-xs text-gray-300 block mb-1">Target True Peak (dBTP)</label>
              <input
                type="number"
                step="0.1"
                value={settings.target_true_peak_dbtp}
                onChange={(e) =>
                  setSettings({ ...settings, target_true_peak_dbtp: parseFloat(e.target.value) })
                }
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
              />
              <span className="text-[11px] text-gray-500 block mt-1">Default: -3.5 dBTP</span>
            </div>

            <div>
              <label className="text-xs text-gray-300 block mb-1">Maximum Hard Ceiling (dBTP)</label>
              <input
                type="number"
                step="0.1"
                value={settings.max_true_peak_dbtp}
                onChange={(e) =>
                  setSettings({ ...settings, max_true_peak_dbtp: parseFloat(e.target.value) })
                }
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
              />
              <span className="text-[11px] text-gray-500 block mt-1">Never exceed: -1.0 dBTP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        {saveSuccess ? (
          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Settings saved successfully
          </span>
        ) : (
          <span />
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>Save Settings</span>
        </button>
      </div>
    </div>
  );
}
