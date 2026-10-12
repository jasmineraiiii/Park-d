// A small in-process lock. Actions on the same lot (or the same driver) run
// one after another inside this server, so two taps at the same instant can
// never both win.
//
// This is a second layer: MongoDB's conditional updates are already atomic
// per document. Together they stop double booking on a single server (enough
// for the hackathon and a city pilot). If you ever run several server
// instances, MongoDB's atomic updates still protect each slot.

const tails = new Map();

export async function withLocks(keys, fn) {
  const unique = [...new Set(keys.filter(Boolean))].sort(); // fixed order → no deadlocks
  const releases = [];
  for (const key of unique) {
    const prev = tails.get(key) ?? Promise.resolve();
    let release;
    const mine = new Promise((r) => { release = r; });
    const tail = prev.then(() => mine);
    tails.set(key, tail);
    await prev;
    releases.push(() => { release(); if (tails.get(key) === tail) tails.delete(key); });
  }
  try {
    return await fn();
  } finally {
    releases.reverse().forEach((r) => r());
  }
}

export const lotKey = (id) => (id ? `lot:${id}` : null);
export const driverKey = (id) => (id ? `driver:${id}` : null);
