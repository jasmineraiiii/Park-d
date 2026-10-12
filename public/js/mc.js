// Municipal Corporation dashboard. City-wide view; refreshes when any slot changes.

import { $, api, attachFeed, countUp, dateTime, esc, guard, handleAuthError, inr, live, log, mountHeader, pill, run, sectorLabel, spaceTypeLabel, time, tokens, toast } from "./common.js";

const ROLE = "mc", LOGIN = "/mc/login";
if (!guard(ROLE, LOGIN)) throw new Error("not signed in");
attachFeed($("#feed"));

const user = tokens.user(ROLE);
mountHeader({ role: ROLE, mc: true, label: "Municipal Corporation", who: user?.name, home: "/mc/dashboard", onSignOut: () => { tokens.clear(ROLE); location.href = LOGIN; } });

const call = async (method, path, body) => {
  try { return await api(method, path, body, ROLE); }
  catch (e) { if (!handleAuthError(e, ROLE, LOGIN)) throw e; }
};
const colorFor = (pct) => (pct >= 85 ? "var(--red)" : pct >= 70 ? "var(--yellow)" : "var(--green)");
const kpi = (label, value, sub = "") => {
  const m = String(value).match(/^(₹?)([\d,]+)(%?)$/); // numbers count up when they change
  const v = m ? `<span data-count="${m[2].replace(/,/g, "")}" data-prefix="${m[1]}" data-suffix="${m[3]}">${value}</span>` : value;
  return `<div class="kpi"><div class="label">${label}</div><div class="value">${v}</div><div class="sub">${sub}</div></div>`;
};
const prevCounts = new Map();
function paintCounts(root) {
  root.querySelectorAll("[data-count]").forEach((el, i) => { const k = `${root.id}:${i}`; el.dataset.from = prevCounts.get(k) ?? 0; prevCounts.set(k, el.dataset.count); });
  countUp(root);
}

async function loadOverview() {
  const o = await call("GET", "/admin/overview");
  if (!o) return;
  const upiPct = o.revenue.totalInr ? Math.round((o.revenue.upiInr / o.revenue.totalInr) * 100) : 0;
  $("#overview").innerHTML = [
    kpi("Registered lots", o.lots.total, `${o.lots.openNow} open now`),
    kpi("Total capacity", o.capacity.toLocaleString("en-IN"), "slots"),
    kpi("Available now", o.available, "across all lots"),
    kpi("Occupancy", `${o.occupancyPct}%`, "parked + held"),
    kpi("Revenue · 24 h", inr(o.revenue.totalInr), `${o.revenue.payments} payments`),
    kpi("UPI share", `${upiPct}%`, `${inr(o.revenue.upiInr)} UPI · ${inr(o.revenue.cashInr)} cash`),
  ].join("");
  paintCounts($("#overview"));

  $("#sectors").innerHTML = o.sectors.map((s) => `
    <div class="hbar"><span>${esc(s.sector)}</span>
      <div class="bar"><div style="width:${s.occupancyPct}%;background:${colorFor(s.occupancyPct)}"></div></div>
      <span class="num">${s.occupancyPct}%</span></div>`).join("");

  $("#upiBar").style.width = `${upiPct}%`; $("#cashBar").style.width = `${100 - upiPct}%`;
  $("#payments").innerHTML = `<p><b style="color:var(--mc)">UPI</b> ${inr(o.revenue.upiInr)} (${o.revenue.upiCount}) · <b style="color:var(--green-ink)">Cash</b> ${inr(o.revenue.cashInr)} (${o.revenue.cashCount})</p>` +
    o.revenue.byApp.map((a) => `<div class="row" style="justify-content:space-between"><span>${a.app}</span><span class="num">${a.count}</span></div>`).join("");

  $("#alerts").innerHTML = o.alerts.map((a) => `<li>⚠️ ${esc(a.name)} <span class="time"><b>${a.occupancyPct}%</b> · ${a.available} free</span></li>`).join("") || `<li class="muted">No lot is above 85% right now.</li>`;
  $("#recent").innerHTML = o.recent.map((r) => `<li><span class="tag" style="${r.kind === "entry" ? "background:var(--ok-bg);color:var(--ok)" : ""}">${r.kind}</span> ${esc(r.lotName.replace(" Parking", ""))} · ${esc(r.slotNumber)}<span class="time">${time(r.at)}</span></li>`).join("");
}

