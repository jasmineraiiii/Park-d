import { RULES } from "../config.js";
import { AuditLog } from "../models/index.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid misreading
export function makeCode(prefix, len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `${prefix}${s}`;
}

export const slotLabel = (i) => `P${String(i + 1).padStart(2, "0")}`;
export const reservableCount = (capacity) => Math.max(1, Math.floor(capacity * RULES.reservableShare));

/** Current hour (with minutes as a fraction) in Chandigarh, whatever the server's time zone. */
export function localHour(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: RULES.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const h = Number(parts.find((p) => p.type === "hour").value);
  const m = Number(parts.find((p) => p.type === "minute").value);
  return h + m / 60;
}

export function isLotOpen(lot, at = new Date()) {
  // Temporary zones accept vehicles only while activated and inside their approved window.
  if (lot.kind === "temporary") {
    const z = lot.zone ?? {};
    if (z.status !== "active" || !z.approved) return false;
    if (z.startsAt && at < new Date(z.startsAt)) return false;
    if (z.endsAt && at > new Date(z.endsAt)) return false;
  }
  if (lot.opensAt === 0 && lot.closesAt === 24) return true;
  const h = localHour(at);
  return h >= lot.opensAt && h < lot.closesAt;
}

/* ---------- Chandigarh (IST, UTC+5:30) date helpers ---------- */
const IST_MS = 5.5 * 3600000;
/** "2026-10-14" + "16:30" in Chandigarh → Date */
export function istDate(dateStr, timeStr = "00:00") {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const [hh, mm] = String(timeStr).split(":").map(Number);
  if (![y, m, d, hh, mm].every(Number.isFinite)) return null;
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - IST_MS);
}
/** Date → { date: "YYYY-MM-DD", time: "HH:MM", day: 0-6, minutes } in Chandigarh */
export function istParts(at = new Date()) {
  const x = new Date(new Date(at).getTime() + IST_MS);
  const date = x.toISOString().slice(0, 10), time = x.toISOString().slice(11, 16);
  return { date, time, day: x.getUTCDay(), minutes: x.getUTCHours() * 60 + x.getUTCMinutes() };
}
export const toMinutes = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };
export const fromMinutes = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export async function audit(actor, action, detail, lotId = null, slotNumber = undefined) {
  try {
    await AuditLog.create({
      actorId: actor === "system" ? "system" : String(actor._id),
      actorName: actor === "system" ? "System" : actor.name,
      actorRole: actor === "system" ? "system" : actor.role,
      action, detail, lotId, slotNumber,
    });
  } catch (e) {
    console.error("[audit] could not write", action, e.message); // never fail the main action because of the log
  }
}
