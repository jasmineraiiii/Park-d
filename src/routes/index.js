// All API routes. Full request/response examples are in API.md.

import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { fail, handle } from "../errors.js";
import { optionalAuth, requireAuth, signToken } from "../middleware/auth.js";
import { Listing, Lot, Payment, Reservation, Session, Slot, User } from "../models/index.js";
import * as admin from "../services/admin.js";
import { adminInsights, aiEnabled, askAssistant } from "../services/assistant.js";
import * as parking from "../services/parking.js";
import { lotsNear, resolvePlace } from "../services/search.js";
import { allLotsWithStats, lotStats, publicLotsWithStats } from "../services/stats.js";
import * as festival from "../services/festival.js";
import * as nb from "../services/neighbourhood.js";
import * as notifications from "../services/notify.js";

export const api = Router();
const driver = requireAuth("driver");
const attendant = requireAuth("attendant");
const adminOnly = requireAuth("admin");
const publicUser = (u) => ({ id: u._id, name: u.name, phone: u.phone, email: u.email, username: u.username, role: u.role, vehicleNo: u.vehicleNo, assignedLotIds: u.assignedLotIds, isHost: Boolean(u.isHost), notificationPrefs: u.notificationPrefs });
const asDriver = (req) => (req.user?.role === "driver" ? req.user : null);
const num = (v) => (v === undefined || v === "" ? undefined : Number(v));

/* ---------- health ---------- */
api.get("/health", (_req, res) => res.json({ ok: true, ai: aiEnabled(), time: new Date().toISOString() }));

/* ---------- auth ---------- */
const loginLimiter = rateLimit({ windowMs: 15 * 60000, limit: 30, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, message: { code: "rate-limited", message: "Too many sign-in attempts. Wait a few minutes." } });

