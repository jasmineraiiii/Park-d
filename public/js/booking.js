// One neighbourhood booking: status, address reveal (2 h before start), cancel, review, report.
import { $, api, dateTime, directionsUrl, emptyArt, esc, inr, makeMap, mountHeader, pinIcon, qs, run, sectorLabel, tokens } from "./common.js";

const ROLE = "driver";
const id = qs("id");
const STATUS = {
  "pending-payment": ["Awaiting payment", "yellow"], confirmed: ["Confirmed", "green"], completed: ["Completed", "grey"],
  expired: ["Hold expired", "grey"], "cancelled-by-driver": ["Cancelled by you", "red"], "cancelled-by-host": ["Cancelled by the host", "red"], "no-show": ["No-show", "red"],
};
const call = (m, p, b) => api(m, p, b, ROLE);
let unlockAt = null;
let celebrated = false;

async function load() {
  let d;
  try { d = await call("GET", `/neighbourhood-bookings/${encodeURIComponent(id ?? "")}`); }
  catch (e) { $("#booking").innerHTML = `<div class="card empty">${emptyArt()}${esc(e.status === 401 ? "Sign in on this device to see this booking." : "Booking not found.")}</div>`; return; }
  const { booking: b, listing: l, access } = d;
  unlockAt = access.locked && b.status === "confirmed" ? new Date(access.unlocksAt).getTime() : null;
  const [label, tone] = STATUS[b.status] ?? [b.status, "grey"];
  const host = d.role === "host";
  const end = new Date(b.end).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
  const celebrate = qs("new") === "1" && b.status === "confirmed" && !celebrated;
  if (celebrate) { celebrated = true; history.replaceState(null, "", `?id=${encodeURIComponent(b._id)}`); }
  $("#booking").className = "grid anim-in";
  $("#booking").innerHTML = `
    ${celebrate ? `<section class="card success" role="status"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36"/><path d="M25 41 l10 10 l20 -22"/></svg><h2>You're booked!</h2><p class="muted small">Demo payment received. We'll send a reminder 30 minutes before the start.</p></section>` : ""}
    <section class="card">
      <div class="row"><span class="tag">${esc(b._id)}</span>${l.demo ? '<span class="tag demo">Demo</span>' : ""}<span style="margin-left:auto" class="small muted">${host ? "You are the host" : ""}</span></div>
      <h1 style="margin:10px 0 4px">${esc(l.title)}</h1>
      <p class="muted">${esc(sectorLabel(l.sector))}${l.landmark ? ` · near ${esc(l.landmark)}` : ""}</p>
      <div class="notice ${tone}" style="margin-top:12px">${esc(label)}${b.refundInr ? ` · refund ${inr(b.refundInr)} (demo)` : ""}</div>
      <dl class="kv" style="margin-top:12px">
        <dt>When</dt><dd>${dateTime(b.start)} – ${end}</dd>
        <dt>Duration</dt><dd>${b.hours} h</dd>
        <dt>Paid</dt><dd>${inr(b.totalInr)} ${b.paymentId ? "(demo UPI)" : ""}</dd>
        ${b.vehicleNo ? `<dt>Vehicle</dt><dd>${esc(b.vehicleNo)}</dd>` : ""}
      </dl>
    </section>
    <section class="card">
      <h2>Address and access</h2>
      ${access.locked ? `<div class="notice yellow">🔒 ${esc(access.message)}${b.status === "confirmed" ? `<br><span class="small">Unlocks at ${dateTime(access.unlocksAt)}.</span>` : ""}</div>
        <div class="map short" id="bmap" style="margin-top:12px"></div><p class="small muted" style="margin-top:6px">Approximate area only.</p>`
      : `<div class="notice green">📍 ${esc(access.exactAddress)}</div>
        ${access.accessInstructions ? `<p style="margin-top:10px"><b>How to get in:</b> ${esc(access.accessInstructions)}</p>` : ""}
        <div class="map short" id="bmap" style="margin-top:12px"></div>
        <a class="btn primary" style="margin-top:10px" target="_blank" rel="noopener" href="${directionsUrl(access.lat, access.lng)}">Directions ↗</a>`}
    </section>
    ${d.canCancel ? `<section class="card"><h2>Cancel</h2>
      <p class="small">${host ? "If you cancel, the driver gets a full refund." : d.refundIfCancelledNow ? `Cancel now for a full refund of ${inr(d.refundIfCancelledNow)} (demo).` : b.status === "pending-payment" ? "Nothing has been paid yet." : "It's less than 1 hour to the start, so cancelling now is non-refundable."}</p>
      <button class="btn danger" id="cancel" type="button" style="margin-top:10px">Cancel booking</button></section>` : ""}
    ${d.canReview ? `<section class="card"><h2>How was the space?</h2>
      <div class="chips" id="stars">${[1, 2, 3, 4, 5].map((n) => `<button class="chip" type="button" data-s="${n}" aria-pressed="false">${"★".repeat(n)}</button>`).join("")}</div>
      <textarea class="input" id="comment" style="margin-top:10px;width:100%" placeholder="Optional: anything other drivers should know?"></textarea>
      <button class="btn primary" id="sendReview" type="button" style="margin-top:10px">Send review</button></section>` : ""}
    ${d.review ? `<section class="card"><h2>Your review</h2><p>${"★".repeat(d.review.stars)} ${esc(d.review.comment)}</p></section>` : ""}
    <section class="card"><h2>Something wrong?</h2>
      <details><summary class="small" style="cursor:pointer;font-weight:800">Report a problem to the Municipal Corporation</summary>
        <div class="grid" style="margin-top:10px">
          <select class="input" id="kind"><option value="space-blocked">Space was blocked</option><option value="no-show">${host ? "Driver didn't show up" : "Host didn't respond"}</option><option value="damage">Damage</option><option value="safety">Safety concern</option><option value="other">Something else</option></select>
          <textarea class="input" id="details" placeholder="What happened?"></textarea>
          <button class="btn" id="report" type="button">Send report</button>
        </div>
      </details>
    </section>`;

  const lat = access.locked ? l.approxLat : access.lat, lng = access.locked ? l.approxLng : access.lng;
  const map = makeMap($("#bmap"), [lat, lng], 16);
  if (map) {
    if (access.locked) window.L.circle([lat, lng], { radius: 150, color: "#3B82F6", weight: 1, fillOpacity: 0.14 }).addTo(map);
    window.L.marker([lat, lng], { icon: pinIcon("home", access.locked ? "≈" : "P") }).addTo(map);
  }
  let stars = 0;
  $("#stars")?.addEventListener("click", (e) => { const c = e.target.closest("[data-s]"); if (!c) return; stars = Number(c.dataset.s); document.querySelectorAll("#stars .chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c))); });
  $("#sendReview")?.addEventListener("click", async () => { if (!stars) return; if (await run(() => call("POST", "/reviews", { bookingId: b._id, stars, comment: $("#comment").value }), "Thanks for the review")) load(); });
  $("#cancel")?.addEventListener("click", async () => {
    if (!window.confirm("Cancel this booking?")) return;
    const path = host ? `/host/bookings/${b._id}/cancel` : `/neighbourhood-bookings/${b._id}/cancel`;
    if (await run(() => call("POST", path), "Booking cancelled")) load();
  });
  $("#report").addEventListener("click", async () => { if (await run(() => call("POST", "/reports", { bookingId: b._id, kind: $("#kind").value, details: $("#details").value }), "Report sent to the Municipal Corporation")) $("#details").value = ""; });
}

const user = tokens.user(ROLE);
mountHeader({ role: tokens.get(ROLE) ? ROLE : undefined, label: "Booking", who: user?.name, nav: "/neighbourhood", links: [{ href: "/neighbourhood", text: "Find a space" }] });
load();
setInterval(() => { if (unlockAt && Date.now() >= unlockAt) load(); }, 30000); // address appears without a refresh
