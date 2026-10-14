// Neighbourhood Parking: residents list unused driveways, drivers book them.
//
// Rules enforced here (never trust the app for these):
// - Prices are calculated on the server from the listing's stored hourly rate.
// - Bookings must sit inside the host's availability windows, not on blocked
//   dates, in the future, at least 1 hour, in 30-minute steps.
// - No overbooking: concurrent bookings for a listing never exceed its number
//   of spaces (checked under a per-listing lock).
// - Privacy: discovery only shows an approximate location. The exact address
//   and access instructions go only to the host, and to the booking's driver
//   from 2 hours before the start until the booking ends.
// - Only "active" (MC-approved) listings appear in discovery.

import { RULES } from "../config.js";
import { fail } from "../errors.js";
import { Listing, NBooking, Payment, Report, Review, User } from "../models/index.js";
import { emitAll } from "../realtime.js";
import { withLocks } from "./locks.js";
import { notify } from "./notify.js";
import { distanceKm, resolvePlace } from "./search.js";
import { publicLotsWithStats } from "./stats.js";
import { audit, fromMinutes, istDate, istParts, makeCode, toMinutes } from "./util.js";

const HOLD_MIN = 10;              // unpaid booking holds expire after 10 min
const REVEAL_BEFORE_MS = 2 * 3600000;
const FREE_CANCEL_BEFORE_MS = 3600000;
const PLATFORM_FEE_INR = 0;       // shown so the maths is clear; 0 in the demo
const ACTIVE_BOOKING = ["pending-payment", "confirmed"];
const TYPES = ["driveway", "covered-garage", "open-plot", "stilt"];
const FITS = ["hatchback", "sedan", "suv", "two-wheeler"];
const UPI_APPS = ["Google Pay", "PhonePe", "Paytm", "BHIM"];

const walkMinutes = (km) => Math.max(1, Math.round((km * 1.25) / 0.075)); // ~4.5 km/h on foot

/* ---------------- shaping ---------------- */

async function ratingFor(listingIds) {
  const reviews = await Review.find({ listingId: { $in: listingIds } }, { listingId: 1, stars: 1 }).lean();
  const map = {};
  for (const r of reviews) (map[r.listingId] ??= []).push(r.stars);
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, { count: v.length, avg: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 }]));
}

/** Public view: never contains the exact address, exact coordinates or access instructions. */
function publicListing(l, { rating, host, dest } = {}) {
  const km = dest ? distanceKm(dest, { lat: l.approxLat, lng: l.approxLng }) : null;
  return {
    _id: l._id, id: l._id, title: l.title, type: l.type, spaces: l.spaces, vehicleFit: l.vehicleFit, covered: l.covered,
    dimensions: l.dimensions, surface: l.surface, entranceWidth: l.entranceWidth, clearance: l.clearance,
    sector: l.sector, landmark: l.landmark, approxLat: l.approxLat, approxLng: l.approxLng, approxRadiusM: 150,
    ratePerHourInr: l.ratePerHourInr, availability: l.availability, blockedDates: l.blockedDates, rules: l.rules,
    status: l.status, verified: Boolean(l.verified), demo: Boolean(l.demo),
    host: host ? { firstName: String(host.name ?? "Host").split(" ")[0] } : undefined,
    // ratings only once there are at least 3 real reviews
    rating: rating && rating.count >= 3 ? rating : null,
    reviewCount: rating?.count ?? 0,
    walkMinutes: km !== null ? walkMinutes(km) : null,
    distanceKm: km !== null ? Math.round(km * 100) / 100 : null,
    cancellationPolicy: "Free cancellation up to 1 hour before the start. After that the booking is non-refundable. If the host cancels, you get a full refund.",
  };
}

/** Rounds to ~110 m and nudges deterministically, so the public pin never sits on the house. */
export function approximate(lat, lng, seed = "") {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const jitter = (n) => ((Math.abs(h >> n) % 9) - 4) * 0.00015;
  return { approxLat: Math.round((lat + jitter(1)) * 1000) / 1000, approxLng: Math.round((lng + jitter(5)) * 1000) / 1000 };
}