// Driver: phone is optional for the demo (no phone = a fresh anonymous driver).
api.post("/auth/driver", loginLimiter, handle(async (req, res) => {
  const { phone, name, vehicleNo } = req.body ?? {};
  const cleanPhone = phone ? String(phone).replace(/\D/g, "").slice(-10) : null;
  if (phone && cleanPhone.length !== 10) fail("bad-request", "Enter a 10-digit mobile number.");
  let user = cleanPhone ? await User.findOne({ phone: cleanPhone, role: "driver" }) : null;
  if (!user) user = await User.create({ role: "driver", phone: cleanPhone ?? undefined, name: name?.trim() || "Citizen", vehicleNo: vehicleNo?.trim().toUpperCase() || undefined });
  else if (name || vehicleNo) { if (name) user.name = name.trim(); if (vehicleNo) user.vehicleNo = vehicleNo.trim().toUpperCase(); await user.save(); }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

// Driver / host accounts with email + password (used by the web app's sign-up and log-in form).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
api.post("/auth/register", loginLimiter, handle(async (req, res) => {
  const { name, email, password, vehicleNo, phone } = req.body ?? {};
  const mail = String(email ?? "").trim().toLowerCase();
  if (!String(name ?? "").trim()) fail("bad-request", "Enter your name.");
  if (!EMAIL_RE.test(mail)) fail("bad-request", "Enter a valid email address.");
  if (String(password ?? "").length < 8) fail("bad-request", "Use a password of at least 8 characters.");
  if (await User.exists({ email: mail })) fail("invalid-state", "An account with this email already exists. Log in instead.");
  const cleanPhone = phone ? String(phone).replace(/\D/g, "").slice(-10) : undefined;
  const user = await User.create({ role: "driver", name: String(name).trim().slice(0, 60), email: mail, passwordHash: await bcrypt.hash(String(password), 10), vehicleNo: vehicleNo?.trim().toUpperCase() || undefined, phone: cleanPhone || undefined });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));
api.post("/auth/login", loginLimiter, handle(async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = await User.findOne({ email: String(email ?? "").trim().toLowerCase(), role: "driver" });
  if (!user?.passwordHash || !(await bcrypt.compare(String(password ?? ""), user.passwordHash))) fail("unauthenticated", "That email and password don't match.");
  res.json({ token: signToken(user), user: publicUser(user) });
}));

// Staff sign-in is split in two. Each door only accepts its own role, so a
// worker can't get into the MC dashboard even with a correct PIN.
// Production: replace PINs with phone OTP.
async function staffLogin(req, res, role, label) {
  const { username, pin } = req.body ?? {};
  if (!username || !pin) fail("bad-request", "Enter your staff ID and PIN.");
  const user = await User.findOne({ username: String(username).trim(), role });
  if (!user || !(await bcrypt.compare(String(pin), user.pinHash ?? ""))) fail("unauthenticated", `That ${label} ID and PIN don't match.`);
  res.json({ token: signToken(user), user: publicUser(user) });
}
api.post("/auth/attendant", loginLimiter, handle((req, res) => staffLogin(req, res, "attendant", "worker")));
api.post("/auth/admin", loginLimiter, handle((req, res) => staffLogin(req, res, "admin", "MC")));

api.get("/auth/me", requireAuth(), handle(async (req, res) => res.json({ user: publicUser(req.user) })));

/* ---------- public: lots & search ---------- */

// GET /lots?lat=30.74&lng=76.78  → every lot with live stats (+ distanceKm when lat/lng given)
api.get("/lots", optionalAuth, handle(async (req, res) => {
  const lots = (await publicLotsWithStats()).map(festival.publicZone); // regular lots + active temporary zones
  const lat = num(req.query.lat), lng = num(req.query.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    festival.rememberLocation(asDriver(req), lat, lng).catch(() => {});
    const near = lotsNear({ lat, lng }, lots, 1000);
    return res.json({ lots: near });
  }
  res.json({ lots });
}));

api.get("/lots/:id", handle(async (req, res) => {
  const lot = await Lot.findById(req.params.id).lean();
  if (!lot) fail("not-found", "That parking lot does not exist.");
  const [stats, slots] = await Promise.all([
    lotStats(lot._id),
    Slot.find({ lotId: lot._id }, { sessionId: 0, reservationId: 0 }).sort({ order: 1 }).lean(),
  ]);
  res.json({ lot: festival.publicZone({ ...lot, id: lot._id, stats }), slots });
}));

// GET /search?q=sec 22  → the place it understood + nearby lots
api.get("/search", optionalAuth, handle(async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) fail("bad-request", "Type a sector, landmark or lot name.");
  const lots = (await publicLotsWithStats()).map(festival.publicZone);
  const place = resolvePlace(q, lots);
  if (place) festival.rememberSearch(asDriver(req), place).catch(() => {});
  if (!place) return res.json({ query: q, place: null, lots: [], totalAvailable: 0 });
  const near = lotsNear(place, lots);
  res.json({ query: q, place, lots: near, totalAvailable: near.reduce((a, l) => a + l.stats.available, 0) });
}));

// POST /assistant { message, lat?, lng? } → { reply, lotIds, source: "groq" | "rules" }
const aiLimiter = rateLimit({ windowMs: 60000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { code: "rate-limited", message: "Too many questions at once. Try again in a minute." } });
api.post("/assistant", aiLimiter, optionalAuth, handle(async (req, res) => {
  const { message, lat, lng } = req.body ?? {};
  const origin = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  res.json(await askAssistant(message, origin));
}));

/* ---------- driver ---------- */

// Everything the driver app needs: active parking, active booking, history, receipts.
api.get("/me/activity", driver, handle(async (req, res) => {
  const id = req.user._id;
  const [sessions, reservations, payments] = await Promise.all([
    Session.find({ driverId: id }).sort({ startedAt: -1 }).limit(30).lean(),
    Reservation.find({ driverId: id }).sort({ createdAt: -1 }).limit(30).lean(),
    Payment.find({ driverId: id }).sort({ createdAt: -1 }).limit(30).lean(),
  ]);
  res.json({
    activeSession: sessions.find((s) => s.status === "active") ?? null,
    activeReservation: reservations.find((r) => ["pending-payment", "held"].includes(r.status)) ?? null,
    sessions, reservations, payments,
  });
}));

api.post("/reservations", driver, handle(async (req, res) => {
  const { lotId, slotId } = req.body ?? {};
  if (!lotId) fail("bad-request", "lotId is required.");
  res.status(201).json({ reservation: await parking.createReservation(req.user, { lotId, slotId }) });
}));
api.get("/reservations/:id", requireAuth(), handle(async (req, res) => {
  const r = await Reservation.findById(req.params.id).lean();
  if (!r || (req.user.role === "driver" && String(r.driverId) !== String(req.user._id))) fail("not-found", "Reservation not found.");
  res.json({ reservation: r });
}));
api.post("/reservations/:id/pay", driver, handle(async (req, res) => res.json(await parking.payReservation(req.user, req.params.id, req.body?.upiApp))));
api.post("/reservations/:id/cancel", requireAuth(), handle(async (req, res) => res.json({ reservation: await parking.cancelReservation(req.user, req.params.id) })));
api.post("/reservations/:id/check-in", requireAuth(), handle(async (req, res) => res.json({ session: await parking.checkInReservation(req.user, req.params.id) })));

// Driver self check-in on a walk-in slot (demo; normally the attendant does it).
api.post("/lots/:id/check-in", driver, handle(async (req, res) => res.status(201).json({ session: await parking.driverCheckIn(req.user, { lotId: req.params.id, slotId: req.body?.slotId }) })));
api.post("/sessions/:id/pay", driver, handle(async (req, res) => res.json({ payment: await parking.payParking(req.user, req.params.id, req.body?.upiApp) })));
api.post("/sessions/:id/end", requireAuth(), handle(async (req, res) => res.json({ session: await parking.endSession(req.user, req.params.id) })));

api.get("/payments/:id", requireAuth(), handle(async (req, res) => {
  const p = await Payment.findById(req.params.id).lean();
  if (!p) fail("not-found", "Receipt not found.");
  if (req.user.role === "driver" && String(p.driverId) !== String(req.user._id)) fail("not-found", "Receipt not found.");
  if (req.user.role === "attendant") parking.requireLotAccess(req.user, p.lotId);
  const lot = await Lot.findById(p.lotId, { name: 1, address: 1 }).lean();
  res.json({ payment: p, lot });
}));

/* ---------- attendant ---------- */

api.post("/attendant/lots/:lotId/entry", attendant, handle(async (req, res) => res.status(201).json(await parking.attendantEntry(req.user, req.params.lotId, req.body ?? {}))));
api.post("/attendant/slots/:slotId/payment", attendant, handle(async (req, res) => res.json({ payment: await parking.attendantRecordPayment(req.user, req.params.slotId, req.body ?? {}) })));
api.post("/attendant/slots/:slotId/exit", attendant, handle(async (req, res) => res.json(await parking.attendantExit(req.user, req.params.slotId))));
api.post("/attendant/slots/:slotId/correct", attendant, handle(async (req, res) => res.json(await parking.attendantCorrect(req.user, req.params.slotId, req.body?.reason))));
api.get("/attendant/slots/:slotId", attendant, handle(async (req, res) => {
  const slot = await Slot.findById(req.params.slotId).lean();
  if (!slot) fail("not-found", "Slot not found.");
  parking.requireLotAccess(req.user, slot.lotId);
  const [session, reservation] = await Promise.all([
    slot.sessionId ? Session.findById(slot.sessionId).lean() : null,
    slot.reservationId ? Reservation.findById(slot.reservationId).lean() : null,
  ]);
  res.json({ slot, session, reservation });
}));
api.get("/attendant/lots/:lotId/transactions", attendant, handle(async (req, res) => {
  parking.requireLotAccess(req.user, req.params.lotId);
  res.json(await admin.lotTransactions(req.params.lotId));
}));

/* ---------- MC admin ---------- */

api.get("/admin/overview", adminOnly, handle(async (_req, res) => res.json(await admin.overview())));
api.get("/admin/hourly", adminOnly, handle(async (_req, res) => res.json({ window: "last-24h", hours: await admin.hourly() })));
api.get("/admin/attendants", adminOnly, handle(async (_req, res) => res.json({ attendants: await admin.attendants() })));
api.get("/admin/audit", adminOnly, handle(async (req, res) => res.json({ entries: await admin.auditLog(req.query) })));
api.get("/admin/insights", adminOnly, handle(async (_req, res) => res.json(await adminInsights())));
api.patch("/admin/lots/:id", adminOnly, handle(async (req, res) => {
  const b = req.body ?? {};
  let lot = null;
  if (b.feeInr !== undefined) lot = await parking.setLotFee(req.user, req.params.id, b.feeInr);
  if (b.thresholdPct !== undefined || b.bufferPct !== undefined || b.zoneIds !== undefined) lot = await festival.updateLotOverflow(req.user, req.params.id, b);
  if (!lot) fail("bad-request", "Send feeInr, thresholdPct, bufferPct or zoneIds.");
  res.json({ lot });
}));

/* =====================================================================
   PARK'D 2.0
   ===================================================================== */

/* ---------- Festival Mode (public) ---------- */

// GET /festival?lat=&lng=  → { active, label, zones[], extraFree, nearest }
api.get("/festival", handle(async (req, res) => {
  const lat = num(req.query.lat), lng = num(req.query.lng);
  res.json(await festival.festivalStatus(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null));
}));
// Active temporary zones (drivers never see scheduled/closed ones here)
api.get("/zones", handle(async (_req, res) => {
  const zones = (await allLotsWithStats({ kind: "temporary" })).filter((z) => z.zone?.status === "active").map(festival.publicZone);
  res.json({ zones });
}));
api.get("/zones/:id", handle(async (req, res) => {
  const z = await Lot.findOne({ _id: req.params.id, kind: "temporary" }).lean();
  if (!z) fail("not-found", "That temporary zone does not exist.");
  res.json({ zone: festival.publicZone({ ...z, id: z._id, stats: await lotStats(z._id) }) });
}));
// GET /lots/:id/alternatives?lat=&lng=&q=&vehicle=car|two-wheeler
api.get("/lots/:id/alternatives", handle(async (req, res) => {
  res.json(await festival.alternatives({ fromLotId: req.params.id, lat: num(req.query.lat), lng: num(req.query.lng), q: req.query.q, vehicle: req.query.vehicle }));
}));
api.get("/alternatives", handle(async (req, res) => {
  res.json(await festival.alternatives({ lat: num(req.query.lat), lng: num(req.query.lng), q: req.query.q, vehicle: req.query.vehicle }));
}));

/* ---------- Festival Mode (MC admin) ---------- */

api.get("/admin/festival", adminOnly, handle(async (_req, res) => {
  const zones = await allLotsWithStats({ kind: "temporary" });
  const withChecks = await Promise.all(zones.map(async (z) => ({ ...z, problems: await festival.zoneProblems(z), workers: (await User.find({ role: "attendant", assignedLotIds: z._id }, { name: 1 }).lean()).map((u) => u.name) })));
  const lots = (await allLotsWithStats({ kind: { $ne: "temporary" } })).map((l) => ({ _id: l._id, name: l.name, sector: l.sector, occupancyPct: l.stats.occupancyPct, overflow: l.overflow }));
  res.json({ setting: await festival.getSetting(), zones: withChecks, lots, overflow: await festival.listOverflow() });
}));
api.post("/admin/festival", adminOnly, handle(async (req, res) => res.json({ setting: await festival.setFestivalToggle(req.user, req.body ?? {}) })));
api.post("/admin/zones", adminOnly, handle(async (req, res) => res.status(201).json({ zone: await festival.createZone(req.user, req.body) })));
api.patch("/admin/zones/:id", adminOnly, handle(async (req, res) => res.json({ zone: await festival.updateZone(req.user, req.params.id, req.body ?? {}) })));
api.post("/admin/zones/:id/activate", adminOnly, handle(async (req, res) => res.json({ zone: await festival.activateZone(req.user, req.params.id) })));
api.post("/admin/zones/:id/deactivate", adminOnly, handle(async (req, res) => res.json({ zone: await festival.deactivateZone(req.user, req.params.id) })));
api.get("/admin/overflow", adminOnly, handle(async (_req, res) => res.json({ events: await festival.listOverflow() })));
api.post("/admin/overflow/:id/activate", adminOnly, handle(async (req, res) => res.json(await festival.actOnOverflow(req.user, req.params.id, "activate", req.body?.zoneId))));
api.post("/admin/overflow/:id/dismiss", adminOnly, handle(async (req, res) => res.json(await festival.actOnOverflow(req.user, req.params.id, "dismiss"))));
// DEMO ONLY: fill a lot with simulated cars to trigger overflow on stage. Disable with DEMO_TOOLS=false.
api.post("/admin/demo/fill", adminOnly, handle(async (req, res) => {
  if (process.env.DEMO_TOOLS === "false") fail("permission-denied", "Demo tools are turned off on this server.");
  res.json(await festival.demoFill(req.body?.lotId || "s8-inner", Number(req.body?.targetPct) || 95));
}));

/* ---------- worker: assigned lots incl. temporary zones ---------- */
api.get("/attendant/lots", attendant, handle(async (req, res) => {
  const lots = await allLotsWithStats({ _id: { $in: req.user.assignedLotIds ?? [] } });
  res.json({ lots });
}));

/* ---------- notifications ---------- */
api.get("/notifications", requireAuth(), handle(async (req, res) => res.json(await notifications.listFor(req.user._id, Number(req.query.limit) || 50))));
api.post("/notifications/read-all", requireAuth(), handle(async (req, res) => { await notifications.markAllRead(req.user._id); res.json({ ok: true }); }));
api.post("/notifications/:id/read", requireAuth(), handle(async (req, res) => { await notifications.markRead(req.user._id, req.params.id); res.json({ ok: true }); }));
// Update your own name / vehicle number
api.patch("/me", requireAuth(), handle(async (req, res) => {
  const set = {};
  if (typeof req.body?.name === "string" && req.body.name.trim()) set.name = req.body.name.trim().slice(0, 60);
  if (typeof req.body?.vehicleNo === "string") set.vehicleNo = req.body.vehicleNo.trim().toUpperCase().slice(0, 16) || undefined;
  if (!Object.keys(set).length) fail("bad-request", "Send name or vehicleNo.");
  await User.updateOne({ _id: req.user._id }, { $set: set });
  res.json({ user: publicUser(await User.findById(req.user._id).lean()) });
}));
api.patch("/me/notification-prefs", requireAuth(), handle(async (req, res) => {
  const set = {};
  for (const k of ["festivalAlerts", "bookingAlerts", "push"]) if (typeof req.body?.[k] === "boolean") set[`notificationPrefs.${k}`] = req.body[k];
  if (!Object.keys(set).length) fail("bad-request", "Send festivalAlerts, bookingAlerts or push as true/false.");
  await User.updateOne({ _id: req.user._id }, { $set: set });
  res.json({ user: publicUser(await User.findById(req.user._id).lean()) });
}));

/* ---------- Neighbourhood Parking ---------- */
// GET /listings?q=sec 8&date=2026-10-14&start=16:00&hours=2&maxPrice=50&maxWalkMin=10&vehicle=sedan
api.get("/listings", handle(async (req, res) => res.json(await nb.search(req.query))));
api.get("/listings/:id", handle(async (req, res) => res.json(await nb.getListing(req.params.id, req.query))));
api.get("/listings/:id/availability", handle(async (req, res) => res.json(await nb.availability(req.params.id, String(req.query.date ?? "")))));
api.get("/listings/:id/quote", handle(async (req, res) => {
  const l = await Listing.findById(req.params.id).lean();
  if (!l || l.status !== "active") fail("not-found", "This space is not available.");
  const h = Number(req.query.hours);
  if (!Number.isFinite(h) || h < 1 || h > 12) fail("bad-request", "Duration must be 1 to 12 hours.");
  res.json(nb.quote(l, h));
}));
api.post("/neighbourhood-bookings", driver, handle(async (req, res) => res.status(201).json({ booking: await nb.createBooking(req.user, req.body ?? {}) })));
api.get("/neighbourhood-bookings", driver, handle(async (req, res) => res.json({ bookings: await nb.myBookings(req.user) })));
api.get("/neighbourhood-bookings/:id", requireAuth(), handle(async (req, res) => res.json(await nb.getBooking(req.user, req.params.id))));
api.post("/neighbourhood-bookings/:id/pay", driver, handle(async (req, res) => res.json(await nb.payBooking(req.user, req.params.id, req.body?.upiApp))));
api.post("/neighbourhood-bookings/:id/cancel", driver, handle(async (req, res) => res.json({ booking: await nb.cancelBooking(req.user, req.params.id) })));
api.post("/reviews", driver, handle(async (req, res) => res.status(201).json({ review: await nb.addReview(req.user, req.body ?? {}) })));
api.post("/reports", driver, handle(async (req, res) => res.status(201).json({ report: await nb.addReport(req.user, req.body ?? {}) })));

/* ---------- host mode (any signed-in driver can host) ---------- */
api.get("/host/listings", driver, handle(async (req, res) => res.json({ listings: await nb.hostListings(req.user) })));
api.post("/host/listings", driver, handle(async (req, res) => res.status(201).json({ listing: await nb.createListing(req.user, req.body ?? {}) })));
api.patch("/host/listings/:id", driver, handle(async (req, res) => res.json({ listing: await nb.updateListing(req.user, req.params.id, req.body ?? {}) })));
api.delete("/host/listings/:id", driver, handle(async (req, res) => res.json(await nb.deleteListing(req.user, req.params.id))));
api.get("/host/bookings", driver, handle(async (req, res) => res.json(await nb.hostBookings(req.user))));
api.post("/host/bookings/:id/cancel", driver, handle(async (req, res) => res.json({ booking: await nb.cancelBooking(req.user, req.params.id) })));

/* ---------- Neighbourhood Parking (MC moderation) ---------- */
api.get("/admin/neighbourhood", adminOnly, handle(async (_req, res) => res.json(await nb.adminNeighbourhood())));
api.get("/admin/listings", adminOnly, handle(async (req, res) => {
  res.json({ listings: await Listing.find(req.query.status ? { status: req.query.status } : {}).sort({ createdAt: -1 }).lean() });
}));
for (const action of ["approve", "reject", "suspend", "reinstate"]) {
  api.post(`/admin/listings/:id/${action}`, adminOnly, handle(async (req, res) => res.json(await nb.moderateListing(req.user, req.params.id, action, req.body?.note))));
}
api.get("/admin/reports", adminOnly, handle(async (_req, res) => res.json({ reports: (await nb.adminNeighbourhood()).reports })));
api.post("/admin/reports/:id/resolve", adminOnly, handle(async (req, res) => res.json({ report: await nb.resolveReport(req.user, req.params.id) })));
