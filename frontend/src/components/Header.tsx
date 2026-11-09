"use client";

import Link from "next/link";
import { UploadCloud, ShieldCheck, Activity } from "lucide-react";

export default function Header() {
  return (
    <header className="h-16 border-b border-gray-800 bg-[#0B0F19]/80 backdrop-blur sticky top-0 z-40 px-8 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" />
          Autonomous Audio Engine
        </span>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          No Vocals / No Music Guaranteed
        </span>
      </div>

      <div className="flex items-center space-x-4">
        <Link
          href="/upload"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-md shadow-blue-500/20 transition-all"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Videos</span>
        </Link>
      </div>
    </header>
  );
}