/* ---------------- availability ---------------- */

function windowsOn(listing, dateStr) {
  if ((listing.blockedDates ?? []).includes(dateStr)) return [];
  const day = istParts(istDate(dateStr, "12:00")).day;
  return (listing.availability ?? [])
    .filter((w) => (w.days ?? []).includes(day))
    .map((w) => ({ start: toMinutes(w.start), end: toMinutes(w.end) }))
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start);
}

async function overlapping(listingId, start, end, excludeId) {
  return NBooking.countDocuments({
    listingId, _id: { $ne: excludeId ?? "" },
    status: { $in: ACTIVE_BOOKING }, start: { $lt: end }, end: { $gt: start },
    $or: [{ status: "confirmed" }, { holdExpiresAt: { $gt: new Date() } }],
  });
}

/** Free spaces per 30-minute slot for one date. */
export async function availability(listingId, dateStr) {
  const l = await Listing.findById(listingId).lean();
  if (!l || l.status !== "active") fail("not-found", "This space is not available.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr ?? "")) fail("bad-request", "Pick a date (YYYY-MM-DD).");
  const wins = windowsOn(l, dateStr);
  const dayStart = istDate(dateStr, "00:00"), dayEnd = new Date(dayStart.getTime() + 86400000);
  const bookings = await NBooking.find({
    listingId, status: { $in: ACTIVE_BOOKING }, start: { $lt: dayEnd }, end: { $gt: dayStart },
    $or: [{ status: "confirmed" }, { holdExpiresAt: { $gt: new Date() } }],
  }, { start: 1, end: 1 }).lean();
  const now = Date.now();
  const slots = [];
  for (const w of wins) {
    for (let m = w.start; m + 30 <= w.end; m += 30) {
      const s = istDate(dateStr, fromMinutes(m)), e = new Date(s.getTime() + 30 * 60000);
      const used = bookings.filter((b) => b.start < e && b.end > s).length;
      slots.push({ start: fromMinutes(m), free: Math.max(0, l.spaces - used), past: s.getTime() <= now });
    }
  }
  return { date: dateStr, windows: wins.map((w) => ({ start: fromMinutes(w.start), end: fromMinutes(w.end) })), spaces: l.spaces, slots };
}

/** Checks a requested time against the listing's rules. Returns { start, end, hours } or throws. */
function validateTime(l, { date, start, hours }) {
  const h = Number(hours);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !/^\d{2}:\d{2}$/.test(start ?? "")) fail("bad-request", "Pick a date and start time.");
  if (!Number.isFinite(h) || h < 1 || h > 12 || Math.round(h * 2) !== h * 2) fail("bad-request", "Duration must be between 1 and 12 hours, in 30-minute steps.");
  const sMin = toMinutes(start);
  if (sMin % 30 !== 0) fail("bad-request", "Start times are on the hour or half hour.");
  const eMin = sMin + h * 60;
  const win = windowsOn(l, date).find((w) => sMin >= w.start && eMin <= w.end);
  if (!win) fail("invalid-state", "That time is outside the host's available hours.");
  const s = istDate(date, start);
  if (s.getTime() < Date.now() + 5 * 60000) fail("invalid-state", "Pick a start time at least a few minutes from now.");
  return { start: s, end: new Date(s.getTime() + h * 3600000), hours: h };
}

/* ---------------- discovery ---------------- */

/**
 * Filters: q (sector/landmark/destination), lat/lng, date, start, hours,
 * maxPrice, maxWalkMin, vehicle. Only active listings.
 */
