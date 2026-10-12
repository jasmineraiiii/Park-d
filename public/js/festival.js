// All active temporary zones (Festival Mode), with a map.
import { $, api, countUp, directionsUrl, emptyArt, esc, festivalBanner, inr, live, makeMap, mountHeader, pill, pinIcon, savedLocation, sectorLabel, tokens } from "./common.js";

const role = tokens.get("driver") ? "driver" : undefined;
mountHeader({ role, label: "Festival parking", nav: "/festival", links: [{ href: "/driver", text: "Find parking" }] });
const map = makeMap($("#map"));
let layer = null;

export function zoneCard(z) {
  return `<article class="lcard temp">
    <div class="row" style="gap:6px"><span class="tag temp">Temporary</span>${z.zone?.demo ? '<span class="tag demo">Demo site</span>' : ""}${z.distanceKm != null ? `<span class="tag blue">${z.distanceKm} km</span>` : ""}</div>
    <h3>${esc(z.name)}</h3>
    <div class="meta"><span>${esc(sectorLabel(z.sector))}</span><span>${inr(z.feeInr)} / visit</span><span>${(z.zone?.vehicles ?? []).join(", ")}</span></div>
    <div class="row" style="align-items:flex-end"><div class="big-count" style="color:var(--yellow)">${z.stats.available}<small>extra spaces free</small></div><span style="margin-left:auto">${pill(z.stats)}</span></div>
    ${z.zone?.endsAt ? `<div class="small muted">Open until ${new Date(z.zone.endsAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div>` : ""}
    <div class="foot"><a class="btn small primary" href="/zone?id=${encodeURIComponent(z._id)}">Details</a><a class="btn small" target="_blank" rel="noopener" href="${directionsUrl(z.lat, z.lng)}">Directions ↗</a></div>
  </article>`;
}

async function load() {
  const loc = savedLocation();
  const f = await api("GET", `/festival${loc ? `?lat=${loc.lat}&lng=${loc.lng}` : ""}`);
  $("#banner").innerHTML = festivalBanner(f, { compact: true });
  countUp($("#banner"));
  $("#count").textContent = f.zones.length ? `${f.zones.length} open · ${f.extraFree} spaces free` : "";
  $("#zones").classList.add("anim-in");
  $("#zones").innerHTML = f.zones.length ? f.zones.map(zoneCard).join("") : `<div class="empty" style="grid-column:1/-1">${emptyArt()}No temporary zones are open right now.<br><a href="/driver">See regular parking lots</a></div>`;
  if (!map) return;
  layer?.remove();
  layer = window.L.layerGroup(f.zones.map((z) => window.L.marker([z.lat, z.lng], { icon: pinIcon("temp", `+${z.stats.available}`), title: z.name }).on("click", () => { location.href = `/zone?id=${encodeURIComponent(z._id)}`; }))).addTo(map);
  if (f.zones.length) map.fitBounds(window.L.latLngBounds(f.zones.map((z) => [z.lat, z.lng])).pad(0.3), { maxZoom: 15 });
}
let t;
const again = () => { clearTimeout(t); t = setTimeout(load, 400); };
live({ festival: again, zone: again, lot: (s) => { if (s.kind === "temporary") again(); } }, role);
load();
