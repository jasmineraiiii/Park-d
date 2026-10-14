// The rules of ParkChd. Every state change goes through this file.
//
// How double booking is prevented without database transactions:
// each step is a CONDITIONAL update ("change this slot only if it is still
// available"). If two phones try at the same moment, MongoDB applies one
// update and the other matches nothing, so it gets a clear error. If a later
// step fails, the earlier steps are undone.

import mongoose from "mongoose";
import { RULES } from "../config.js";
import { fail } from "../errors.js";
import { Lot, Payment, Reservation, Session, Slot, User } from "../models/index.js";
import { emitSlotChange } from "../realtime.js";
import { audit, isLotOpen, makeCode } from "./util.js";
import { driverKey, lotKey, withLocks } from "./locks.js";

const { ObjectId } = mongoose.Types;
const ACTIVE_RES = ["pending-payment", "held"];
const UPI_APPS = ["Google Pay", "PhonePe", "Paytm", "BHIM"];

/* ---------- helpers ---------- */
async function getLot(lotId) {
  const lot = await Lot.findById(lotId).lean();
  if (!lot) fail("not-found", "That parking lot does not exist.");
  return lot;
}

export function requireLotAccess(actor, lotId) {
  if (actor.role === "admin") return; // the MC may view any lot's receipts
  if (actor.role !== "attendant") fail("permission-denied", "Only parking staff can do this.");
  if (!actor.assignedLotIds?.includes(lotId)) fail("permission-denied", "This lot is not assigned to you.");
}

function checkUpiApp(app) {
  if (!UPI_APPS.includes(app)) fail("bad-request", `Choose a UPI app: ${UPI_APPS.join(", ")}.`);
}

/**
 * Records a payment. Every payment from this server is marked simulated:
 * no money moves until a real gateway (Razorpay, Cashfree, PayU) confirms it
 * through a verified webhook. See README → "Real payments".
 */
async function recordPayment({ _id, lot, slotNumber, purpose, method, upiApp, driverId = null, recordedBy = null, amountInr }) {
  return Payment.create({
    _id: _id ?? new ObjectId(),
    reference: method === "upi" ? makeCode("DEMO-UPI-", 10) : makeCode("DEMO-CASH-", 8),
    amountInr: amountInr ?? lot.feeInr,
    method, upiApp: method === "upi" ? upiApp ?? "Google Pay" : null,
    purpose, lotId: lot._id, slotNumber, driverId, recordedBy,
    status: "success", simulated: true,
  });
}

/** Explains why a driver could not be claimed. */
async function driverBusyError(driverId) {
  const u = await User.findById(driverId).lean();
  if (!u) fail("not-found", "Citizen account not found. Sign in again.");
  if (u.activeReservationId) fail("already-active", "You already have an active reservation. Cancel or use it first.");
  fail("already-active", "You already have a car parked. End that session first.");
}

async function freeSlot(slotId, match) {
  const slot = await Slot.findOneAndUpdate(
    { _id: slotId, ...match },
    { $set: { state: "available", sessionId: null, reservationId: null, updatedAt: new Date() } },
    { new: true },
  );
  if (slot) emitSlotChange(slot);
  return slot;
}

/* =====================================================================
   RESERVATIONS
   ===================================================================== */

