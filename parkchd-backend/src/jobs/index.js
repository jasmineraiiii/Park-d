import cron from "node-cron";
import mongoose from "mongoose";
import { ENV } from "../config.js";
import { Lot, Payment, Session, Slot, User } from "../models/index.js";
import { emitSlotChange } from "../realtime.js";
import { BUSY } from "../seed/data.js";
import { expireReservations } from "../services/parking.js";
import { isLotOpen, makeCode } from "../services/util.js";
import { lotKey, withLocks } from "../services/locks.js";
import { onSlotChange } from "../realtime.js";
import { checkAllOverflow, scheduleOverflowCheck } from "../services/festival.js";
import { runNeighbourhoodJobs } from "../services/neighbourhood.js";

export function startJobs() {
  // Festival Mode: check a lot's occupancy shortly after any slot change ...
  onSlotChange((lotId) => scheduleOverflowCheck(lotId));
  // ... and every minute as a safety net, plus Neighbourhood Parking housekeeping.
  cron.schedule("* * * * *", async () => {
    try { await checkAllOverflow(); } catch (e) { console.error("[jobs] overflow check failed", e.message); }
    try { await runNeighbourhoodJobs(); } catch (e) { console.error("[jobs] neighbourhood jobs failed", e.message); }
  });

  // Release reservation holds after 30 minutes. Runs every minute.
  cron.schedule("* * * * *", async () => {
    try {
      const n = await expireReservations();
      if (n) console.log(`[jobs] expired ${n} reservation(s)`);
    } catch (e) {
      console.error("[jobs] expiry failed", e.message);
    }
  });

  if (ENV.simulate) {
    console.log("[jobs] simulation ON: cars will arrive and leave every 6 s");
    setInterval(() => simulateTick().catch((e) => console.error("[sim]", e.message)), 6000);
  }
}

/**
 * Demo only (SIMULATE=true): simulated walk-ins arrive and leave so the map
 * moves during a presentation. Never touches real drivers' sessions or reservations.
 */
async function simulateTick() {
  const lots = await Lot.find().lean();
  const staff = await User.find({ role: "attendant" }, { assignedLotIds: 1 }).lean();
  for (const lot of lots) {
    if (Math.random() > 0.35 || !isLotOpen(lot)) continue;
    await withLocks([lotKey(lot._id)], () => simulateLot(lot, staff));
  }
}

async function simulateLot(lot, staff) {
  {
    const target = BUSY[lot._id] ?? 0.6;
    const occ = (await Slot.countDocuments({ lotId: lot._id, state: "occupied" })) / lot.capacity;
    const arrive = Math.random() < 0.5 + (target - occ) * 2;
    if (arrive) {
      const sessionId = new mongoose.Types.ObjectId();
      const slot = await Slot.findOneAndUpdate(
        { lotId: lot._id, kind: "general", state: "available" },
        { $set: { state: "occupied", sessionId, updatedAt: new Date() } },
        { new: true, sort: { order: 1 } },
      );
      if (!slot) return;
      const method = Math.random() < 0.62 ? "upi" : "cash";
      const p = await Payment.create({
        reference: makeCode(method === "upi" ? "DEMO-UPI-" : "DEMO-CASH-", 10), amountInr: lot.feeInr, method,
        upiApp: method === "upi" ? "Google Pay" : null, purpose: "parking", lotId: lot._id, slotNumber: slot.number,
        recordedBy: staff.find((s) => s.assignedLotIds.includes(lot._id))?._id ?? null, simulated: true,
      });
      await Session.create({ _id: sessionId, lotId: lot._id, slotId: slot._id, slotNumber: slot.number, source: "simulated", feeInr: lot.feeInr, paymentId: p._id });
      emitSlotChange(slot);
    } else {
      const s = await Session.findOne({ lotId: lot._id, status: "active", source: { $in: ["simulated", "seed"] }, driverId: null, paymentId: { $ne: null } }).lean();
      if (!s) return;
      const done = await Session.findOneAndUpdate({ _id: s._id, status: "active" }, { $set: { status: "closed", endedAt: new Date() } });
      if (!done) return;
      const slot = await Slot.findOneAndUpdate({ _id: s.slotId, sessionId: s._id }, { $set: { state: "available", sessionId: null, updatedAt: new Date() } }, { new: true });
      emitSlotChange(slot);
    }
  }
}
