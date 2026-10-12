// Read-only figures for the Municipal Corporation dashboard and attendants.
// Uses a rolling last-24-hours window so the numbers make sense at any hour.

import { RULES } from "../config.js";
import { AuditLog, Payment, Session, User } from "../models/index.js";
import { publicLotsWithStats } from "./stats.js";
import { localHour } from "./util.js";

const since24h = () => new Date(Date.now() - 24 * 3600000);
const sectorLabel = (s) => (/^\d+$/.test(s) ? `Sector ${s}` : s);

export async function overview() {
  const [lots, payments] = await Promise.all([
    publicLotsWithStats(), // regular lots + active temporary zones
    // municipal revenue only (Neighbourhood Parking payments belong to hosts)
    Payment.find({ createdAt: { $gte: since24h() }, status: "success", purpose: { $in: ["parking", "reservation"] } }, { amountInr: 1, method: 1, upiApp: 1 }).lean(),
  ]);
  const capacity = lots.reduce((a, l) => a + l.capacity, 0);
  const available = lots.reduce((a, l) => a + l.stats.available, 0);
  const revenue = payments.reduce((a, p) => a + p.amountInr, 0);
  const upi = payments.filter((p) => p.method === "upi");
  const upiInr = upi.reduce((a, p) => a + p.amountInr, 0);

  const sectors = new Map();
  for (const l of lots) {
    const k = sectorLabel(l.sector);
    const e = sectors.get(k) ?? { sector: k, capacity: 0, available: 0 };
    e.capacity += l.capacity; e.available += l.stats.available;
    sectors.set(k, e);
  }

  const [recentStarts, recentEnds] = await Promise.all([
    Session.find({ status: { $ne: "voided" } }).sort({ startedAt: -1 }).limit(12).lean(),
    Session.find({ status: "closed", endedAt: { $ne: null } }).sort({ endedAt: -1 }).limit(12).lean(),
  ]);
  const lotName = (id) => lots.find((l) => l._id === id)?.name ?? id;
  const recent = [
    ...recentStarts.map((s) => ({ kind: "entry", at: s.startedAt, lotId: s.lotId, lotName: lotName(s.lotId), slotNumber: s.slotNumber })),
    ...recentEnds.map((s) => ({ kind: "exit", at: s.endedAt, lotId: s.lotId, lotName: lotName(s.lotId), slotNumber: s.slotNumber })),
  ].sort((a, b) => b.at - a.at).slice(0, 12);

  return {
    window: "last-24h",
    lots: { total: lots.length, openNow: lots.filter((l) => l.stats.open).length },
    capacity, available,
    occupancyPct: capacity ? Math.round(((capacity - available) / capacity) * 100) : 0,
    revenue: {
      totalInr: revenue, payments: payments.length,
      upiInr, cashInr: revenue - upiInr, upiCount: upi.length, cashCount: payments.length - upi.length,
      byApp: ["Google Pay", "PhonePe", "Paytm", "BHIM"].map((app) => ({ app, count: upi.filter((p) => p.upiApp === app).length })),
    },
    sectors: [...sectors.values()]
      .map((s) => ({ ...s, occupancyPct: Math.round(((s.capacity - s.available) / s.capacity) * 100) }))
      .sort((a, b) => b.occupancyPct - a.occupancyPct),
    alerts: lots
      .filter((l) => l.stats.open && l.stats.occupancyPct >= RULES.highOccupancyPct)
      .sort((a, b) => b.stats.occupancyPct - a.stats.occupancyPct)
      .map((l) => ({ lotId: l._id, name: l.name, occupancyPct: l.stats.occupancyPct, available: l.stats.available })),
    recent,
    note: "Demo data: figures come from seeded and simulated activity, not MC records.",
  };
}

/** Entries per hour of the day (Chandigarh time) over the last 24 h. */
export async function hourly() {
  const sessions = await Session.find({ startedAt: { $gte: since24h() }, status: { $ne: "voided" } }, { startedAt: 1 }).lean();
  const counts = Array.from({ length: 24 }, (_, hour) => ({ hour, entries: 0 }));
  for (const s of sessions) counts[Math.floor(localHour(s.startedAt))].entries++;
  return counts;
}

export async function attendants() {
  const [staff, payments, corrections] = await Promise.all([
    User.find({ role: "attendant" }, { name: 1, phone: 1, username: 1, assignedLotIds: 1 }).lean(),
    Payment.find({ createdAt: { $gte: since24h() }, recordedBy: { $ne: null }, purpose: { $ne: "neighbourhood" } }, { recordedBy: 1, amountInr: 1, method: 1 }).lean(),
    AuditLog.find({ action: "slot.correct", at: { $gte: since24h() } }, { actorId: 1 }).lean(),
  ]);
  return Promise.all(staff.map(async (a) => {
    const mine = payments.filter((p) => String(p.recordedBy) === String(a._id));
    const last = await AuditLog.findOne({ actorId: String(a._id) }).sort({ at: -1 }).lean();
    return {
      id: a._id, name: a.name, username: a.username, phone: a.phone, assignedLotIds: a.assignedLotIds,
      collectedInr: mine.reduce((x, p) => x + p.amountInr, 0),
      cashToDepositInr: mine.filter((p) => p.method === "cash").reduce((x, p) => x + p.amountInr, 0),
      corrections: corrections.filter((c) => c.actorId === String(a._id)).length,
      lastAction: last ? { at: last.at, detail: last.detail } : null,
    };
  }));
}

export async function auditLog({ type, lotId, limit = 200 } = {}) {
  const q = {};
  if (type && type !== "all") q.action = { $regex: `^${type.replace(/[^a-z]/g, "")}` };
  if (lotId) q.lotId = lotId;
  return AuditLog.find(q).sort({ at: -1 }).limit(Math.min(500, Number(limit) || 200)).lean();
}

export async function lotTransactions(lotId) {
  const [all, log] = await Promise.all([
    Payment.find({ lotId, createdAt: { $gte: since24h() } }, { amountInr: 1, method: 1, upiApp: 1, purpose: 1, slotNumber: 1, createdAt: 1, reference: 1 }).sort({ createdAt: -1 }).lean(),
    AuditLog.find({ lotId }).sort({ at: -1 }).limit(40).lean(),
  ]);
  return { payments: all.slice(0, 100), count: all.length, collectedInr: all.reduce((a, p) => a + p.amountInr, 0), log };
}