/** Step 1: hold a reservable slot for 15 minutes. The 10% cap holds because only "reservable" slots can be claimed. */
async function _createReservation(driver, { lotId, slotId }) {
  const lot = await getLot(lotId);
  if (!isLotOpen(lot)) fail("lot-closed", `${lot.name} is closed right now.`);

  if (slotId) {
    const s = await Slot.findById(slotId).lean();
    if (!s || s.lotId !== lotId) fail("not-found", "That slot does not exist in this lot.");
    if (s.kind !== "reservable") fail("invalid-state", `${s.number} is a walk-in slot. Only reservation-pool slots (10% of the lot) can be booked.`);
    if (s.state !== "available") fail("slot-taken", `${s.number} was just taken. Pick another slot.`);
  }

  const resId = makeCode("PK-");
  const now = new Date();

  // 1. claim the driver (one active booking or parked car at a time)
  const claimed = await User.findOneAndUpdate(
    { _id: driver._id, activeReservationId: null, activeSessionId: null },
    { $set: { activeReservationId: resId } },
  );
  if (!claimed) await driverBusyError(driver._id);

  let slot = null;
  try {
    // 2. claim the slot, only if still available
    slot = await Slot.findOneAndUpdate(
      { lotId, kind: "reservable", state: "available", ...(slotId ? { _id: slotId } : {}) },
      { $set: { state: "reserved", reservationId: resId, updatedAt: now } },
      { new: true, sort: { order: 1 } },
    );
    if (!slot) {
      if (slotId) fail("slot-taken", "That slot was just taken. Pick another slot.");
      const total = await Slot.countDocuments({ lotId, kind: "reservable" });
      fail("limit-reached", `Only ${total} of ${lot.capacity} slots (10%) can be reserved here, and all are taken right now.`);
    }

    // 3. write the booking
    const r = await Reservation.create({
      _id: resId, lotId, slotId: slot._id, slotNumber: slot.number, driverId: driver._id,
      feeInr: RULES.reservationFeeInr, createdAt: now,
      expiresAt: new Date(now.getTime() + RULES.holdMinutes * 60000),
      status: "pending-payment",
    });
    emitSlotChange(slot);
    audit(driver, "reservation.create", `Hold on ${slot.number} (${resId}), awaiting payment`, lotId, slot.number);
    return r.toObject();
  } catch (e) {
    // undo anything already done
    if (slot) await freeSlot(slot._id, { reservationId: resId });
    await User.updateOne({ _id: driver._id, activeReservationId: resId }, { $set: { activeReservationId: null } });
    throw e;
  }
}

/** Step 2: pay the reservation fee (demo UPI). Confirms the hold. */
async function _payReservation(driver, reservationId, upiApp) {
  checkUpiApp(upiApp);
  const paymentId = new ObjectId();
  const r = await Reservation.findOneAndUpdate(
    { _id: reservationId, driverId: driver._id, status: "pending-payment", expiresAt: { $gt: new Date() } },
    { $set: { status: "held", paymentId } },
    { new: true },
  );
  if (!r) {
    const x = await Reservation.findById(reservationId).lean();
    if (!x || String(x.driverId) !== String(driver._id)) fail("not-found", "Reservation not found.");
    if (x.status === "expired" || x.expiresAt <= new Date()) fail("expired", "This reservation expired before payment. Please book again.");
    fail("invalid-state", "This reservation is already paid or closed.");
  }
  const lot = await getLot(r.lotId);
  const payment = await recordPayment({ _id: paymentId, lot, slotNumber: r.slotNumber, purpose: "reservation", method: "upi", upiApp, driverId: driver._id, amountInr: r.feeInr });
  audit(driver, "reservation.confirm", `${r._id} paid ₹${r.feeInr} via ${upiApp} (demo)`, r.lotId, r.slotNumber);
  return { reservation: r.toObject(), payment: payment.toObject() };
}

async function loadReservationFor(actor, reservationId) {
  const r = await Reservation.findById(reservationId).lean();
  if (!r) fail("not-found", "Reservation not found.");
  if (actor.role === "driver" && String(r.driverId) !== String(actor._id)) fail("not-found", "Reservation not found.");
  if (actor.role === "attendant") requireLotAccess(actor, r.lotId);
  return r;
}

async function _cancelReservation(actor, reservationId) {
  const r0 = await loadReservationFor(actor, reservationId);
  const r = await Reservation.findOneAndUpdate(
    { _id: r0._id, status: { $in: ACTIVE_RES } },
    { $set: { status: "cancelled" } },
    { new: true },
  );
  if (!r) fail("invalid-state", "This reservation is no longer active.");
  await releaseHold(r);
  audit(actor, "reservation.cancel", `${r._id} cancelled, ${r.slotNumber} released`, r.lotId, r.slotNumber);
  return r.toObject();
}

