import { $, api, mountHeader, roadArt } from "./common.js";

mountHeader({ label: "Chandigarh", links: [{ href: "/driver", text: "Find parking" }] });
$("#heroArt").innerHTML = roadArt();

try {
  const [h, f] = await Promise.all([api("GET", "/health"), api("GET", "/festival")]);
  $("#status").textContent = `API running · AI assistant: ${h.ai ? "GroqCloud connected" : "rules fallback (no GROQ_API_KEY)"} · Festival Mode: ${f.active ? `on, ${f.activeZoneCount} extra zone(s)` : "off"} · server time ${new Date(h.time).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}`;
} catch (e) {
  $("#status").textContent = `API not reachable: ${e.message}`;
}
