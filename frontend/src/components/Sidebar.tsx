"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UploadCloud,
  FolderKanban,
  FileVideo,
  Download,
  AlertTriangle,
  Sliders,
  DollarSign,
  Volume2,
  Sparkles,
  Key
} from "lucide-react";

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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#111827] border-r border-gray-800 flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div>
        {/* Brand */}
        <div className="p-6 border-b border-gray-800 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Volume2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              SUPREEM <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold">AI</span>
            </h1>
            <p className="text-xs text-gray-400">Sound Design Platform</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600/20 to-violet-600/20 text-blue-400 border border-blue-500/30"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-gray-400"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* System Policy Badge */}
      <div className="p-4 m-4 rounded-xl bg-gray-900/90 border border-gray-800 text-xs">
        <div className="flex items-center justify-between text-gray-400 mb-2">
          <span className="font-semibold text-gray-300">Policy Guard</span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <p className="text-gray-400 leading-relaxed">
          <strong className="text-gray-200">Replace Original:</strong> ENABLED
        </p>
        <p className="text-gray-400 leading-relaxed mt-1">
          <strong className="text-gray-200">Target Peak:</strong> -3.5 dBTP (Max -1)
        </p>
        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center text-blue-400 space-x-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">48kHz / 24-bit / Stereo</span>
        </div>
      </div>
    </aside>
  );
}

