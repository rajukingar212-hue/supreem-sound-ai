"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#080D18] text-slate-900 dark:text-slate-100 antialiased selection:bg-blue-500 selection:text-white transition-colors duration-200">
      {/* Sidebar for Desktop & Mobile Drawer */}
      <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} isMobileOpen={mobileMenuOpen} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

