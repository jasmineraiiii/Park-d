// Worker (attendant) dashboard. Only shows the lots assigned to the signed-in worker.

import { $, api, attachFeed, duration, esc, guard, handleAuthError, inr, live, log, mountHeader, pill, run, time, tokens, toast } from "./common.js";

const ROLE = "worker", LOGIN = "/worker/login";
if (!guard(ROLE, LOGIN)) throw new Error("not signed in");
attachFeed($("#feed"));

const user = tokens.user(ROLE);
mountHeader({ role: ROLE, label: "Worker", who: user?.name, home: "/worker/dashboard", onSignOut: () => { tokens.clear(ROLE); location.href = LOGIN; } });

let lots = [];        // assigned lots (summary)
let lotId = null;     // selected lot
let slots = [];       // slots of selected lot
let openSlotId = null;

const call = async (method, path, body) => {
  try { return await api(method, path, body, ROLE); }
  catch (e) { if (!handleAuthError(e, ROLE, LOGIN)) throw e; }
};

/* ---------- loading ---------- */
async function init() {
  try {
    await loadLots();
    if (!lots.length) { toast("No lots are assigned to this worker.", true); return; }
    $("#lotSelect").addEventListener("change", (e) => selectLot(e.target.value));
    await selectLot(lots[0]._id);
    live({ lot: onLotUpdate, slot: onSlotUpdate, zone: refreshZones, festival: refreshZones }, ROLE);
  } catch (e) { toast(e.message, true); }
}

// assigned lots, including temporary zones (shown even while inactive)
async function loadLots() {
  const r = await call("GET", "/attendant/lots");
  lots = r?.lots ?? [];
  const keep = lotId;
  $("#lotSelect").innerHTML = lots.map((l) => `<option value="${esc(l._id)}">${l.kind === "temporary" ? "🎉 " : ""}${esc(l.name)}${l.kind === "temporary" ? (l.zone?.status === "active" ? " · temporary, ACTIVE" : " · temporary, not active") : ""}</option>`).join("");
  if (keep) $("#lotSelect").value = keep;
}
let zoneT;
function refreshZones() { clearTimeout(zoneT); zoneT = setTimeout(async () => { await loadLots(); if (lotId) selectLot(lotId); }, 500); }
function renderZoneNotice(lot) {
  const el = $("#zoneNotice");
  if (lot.kind !== "temporary") { el.innerHTML = ""; return; }
  const z = lot.zone ?? {};
  el.innerHTML = z.status === "active"
    ? `<div class="notice yellow"><span class="tag temp">Temporary zone</span> <b>Open for Festival Mode.</b> Gates: ${esc((z.entryPoints ?? []).join(" · ") || "—")}. ${esc(z.restrictions ?? "")}</div>`
    : `<div class="notice grey"><span class="tag temp">Temporary zone</span> <b>Not active.</b> You can't register entries until the Municipal Corporation opens this zone. Cars already inside can still exit.</div>`;
}

async function selectLot(id) {
  lotId = id; openSlotId = null; $("#panel").classList.add("hidden");
  const d = await api("GET", `/lots/${id}`);
  slots = d.slots;
  const i = lots.findIndex((l) => l._id === id); if (i >= 0) lots[i] = { ...lots[i], ...d.lot };
  renderZoneNotice(d.lot);
  const closedZone = d.lot.kind === "temporary" && d.lot.zone?.status !== "active";
  $("#newCash").disabled = closedZone; $("#newUpi").disabled = closedZone;
  renderStats(d.lot.stats, d.lot);
  renderSlots();
  loadTransactions();
}

async function loadTransactions() {
  const t = await call("GET", `/attendant/lots/${lotId}/transactions`);
  if (!t) return;
  $("#collected").textContent = `${inr(t.collectedInr)} from ${t.count} payments`;
  $("#payments").innerHTML = t.payments.slice(0, 40).map((p) =>
    `<li><b>${esc(p.slotNumber)}</b> ${p.method === "cash" ? "Cash" : esc(p.upiApp || "UPI")} · ${esc(p.purpose)} <span class="num">${inr(p.amountInr)}</span><span class="time">${time(p.createdAt)}</span></li>`).join("") || `<li class="muted">No payments yet.</li>`;
  $("#log").innerHTML = t.log.map((a) =>
    `<li><span${a.action === "slot.correct" ? ' style="color:var(--warn)"' : ""}>${esc(a.detail)}</span><span class="time">${time(a.at)}</span></li>`).join("") || `<li class="muted">Your actions appear here.</li>`;
}

