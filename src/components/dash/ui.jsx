// Small building blocks in the same visual language as the existing dashboard
// (white rounded cards, sky accents, emerald/amber/rose status colours).
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, LoaderCircle, TriangleAlert } from 'lucide-react';

export function Panel({ title, sub, right, children, className = '' }) {
  return (
    <div className={`p-6 rounded-3xl bg-white border border-sky-100 shadow-xs ${className}`}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 mb-4">
          <div>
            {title && <h3 className="text-base font-bold text-slate-900">{title}</h3>}
            {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

const BTN = {
  primary: 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm',
  dark: 'bg-slate-900 hover:bg-slate-800 text-white',
  soft: 'bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-100',
  ghost: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200',
  green: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  amber: 'bg-amber-500 hover:bg-amber-600 text-white',
  purple: 'bg-purple-600 hover:bg-purple-700 text-white',
  danger: 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-200',
};
export function Btn({ tone = 'primary', className = '', busy, children, ...p }) {
  return (
    <button type="button" {...p} disabled={p.disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${BTN[tone]} ${className}`}>
      {busy && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}

const PILL = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200', amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-rose-50 text-rose-700 border-rose-200', sky: 'bg-sky-50 text-sky-700 border-sky-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200', slate: 'bg-slate-100 text-slate-600 border-slate-200',
  yellow: 'bg-yellow-300 text-yellow-950 border-yellow-400',
};
export function Pill({ tone = 'slate', children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${PILL[tone]} ${className}`}>{children}</span>;
}

export function Modal({ title, sub, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  // Rendered into <body> so the dashboard's animated panel can't clip it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        className={`dashboard-panel-enter w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl`}>
        <div className="sticky top-0 bg-white z-10 flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-red-200 text-slate-500 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export const inputCls = 'w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 transition-all';
export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-mono font-bold uppercase text-slate-500 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export function Loading({ label = 'Loading…' }) {
  return <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center"><LoaderCircle className="w-4 h-4 animate-spin text-sky-500" />{label}</div>;
}
export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
      <TriangleAlert className="w-4 h-4 shrink-0" /><span className="flex-1">{error.message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="underline">Retry</button>}
    </div>
  );
}
export function Empty({ children }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">{children}</p>;
}
export function DemoNote({ children }) {
  return <p className="text-[10px] font-mono text-slate-400">{children}</p>;
}