export async function search(params = {}) {
  const { q, date, start, hours, vehicle } = params;
  const maxPrice = Number(params.maxPrice) || null, maxWalk = Number(params.maxWalkMin) || null;
  const lat = Number(params.lat), lng = Number(params.lng);
  let dest = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, label: "your location" } : null;
  let place = null;
  if (q) {
    place = resolvePlace(q, await publicLotsWithStats());
    if (place) dest = place;
    else return { place: null, listings: [], note: `No sector or landmark matches “${q}”.` };
  }

  let listings = await Listing.find({ status: "active" }).lean();
  if (maxPrice) listings = listings.filter((l) => l.ratePerHourInr <= maxPrice);
  if (vehicle && FITS.includes(vehicle)) listings = listings.filter((l) => l.vehicleFit.includes(vehicle));

  const hosts = Object.fromEntries((await User.find({ _id: { $in: listings.map((l) => l.hostId) } }, { name: 1, hostStatus: 1 }).lean()).map((u) => [String(u._id), u]));
  listings = listings.filter((l) => hosts[String(l.hostId)]?.hostStatus !== "suspended");

  const ratings = await ratingFor(listings.map((l) => l._id));
  let out = listings.map((l) => publicListing(l, { rating: ratings[l._id], host: hosts[String(l.hostId)], dest }));
  if (dest) {
    out = out.filter((l) => l.distanceKm <= 1.5 || (place?.sector && l.sector === place.sector));
    if (maxWalk) out = out.filter((l) => l.walkMinutes <= maxWalk);
    out.sort((a, b) => a.walkMinutes - b.walkMinutes || a.ratePerHourInr - b.ratePerHourInr);
  }

  // time filter: only spaces that can take this exact booking
  const today = istParts().date;
  const checkDate = date || today;
  const result = [];
  for (const l of out) {
    const full = listings.find((x) => x._id === l._id);
    const wins = windowsOn(full, checkDate);
    l.availableOn = { date: checkDate, windows: wins.map((w) => ({ start: fromMinutes(w.start), end: fromMinutes(w.end) })) };
    if (date && start && hours) {
      try {
        const t = validateTime(full, { date, start, hours });
        if ((await overlapping(full._id, t.start, t.end)) >= full.spaces) continue;
      } catch { continue; }
    } else if (date && !wins.length) continue;
    result.push(l);
  }
  return { place: place ? { label: place.label, sector: place.sector } : dest ? { label: dest.label } : null, listings: result };
}

export async function getListing(id, params = {}) {
  const l = await Listing.findById(id).lean();
  if (!l || l.status !== "active") fail("not-found", "This space is not available.");
  const host = await User.findById(l.hostId, { name: 1, hostStatus: 1 }).lean();
  if (host?.hostStatus === "suspended") fail("not-found", "This space is not available.");
  let dest = null;
  if (params.q) dest = resolvePlace(params.q, await publicLotsWithStats());
  else if (Number.isFinite(Number(params.lat))) dest = { lat: Number(params.lat), lng: Number(params.lng) };
  const ratings = await ratingFor([id]);
  const reviews = await Review.find({ listingId: id }).sort({ createdAt: -1 }).limit(10).lean();
  return { listing: publicListing(l, { rating: ratings[id], host, dest }), reviews: ratings[id]?.count >= 3 ? reviews.map((r) => ({ stars: r.stars, comment: r.comment, createdAt: r.createdAt })) : [] };
}

/* ---------------- booking ---------------- */

export function quote(l, hours) {
  const subtotal = Math.round(l.ratePerHourInr * hours);
  return { rateInr: l.ratePerHourInr, hours, subtotalInr: subtotal, feeInr: PLATFORM_FEE_INR, totalInr: subtotal + PLATFORM_FEE_INR };
}

