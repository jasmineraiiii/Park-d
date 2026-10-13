import React from 'react';
import { ChevronRight } from 'lucide-react';

export default function Header({ onTabSelect, activeTab, onOpenAuth }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-sky-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo styled cleanly */}
        <div className="flex items-center gap-3">
          <a
            href="#tab-overview"
            onClick={(e) => {
              e.preventDefault();
              onTabSelect('tab-overview');
            }}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center shadow-xs text-white font-extrabold text-base tracking-tight group-hover:scale-105 transition-transform">
              P
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight text-slate-900 group-hover:text-sky-600 transition-colors">
                Park'd
              </div>
              <div className="text-[9px] font-mono font-bold tracking-widest uppercase text-sky-600 -mt-0.5">
                Smart Parking
              </div>
            </div>
          </a>
        </div>

        {/* Top Navigation Tabs - Matching Screenshot 5 Structure */}
        <nav className="flex items-center gap-4 sm:gap-8 font-mono text-xs sm:text-sm tracking-wider uppercase">
          <button
            type="button"
            onClick={() => onTabSelect('tab-overview')}
            className={`transition-all duration-200 cursor-pointer flex items-center gap-1.5 py-1 px-2 rounded-md ${
              activeTab === 'tab-overview'
                ? 'text-sky-600 font-extrabold bg-sky-50 ring-1 ring-sky-300'
                : 'text-slate-600 hover:text-slate-900 font-semibold'
            }`}
          >
            <span className={activeTab === 'tab-overview' ? 'text-sky-600' : 'text-slate-600'}>01</span>
            <span className="text-sky-300 font-light">//</span>
            <span>OVERVIEW</span>
          </button>

          <button
            type="button"
            onClick={() => onTabSelect('tab-problem')}
            className={`transition-all duration-200 cursor-pointer flex items-center gap-1.5 py-1 px-2 rounded-md ${
              activeTab === 'tab-problem'
                ? 'text-sky-600 font-extrabold bg-sky-50 ring-1 ring-sky-300'
                : 'text-slate-600 hover:text-slate-900 font-semibold'
            }`}
          >
            <span className={activeTab === 'tab-problem' ? 'text-sky-600' : 'text-slate-600'}>02</span>
            <span className="text-sky-300 font-light">//</span>
            <span>FIND A SLOT</span>
          </button>

          <button
            type="button"
            onClick={() => onTabSelect('tab-solution')}
            className={`transition-all duration-200 cursor-pointer flex items-center gap-1.5 py-1 px-2 rounded-md ${
              activeTab === 'tab-solution'
                ? 'text-sky-600 font-extrabold bg-sky-50 ring-1 ring-sky-300'
                : 'text-slate-600 hover:text-slate-900 font-semibold'
            }`}
          >
            <span className={activeTab === 'tab-solution' ? 'text-sky-600' : 'text-slate-600'}>03</span>
            <span className="text-sky-300 font-light">//</span>
            <span>WHAT PARK'D DOES</span>
          </button>
        </nav>

        {/* Right CTA button */}
        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={() => (onOpenAuth ? onOpenAuth() : onTabSelect('tab-solution'))}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all cursor-pointer"
          >
            <span>Get Started</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
