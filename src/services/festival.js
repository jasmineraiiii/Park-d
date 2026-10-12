// Festival Mode: temporary overflow parking zones.
//
// Rules that matter:
// - A zone can only be activated if it is MC-approved, inside its operating
//   window and staffed by at least one assigned worker. Crossing an occupancy
//   threshold never turns an ordinary site into parking.
// - Overflow detection creates ONE recommendation per crossing; the lot is
//   "re-armed" only after occupancy falls below (threshold - buffer).
// - Auto-activation happens only for zones with a pre-approved autoActivate
//   policy, and only when every requirement above holds.
// - Drivers are told about a zone only once it is actually active and has space.

import mongoose from "mongoose";
import { fail } from "../errors.js";
import { Lot, OverflowEvent, Payment, Session, Setting, Slot, User } from "../models/index.js";
import { emitAll, emitLotChange, emitSlotChange, emitToAdmins } from "../realtime.js";
import { withLocks } from "./locks.js";
import { notify } from "./notify.js";
import { distanceKm, resolvePlace } from "./search.js";
import { allLotsWithStats, lotStats, publicLotsWithStats } from "./stats.js";
import { audit, isLotOpen, makeCode } from "./util.js";

const sectorLabel = (s) => (/^\d+$/.test(s) ? `Sector ${s}` : s);

/* ---------------- status ---------------- */

export async function getSetting() {
  return (await Setting.findById("festival").lean()) ?? { _id: "festival", active: false };
}

/** Requirements a zone must meet before it may take vehicles. Returns a list of problems (empty = OK). */
export async function zoneProblems(zone, at = new Date()) {
  const z = zone.zone ?? {};
  const problems = [];
  if (zone.kind !== "temporary") problems.push("not a temporary zone");
  if (!z.approved) problems.push("not approved by the Municipal Corporation");
  if (z.startsAt && at < new Date(z.startsAt)) problems.push("its approved window has not started");
  if (z.endsAt && at > new Date(z.endsAt)) problems.push("its approved window has ended");
  const staffed = await User.exists({ role: "attendant", assignedLotIds: zone._id });
  if (!staffed) problems.push("no worker is assigned");
  return problems;
}

/** Public Festival Mode status for the driver home screen. */
export async function festivalStatus(origin) {
  const setting = await getSetting();
  const zones = (await allLotsWithStats({ kind: "temporary" })).filter((z) => z.zone?.status === "active");
  const withDistance = zones.map((z) => ({ ...publicZone(z), distanceKm: origin ? round2(distanceKm(origin, z)) : null }));
  withDistance.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  return {
    active: Boolean(setting.active) || zones.length > 0,
    label: setting.label || (zones.length ? "Extra parking open" : null),
    citywideToggle: Boolean(setting.active),
    zones: withDistance,
    activeZoneCount: zones.length,
    extraFree: zones.reduce((a, z) => a + z.stats.available, 0),
    nearest: withDistance.find((z) => z.stats.available > 0) ?? null,
  };
}
const round2 = (n) => Math.round(n * 100) / 100;

/** Strips private contact details unless the MC allowed them to be shown. */
export function publicZone(z) {
  const zone = { ...(z.zone ?? {}) };
  if (!zone.contactPublic) delete zone.contact;
  delete zone.activatedBy;
  return { ...z, zone };
}

/* ---------------- activation ---------------- */

export async function activateZone(actor, zoneId, { auto = false, reason = "" } = {}) {
  return withLocks([`zone:${zoneId}`], async () => {
    const zone = await Lot.findById(zoneId).lean();
    if (!zone || zone.kind !== "temporary") fail("not-found", "That temporary zone does not exist.");
    if (zone.zone?.status === "active") fail("invalid-state", `${zone.name} is already active.`);
    const problems = await zoneProblems(zone);
    if (problems.length) fail("invalid-state", `${zone.name} can't be activated: ${problems.join(", ")}.`);
    const activatedAt = new Date();
    const updated = await Lot.findOneAndUpdate(
      { _id: zoneId, "zone.status": { $ne: "active" } },
      { $set: { "zone.status": "active", "zone.activatedAt": activatedAt, "zone.activatedBy": actor === "system" ? "system" : String(actor._id) } },
      { new: true },
    ).lean();
    if (!updated) fail("invalid-state", `${zone.name} is already active.`);
    await audit(actor, auto ? "zone.auto-activate" : "zone.activate", `${zone.name} opened as temporary parking${reason ? ` (${reason})` : ""}`, zoneId);
    emitAll("zone:update", { zoneId, status: "active" });
    emitLotChange(zoneId);
    emitAll("festival:update", await festivalStatus());
    notifyDriversAboutZone(updated).catch((e) => console.error("[festival] notify failed", e.message));
    return updated;
  });
}