async function loadHourly() {
  const h = await call("GET", "/admin/hourly");
  if (!h) return;
  const max = Math.max(1, ...h.hours.map((x) => x.entries));
  $("#hourly").innerHTML = h.hours.map((x) => `
    <div class="col" title="${x.hour}:00 – ${x.entries} entries">
      <div style="height:${(x.entries / max) * 100}%"></div>
      <span>${x.hour % 3 === 0 ? x.hour : ""}</span>
    </div>`).join("");
}

async function loadLots() {
  if (document.activeElement?.classList.contains("fee")) return; // don't wipe a fee someone is typing
  const lots = (await api("GET", "/lots")).lots.filter((l) => l.kind !== "temporary");
  $("#lots").innerHTML = `<thead><tr><th>Lot</th><th>Sector</th><th>Capacity</th><th>Availability</th><th>Occupancy</th><th>Reservable</th><th>Fee (₹)</th><th></th></tr></thead><tbody>` +
    lots.map((l) => `<tr data-id="${esc(l._id)}">
      <td><b>${esc(l.name)}</b></td><td>${/^\d+$/.test(l.sector) ? `Sector ${l.sector}` : esc(l.sector)}</td>
      <td class="num">${l.capacity}</td><td>${pill(l.stats)}</td>
      <td class="num" style="color:${colorFor(l.stats.occupancyPct)}">${l.stats.occupancyPct}%</td>
      <td class="num">${l.stats.reservableFree}/${l.stats.reservableTotal}</td>
      <td><input class="input num fee" value="${l.feeInr}" inputmode="numeric" aria-label="Fee for ${esc(l.name)}" /></td>
      <td><button class="btn small save" type="button">Save</button></td></tr>`).join("") + "</tbody>";
}
$("#lots").addEventListener("click", async (e) => {
  const b = e.target.closest(".save"); if (!b) return;
  const tr = b.closest("tr");
  const fee = Number(tr.querySelector(".fee").value);
  await run(() => call("PATCH", `/admin/lots/${tr.dataset.id}`, { feeInr: fee }), "Fee updated");
  loadAudit();
});

async function loadWorkers() {
  const r = await call("GET", "/admin/attendants");
  if (!r) return;
  $("#workers").innerHTML = `<thead><tr><th>Worker</th><th>Lots</th><th>Collected 24 h</th><th>Cash to deposit</th><th>Corrections</th></tr></thead><tbody>` +
    r.attendants.map((a) => `<tr><td><b>${esc(a.name)}</b><div class="muted small">${esc(a.username)}</div></td><td class="num">${a.assignedLotIds.length}</td>
      <td class="num">${inr(a.collectedInr)}</td><td class="num">${inr(a.cashToDepositInr)}</td>
      <td class="num" style="${a.corrections ? "color:var(--warn);font-weight:700" : ""}">${a.corrections}</td></tr>`).join("") + "</tbody>";
}

async function loadAudit() {
  const r = await call("GET", `/admin/audit?type=${$("#auditType").value}&limit=150`);
  if (!r) return;
  $("#audit").innerHTML = `<thead><tr><th>Time</th><th>Who</th><th>Action</th><th>Lot</th><th>Detail</th></tr></thead><tbody>` +
    r.entries.map((a) => `<tr${a.action === "slot.correct" ? ' style="background:var(--warn-bg)"' : ""}><td class="num">${time(a.at)}</td><td>${esc(a.actorName || a.actorRole)}</td><td><code>${esc(a.action)}</code></td><td>${esc(a.lotId || "—")}</td><td style="white-space:normal">${esc(a.detail)}</td></tr>`).join("") + "</tbody>";
}
$("#auditType").addEventListener("change", loadAudit);

