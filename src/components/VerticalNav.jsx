import React, { useRef, useCallback, useEffect } from 'react';

const SECTIONS = [
  { id: 'tab-overview', num: '01', title: 'OVERVIEW' },
  { id: 'tab-problem', num: '02', title: 'FIND A SLOT' },
  { id: 'tab-solution', num: '03', title: "WHAT PARK'D DOES" },
];

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export default function VerticalNav({ activeTab = 'tab-overview' }) {
  const trackRef      = useRef(null);
  const fillRef       = useRef(null);
  const thumbRef      = useRef(null);
  const tooltipRef    = useRef(null);
  const tooltipTxtRef = useRef(null);
  const isDragging    = useRef(false);
  const lastP         = useRef(0);
  const scrollRaf     = useRef(null);

  // ─── Apply progress to DOM (called from BOTH drag and scroll paths) ─────────
  const applyProgress = useCallback((p) => {
    p = clamp(p, 0, 100);
    lastP.current = p;

    if (fillRef.current)  fillRef.current.style.height = `${p}%`;
    if (thumbRef.current) {
      thumbRef.current.style.top         = `calc(${p}% - 8px)`;
      thumbRef.current.style.borderColor = p < 15 ? '#ef4444' : '#0284c7';
    }
    if (tooltipRef.current) tooltipRef.current.style.top = `${p}%`;
    if (tooltipTxtRef.current) {
      const sec    = p > 66 ? SECTIONS[2] : p > 33 ? SECTIONS[1] : SECTIONS[0];
      const status = p < 20 ? 'Heavy Traffic' : p > 80 ? 'Smart Flow' : 'Resolving Gridlock';
      tooltipTxtRef.current.innerHTML =
        `<span style="font-weight:800;color:#38bdf8">${sec.num} ${sec.title}</span>` +
        `<span style="color:#64748b"> • </span>` +
        `<span style="color:#e2e8f0">${status}</span>` +
        `<span style="color:#7dd3fc;font-weight:600"> (${Math.round(p)}%)</span>`;
    }
  }, []);

  // ─── Convert a clientY position on the track into a 0-100 progress value ───
  const clientYToProgress = useCallback((clientY) => {
    if (!trackRef.current) return lastP.current;
    const rect = trackRef.current.getBoundingClientRect();
    return clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
  }, []);

  // ─── Scroll listener — skipped while dragging (drag drives its own updates) ─
  useEffect(() => {
    const onScroll = () => {
      if (isDragging.current) return;          // drag path handles visuals
      if (scrollRaf.current) return;           // one RAF at a time
      scrollRaf.current = requestAnimationFrame(() => {
        scrollRaf.current = null;
        const total = document.documentElement.scrollHeight - window.innerHeight;
        if (total <= 0) return;
        const y = window.scrollY;
        let p;
        if (y + window.innerHeight >= document.documentElement.scrollHeight - 5) p = 100;
        else if (y <= 3) p = 0;
        else p = (y / total) * 100;
        applyProgress(p);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // initial paint

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current);
    };
  }, [applyProgress]);

  // ─── Sync tooltip label when parent activeTab prop changes ──────────────────
  useEffect(() => {
    if (!tooltipTxtRef.current) return;
    const p   = lastP.current;
    const sec = SECTIONS.find((s) => s.id === activeTab) || SECTIONS[0];
    const status = p < 20 ? 'Heavy Traffic' : p > 80 ? 'Smart Flow' : 'Resolving Gridlock';
    tooltipTxtRef.current.innerHTML =
      `<span style="font-weight:800;color:#38bdf8">${sec.num} ${sec.title}</span>` +
      `<span style="color:#64748b"> • </span>` +
      `<span style="color:#e2e8f0">${status}</span>` +
      `<span style="color:#7dd3fc;font-weight:600"> (${Math.round(p)}%)</span>`;
  }, [activeTab]);

  // ─── Pointer handlers ────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e) => {
    isDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);

    // Immediately move thumb to cursor — no waiting for scroll event
    const p = clientYToProgress(e.clientY);
    applyProgress(p);

    // Then tell the page to scroll to match
    const total = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: (p / 100) * total, behavior: 'auto' });
  }, [applyProgress, clientYToProgress]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) return;

    // Thumb follows cursor INSTANTLY — directly compute from pointer position
    const p = clientYToProgress(e.clientY);
    applyProgress(p);

    // Page scrolls to match (async, but thumb is already correct visually)
    const total = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: (p / 100) * total, behavior: 'auto' });
  }, [applyProgress, clientYToProgress]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Tooltip visibility — direct DOM, no useState
  const showTooltip = () => tooltipRef.current?.classList.add('vnav-show');
  const hideTooltip = () => tooltipRef.current?.classList.remove('vnav-show');

  return (
    <aside
      aria-label="Scroll progress"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      className="fixed left-4 sm:left-6 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center select-none"
    >
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="vnav-tooltip absolute left-9 px-3 py-1.5 rounded-lg bg-slate-900/95 text-white text-[11px] font-mono shadow-xl border border-slate-700/80 pointer-events-none whitespace-nowrap backdrop-blur-sm z-30"
        style={{ transform: 'translateY(-50%)' }}
      >
        <div ref={tooltipTxtRef} />
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative w-3 sm:w-3.5 h-64 sm:h-72 bg-slate-200 rounded-full shadow-lg shadow-slate-900/10 border border-slate-300 cursor-pointer overflow-hidden touch-none"
        title="Drag to scroll"
      >
        {/* Red background (traffic) */}
        <div className="absolute inset-0 bg-gradient-to-b from-red-500 to-rose-600 rounded-full" />

        {/* Blue fill — driven by applyProgress */}
        <div
          ref={fillRef}
          className="absolute top-0 left-0 right-0 bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600 rounded-t-full"
          style={{ height: '0%' }}
        />

        {/* Thumb dot — driven by applyProgress */}
        <div
          ref={thumbRef}
          className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 shadow-md pointer-events-none z-10"
          style={{ top: 'calc(0% - 8px)', borderColor: '#ef4444' }}
        />
      </div>

      {/* Flow label */}
      <div className="vnav-label text-[9px] font-mono font-bold tracking-tight uppercase text-slate-400 mt-2">
        Flow
      </div>

      <style>{`
        .vnav-tooltip {
          opacity: 0;
          pointer-events: none;
          transform: translateY(-50%) translateX(-6px);
          transition: opacity 0.12s ease, transform 0.12s ease;
        }
        .vnav-tooltip.vnav-show {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
        }
        .vnav-label {
          opacity: 0;
          transition: opacity 0.2s;
        }
        aside:hover .vnav-label { opacity: 1; }
      `}</style>
    </aside>
  );
}
