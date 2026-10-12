// Login tokens (JWT). The frontend sends: Authorization: Bearer <token>
// The token holds only the user id; role and assigned lots are read fresh
// from the database on every request, so changes apply immediately.

import jwt from "jsonwebtoken";
import { ENV } from "../config.js";
import { fail, handle } from "../errors.js";
import { User } from "../models/index.js";

export const signToken = (user) => jwt.sign({ sub: String(user._id), role: user.role }, ENV.jwtSecret, { expiresIn: "30d" });

export const requireAuth = (...roles) => handle(async (req, _res, next) => {
  const h = req.headers.authorization ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) fail("unauthenticated", "Sign in first.");
  let payload;
  try { payload = jwt.verify(token, ENV.jwtSecret); } catch { fail("unauthenticated", "Your session has expired. Sign in again."); }
  const user = await User.findById(payload.sub, { pinHash: 0 }).lean();
  if (!user) fail("unauthenticated", "Account not found. Sign in again.");
  if (roles.length && !roles.includes(user.role)) fail("permission-denied", "You do not have permission to do this.");
  req.user = user;
  next();
});

/** Like requireAuth, but never fails: sets req.user when a valid token is sent. */
export const optionalAuth = handle(async (req, _res, next) => {
  const h = req.headers.authorization ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, ENV.jwtSecret);
      req.user = (await User.findById(payload.sub, { pinHash: 0 }).lean()) ?? undefined;
    } catch { /* ignore bad tokens on public endpoints */ }
  }
  next();
});
