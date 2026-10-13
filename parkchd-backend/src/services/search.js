// Sector / landmark / lot search. Understands "Sector 17", "sec 17", "SEC-17", "s17", "17", "sector 17c",
// landmark names and their nicknames ("elante", "pgi", "nek chand").

import { LANDMARKS, SECTOR_CENTRES } from "../seed/data.js";

const norm = (q) => q.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();

export function parseSector(q) {
  const n = norm(q);
  const m =
    n.match(/^(?:sector|sectr|sect|sec|s)\s*-?\s*(\d{1,2})\s*-?\s*[a-d]?$/) ||
    n.match(/^(\d{1,2})\s*-?\s*[a-d]?$/) ||
    n.match(/\b(?:sector|sec)\s*-?\s*(\d{1,2})\b/);
  if (!m) return null;
  const num = String(parseInt(m[1], 10));
  return +num >= 1 && +num <= 63 ? num : null;
}

export function distanceKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Finds the place the query names: a sector, landmark or lot. Returns null when nothing matches. */
export function resolvePlace(query, lots) {
  const q = norm(query);
  if (!q) return null;
  const sector = parseSector(q);
  if (sector) {
    const inSector = lots.filter((l) => l.sector === sector);
    const c = inSector.length
      ? { lat: inSector.reduce((a, l) => a + l.lat, 0) / inSector.length, lng: inSector.reduce((a, l) => a + l.lng, 0) / inSector.length }
      : SECTOR_CENTRES[sector];
    if (c) return { kind: "sector", label: `Sector ${sector}`, sector, ...c };
  }
  const lm = LANDMARKS.find((l) => norm(l.name).includes(q) || l.aliases.some((a) => a.startsWith(q) || q.includes(a)));
  if (lm) return { kind: "landmark", label: lm.name, sector: lm.sector, lat: lm.lat, lng: lm.lng };
  const lot = lots.find((l) => norm(l.name).includes(q) || norm(l.address ?? "").includes(q));
  if (lot) return { kind: "lot", label: lot.name, sector: lot.sector, lat: lot.lat, lng: lot.lng, lotId: lot._id };
  return null;
}

/** Lots in the same sector or within the radius of the place, nearest first. */
export function lotsNear(place, lots, radiusKm = 1.0) {
  return lots
    .map((l) => ({ ...l, distanceKm: Math.round(distanceKm(place, l) * 100) / 100 }))
    .filter((l) => l.distanceKm <= radiusKm || (place.sector && l.sector === place.sector) || l._id === place.lotId)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
