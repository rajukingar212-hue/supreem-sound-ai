"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UploadCloud,
  FolderKanban,
  Download,
  AlertTriangle,
  Sliders,
  DollarSign,
  Key,
  AudioWaveform,
  Sparkles,
  ShieldCheck,
  X
} from "lucide-react";

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "New Upload", icon: UploadCloud },
  { href: "/batches", label: "Batches", icon: FolderKanban },
  { href: "/downloads", label: "Completed", icon: Download },
  { href: "/failed", label: "Failed & Retries", icon: AlertTriangle },
  { href: "/settings", label: "Settings", icon: Sliders },
  { href: "/settings/api-keys", label: "API Keys", icon: Key },
  { href: "/usage", label: "API & Cost", icon: DollarSign },
];

export default function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-200 dark:border-[#263449] flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <AudioWaveform className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                  SUPREEM
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                  AI
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Sound Design Platform
              </p>
            </div>
          </Link>

          {/* Close button for mobile drawer */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`relative flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#151F30]"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-blue-600 dark:bg-blue-400" />
                )}
                <Icon
                  className={`w-4 h-4 transition-transform ${
                    isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 group-hover:scale-110"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* System Policy Guard Badge */}
      <div className="p-3.5 m-3 rounded-2xl bg-slate-50 dark:bg-[#151F30] border border-slate-200 dark:border-[#263449] text-xs">
        <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 mb-2 font-semibold">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            Policy Guard
          </span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
          <p className="flex justify-between">
            <span>Replace Original:</span>
            <strong className="text-slate-900 dark:text-white font-mono">ENABLED</strong>
          </p>
          <p className="flex justify-between">
            <span>Target Peak:</span>
            <strong className="text-slate-900 dark:text-white font-mono">-3.5 dBTP</strong>
          </p>
        </div>
        <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-[#263449] flex items-center justify-between text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            48kHz / 24-bit PCM
          </span>
          <span>Stereo</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white dark:bg-[#0B1220] border-r border-slate-200 dark:border-[#263449] flex-col justify-between shrink-0 h-screen sticky top-0 transition-colors duration-200 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-[#0B1220] border-r border-slate-200 dark:border-[#263449] h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
