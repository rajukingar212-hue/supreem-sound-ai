"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Key,
  Sliders,
  Sparkles,
  Volume2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  ExternalLink,
  Shield,
  Eye,
  EyeOff,
  RefreshCw,
  Info
} from "lucide-react";
import {
  fetchCredentials,
  saveProviderCredential,
  deleteProviderCredential,
  testProviderCredential
} from "@/lib/api";
import { ProviderDetail, ProviderTestResult, ProviderListResponse } from "@/lib/types";

export default function ApiKeysPage() {
  const [data, setData] = useState<ProviderListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputKeys, setInputKeys] = useState<Record<string, string>>({});
  const [showInput, setShowInput] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteConfirmProvider, setDeleteConfirmProvider] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetchCredentials();
      setData(res);
    } catch (e: any) {
      setStatusMessage({ type: "error", text: e.message || "Failed to load provider credentials" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (providerId: string) => {
    const rawKey = inputKeys[providerId];
    if (!rawKey || rawKey.trim().length < 8) {
      alert("Please enter a valid API key (minimum 8 characters).");
      return;
    }

    setSaving((prev) => ({ ...prev, [providerId]: true }));
    setStatusMessage(null);

    try {
      await saveProviderCredential(providerId, rawKey.trim());
      setInputKeys((prev) => ({ ...prev, [providerId]: "" }));
      setStatusMessage({ type: "success", text: `Successfully saved and encrypted ${providerId.toUpperCase()} API key!` });
      await loadData();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (e: any) {
      setStatusMessage({ type: "error", text: e.message || `Failed to save ${providerId} key` });
    } finally {
      setSaving((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  const handleTest = async (providerId: string) => {
    setTesting((prev) => ({ ...prev, [providerId]: true }));
    setStatusMessage(null);

    try {
      const res = await testProviderCredential(providerId);
      setTestResults((prev) => ({ ...prev, [providerId]: res }));
      await loadData();
    } catch (e: any) {
      setStatusMessage({ type: "error", text: e.message || `Connection test failed for ${providerId}` });
    } finally {
      setTesting((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmProvider) return;
    setDeleting(true);

    try {
      await deleteProviderCredential(deleteConfirmProvider);
      setStatusMessage({ type: "success", text: `Deleted credential for ${deleteConfirmProvider.toUpperCase()}.` });
      setDeleteConfirmProvider(null);
      await loadData();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (e: any) {
      setStatusMessage({ type: "error", text: e.message || `Failed to delete ${deleteConfirmProvider} credential` });
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="text-sm text-gray-400">Loading API credentials manager...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header & Tabs */}
      <div>
        <div className="flex items-center space-x-2 text-xs text-gray-400 mb-2">
          <Link href="/settings" className="hover:text-gray-200 transition-colors">Settings</Link>
          <span>/</span>
          <span className="text-blue-400 font-medium">API Keys & Integrations</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Key className="w-6 h-6 text-blue-400" /> API Keys & Integrations
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Configure and test external AI provider credentials. Keys are encrypted at rest with AES-256 and never returned in plaintext.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold">
              {data.total_configured} / {data.providers.length} Configured
            </span>
            {data.strict_mode_enabled && (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-semibold flex items-center gap-1">
                <Shield className="w-3 h-3" /> Strict Production Mode
              </span>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 border-b border-gray-800 mt-6 pb-2">
          <Link
            href="/settings"
            className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all flex items-center space-x-2"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>General & DSP Policies</span>
          </Link>
          <Link
            href="/settings/api-keys"
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600/20 text-blue-400 border border-blue-500/30 transition-all flex items-center space-x-2"
          >
            <Key className="w-3.5 h-3.5 text-blue-400" />
            <span>API Keys & Credentials</span>
          </Link>
        </div>
      </div>

      {/* Global Notification Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between transition-all ${
            statusMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-300"
              : "bg-red-950/40 border-red-800/80 text-red-300"
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-gray-400 hover:text-white text-xs underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Provider Cards */}
      <div className="space-y-6">
        {data.providers.map((p) => {
          const isGemini = p.provider_id === "gemini";
          const isElevenLabs = p.provider_id === "elevenlabs";
          const currentInput = inputKeys[p.provider_id] || "";
          const isInputVisible = showInput[p.provider_id] || false;
          const isSaving = saving[p.provider_id] || false;
          const isTesting = testing[p.provider_id] || false;
          const activeTestResult = testResults[p.provider_id];

          return (
            <div
              key={p.provider_id}
              className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6 hover:border-gray-750 transition-all"
            >
              {/* Card Top: Identity & Status */}
              <div className="flex items-start justify-between border-b border-gray-800/80 pb-5">
                <div className="flex items-start space-x-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                      isGemini
                        ? "bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/20"
                        : "bg-gradient-to-tr from-violet-600 to-fuchsia-600 shadow-violet-500/20"
                    }`}
                  >
                    {isGemini ? (
                      <Sparkles className="w-6 h-6 text-white" />
                    ) : (
                      <Volume2 className="w-6 h-6 text-white" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base font-semibold text-white">{p.name}</h2>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                        {p.provider_id}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
                      {p.description}
                    </p>

                    {/* Capability Tags */}
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {p.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800 text-[10px] text-gray-300 font-medium"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Configuration Badge */}
                <div className="flex flex-col items-end space-y-2">
                  <span
                    className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                      p.is_configured
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-gray-800 text-gray-400 border-gray-700"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        p.is_configured ? "bg-emerald-400 animate-pulse" : "bg-gray-500"
                      }`}
                    />
                    <span>{p.is_configured ? "Configured & Active" : "Not Configured"}</span>
                  </span>

                  {p.help_url && (
                    <a
                      href={p.help_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <span>Get API Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Stored Key & Last Tested Status Banner */}
              {p.is_configured && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-gray-900/80 border border-gray-800/80 text-xs">
                  <div>
                    <span className="text-gray-400 block mb-1">Stored Credential (Encrypted at Rest):</span>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm tracking-wider text-emerald-400 bg-gray-950 px-3 py-1 rounded border border-gray-800">
                        {p.masked_key || "••••••••••••••••"}
                      </span>
                      <span className="text-[11px] text-gray-500">AES-256</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-400 block mb-1">Connection Health:</span>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`font-semibold ${
                          p.last_test_status === "connected"
                            ? "text-emerald-400"
                            : p.last_test_status === "invalid_key" || p.last_test_status === "failed"
                            ? "text-red-400"
                            : "text-amber-400"
                        }`}
                      >
                        {p.last_test_status === "connected" && "✓ Connected"}
                        {p.last_test_status === "invalid_key" && "✗ Invalid API Key"}
                        {p.last_test_status === "quota_exceeded" && "⚠ Quota Exceeded"}
                        {p.last_test_status === "rate_limited" && "⚠ Rate Limited"}
                        {p.last_test_status === "untested" && "○ Ready (Untested)"}
                        {p.last_test_status === "configured_in_env" && "✓ Active (.env)"}
                      </span>
                      {p.last_tested_at && (
                        <span className="text-[11px] text-gray-500">
                          (Tested {new Date(p.last_tested_at).toLocaleTimeString()})
                        </span>
                      )}
                    </div>
                    {p.last_test_details && (
                      <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">{p.last_test_details}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Dynamic Test Result Banner */}
              {activeTestResult && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-1 ${
                    activeTestResult.status === "connected"
                      ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-300"
                      : "bg-red-950/30 border-red-800/60 text-red-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">
                      {activeTestResult.status === "connected" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                      {activeTestResult.message}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                      {new Date(activeTestResult.tested_at).toLocaleTimeString()}
                    </span>
                  </div>
                  {activeTestResult.character_quota && (
                    <div className="text-[11px] text-emerald-400/80 font-mono">
                      Quota: {activeTestResult.character_quota}
                    </div>
                  )}
                </div>
              )}

              {/* Key Input Section */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-300 flex items-center justify-between">
                  <span>{p.is_configured ? "Update API Key" : "Enter New API Key"}</span>
                  <span className="text-[11px] text-gray-500">
                    {isGemini ? "Begins with AIzaSy..." : "Begins with sk_..."}
                  </span>
                </label>

                <div className="relative">
                  <input
                    type={isInputVisible ? "text" : "password"}
                    placeholder={
                      p.is_configured
                        ? "Enter new key to replace existing credential..."
                        : isGemini
                        ? "AIzaSyD-..."
                        : "sk_..."
                    }
                    value={currentInput}
                    onChange={(e) =>
                      setInputKeys((prev) => ({ ...prev, [p.provider_id]: e.target.value }))
                    }
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowInput((prev) => ({ ...prev, [p.provider_id]: !isInputVisible }))
                    }
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300"
                    title={isInputVisible ? "Hide key" : "Show key"}
                  >
                    {isInputVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleSave(p.provider_id)}
                    disabled={isSaving || !currentInput.trim()}
                    className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
                  >
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{p.is_configured ? "Update Key" : "Save Credential"}</span>
                  </button>

                  <button
                    onClick={() => handleTest(p.provider_id)}
                    disabled={isTesting || (!p.is_configured && !currentInput.trim())}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-750 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 border border-gray-700 text-xs font-semibold transition-all"
                  >
                    {isTesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <span>Test Connection</span>
                  </button>
                </div>

                {p.is_configured && (
                  <button
                    onClick={() => setDeleteConfirmProvider(p.provider_id)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Instructions & Help Card */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-2 text-white font-semibold text-sm">
          <Info className="w-4 h-4 text-blue-400" />
          <span>Security & Key Provisioning Guidelines</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-400 leading-relaxed">
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-200">Google Gemini API (Vision):</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Create or select a project in Google AI Studio.</li>
              <li>Generate an API key with access to Gemini 2.5 Flash.</li>
              <li>Used exclusively for visual frame analysis and sound planning.</li>
              <li>No user dialogue or voice prompts are generated or retained.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-200">ElevenLabs Sound Effects API:</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Log in to ElevenLabs Console and copy your Secret API Key (`xi-api-key`).</li>
              <li>Used exclusively with the `/v1/sound-generation` text-to-SFX model.</li>
              <li>Does not generate speech, dialogue, or vocalizations.</li>
              <li>Synthesizes sample-accurate foley and ambient layers conformed to 48kHz.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmProvider && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Delete Stored Credential?</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to delete the stored API key for{" "}
              <strong className="text-white uppercase">{deleteConfirmProvider}</strong>?
            </p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Subsequent video sound design jobs will halt or fall back to offline mode until a new credential is provided.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-800">
              <button
                onClick={() => setDeleteConfirmProvider(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:bg-gray-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-500/20 transition-all"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

