import React, { useEffect, useRef } from 'react';
import InteractiveLotDemo from './InteractiveLotDemo';
import {
  Smartphone,
  ShieldCheck,
  Building2,
  ChevronRight
} from 'lucide-react';

function useFadeIn(delay = 0) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.animationDelay = `${delay}s`;
          el.classList.add('animate-fade-in');
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);
  return ref;
}

export default function SolutionSection({ onTabSelect, onOpenAuth }) {
  const headingRef = useFadeIn(0.0);
  const app1Ref   = useFadeIn(0.1);
  const app2Ref   = useFadeIn(0.2);
  const app3Ref   = useFadeIn(0.3);
  const demoRef   = useFadeIn(0.15);
  const ben1Ref   = useFadeIn(0.0);
  const ben2Ref   = useFadeIn(0.1);
  const ben3Ref   = useFadeIn(0.2);
  const ben4Ref   = useFadeIn(0.3);
  const ctaRef    = useFadeIn(0.1);

  return (
    <section
      id="tab-solution"
      className="relative py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-sky-100"
    >
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Section Header */}
        <div ref={headingRef} className="text-center max-w-3xl mx-auto" style={{opacity:0}}>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Zero Hardware. One Live Citywide Map.
          </h2>
          <p className="text-base sm:text-lg text-slate-800 leading-relaxed font-medium">
            Park'd digitizes Chandigarh's existing parking attendants without buying a single expensive camera or ground sensor.
          </p>
        </div>

        {/* The 3 App Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Citizen App */}
          <div ref={app1Ref} className="p-7 rounded-3xl bg-slate-50/90 border border-slate-200/90 hover:border-sky-300 transition-all shadow-xs hover:shadow-lg hover:shadow-sky-500/5 group" style={{opacity:0}}>
            <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center mb-5 shadow-sm">
              <Smartphone className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold text-sky-600 uppercase tracking-wider mb-1">01 • For Commuters</div>
            <h3 className="text-xl font-bold text-slate-900 mb-2.5">Citizen App</h3>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-4 font-normal">
              Search by sector or landmark, view color-coded availability (green/amber/red), lock a guaranteed 30-minute reservation with UPI, and use Find My Car with walking directions.
            </p>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-700">
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200">10% Pre-Book Quota</span>
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200">Find My Car</span>
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200">₹14 UPI Receipts</span>
            </div>
          </div>

          {/* Attendant App */}
          <div ref={app2Ref} className="p-7 rounded-3xl bg-slate-50/90 border border-slate-200/90 hover:border-sky-300 transition-all shadow-xs hover:shadow-lg hover:shadow-sky-500/5 group" style={{opacity:0}}>
            <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center mb-5 shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold text-sky-600 uppercase tracking-wider mb-1">02 • For On-Duty Staff</div>
            <h3 className="text-xl font-bold text-slate-900 mb-2.5">Attendant App</h3>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-4 font-normal">
              Staff view only assigned lots. 1 tap assigns the next free numbered slot and logs the fee. Slot taps record entry/exit, while mistakes are undoable with mandatory logged reasons.
            </p>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-700">
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200">1-Tap Fast Entry</span>
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200">Cash & UPI Logging</span>
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200">Permanent Audit Trail</span>
            </div>
          </div>

          {/* MC Dashboard */}
          <div ref={app3Ref} className="p-7 rounded-3xl bg-slate-50/90 border border-slate-200/90 hover:border-sky-300 transition-all shadow-xs hover:shadow-lg hover:shadow-sky-500/5 group" style={{opacity:0}}>
            <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center mb-5 shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold text-sky-600 uppercase tracking-wider mb-1">03 • For Administration</div>
            <h3 className="text-xl font-bold text-slate-900 mb-2.5">MC Dashboard</h3>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-4 font-normal">
              Real-time bird's-eye city totals: active capacity, occupancy %, UPI vs cash revenue split, automated alerts when lots hit 85% full, and attendant collection reconciliation.
            </p>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-700">
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200">85%+ Alerts</span>
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200">Revenue Split</span>
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200">Shift Reconciliation</span>
            </div>
          </div>
        </div>

        {/* Live Simulator Showcase */}
        <div ref={demoRef} style={{opacity:0}}>
          <InteractiveLotDemo />
        </div>

        {/* 4 Civic Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div ref={ben1Ref} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-left" style={{opacity:0}}>
            <div className="text-sky-700 font-bold text-base mb-1.5">Less Traffic & Smog</div>
            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              Fewer cars circling commercial sectors means cleaner air, less fuel waste, and fluid urban transit.
            </p>
          </div>

          <div ref={ben2Ref} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-left" style={{opacity:0}}>
            <div className="text-sky-700 font-bold text-base mb-1.5">100% Financial Transparency</div>
            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              Every fee is logged digitally with instant reference receipts, eliminating overcharging and cash leakage.
            </p>
          </div>

          <div ref={ben3Ref} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-left" style={{opacity:0}}>
            <div className="text-sky-700 font-bold text-base mb-1.5">Zero Costly Hardware</div>
            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              Works immediately on standard staff smartphones. Zero cameras, wiring, or ground sensors to maintain.
            </p>
          </div>

          <div ref={ben4Ref} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-left" style={{opacity:0}}>
            <div className="text-sky-700 font-bold text-base mb-1.5">Data-Driven Planning</div>
            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              Provides the Municipal Corporation with empirical peak-hour data on where parking space is truly needed.
            </p>
          </div>
        </div>

        {/* Dark Grey Standout CTA Box */}
        <div ref={ctaRef} className="p-8 sm:p-12 rounded-3xl bg-[#1e293b] border border-slate-700 text-white text-center shadow-2xl shadow-slate-950/20 relative overflow-hidden" style={{opacity:0}}>
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Ready for Smarter Parking in Chandigarh?
            </h3>
            <p className="text-sm sm:text-base text-slate-300 font-medium">
              Join the live pilot across Sectors 17, 22, and 35. Your spot, before you start.
            </p>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => (onOpenAuth ? onOpenAuth() : onTabSelect?.('tab-solution'))}
                className="px-8 py-3.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm shadow-lg shadow-sky-500/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Get Started</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onTabSelect?.('tab-overview')}
                className="px-7 py-3.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-600 transition-all cursor-pointer shadow-xs"
              >
                Back to Top
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
