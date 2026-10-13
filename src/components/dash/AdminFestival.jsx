// MC admin: Festival Mode — banner switch, overflow recommendations, temporary zones, thresholds.
import React, { useState } from 'react';
import { PartyPopper, Zap, Check, X, Ban } from 'lucide-react';
import { api, sectorLabel, time, useLive, useLoad } from '../../lib/api';
import { Btn, DemoNote, ErrorNote, inputCls, Loading, Panel, Pill } from './ui';

const OV = { pending: ['Needs decision', 'yellow'], activated: ['Zone opened', 'green'], 'auto-activated': ['Opened automatically', 'green'], dismissed: ['Dismissed', 'slate'], 'no-zone': ['No eligible zone', 'red'] };

export default function AdminFestival({ showToast }) {
  const r = useLoad(() => api('GET', '/admin/festival'));
  const [label, setLabel] = useState('');
  const [fillLot, setFillLot] = useState('s17-ml');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [th, setTh] = useState({});
  useLive({ 'overflow:new': (o) => { showToast(`${o.lotName} is ${o.occupancyPct}% full`); r.reload(); }, 'zone:update': () => r.reload(), 'festival:update': () => r.reload() });
  React.useEffect(() => { if (r.data && !label) setLabel(r.data.setting.label ?? ''); }, [r.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (key, fn, msg) => { setBusy(key); setErr(null); try { const out = await fn(); if (msg) showToast(typeof msg === 'function' ? msg(out) : msg); await r.reload(); } catch (e) { setErr(e); } finally { setBusy(null); } };
  const d = r.data;
  if (r.loading && !d) return <Loading />;
  const fillable = (d?.lots ?? []).filter((l) => (l.overflow?.zoneIds ?? []).length);

  return (
    <div className="space-y-6">
      <ErrorNote error={err || r.error} onRetry={r.reload} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title={<span className="flex items-center gap-2"><PartyPopper className="w-4 h-4 text-amber-500" />Festival Mode</span>} sub="The switch only changes the drivers' banner. Extra parking opens only for zones you activate below (or zones with a pre-approved automatic policy)."
          right={d?.setting?.active ? <Pill tone="yellow">BANNER ON</Pill> : <Pill>BANNER OFF</Pill>}>
          <div className="flex flex-col sm:flex-row gap-2">
            <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label for drivers, e.g. Diwali at Sector 17" maxLength={80} />
            <Btn tone="purple" busy={busy === 'on'} onClick={() => act('on', () => api('POST', '/admin/festival', { active: true, label: label.trim() || undefined }), 'Festival banner on')}>Turn on</Btn>
            <Btn tone="ghost" busy={busy === 'off'} onClick={() => act('off', () => api('POST', '/admin/festival', { active: false }), 'Festival banner off')}>Turn off</Btn>
          </div>
          <p className="mt-3 text-xs text-slate-500">{d?.zones.filter((z) => z.zone.status === 'active').length ?? 0} temporary zone(s) active right now.</p>
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" />Demo: trigger overflow</span>} sub="Fills a busy lot with SIMULATED cars so the overflow alert appears on stage. Turn off with DEMO_TOOLS=false on the server.">
          <div className="flex flex-col sm:flex-row gap-2">
            <select className={inputCls} value={fillLot} onChange={(e) => setFillLot(e.target.value)}>{fillable.map((l) => <option key={l._id} value={l._id}>{l.name} → {l.overflow.zoneIds.join(', ')}</option>)}</select>
            <Btn tone="amber" busy={busy === 'fill'} onClick={() => act('fill', () => api('POST', '/admin/demo/fill', { lotId: fillLot, targetPct: 95 }), (o) => `Filled ${o.filled} slots (simulated). ${o.overflow ? `Overflow: ${o.overflow.status}.` : 'No new overflow event.'}`)}>Fill to 95%</Btn>
          </div>
          <DemoNote>Pick a lot that's open right now (Sector 17 Multi-Level is open 24 h).</DemoNote>
        </Panel>
      </div>

      <Panel title="Overflow recommendations" sub="A lot raises one alert when it crosses its threshold, and re-arms only after dropping below threshold minus buffer.">
        {(d?.overflow ?? []).length === 0 ? <p className="text-xs text-slate-500">No overflow so far.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="text-left text-[10px] font-mono text-slate-400 uppercase border-b border-slate-100"><th className="pb-2 pr-3">When</th><th className="pb-2 pr-3">Lot</th><th className="pb-2 pr-3">Full</th><th className="pb-2 pr-3">Recommended zone</th><th className="pb-2 pr-3">Status</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">{d.overflow.slice(0, 12).map((e) => { const [t, tone] = OV[e.status] ?? [e.status, 'slate']; return (
              <tr key={e._id} className={e.status === 'pending' ? 'bg-amber-50/60' : ''}>
                <td className="py-2.5 pr-3 font-mono">{time(e.crossedAt)}</td><td className="py-2.5 pr-3 font-bold">{e.lotName}</td><td className="py-2.5 pr-3">{e.occupancyPct}%</td>
                <td className="py-2.5 pr-3">{e.recommended.length ? e.recommended.map((x) => x.name).join(', ') : <span className="text-slate-400">{e.note}</span>}</td>
                <td className="py-2.5 pr-3"><Pill tone={tone}>{t}</Pill></td>
                <td className="py-2.5 whitespace-nowrap">{e.status === 'pending' && (<span className="flex gap-1.5">
                  <Btn tone="purple" className="!px-3 !py-1.5" busy={busy === `a${e._id}`} onClick={() => act(`a${e._id}`, () => api('POST', `/admin/overflow/${e._id}/activate`, {}), 'Zone opened. Nearby drivers notified.')}><Check className="w-3 h-3" />Activate</Btn>
                  <Btn tone="ghost" className="!px-3 !py-1.5" busy={busy === `d${e._id}`} onClick={() => act(`d${e._id}`, () => api('POST', `/admin/overflow/${e._id}/dismiss`), 'Dismissed')}><X className="w-3 h-3" />Dismiss</Btn>
                </span>)}</td>
              </tr>
            ); })}</tbody>
          </table></div>
        )}
      </Panel>

      <Panel title="Temporary zones" sub="A zone can take cars only when it is approved, inside its window, has a worker assigned, and is activated.">
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left text-[10px] font-mono text-slate-400 uppercase border-b border-slate-100"><th className="pb-2 pr-3">Zone</th><th className="pb-2 pr-3">Status</th><th className="pb-2 pr-3">Spaces</th><th className="pb-2 pr-3">Approved</th><th className="pb-2 pr-3">Auto-open</th><th className="pb-2 pr-3">Workers</th><th className="pb-2 pr-3">Checks</th><th /></tr></thead>
          <tbody className="divide-y divide-slate-100">{(d?.zones ?? []).map((z) => { const on = z.zone.status === 'active'; return (
            <tr key={z._id}>
              <td className="py-2.5 pr-3"><p className="font-bold text-slate-800">{z.name}</p><p className="text-[10px] text-slate-500">{sectorLabel(z.sector)} · linked to {(z.zone.linkedLotIds ?? []).join(', ') || '—'}{z.zone.demo ? ' · demo site' : ''}</p></td>
              <td className="py-2.5 pr-3">{on ? <Pill tone="green">ACTIVE</Pill> : <Pill>{z.zone.status}</Pill>}</td>
              <td className="py-2.5 pr-3">{on ? `${z.stats.available} free / ${z.capacity}` : z.capacity}</td>
              <td className="py-2.5 pr-3"><input type="checkbox" className="accent-purple-600" checked={Boolean(z.zone.approved)} onChange={(e) => act(`ap${z._id}`, () => api('PATCH', `/admin/zones/${z._id}`, { approved: e.target.checked }), 'Zone updated')} /></td>
              <td className="py-2.5 pr-3"><input type="checkbox" className="accent-purple-600" checked={Boolean(z.zone.autoActivate)} onChange={(e) => act(`au${z._id}`, () => api('PATCH', `/admin/zones/${z._id}`, { autoActivate: e.target.checked }), 'Zone updated')} /></td>
              <td className="py-2.5 pr-3">{z.workers.join(', ') || 'none'}</td>
              <td className="py-2.5 pr-3 max-w-[220px]">{z.problems.length ? <span className="text-rose-600">✗ {z.problems.join('; ')}</span> : <span className="text-emerald-600">✓ ready</span>}</td>
              <td className="py-2.5">{on
                ? <Btn tone="danger" className="!px-3 !py-1.5" busy={busy === `z${z._id}`} onClick={() => window.confirm('Close this zone? New entries stop; parked cars can still exit.') && act(`z${z._id}`, () => api('POST', `/admin/zones/${z._id}/deactivate`), 'Zone closed')}><Ban className="w-3 h-3" />Close</Btn>
                : <Btn tone="purple" className="!px-3 !py-1.5" disabled={z.problems.length > 0} busy={busy === `z${z._id}`} onClick={() => act(`z${z._id}`, () => api('POST', `/admin/zones/${z._id}/activate`), 'Zone opened. Nearby drivers notified.')}>Activate</Btn>}</td>
            </tr>
          ); })}</tbody>
        </table></div>
      </Panel>

      <Panel title="Overflow thresholds">
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left text-[10px] font-mono text-slate-400 uppercase border-b border-slate-100"><th className="pb-2 pr-3">Lot</th><th className="pb-2 pr-3">Now</th><th className="pb-2 pr-3">Threshold %</th><th className="pb-2 pr-3">Buffer %</th><th className="pb-2 pr-3">Overflow zones</th><th /></tr></thead>
          <tbody className="divide-y divide-slate-100">{(d?.lots ?? []).map((l) => { const cur = th[l._id] ?? { t: l.overflow?.thresholdPct ?? 90, b: l.overflow?.bufferPct ?? 5 }; return (
            <tr key={l._id}>
              <td className="py-2 pr-3 font-bold">{l.name}</td><td className="py-2 pr-3">{l.occupancyPct}%</td>
              <td className="py-2 pr-3"><input className={`${inputCls} !w-20 !py-1.5`} inputMode="numeric" value={cur.t} onChange={(e) => setTh((x) => ({ ...x, [l._id]: { ...cur, t: e.target.value } }))} /></td>
              <td className="py-2 pr-3"><input className={`${inputCls} !w-20 !py-1.5`} inputMode="numeric" value={cur.b} onChange={(e) => setTh((x) => ({ ...x, [l._id]: { ...cur, b: e.target.value } }))} /></td>
              <td className="py-2 pr-3">{(l.overflow?.zoneIds ?? []).join(', ') || '—'}</td>
              <td className="py-2"><Btn tone="ghost" className="!px-3 !py-1.5" busy={busy === `t${l._id}`} onClick={() => act(`t${l._id}`, () => api('PATCH', `/admin/lots/${l._id}`, { thresholdPct: Number(cur.t), bufferPct: Number(cur.b) }), 'Overflow settings saved')}>Save</Btn></td>
            </tr>
          ); })}</tbody>
        </table></div>
      </Panel>
    </div>
  );
}