$("#genInsights").addEventListener("click", async () => {
  $("#genInsights").disabled = true; $("#genInsights").textContent = "Thinking…";
  const r = await run(() => call("GET", "/admin/insights"));
  $("#genInsights").disabled = false; $("#genInsights").textContent = "Generate insights";
  if (!r) return;
  $("#aiSource").textContent = r.source === "groq" ? "from GroqCloud" : "rule-based (no Groq key)";
  $("#insights").innerHTML = r.insights.map((x) => `<li>💡 ${esc(x)}</li>`).join("");
});

/* refresh city figures when slots change, at most every 3 s */
let pending = null;
function scheduleRefresh() {
  if (pending) return;
  pending = setTimeout(async () => { pending = null; await Promise.all([loadOverview(), loadLots()]); }, 3000);
}

/* ======================= Festival Mode ======================= */
const OV = { pending: ["Needs decision", "temp"], activated: ["Zone opened", "green"], "auto-activated": ["Opened automatically", "green"], dismissed: ["Dismissed", ""], "no-zone": ["No eligible zone", "red"] };
let fest = null;
async function loadFestival() {
  fest = await call("GET", "/admin/festival");
  if (!fest) return;
  const active = fest.zones.filter((z) => z.zone.status === "active");
  $("#festState").innerHTML = `${fest.setting.active ? `<span class="tag temp">Banner ON${fest.setting.label ? ` · ${esc(fest.setting.label)}` : ""}</span>` : '<span class="tag">Banner off</span>'} · ${active.length} zone(s) active`;
  if (document.activeElement !== $("#festLabel")) $("#festLabel").value = fest.setting.label ?? "";

  const pend = fest.overflow.filter((e) => e.status === "pending");
  const rest = fest.overflow.filter((e) => e.status !== "pending").slice(0, 8);
  $("#overflow").innerHTML = fest.overflow.length ? `<thead><tr><th>When</th><th>Lot</th><th>Full</th><th>Recommended zone</th><th>Status</th><th></th></tr></thead><tbody>` +
    [...pend, ...rest].map((e) => { const [lab, tone] = OV[e.status] ?? [e.status, ""]; return `<tr data-ev="${esc(e._id)}"${e.status === "pending" ? ' style="background:var(--yellow-soft)"' : ""}>
      <td>${time(e.crossedAt ?? e.createdAt)}</td><td><b>${esc(e.lotName ?? e.lotId)}</b></td><td class="num">${e.occupancyPct}%</td>
      <td class="wrapcell">${e.recommended.length ? (e.status === "pending" && e.recommended.length > 1 ? `<select class="input evZone" style="width:auto">${e.recommended.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("")}</select>` : esc(e.recommended.map((r) => r.name).join(", "))) : `<span class="muted">${esc(e.note ?? "—")}</span>`}</td>
      <td><span class="tag ${tone}">${lab}</span></td>
      <td>${e.status === "pending" ? `<button class="btn small mc" data-evact="activate" type="button">Activate</button> <button class="btn small" data-evact="dismiss" type="button">Dismiss</button>` : ""}</td></tr>`; }).join("") + "</tbody>"
    : `<tbody><tr><td class="muted">No overflow so far. Lots raise a recommendation when they cross their threshold.</td></tr></tbody>`;

  $("#zones").innerHTML = `<thead><tr><th>Zone</th><th>Linked to</th><th>Status</th><th>Spaces</th><th>Approved</th><th>Auto-open</th><th>Workers</th><th>Checks</th><th></th></tr></thead><tbody>` +
    fest.zones.map((z) => { const on = z.zone.status === "active"; return `<tr data-zone="${esc(z._id)}">
      <td><b>${esc(z.name)}</b><div class="small muted">${esc(sectorLabel(z.sector))}${z.zone.demo ? " · demo site" : ""}</div></td>
      <td class="small">${esc((z.zone.linkedLotIds ?? []).join(", ") || "—")}</td>
      <td>${on ? '<span class="tag green">Active</span>' : `<span class="tag">${esc(z.zone.status)}</span>`}</td>
      <td class="num">${on ? `${z.stats.available} free / ${z.capacity}` : z.capacity}</td>
      <td><input type="checkbox" class="zApproved" ${z.zone.approved ? "checked" : ""} aria-label="Approved" /></td>
      <td><input type="checkbox" class="zAuto" ${z.zone.autoActivate ? "checked" : ""} aria-label="Auto-activate" /></td>
      <td class="small">${esc(z.workers.join(", ") || "none")}</td>
      <td class="wrapcell small">${z.problems.length ? `<span style="color:var(--full)">✗ ${esc(z.problems.join("; "))}</span>` : '<span style="color:var(--ok)">✓ ready</span>'}</td>
      <td>${on ? `<button class="btn small danger" data-zact="deactivate" type="button">Close</button>` : `<button class="btn small mc" data-zact="activate" type="button" ${z.problems.length ? "disabled" : ""}>Activate</button>`}</td></tr>`; }).join("") + "</tbody>";

  if (document.activeElement?.closest("#thresholds")) return;
  $("#thresholds").innerHTML = `<thead><tr><th>Lot</th><th>Now</th><th>Threshold %</th><th>Buffer %</th><th>Overflow zones</th><th></th></tr></thead><tbody>` +
    fest.lots.map((l) => `<tr data-lot="${esc(l._id)}"><td><b>${esc(l.name)}</b></td><td class="num">${l.occupancyPct}%</td>
      <td><input class="input num th" value="${l.overflow?.thresholdPct ?? 90}" inputmode="numeric" aria-label="Threshold" /></td>
      <td><input class="input num bf" value="${l.overflow?.bufferPct ?? 5}" inputmode="numeric" aria-label="Buffer" /></td>
      <td class="small">${esc((l.overflow?.zoneIds ?? []).join(", ") || "—")}</td>
      <td><button class="btn small saveTh" type="button">Save</button></td></tr>`).join("") + "</tbody>";

  const sel = $("#fillLot");
  if (!sel.options.length) {
    const good = fest.lots.filter((l) => (l.overflow?.zoneIds ?? []).length);
    sel.innerHTML = good.map((l) => `<option value="${esc(l._id)}">${esc(l.name)} → ${esc(l.overflow.zoneIds.join(", "))}</option>`).join("");
    const pref = good.find((l) => l._id === "s17-ml"); if (pref) sel.value = pref._id;
  }
}
$("#festOn").addEventListener("click", async () => { if (await run(() => call("POST", "/admin/festival", { active: true, label: $("#festLabel").value.trim() || undefined }), "Festival banner on")) loadFestival(); });
$("#festOff").addEventListener("click", async () => { if (await run(() => call("POST", "/admin/festival", { active: false }), "Festival banner off")) loadFestival(); });
$("#fillBtn").addEventListener("click", async () => {
  const b = $("#fillBtn"); b.disabled = true;
  const r = await run(() => call("POST", "/admin/demo/fill", { lotId: $("#fillLot").value, targetPct: 95 }));
  b.disabled = false;
  if (r) toast(`Filled ${r.filled} slots (simulated). ${r.overflow ? `Overflow: ${r.overflow.status}.` : "No new overflow event (already alerted, or no change)."}`);
  loadFestival(); loadAudit();
});
$("#overflow").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-evact]"); if (!b) return;
  const tr = b.closest("tr");
  const zoneId = tr.querySelector(".evZone")?.value;
  if (await run(() => call("POST", `/admin/overflow/${tr.dataset.ev}/${b.dataset.evact}`, zoneId ? { zoneId } : {}), b.dataset.evact === "activate" ? "Zone opened. Nearby drivers notified." : "Dismissed")) { loadFestival(); loadAudit(); }
});
$("#zones").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-zact]"); if (!b) return;
  const id = b.closest("tr").dataset.zone;
  if (b.dataset.zact === "deactivate" && !window.confirm("Close this zone? New entries stop; parked cars can still exit.")) return;
  if (await run(() => call("POST", `/admin/zones/${id}/${b.dataset.zact}`), b.dataset.zact === "activate" ? "Zone opened. Nearby drivers notified." : "Zone closed")) { loadFestival(); loadAudit(); }
});
$("#zones").addEventListener("change", async (e) => {
  const tr = e.target.closest("tr[data-zone]"); if (!tr) return;
  const body = e.target.classList.contains("zApproved") ? { approved: e.target.checked } : e.target.classList.contains("zAuto") ? { autoActivate: e.target.checked } : null;
  if (!body) return;
  await run(() => call("PATCH", `/admin/zones/${tr.dataset.zone}`, body), "Zone updated");
  loadFestival(); loadAudit();
});
$("#thresholds").addEventListener("click", async (e) => {
  const b = e.target.closest(".saveTh"); if (!b) return;
  const tr = b.closest("tr");
  await run(() => call("PATCH", `/admin/lots/${tr.dataset.lot}`, { thresholdPct: Number(tr.querySelector(".th").value), bufferPct: Number(tr.querySelector(".bf").value) }), "Overflow settings saved");
  b.blur(); loadFestival(); loadAudit();
});

