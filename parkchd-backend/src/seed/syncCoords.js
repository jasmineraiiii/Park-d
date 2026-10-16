// Keeps lot locations in the database in line with seed/data.js, without a
// reseed (so users, bookings and history are untouched). Runs on every start.

import { Lot } from "../models/index.js";
import { LOTS } from "./data.js";

export async function syncLotCoordinates() {
  let changed = 0;
  for (const l of LOTS) {
    const r = await Lot.updateOne(
      { _id: l.id, $or: [{ lat: { $ne: l.lat } }, { lng: { $ne: l.lng } }, { address: { $ne: l.address } }] },
      { $set: { lat: l.lat, lng: l.lng, address: l.address, coordinatesVerified: true } },
    );
    changed += r.modifiedCount ?? 0;
  }
  if (changed) console.log(`[db] corrected the map location of ${changed} lot(s)`);
}