export async function createBooking(driver, { listingId, date, start, hours, acceptPolicy, vehicleNo }) {
  if (!acceptPolicy) fail("bad-request", "Please accept the cancellation policy to book.");
  return withLocks([`listing:${listingId}`], async () => {
    const l = await Listing.findById(listingId).lean();
    if (!l || l.status !== "active") fail("not-found", "This space is not available.");
    if (String(l.hostId) === String(driver._id)) fail("invalid-state", "You can't book your own space.");
    const t = validateTime(l, { date, start, hours });
    if ((await overlapping(l._id, t.start, t.end)) >= l.spaces) fail("slot-taken", "That time was just booked. Pick another time.");
    const q = quote(l, t.hours);
    const b = await NBooking.create({
      _id: makeCode("NB-"), listingId: l._id, hostId: l.hostId, driverId: driver._id,
      start: t.start, end: t.end, ...q, vehicleNo: (vehicleNo || driver.vehicleNo || "").toUpperCase() || undefined,
      status: "pending-payment", holdExpiresAt: new Date(Date.now() + HOLD_MIN * 60000),
    });
    await audit(driver, "nbooking.create", `${b._id}: ${l.title}, ${date} ${start} for ${t.hours} h = ₹${q.totalInr} (awaiting demo payment)`);
    return b.toObject();
  });
}

export async function payBooking(driver, bookingId, upiApp) {
  if (!UPI_APPS.includes(upiApp)) fail("bad-request", `Choose a UPI app: ${UPI_APPS.join(", ")}.`);
  const b0 = await NBooking.findById(bookingId).lean();
  if (!b0 || String(b0.driverId) !== String(driver._id)) fail("not-found", "Booking not found.");
  return withLocks([`listing:${b0.listingId}`], async () => {
    const b = await NBooking.findById(bookingId).lean();
    if (b.status !== "pending-payment") fail("invalid-state", "This booking is already paid or closed.");
    if (b.holdExpiresAt <= new Date()) {
      await NBooking.updateOne({ _id: b._id }, { $set: { status: "expired" } });
      fail("expired", "The 10-minute hold ran out. Please book again.");
    }
    const p = await Payment.create({
      reference: makeCode("DEMO-UPI-", 10), amountInr: b.totalInr, method: "upi", upiApp, purpose: "neighbourhood",
      listingId: b.listingId, driverId: driver._id, simulated: true, slotNumber: b._id,
    });
    const done = await NBooking.findOneAndUpdate({ _id: b._id, status: "pending-payment" }, { $set: { status: "confirmed", paymentId: p._id } }, { new: true }).lean();
    const l = await Listing.findById(b.listingId, { title: 1 }).lean();
    const when = `${istParts(b.start).date} ${istParts(b.start).time}`;
    await notify(driver._id, { type: "booking.confirmed", pref: "bookingAlerts", key: `nb-confirm:${b._id}`, title: "Booking confirmed", body: `${l.title}, ${when} for ${b.hours} h. The address unlocks 2 hours before your start time.`, link: `/booking?id=${b._id}` });
    await notify(b.hostId, { type: "booking.new", pref: "bookingAlerts", key: `nb-host:${b._id}`, title: "New booking", body: `${l.title}: ${when} for ${b.hours} h (₹${b.totalInr}, demo payment).`, link: "/host" });
    await audit(driver, "nbooking.confirm", `${b._id} paid ₹${b.totalInr} via ${upiApp} (demo)`);
    return { booking: done, payment: p.toObject() };
  });
}

/** Booking as the requester may see it. Exact address only for the host, or the driver near the booking time. */
export async function getBooking(user, bookingId) {
  const b = await NBooking.findById(bookingId).lean();
  if (!b) fail("not-found", "Booking not found.");
  const isDriver = String(b.driverId) === String(user._id), isHost = String(b.hostId) === String(user._id);
  if (!isDriver && !isHost && user.role !== "admin") fail("not-found", "Booking not found.");
  const l = await Listing.findById(b.listingId).lean();
  const now = Date.now();
  const revealFrom = new Date(new Date(b.start).getTime() - REVEAL_BEFORE_MS);
  const canReveal = isHost || (isDriver && b.status === "confirmed" && now >= revealFrom.getTime() && now <= new Date(b.end).getTime());
  const review = await Review.findOne({ bookingId }).lean();
  return {
    booking: b,
    listing: publicListing(l),
    access: canReveal
      ? { exactAddress: l.exactAddress, accessInstructions: l.accessInstructions, lat: l.exactLat, lng: l.exactLng }
      : { locked: true, unlocksAt: revealFrom, message: b.status === "confirmed" ? "The exact address and access instructions unlock 2 hours before your start time." : "Confirm the booking to receive the address." },
    canCancel: b.status === "confirmed" || b.status === "pending-payment",
    refundIfCancelledNow: isDriver ? (new Date(b.start).getTime() - now >= FREE_CANCEL_BEFORE_MS ? b.totalInr : 0) : b.totalInr,
    canReview: isDriver && b.status === "completed" && !review,
    review,
    role: isHost ? "host" : isDriver ? "driver" : "admin",
  };
}