async function releaseHold(r) {
  await freeSlot(r.slotId, { reservationId: r._id, state: "reserved" });
  await User.updateOne({ _id: r.driverId, activeReservationId: r._id }, { $set: { activeReservationId: null } });
}

/** Driver arrives with a paid booking: the reserved slot becomes occupied. Driver or the lot's attendant can do this. */
async function _checkInReservation(actor, reservationId) {
  const r0 = await loadReservationFor(actor, reservationId);
  const r = await Reservation.findOneAndUpdate(
    { _id: r0._id, status: "held", expiresAt: { $gt: new Date() } },
    { $set: { status: "checked-in" } },
    { new: true },
  );
  if (!r) {
    if (r0.status === "pending-payment") fail("invalid-state", "Pay for the reservation before checking in.");
    if (r0.status === "expired" || r0.expiresAt <= new Date()) fail("expired", "This reservation has expired.");
    fail("invalid-state", "This reservation is no longer active.");
  }
  const driver = await User.findById(r.driverId).lean();
  const sessionId = new ObjectId();
  const slot = await Slot.findOneAndUpdate(
    { _id: r.slotId, reservationId: r._id, state: "reserved" },
    { $set: { state: "occupied", sessionId, reservationId: null, updatedAt: new Date() } },
    { new: true },
  );
  if (!slot) {
    await Reservation.updateOne({ _id: r._id }, { $set: { status: "held" } });
    fail("invalid-state", "The reserved slot is not held for this booking.");
  }
  const session = await Session.create({
    _id: sessionId, lotId: r.lotId, slotId: r.slotId, slotNumber: r.slotNumber, driverId: r.driverId,
    vehicleNo: driver?.vehicleNo, source: "reservation", feeInr: r.feeInr,
    paymentId: r.paymentId, // in this demo the reservation fee covers the entry fee
  });
  await Reservation.updateOne({ _id: r._id }, { $set: { sessionId } });
  await User.updateOne({ _id: r.driverId }, { $set: { activeReservationId: null, activeSessionId: sessionId } });
  emitSlotChange(slot);
  audit(actor, "reservation.checkin", `${r._id} checked in at ${slot.number}`, r.lotId, slot.number);
  return session.toObject();
}

/** Runs every minute: releases holds whose 15 minutes are up. */
export async function expireReservations(now = new Date()) {
  const due = await Reservation.find({ status: { $in: ACTIVE_RES }, expiresAt: { $lte: now } }).limit(500).lean();
  let n = 0;
  for (const x of due) {
    const r = await withLocks([lotKey(x.lotId), driverKey(x.driverId), `res:${x._id}`], () => Reservation.findOneAndUpdate(
      { _id: x._id, status: { $in: ACTIVE_RES }, expiresAt: { $lte: now } },
      { $set: { status: "expired" } },
      { new: true },
    ).then(async (r) => { if (r) await releaseHold(r); return r; }));
    if (!r) continue; // checked in or cancelled a moment ago
    audit("system", "reservation.expire", `${r._id} expired after ${RULES.holdMinutes} min, ${r.slotNumber} released`, r.lotId, r.slotNumber);
    n++;
  }
  return n;
}

/* =====================================================================
   PARKING SESSIONS (driver side)
   ===================================================================== */

/**
 * Driver confirms they parked in a walk-in slot (used for the demo and for
 * lots without an attendant on duty). Normally the attendant does this.
 */