export async function deactivateZone(actor, zoneId) {
  return withLocks([`zone:${zoneId}`], async () => {
    const zone = await Lot.findOneAndUpdate(
      { _id: zoneId, kind: "temporary", "zone.status": "active" },
      { $set: { "zone.status": "closed" } },
      { new: true },
    ).lean();
    if (!zone) fail("invalid-state", "That zone is not active.");
    const parked = await Slot.countDocuments({ lotId: zoneId, state: "occupied" });
    await audit(actor, "zone.deactivate", `${zone.name} closed${parked ? ` (${parked} vehicles still parked; exits allowed)` : ""}`, zoneId);
    emitAll("zone:update", { zoneId, status: "closed" });
    emitLotChange(zoneId);
    emitAll("festival:update", await festivalStatus());
    return zone;
  });
}

export async function setFestivalToggle(admin, { active, label }) {
  const doc = await Setting.findOneAndUpdate(
    { _id: "festival" },
    { $set: { active: Boolean(active), label: (label || "").trim().slice(0, 60) || null, startedBy: String(admin._id), startedAt: new Date() } },
    { upsert: true, new: true },
  ).lean();
  await audit(admin, "festival.toggle", `Festival Mode banner ${active ? `ON${doc.label ? ` (“${doc.label}”)` : ""}` : "OFF"}`);
  emitAll("festival:update", await festivalStatus());
  return doc;
}

/* ---------------- driver targeting ---------------- */

/** Remembers a driver's last 3 searched places (used only for Festival alerts). */
export async function rememberSearch(user, place) {
  if (!user || user.role !== "driver" || !place) return;
  const entry = { label: place.label, sector: place.sector ?? null, lat: place.lat, lng: place.lng, at: new Date() };
  await User.updateOne({ _id: user._id }, { $push: { recentSearches: { $each: [entry], $slice: -3 } } });
}