export async function cancelBooking(user, bookingId) {
  const b0 = await NBooking.findById(bookingId).lean();
  if (!b0) fail("not-found", "Booking not found.");
  const isDriver = String(b0.driverId) === String(user._id), isHost = String(b0.hostId) === String(user._id);
  if (!isDriver && !isHost) fail("not-found", "Booking not found.");
  return withLocks([`listing:${b0.listingId}`], async () => {
    const now = new Date();
    const b = await NBooking.findById(bookingId).lean();
    if (!["confirmed", "pending-payment"].includes(b.status)) fail("invalid-state", "This booking can't be cancelled.");
    if (now >= new Date(b.end)) fail("invalid-state", "This booking has already ended.");
    const paid = b.status === "confirmed";
    const refund = !paid ? 0 : isHost ? b.totalInr : new Date(b.start).getTime() - now.getTime() >= FREE_CANCEL_BEFORE_MS ? b.totalInr : 0;
    const status = isHost ? "cancelled-by-host" : "cancelled-by-driver";
    const done = await NBooking.findOneAndUpdate({ _id: b._id, status: b.status }, { $set: { status, refundInr: refund, cancelledAt: now } }, { new: true }).lean();
    if (!done) fail("invalid-state", "This booking changed. Refresh and try again.");
    const l = await Listing.findById(b.listingId, { title: 1 }).lean();
    const other = isHost ? b.driverId : b.hostId;
    await notify(other, { type: "booking.cancelled", pref: "bookingAlerts", key: `nb-cancel:${b._id}`, title: "Booking cancelled", body: `${l.title} (${b._id}) was cancelled by the ${isHost ? "host" : "citizen"}.${refund ? ` Refund ₹${refund} (demo).` : ""}`, link: isHost ? `/booking?id=${b._id}` : "/host" });
    await audit(user, "nbooking.cancel", `${b._id} cancelled by ${isHost ? "host" : "citizen"}, refund ₹${refund} (simulated)`);
    return done;
  });
}

export async function myBookings(driver) {
  const list = await NBooking.find({ driverId: driver._id }).sort({ start: -1 }).limit(50).lean();
  const titles = Object.fromEntries((await Listing.find({ _id: { $in: list.map((b) => b.listingId) } }, { title: 1 }).lean()).map((l) => [l._id, l.title]));
  return list.map((b) => ({ ...b, title: titles[b.listingId] }));
}

/* ---------------- reviews & reports ---------------- */

export async function addReview(driver, { bookingId, stars, comment }) {
  const b = await NBooking.findById(bookingId).lean();
  if (!b || String(b.driverId) !== String(driver._id)) fail("not-found", "Booking not found.");
  if (b.status !== "completed") fail("invalid-state", "You can review a space after your booking is completed.");
  const s = Number(stars);
  if (!Number.isInteger(s) || s < 1 || s > 5) fail("bad-request", "Give 1 to 5 stars.");
  if (await Review.exists({ bookingId })) fail("invalid-state", "You already reviewed this booking.");
  const r = await Review.create({ bookingId, listingId: b.listingId, driverId: driver._id, stars: s, comment: String(comment ?? "").slice(0, 500) });
  return r.toObject();
}