async function _driverCheckIn(driver, { lotId, slotId }) {
  const lot = await getLot(lotId);
  if (!isLotOpen(lot)) fail("lot-closed", `${lot.name} is closed right now.`);
  const sessionId = new ObjectId();
  const claimed = await User.findOneAndUpdate(
    { _id: driver._id, activeReservationId: null, activeSessionId: null },
    { $set: { activeSessionId: sessionId } },
  );
  if (!claimed) await driverBusyError(driver._id);
  let slot = null;
  try {
    slot = await Slot.findOneAndUpdate(
      { lotId, kind: "general", state: "available", ...(slotId ? { _id: slotId } : {}) },
      { $set: { state: "occupied", sessionId, updatedAt: new Date() } },
      { new: true, sort: { order: 1 } },
    );
    if (!slot) fail(slotId ? "slot-taken" : "limit-reached", slotId ? "That slot is not free (or is kept for reservations). Pick another." : `${lot.name} has no free walk-in slot right now.`);
    const session = await Session.create({
      _id: sessionId, lotId, slotId: slot._id, slotNumber: slot.number, driverId: driver._id,
      vehicleNo: driver.vehicleNo, source: "driver-checkin", feeInr: lot.feeInr,
    });
    emitSlotChange(slot);
    audit(driver, "slot.occupy", `Citizen check-in at ${slot.number}`, lotId, slot.number);
    return session.toObject();
  } catch (e) {
    if (slot) await freeSlot(slot._id, { sessionId });
    await User.updateOne({ _id: driver._id, activeSessionId: sessionId }, { $set: { activeSessionId: null } });
    throw e;
  }
}

async function _payParking(driver, sessionId, upiApp) {
  checkUpiApp(upiApp);
  const paymentId = new ObjectId();
  const s = await Session.findOneAndUpdate(
    { _id: sessionId, driverId: driver._id, status: "active", paymentId: null },
    { $set: { paymentId } },
    { new: true },
  );
  if (!s) {
    const x = await Session.findById(sessionId).lean();
    if (!x || String(x.driverId) !== String(driver._id)) fail("not-found", "Parking session not found.");
    if (x.paymentId) fail("invalid-state", "This parking is already paid.");
    fail("invalid-state", "This parking session is closed.");
  }
  const lot = await getLot(s.lotId);
  const payment = await recordPayment({ _id: paymentId, lot, slotNumber: s.slotNumber, purpose: "parking", method: "upi", upiApp, driverId: driver._id, amountInr: s.feeInr });
  audit(driver, "payment.upi", `₹${s.feeInr} via ${upiApp} (demo) for ${s.slotNumber}`, s.lotId, s.slotNumber);
  return payment.toObject();
}

async function closeSession(s, status = "closed") {
  const closed = await Session.findOneAndUpdate(
    { _id: s._id, status: "active" },
    { $set: { status, endedAt: new Date() } },
    { new: true },
  );
  if (!closed) fail("invalid-state", "This session is already closed.");
  await freeSlot(s.slotId, { sessionId: s._id });
  if (s.driverId) await User.updateOne({ _id: s.driverId, activeSessionId: s._id }, { $set: { activeSessionId: null } });
  return closed;
}

/** Driver leaves. The fee must be paid first so the attendant does not lose it. */
async function _endSession(actor, sessionId) {
  const s = await Session.findById(sessionId).lean();
  if (!s || (actor.role === "driver" && String(s.driverId) !== String(actor._id))) fail("not-found", "Parking session not found.");
  if (actor.role === "attendant") requireLotAccess(actor, s.lotId);
  if (s.status !== "active") fail("invalid-state", "This session is already closed.");
  if (!s.paymentId) fail("invalid-state", "Pay the parking fee before leaving.");
  const closed = await closeSession(s);
  audit(actor, "slot.release", `${s.slotNumber} released, car exited`, s.lotId, s.slotNumber);
  return closed.toObject();
}

/* =====================================================================
   ATTENDANT
   ===================================================================== */

