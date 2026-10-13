// Driver as host: list a space (reviewed by the MC), manage availability, see bookings.
import React, { useState } from 'react';
import { KeyRound, Pause, Play, Pencil, Trash2, Plus } from 'lucide-react';
import { api, dateTime, inr, sectorLabel, SPACE_TYPES, hhmm12, useLive, useLoad } from '../../lib/api';
import LiveMap from '../LiveMap';
import { Btn, DemoNote, Empty, ErrorNote, Field, inputCls, Loading, Modal, Panel, Pill } from './ui';

const LSTATUS = { pending: ['Waiting for MC review', 'amber'], active: ['Live', 'green'], paused: ['Paused', 'slate'], rejected: ['Not approved', 'red'], suspended: ['Suspended by MC', 'red'] };
const BSTATUS = { confirmed: 'Confirmed', completed: 'Completed', 'cancelled-by-driver': 'Cancelled by driver', 'cancelled-by-host': 'Cancelled by you', 'no-show': 'No-show' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DriverHost({ showToast, onOpenBooking }) {
  const listings = useLoad(() => api('GET', '/host/listings'));
  const bookings = useLoad(() => api('GET', '/host/bookings'));
  const [editing, setEditing] = useState(null); // null | 'new' | listing
  const [err, setErr] = useState(null);
  useLive({ 'listing:update': () => listings.reload(), 'notification:new': () => { listings.reload(); bookings.reload(); } });

  const act = async (fn, msg) => { setErr(null); try { await fn(); showToast(msg); listings.reload(); bookings.reload(); } catch (e) { setErr(e); } };
  const ls = listings.data?.listings ?? [];
  const bs = bookings.data?.bookings ?? [];
  const upcoming = bs.filter((b) => b.status === 'confirmed' && new Date(b.end) > Date.now());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><KeyRound className="w-5 h-5 text-blue-600" />Host a space</h2>
          <p className="text-sm text-slate-500 mt-0.5">Rent out your empty driveway or garage by the hour. Every listing is reviewed by the Municipal Corporation first.</p>
        </div>
        <Btn onClick={() => setEditing('new')}><Plus className="w-3.5 h-3.5" />List a space</Btn>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[['Earnings (demo)', inr(bookings.data?.earningsInr ?? 0), 'No real payouts in this demo'], ['Live listings', ls.filter((l) => l.status === 'active').length, `${ls.length} total`], ['Upcoming bookings', upcoming.length, `${bs.length} all time`]].map(([k, v, s]) => (
          <div key={k} className="p-5 rounded-2xl bg-white border border-sky-100 shadow-xs"><p className="text-xs text-slate-500 font-medium">{k}</p><p className="text-2xl font-black mt-2 text-slate-900">{v}</p><p className="text-[11px] text-slate-500 mt-1">{s}</p></div>
        ))}
      </div>
      <ErrorNote error={err || listings.error} />
      {listings.loading && !listings.data ? <Loading /> : ls.length === 0 ? <Empty>No spaces yet. List your first one — it goes live after MC approval.</Empty> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ls.map((l) => { const [t, tone] = LSTATUS[l.status] ?? [l.status, 'slate']; return (
            <article key={l._id} className="rounded-2xl border-2 border-blue-100 bg-white p-5">
              <div className="flex flex-wrap gap-1.5"><Pill tone={tone}>{t}</Pill><Pill tone="sky">{SPACE_TYPES[l.type]}</Pill>{l.demo && <Pill>DEMO</Pill>}</div>
              <h4 className="mt-2 text-sm font-bold text-slate-900">{l.title}</h4>
              <p className="mt-1 text-xs text-slate-500">{sectorLabel(l.sector)} · {inr(l.ratePerHourInr)}/h · {l.spaces} space{l.spaces === 1 ? '' : 's'} · {l.rating ? `★ ${l.rating.avg}` : `${l.reviewCount} review${l.reviewCount === 1 ? '' : 's'}`}</p>
              <p className="mt-1 text-[11px] text-slate-500">{l.availability.map((w) => `${w.days.length === 7 ? 'Every day' : w.days.map((d) => DAYS[d]).join(', ')} ${hhmm12(w.start)}–${hhmm12(w.end)}`).join('; ')}</p>
              {l.statusNote && <p className="mt-2 p-2 rounded-lg bg-rose-50 text-rose-700 text-[11px]">{l.statusNote}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {l.status === 'active' && <Btn tone="ghost" onClick={() => act(() => api('PATCH', `/host/listings/${l._id}`, { status: 'paused' }), "Paused: drivers can't book it")}><Pause className="w-3.5 h-3.5" />Pause</Btn>}
                {l.status === 'paused' && <Btn tone="green" onClick={() => act(() => api('PATCH', `/host/listings/${l._id}`, { status: 'active' }), 'Live again')}><Play className="w-3.5 h-3.5" />Resume</Btn>}
                {!['rejected', 'suspended'].includes(l.status) && <Btn tone="soft" onClick={() => setEditing(l)}><Pencil className="w-3.5 h-3.5" />Edit</Btn>}
                <Btn tone="danger" onClick={() => window.confirm("Delete this listing? This can't be undone.") && act(() => api('DELETE', `/host/listings/${l._id}`), 'Listing deleted')}><Trash2 className="w-3.5 h-3.5" />Delete</Btn>
              </div>
            </article>
          ); })}
        </div>
      )}
      <Panel title="Bookings" sub="Payouts are not real in this demo.">
        {bs.length === 0 ? <p className="text-xs text-slate-500">No bookings yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="text-left text-[10px] font-mono text-slate-400 uppercase border-b border-slate-100"><th className="pb-2 pr-3">Booking</th><th className="pb-2 pr-3">Space</th><th className="pb-2 pr-3">When</th><th className="pb-2 pr-3">Driver</th><th className="pb-2 pr-3">Amount</th><th className="pb-2 pr-3">Status</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">{bs.map((b) => (
              <tr key={b._id}>
                <td className="py-2.5 pr-3"><button type="button" className="font-mono text-sky-700 underline" onClick={() => onOpenBooking(b._id)}>{b._id}</button></td>
                <td className="py-2.5 pr-3">{b.title}</td><td className="py-2.5 pr-3 whitespace-nowrap">{dateTime(b.start)} · {b.hours} h</td>
                <td className="py-2.5 pr-3">{b.driverFirstName ?? 'Driver'}{b.vehicleNo ? ` · ${b.vehicleNo}` : ''}</td>
                <td className="py-2.5 pr-3">{inr(b.totalInr)}{b.refundInr ? ` (refunded ${inr(b.refundInr)})` : ''}</td>
                <td className="py-2.5 pr-3">{BSTATUS[b.status] ?? b.status}</td>
                <td>{b.status === 'confirmed' && new Date(b.end) > Date.now() && <Btn tone="danger" className="!px-3 !py-1.5" onClick={() => window.confirm('Cancel? The driver gets a full refund.') && act(() => api('POST', `/host/bookings/${b._id}/cancel`), 'Booking cancelled. Driver refunded (demo).')}>Cancel</Btn>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Panel>
      {editing && <ListingForm listing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); showToast(msg); listings.reload(); }} />}
    </div>
  );
}