export async function addReport(user, { bookingId, kind, details }) {
  const b = await NBooking.findById(bookingId).lean();
  if (!b) fail("not-found", "Booking not found.");
  const role = String(b.driverId) === String(user._id) ? "driver" : String(b.hostId) === String(user._id) ? "host" : null;
  if (!role) fail("not-found", "Booking not found.");
  if (!["no-show", "space-blocked", "damage", "safety", "other"].includes(kind)) fail("bad-request", "Pick what went wrong.");
  const r = await Report.create({ bookingId, listingId: b.listingId, reporterId: user._id, reporterRole: role, kind, details: String(details ?? "").slice(0, 1000) });
  await audit(user, "report.create", `${role} reported "${kind}" on ${bookingId}`);
  const admins = await User.find({ role: "admin" }, { _id: 1 }).lean();
  for (const a of admins) await notify(a._id, { type: "report.new", key: `report:${r._id}`, title: "New Neighbourhood Parking report", body: `${role} reported “${kind}” on booking ${bookingId}.`, link: "/mc/dashboard#neighbourhood" });
  return r.toObject();
}

/* ---------------- host ---------------- */

function cleanListingInput(body, { partial = false } = {}) {
  const out = {};
  const str = (k, max = 200) => { if (body[k] !== undefined) out[k] = String(body[k] ?? "").trim().slice(0, max) || undefined; };
  ["title"].forEach((k) => str(k, 90));
  ["dimensions", "surface", "entranceWidth", "clearance", "landmark", "sector"].forEach((k) => str(k, 60));
  str("exactAddress", 200); str("accessInstructions", 600); str("rules", 600);
  if (body.type !== undefined) { if (!TYPES.includes(body.type)) fail("bad-request", "Pick a space type."); out.type = body.type; }
  if (body.spaces !== undefined) { const n = Number(body.spaces); if (!Number.isInteger(n) || n < 1 || n > 10) fail("bad-request", "Spaces must be 1 to 10."); out.spaces = n; }
  if (body.vehicleFit !== undefined) { const v = [].concat(body.vehicleFit).filter((x) => FITS.includes(x)); if (!v.length) fail("bad-request", "Pick at least one vehicle type."); out.vehicleFit = v; }
  if (body.covered !== undefined) out.covered = Boolean(body.covered);
  if (body.ratePerHourInr !== undefined) { const r = Number(body.ratePerHourInr); if (!Number.isInteger(r) || r < 1 || r > 1000) fail("bad-request", "Hourly rate must be a whole number of rupees (1 to 1000)."); out.ratePerHourInr = r; }
  if (body.lat !== undefined || body.lng !== undefined) {
    const lat = Number(body.lat), lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 30.6 || lat > 30.85 || lng < 76.65 || lng > 76.9) fail("bad-request", "Place the pin inside Chandigarh.");
    out.exactLat = lat; out.exactLng = lng;
  }
  if (body.availability !== undefined) {
    const av = [].concat(body.availability).map((w) => ({
      days: [].concat(w.days).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
      start: String(w.start), end: String(w.end),
    })).filter((w) => w.days.length && /^\d{2}:\d{2}$/.test(w.start) && /^\d{2}:\d{2}$/.test(w.end) && toMinutes(w.end) > toMinutes(w.start));
    if (!av.length) fail("bad-request", "Add at least one availability window (days, start and end time).");
    out.availability = av.slice(0, 7);
  }
  if (body.blockedDates !== undefined) out.blockedDates = [].concat(body.blockedDates).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 60);
  if (!partial) {
    for (const k of ["title", "type", "sector", "ratePerHourInr", "availability", "exactAddress"]) if (out[k] === undefined) fail("bad-request", `Missing ${k}.`);
    if (out.exactLat === undefined) fail("bad-request", "Place the pin on the map.");
  }
  return out;
}