/** Register a walk-in. No slotId = the next free walk-in slot (one-tap entry). */
async function _attendantEntry(att, lotId, { slotId, vehicleNo, method, upiApp } = {}) {
  requireLotAccess(att, lotId);
  const lot = await getLot(lotId);
  if (lot.kind === "temporary" && !isLotOpen(lot)) fail("lot-closed", `${lot.name} is a temporary zone that is not active right now. The MC must activate it first.`);
  if (method && !["cash", "upi"].includes(method)) fail("bad-request", "Payment method must be cash or upi.");
  if (method === "upi" && upiApp) checkUpiApp(upiApp);
  const sessionId = new ObjectId();
  const slot = await Slot.findOneAndUpdate(
    slotId ? { _id: slotId, lotId, state: "available" } : { lotId, kind: "general", state: "available" },
    { $set: { state: "occupied", sessionId, updatedAt: new Date() } },
    { new: true, sort: { order: 1 } },
  );
  if (!slot) {
    if (slotId) {
      const s = await Slot.findById(slotId).lean();
      if (!s || s.lotId !== lotId) fail("not-found", "That slot does not exist in this lot.");
      fail("slot-taken", `Slot ${s.number} is already ${s.state}.`);
    }
    fail("limit-reached", "No free walk-in slot left in this lot.");
  }
  let paymentId = null;
  try {
    if (method) {
      const p = await recordPayment({ lot, slotNumber: slot.number, purpose: "parking", method, upiApp, recordedBy: att._id });
      paymentId = p._id;
    }
    const session = await Session.create({
      _id: sessionId, lotId, slotId: slot._id, slotNumber: slot.number,
      vehicleNo: vehicleNo?.trim().toUpperCase() || undefined,
      source: "attendant", feeInr: lot.feeInr, paymentId,
    });
    emitSlotChange(slot);
    audit(att, "slot.occupy", `Entry at ${slot.number}${session.vehicleNo ? ` (${session.vehicleNo})` : ""}${method ? `, ₹${lot.feeInr} ${method}` : ", unpaid"}`, lotId, slot.number);
    return { session: session.toObject(), slot: slot.toObject() };
  } catch (e) {
    await freeSlot(slot._id, { sessionId });
    throw e;
  }
}

async function occupiedSlotFor(att, slotId) {
  const slot = await Slot.findById(slotId).lean();
  if (!slot) fail("not-found", "Slot not found.");
  requireLotAccess(att, slot.lotId);
  if (slot.state !== "occupied") fail("invalid-state", `Slot ${slot.number} is not occupied.`);
  const session = slot.sessionId ? await Session.findById(slot.sessionId).lean() : null;
  return { slot, session };
}

async function _attendantRecordPayment(att, slotId, { method, upiApp }) {
  if (!["cash", "upi"].includes(method)) fail("bad-request", "Payment method must be cash or upi.");
  const { slot, session } = await occupiedSlotFor(att, slotId);
  if (!session) fail("invalid-state", "No parking session on this slot.");
  const paymentId = new ObjectId();
  const s = await Session.findOneAndUpdate({ _id: session._id, status: "active", paymentId: null }, { $set: { paymentId } }, { new: true });
  if (!s) fail("invalid-state", "This parking is already paid.");
  const lot = await getLot(slot.lotId);
  const p = await recordPayment({ _id: paymentId, lot, slotNumber: slot.number, purpose: "parking", method, upiApp, recordedBy: att._id, driverId: s.driverId, amountInr: s.feeInr });
  audit(att, `payment.${method}`, `₹${s.feeInr} ${method} recorded for ${slot.number}`, slot.lotId, slot.number);
  return p.toObject();
}

async function _attendantExit(att, slotId) {
  const { slot, session } = await occupiedSlotFor(att, slotId);
  if (session && !session.paymentId) fail("invalid-state", "Record the fee before releasing this slot.");
  if (session) await closeSession(session);
  else await freeSlot(slot._id, { state: "occupied" });
  audit(att, "slot.release", `Exit from ${slot.number}`, slot.lotId, slot.number);
  return { ok: true };
}

