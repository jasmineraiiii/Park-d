// AI features powered by GroqCloud.
//
// 1. askAssistant: a driver asks in plain words ("parking near Elante for my
//    bike?", "sector 22 mein jagah hai?") and gets an answer built ONLY from live
//    slot counts, plus the lots it recommends (the app can show them as cards).
// 2. adminInsights: three short observations for the MC dashboard.
//
// The model never invents availability: it only sees the live numbers we send.
// Without GROQ_API_KEY (or if Groq fails), both fall back to rule-based answers,
// so the demo never breaks.

import Groq from "groq-sdk";
import { ENV } from "../config.js";
import { publicLotsWithStats } from "./stats.js";
import { distanceKm, lotsNear, resolvePlace } from "./search.js";
import { overview } from "./admin.js";

const groq = ENV.groqKey ? new Groq({ apiKey: ENV.groqKey }) : null;
export const aiEnabled = () => Boolean(groq);

const sectorLabel = (s) => (/^\d+$/.test(s) ? `Sector ${s}` : s);

async function chatJson(system, user, maxTokens = 400) {
  const res = await groq.chat.completions.create({
    model: ENV.groqModel,
    temperature: 0.2,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });
  const text = res.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(text);
}

/** Picks the lots worth showing the model: near the place the message names, else near the driver, else all. */
function candidates(message, lots, origin) {
  const place = resolvePlace(message, lots);
  const from = place ?? origin;
  let rows = from ? lotsNear(from, lots, 2.0) : lots.map((l) => ({ ...l, distanceKm: null }));
  if (!rows.length && from) rows = lots.map((l) => ({ ...l, distanceKm: Math.round(distanceKm(from, l) * 100) / 100 })).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 5);
  return { place, rows: rows.slice(0, 8) };
}

function fallbackAnswer(place, rows) {
  const open = rows.filter((l) => l.stats.open);
  const withSpace = open.filter((l) => l.stats.available > 0).sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  const where = place ? place.label : "Chandigarh";
  if (!rows.length) return { reply: "I couldn't find that place. Try a sector number like \"Sector 22\" or a landmark like Elante Mall.", lotIds: [] };
  if (!withSpace.length) return { reply: `Parking near ${where} is full or closed right now. Try again in a few minutes, or reserve where the app shows reservable slots.`, lotIds: [] };
  const best = withSpace[0];
  const total = withSpace.reduce((a, l) => a + l.stats.available, 0);
  return {
    reply: `Yes. ${where} has ${total} free spot${total === 1 ? "" : "s"} across ${withSpace.length} lot${withSpace.length === 1 ? "" : "s"}. ${best.name} has ${best.stats.available} free${best.stats.reservableFree ? `, and ${best.stats.reservableFree} can be reserved` : ""}.`,
    lotIds: withSpace.slice(0, 3).map((l) => l._id),
  };
}

export async function askAssistant(message, origin) {
  const text = String(message ?? "").trim().slice(0, 500);
  if (!text) return { reply: "Ask me where to park, for example \"Is there space in Sector 17?\"", lotIds: [], source: "rules" };
  const lots = await publicLotsWithStats();
  const { place, rows } = candidates(text, lots, origin);

  if (!groq) return { ...fallbackAnswer(place, rows), source: "rules" };

  const context = rows.map((l) => ({
    id: l._id, name: l.name, kind: l.kind ?? "regular", area: sectorLabel(l.sector), address: l.address,
    open: l.stats.open, hours: l.opensAt === 0 && l.closesAt === 24 ? "24 hours" : `${l.opensAt}:00-${l.closesAt}:00`,
    free: l.stats.available, capacity: l.capacity, reservableFree: l.stats.reservableFree,
    feeInr: l.feeInr, distanceKm: l.distanceKm,
  }));
  const system = [
    "You are Park'd, a parking assistant for Chandigarh, India. Temporary zones (kind \"temporary\") are MC-approved festival overflow sites; mention them when regular lots are full.",
    "Answer ONLY from the LOTS JSON provided. Never invent lots, numbers, prices or hours.",
    "Free counts are live. Mention the best 1-3 lots with their free count. Prefer open lots with space, then nearer ones.",
    "If nothing fits, say so and suggest the nearest alternative from LOTS.",
    "Up to 10% of each lot can be reserved for 15 minutes for ₹14; mention it when reservableFree > 0 and the user wants certainty.",
    "Reply in the user's language (English, Hindi or Hinglish), in at most 3 short sentences.",
    'Return JSON: {"reply": string, "lotIds": string[]} where lotIds are ids from LOTS, best first, at most 3.',
  ].join("\n");
  const user = `PLACE: ${place ? place.label : "not named"}\nLOTS: ${JSON.stringify(context)}\nQUESTION: ${text}`;

  try {
    const out = await chatJson(system, user);
    const valid = new Set(rows.map((l) => l._id));
    return {
      reply: typeof out.reply === "string" && out.reply.trim() ? out.reply.trim() : fallbackAnswer(place, rows).reply,
      lotIds: Array.isArray(out.lotIds) ? out.lotIds.filter((id) => valid.has(id)).slice(0, 3) : [],
      source: "groq",
    };
  } catch (e) {
    console.error("[assistant] Groq failed, using rules:", e.message);
    return { ...fallbackAnswer(place, rows), source: "rules" };
  }
}

export async function adminInsights() {
  const o = await overview();
  const facts = {
    occupancyPct: o.occupancyPct, available: o.available, capacity: o.capacity,
    revenueInr: o.revenue.totalInr, upiSharePct: o.revenue.totalInr ? Math.round((o.revenue.upiInr / o.revenue.totalInr) * 100) : 0,
    busiestSectors: o.sectors.slice(0, 3), quietestSectors: o.sectors.slice(-3), alerts: o.alerts,
  };
  const fallback = () => [
    o.alerts.length ? `${o.alerts[0].name} is ${o.alerts[0].occupancyPct}% full; consider directing drivers to nearby lots.` : "No lot is above 85% full right now.",
    `${facts.upiSharePct}% of the last 24 h revenue (₹${facts.revenueInr}) came through UPI.`,
    `${o.sectors[0].sector} is the busiest area at ${o.sectors[0].occupancyPct}%; ${o.sectors.at(-1).sector} has the most spare room.`,
  ];
  if (!groq) return { insights: fallback(), source: "rules" };
  try {
    const out = await chatJson(
      "You write operations insights for Chandigarh's Municipal Corporation parking cell. Use ONLY the FACTS JSON. Give exactly 3 short, specific, actionable observations with numbers. Return JSON {\"insights\": string[]}.",
      `FACTS: ${JSON.stringify(facts)}`,
    );
    const list = Array.isArray(out.insights) ? out.insights.filter((x) => typeof x === "string").slice(0, 3) : [];
    return { insights: list.length ? list : fallback(), source: list.length ? "groq" : "rules" };
  } catch (e) {
    console.error("[insights] Groq failed, using rules:", e.message);
    return { insights: fallback(), source: "rules" };
  }
}