export async function createListing(host, body) {
  if (host.hostStatus === "suspended") fail("permission-denied", "Your host account is suspended. Contact Park'd support.");
  if (!body?.declaration) fail("bad-request", "Please confirm you own the space (or have permission) and that renting it follows your society/RWA rules and local regulations.");
  const data = cleanListingInput(body);
  const id = makeCode("nl-", 6).toLowerCase();
  const l = await Listing.create({
    _id: id, hostId: host._id, ...data, ...approximate(data.exactLat, data.exactLng, id),
    status: "pending", declarationAccepted: true, verified: false,
  });
  await User.updateOne({ _id: host._id }, { $set: { isHost: true } });
  await audit(host, "listing.create", `New listing “${l.title}” submitted for review`);
  const admins = await User.find({ role: "admin" }, { _id: 1 }).lean();
  for (const a of admins) await notify(a._id, { type: "listing.pending", key: `listing-pending:${id}`, title: "New space to review", body: `“${l.title}” in Sector ${l.sector} is waiting for approval.`, link: "/mc/dashboard#neighbourhood" });
  return l.toObject();
}

async function ownListing(host, id) {
  const l = await Listing.findById(id).lean();
  if (!l || String(l.hostId) !== String(host._id)) fail("not-found", "Listing not found.");
  return l;
}

export async function updateListing(host, id, body) {
  const l = await ownListing(host, id);
  if (["rejected", "suspended"].includes(l.status) && body.status) fail("invalid-state", "This listing can't be changed until the Municipal Corporation reviews it again.");
  const data = cleanListingInput(body, { partial: true });
  if (data.exactLat !== undefined) Object.assign(data, approximate(data.exactLat, data.exactLng, id));
  if (body.status === "paused" && l.status === "active") data.status = "paused";
  if (body.status === "active" && l.status === "paused") data.status = "active";
  await Listing.updateOne({ _id: id }, { $set: data });
  emitAll("listing:update", { listingId: id });
  return Listing.findById(id).lean();
}

export async function deleteListing(host, id) {
  const l = await ownListing(host, id);
  const upcoming = await NBooking.exists({ listingId: id, status: "confirmed", end: { $gt: new Date() } });
  if (upcoming) fail("invalid-state", "This space has upcoming bookings. Cancel them or pause the listing instead.");
  await Listing.deleteOne({ _id: id });
  await audit(host, "listing.delete", `Listing “${l.title}” deleted by host`);
  emitAll("listing:update", { listingId: id, deleted: true });
  return { ok: true };
}

export async function hostListings(host) {
  const list = await Listing.find({ hostId: host._id }).sort({ createdAt: -1 }).lean();
  const ratings = await ratingFor(list.map((l) => l._id));
  return list.map((l) => ({ ...l, reviewCount: ratings[l._id]?.count ?? 0, rating: ratings[l._id]?.count >= 3 ? ratings[l._id] : null }));
}

export async function hostBookings(host) {
  const list = await NBooking.find({ hostId: host._id, status: { $ne: "expired" } }).sort({ start: -1 }).limit(100).lean();
  const [titles, drivers] = await Promise.all([
    Listing.find({ _id: { $in: list.map((b) => b.listingId) } }, { title: 1 }).lean(),
    User.find({ _id: { $in: list.map((b) => b.driverId) } }, { name: 1 }).lean(),
  ]);
  const t = Object.fromEntries(titles.map((l) => [l._id, l.title]));
  const d = Object.fromEntries(drivers.map((u) => [String(u._id), String(u.name ?? "Citizen").split(" ")[0]]));
  const bookings = list.filter((b) => b.status !== "pending-payment").map((b) => ({ ...b, title: t[b.listingId], driverFirstName: d[String(b.driverId)] }));
  const earned = bookings.filter((b) => b.paymentId).reduce((a, b) => a + b.totalInr - (b.refundInr ?? 0), 0);
  return { bookings, earningsInr: earned, note: "Demo: no real payouts." };
}

/* ---------------- MC moderation ---------------- */

