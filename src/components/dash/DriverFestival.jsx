// Driver: Festival Mode — temporary parking zones opened by the Municipal Corporation.
import React, { useMemo, useState } from 'react';
import { PartyPopper, MapPin, Navigation, ShieldCheck, Accessibility, DoorOpen, Clock } from 'lucide-react';
import { api, dateTime, directionsUrl, inr, level, sectorLabel, useLive, useLoad } from '../../lib/api';
import LiveMap from '../LiveMap';
import { Btn, Empty, ErrorNote, Loading, Modal, Panel, Pill } from './ui';

export default function DriverFestival({ onViewLot, openZoneId, onZoneOpened }) {
  const fest = useLoad(() => api('GET', '/festival'));
  const [zoneId, setZoneId] = useState(openZoneId || null);
  React.useEffect(() => { if (openZoneId) { setZoneId(openZoneId); onZoneOpened?.(); } }, [openZoneId]); // eslint-disable-line react-hooks/exhaustive-deps
  useLive({ 'festival:update': () => fest.reload(), 'zone:update': () => fest.reload(), 'lot:update': (s) => { if (s.kind === 'temporary') fest.reload(); } });

  const f = fest.data;
  const markers = useMemo(() => (f?.zones ?? []).map((z) => ({ id: z._id, lat: z.lat, lng: z.lng, text: `+${z.stats.available}`, tone: 'temp', title: z.name })), [f]);

  if (fest.loading && !f) return <Loading />;
  return (
    <div className="space-y-6">
      <ErrorNote error={fest.error} onRetry={fest.reload} />
      {f && (f.active && f.activeZoneCount ? (
        <div className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 shadow-lg">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/50 text-[11px] font-mono font-bold mb-2">
            <span className="w-2 h-2 rounded-full bg-amber-700 animate-ping" /> FESTIVAL MODE
          </div>
          <h2 className="text-2xl font-black flex items-center gap-2"><PartyPopper className="w-6 h-6" />{f.label || 'Extra parking open'}</h2>
          <p className="text-sm font-medium mt-1">The Municipal Corporation has opened temporary parking zones for today's crowds.</p>
          <div className="mt-4 flex flex-wrap gap-6">
            <div><p className="text-3xl font-black">{f.activeZoneCount}</p><p className="text-[11px] font-semibold">extra zone{f.activeZoneCount === 1 ? '' : 's'} open</p></div>
            <div><p className="text-3xl font-black">{f.extraFree}</p><p className="text-[11px] font-semibold">extra spaces free</p></div>
            {f.nearest && <div><p className="text-3xl font-black">{sectorLabel(f.nearest.sector)}</p><p className="text-[11px] font-semibold">nearest zone</p></div>}
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><PartyPopper className="w-5 h-5" /></div>
          <div>
            <p className="text-sm font-bold text-slate-900">Planning a busy day?</p>
            <p className="text-xs text-slate-600 mt-0.5">During festivals and big events, the Municipal Corporation can open extra temporary parking. Active zones appear here, and you get an alert if you searched nearby.</p>
          </div>
        </div>
      ))}

      {f?.zones?.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-xs">
          <div className="px-4 py-3 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-800">Temporary zones · map</h3><p className="text-xs text-slate-500">Demo sites, locations not verified.</p></div>
          <LiveMap markers={markers} onSelect={setZoneId} className="h-64 sm:h-80" />
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(f?.zones ?? []).map((z) => {
          const lv = level(z.stats);
          return (
            <article key={z._id} className="rounded-2xl border-2 border-amber-200 bg-gradient-to-b from-amber-50 to-white p-5 transition-all hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex gap-1.5 mb-1"><Pill tone="yellow">TEMPORARY</Pill>{z.zone?.demo && <Pill>DEMO SITE</Pill>}</div>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">{z.name}</h4>
                </div>
                <div className="text-right shrink-0"><span className="text-xl font-black text-slate-900">{z.stats.available}</span><span className="text-xs text-slate-400">/{z.capacity}</span><p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">SLOTS FREE</p></div>
              </div>
              <p className="mt-2 text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" />{sectorLabel(z.sector)} · {inr(z.feeInr)}/entry</p>
              <span className={`mt-3 inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${lv.bg} ${lv.color}`}>{z.stats.available} free · {lv.text}</span>
              <div className="mt-4 flex gap-2">
                <Btn className="flex-1" onClick={() => setZoneId(z._id)}>Zone details</Btn>
                <a href={directionsUrl(z.lat, z.lng)} target="_blank" rel="noreferrer" className="flex-1 py-2 rounded-xl border-2 border-slate-200 hover:border-sky-300 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"><Navigation className="w-3.5 h-3.5 text-sky-500" />Directions</a>
              </div>
            </article>
          );
        })}
      </div>
      {f && !f.zones?.length && <Empty>No temporary zones are open right now.</Empty>}

      {zoneId && <ZoneModal id={zoneId} onClose={() => setZoneId(null)} onViewLot={(id) => { setZoneId(null); onViewLot(id); }} />}
    </div>
  );
}

