// One neighbourhood listing: details (approximate location only) + the booking flow.
// The price shown is always the server's quote; the server re-prices on booking.
import {
  $, api, dateTime, dayLabel, emptyArt, ensureDriver, esc, hhmm12, inr, istToday, live, makeMap, mountHeader, pinIcon,
  qs, run, sectorLabel, spaceArt, spaceTypeLabel, toast,
} from "./common.js";

const ROLE = "driver";
const id = qs("id");
const UPI = ["Google Pay", "PhonePe", "Paytm", "BHIM"];
const FIT = { hatchback: "Hatchback", sedan: "Sedan", suv: "SUV", "two-wheeler": "Two-wheeler" };

let listing = null;
let avail = null;
const st = { date: qs("date") || istToday(), start: qs("start") || null, hours: Number(qs("hours")) || null, step: 1, booking: null };

const backParams = new URLSearchParams(location.search); backParams.delete("id");
$("#back").href = `/neighbourhood${backParams.toString() ? `?${backParams}` : ""}`;

async function load() {
  const q = new URLSearchParams();
  if (qs("q")) q.set("q", qs("q")); else if (qs("lat")) { q.set("lat", qs("lat")); q.set("lng", qs("lng")); }
  let r;
  try { r = await api("GET", `/listings/${encodeURIComponent(id ?? "")}?${q}`); }
  catch { $("#detail").innerHTML = `<div class="card empty">${emptyArt()}This space isn't available any more.<br><a href="/neighbourhood">Find another space</a></div>`; $("#book").classList.add("hidden"); return; }
  listing = r.listing;
  renderDetail(r.reviews);
  await loadAvailability();
}

function renderDetail(reviews) {
  const l = listing;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  $("#detail").innerHTML = `
    <section class="card" style="border-color:var(--blue-line)">
      <div class="lcard" style="box-shadow:none;border:0;padding:0;background:none"><div class="art" style="height:150px">${spaceArt(l.type)}</div></div>
      <div class="row" style="gap:6px;margin-top:12px"><span class="tag">${esc(spaceTypeLabel(l.type))}</span>${l.covered ? '<span class="tag blue">Covered</span>' : '<span class="tag">Open to sky</span>'}${l.demo ? '<span class="tag demo">Demo listing</span>' : ""}${l.verified ? '<span class="tag green">Verified</span>' : '<span class="tag">Not verified</span>'}</div>
      <h1 style="margin:10px 0 4px">${esc(l.title)}</h1>
      <p class="muted">${esc(sectorLabel(l.sector))}${l.landmark ? ` · near ${esc(l.landmark)}` : ""}${l.walkMinutes != null ? ` · 🚶 about ${l.walkMinutes} min walk` : ""}</p>
      <div class="row" style="margin-top:10px"><span style="font-size:26px;font-weight:800">${inr(l.ratePerHourInr)}</span><span class="muted">per hour</span><span style="margin-left:auto" class="small">${l.rating ? `★ ${l.rating.avg} · ${l.rating.count} reviews` : `<span class="tag">New · ${l.reviewCount ? "fewer than 3 reviews" : "no reviews yet"}</span>`}</span></div>
    </section>
    <section class="card">
      <h2>Approximate location</h2>
      <div class="map short" id="lmap"></div>
      <p class="small muted" style="margin-top:8px">🔒 The exact address and access instructions are shared 2 hours before your booking starts.</p>
    </section>
    <section class="card">
      <h2>About this space</h2>
      <dl class="kv">
        <dt>Spaces</dt><dd>${l.spaces}</dd>
        <dt>Fits</dt><dd>${esc(l.vehicleFit.map((v) => FIT[v] ?? v).join(", "))}</dd>
        ${l.dimensions ? `<dt>Size</dt><dd>${esc(l.dimensions)}</dd>` : ""}
        ${l.surface ? `<dt>Surface</dt><dd>${esc(l.surface)}</dd>` : ""}
        ${l.entranceWidth ? `<dt>Entrance</dt><dd>${esc(l.entranceWidth)} wide</dd>` : ""}
        ${l.clearance ? `<dt>Height</dt><dd>${esc(l.clearance)}</dd>` : ""}
        <dt>Available</dt><dd>${l.availability.map((w) => `${w.days.length === 7 ? "Every day" : w.days.map((d) => days[d]).join(", ")} ${hhmm12(w.start)}–${hhmm12(w.end)}`).map(esc).join("<br>")}</dd>
        <dt>Host</dt><dd>${esc(l.host?.firstName ?? "Host")}</dd>
      </dl>
      ${l.rules ? `<div class="notice grey" style="margin-top:12px"><b>House rules:</b> ${esc(l.rules)}</div>` : ""}
    </section>
    <section class="card">
      <h2>Cancellation policy</h2>
      <p class="small">${esc(l.cancellationPolicy)}</p>
    </section>
    <section class="card">
      <h2>Reviews</h2>
      ${reviews.length ? `<ul class="list">${reviews.map((r) => `<li><b>${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}</b> ${esc(r.comment)}<span class="time">${dateTime(r.createdAt)}</span></li>`).join("")}</ul>` : `<p class="muted small">Ratings appear after a space has at least 3 reviews from completed bookings.</p>`}
    </section>`;
  const map = makeMap($("#lmap"), [l.approxLat, l.approxLng], 16);
  if (map) {
    window.L.circle([l.approxLat, l.approxLng], { radius: 150, color: "#3B82F6", weight: 1, fillOpacity: 0.14 }).addTo(map);
    window.L.marker([l.approxLat, l.approxLng], { icon: pinIcon("home", "≈") }).addTo(map);
  }
}