/* ---------- rendering ---------- */
function renderStats(s, lot) {
  const l = lot ?? lots.find((x) => x._id === lotId);
  $("#lotStats").innerHTML = `${pill(s)} <span class="muted small num">${s.occupied} parked · ${s.reserved} held · ${s.capacity} slots · fee ${inr(l?.feeInr)}</span>${s.open ? "" : ' <span class="pill full">Closed now</span>'}`;
  const bar = $("#occBar");
  bar.style.width = `${s.occupancyPct}%`;
  bar.style.background = s.occupancyPct >= 85 ? "var(--red)" : s.occupancyPct >= 70 ? "var(--yellow)" : "var(--green)";
  $("#slotSummary").textContent = `${s.occupancyPct}% full`;
}

function renderSlots() {
  $("#slots").innerHTML = slots.map((s) => `
    <button type="button" class="slot ${s.state}${s._id === openSlotId ? " sel" : ""}" data-id="${esc(s._id)}" aria-label="Slot ${esc(s.number)}, ${s.state}">
      ${s.kind === "reservable" ? '<span class="r">R</span>' : ""}
      <span>${s.state === "occupied" ? "🚗" : s.state === "reserved" ? "🔒" : ""}${esc(s.number)}</span>
    </button>`).join("");
}
$("#slots").addEventListener("click", (e) => {
  const b = e.target.closest(".slot");
  if (b) openSlot(b.dataset.id);
});

/* ---------- live updates ---------- */
function onLotUpdate(s) {
  if (s.lotId === lotId) renderStats(s);
}
function onSlotUpdate(u) {
  if (u.lotId !== lotId) return;
  const i = slots.findIndex((s) => s._id === u._id);
  if (i >= 0) slots[i] = { ...slots[i], ...u };
  renderSlots();
  document.querySelector(`.slot[data-id="${CSS.escape(u._id)}"]`)?.classList.add("flash");
  if (u._id === openSlotId) openSlot(u._id);
  clearTimeout(onSlotUpdate.t); onSlotUpdate.t = setTimeout(loadTransactions, 600);
}

/* ---------- one-tap entry ---------- */
async function quickEntry(method) {
  const r = await run(() => call("POST", `/attendant/lots/${lotId}/entry`, { method, upiApp: method === "upi" ? "Google Pay" : undefined }));
  if (r) toast(`${r.slot.number} assigned · fee recorded (${method.toUpperCase()})`);
}
$("#newCash").addEventListener("click", () => quickEntry("cash"));
$("#newUpi").addEventListener("click", () => quickEntry("upi"));

