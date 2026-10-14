// Connection to the Park'd backend (Express + MongoDB + Socket.io).
//
// Local dev: leave VITE_API_URL unset. Vite proxies /api and /socket.io to
// http://localhost:4000 (see vite.config.js), so start the backend first.
// Deployed (e.g. Vercel): set VITE_API_URL=https://<your-backend>.onrender.com
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const KEY = 'parkd.web.session';

/* ---------- session (token + user + UI role) ---------- */
export const session = {
  get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } },
  set(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

/** Calls the API. Throws Error(message) with .code/.status from the server. */
export async function api(method, path, body, token = session.get()?.token) {
  let res;
  try {
    res = await fetch(`${API_ORIGIN}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const e = new Error("Can't reach the Park'd server. Is the backend running?");
    e.code = 'offline';
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const offline = !data.code && res.status >= 500; // dev proxy answers 5xx when the backend is down
    const e = new Error(offline ? "Can't reach the Park'd server. Is the backend running?" : data.message || `Request failed (${res.status})`);
    e.code = offline ? 'offline' : data.code;
    e.status = res.status;
    throw e;
  }
  return data;
}

/* ---------- sign-in for the three roles in the teammate's AuthPage ---------- */
// UI role → backend role: driver → driver, worker → attendant, developer → MC admin
export async function signIn({ role, isSignUp, fullName, email, password, staffId }) {
  let r;
  if (role === 'driver') {
    r = isSignUp
      ? await api('POST', '/auth/register', { name: fullName, email, password }, null)
      : await api('POST', '/auth/login', { email, password }, null);
  } else {
    r = await api('POST', role === 'worker' ? '/auth/attendant' : '/auth/admin', { username: staffId, pin: password }, null);
  }
  const s = { token: r.token, user: r.user, role };
  session.set(s);
  resetSocket();
  return s;
}

export async function signInWithGoogle(credential) {
  const r = await api('POST', '/auth/google', { credential }, null);
  const s = { token: r.token, user: r.user, role: 'driver' };
  session.set(s);
  resetSocket();
  return s;
}

/* ---------- live updates ---------- */
let sock = null;
export function getSocket() {
  if (!sock) sock = io(API_ORIGIN || undefined, { auth: { token: session.get()?.token }, transports: ['websocket', 'polling'] });
  return sock;
}
export function resetSocket() { if (sock) { sock.disconnect(); sock = null; } }

/** Subscribes to socket events while the component is mounted. handlers: { 'lot:update': fn, ... } */
export function useLive(handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const s = getSocket();
    const events = Object.keys(ref.current);
    const bound = events.map((ev) => [ev, (...a) => ref.current[ev]?.(...a)]);
    bound.forEach(([ev, fn]) => s.on(ev, fn));
    return () => bound.forEach(([ev, fn]) => s.off(ev, fn));
  }, []);
}

/** Loads data with an async function; returns { data, error, loading, reload, setData }. */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(async () => {
    try { const data = await fnRef.current(); setState({ data, error: null, loading: false }); return data; }
    catch (error) { setState((s) => ({ ...s, error, loading: false })); return null; }
  }, []);
  useEffect(() => { setState((s) => ({ ...s, loading: true })); reload(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  const setData = (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d }));
  return { ...state, reload, setData };
}

/* ---------- formatting ---------- */
const TZ = { timeZone: 'Asia/Kolkata' };
export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
export const time = (d) => new Date(d).toLocaleTimeString('en-IN', { ...TZ, hour: 'numeric', minute: '2-digit' });
export const dateTime = (d) => new Date(d).toLocaleString('en-IN', { ...TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const dayLabel = (d) => new Date(d).toLocaleDateString('en-IN', { ...TZ, weekday: 'short', day: 'numeric', month: 'short' });
export const sectorLabel = (s) => (/^\d+$/.test(String(s)) ? `Sector ${s}` : s);
export const istToday = (offsetDays = 0) => new Date(Date.now() + 5.5 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);
export const hhmm12 = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 || h === 24 ? 'AM' : 'PM'}`; };
export const duration = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
export const directionsUrl = (lat, lng, mode = 'driving') => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${mode}`;
/** Availability level used across the UI: share of free spaces. */
export function level(stats) {
  if (!stats?.open) return { key: 'closed', text: 'Closed', bg: 'bg-slate-100', color: 'text-slate-600', bar: '#94a3b8' };
  const p = stats.available / stats.capacity;
  if (p > 0.3) return { key: 'ok', text: 'Plenty', bg: 'bg-green-100', color: 'text-green-700', bar: '#22c55e' };
  if (p > 0.1) return { key: 'warn', text: 'Limited', bg: 'bg-amber-100', color: 'text-amber-700', bar: '#f59e0b' };
  return { key: 'full', text: stats.available ? 'Almost Full' : 'Full', bg: 'bg-red-100', color: 'text-red-600', bar: '#ef4444' };
}
export const UPI_APPS = ['Google Pay', 'PhonePe', 'Paytm', 'BHIM'];
export const SPACE_TYPES = { driveway: 'Driveway', 'covered-garage': 'Covered garage', 'open-plot': 'Open plot', stilt: 'Stilt parking' };

/** Downloads rows as a CSV file (client-side export). */
export function downloadCsv(filename, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