function ListingForm({ listing, onClose, onSaved }) {
  const [v, setV] = useState(() => ({
    title: listing?.title ?? '', type: listing?.type ?? 'driveway', spaces: listing?.spaces ?? 1, covered: Boolean(listing?.covered),
    vehicleFit: listing?.vehicleFit ?? ['hatchback', 'sedan'], dimensions: listing?.dimensions ?? '', surface: listing?.surface ?? '', entranceWidth: listing?.entranceWidth ?? '', clearance: listing?.clearance ?? '',
    sector: listing?.sector ?? '', landmark: listing?.landmark ?? '', exactAddress: listing?.exactAddress ?? '', accessInstructions: listing?.accessInstructions ?? '',
    ratePerHourInr: listing?.ratePerHourInr ?? 40, rules: listing?.rules ?? '', blockedDates: (listing?.blockedDates ?? []).join(', '),
    availability: listing?.availability?.map((w) => ({ ...w, days: [...w.days] })) ?? [{ days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '18:00' }],
  }));
  const [pin, setPin] = useState(listing?.exactLat ? { lat: listing.exactLat, lng: listing.exactLng } : null);
  const [declaration, setDeclaration] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const times = []; for (let m = 0; m <= 1440; m += 30) times.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  const setWin = (i, patch) => setV((x) => ({ ...x, availability: x.availability.map((w, j) => (j === i ? { ...w, ...patch } : w)) }));

  const save = async () => {
    setErr(null); setBusy(true);
    const body = { ...v, spaces: Number(v.spaces), ratePerHourInr: Number(v.ratePerHourInr), sector: String(v.sector).replace(/^sector\s*/i, ''),
      blockedDates: v.blockedDates.split(/[,\s]+/).filter(Boolean), ...(pin ?? {}) };
    try {
      if (listing) { await api('PATCH', `/host/listings/${listing._id}`, body); onSaved('Changes saved'); }
      else { if (!declaration) throw new Error('Please confirm the ownership declaration.'); await api('POST', '/host/listings', { ...body, declaration: true }); onSaved('Submitted. The MC will review it.'); }
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <Modal wide title={listing ? 'Edit space' : 'List a space'} sub="Drivers only see an approximate area until 2 hours before their booking." onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-3">
          <Field label="Title"><input className={inputCls} value={v.title} onChange={set('title')} placeholder="Covered garage near Sector 22 market" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><select className={inputCls} value={v.type} onChange={set('type')}>{Object.entries(SPACE_TYPES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Field>
            <Field label="Spaces"><input className={inputCls} type="number" min="1" max="10" value={v.spaces} onChange={set('spaces')} /></Field>
          </div>
          <div className="flex flex-wrap gap-2">{['hatchback', 'sedan', 'suv', 'two-wheeler'].map((f) => (
            <button key={f} type="button" onClick={() => setV((x) => ({ ...x, vehicleFit: x.vehicleFit.includes(f) ? x.vehicleFit.filter((y) => y !== f) : [...x.vehicleFit, f] }))}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${v.vehicleFit.includes(f) ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>{f}</button>
          ))}</div>
          <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={v.covered} onChange={set('covered')} className="accent-sky-600" />Covered</label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Size"><input className={inputCls} value={v.dimensions} onChange={set('dimensions')} placeholder="5 m x 2.6 m" /></Field>
            <Field label="Surface"><input className={inputCls} value={v.surface} onChange={set('surface')} placeholder="Paved" /></Field>
            <Field label="Entrance width"><input className={inputCls} value={v.entranceWidth} onChange={set('entranceWidth')} placeholder="2.8 m" /></Field>
            <Field label="Height limit"><input className={inputCls} value={v.clearance} onChange={set('clearance')} placeholder="2.2 m" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price per hour (₹)"><input className={inputCls} type="number" min="1" max="1000" value={v.ratePerHourInr} onChange={set('ratePerHourInr')} /></Field>
            <Field label="Blocked dates"><input className={inputCls} value={v.blockedDates} onChange={set('blockedDates')} placeholder="2026-10-20" /></Field>
          </div>
          <div>
            <span className="block text-[11px] font-mono font-bold uppercase text-slate-500 mb-1">Available hours</span>
            {v.availability.map((w, i) => (
              <div key={i} className="p-3 rounded-xl border border-slate-200 mb-2 space-y-2">
                <div className="flex flex-wrap gap-1">{DAYS.map((d, n) => <button key={d} type="button" onClick={() => setWin(i, { days: w.days.includes(n) ? w.days.filter((x) => x !== n) : [...w.days, n].sort() })} className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${w.days.includes(n) ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>{d}</button>)}</div>
                <div className="flex items-center gap-2">
                  <select className={inputCls} value={w.start} onChange={(e) => setWin(i, { start: e.target.value })}>{times.slice(0, -1).map((t) => <option key={t} value={t}>{hhmm12(t)}</option>)}</select>
                  <span className="text-xs text-slate-400">to</span>
                  <select className={inputCls} value={w.end} onChange={(e) => setWin(i, { end: e.target.value })}>{times.slice(1).map((t) => <option key={t} value={t}>{t === '24:00' ? 'Midnight' : hhmm12(t)}</option>)}</select>
                  {v.availability.length > 1 && <button type="button" className="text-rose-600 text-xs font-bold" onClick={() => setV((x) => ({ ...x, availability: x.availability.filter((_, j) => j !== i) }))}>✕</button>}
                </div>
              </div>
            ))}
            <button type="button" className="text-xs font-bold text-sky-700" onClick={() => setV((x) => ({ ...x, availability: [...x.availability, { days: [6, 0], start: '10:00', end: '20:00' }] }))}>+ Add a time window</button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sector"><input className={inputCls} value={v.sector} onChange={set('sector')} placeholder="22" /></Field>
            <Field label="Landmark (public)"><input className={inputCls} value={v.landmark} onChange={set('landmark')} placeholder="Sector 22 market" /></Field>
          </div>
          <div>
            <span className="block text-[11px] font-mono font-bold uppercase text-slate-500 mb-1">Tap the map on your gate</span>
            <LiveMap markers={pin ? [{ id: 'pin', lat: pin.lat, lng: pin.lng, text: 'P', tone: 'home' }] : []} onMapClick={(p) => setPin({ lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 })} fit={false} center={pin ? [pin.lat, pin.lng] : undefined} className="h-56 rounded-2xl overflow-hidden" />
            <DemoNote>{pin ? `Pin at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)} — only you and the MC see it.` : 'No pin yet.'}</DemoNote>
          </div>
          <Field label="Exact address (private)"><input className={inputCls} value={v.exactAddress} onChange={set('exactAddress')} placeholder="House no., street, sector" /></Field>
          <Field label="How to get in (private)"><textarea className={inputCls} rows={2} value={v.accessInstructions} onChange={set('accessInstructions')} /></Field>
          <Field label="House rules"><textarea className={inputCls} rows={2} value={v.rules} onChange={set('rules')} /></Field>
          {!listing && <label className="flex gap-2 text-xs text-slate-600"><input type="checkbox" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} className="mt-0.5 accent-sky-600" />I own this space or have the owner's permission, and renting it follows my society/RWA rules and local regulations.</label>}
          <ErrorNote error={err} />
          <Btn className="w-full" busy={busy} onClick={save}>{listing ? 'Save changes' : 'Submit for MC review'}</Btn>
        </div>
      </div>
    </Modal>
  );
}
