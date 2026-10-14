// Driver: Neighbourhood Parking — residents' driveways and garages by the hour.
// Prices come from the server; the exact address unlocks 2 hours before the booking.
import React, { useEffect, useMemo, useState } from 'react';
import { House, Search, Lock, Navigation, Star, Footprints, Check } from 'lucide-react';
import { api, dateTime, dayLabel, directionsUrl, hhmm12, inr, istToday, sectorLabel, SPACE_TYPES, UPI_APPS, useLoad } from '../../lib/api';
import LiveMap from '../LiveMap';
import { Btn, DemoNote, Empty, ErrorNote, Field, inputCls, Loading, Modal, Panel, Pill } from './ui';

const STATUS = {
  'pending-payment': ['Awaiting payment', 'amber'], confirmed: ['Confirmed', 'green'], completed: ['Completed', 'slate'],
  expired: ['Hold expired', 'slate'], 'cancelled-by-driver': ['Cancelled', 'red'], 'cancelled-by-host': ['Cancelled by host', 'red'], 'no-show': ['No-show', 'red'],
};
const FIT = { hatchback: 'Hatchback', sedan: 'Sedan', suv: 'SUV', 'two-wheeler': 'Two-wheeler' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DriverNeighbourhood({ showToast, initialQuery = '', openBookingId, onBookingOpened, onHost }) {
  const [f, setF] = useState({ q: initialQuery, date: '', start: '', hours: '', maxPrice: '', maxWalkMin: '', vehicle: '' });
  const [query, setQuery] = useState(f);
  const [listingId, setListingId] = useState(null);
  const [bookingId, setBookingId] = useState(openBookingId || null);
  useEffect(() => { if (openBookingId) { setBookingId(openBookingId); onBookingOpened?.(); } }, [openBookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const params = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) p.set(k, v);
    if (p.get('start') && p.get('hours') && !p.get('date')) p.set('date', istToday());
    return p.toString();
  }, [query]);
  const res = useLoad(() => api('GET', `/listings?${params}`), [params]);
  const mine = useLoad(() => api('GET', '/neighbourhood-bookings'));
  const set = (k) => (e) => { const v = e.target.value; setF((x) => ({ ...x, [k]: v })); if (k !== 'q') setQuery((x) => ({ ...x, [k]: v })); };

  const listings = res.data?.listings ?? [];
  const markers = listings.map((l) => ({ id: l._id, lat: l.approxLat, lng: l.approxLng, text: `₹${l.ratePerHourInr}`, tone: 'home', radius: 150, title: l.title }));
  const times = []; for (let m = 6 * 60; m <= 22 * 60; m += 30) times.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><House className="w-5 h-5 text-blue-600" />Parking in the neighbourhood</h2>
          <p className="text-sm text-slate-500 mt-0.5">Book a resident's driveway or garage by the hour. The exact address is shared 2 hours before your start.</p>
        </div>
        <Btn tone="soft" onClick={onHost}>List your parking space</Btn>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setQuery(f); }} className="space-y-3">
        <label className="relative block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="search" value={f.q} onChange={set('q')} placeholder="Where to? Sector 8, Elante, PGI — press Enter"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <input type="date" min={istToday()} value={f.date} onChange={set('date')} className={inputCls} aria-label="Date" />
          <select value={f.start} onChange={set('start')} className={inputCls} aria-label="From"><option value="">Any time</option>{times.map((t) => <option key={t} value={t}>{hhmm12(t)}</option>)}</select>
          <select value={f.hours} onChange={set('hours')} className={inputCls} aria-label="Hours"><option value="">Any duration</option>{[1, 1.5, 2, 3, 4, 6, 8, 12].map((h) => <option key={h} value={h}>{h} h</option>)}</select>
          <select value={f.maxPrice} onChange={set('maxPrice')} className={inputCls} aria-label="Max price"><option value="">Any price</option>{[30, 40, 50, 80].map((p) => <option key={p} value={p}>≤ ₹{p}/h</option>)}</select>
          <select value={f.maxWalkMin} onChange={set('maxWalkMin')} className={inputCls} aria-label="Max walk"><option value="">Any walk</option>{[5, 10, 15].map((p) => <option key={p} value={p}>≤ {p} min walk</option>)}</select>
          <select value={f.vehicle} onChange={set('vehicle')} className={inputCls} aria-label="Vehicle"><option value="">Any vehicle</option>{Object.entries(FIT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <p className="text-xs text-slate-500 font-medium">{res.data?.place ? `Spaces near ${res.data.place.label}` : 'Spaces across Chandigarh'} · {listings.length} found</p>
          <ErrorNote error={res.error} onRetry={res.reload} />
          {res.loading && !res.data ? <Loading /> : listings.length === 0 ? <Empty>{res.data?.note || 'No spaces match. Try another time, a longer walk, or a nearby sector.'}</Empty> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {listings.map((l) => (
                <article key={l._id} className="rounded-2xl border-2 border-blue-100 hover:border-blue-300 hover:shadow-sm bg-white p-5 transition-all">
                  <div className="flex flex-wrap gap-1.5"><Pill tone="sky">{SPACE_TYPES[l.type] ?? l.type}</Pill>{l.covered && <Pill tone="purple">COVERED</Pill>}{l.demo && <Pill>DEMO</Pill>}</div>
                  <h4 className="mt-2 text-sm font-bold text-slate-900 leading-snug">{l.title}</h4>
                  <p className="mt-1 text-xs text-slate-500">{sectorLabel(l.sector)} · {l.rating ? <span className="inline-flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-500" />{l.rating.avg} ({l.rating.count})</span> : 'New'} · {l.spaces} space{l.spaces === 1 ? '' : 's'}</p>
                  {l.walkMinutes != null && <p className="mt-1 text-xs text-emerald-700 font-semibold flex items-center gap-1"><Footprints className="w-3 h-3" />~{l.walkMinutes} min walk</p>}
                  <p className="mt-1 text-[11px] text-slate-500">{l.availableOn?.windows?.length ? `Available ${l.availableOn.date === istToday() ? 'today' : l.availableOn.date} ${l.availableOn.windows.map((w) => `${w.start}–${w.end}`).join(', ')}` : 'Not available on this day'}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <p className="text-xl font-black text-slate-900">{inr(l.ratePerHourInr)}<span className="text-xs text-slate-400 font-semibold">/hour</span></p>
                    <Btn className="flex-1 ml-auto" onClick={() => setListingId(l._id)}>View &amp; book</Btn>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
          <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-xs">
            <LiveMap markers={markers} onSelect={setListingId} className="h-72" />
            <p className="px-4 py-2 text-[11px] text-slate-500">Circles show an approximate area (about 150 m), not the house. All hosts and spaces in this demo are fictional.</p>
          </section>
          <Panel title="My bookings">
            {mine.loading && !mine.data ? <Loading /> : (mine.data?.bookings ?? []).length === 0 ? <p className="text-xs text-slate-500">No neighbourhood bookings yet.</p> : (
              <div className="divide-y divide-slate-100">
                {mine.data.bookings.slice(0, 8).map((b) => { const [t, tone] = STATUS[b.status] ?? [b.status, 'slate']; return (
                  <button key={b._id} type="button" onClick={() => setBookingId(b._id)} className="w-full text-left py-3 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-lg px-1">
                    <div className="min-w-0"><p className="text-xs font-bold text-slate-800 truncate">{b.title ?? b.listingId}</p><p className="text-[11px] font-mono text-slate-500">{dateTime(b.start)} · {b.hours} h</p></div>
                    <Pill tone={tone}>{t}</Pill>
                  </button>
                ); })}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {listingId && <ListingModal id={listingId} onClose={() => setListingId(null)} showToast={showToast} onBooked={(id) => { setListingId(null); mine.reload(); res.reload(); setBookingId(id); }} />}
      {bookingId && <BookingModal id={bookingId} onClose={() => { setBookingId(null); mine.reload(); }} showToast={showToast} />}
    </div>
  );
}

/* ---------- listing detail + 3-step booking ---------- */
function ListingModal({ id, onClose, showToast, onBooked }) {
  const r = useLoad(() => api('GET', `/listings/${encodeURIComponent(id)}`), [id]);
  const [date, setDate] = useState(istToday());
  const [start, setStart] = useState(null);
  const [hours, setHours] = useState(null);
  const [step, setStep] = useState(1);
  const [vehicleNo, setVehicleNo] = useState('');
  const [accept, setAccept] = useState(false);
  const [booking, setBooking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const avail = useLoad(() => api('GET', `/listings/${encodeURIComponent(id)}/availability?date=${date}`), [id, date]);
  const l = r.data?.listing;

  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const runway = (s) => { const slots = avail.data?.slots ?? []; let i = slots.findIndex((x) => x.start === s), n = 0, exp = toMin(s); if (i < 0) return 0; for (; i < slots.length && slots[i].free > 0 && toMin(slots[i].start) === exp; i++, n++) exp += 30; return n; };
  const opts = (avail.data?.slots ?? []).filter((s) => !s.past && s.free > 0 && runway(s.start) >= 2).map((s) => s.start);
  const maxH = start ? Math.min(12, runway(start) / 2) : 0;
  const hourOpts = []; for (let h = 1; h <= maxH; h += 0.5) hourOpts.push(h);
  const quote = useLoad(() => (start && hours ? api('GET', `/listings/${encodeURIComponent(id)}/quote?hours=${hours}`) : Promise.resolve(null)), [id, start, hours]);

  const confirm = async () => {
    setErr(null); setBusy(true);
    try {
      const { booking: b } = await api('POST', '/neighbourhood-bookings', { listingId: id, date, start, hours, acceptPolicy: true, vehicleNo: vehicleNo || undefined });
      setBooking(b); setStep(3);
    } catch (e) { setErr(e); avail.reload(); } finally { setBusy(false); }
  };
  const pay = async (app) => {
    setErr(null); setBusy(true);
    try { await api('POST', `/neighbourhood-bookings/${booking._id}/pay`, { upiApp: app }); showToast(`Booking confirmed · ${inr(booking.totalInr)} (demo UPI)`); onBooked(booking._id); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <Modal wide title={l?.title ?? 'Neighbourhood space'} sub={l ? `${sectorLabel(l.sector)}${l.landmark ? ` · near ${l.landmark}` : ''}` : ''} onClose={onClose}>
      {r.loading && !l ? <Loading /> : <ErrorNote error={r.error} />}
      {l && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap gap-1.5"><Pill tone="sky">{SPACE_TYPES[l.type]}</Pill>{l.covered ? <Pill tone="purple">COVERED</Pill> : <Pill>OPEN TO SKY</Pill>}{l.demo && <Pill>DEMO LISTING</Pill>}{!l.verified && <Pill>NOT VERIFIED</Pill>}</div>
            <p className="text-2xl font-black text-slate-900">{inr(l.ratePerHourInr)}<span className="text-xs text-slate-400 font-semibold"> per hour</span></p>
            <LiveMap markers={[{ id: l._id, lat: l.approxLat, lng: l.approxLng, text: '≈', tone: 'home', radius: 150 }]} className="h-44 rounded-2xl overflow-hidden" />
            <p className="flex items-center gap-1.5 text-slate-500"><Lock className="w-3.5 h-3.5" />Approximate area only. Exact address and access instructions are shared 2 hours before your start.</p>
            <div className="space-y-1.5">
              {[['Spaces', l.spaces], ['Fits', l.vehicleFit.map((v) => FIT[v] ?? v).join(', ')], ['Size', l.dimensions], ['Surface', l.surface], ['Entrance', l.entranceWidth], ['Height limit', l.clearance],
                ['Available', l.availability.map((w) => `${w.days.length === 7 ? 'Every day' : w.days.map((d) => DAYS[d]).join(', ')} ${hhmm12(w.start)}–${hhmm12(w.end)}`).join('; ')], ['Host', l.host?.firstName ?? 'Host']]
                .filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="text-slate-500">{k}</span><span className="font-semibold text-slate-800 text-right">{v}</span></div>)}
            </div>
            {l.rules && <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600"><b>House rules:</b> {l.rules}</p>}
            <p className="text-slate-500"><b>Cancellation:</b> {l.cancellationPolicy}</p>
            <p className="text-slate-500"><b>Reviews:</b> {l.rating ? `★ ${l.rating.avg} from ${l.rating.count}` : 'Ratings appear after 3 reviews from completed bookings.'}</p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-1.5">{[1, 2, 3].map((n) => <span key={n} className={`flex-1 h-1.5 rounded-full transition-colors ${step >= n ? 'bg-sky-500' : 'bg-slate-200'}`} />)}</div>
            {step === 1 && (<>
              <Field label="Date">
                <select className={inputCls} value={date} onChange={(e) => { setDate(e.target.value); setStart(null); setHours(null); }}>
                  {Array.from({ length: 14 }, (_, i) => istToday(i)).map((d, i) => <option key={d} value={d}>{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayLabel(`${d}T12:00:00+05:30`)}</option>)}
                </select>
              </Field>
              <div>
                <span className="block text-[11px] font-mono font-bold uppercase text-slate-500 mb-1">Start time</span>
                {avail.loading && !avail.data ? <Loading /> : !avail.data?.windows?.length ? <p className="text-xs text-slate-500">The host hasn't made this space available on this day.</p> : (
                  <div className="flex flex-wrap gap-1.5">
                    {avail.data.slots.filter((s) => !s.past).map((s) => {
                      const ok = opts.includes(s.start);
                      return <button key={s.start} type="button" disabled={!ok} onClick={() => { setStart(s.start); setHours((h) => h || (runway(s.start) >= 4 ? 2 : 1)); }}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${start === s.start ? 'bg-sky-600 border-sky-600 text-white' : ok ? 'bg-white border-slate-200 hover:border-sky-300 text-slate-700' : 'bg-slate-50 border-slate-100 text-slate-300 line-through cursor-not-allowed'}`}>{hhmm12(s.start)}</button>;
                    })}
                  </div>
                )}
              </div>
              <Field label="Duration">
                <select className={inputCls} disabled={!start} value={hours ?? ''} onChange={(e) => setHours(Number(e.target.value) || null)}>
                  <option value="">{start ? 'Choose' : 'Pick a start time first'}</option>{hourOpts.map((h) => <option key={h} value={h}>{h} hour{h === 1 ? '' : 's'}</option>)}
                </select>
              </Field>
            </>)}
            {step === 2 && (<>
              <p className="text-sm font-bold text-slate-900">{dayLabel(`${date}T12:00:00+05:30`)}, {hhmm12(start)} for {hours} h</p>
              <Field label="Vehicle number (optional)"><input className={inputCls} value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="CH01 AB 1234" /></Field>
              <label className="flex gap-2 text-xs text-slate-600"><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 accent-sky-600" />I accept the cancellation policy: free cancellation up to 1 hour before the start; after that it's non-refundable.</label>
            </>)}
            {step < 3 && quote.data && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between"><span>{inr(quote.data.rateInr)} × {quote.data.hours} h</span><span>{inr(quote.data.subtotalInr)}</span></div>
                <div className="flex justify-between"><span>Platform fee</span><span>{inr(quote.data.feeInr)}</span></div>
                <div className="flex justify-between pt-1.5 mt-1.5 border-t border-dashed border-slate-300 text-base font-black text-slate-900"><span>Total</span><span>{inr(quote.data.totalInr)}</span></div>
                <DemoNote>Price calculated by the server.</DemoNote>
              </div>
            )}
            {step === 3 && booking && (
              <div className="space-y-3">
                <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-semibold">We're holding this time for 10 minutes (until {dateTime(booking.holdExpiresAt)}).</p>
                <p className="text-xs text-slate-600">Booking <b className="font-mono">{booking._id}</b> · {dateTime(booking.start)} · total <b>{inr(booking.totalInr)}</b></p>
                <p className="text-[11px] font-mono font-bold uppercase text-slate-500">Pay with a UPI app (demo — nothing is charged)</p>
                <div className="grid grid-cols-2 gap-2">{UPI_APPS.map((a) => <Btn key={a} tone="ghost" busy={busy} onClick={() => pay(a)}>{a}</Btn>)}</div>
              </div>
            )}
            <ErrorNote error={err} />
            {step === 1 && <Btn className="w-full" disabled={!quote.data} onClick={() => setStep(2)}>Continue</Btn>}
            {step === 2 && <div className="flex gap-2"><Btn tone="ghost" onClick={() => setStep(1)}>Back</Btn><Btn className="flex-1" busy={busy} disabled={!accept} onClick={confirm}>Confirm booking</Btn></div>}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------- one booking: status, address reveal, cancel, review, report ---------- */
function BookingModal({ id, onClose, showToast }) {
  const r = useLoad(() => api('GET', `/neighbourhood-bookings/${encodeURIComponent(id)}`), [id]);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [kind, setKind] = useState('space-blocked');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const d = r.data;
  const act = async (fn, msg) => { setBusy(true); setErr(null); try { await fn(); showToast(msg); r.reload(); } catch (e) { setErr(e); } finally { setBusy(false); } };
  // reload once the address is due to unlock
  useEffect(() => {
    if (!d?.access?.locked || d.booking.status !== 'confirmed') return undefined;
    const ms = new Date(d.access.unlocksAt) - Date.now();
    if (ms <= 0 || ms > 6 * 3600000) return undefined;
    const t = setTimeout(r.reload, ms + 1500);
    return () => clearTimeout(t);
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps

  const [label, tone] = d ? STATUS[d.booking.status] ?? [d.booking.status, 'slate'] : [];
  return (
    <Modal title={d?.listing?.title ?? 'Booking'} sub={d ? `${d.booking._id} · ${sectorLabel(d.listing.sector)}` : ''} onClose={onClose}>
      {r.loading && !d ? <Loading /> : <ErrorNote error={r.error} />}
      {d && (
        <div className="space-y-4 text-xs">
          {d.booking.status === 'confirmed' && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3"><span className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Check className="w-5 h-5" /></span><div><p className="text-sm font-black text-emerald-800">You're booked!</p><p className="text-emerald-700">Demo payment received. You'll get a reminder 30 minutes before the start.</p></div></div>
          )}
          <div className="flex items-center gap-2"><Pill tone={tone}>{label}</Pill>{d.booking.refundInr ? <Pill tone="sky">REFUND {inr(d.booking.refundInr)} (DEMO)</Pill> : null}</div>
          <div className="space-y-1.5">
            {[['When', `${dateTime(d.booking.start)} – ${dateTime(d.booking.end)}`], ['Duration', `${d.booking.hours} h`], ['Paid', `${inr(d.booking.totalInr)}${d.booking.paymentId ? ' (demo UPI)' : ''}`], ['Vehicle', d.booking.vehicleNo]].filter(([, v]) => v)
              .map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-semibold text-slate-800">{v}</span></div>)}
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
            <p className="text-sm font-bold text-slate-900">Address and access</p>
            {d.access.locked ? (
              <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-semibold flex gap-2"><Lock className="w-4 h-4 shrink-0" />{d.access.message}{d.booking.status === 'confirmed' ? ` Unlocks at ${dateTime(d.access.unlocksAt)}.` : ''}</p>
            ) : (<>
              <p className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">{d.access.exactAddress}</p>
              {d.access.accessInstructions && <p className="text-slate-600"><b>How to get in:</b> {d.access.accessInstructions}</p>}
              <a href={directionsUrl(d.access.lat, d.access.lng)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-sky-600 text-white font-bold"><Navigation className="w-3.5 h-3.5" />Directions</a>
            </>)}
          </div>
          {d.canCancel && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50">
              <span className="text-slate-600">{d.role === 'host' ? 'If you cancel, the citizen gets a full refund.' : d.booking.status === 'pending-payment' ? 'Nothing has been paid yet.' : d.refundIfCancelledNow ? `Cancel now for a full refund of ${inr(d.refundIfCancelledNow)} (demo).` : 'Less than 1 hour to the start: cancelling is non-refundable.'}</span>
              <Btn tone="danger" busy={busy} onClick={() => window.confirm('Cancel this booking?') && act(() => api('POST', d.role === 'host' ? `/host/bookings/${d.booking._id}/cancel` : `/neighbourhood-bookings/${d.booking._id}/cancel`), 'Booking cancelled')}>Cancel</Btn>
            </div>
          )}
          {d.canReview && (
            <div className="space-y-2">
              <p className="font-bold text-slate-900">How was the space?</p>
              <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setStars(n)} aria-label={`${n} stars`}><Star className={`w-6 h-6 ${n <= stars ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} /></button>)}</div>
              <textarea className={inputCls} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment" />
              <Btn disabled={!stars} busy={busy} onClick={() => act(() => api('POST', '/reviews', { bookingId: d.booking._id, stars, comment }), 'Thanks for the review')}>Send review</Btn>
            </div>
          )}
          {d.review && <p className="text-slate-600">Your review: {'★'.repeat(d.review.stars)} {d.review.comment}</p>}
          <details className="rounded-xl border border-slate-200 p-3">
            <summary className="font-bold text-slate-700 cursor-pointer">Report a problem to the Municipal Corporation</summary>
            <div className="mt-3 space-y-2">
              <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="space-blocked">Space was blocked</option><option value="no-show">{d.role === 'host' ? "Citizen didn't show up" : "Host didn't respond"}</option><option value="damage">Damage</option><option value="safety">Safety concern</option><option value="other">Something else</option>
              </select>
              <textarea className={inputCls} rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What happened?" />
              <Btn tone="ghost" busy={busy} onClick={() => act(() => api('POST', '/reports', { bookingId: d.booking._id, kind, details }), 'Report sent to the MC').then(() => setDetails(''))}>Send report</Btn>
            </div>
          </details>
          <ErrorNote error={err} />
        </div>
      )}
    </Modal>
  );
}
