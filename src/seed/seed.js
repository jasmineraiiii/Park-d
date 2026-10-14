// Loads the demo data into MongoDB.
//
//   npm run seed              → lots, slots, staff, a demo driver, plus realistic
//                               occupancy and the last 24 h of history (for charts)
//   npm run seed -- --empty   → lots, slots and staff only; every slot free
//
// WARNING: this deletes all existing ParkChd data in the database first.

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { AuditLog, Listing, Lot, NBooking, Notification, OverflowEvent, Payment, Report, Reservation, Review, Session, Setting, Slot, User } from "../models/index.js";
import { approximate } from "../services/neighbourhood.js";
import { makeCode, reservableCount, slotLabel } from "../services/util.js";
import { BUSY, HOSTS, LISTINGS, LOTS, OVERFLOW_LINKS, PENDING_LISTING, STAFF, ZONES } from "./data.js";

const empty = process.argv.includes("--empty");
const { ObjectId } = mongoose.Types;
const rnd = Math.random;
const UPI = ["Google Pay", "PhonePe", "Paytm", "BHIM"];

const gauss = (x, mu, sd) => Math.exp(-((x - mu) ** 2) / (2 * sd * sd));
/** An hour of the day weighted toward late-morning and evening peaks, inside opening hours. */
function pickHour(lot) {
  for (;;) {
    const h = Math.floor(rnd() * 24);
    if (!(lot.opensAt === 0 && lot.closesAt === 24) && (h < lot.opensAt || h >= lot.closesAt)) continue;
    const w = 0.08 + gauss(h, 11.5, 2.2) + 1.3 * gauss(h, 19, 2.4) + 0.5 * gauss(h, 14.5, 1.5);
    if (rnd() < w / 1.5) return h;
  }
}
const payment = (lot, slotNumber, at, recordedBy) => {
  const method = rnd() < 0.62 ? "upi" : "cash";
  return {
    _id: new ObjectId(),
    reference: method === "upi" ? makeCode("DEMO-UPI-", 10) : makeCode("DEMO-CASH-", 8),
    amountInr: lot.feeInr, method, upiApp: method === "upi" ? UPI[Math.floor(rnd() * 4)] : null,
    purpose: "parking", lotId: lot.id, slotNumber, recordedBy, status: "success", simulated: true, createdAt: at,
  };
};