export async function rememberLocation(user, lat, lng) {
  if (!user || user.role !== "driver" || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
  await User.updateOne({ _id: user._id }, { $set: { lastLocation: { lat, lng, at: new Date() } } });
}

/** Sends "extra parking open" to drivers who searched near the zone recently or are close by. */
export async function notifyDriversAboutZone(zone) {
  const stats = await lotStats(zone._id);
  if (!stats || stats.available <= 0 || zone.zone?.status !== "active") return 0; // never announce full or inactive zones
  const since = new Date(Date.now() - 3 * 3600000);
  const linkedSectors = new Set([zone.sector]);
  const linked = await Lot.find({ _id: { $in: zone.zone?.linkedLotIds ?? [] } }, { sector: 1 }).lean();
  linked.forEach((l) => linkedSectors.add(l.sector));

  const drivers = await User.find({ role: "driver", "notificationPrefs.festivalAlerts": { $ne: false } }, { recentSearches: 1, lastLocation: 1 }).lean();
  const key = `zone-open:${zone._id}:${new Date(zone.zone.activatedAt).getTime()}`;
  let sent = 0;
  for (const d of drivers) {
    const searchedNear = (d.recentSearches ?? []).some((s) => new Date(s.at) >= since && (
      (s.sector && linkedSectors.has(s.sector)) || (Number.isFinite(s.lat) && distanceKm(s, zone) <= 1.5)));
    const isNear = d.lastLocation?.at && new Date(d.lastLocation.at) >= since && distanceKm(d.lastLocation, zone) <= 2;
    if (!searchedNear && !isNear) continue;
    const n = await notify(d._id, {
      type: "zone.opened",
      pref: "festivalAlerts",
      key,
      title: "Extra parking is now available!",
      body: `A temporary parking zone has opened near ${sectorLabel(zone.sector)}. ${stats.available} spaces free. Check spaces and get directions.`,
      link: `/zone?id=${encodeURIComponent(zone._id)}`,
    });
    if (n) sent++;
  }
  if (sent) console.log(`[festival] notified ${sent} driver(s) about ${zone._id}`);
  return sent;
}

/* ---------------- overflow detection ---------------- */

const pendingChecks = new Map();
/** Debounced check after slot changes. */
export function scheduleOverflowCheck(lotId) {
  if (pendingChecks.has(lotId)) return;
  pendingChecks.set(lotId, setTimeout(() => {
    pendingChecks.delete(lotId);
    checkOverflow(lotId).catch((e) => console.error("[overflow]", e.message));
  }, 1200));
}

export async function checkAllOverflow() {
  const lots = await Lot.find({ kind: { $ne: "temporary" } }, { _id: 1 }).lean();
  for (const l of lots) await checkOverflow(l._id);
}

/** Creates one recommendation per threshold crossing, re-arming below (threshold - buffer). */
export async function checkOverflow(lotId) {
  return withLocks([`overflow:${lotId}`], async () => {
    const lot = await Lot.findById(lotId).lean();
    if (!lot || lot.kind === "temporary") return null;
    const stats = await lotStats(lotId);
    const t = lot.overflow?.thresholdPct ?? 90, buffer = lot.overflow?.bufferPct ?? 5;
    const armed = lot.overflow?.armed !== false;
    const pct = stats.occupancyPct;

    if (!armed) {
      if (pct < t - buffer) await Lot.updateOne({ _id: lotId }, { $set: { "overflow.armed": true } });
      return null;
    }
    if (pct < t || !stats.open) return null;

    // crossed: disarm first so concurrent checks can't create a second event
    const disarmed = await Lot.findOneAndUpdate({ _id: lotId, "overflow.armed": { $ne: false } }, { $set: { "overflow.armed": false } });
    if (!disarmed) return null;

    const candidates = await Lot.find({ _id: { $in: lot.overflow?.zoneIds ?? [] }, kind: "temporary" }).lean();
    const eligible = [];
    for (const z of candidates) {
      if (z.zone?.status === "active") continue; // already open; nothing new to recommend
      if ((await zoneProblems(z)).length === 0) eligible.push(z);
    }

    const ev = await OverflowEvent.create({
      lotId, occupancyPct: pct,
      recommendedZoneIds: eligible.map((z) => z._id),
      status: eligible.length ? "pending" : "no-zone",
      note: eligible.length ? null : "No approved, staffed zone is available in its window. Consider approving a site.",
    });
    await audit("system", "overflow.detected", `${lot.name} reached ${pct}% (threshold ${t}%). ${eligible.length ? `Recommended: ${eligible.map((z) => z.name).join(", ")}` : "No eligible zone."}`, lotId);

    // pre-approved automatic policy
    const auto = eligible.find((z) => z.zone?.autoActivate);
    if (auto) {
      try {
        await activateZone("system", auto._id, { auto: true, reason: `${lot.name} reached ${pct}%` });
        await OverflowEvent.updateOne({ _id: ev._id }, { $set: { status: "auto-activated", actedBy: "system", actedAt: new Date() } });
        ev.status = "auto-activated";
      } catch (e) {
        console.error("[overflow] auto-activation refused:", e.message);
      }
    }

    // tell every MC admin
    const admins = await User.find({ role: "admin" }, { _id: 1 }).lean();
    for (const a of admins) {
      await notify(a._id, {
        type: "overflow.alert",
        key: `overflow:${ev._id}`,
        title: `${lot.name} is ${pct}% full`,
        body: ev.status === "auto-activated" ? `${auto.name} was opened automatically under its pre-approved policy.`
          : eligible.length ? `Recommended: open ${eligible[0].name}. Review it in Festival Mode.` : "No approved temporary zone is available nearby.",
        link: "/mc/dashboard#festival",
      });
    }
    emitToAdmins("overflow:new", { ...ev.toObject(), lotName: lot.name });
    return ev.toObject();
  });
}

export async function listOverflow() {
  const events = await OverflowEvent.find().sort({ crossedAt: -1 }).limit(50).lean();
  const ids = [...new Set(events.flatMap((e) => [e.lotId, ...e.recommendedZoneIds]))];
  const names = Object.fromEntries((await Lot.find({ _id: { $in: ids } }, { name: 1 }).lean()).map((l) => [l._id, l.name]));
  return events.map((e) => ({ ...e, lotName: names[e.lotId], recommended: e.recommendedZoneIds.map((id) => ({ id, name: names[id] })) }));
}

export async function actOnOverflow(admin, eventId, action, zoneId) {
  const ev = await OverflowEvent.findById(eventId).lean();
  if (!ev) fail("not-found", "Recommendation not found.");
  if (ev.status !== "pending") fail("invalid-state", "This recommendation was already handled.");
  if (action === "dismiss") {
    await OverflowEvent.updateOne({ _id: eventId, status: "pending" }, { $set: { status: "dismissed", actedBy: String(admin._id), actedAt: new Date() } });
    await audit(admin, "overflow.dismiss", `Overflow recommendation for ${ev.lotId} dismissed`, ev.lotId);
    return { ok: true };
  }
  const target = zoneId || ev.recommendedZoneIds[0];
  if (!ev.recommendedZoneIds.includes(target)) fail("bad-request", "Pick one of the recommended zones.");
  await activateZone(admin, target, { reason: "approved from overflow recommendation" });
  await OverflowEvent.updateOne({ _id: eventId }, { $set: { status: "activated", actedBy: String(admin._id), actedAt: new Date() } });
  return { ok: true };
}

/* ---------------- admin config ---------------- */

export async function updateZone(admin, zoneId, body) {
  const zone = await Lot.findById(zoneId).lean();
  if (!zone || zone.kind !== "temporary") fail("not-found", "That temporary zone does not exist.");
  const set = {};
  const allowed = { approved: "boolean", autoActivate: "boolean", contactPublic: "boolean", restrictions: "string", accessibility: "string", contact: "string" };
  for (const [k, t] of Object.entries(allowed)) if (typeof body[k] === t) set[`zone.${k}`] = body[k];
  if (body.startsAt) set["zone.startsAt"] = new Date(body.startsAt);
  if (body.endsAt) set["zone.endsAt"] = new Date(body.endsAt);
  if (Array.isArray(body.entryPoints)) set["zone.entryPoints"] = body.entryPoints.map(String).slice(0, 6);
  if (Number.isInteger(body.feeInr) && body.feeInr >= 0 && body.feeInr <= 500) set.feeInr = body.feeInr;
  if (!Object.keys(set).length) fail("bad-request", "Nothing to update.");
  if (set["zone.approved"] === false && zone.zone?.status === "active") fail("invalid-state", "Close the zone before removing its approval.");
  await Lot.updateOne({ _id: zoneId }, { $set: set });
  await audit(admin, "zone.update", `${zone.name} settings changed: ${Object.keys(set).map((k) => k.replace("zone.", "")).join(", ")}`, zoneId);
  emitAll("zone:update", { zoneId });
  return Lot.findById(zoneId).lean();
}

export async function updateLotOverflow(admin, lotId, { thresholdPct, bufferPct, zoneIds }) {
  const lot = await Lot.findById(lotId).lean();
  if (!lot || lot.kind === "temporary") fail("not-found", "That parking lot does not exist.");
  const set = {};
  if (thresholdPct !== undefined) {
    if (!Number.isInteger(thresholdPct) || thresholdPct < 50 || thresholdPct > 100) fail("bad-request", "Threshold must be a whole number between 50 and 100.");
    set["overflow.thresholdPct"] = thresholdPct;
  }
  if (bufferPct !== undefined) {
    if (!Number.isInteger(bufferPct) || bufferPct < 0 || bufferPct > 30) fail("bad-request", "Buffer must be a whole number between 0 and 30.");
    set["overflow.bufferPct"] = bufferPct;
  }
  if (Array.isArray(zoneIds)) {
    const found = await Lot.countDocuments({ _id: { $in: zoneIds }, kind: "temporary" });
    if (found !== zoneIds.length) fail("bad-request", "Some zone ids are not temporary zones.");
    set["overflow.zoneIds"] = zoneIds;
  }
  if (!Object.keys(set).length) return lot;
  await Lot.updateOne({ _id: lotId }, { $set: set });
  await audit(admin, "lot.overflow", `${lot.name} overflow settings: ${JSON.stringify(set).replace(/overflow\./g, "")}`, lotId);
  return Lot.findById(lotId).lean();
}

/** Creates a new (unapproved, scheduled) temporary zone with numbered slots. */
export async function createZone(admin, body) {
  const { name, sector, address, lat, lng, capacity, feeInr = 14, startsAt, endsAt, opensAt = 9, closesAt = 23, linkedLotIds = [] } = body ?? {};
  if (!name || !sector || !Number.isFinite(lat) || !Number.isFinite(lng)) fail("bad-request", "Name, sector, lat and lng are required.");
  if (!Number.isInteger(capacity) || capacity < 5 || capacity > 500) fail("bad-request", "Capacity must be a whole number between 5 and 500.");
  const id = makeCode("tz-", 6).toLowerCase();
  const lot = await Lot.create({
    _id: id, name: String(name).slice(0, 80), sector: String(sector), address, lat, lng, capacity, feeInr,
    opensAt, closesAt, kind: "temporary", tags: ["temporary"],
    zone: { status: "scheduled", approved: false, startsAt: startsAt ? new Date(startsAt) : new Date(), endsAt: endsAt ? new Date(endsAt) : new Date(Date.now() + 7 * 86400000), linkedLotIds },
  });
  const resN = Math.max(1, Math.floor(capacity * 0.1));
  await Slot.insertMany(Array.from({ length: capacity }, (_, i) => ({
    _id: `${id}:P${String(i + 1).padStart(2, "0")}`, lotId: id, number: `P${String(i + 1).padStart(2, "0")}`, order: i,
    kind: i >= capacity - resN ? "reservable" : "general", state: "available",
  })));
  await audit(admin, "zone.create", `Temporary zone ${lot.name} created (not yet approved)`, id);
  return lot.toObject();
}

/* ---------------- alternatives with load spreading ---------------- */

const recentRecs = new Map(); // id → [timestamps]
function recCount(id) {
  const cut = Date.now() - 10 * 60000;
  const list = (recentRecs.get(id) ?? []).filter((t) => t > cut);
  recentRecs.set(id, list);
  return list.length;
}

/**
 * Suggests up to 3 open places with space, near the destination. Scores free
 * capacity and distance, and slightly down-ranks places recently suggested to
 * many drivers so everyone isn't sent to the same zone. No road-traffic data
 * is used or claimed.
 */
export async function alternatives({ fromLotId, lat, lng, q, vehicle } = {}) {
  const lots = await publicLotsWithStats();
  let dest = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  if (!dest && q) dest = resolvePlace(q, lots);
  if (!dest && fromLotId) dest = lots.find((l) => l._id === fromLotId) ?? (await Lot.findById(fromLotId).lean());
  const vehicleKind = vehicle === "two-wheeler" ? "two-wheeler" : "car";

  const scored = lots
    .filter((l) => l._id !== fromLotId && l.stats.open && l.stats.available > 0)
    .filter((l) => l.kind !== "temporary" || (l.zone?.vehicles ?? ["car"]).includes(vehicleKind))
    .map((l) => {
      const km = dest ? distanceKm(dest, l) : 0;
      const freeShare = l.stats.available / l.capacity;
      const penalty = Math.min(0.4, recCount(l._id) * 0.06);
      const score = 0.45 * Math.min(1, l.stats.available / 25) + 0.15 * freeShare + 0.4 / (1 + km) - penalty;
      return { ...publicZone(l), distanceKm: dest ? round2(km) : null, driveMinutes: dest ? Math.max(1, Math.round((km * 1.3) / 0.38)) : null, score: Math.round(score * 1000) / 1000, loadPenalty: Math.round(penalty * 100) / 100 };
    })
    .filter((l) => l.distanceKm === null || l.distanceKm <= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored[0]) recentRecs.set(scored[0]._id, [...(recentRecs.get(scored[0]._id) ?? []), Date.now()]);
  return { from: fromLotId ?? null, suggestions: scored, note: "Ranked by free spaces and distance. Live road traffic is not used." };
}

/* ---------------- demo helper ---------------- */

/** DEMO: fills a lot to the given occupancy with simulated walk-ins, then runs the overflow check. */
export async function demoFill(lotId, targetPct = 95) {
  return withLocks([`lot:${lotId}`], async () => {
    const lot = await Lot.findById(lotId).lean();
    if (!lot) fail("not-found", "Lot not found.");
    if (!isLotOpen(lot)) fail("lot-closed", `${lot.name} is closed right now, so it can't fill up.`);
    const stats = await lotStats(lotId);
    const need = Math.max(0, Math.ceil((targetPct / 100) * lot.capacity) - (stats.occupied + stats.reserved));
    const free = await Slot.find({ lotId, state: "available", kind: "general" }).sort({ order: 1 }).limit(need).lean();
    let n = 0;
    for (const s of free) {
      const sessionId = new mongoose.Types.ObjectId();
      const claimed = await Slot.findOneAndUpdate({ _id: s._id, state: "available" }, { $set: { state: "occupied", sessionId, updatedAt: new Date() } }, { new: true });
      if (!claimed) continue;
      const p = await Payment.create({ reference: makeCode("DEMO-CASH-", 8), amountInr: lot.feeInr, method: "cash", purpose: "parking", lotId, slotNumber: s.number, simulated: true });
      await Session.create({ _id: sessionId, lotId, slotId: s._id, slotNumber: s.number, source: "simulated", feeInr: lot.feeInr, paymentId: p._id });
      emitSlotChange(claimed);
      n++;
    }
    return { filled: n };
  }).then(async (r) => {
    await Lot.updateOne({ _id: lotId }, { $set: { "overflow.armed": true } });
    const ev = await checkOverflow(lotId);
    return { ...r, overflow: ev };
  });
}