/** Undo an accidental assignment. Paid sessions keep their payment record so revenue stays traceable. */
async function _attendantCorrect(att, slotId, reason) {
  if (!reason || reason.trim().length < 3) fail("bad-request", "Give a short reason for the correction.");
  const { slot, session } = await occupiedSlotFor(att, slotId);
  if (session) await closeSession(session, "voided");
  else await freeSlot(slot._id, { state: "occupied" });
  audit(att, "slot.correct", `Assignment at ${slot.number} voided: ${reason.trim()}${session?.paymentId ? " (payment kept on record)" : ""}`, slot.lotId, slot.number);
  return { ok: true };
}

/* =====================================================================
   ADMIN
   ===================================================================== */

export async function setLotFee(admin, lotId, feeInr) {
  if (admin.role !== "admin") fail("permission-denied", "Only the MC administrator can change fees.");
  if (!Number.isInteger(feeInr) || feeInr < 0 || feeInr > 500) fail("bad-request", "Enter a whole-rupee fee between ₹0 and ₹500.");
  const lot = await getLot(lotId);
  await Lot.updateOne({ _id: lotId }, { $set: { feeInr } });
  audit(admin, "lot.fee", `Entry fee for ${lot.name} changed ₹${lot.feeInr} → ₹${feeInr}`, lotId);
  return { ...lot, feeInr };
}

export const createReservation = async (driver, input) => withLocks([driverKey(driver._id), lotKey(input?.lotId)], () => _createReservation(driver, input));
export const payReservation = async (driver, reservationId, upiApp) => withLocks([`res:${reservationId}`], () => _payReservation(driver, reservationId, upiApp));
export const cancelReservation = async (actor, reservationId) => withLocks(await resKeys(reservationId), () => _cancelReservation(actor, reservationId));
export const checkInReservation = async (actor, reservationId) => withLocks(await resKeys(reservationId), () => _checkInReservation(actor, reservationId));
export const driverCheckIn = async (driver, input) => withLocks([driverKey(driver._id), lotKey(input?.lotId)], () => _driverCheckIn(driver, input));
export const payParking = async (driver, sessionId, upiApp) => withLocks([`session:${sessionId}`], () => _payParking(driver, sessionId, upiApp));
export const endSession = async (actor, sessionId) => withLocks(await sessionKeys(sessionId), () => _endSession(actor, sessionId));
export const attendantEntry = async (att, lotId, input) => withLocks([lotKey(lotId)], () => _attendantEntry(att, lotId, input));
export const attendantRecordPayment = async (att, slotId, input) => withLocks([lotKey(slotLot(slotId))], () => _attendantRecordPayment(att, slotId, input));
export const attendantExit = async (att, slotId) => withLocks(await slotKeys(slotId), () => _attendantExit(att, slotId));
export const attendantCorrect = async (att, slotId, reason) => withLocks(await slotKeys(slotId), () => _attendantCorrect(att, slotId, reason));

/* ---------- lock keys ---------- */
// Slot ids look like "s17-ml:P07", so the lot id is the part before the colon.
function slotLot(slotId) { return String(slotId ?? "").split(":")[0] || null; }
async function slotKeys(slotId) {
  const slot = await Slot.findById(slotId, { sessionId: 1 }).lean();
  const s = slot?.sessionId ? await Session.findById(slot.sessionId, { driverId: 1 }).lean() : null;
  return [lotKey(slotLot(slotId)), driverKey(s?.driverId)];
}
async function resKeys(reservationId) {
  const r = await Reservation.findById(reservationId, { lotId: 1, driverId: 1 }).lean();
  return [lotKey(r?.lotId), driverKey(r?.driverId), `res:${reservationId}`];
}
async function sessionKeys(sessionId) {
  const s = await Session.findById(sessionId, { lotId: 1, driverId: 1 }).lean();
  return [lotKey(s?.lotId), driverKey(s?.driverId), `session:${sessionId}`];
}
