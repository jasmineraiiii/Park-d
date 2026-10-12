// In-app notifications, shared by Festival Mode and Neighbourhood Parking.
//
// - One notification per (user, key): sending the same key twice does nothing,
//   so a zone opening never alerts the same driver twice.
// - Delivered live over Socket.io to the user's room and stored for the
//   notification centre (read / unread).
// - push.js is the hook for real push notifications later (FCM / Web Push).

import { Notification, User } from "../models/index.js";
import { emitToUser } from "../realtime.js";
import { withLocks } from "./locks.js";
import { sendPush } from "./push.js";

/**
 * Creates a notification unless one with the same key already exists for this user.
 * Returns the notification, or null if it was a duplicate or the user opted out.
 */
export async function notify(userId, { type, title, body, link, key, pref }) {
  if (!userId || !key) return null;
  return withLocks([`notify:${userId}`], async () => {
    const user = await User.findById(userId, { notificationPrefs: 1 }).lean();
    if (!user) return null;
    if (pref && user.notificationPrefs?.[pref] === false) return null;
    if (await Notification.exists({ userId, key })) return null;
    let n;
    try {
      n = await Notification.create({ userId, type, title, body, link, key });
    } catch (e) {
      if (e?.code === 11000) return null; // duplicate on another server instance
      throw e;
    }
    const out = n.toObject();
    emitToUser(String(userId), "notification:new", out);
    if (user.notificationPrefs?.push) sendPush(user, out).catch(() => {});
    return out;
  });
}

export async function listFor(userId, limit = 50) {
  const [items, unread] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).limit(Math.min(100, limit)).lean(),
    Notification.countDocuments({ userId, readAt: null }),
  ]);
  return { items, unread };
}

export async function markRead(userId, id) {
  await Notification.updateOne({ _id: id, userId, readAt: null }, { $set: { readAt: new Date() } });
}

export async function markAllRead(userId) {
  await Notification.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });
}