async function main() {
  await connectDb();
  console.log("[seed] clearing old data…");
  await Promise.all([Lot, Slot, User, Session, Reservation, Payment, AuditLog, OverflowEvent, Setting, Notification, Listing, NBooking, Review, Report].map((M) => M.deleteMany({})));

  // staff + demo driver
  const staffDocs = await User.insertMany(await Promise.all(STAFF.map(async (s) => ({
    username: s.username, name: s.name, role: s.role, phone: s.phone,
    pinHash: await bcrypt.hash(s.pin, 10), assignedLotIds: s.assignedLotIds ?? [],
  }))));
  const demoPw = await bcrypt.hash("parkd-demo", 10); // demo web sign-in password (change for real use)
  await User.create({ name: "Demo Citizen", phone: "9800000210", email: "driver@demo.parkd", passwordHash: demoPw, role: "driver", vehicleNo: "CH01 AB 1234" });
  const attendantFor = (lotId) => staffDocs.find((u) => u.assignedLotIds.includes(lotId))?._id ?? null;

  const now = Date.now();
  const lots = [], slots = [], sessions = [], payments = [];
  for (const l of LOTS) {
    lots.push({ _id: l.id, name: l.name, sector: l.sector, address: l.address, lat: l.lat, lng: l.lng, capacity: l.capacity, feeInr: l.feeInr, opensAt: l.opensAt, closesAt: l.closesAt, tags: l.tags, popular: l.popular, coordinatesVerified: false,
      kind: "regular", overflow: { thresholdPct: 90, bufferPct: 5, zoneIds: OVERFLOW_LINKS[l.id] ?? [], armed: true } });
    const resN = reservableCount(l.capacity);
    const busy = BUSY[l.id] ?? 0.6;
    const att = attendantFor(l.id);

    for (let i = 0; i < l.capacity; i++) {
      // the last 10% of numbered slots are the reservation pool (near the entrance)
      const kind = i >= l.capacity - resN ? "reservable" : "general";
      const slot = { _id: `${l.id}:${slotLabel(i)}`, lotId: l.id, number: slotLabel(i), order: i, kind, state: "available", sessionId: null, reservationId: null, updatedAt: new Date(now - rnd() * 20 * 60000) };
      if (!empty && kind === "general" && rnd() < busy) {
        const startedAt = new Date(now - (10 + rnd() * 170) * 60000);
        const p = payment(l, slot.number, new Date(startedAt.getTime() + 60000), att);
        const s = { _id: new ObjectId(), lotId: l.id, slotId: slot._id, slotNumber: slot.number, source: "seed", startedAt, feeInr: l.feeInr, paymentId: p._id, status: "active" };
        sessions.push(s); payments.push(p);
        Object.assign(slot, { state: "occupied", sessionId: s._id, updatedAt: startedAt });
      }
      slots.push(slot);
    }

    // last 24 h of finished visits, for revenue and peak-hour charts
    if (!empty) {
      const IST = 5.5 * 3600000, DAY = 86400000;
      const startOfDay = new Date(Math.floor((now + IST) / DAY) * DAY - IST); // midnight in Chandigarh
      const visits = Math.round((l.capacity * busy * 16) / 3.2);
      for (let k = 0; k < visits; k++) {
        const dur = (30 + rnd() * 150) * 60000;
        let start = startOfDay.getTime() + (pickHour(l) + rnd()) * 3600000;
        if (start + dur > now) start -= 24 * 3600000;
        const n = slotLabel(Math.floor(rnd() * (l.capacity - resN)));
        const p = payment(l, n, new Date(start + 60000), att);
        sessions.push({ _id: new ObjectId(), lotId: l.id, slotId: `${l.id}:${n}`, slotNumber: n, source: "seed", startedAt: new Date(start), endedAt: new Date(start + dur), feeInr: l.feeInr, paymentId: p._id, status: "closed" });
        payments.push(p);
      }
    }
  }

  // Festival Mode zones: approved/scheduled but INACTIVE until the MC activates them. All slots free.
  for (const z of ZONES) {
    lots.push({ _id: z.id, name: z.name, sector: z.sector, address: z.address, lat: z.lat, lng: z.lng, capacity: z.capacity, feeInr: z.feeInr, opensAt: z.opensAt, closesAt: z.closesAt, tags: ["temporary"], coordinatesVerified: false, kind: "temporary",
      zone: { status: "scheduled", approved: z.approved, autoActivate: z.autoActivate, startsAt: new Date(now - 86400000), endsAt: new Date(now + 14 * 86400000), linkedLotIds: z.linkedLotIds, entryPoints: z.entryPoints, vehicles: z.vehicles, restrictions: z.restrictions, accessibility: z.accessibility, contact: z.contact, contactPublic: z.contactPublic, demo: true } });
    const resN = reservableCount(z.capacity);
    for (let i = 0; i < z.capacity; i++) slots.push({ _id: `${z.id}:${slotLabel(i)}`, lotId: z.id, number: slotLabel(i), order: i, kind: i >= z.capacity - resN ? "reservable" : "general", state: "available", sessionId: null, reservationId: null, updatedAt: new Date(now) });
  }

  // Neighbourhood Parking: demo hosts + fictional listings (+ one pending for moderation)
  const hostDocs = await User.insertMany(HOSTS.map((h, i) => ({ role: "driver", name: h.name, phone: h.phone, email: `host${i + 1}@demo.parkd`, passwordHash: demoPw, vehicleNo: h.vehicleNo, isHost: true })));
  const listings = [...LISTINGS.map((l) => ({ ...l, status: "active" })), { ...PENDING_LISTING, status: "pending" }].map((l, i) => {
    const id = `nl-demo${i + 1}`;
    return { _id: id, hostId: hostDocs[l.host]._id, title: l.title, type: l.type, spaces: l.spaces, vehicleFit: l.vehicleFit, covered: l.covered, dimensions: l.dimensions, surface: l.surface, entranceWidth: l.entranceWidth, clearance: l.clearance,
      sector: l.sector, landmark: l.landmark, exactLat: l.lat, exactLng: l.lng, ...approximate(l.lat, l.lng, id), exactAddress: l.exactAddress, accessInstructions: l.access,
      ratePerHourInr: l.rate, availability: l.availability, blockedDates: [], rules: l.rules, status: l.status, verified: false, declarationAccepted: true, demo: true };
  });
  await Listing.insertMany(listings);

  await Lot.insertMany(lots);
  for (let i = 0; i < slots.length; i += 500) await Slot.insertMany(slots.slice(i, i + 500));
  for (let i = 0; i < sessions.length; i += 1000) await Session.insertMany(sessions.slice(i, i + 1000));
  for (let i = 0; i < payments.length; i += 1000) await Payment.insertMany(payments.slice(i, i + 1000));
  await AuditLog.create({ actorRole: "system", actorName: "System", action: "system.seed", detail: empty ? "Demo lots loaded, all slots free." : "Demo data loaded. Occupancy and history are simulated." });

  console.log(`[seed] ${ZONES.length} temporary zones (inactive), ${listings.length} neighbourhood listings (${listings.filter((l) => l.status === "pending").length} pending), ${HOSTS.length} demo hosts`);
  console.log(`[seed] ${lots.length} lots, ${slots.length} slots, ${sessions.length} sessions, ${payments.length} payments, ${staffDocs.length} staff`);
  console.log("[seed] demo host phones:", HOSTS.map((h) => h.phone).join(", "));
  console.log("[seed] web sign-in (password parkd-demo): driver@demo.parkd,", HOSTS.map((_, i) => `host${i + 1}@demo.parkd`).join(", "));
  console.log("[seed] staff sign-in:", STAFF.map((s) => `${s.username} / ${s.pin}`).join(", "));
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("[seed] failed:", e.message);
  await mongoose.disconnect();
  process.exit(1);
});
