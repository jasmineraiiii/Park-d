// Host wizard: create a listing (goes to MC review) or edit one (?id=).
import { $, api, ensureDriver, esc, hhmm12, inr, makeMap, mountHeader, pinIcon, qs, run, sectorLabel, spaceTypeLabel, toast } from "./common.js";

const ROLE = "driver";
const editId = qs("id");
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LABELS = ["Step 1 of 4 · The space", "Step 2 of 4 · Location and privacy", "Step 3 of 4 · Hours and price", "Step 4 of 4 · Check and submit"];
let step = 1;
let pin = null;
let marker = null;
let windows = [{ days: [0, 1, 2, 3, 4, 5, 6], start: "09:00", end: "18:00" }];

/* chips */
function chipGroup(el, multi) {
  el.addEventListener("click", (e) => {
    const c = e.target.closest(".chip"); if (!c) return;
    if (multi) c.setAttribute("aria-pressed", String(c.getAttribute("aria-pressed") !== "true"));
    else el.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
  });
}
chipGroup($("#f-type"), false);
chipGroup($("#f-fit"), true);
const chipValues = (el) => [...el.querySelectorAll('.chip[aria-pressed="true"]')].map((c) => c.dataset.v);
const setChips = (el, vals) => el.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(vals.includes(c.dataset.v))));

/* map pin */
const map = makeMap($("#pickMap"), [30.7395, 76.7815], 13);
function setPin(lat, lng) {
  pin = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
  if (map) { marker?.remove(); marker = window.L.marker([pin.lat, pin.lng], { icon: pinIcon("home", "P") }).addTo(map); }
  $("#pinInfo").textContent = `Pin placed at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}. Only you and the MC see the exact spot.`;
}
map?.on("click", (e) => setPin(e.latlng.lat, e.latlng.lng));

/* availability windows */
const times = []; for (let m = 0; m <= 24 * 60; m += 30) times.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
const timeSelect = (cls, val, from = 0) => `<select class="input ${cls}">${times.slice(from).map((t) => `<option value="${t}" ${t === val ? "selected" : ""}>${t === "24:00" ? "Midnight" : hhmm12(t)}</option>`).join("")}</select>`;
function renderWindows() {
  $("#windows").innerHTML = windows.map((w, i) => `
    <div class="card" style="padding:12px;box-shadow:none" data-i="${i}">
      <div class="chips">${DAYS.map((d, n) => `<button type="button" class="chip" data-day="${n}" aria-pressed="${w.days.includes(n)}">${d}</button>`).join("")}</div>
      <div class="row" style="margin-top:8px">${timeSelect("ws", w.start)}<span>to</span>${timeSelect("we", w.end, 1)}${windows.length > 1 ? `<button class="btn small danger" type="button" data-rm="${i}">Remove</button>` : ""}</div>
    </div>`).join("");
}
$("#windows").addEventListener("click", (e) => {
  const box = e.target.closest("[data-i]"); if (!box) return;
  const w = windows[box.dataset.i];
  const d = e.target.closest("[data-day]");
  if (d) { const n = Number(d.dataset.day); w.days = w.days.includes(n) ? w.days.filter((x) => x !== n) : [...w.days, n].sort(); d.setAttribute("aria-pressed", String(w.days.includes(n))); }
  if (e.target.closest("[data-rm]")) { windows.splice(Number(box.dataset.i), 1); renderWindows(); }
});
$("#windows").addEventListener("change", (e) => {
  const box = e.target.closest("[data-i]"); if (!box) return;
  const w = windows[box.dataset.i];
  if (e.target.classList.contains("ws")) w.start = e.target.value;
  if (e.target.classList.contains("we")) w.end = e.target.value;
});
$("#addWin").addEventListener("click", () => { if (windows.length < 7) { windows.push({ days: [6, 0], start: "10:00", end: "20:00" }); renderWindows(); } });