/* ======================= Neighbourhood Parking ======================= */
const LST = { active: "green", paused: "", suspended: "red" };
async function loadNeighbourhood() {
  const n = await call("GET", "/admin/neighbourhood");
  if (!n) return;
  $("#nbKpis").innerHTML = [
    kpi("Live listings", n.counts.active ?? 0, `${n.counts.paused ?? 0} paused`),
    kpi("Waiting for review", n.counts.pending ?? 0, "new spaces"),
    kpi("Bookings this week", n.bookingsThisWeek, "confirmed + completed"),
    kpi("Open reports", n.openReports, `${n.counts.suspended ?? 0} suspended listings`),
  ].join("");
  paintCounts($("#nbKpis"));
  $("#pending").innerHTML = n.pending.length ? n.pending.map((l) => `<article class="lcard" data-l="${esc(l._id)}">
      <div class="row" style="gap:6px"><span class="tag">${esc(spaceTypeLabel(l.type))}</span>${l.demo ? '<span class="tag demo">Demo</span>' : ""}<span class="tag">${esc(sectorLabel(l.sector))}</span></div>
      <h3>${esc(l.title)}</h3>
      <div class="small"><b>Host:</b> ${esc(l.hostName ?? "—")} · ${inr(l.ratePerHourInr)}/h · ${l.spaces} space(s)</div>
      <div class="small"><b>Address (private):</b> ${esc(l.exactAddress)}</div>
      <div class="small muted">Declaration ${l.declarationAccepted ? "accepted ✓" : "missing ✗"} · submitted ${dateTime(l.createdAt)}</div>
      <input class="input note" placeholder="Note to host (optional)" />
      <div class="foot"><button class="btn small mc" data-mod="approve" type="button">Approve</button><button class="btn small danger" data-mod="reject" type="button">Reject</button></div>
    </article>`).join("") : `<p class="muted small">Nothing waiting. New host listings appear here.</p>`;
  $("#reports").innerHTML = n.reports.length ? `<thead><tr><th>When</th><th>Booking</th><th>From</th><th>Problem</th><th>Details</th><th>Status</th><th></th></tr></thead><tbody>` +
    n.reports.map((r) => `<tr data-r="${esc(r._id)}"><td>${dateTime(r.createdAt)}</td><td>${esc(r.bookingId)}</td><td>${esc(r.reporterRole)}</td><td>${esc(r.kind)}</td><td class="wrapcell">${esc(r.details || "—")}</td><td><span class="tag ${r.status === "open" ? "red" : ""}">${esc(r.status)}</span></td>
      <td>${r.status === "open" ? `<button class="btn small" data-resolve type="button">Resolve</button> <button class="btn small danger" data-suspend="${esc(r.listingId)}" type="button">Suspend listing</button>` : ""}</td></tr>`).join("") + "</tbody>"
    : `<tbody><tr><td class="muted">No reports.</td></tr></tbody>`;
  $("#nbListings").innerHTML = `<thead><tr><th>Listing</th><th>Sector</th><th>Rate</th><th>Status</th><th></th></tr></thead><tbody>` +
    n.listings.map((l) => `<tr data-l="${esc(l._id)}"><td><b>${esc(l.title)}</b>${l.demo ? ' <span class="tag demo">Demo</span>' : ""}</td><td>${esc(sectorLabel(l.sector))}</td><td class="num">${inr(l.ratePerHourInr)}/h</td><td><span class="tag ${LST[l.status] ?? ""}">${esc(l.status)}</span></td>
      <td>${l.status === "suspended" ? `<button class="btn small" data-mod="reinstate" type="button">Reinstate</button>` : `<button class="btn small danger" data-mod="suspend" type="button">Suspend</button>`}</td></tr>`).join("") + "</tbody>";
}
$("#neighbourhood").addEventListener("click", async (e) => {
  const m = e.target.closest("[data-mod]");
  if (m) {
    const box = m.closest("[data-l]");
    const note = box.querySelector(".note")?.value.trim() || (["suspend", "reject"].includes(m.dataset.mod) ? window.prompt("Reason (sent to the host):") ?? undefined : undefined);
    if (await run(() => call("POST", `/admin/listings/${box.dataset.l}/${m.dataset.mod}`, { note }), `Listing ${m.dataset.mod === "approve" ? "approved and live" : m.dataset.mod + "ed"}`)) { loadNeighbourhood(); loadAudit(); }
    return;
  }
  const r = e.target.closest("[data-resolve]");
  if (r) { if (await run(() => call("POST", `/admin/reports/${r.closest("tr").dataset.r}/resolve`), "Report resolved")) loadNeighbourhood(); return; }
  const s = e.target.closest("[data-suspend]");
  if (s) {
    const note = window.prompt("Reason for suspending (sent to the host):") ?? undefined;
    if (await run(() => call("POST", `/admin/listings/${s.dataset.suspend}/suspend`, { note }), "Listing suspended")) { await call("POST", `/admin/reports/${s.closest("tr").dataset.r}/resolve`).catch(() => {}); loadNeighbourhood(); loadAudit(); }
  }
});

/* ======================= start ======================= */
log(`Signed in as ${user?.name} (MC)`, "ok");
Promise.all([loadOverview(), loadFestival(), loadNeighbourhood(), loadHourly(), loadLots(), loadWorkers(), loadAudit()])
  .then(() => { if (location.hash) document.querySelector(location.hash)?.scrollIntoView(); })
  .catch((e) => log(e.message, "err"));
let festT;
const festSoon = () => { clearTimeout(festT); festT = setTimeout(loadFestival, 700); };
live({
  lot: () => { scheduleRefresh(); festSoon(); },
  zone: festSoon, festival: festSoon,
  overflow: (o) => { toast(`⚠️ ${o.lotName} is ${o.occupancyPct}% full`); festSoon(); },
  listing: () => loadNeighbourhood(),
  notification: (n) => { if (n.type?.startsWith("report") || n.type?.startsWith("listing")) loadNeighbourhood(); },
}, ROLE);
window.addEventListener("hashchange", () => document.querySelector(location.hash)?.scrollIntoView({ behavior: "smooth" }));
setInterval(() => { loadAudit(); loadWorkers(); loadHourly(); }, 30000);