function ZoneModal({ id, onClose, onViewLot }) {
  const r = useLoad(() => api('GET', `/zones/${encodeURIComponent(id)}`), [id]);
  const z = r.data?.zone;
  const open = z && z.zone.status === 'active' && z.stats.open;
  return (
    <Modal title={z?.name ?? 'Temporary zone'} sub={z ? `${z.address} · ${sectorLabel(z.sector)}` : ''} onClose={onClose}>
      {r.loading && !z ? <Loading /> : <ErrorNote error={r.error} />}
      {z && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5"><Pill tone="yellow">TEMPORARY ZONE</Pill>{z.zone.demo && <Pill>DEMO SITE · NOT VERIFIED</Pill>}{open ? <Pill tone="green">OPEN</Pill> : <Pill tone="red">NOT OPEN</Pill>}</div>
          {open ? (
            <div className="flex items-end gap-3"><span className="text-4xl font-black text-amber-600">{z.stats.available}</span><span className="text-xs text-slate-500 pb-1.5">spaces free · {z.stats.occupied} parked of {z.capacity}</span></div>
          ) : (
            <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">This zone only opens when the Municipal Corporation activates it for an event.</p>
          )}
          <LiveMap markers={[{ id: z._id, lat: z.lat, lng: z.lng, text: open ? `+${z.stats.available}` : 'P', tone: 'temp' }]} className="h-48 rounded-2xl overflow-hidden" />
          <div className="space-y-2 text-xs">
            {[
              [Clock, 'Open', z.zone.startsAt ? `${dateTime(z.zone.startsAt)} – ${dateTime(z.zone.endsAt)}` : 'During the event'],
              [DoorOpen, 'Entry gates', (z.zone.entryPoints ?? []).join(' · ') || 'Follow signs'],
              [ShieldCheck, 'Rules', z.zone.restrictions || "Follow the attendant's directions."],
              [Accessibility, 'Accessibility', z.zone.accessibility || 'Ask the attendant at the gate.'],
            ].map(([Icon, k, v]) => (
              <div key={k} className="flex gap-3 p-3 rounded-xl bg-slate-50"><Icon className="w-4 h-4 text-amber-600 shrink-0" /><div><p className="font-bold text-slate-800">{k}</p><p className="text-slate-600">{v}</p></div></div>
            ))}
            <p className="text-slate-500">Fee {inr(z.feeInr)} per visit, paid to the attendant (cash or UPI). Vehicles: {(z.zone.vehicles ?? []).join(', ')}.</p>
          </div>
          <div className="flex gap-2">
            <a href={directionsUrl(z.lat, z.lng)} target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white"><Navigation className="w-3.5 h-3.5" />Get directions</a>
            {open && <Btn tone="ghost" className="flex-1" onClick={() => onViewLot(z._id)}>Reserve or check in</Btn>}
          </div>
        </div>
      )}
    </Modal>
  );
}
