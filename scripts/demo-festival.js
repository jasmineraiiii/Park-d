// Stage helper for the Festival Mode demo.
//   npm run demo:festival                       → fills Sector 17 Multi-Level (open 24 h) to 95%
//   npm run demo:festival -- s8-inner           → another lot (must be open right now)
//   API_URL=https://your-app.onrender.com npm run demo:festival
// The cars are SIMULATED. The lot crosses its 90% threshold, the overflow check
// runs, and the MC dashboard shows a recommendation (or auto-opens a zone whose
// pre-approved policy allows it). Set DEMO_TOOLS=false on the server to disable.

const BASE = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
const lotId = process.argv[2] || "s17-ml";
const username = process.env.MC_USER || "mc-admin";
const pin = process.env.MC_PIN || "2026";

const call = async (method, path, body, token) => {
  const res = await fetch(`${BASE}/api${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${data.code ?? res.status}: ${data.message ?? "request failed"}`);
  return data;
};

try {
  const { token } = await call("POST", "/auth/admin", { username, pin });
  const r = await call("POST", "/admin/demo/fill", { lotId, targetPct: 95 }, token);
  console.log(`Filled ${r.filled} slots at ${lotId} with simulated cars.`);
  if (!r.overflow) console.log("No new overflow event (the lot may already have alerted, or isn't over its threshold).");
  else if (r.overflow.status === "auto-activated") console.log(`Overflow at ${r.overflow.occupancyPct}%: zone opened automatically (pre-approved policy).`);
  else if (r.overflow.status === "pending") console.log(`Overflow at ${r.overflow.occupancyPct}%: recommendation waiting in the MC dashboard → /mc/dashboard#festival (zone: ${r.overflow.recommendedZoneIds.join(", ")}).`);
  else console.log(`Overflow at ${r.overflow.occupancyPct}%: ${r.overflow.note ?? r.overflow.status}`);
} catch (e) {
  console.error("demo:festival failed:", e.message);
  process.exit(1);
}
