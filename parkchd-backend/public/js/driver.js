// Driver app: live lots on a map, search, AI assistant, reserve/check in,
// Festival Mode banner + alternatives, and the Neighbourhood Parking entry point.

import {
  $, api, askLocation, attachFeed, directionsUrl, driverPhoneLogin, duration, ensureDriver, esc, festivalBanner,
  houseCarArt, emptyArt, inr, level, live, log, makeMap, mountHeader, pill, pinIcon, run, savedLocation, sectorLabel, time,
  dateTime, toast, tokens, routeLine, bump, countUp,
} from "./common.js";

const ROLE = "driver";
attachFeed($("#feed"));

let lots = [];
let shown = [];
let lotId = null;
let lotSlots = [];
let activity = null;
let loc = savedLocation();
let lastQuery = null;
const markers = new Map();
const call = (m, p, b) => api(m, p, b, ROLE);

/* ---------- header + account ---------- */
function header(user) {
  mountHeader({ role: ROLE, label: "Driver", who: user?.name, nav: "/driver", links: [{ href: "/neighbourhood", text: "Neighbourhood" }, { href: "/host", text: "Host" }] });
  $("#prefFestival").checked = user?.notificationPrefs?.festivalAlerts !== false;
}
$("#newDriver").addEventListener("click", async () => {
  const u = await run(() => ensureDriver({ fresh: true }), "New test driver created");
  if (u) location.reload();
});
$("#phoneForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const phone = $("#phone").value.trim();
  if (!/^\d{10}$/.test(phone)) { toast("Enter a 10-digit phone number.", true); return; }
  const u = await run(() => driverPhoneLogin(phone));
  if (u) { toast(`Signed in as ${u.name}`); location.reload(); }
});
$("#prefFestival").addEventListener("change", (e) => run(() => call("PATCH", "/me/notification-prefs", { festivalAlerts: e.target.checked }), e.target.checked ? "Festival alerts on" : "Festival alerts off"));

/* ---------- Festival Mode banner ---------- */
async function loadFestival() {
  const qp = loc ? `?lat=${loc.lat}&lng=${loc.lng}` : "";
  const f = await api("GET", `/festival${qp}`);
  $("#festivalSlot").innerHTML = festivalBanner(f);
  countUp($("#festivalSlot"));
}

