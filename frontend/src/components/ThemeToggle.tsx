"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sun, Moon, Laptop, Check } from "lucide-react";
import { useTheme, Theme } from "./ThemeProvider";

interface ThemeToggleProps {
  variant?: "compact" | "segmented";
  className?: string;
}

export default function ThemeToggle({ variant = "compact", className = "" }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (variant === "segmented") {
    return (
      <div
        className={`inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#151F30] border border-slate-200 dark:border-[#263449] ${className}`}
      >
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            theme === "light"
              ? "bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>Light</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            theme === "dark"
              ? "bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Moon className="w-3.5 h-3.5" />
          <span>Dark</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme("system")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            theme === "system"
              ? "bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Laptop className="w-3.5 h-3.5" />
          <span>System</span>
        </button>
      </div>
    );
  }

  // Compact variant with dropdown
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle theme"
        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#151F30] dark:hover:bg-[#1E2D45] border border-slate-200 dark:border-[#263449] transition-all focus:outline-none"
      >
        {resolvedTheme === "dark" ? (
          <Moon className="w-4 h-4 text-blue-400 transition-transform duration-200 hover:-rotate-12" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500 transition-transform duration-200 hover:rotate-45" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263449] shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={() => {
              setTheme("light");
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              theme === "light"
                ? "bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center space-x-2">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Light</span>
            </div>
            {theme === "light" && <Check className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme("dark");
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              theme === "dark"
                ? "bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center space-x-2">
              <Moon className="w-3.5 h-3.5 text-blue-400" />
              <span>Dark</span>
            </div>
            {theme === "dark" && <Check className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme("system");
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              theme === "system"
                ? "bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center space-x-2">
              <Laptop className="w-3.5 h-3.5 text-slate-400" />
              <span>System</span>
            </div>
            {theme === "system" && <Check className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}