export async function moderateListing(admin, id, action, note) {
  const l = await Listing.findById(id).lean();
  if (!l) fail("not-found", "Listing not found.");
  const next = { approve: "active", reject: "rejected", suspend: "suspended", reinstate: "active" }[action];
  if (!next) fail("bad-request", "Unknown action.");
  if (action === "approve" && l.status !== "pending") fail("invalid-state", "Only pending listings can be approved.");
  if (action === "reject" && l.status !== "pending") fail("invalid-state", "Only pending listings can be rejected.");
  if (action === "reinstate" && l.status !== "suspended") fail("invalid-state", "Only suspended listings can be reinstated.");
  await Listing.updateOne({ _id: id }, { $set: { status: next, statusNote: note ? String(note).slice(0, 300) : undefined } });
  await audit(admin, `listing.${action}`, `Listing “${l.title}” ${next}${note ? `: ${note}` : ""}`);
  const msg = { approve: ["Your space is live", `“${l.title}” is approved and visible to citizens.`], reject: ["Listing not approved", `“${l.title}” was not approved.${note ? ` Reason: ${note}` : ""}`], suspend: ["Listing suspended", `“${l.title}” was suspended by the Municipal Corporation.${note ? ` Reason: ${note}` : ""}`], reinstate: ["Listing reinstated", `“${l.title}” is visible to citizens again.`] }[action];
  await notify(l.hostId, { type: `listing.${action}`, key: `listing-${action}:${id}:${Date.now()}`, title: msg[0], body: msg[1], link: "/host" });
  emitAll("listing:update", { listingId: id, status: next });
  return { ok: true, status: next };
}

export async function adminNeighbourhood() {
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [pending, counts, bookingsWeek, reports] = await Promise.all([
    Listing.find({ status: "pending" }).sort({ createdAt: 1 }).lean(),
    Listing.find({}, { status: 1 }).lean(),
    NBooking.countDocuments({ status: { $in: ["confirmed", "completed"] }, createdAt: { $gte: weekAgo } }),
    Report.find().sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  const byStatus = counts.reduce((a, l) => ({ ...a, [l.status]: (a[l.status] ?? 0) + 1 }), {});
  const hosts = Object.fromEntries((await User.find({ _id: { $in: pending.map((l) => l.hostId) } }, { name: 1, phone: 1 }).lean()).map((u) => [String(u._id), u]));
  const all = await Listing.find({ status: { $in: ["active", "paused", "suspended"] } }, { title: 1, sector: 1, status: 1, ratePerHourInr: 1, demo: 1 }).lean();
  return {
    counts: byStatus, bookingsThisWeek: bookingsWeek, openReports: reports.filter((r) => r.status === "open").length,
    pending: pending.map((l) => ({ ...l, hostName: hosts[String(l.hostId)]?.name })),
    listings: all, reports,
  };
}

export async function resolveReport(admin, id) {
  const r = await Report.findOneAndUpdate({ _id: id, status: "open" }, { $set: { status: "resolved" } }, { new: true }).lean();
  if (!r) fail("invalid-state", "Report not found or already resolved.");
  await audit(admin, "report.resolve", `Report on ${r.bookingId} resolved`);
  return r;
}

/* ---------------- jobs ---------------- */

export async function runNeighbourhoodJobs(now = new Date()) {
  // unpaid holds expire
  await NBooking.updateMany({ status: "pending-payment", holdExpiresAt: { $lte: now } }, { $set: { status: "expired" } });
  // finished bookings complete
  await NBooking.updateMany({ status: "confirmed", end: { $lte: now } }, { $set: { status: "completed" } });
  // 30-minute reminders
  const soon = await NBooking.find({ status: "confirmed", start: { $gt: now, $lte: new Date(now.getTime() + 30 * 60000) } }).lean();
  for (const b of soon) {
    await notify(b.driverId, { type: "booking.reminder", pref: "bookingAlerts", key: `nb-remind:${b._id}`, title: "Your parking starts soon", body: `Booking ${b._id} starts at ${istParts(b.start).time}. Open it for the address and access instructions.`, link: `/booking?id=${b._id}` });
  }
}

export const NB_RULES = { HOLD_MIN, PLATFORM_FEE_INR, timeZone: RULES.timeZone };