/* ---------- my parking ---------- */
async function loadActivity() {
  activity = await call("GET", "/me/activity");
  renderMine();
}
function renderMine() {
  const el = $("#mine");
  const r = activity?.activeReservation, s = activity?.activeSession;
  const lotName = (id) => lots.find((l) => l._id === id)?.name ?? id;
  if (r) {
    const left = new Date(r.expiresAt) - Date.now();
    el.classList.remove("hidden");
    el.innerHTML = `<h2>Your reservation <span class="right">Booking ${esc(r._id)}</span></h2>
      <div class="row"><div><div class="muted small">${esc(lotName(r.lotId))}</div><div style="font-size:34px;font-weight:800">${esc(r.slotNumber)}</div></div>
      <div style="margin-left:auto;text-align:right"><div class="muted small">Hold ends in</div><div class="num" style="font-size:24px;font-weight:800">${duration(left)}</div></div></div>
      <div class="row" style="margin-top:10px">
        ${r.status === "pending-payment" ? ["Google Pay", "PhonePe", "Paytm", "BHIM"].map((a) => `<button class="btn primary small" data-pay-res="${a}" type="button">Pay ₹${r.feeInr} · ${a}</button>`).join("") : `<span class="pill ok">Paid (demo)</span><button class="btn primary" id="checkIn" type="button">I've arrived · check in</button>`}
        <button class="btn danger" id="cancelRes" type="button">Cancel</button>
      </div>`;
  } else if (s) {
    const lot = lots.find((l) => l._id === s.lotId);
    el.classList.remove("hidden");
    el.innerHTML = `<h2>Find my car 🚗</h2>
      <div class="row"><div><div class="muted small">${esc(lotName(s.lotId))}</div><div style="font-size:40px;font-weight:800">${esc(s.slotNumber)}</div></div>
      <div style="margin-left:auto;text-align:right"><div class="muted small">Parked at ${time(s.startedAt)}</div><div class="num" style="font-size:20px;font-weight:800">${duration(Date.now() - new Date(s.startedAt))}</div></div></div>
      <div class="row" style="margin-top:10px">
        ${s.paymentId ? `<span class="pill ok">Fee paid</span>` : `<button class="btn primary" id="payParking" type="button">Pay ${inr(s.feeInr)} with UPI</button>`}
        ${lot ? `<a class="btn" target="_blank" rel="noopener" href="${directionsUrl(lot.lat, lot.lng, "walking")}">Walk back ↗</a>` : ""}
        <button class="btn" id="leave" type="button" ${s.paymentId ? "" : "disabled"}>I've left the lot</button>
      </div>`;
  } else {
    el.classList.add("hidden");
  }
  const on = (sel, fn) => el.querySelector(sel)?.addEventListener("click", fn);
  el.querySelectorAll("[data-pay-res]").forEach((b) => b.addEventListener("click", () => act(() => call("POST", `/reservations/${r._id}/pay`, { upiApp: b.dataset.payRes }), "Paid (demo UPI). Slot held.")));
  on("#checkIn", () => act(() => call("POST", `/reservations/${r._id}/check-in`), "Checked in. Your car is saved."));
  on("#cancelRes", () => act(() => call("POST", `/reservations/${r._id}/cancel`), "Reservation cancelled"));
  on("#payParking", () => act(() => call("POST", `/sessions/${s._id}/pay`, { upiApp: "Google Pay" }), "Paid (demo UPI)"));
  on("#leave", () => act(() => call("POST", `/sessions/${s._id}/end`), "Slot freed. Drive safe."));
}
async function act(fn, msg) { if (await run(fn, msg) !== undefined) { await loadActivity(); if (lotId) openLot(lotId); } }
setInterval(() => activity && renderMine(), 15000);

async function loadMyBookings() {
  const { bookings } = await call("GET", "/neighbourhood-bookings");
  const el = $("#myBookings");
  const upcoming = bookings.filter((b) => ["pending-payment", "confirmed"].includes(b.status));
  const recent = bookings.filter((b) => !upcoming.includes(b)).slice(0, 3);
  const row = (b) => `<li><a href="/booking?id=${esc(b._id)}">${esc(b.title ?? b.listingId)}</a> <span class="tag ${b.status === "confirmed" ? "green" : b.status.startsWith("cancel") ? "red" : ""}">${esc(statusText(b.status))}</span><span class="time">${dateTime(b.start)}</span></li>`;
  el.innerHTML = `<h2>My neighbourhood bookings</h2>${bookings.length ? `<ul class="list">${[...upcoming, ...recent].map(row).join("")}</ul>` : `<p class="muted small">None yet. <a href="/neighbourhood">Find a space</a></p>`}`;
}
const statusText = (s) => ({ "pending-payment": "Awaiting payment", confirmed: "Confirmed", completed: "Completed", expired: "Expired", "cancelled-by-driver": "Cancelled", "cancelled-by-host": "Cancelled by host", "no-show": "No-show" }[s] ?? s);

/* ---------- map ---------- */
const map = makeMap($("#map"));
function pinFor(l) {
  const sel = l._id === lotId ? " sel" : "";
  if (l.kind === "temporary") return pinIcon(`temp${sel}`, `+${l.stats.available}`);
  if (!l.stats.open) return pinIcon(`full${sel}`, "—");
  return pinIcon(level(l.stats)[0] + sel, l.stats.available);
}
let route = null;
let origin = null; // where the driver is, or the place they searched
function showRoute(l) {
  route?.remove(); route = null;
  for (const [id, m] of markers) { const x = shown.find((s) => s._id === id) ?? lots.find((s) => s._id === id); if (x) m.setIcon(pinFor(x)); }
  const from = loc ?? origin;
  if (from && l) route = routeLine(map, from, l);
}
function paintMap(rows) {
  if (!map) return;
  for (const m of markers.values()) m.remove();
  markers.clear();
  for (const l of rows) {
    const m = window.L.marker([l.lat, l.lng], { icon: pinFor(l), title: l.name }).addTo(map).on("click", () => openLot(l._id));
    markers.set(l._id, m);
  }
  if (rows.length) map.fitBounds(window.L.latLngBounds(rows.map((l) => [l.lat, l.lng])).pad(0.15), { maxZoom: 15 });
}

/* ---------- lots + search ---------- */
async function loadLots() {
  lots = (await api("GET", "/lots")).lots;
  shown = lots;
  renderLots(lots);
  paintMap(lots);
}
function lotCard(l) {
  const temp = l.kind === "temporary";
  const st = !l.stats.open ? "s-full" : `s-${level(l.stats)[0]}`;
  return `<article class="lcard ${temp ? "temp" : st}" data-id="${esc(l._id)}">
    <div class="row" style="gap:6px">${temp ? '<span class="tag temp">Temporary</span>' : ""}${l.popular ? '<span class="tag">Popular</span>' : ""}${l.distanceKm !== undefined ? `<span class="tag blue">${l.distanceKm} km</span>` : ""}</div>
    <h3>${esc(l.name)}</h3>
    <div class="meta"><span>${esc(sectorLabel(l.sector))}</span><span>${inr(l.feeInr)} / visit</span><span>${l.opensAt === 0 && l.closesAt === 24 ? "24 h" : `${l.opensAt}:00–${l.closesAt}:00`}</span></div>
    <div class="row" style="align-items:flex-end"><div class="big-count" data-live="${esc(l._id)}">${l.stats.open ? l.stats.available : "—"}<small>${l.stats.open ? "free" : "closed"}</small></div><span style="margin-left:auto">${l.stats.open ? pill(l.stats) : '<span class="pill full">Closed now</span>'}</span></div>
    <div class="foot"><button class="btn small" data-open="${esc(l._id)}" type="button">Open</button><a class="btn small" target="_blank" rel="noopener" href="${directionsUrl(l.lat, l.lng)}">Directions ↗</a></div>
  </article>`;
}
function renderLots(rows) {
  $("#lots").innerHTML = rows.length ? rows.map(lotCard).join("") : `<div class="empty" style="grid-column:1/-1">${emptyArt()}No lots match. Try another sector.</div>`;
}
$("#lots").addEventListener("click", (e) => { const b = e.target.closest("[data-open]"); if (b) openLot(b.dataset.open); });

$("#searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("#q").value.trim(); if (!q) return;
  const r = await run(() => call("GET", `/search?q=${encodeURIComponent(q)}`));
  if (!r) return;
  lastQuery = q;
  $("#searchInfo").textContent = r.place ? `Near ${r.place.label}: ${r.lots.length} lots, ${r.totalAvailable} spaces free.` : `No sector, landmark or lot matches “${q}”.`;
  origin = r.place && Number.isFinite(r.place.lat) ? { lat: r.place.lat, lng: r.place.lng } : null;
  shown = r.lots; renderLots(r.lots); paintMap(r.lots);
  updateNbCount();
});
$("#clearSearch").addEventListener("click", () => { $("#q").value = ""; lastQuery = null; $("#searchInfo").textContent = ""; shown = lots; renderLots(lots); paintMap(lots); updateNbCount(); });
$("#locBtn").addEventListener("click", async () => {
  $("#searchInfo").textContent = "Finding you…";
  const p = await askLocation();
  if (!p) { $("#searchInfo").textContent = "Location not available. Search a sector instead."; return; }
  loc = p; lastQuery = null;
  const r = await run(() => call("GET", `/lots?lat=${p.lat}&lng=${p.lng}`));
  if (!r) return;
  $("#searchInfo").textContent = `${r.lots.length} lots within 1 km of you.`;
  shown = r.lots; renderLots(r.lots); paintMap(r.lots);
  if (map) window.L.marker([p.lat, p.lng], { icon: window.L.divIcon({ className: "", html: '<div class="pin me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), title: "You" }).addTo(map);
  loadFestival(); updateNbCount();
});

/* ---------- AI assistant ---------- */
$("#askForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = $("#ask").value.trim(); if (!message) return;
  $("#answer").textContent = "Thinking…";
  const r = await run(() => call("POST", "/assistant", { message, ...(loc ?? {}) }));
  if (!r) { $("#answer").textContent = ""; return; }
  $("#aiSource").textContent = r.source === "groq" ? "answered by GroqCloud" : "rule-based answer (no Groq key)";
  $("#answer").innerHTML = `<p style="color:var(--ink)">${esc(r.reply)}</p>` +
    (r.lotIds.length ? `<div class="row" style="margin-top:8px">${r.lotIds.map((id) => `<button class="btn small" data-open="${esc(id)}" type="button">${esc(lots.find((l) => l._id === id)?.name ?? id)}</button>`).join("")}</div>` : "");
  $("#answer").querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openLot(b.dataset.open)));
});

/* ---------- one lot ---------- */
async function openLot(id) {
  lotId = id;
  const d = await api("GET", `/lots/${id}`);
  lotSlots = d.slots;
  renderLot(d.lot);
  showRoute(d.lot);
  const s = d.lot.stats;
  if (s.open && (s.available === 0 || s.occupancyPct >= 85)) loadAlternatives(d.lot);
  if (window.innerWidth < 900) $("#lotCard").scrollIntoView({ behavior: "smooth", block: "start" });
}
function renderLot(lot) {
  const s = lot.stats;
  const temp = lot.kind === "temporary";
  const busy = activity?.activeReservation || activity?.activeSession;
  const closedMsg = temp && lot.zone?.status !== "active" ? "This temporary zone is not open right now." : "Closed right now.";
  $("#lotCard").innerHTML = `
    <h2>${esc(lot.name)} ${temp ? '<span class="tag temp">Temporary</span>' : ""}</h2>
    <p class="small muted" style="margin:0 0 8px">${esc(lot.address)} · ${lot.opensAt === 0 && lot.closesAt === 24 ? "Open 24 h" : `${lot.opensAt}:00–${lot.closesAt}:00`} · fee ${inr(lot.feeInr)}</p>
    ${temp ? `<p class="small" style="margin-bottom:8px"><a href="/zone?id=${encodeURIComponent(lot._id)}">Entry gates, rules and accessibility →</a></p>` : ""}
    <div class="row" style="margin-bottom:10px">${s.open ? pill(s) : `<span class="pill full">${closedMsg}</span>`} <span class="small muted">${s.reservableFree} of ${s.reservableTotal} reservable (10%)</span></div>
    <div class="row" style="margin-bottom:12px">
      <button class="btn primary" id="reserve" type="button" ${busy || !s.reservableFree || !s.open ? "disabled" : ""}>Reserve · ${inr(lot.feeInr)} · 15 min</button>
      <button class="btn" id="walkIn" type="button" ${busy || !s.open || !s.available ? "disabled" : ""}>I'm here · check in</button>
      <a class="btn" target="_blank" rel="noopener" href="${directionsUrl(lot.lat, lot.lng)}">Directions ↗</a>
    </div>
    <div id="alts"></div>
    <div class="legend"><span>🟩 free</span><span>🚗 occupied</span><span>🔒 reserved</span><span>R = reservable</span></div>
    <div class="slots" id="lotSlots">${lotSlots.map(slotHtml).join("")}</div>`;
  $("#reserve")?.addEventListener("click", () => act(() => call("POST", "/reservations", { lotId: lot._id }), "Slot held for 15 minutes. Pay to confirm."));
  $("#walkIn")?.addEventListener("click", () => act(() => call("POST", `/lots/${lot._id}/check-in`, {}), "Checked in. Your car is saved."));
}
const slotHtml = (x) => `<div class="slot ${x.state}" data-id="${esc(x._id)}">${x.kind === "reservable" ? '<span class="r">R</span>' : ""}${x.state === "occupied" ? "🚗" : x.state === "reserved" ? "🔒" : ""}${esc(x.number)}</div>`;

async function loadAlternatives(lot) {
  const qp = new URLSearchParams();
  if (loc) { qp.set("lat", loc.lat); qp.set("lng", loc.lng); }
  const r = await api("GET", `/lots/${lot._id}/alternatives?${qp}`).catch(() => null);
  if (!r || lotId !== lot._id) return;
  $("#alts").innerHTML = `<div class="notice yellow" style="margin-bottom:12px">
    <b>${lot.stats.available === 0 ? "This lot is full." : `This lot is ${lot.stats.occupancyPct}% full.`}</b> Try one of these instead:
    <ul class="list" style="margin-top:6px">${r.suggestions.length ? r.suggestions.map((a) => `<li><a href="#" data-open="${esc(a._id)}">${esc(a.name)}</a> ${a.kind === "temporary" ? '<span class="tag temp">Temporary</span>' : ""} <span class="small">${a.stats.available} free · ${a.distanceKm} km · ~${a.driveMinutes} min</span></li>`).join("") : "<li>No open alternative within 4 km.</li>"}</ul>
    <div class="small muted" style="margin-top:4px">${esc(r.note)}</div></div>`;
  $("#alts").querySelectorAll("[data-open]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); openLot(a.dataset.open); }));
}

/* ---------- neighbourhood card ---------- */
$("#nbArt").innerHTML = houseCarArt();
async function updateNbCount() {
  const qp = lastQuery ? `?q=${encodeURIComponent(lastQuery)}` : loc ? `?lat=${loc.lat}&lng=${loc.lng}` : "";
  const r = await api("GET", `/listings${qp}`).catch(() => null);
  if (!r) return;
  const n = r.listings.length;
  $("#nbCount").textContent = n ? `${n} space${n === 1 ? "" : "s"} ${r.place ? `near ${r.place.label}` : "listed in the city"}` : r.place ? `No spaces near ${r.place.label} yet` : "Be the first host in your sector";
  $("#nbCard").querySelector("a.btn.primary").href = `/neighbourhood${qp}`;
}

/* ---------- live ---------- */
function onLot(s) {
  const l = lots.find((x) => x._id === s.lotId); if (l) l.stats = s;
  const sh = shown.find((x) => x._id === s.lotId); if (sh) sh.stats = s;
  const card = document.querySelector(`#lots .lcard[data-id="${CSS.escape(s.lotId)}"]`);
  if (card && sh) { card.outerHTML = lotCard(sh); bump(document.querySelector(`#lots [data-live="${CSS.escape(s.lotId)}"]`)); }
  const m = markers.get(s.lotId); if (m && sh) m.setIcon(pinFor(sh));
}
function onSlot(u) {
  if (u.lotId !== lotId) return;
  const el = document.querySelector(`#lotSlots .slot[data-id="${CSS.escape(u._id)}"]`);
  if (!el) return;
  el.outerHTML = slotHtml(u).replace('class="slot ', 'class="slot flash ');
}
let refreshT;
const refreshAll = () => { clearTimeout(refreshT); refreshT = setTimeout(async () => { await loadFestival(); const cur = lastQuery; await loadLots(); if (cur) { $("#q").value = cur; $("#searchForm").requestSubmit(); } }, 400); };

(async () => {
  try {
    const user = await ensureDriver();
    header(user);
    log(`Signed in as ${user.name}`, "ok");
    live({ lot: onLot, slot: onSlot, festival: refreshAll, zone: refreshAll }, ROLE);
    await Promise.all([loadLots(), loadFestival(), loadActivity(), loadMyBookings(), updateNbCount()]);
    const want = new URLSearchParams(location.search).get("lot");
    if (want) openLot(want);
  } catch (e) { toast(e.message, true); }
})();