/* collect + validate */
const v = (id) => $(`#f-${id}`).value.trim();
function collect() {
  return {
    title: v("title"), type: chipValues($("#f-type"))[0], spaces: Number(v("spaces")), covered: v("covered") === "true",
    vehicleFit: chipValues($("#f-fit")), dimensions: v("dimensions"), surface: v("surface"), entranceWidth: v("entranceWidth"), clearance: v("clearance"),
    sector: v("sector").replace(/^sector\s*/i, ""), landmark: v("landmark"), exactAddress: v("exactAddress"), accessInstructions: v("accessInstructions"),
    ...(pin ?? {}),
    ratePerHourInr: Number(v("rate")), availability: windows.filter((w) => w.days.length).map((w) => ({ ...w })),
    blockedDates: v("blocked").split(/[,\s]+/).filter(Boolean), rules: v("rules"),
  };
}
function problem(n) {
  const d = collect();
  if (n === 1) {
    if (d.title.length < 6) return "Give the space a short title (at least 6 characters).";
    if (!d.type) return "Pick a space type.";
    if (!Number.isInteger(d.spaces) || d.spaces < 1 || d.spaces > 10) return "Spaces must be 1 to 10.";
    if (!d.vehicleFit.length) return "Pick at least one vehicle that fits.";
  }
  if (n === 2) {
    if (!d.sector) return "Enter the sector.";
    if (!pin) return "Tap the map to place your pin.";
    if (d.exactAddress.length < 6) return "Enter the exact address (only shared near booking time).";
  }
  if (n === 3) {
    if (!Number.isInteger(d.ratePerHourInr) || d.ratePerHourInr < 1 || d.ratePerHourInr > 1000) return "Price must be a whole number of rupees, 1 to 1000.";
    if (!d.availability.length) return "Pick at least one day.";
    if (d.availability.some((w) => w.end <= w.start)) return "Each window must end after it starts.";
  }
  return null;
}

function summary() {
  const d = collect();
  $("#summary").innerHTML = `<dl class="kv">
    <dt>Title</dt><dd>${esc(d.title)}</dd><dt>Type</dt><dd>${esc(spaceTypeLabel(d.type))}${d.covered ? ", covered" : ""} · ${d.spaces} space(s)</dd>
    <dt>Fits</dt><dd>${esc(d.vehicleFit.join(", "))}</dd><dt>Where</dt><dd>${esc(sectorLabel(d.sector))}${d.landmark ? ` · near ${esc(d.landmark)}` : ""}</dd>
    <dt>Address</dt><dd>${esc(d.exactAddress)} <span class="small muted">(private)</span></dd><dt>Price</dt><dd>${inr(d.ratePerHourInr)} per hour</dd>
    <dt>Hours</dt><dd>${d.availability.map((w) => `${w.days.length === 7 ? "Every day" : w.days.map((n) => DAYS[n]).join(", ")} ${hhmm12(w.start)}–${hhmm12(w.end)}`).map(esc).join("<br>")}</dd>
  </dl>`;
}

function show() {
  document.querySelectorAll("[data-step]").forEach((s) => s.classList.toggle("hidden", Number(s.dataset.step) !== step));
  document.querySelectorAll("#steps span").forEach((s, i) => s.classList.toggle("on", i < step));
  $("#stepLabel").textContent = LABELS[step - 1];
  $("#prev").classList.toggle("hidden", step === 1);
  $("#next").textContent = step === 4 ? (editId ? "Save changes" : "Submit for review") : "Next";
  if (step === 2 && map) setTimeout(() => map.invalidateSize(), 50);
  if (step === 4) summary();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$("#prev").addEventListener("click", () => { step = Math.max(1, step - 1); show(); });
$("#next").addEventListener("click", async () => {
  if (step < 4) { const p = problem(step); if (p) { toast(p, true); return; } step++; show(); return; }
  for (const n of [1, 2, 3]) { const p = problem(n); if (p) { step = n; show(); toast(p, true); return; } }
  const body = collect();
  if (editId) {
    if (await run(() => api("PATCH", `/host/listings/${editId}`, body, ROLE), "Changes saved")) location.href = "/host";
    return;
  }
  if (!$("#f-declaration").checked) { toast("Please confirm the declaration.", true); return; }
  if (await run(() => api("POST", "/host/listings", { ...body, declaration: true }, ROLE), "Submitted. The MC will review it.")) location.href = "/host";
});

(async () => {
  const user = await ensureDriver().catch(() => null);
  mountHeader({ role: ROLE, label: "Host", who: user?.name, nav: "/host", links: [{ href: "/host", text: "Your spaces" }] });
  if (editId) {
    const { listings } = await api("GET", "/host/listings", null, ROLE);
    const l = listings.find((x) => x._id === editId);
    if (!l) { toast("Listing not found.", true); return; }
    $("#title").textContent = "Edit space";
    $("#declBox").classList.add("hidden");
    for (const k of ["title", "spaces", "dimensions", "surface", "entranceWidth", "clearance", "sector", "landmark", "exactAddress", "accessInstructions", "rules"]) if (l[k] != null) $(`#f-${k}`).value = l[k];
    $("#f-covered").value = String(Boolean(l.covered));
    $("#f-rate").value = l.ratePerHourInr;
    $("#f-blocked").value = (l.blockedDates ?? []).join(", ");
    setChips($("#f-type"), [l.type]); setChips($("#f-fit"), l.vehicleFit);
    windows = l.availability.map((w) => ({ days: [...w.days], start: w.start, end: w.end }));
    if (l.exactLat) { setPin(l.exactLat, l.exactLng); map?.setView([l.exactLat, l.exactLng], 16); }
  }
  renderWindows();
  show();
})();