/* ---------- slot panel ---------- */
async function openSlot(id) {
  openSlotId = id; renderSlots();
  const panel = $("#panel");
  panel.classList.remove("hidden");
  panel.innerHTML = `<p class="muted">Loading…</p>`;
  const d = await call("GET", `/attendant/slots/${encodeURIComponent(id)}`).catch((e) => { toast(e.message, true); });
  if (!d) return;
  const { slot, session, reservation } = d;
  const fee = lots.find((l) => l._id === slot.lotId)?.feeInr;
  let body = "";

  if (slot.state === "available") {
    body = `
      <label class="field">Vehicle number (optional)<input class="input" id="veh" placeholder="CH01 AB 1234" /></label>
      <label class="field">Fee ${inr(fee)}
        <select class="input" id="method"><option value="cash">Cash paid</option><option value="upi">UPI paid</option><option value="">Collect later</option></select>
      </label>
      <button class="btn primary big" id="doEntry" type="button">Register entry</button>
      ${slot.kind === "reservable" ? '<p class="muted small">This is a reservation-pool slot. Use it for walk-ins only if the lot is otherwise full.</p>' : ""}`;
  } else if (slot.state === "occupied") {
    body = `
      <dl class="kv">
        <dt>Vehicle</dt><dd>${esc(session?.vehicleNo || "Not recorded")}</dd>
        <dt>Since</dt><dd class="num">${session ? `${time(session.startedAt)} · ${duration(Date.now() - new Date(session.startedAt))}` : "—"}</dd>
        <dt>Fee</dt><dd style="color:${session?.paymentId ? "var(--ok)" : "var(--warn)"}">${session?.paymentId ? "Paid" : `${inr(session?.feeInr)} due`}</dd>
        <dt>Source</dt><dd>${esc(session?.source || "—")}</dd>
      </dl>
      ${session && !session.paymentId ? `<div class="row"><button class="btn" id="payCash" type="button">Cash paid</button><button class="btn" id="payUpi" type="button">UPI paid</button></div>` : ""}
      <button class="btn primary big" id="doExit" type="button" ${session && !session.paymentId ? "disabled" : ""}>Car exited · free slot</button>
      <details><summary class="small" style="color:var(--warn);cursor:pointer">Assigned by mistake?</summary>
        <div class="grid" style="margin-top:8px">
          <label class="field">Reason (saved to the log)<input class="input" id="reason" placeholder="e.g. Tapped wrong slot" /></label>
          <button class="btn danger" id="doCorrect" type="button">Void & free slot</button>
        </div>
      </details>`;
  } else {
    body = `
      <dl class="kv">
        <dt>Booking</dt><dd>${esc(reservation?._id || "—")}</dd>
        <dt>Status</dt><dd>${reservation?.status === "held" ? "Paid, on hold" : "Awaiting payment"}</dd>
        <dt>Hold ends</dt><dd class="num">${reservation ? `${time(reservation.expiresAt)} (${duration(new Date(reservation.expiresAt) - Date.now())} left)` : "—"}</dd>
      </dl>
      <button class="btn primary big" id="doCheckIn" type="button" ${reservation?.status !== "held" ? "disabled" : ""}>Driver arrived · check in</button>
      <button class="btn danger" id="doRelease" type="button">Release hold</button>`;
  }

  panel.innerHTML = `
    <button class="btn small close" id="closePanel" type="button" aria-label="Close">✕</button>
    <div><div class="muted small">${slot.kind === "reservable" ? "Reservation pool" : "Walk-in slot"}</div><div class="big">${esc(slot.number)}</div><div class="muted">${slot.state}</div></div>
    ${body}`;

  const on = (sel, fn) => panel.querySelector(sel)?.addEventListener("click", fn);
  const enc = encodeURIComponent(id);
  on("#closePanel", closePanel);
  on("#doEntry", async () => {
    const method = $("#method").value || undefined;
    if (await run(() => call("POST", `/attendant/lots/${lotId}/entry`, { slotId: id, vehicleNo: $("#veh").value, method }), `${slot.number} occupied`)) closePanel();
  });
  on("#payCash", () => run(() => call("POST", `/attendant/slots/${enc}/payment`, { method: "cash" }), "Cash recorded").then(() => openSlot(id)));
  on("#payUpi", () => run(() => call("POST", `/attendant/slots/${enc}/payment`, { method: "upi", upiApp: "Google Pay" }), "UPI recorded").then(() => openSlot(id)));
  on("#doExit", async () => { if (await run(() => call("POST", `/attendant/slots/${enc}/exit`), `${slot.number} is free`)) closePanel(); });
  on("#doCorrect", async () => { if (await run(() => call("POST", `/attendant/slots/${enc}/correct`, { reason: $("#reason").value }), `${slot.number} corrected`)) closePanel(); });
  on("#doCheckIn", async () => { if (await run(() => call("POST", `/reservations/${reservation._id}/check-in`), "Driver checked in")) closePanel(); });
  on("#doRelease", async () => { if (await run(() => call("POST", `/reservations/${reservation._id}/cancel`), "Hold released")) closePanel(); });
}
function closePanel() { openSlotId = null; $("#panel").classList.add("hidden"); renderSlots(); }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });

log(`Signed in as ${user?.name} (worker)`, "ok");
init();
