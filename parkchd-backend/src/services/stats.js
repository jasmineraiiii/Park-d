// Live counts per lot, computed from the slots themselves so they can never drift.

import { Lot, Slot } from "../models/index.js";
import { isLotOpen } from "./util.js";

function count(lot, slots) {
  let occupied = 0, reserved = 0, available = 0, reservableTotal = 0, reservableFree = 0, updatedAt = 0;
  for (const s of slots) {
    if (s.kind === "reservable") reservableTotal++;
    if (s.state === "occupied") occupied++;
    else if (s.state === "reserved") reserved++;
    else { available++; if (s.kind === "reservable") reservableFree++; }
    const t = new Date(s.updatedAt).getTime();
    if (t > updatedAt) updatedAt = t;
  }
  return {
    lotId: lot._id,
    kind: lot.kind ?? "regular",
    zoneStatus: lot.kind === "temporary" ? lot.zone?.status ?? "scheduled" : undefined,
    capacity: lot.capacity,
    available, occupied, reserved,
    reservableTotal, reservableFree,
    occupancyPct: Math.round(((occupied + reserved) / lot.capacity) * 100),
    open: isLotOpen(lot),
    updatedAt: new Date(updatedAt || Date.now()).toISOString(),
  };
}

export async function lotStats(lotId) {
  const [lot, slots] = await Promise.all([
    Lot.findById(lotId).lean(),
    Slot.find({ lotId }, { kind: 1, state: 1, updatedAt: 1 }).lean(),
  ]);
  if (!lot) return null;
  return count(lot, slots);
}

/** Every lot with its live stats, in one pass. Pass a filter to limit (e.g. { kind: "temporary" }). */
export async function allLotsWithStats(filter = {}) {
  const [lots, slots] = await Promise.all([
    Lot.find(filter).lean(),
    Slot.find({}, { lotId: 1, kind: 1, state: 1, updatedAt: 1 }).lean(),
  ]);
  const byLot = new Map();
  for (const s of slots) {
    if (!byLot.has(s.lotId)) byLot.set(s.lotId, []);
    byLot.get(s.lotId).push(s);
  }
  return lots.map((lot) => ({ ...lot, id: lot._id, stats: count(lot, byLot.get(lot._id) ?? []) }));
}

/** What drivers see: regular lots plus temporary zones that are active right now. */
export async function publicLotsWithStats() {
  const all = await allLotsWithStats();
  return all.filter((l) => (l.kind ?? "regular") === "regular" || l.zone?.status === "active");
}
