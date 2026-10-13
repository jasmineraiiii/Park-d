// Live updates over Socket.io.
//
// Everyone receives:
//   "lot:update"      → live stats for a lot or temporary zone
//   "slot:update"     → one slot changed
//   "zone:update"     → a temporary zone was activated / deactivated / edited
//   "festival:update" → Festival Mode status changed
//   "listing:update"  → a Neighbourhood Parking listing changed
// Signed-in users (send { auth: { token } } when connecting) also join their own room:
//   "notification:new" → a new in-app notification for that user
// MC admins also join the "admins" room:
//   "overflow:new"    → a lot crossed its overflow threshold

import jwt from "jsonwebtoken";
import { ENV } from "./config.js";
import { lotStats } from "./services/stats.js";

let io = null;
const slotHooks = [];

export function setIo(server) {
  io = server;
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const p = jwt.verify(token, ENV.jwtSecret);
        socket.data.userId = p.sub;
        socket.data.role = p.role;
      } catch { /* anonymous connection is fine */ }
    }
    next();
  });
  io.on("connection", (socket) => {
    if (socket.data.userId) socket.join(`user:${socket.data.userId}`);
    if (socket.data.role === "admin") socket.join("admins");
    socket.emit("hello", { message: "Connected to Park'd live updates", signedIn: Boolean(socket.data.userId) });
  });
}

/** Lets other modules react to slot changes (e.g. overflow detection) without import cycles. */
export const onSlotChange = (fn) => slotHooks.push(fn);

export async function emitSlotChange(slot) {
  if (!slot) return;
  slotHooks.forEach((fn) => { try { fn(slot.lotId); } catch { /* ignore */ } });
  if (!io) return;
  io.emit("slot:update", { _id: slot._id, lotId: slot.lotId, number: slot.number, kind: slot.kind, state: slot.state, updatedAt: slot.updatedAt });
  try {
    io.emit("lot:update", await lotStats(slot.lotId));
  } catch (e) {
    console.error("[realtime] could not send lot update", e);
  }
}

export function emitLotChange(lotId, extra = {}) {
  if (!io) return;
  lotStats(lotId).then((s) => s && io.emit("lot:update", { ...s, ...extra })).catch(() => {});
}

export const emitAll = (event, data) => io?.emit(event, data);
export const emitToUser = (userId, event, data) => io?.to(`user:${userId}`).emit(event, data);
export const emitToAdmins = (event, data) => io?.to("admins").emit(event, data);
