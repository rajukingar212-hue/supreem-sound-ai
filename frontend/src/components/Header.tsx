"use client";

import React from "react";
import Link from "next/link";
import { UploadCloud, ShieldCheck, Activity, Menu, X, Sparkles } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

interface HeaderProps {
  onToggleMobileMenu?: () => void;
  isMobileOpen?: boolean;
}

export default function Header({ onToggleMobileMenu, isMobileOpen = false }: HeaderProps) {
  return (
    <header className="h-16 border-b border-slate-200 dark:border-[#263449] bg-white/80 dark:bg-[#080D18]/80 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-colors duration-200">
      {/* Left side: Mobile Hamburger + Status Badges */}
      <div className="flex items-center space-x-3">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-label="Toggle navigation menu"
            className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#151F30] border border-slate-200 dark:border-[#263449] transition-colors"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        <div className="hidden sm:flex items-center space-x-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 flex items-center gap-1.5 shadow-sm">
            <Activity className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
            <span>Autonomous Audio Engine</span>
          </span>

          <span className="hidden md:flex text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 items-center gap-1.5 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>100% Diegetic Sound Design</span>
          </span>
        </div>
      </div>

      {/* Right side: Theme Toggle + Quick Upload Action */}
      <div className="flex items-center space-x-3">
        {/* Theme Selector Toggle */}
        <ThemeToggle variant="compact" />

        {/* Primary Action Button */}
        <Link
          href="/upload"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-150"
        >
          <UploadCloud className="w-4 h-4" />
          <span className="hidden sm:inline">Upload Videos</span>
          <span className="sm:hidden">Upload</span>
        </Link>
      </div>
    </header>
  );
}
