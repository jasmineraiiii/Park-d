// MC admin: Neighbourhood Parking moderation — approve new spaces, handle reports, suspend listings.
import React, { useState } from 'react';
import { House } from 'lucide-react';
import { api, dateTime, inr, sectorLabel, SPACE_TYPES, useLive, useLoad } from '../../lib/api';
import { Btn, ErrorNote, inputCls, Loading, Panel, Pill } from './ui';

export default function AdminNeighbourhood({ showToast }) {
  const r = useLoad(() => api('GET', '/admin/neighbourhood'));
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  useLive({ 'listing:update': () => r.reload(), 'notification:new': (n) => { if (/^(report|listing)/.test(n.type ?? '')) r.reload(); } });
  const act = async (key, fn, msg) => { setBusy(key); setErr(null); try { await fn(); showToast(msg); await r.reload(); } catch (e) { setErr(e); } finally { setBusy(null); } };
  const moderate = (id, action, note) => act(`${action}${id}`, () => api('POST', `/admin/listings/${id}/${action}`, { note: note || undefined }), `Listing ${action === 'approve' ? 'approved and live' : `${action === 'reinstate' ? 'reinstated' : `${action}ed`}`}`);
  const d = r.data;
  if (r.loading && !d) return <Loading />;

  return (
    <div className="space-y-6">
      <ErrorNote error={err || r.error} onRetry={r.reload} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[['Live listings', d?.counts.active ?? 0, `${d?.counts.paused ?? 0} paused`], ['Waiting for review', d?.counts.pending ?? 0, 'new spaces'], ['Bookings this week', d?.bookingsThisWeek ?? 0, 'confirmed + completed'], ['Open reports', d?.openReports ?? 0, `${d?.counts.suspended ?? 0} suspended listings`]].map(([k, v, s]) => (
          <div key={k} className="p-5 rounded-2xl bg-white border border-sky-100 shadow-xs"><p className="text-xs text-slate-500 font-medium">{k}</p><p className="text-2xl font-black mt-2 text-slate-900">{v}</p><p className="text-[11px] text-slate-500 mt-1">{s}</p></div>
        ))}
      </div>

      <Panel title={<span className="flex items-center gap-2"><House className="w-4 h-4 text-blue-600" />Waiting for review</span>}>
        {(d?.pending ?? []).length === 0 ? <p className="text-xs text-slate-500">Nothing waiting. New host listings appear here.</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{d.pending.map((l) => (
            <article key={l._id} className="rounded-2xl border-2 border-blue-100 p-4 space-y-2 text-xs">
              <div className="flex flex-wrap gap-1.5"><Pill tone="sky">{SPACE_TYPES[l.type]}</Pill><Pill>{sectorLabel(l.sector)}</Pill>{l.demo && <Pill>DEMO</Pill>}</div>
              <p className="text-sm font-bold text-slate-900">{l.title}</p>
              <p><b>Host:</b> {l.hostName ?? '—'} · {inr(l.ratePerHourInr)}/h · {l.spaces} space(s)</p>
              <p><b>Address (private):</b> {l.exactAddress}</p>
              <p className="text-slate-500">Declaration {l.declarationAccepted ? 'accepted ✓' : 'missing ✗'} · submitted {dateTime(l.createdAt)}</p>
              <input className={inputCls} placeholder="Note to host (optional)" value={notes[l._id] ?? ''} onChange={(e) => setNotes((x) => ({ ...x, [l._id]: e.target.value }))} />
              <div className="flex gap-2"><Btn tone="purple" busy={busy === `approve${l._id}`} onClick={() => moderate(l._id, 'approve', notes[l._id])}>Approve</Btn><Btn tone="danger" busy={busy === `reject${l._id}`} onClick={() => moderate(l._id, 'reject', notes[l._id] || window.prompt('Reason (sent to the host):') || undefined)}>Reject</Btn></div>
            </article>
          ))}</div>
        )}
      </Panel>

      <Panel title="Reports">
        {(d?.reports ?? []).length === 0 ? <p className="text-xs text-slate-500">No reports.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="text-left text-[10px] font-mono text-slate-400 uppercase border-b border-slate-100"><th className="pb-2 pr-3">When</th><th className="pb-2 pr-3">Booking</th><th className="pb-2 pr-3">From</th><th className="pb-2 pr-3">Problem</th><th className="pb-2 pr-3">Details</th><th className="pb-2 pr-3">Status</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">{d.reports.map((x) => (
              <tr key={x._id}>
                <td className="py-2.5 pr-3 whitespace-nowrap">{dateTime(x.createdAt)}</td><td className="py-2.5 pr-3 font-mono">{x.bookingId}</td><td className="py-2.5 pr-3">{x.reporterRole}</td><td className="py-2.5 pr-3">{x.kind}</td><td className="py-2.5 pr-3 max-w-[240px]">{x.details || '—'}</td>
                <td className="py-2.5 pr-3"><Pill tone={x.status === 'open' ? 'red' : 'slate'}>{x.status}</Pill></td>
                <td className="py-2.5 whitespace-nowrap">{x.status === 'open' && <span className="flex gap-1.5">
                  <Btn tone="ghost" className="!px-3 !py-1.5" busy={busy === `r${x._id}`} onClick={() => act(`r${x._id}`, () => api('POST', `/admin/reports/${x._id}/resolve`), 'Report resolved')}>Resolve</Btn>
                  <Btn tone="danger" className="!px-3 !py-1.5" onClick={() => { const note = window.prompt('Reason for suspending (sent to the host):'); if (note === null) return; act(`s${x._id}`, async () => { await api('POST', `/admin/listings/${x.listingId}/suspend`, { note: note || undefined }); await api('POST', `/admin/reports/${x._id}/resolve`); }, 'Listing suspended'); }}>Suspend listing</Btn>
                </span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Panel>

      <Panel title="Listings">
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left text-[10px] font-mono text-slate-400 uppercase border-b border-slate-100"><th className="pb-2 pr-3">Listing</th><th className="pb-2 pr-3">Sector</th><th className="pb-2 pr-3">Rate</th><th className="pb-2 pr-3">Status</th><th /></tr></thead>
          <tbody className="divide-y divide-slate-100">{(d?.listings ?? []).map((l) => (
            <tr key={l._id}>
              <td className="py-2.5 pr-3 font-bold">{l.title} {l.demo && <Pill>DEMO</Pill>}</td><td className="py-2.5 pr-3">{sectorLabel(l.sector)}</td><td className="py-2.5 pr-3">{inr(l.ratePerHourInr)}/h</td>
              <td className="py-2.5 pr-3"><Pill tone={l.status === 'active' ? 'green' : l.status === 'suspended' ? 'red' : 'slate'}>{l.status}</Pill></td>
              <td className="py-2.5">{l.status === 'suspended'
                ? <Btn tone="ghost" className="!px-3 !py-1.5" busy={busy === `reinstate${l._id}`} onClick={() => moderate(l._id, 'reinstate')}>Reinstate</Btn>
                : <Btn tone="danger" className="!px-3 !py-1.5" busy={busy === `suspend${l._id}`} onClick={() => { const note = window.prompt('Reason (sent to the host):'); if (note !== null) moderate(l._id, 'suspend', note); }}>Suspend</Btn>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Panel>
    </div>
  );
}
