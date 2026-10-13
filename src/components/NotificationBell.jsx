// Bell + dropdown for the signed-in user's notifications (stored by the backend,
// pushed live over Socket.io). Phone push is not connected in this build.
import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { api, dateTime, useLive } from '../lib/api';

export default function NotificationBell({ onOpenLink, showToast }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [ring, setRing] = useState(false);

  const load = () => api('GET', '/notifications').then((r) => { setItems(r.items); setUnread(r.unread); }).catch(() => {});
  useEffect(() => { load(); }, []);
  useLive({ 'notification:new': (n) => {
    setItems((x) => [n, ...x]); setUnread((u) => u + 1); showToast?.(n.title);
    setRing(true); setTimeout(() => setRing(false), 700);
  } });

  const openItem = async (n) => {
    if (!n.readAt) { api('POST', `/notifications/${n._id}/read`).catch(() => {}); setUnread((u) => Math.max(0, u - 1)); setItems((x) => x.map((i) => (i._id === n._id ? { ...i, readAt: new Date().toISOString() } : i))); }
    setOpen(false);
    onOpenLink?.(n.link || '');
  };
  const readAll = async () => {
    await api('POST', '/notifications/read-all').catch(() => {});
    setUnread(0); setItems((x) => x.map((i) => ({ ...i, readAt: i.readAt || new Date().toISOString() })));
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Notifications"
        className={`relative p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-all cursor-pointer ${ring ? 'animate-bounce' : ''}`}>
        <Bell className="w-4 h-4" />
        {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="dashboard-panel-enter absolute right-0 mt-2 z-50 w-[min(360px,90vw)] max-h-[70vh] overflow-y-auto bg-white rounded-2xl border border-sky-100 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white">
              <span className="text-sm font-bold text-slate-900">Notifications</span>
              <button type="button" onClick={readAll} className="text-[11px] font-semibold text-sky-700 hover:text-sky-800">Mark all read</button>
            </div>
            {items.length === 0 ? <p className="px-4 py-8 text-center text-xs text-slate-500">You're all caught up.</p> : items.map((n) => (
              <button key={n._id} type="button" onClick={() => openItem(n)} className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-sky-50/60 flex gap-3 ${n.readAt ? 'opacity-70' : ''}`}>
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.readAt ? 'bg-transparent' : 'bg-sky-500'}`} />
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900">{n.title}</span>
                  <span className="block text-[11px] text-slate-600">{n.body}</span>
                  <span className="block text-[10px] font-mono text-slate-400 mt-0.5">{dateTime(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