/* ---------- booking flow ---------- */
async function loadAvailability() {
  avail = await api("GET", `/listings/${id}/availability?date=${st.date}`).catch(() => null);
  if (st.start && !startOptions().includes(st.start)) { st.start = null; st.hours = null; }
  renderBook();
}
function runwayFrom(start) {
  // consecutive free 30-minute slots starting at `start`
  const slots = avail?.slots ?? [];
  let i = slots.findIndex((s) => s.start === start), n = 0;
  if (i < 0) return 0;
  let expect = toMin(start);
  for (; i < slots.length && slots[i].free > 0 && toMin(slots[i].start) === expect; i++, n++) expect += 30;
  return n;
}
const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const startOptions = () => (avail?.slots ?? []).filter((s) => !s.past && s.free > 0 && runwayFrom(s.start) >= 2).map((s) => s.start);

async function renderBook() {
  const el = $("#book");
  const steps = `<div class="steps" aria-hidden="true">${[1, 2, 3].map((n) => `<span class="${st.step >= n ? "on" : ""}"></span>`).join("")}</div>`;
  if (st.step === 3 && st.booking) return renderPay(el, steps);

  const dates = Array.from({ length: 14 }, (_, i) => istToday(i));
  const opts = startOptions();
  const maxH = st.start ? Math.min(12, runwayFrom(st.start) / 2) : 0;
  const hourOpts = []; for (let h = 1; h <= maxH; h += 0.5) hourOpts.push(h);
  if (st.hours && !hourOpts.includes(st.hours)) st.hours = null;
  const quote = st.start && st.hours ? await api("GET", `/listings/${id}/quote?hours=${st.hours}`).catch(() => null) : null;

  el.innerHTML = `${steps}
    <h2 style="margin-top:12px">${st.step === 1 ? "Pick a time" : "Review and confirm"}</h2>
    ${st.step === 1 ? `
      <label class="field">Date<select class="input" id="bDate">${dates.map((d) => `<option value="${d}" ${d === st.date ? "selected" : ""}>${d === istToday() ? "Today" : d === istToday(1) ? "Tomorrow" : dayLabel(`${d}T12:00:00+05:30`)}</option>`).join("")}</select></label>
      <div><div class="small muted" style="font-weight:800;margin:6px 0">Start time</div>
        ${avail?.windows?.length ? `<div class="timeslots">${(avail.slots ?? []).filter((s) => !s.past).map((s) => `<button type="button" data-start="${s.start}" aria-pressed="${s.start === st.start}" ${opts.includes(s.start) ? "" : "disabled"}>${hhmm12(s.start)}</button>`).join("") || '<span class="muted small">No times left today.</span>'}</div>` : `<p class="muted small">The host hasn't made this space available on this day.</p>`}
      </div>
      <label class="field">Duration<select class="input" id="bHours" ${st.start ? "" : "disabled"}><option value="">${st.start ? "Choose" : "Pick a start time first"}</option>${hourOpts.map((h) => `<option value="${h}" ${h === st.hours ? "selected" : ""}>${h} hour${h === 1 ? "" : "s"}</option>`).join("")}</select></label>
    ` : `
      <dl class="kv"><dt>When</dt><dd>${dayLabel(`${st.date}T12:00:00+05:30`)}, ${hhmm12(st.start)} for ${st.hours} h</dd><dt>Space</dt><dd>${esc(listing.title)}</dd></dl>
      <label class="field">Vehicle number<input class="input" id="bVeh" placeholder="CH01 AB 1234" /></label>
      <label class="check"><input type="checkbox" id="bPolicy" /> <span>I accept the cancellation policy: free cancellation up to 1 hour before the start; after that it's non-refundable.</span></label>
    `}
    ${quote ? `<div class="price-box"><div class="row"><span>${inr(quote.rateInr)} × ${quote.hours} h</span><span style="margin-left:auto">${inr(quote.subtotalInr)}</span></div><div class="row"><span>Platform fee</span><span style="margin-left:auto">${inr(quote.feeInr)}</span></div><div class="row total"><span>Total</span><span style="margin-left:auto">${inr(quote.totalInr)}</span></div></div>` : ""}
    ${st.step === 1 ? `<button class="btn primary big" id="bNext" type="button" ${quote ? "" : "disabled"}>Continue</button>` : `<div class="row"><button class="btn" id="bBack" type="button">Back</button><button class="btn primary big" id="bConfirm" type="button" style="flex:1">Confirm booking</button></div>`}
    <p class="small muted">🔒 Exact address shared 2 hours before the start. Payment is a demo; no money moves.</p>`;

  el.querySelector("#bDate")?.addEventListener("change", (e) => { st.date = e.target.value; st.start = null; st.hours = null; loadAvailability(); });
  el.querySelectorAll("[data-start]").forEach((b) => b.addEventListener("click", () => { st.start = b.dataset.start; if (!st.hours) st.hours = 2 <= Math.min(12, runwayFrom(st.start) / 2) ? 2 : 1; renderBook(); }));
  el.querySelector("#bHours")?.addEventListener("change", (e) => { st.hours = Number(e.target.value) || null; renderBook(); });
  el.querySelector("#bNext")?.addEventListener("click", () => { st.step = 2; renderBook(); });
  el.querySelector("#bBack")?.addEventListener("click", () => { st.step = 1; renderBook(); });
  el.querySelector("#bConfirm")?.addEventListener("click", confirm);
}

