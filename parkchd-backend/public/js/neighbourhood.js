// Neighbourhood Parking discovery: filters, approximate-location map, listing cards.
import { $, api, askLocation, emptyArt, esc, houseCarArt, inr, istToday, live, makeMap, mountHeader, pinIcon, qs, savedLocation, sectorLabel, skeletonCards, spaceArt, spaceTypeLabel, tokens } from "./common.js";

const role = tokens.get("driver") ? "driver" : undefined;
mountHeader({ role, label: "Neighbourhood", nav: "/neighbourhood", links: [{ href: "/driver", text: "MC lots" }, { href: "/host", text: "Host" }] });
$("#art").innerHTML = houseCarArt().replace('class="art"', 'class="art" style="width:160px;height:116px"');


// time + duration pickers
for (let m = 6 * 60; m <= 22 * 60; m += 30) {
  const v = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  $("#start").insertAdjacentHTML("beforeend", `<option value="${v}">${v}</option>`);
}
for (const h of [1, 1.5, 2, 3, 4, 6, 8, 12]) $("#hours").insertAdjacentHTML("beforeend", `<option value="${h}">${h} h</option>`);
$("#date").min = istToday();
$("#date").value = qs("date") || "";

let loc = qs("lat") ? { lat: Number(qs("lat")), lng: Number(qs("lng")) } : null;
for (const k of ["q", "start", "hours", "maxPrice", "maxWalkMin", "vehicle"]) if (qs(k)) $(`#${k}`).value = qs(k);

const map = makeMap($("#map"));
let layer = null;

function params() {
  const p = new URLSearchParams();
  const q = $("#q").value.trim();
  if (q) p.set("q", q); else if (loc) { p.set("lat", loc.lat); p.set("lng", loc.lng); }
  for (const k of ["date", "start", "hours", "maxPrice", "maxWalkMin", "vehicle"]) if ($(`#${k}`).value) p.set(k, $(`#${k}`).value);
  if (p.get("start") && p.get("hours") && !p.get("date")) p.set("date", istToday());
  return p;
}

function card(l, p) {
  const link = new URLSearchParams();
  for (const k of ["q", "lat", "lng", "date", "start", "hours"]) if (p.get(k)) link.set(k, p.get(k));
  link.set("id", l._id);
  const win = l.availableOn?.windows?.map((w) => `${w.start}–${w.end}`).join(", ");
  return `<article class="lcard nb">
    <div class="art">${spaceArt(l.type)}</div>
    <div class="row" style="gap:6px"><span class="tag">${esc(spaceTypeLabel(l.type))}</span>${l.covered ? '<span class="tag blue">Covered</span>' : ""}${l.demo ? '<span class="tag demo">Demo</span>' : ""}${l.walkMinutes != null ? `<span class="tag green">🚶 ${l.walkMinutes} min</span>` : ""}</div>
    <h3>${esc(l.title)}</h3>
    <div class="meta"><span>${esc(sectorLabel(l.sector))}</span><span>${l.rating ? `★ ${l.rating.avg} (${l.rating.count})` : "New"}</span><span>${l.spaces} space${l.spaces === 1 ? "" : "s"}</span></div>
    <div class="small muted">${win ? `Available ${l.availableOn.date === istToday() ? "today" : l.availableOn.date} ${esc(win)}` : "Not available on this day"}</div>
    <div class="foot"><div class="price">${inr(l.ratePerHourInr)}<small> / hour</small></div><a class="btn primary small" href="/listing?${link}">View</a></div>
  </article>`;
}

async function search() {
  const p = params();
  history.replaceState(null, "", `?${p}`);
  $("#results").classList.remove("anim-in");
  $("#results").innerHTML = skeletonCards(2);
  const r = await api("GET", `/listings?${p}`).catch((e) => ({ listings: [], note: e.message }));
  $("#resultsTitle").textContent = r.place ? `Spaces near ${r.place.label}` : "Spaces in Chandigarh";
  void $("#results").offsetWidth; $("#results").classList.add("anim-in");
  $("#results").innerHTML = r.listings.length ? r.listings.map((l) => card(l, p)).join("") :
    `<div class="empty" style="grid-column:1/-1">${emptyArt()}${esc(r.note || "No spaces match. Try another time, a longer walk, or a nearby sector.")}</div>`;
  if (!map) return;
  layer?.remove();
  layer = window.L.layerGroup(r.listings.flatMap((l) => [
    window.L.circle([l.approxLat, l.approxLng], { radius: 150, color: "#3B82F6", weight: 1, fillOpacity: 0.12 }),
    window.L.marker([l.approxLat, l.approxLng], { icon: pinIcon("home", `₹${l.ratePerHourInr}`), title: l.title }).on("click", () => { location.href = `/listing?id=${l._id}`; }),
  ])).addTo(map);
  if (r.listings.length) map.fitBounds(window.L.latLngBounds(r.listings.map((l) => [l.approxLat, l.approxLng])).pad(0.3), { maxZoom: 15 });
}

$("#filters").addEventListener("submit", (e) => { e.preventDefault(); search(); });
["date", "start", "hours", "maxPrice", "maxWalkMin", "vehicle"].forEach((k) => $(`#${k}`).addEventListener("change", search));
$("#near").addEventListener("click", async () => {
  const p = await askLocation() ?? savedLocation();
  if (!p) return;
  loc = p; $("#q").value = ""; search();
});
live({ listing: () => search() }, role);
search();
