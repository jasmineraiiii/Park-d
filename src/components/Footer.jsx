import React from 'react';
import { ArrowUp } from 'lucide-react';

export default function Footer({ onTabSelect }) {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 py-10 px-4 sm:px-6 lg:px-8 text-xs text-slate-600">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img src="/brand/parkd-logo-192.png" alt="Park'd" width="40" height="40" className="w-10 h-10 rounded-xl shadow-xs ring-1 ring-slate-200/70" />
          <div>
            <div className="text-slate-900 font-bold text-sm tracking-tight">Park'd</div>
            <div className="text-[11px] text-slate-500">Smart Parking for Chandigarh · Municipal Corporation Pilot</div>
          </div>
        </div>

        {/* Tab Links */}
        <div className="flex items-center gap-6 font-mono text-xs uppercase tracking-wider">
          <button
            type="button"
            onClick={() => onTabSelect('tab-overview')}
            className="hover:text-sky-600 transition-colors cursor-pointer"
          >
            01 // Overview
          </button>
          <button
            type="button"
            onClick={() => onTabSelect('tab-problem')}
            className="hover:text-sky-600 transition-colors cursor-pointer"
          >
            02 // Find a Slot
          </button>
          <button
            type="button"
            onClick={() => onTabSelect('tab-solution')}
            className="hover:text-sky-600 transition-colors cursor-pointer"
          >
            03 // What Park'd Does
          </button>
        </div>

        {/* Copyright notice (Removed @Devinder Singh as requested) */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500 font-medium">
            © 2026 Park'd. All rights reserved.
          </span>
          <button
            type="button"
            onClick={() => onTabSelect('tab-overview')}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:border-sky-300 text-slate-600 hover:text-sky-600 transition-colors cursor-pointer shadow-xs"
            title="Back to Top"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}