async function confirm() {
  if (!$("#bPolicy").checked) { toast("Please accept the cancellation policy.", true); return; }
  const user = await run(() => ensureDriver());
  if (!user) return;
  const r = await run(() => api("POST", "/neighbourhood-bookings", { listingId: id, date: st.date, start: st.start, hours: st.hours, acceptPolicy: true, vehicleNo: $("#bVeh").value.trim() || undefined }, ROLE));
  if (!r) { await loadAvailability(); return; }
  st.booking = r.booking; st.step = 3;
  renderBook();
}

function renderPay(el, steps) {
  const b = st.booking;
  el.innerHTML = `${steps}
    <h2 style="margin-top:12px">Pay to confirm</h2>
    <div class="notice yellow">We're holding this time for you for 10 minutes (until ${new Date(b.holdExpiresAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })}).</div>
    <dl class="kv"><dt>Booking</dt><dd>${esc(b._id)}</dd><dt>When</dt><dd>${dateTime(b.start)} – ${new Date(b.end).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })}</dd><dt>Total</dt><dd>${inr(b.totalInr)}</dd></dl>
    <div class="small muted" style="font-weight:800">Pay with a UPI app (demo)</div>
    <div class="grid cols-2">${UPI.map((a) => `<button class="btn" data-upi="${a}" type="button">${a}</button>`).join("")}</div>
    <p class="small muted">Demo payment: nothing is charged.</p>`;
  el.querySelectorAll("[data-upi]").forEach((btn) => btn.addEventListener("click", async () => {
    el.querySelectorAll("[data-upi]").forEach((x) => { x.disabled = true; });
    const r = await run(() => api("POST", `/neighbourhood-bookings/${b._id}/pay`, { upiApp: btn.dataset.upi }, ROLE), "Booking confirmed 🎉");
    if (r) location.href = `/booking?id=${encodeURIComponent(b._id)}&new=1`;
    else el.querySelectorAll("[data-upi]").forEach((x) => { x.disabled = false; });
  }));
}

(async () => {
  const user = await ensureDriver().catch(() => null);
  mountHeader({ role: user ? ROLE : undefined, label: "Neighbourhood", who: user?.name, nav: "/neighbourhood", links: [{ href: "/neighbourhood", text: "All spaces" }] });
  live({ listing: (u) => { if (u.listingId === id && st.step === 1) loadAvailability(); } }, ROLE);
  await load();
})();
