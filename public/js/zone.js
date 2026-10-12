// One temporary zone: live spaces, gates, rules, accessibility, directions.
import { $, api, dateTime, directionsUrl, emptyArt, esc, inr, live, makeMap, mountHeader, pill, pinIcon, qs, sectorLabel, tokens } from "./common.js";

const id = qs("id");
const role = tokens.get("driver") ? "driver" : undefined;
mountHeader({ role, label: "Festival parking", nav: "/festival", links: [{ href: "/driver", text: "Find parking" }] });
let map = null;

async function load() {
  let z;
  try { z = (await api("GET", `/zones/${encodeURIComponent(id ?? "")}`)).zone; }
  catch { $("#zone").className = "grid anim-in";
  $("#zone").innerHTML = `<div class="empty">${emptyArt()}This temporary zone doesn't exist.</div>`; return; }
  const open = z.zone.status === "active" && z.stats.open;
  const info = z.zone;
  $("#zone").innerHTML = `
    <section class="card" style="border-color:var(--yellow-line);background:linear-gradient(180deg,rgba(250,204,21,.08),var(--card) 60%)">
      <div class="row" style="gap:6px"><span class="tag temp">Temporary zone</span>${info.demo ? '<span class="tag demo">Demo site · not verified</span>' : ""}</div>
      <h1 style="margin:10px 0 4px">${esc(z.name)}</h1>
      <p class="muted">${esc(z.address)} · ${esc(sectorLabel(z.sector))}</p>
      <div class="row" style="margin:14px 0">
        ${open ? `<div class="big-count" style="font-size:44px;font-weight:800;color:var(--yellow);line-height:1">${z.stats.available}</div><div><div style="font-weight:800">spaces free</div><span class="small muted num">${z.stats.occupied} parked of ${z.capacity}</span></div><span style="margin-left:auto">${pill(z.stats)}</span>` : `<span class="pill full">Not open right now</span>`}
      </div>
      ${open ? "" : `<div class="notice grey">This zone only opens when the Municipal Corporation activates it for an event. ${info.status === "closed" ? "It has been closed." : ""}</div>`}
      <div class="row" style="margin-top:12px">
        <a class="btn primary big" target="_blank" rel="noopener" href="${directionsUrl(z.lat, z.lng)}">Get directions ↗</a>
        ${open ? `<a class="btn big" href="/driver?lot=${encodeURIComponent(z._id)}">Reserve or check in</a>` : ""}
      </div>
    </section>
    <div class="map short" id="zmap"></div>
    <section class="card">
      <h2>Before you go</h2>
      <dl class="kv">
        <dt>Fee</dt><dd>${inr(z.feeInr)} per visit, paid to the attendant (cash or UPI)</dd>
        <dt>Vehicles</dt><dd>${esc((info.vehicles ?? []).join(", ") || "—")}</dd>
        <dt>Entry gates</dt><dd>${esc((info.entryPoints ?? []).join(" · ") || "Follow signs")}</dd>
        <dt>Open</dt><dd>${info.startsAt ? `${dateTime(info.startsAt)} – ${dateTime(info.endsAt)}` : "During the event"}</dd>
        <dt>Rules</dt><dd>${esc(info.restrictions || "Follow the attendant's directions.")}</dd>
        <dt>Accessibility</dt><dd>${esc(info.accessibility || "Ask the attendant at the gate.")}</dd>
        ${info.contact ? `<dt>Contact</dt><dd>${esc(info.contact)}</dd>` : ""}
      </dl>
    </section>
    <section class="card" id="alts"><h2>Other parking nearby</h2><p class="muted small">Loading…</p></section>`;
  map = makeMap($("#zmap"), [z.lat, z.lng], 16);
  if (map) window.L.marker([z.lat, z.lng], { icon: pinIcon(open ? "temp recommend" : "temp", open ? `+${z.stats.available}` : "P") }).addTo(map);
  const r = await api("GET", `/alternatives?lat=${z.lat}&lng=${z.lng}`).catch(() => null);
  const alts = (r?.suggestions ?? []).filter((a) => a._id !== z._id);
  $("#alts").innerHTML = `<h2>Other parking nearby</h2>${alts.length ? `<ul class="list">${alts.map((a) => `<li><a href="${a.kind === "temporary" ? `/zone?id=${encodeURIComponent(a._id)}` : `/driver?lot=${encodeURIComponent(a._id)}`}">${esc(a.name)}</a> ${a.kind === "temporary" ? '<span class="tag temp">Temporary</span>' : ""}<span class="time">${a.stats.available} free · ${a.distanceKm} km</span></li>`).join("")}</ul><p class="small muted" style="margin-top:6px">${esc(r.note)}</p>` : `<p class="muted small">No other open parking within 4 km.</p>`}`;
}
let t;
const again = () => { clearTimeout(t); t = setTimeout(() => { map?.remove(); load(); }, 400); };
live({ zone: (u) => { if (u.zoneId === id) again(); }, lot: (s) => { if (s.lotId === id) again(); } }, role);
load();
