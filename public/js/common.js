// Shared helpers for all Park'd pages: API calls, tokens, header + notification
// centre, live feed, toasts, maps and small illustrations.
// Each role keeps its own token, so the worker app, MC dashboard and driver
// pages can be open in the same browser at once.

const API = "/api";

export const tokens = {
  get: (role) => { try { return localStorage.getItem(`parkchd.${role}.token`); } catch { return null; } },
  set: (role, t) => { try { localStorage.setItem(`parkchd.${role}.token`, t); } catch {} },
  clear: (role) => { try { localStorage.removeItem(`parkchd.${role}.token`); localStorage.removeItem(`parkchd.${role}.user`); } catch {} },
  user: (role) => { try { return JSON.parse(localStorage.getItem(`parkchd.${role}.user`) || "null"); } catch { return null; } },
  setUser: (role, u) => { try { localStorage.setItem(`parkchd.${role}.user`, JSON.stringify(u)); } catch {} },
};

/** Calls the API. Throws an Error with .code and .message from the server on failure. */
export async function api(method, path, body, role) {
  const token = role ? tokens.get(role) : null;
  const res = await fetch(API + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  log(`${method} ${path.split("?")[0]} → ${res.status}${res.ok ? "" : ` ${data.code}`}`, res.ok ? "ok" : "err");
  if (!res.ok) {
    const e = new Error(data.message || `Request failed (${res.status})`);
    e.code = data.code; e.status = res.status;
    throw e;
  }
  return data;
}

/* ---------- live feed: shows every API call and socket event ---------- */
let feedEl = null;
export function attachFeed(el) { feedEl = el; }
export function log(text, kind = "") {
  if (!feedEl) return;
  const d = document.createElement("div");
  const t = document.createElement("span"); t.className = "t"; t.textContent = new Date().toLocaleTimeString();
  const m = document.createElement("span"); m.className = kind; m.textContent = text;
  d.append(t, m);
  feedEl.prepend(d);
  while (feedEl.childElementCount > 150) feedEl.lastChild.remove();
}

let socket = null;
/** Connects to Socket.io (served by the backend). Pass the role so the user gets their own notifications. */
export function live(handlers = {}, role) {
  if (!window.io) { log("Live updates unavailable (socket.io client not loaded)", "err"); return null; }
  if (!socket) {
    socket = window.io({ auth: role && tokens.get(role) ? { token: tokens.get(role) } : {} });
    socket.on("connect", () => log("Live updates connected", "ok"));
    socket.on("disconnect", () => log("Live updates disconnected", "err"));
    socket.on("lot:update", (s) => log(`lot:update ${s.lotId} → ${s.available} free / ${s.capacity}`, "ev"));
    socket.on("slot:update", (s) => log(`slot:update ${s._id} → ${s.state}`, "ev"));
    socket.on("zone:update", (z) => log(`zone:update ${z.zoneId}${z.status ? ` → ${z.status}` : ""}`, "ev"));
    socket.on("festival:update", (f) => log(`festival:update → ${f.active ? `ON (${f.activeZoneCount} zones, ${f.extraFree} extra spaces)` : "off"}`, "ev"));
    socket.on("overflow:new", (o) => log(`overflow:new ${o.lotName} at ${o.occupancyPct}%`, "ev"));
    socket.on("listing:update", (l) => log(`listing:update ${l.listingId}${l.status ? ` → ${l.status}` : ""}`, "ev"));
    socket.on("notification:new", (n) => log(`notification:new “${n.title}”`, "ev"));
  }
  const map = { lot: "lot:update", slot: "slot:update", zone: "zone:update", festival: "festival:update", overflow: "overflow:new", listing: "listing:update", notification: "notification:new" };
  for (const [k, ev] of Object.entries(map)) if (handlers[k]) socket.on(ev, handlers[k]);
  return socket;
}

/* ---------- small UI helpers ---------- */
let toastTimer;
export function toast(msg, err = false) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.append(el); }
  el.textContent = msg; el.classList.toggle("err", err); el.classList.remove("hidden");
  el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add("hidden"), err ? 4500 : 3000);
}

/** Runs an async action, shows its error as a toast, returns the result or undefined. */
export async function run(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
  catch (e) { toast(e.message, true); return undefined; }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const qs = (name) => new URLSearchParams(location.search).get(name);
export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const TZ = { timeZone: "Asia/Kolkata" };
export const time = (d) => new Date(d).toLocaleTimeString("en-IN", { ...TZ, hour: "numeric", minute: "2-digit" });
export const dateTime = (d) => new Date(d).toLocaleString("en-IN", { ...TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const dayLabel = (d) => new Date(d).toLocaleDateString("en-IN", { ...TZ, weekday: "short", day: "numeric", month: "short" });
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function istToday(offsetDays = 0) {
  const d = new Date(Date.now() + 5.5 * 3600000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}
export function hhmm12(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 || h === 24 ? "AM" : "PM"}`;
}
export function level(stats) {
  const share = stats.available / stats.capacity;
  if (stats.available === 0 || share < 0.08) return ["full", stats.available === 0 ? "Full" : "Nearly full"];
  if (share < 0.25) return ["warn", "Limited"];
  return ["ok", "Plenty"];
}
export function pill(stats) { const [c, l] = level(stats); return `<span class="pill ${c}">${stats.available} free · ${l}</span>`; }
export function duration(ms) { const m = Math.max(0, Math.floor(ms / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; }
const SPACE_TYPES = { driveway: "Driveway", "covered-garage": "Covered garage", "open-plot": "Open plot", stilt: "Stilt parking" };
export const spaceTypeLabel = (t) => SPACE_TYPES[t] ?? t;
export const sectorLabel = (s) => (/^\d+$/.test(String(s)) ? `Sector ${s}` : s);

/* ---------- login / guards ---------- */
export function loginPage({ role, endpoint, next }) {
  if (tokens.get(role)) { location.href = next; return; }
  const form = $("#login"), err = $("#error");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    const username = $("#username").value.trim(), pin = $("#pin").value.trim();
    if (!username || !/^\d{4}$/.test(pin)) { err.textContent = "Enter your ID and 4-digit PIN."; return; }
    try {
      const { token, user } = await api("POST", endpoint, { username, pin });
      tokens.set(role, token); tokens.setUser(role, user);
      location.href = next;
    } catch (e2) { err.textContent = e2.message; }
  });
}
export function guard(role, loginUrl) {
  if (!tokens.get(role)) { location.href = loginUrl; return false; }
  return true;
}
export function handleAuthError(e, role, loginUrl) {
  if (e?.status === 401 || e?.status === 403) { tokens.clear(role); location.href = loginUrl; return true; }
  return false;
}

/** Driver identity: reuse the saved token or create a quick test driver. */
export async function ensureDriver({ fresh = false } = {}) {
  if (!fresh && tokens.get("driver")) {
    try { const me = await api("GET", "/auth/me", null, "driver"); tokens.setUser("driver", me.user); return me.user; }
    catch { tokens.clear("driver"); }
  }
  const n = Math.floor(1000 + Math.random() * 9000);
  const { token, user } = await api("POST", "/auth/driver", { name: `Test Driver ${n}`, vehicleNo: `CH01 TD ${n}` });
  tokens.set("driver", token); tokens.setUser("driver", user);
  return user;
}
export async function driverPhoneLogin(phone) {
  const { token, user } = await api("POST", "/auth/driver", { phone });
  tokens.set("driver", token); tokens.setUser("driver", user);
  return user;
}

/* ---------- location (optional, stored on this device) ---------- */
export function savedLocation() { try { return JSON.parse(localStorage.getItem("parkd.loc") || "null"); } catch { return null; } }
export function askLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition((p) => {
      const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
      try { localStorage.setItem("parkd.loc", JSON.stringify(loc)); } catch {}
      resolve(loc);
    }, () => resolve(null), { timeout: 8000 });
  });
}

/* ---------- header with logo + notification centre ---------- */
const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';

/* ---------- icons (Lucide-style strokes, inline so no icon font is needed) ---------- */
const ICONS = {
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18.4 10.6 16 7H8L5.6 10.6 3.5 11.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  home: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2"/><path d="M16 7l3 3"/><path d="M18.5 4.5l2 2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  locate: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/>',
  parking: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><path d="M9 14h.01M15 14h.01"/>',
};
export const icon = (name, cls = "ico") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;

/* bottom navigation for the driver side on phones (animated active indicator) */
const NAV = [["/driver", "Park", "car"], ["/festival", "Festival", "sparkles"], ["/neighbourhood", "Nearby", "home"], ["/host", "Host", "key"]];
function mountBottomNav(active) {
  const i = NAV.findIndex(([href]) => href === active);
  if (i < 0) return;
  const nav = document.createElement("nav");
  nav.className = "bnav"; nav.setAttribute("aria-label", "Main");
  nav.innerHTML = `<span class="ind"></span>${NAV.map(([href, label, ic], n) => `<a href="${href}"${n === i ? ' aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`).join("")}`;
  document.body.append(nav);
  document.body.classList.add("has-bnav");
  const ind = nav.querySelector(".ind");
  let prev = i;
  try { prev = Number(sessionStorage.getItem("parkd.nav") ?? i); } catch {}
  ind.style.transform = `translateX(${prev * 100}%)`;
  requestAnimationFrame(() => requestAnimationFrame(() => { ind.style.transform = `translateX(${i * 100}%)`; }));
  try { sessionStorage.setItem("parkd.nav", String(i)); } catch {}
}

/**
 * Renders the shared header into <header id="top">.
 * opts: { role, label, mc, who, links: [{href, text}], onSignOut, nav: "/driver" | "/festival" | … }
 */
export function mountHeader(opts) {
  const el = $("#top");
  el.className = `topbar${opts.mc ? " mc" : ""}`;
  el.innerHTML = `
    <a class="brand" href="${opts.home || "/"}" aria-label="Park'd home"><img class="logo" src="/img/logo.png" alt="Park'd" /><span class="role">${esc(opts.label || "")}</span></a>
    <span class="who" id="who">${esc(opts.who || "")}</span>
    <div class="actions">
      ${(opts.links || []).map((l) => `<a class="btn small ${opts.mc ? "mc" : ""}" href="${l.href}">${esc(l.text)}</a>`).join("")}
      ${opts.role ? `<button class="bell" id="bell" type="button" aria-label="Notifications">${BELL}<span class="count hidden" id="bellCount">0</span></button>` : ""}
      ${opts.onSignOut ? `<button class="plain" id="signOut" type="button">Sign out</button>` : ""}
    </div>`;
  if (opts.onSignOut) $("#signOut").addEventListener("click", opts.onSignOut);
  if (opts.role) notificationCentre(opts.role);
  if (opts.nav) mountBottomNav(opts.nav);
}

export async function notificationCentre(role) {
  let items = [], unread = 0;
  const countEl = $("#bellCount");
  const paint = () => { countEl.textContent = unread > 9 ? "9+" : unread; countEl.classList.toggle("hidden", unread === 0); };
  const load = async () => {
    try { const r = await api("GET", "/notifications", null, role); items = r.items; unread = r.unread; paint(); } catch { /* not signed in yet */ }
  };
  await load();
  live({ notification: (n) => {
    items.unshift(n); unread++; paint(); toast(n.title);
    const b = $("#bell"); b.classList.remove("ring"); void b.offsetWidth; b.classList.add("ring");
  } }, role);
  $("#bell").addEventListener("click", () => openDrawer());

  function openDrawer() {
    const scrim = document.createElement("div"); scrim.className = "scrim";
    const d = document.createElement("aside"); d.className = "drawer"; d.setAttribute("aria-label", "Notifications");
    const render = () => {
      d.innerHTML = `<header><h2>Notifications</h2><button class="btn small" id="readAll" type="button">Mark all read</button><button class="btn small" id="closeDrawer" type="button" aria-label="Close">✕</button></header>
        <div class="items">${items.length ? items.map((n) => `
          <a class="note-item ${n.readAt ? "read" : ""}" href="${esc(n.link || "#")}" data-id="${esc(n._id)}">
            <span class="dot"></span>
            <span><div class="t">${esc(n.title)}</div><div class="b">${esc(n.body)}</div><div class="when">${dateTime(n.createdAt)}</div></span>
          </a>`).join("") : `<div class="empty">${emptyArt()}You're all caught up.</div>`}</div>`;
      d.querySelector("#closeDrawer").onclick = close;
      d.querySelector("#readAll").onclick = async () => { await run(() => api("POST", "/notifications/read-all", null, role)); items.forEach((n) => { n.readAt = n.readAt || new Date().toISOString(); }); unread = 0; paint(); render(); };
      d.querySelectorAll(".note-item").forEach((a) => a.addEventListener("click", async (e) => {
        const n = items.find((x) => x._id === a.dataset.id);
        if (n && !n.readAt) { e.preventDefault(); await api("POST", `/notifications/${n._id}/read`, null, role).catch(() => {}); n.readAt = new Date().toISOString(); unread = Math.max(0, unread - 1); paint(); location.href = a.getAttribute("href"); }
      }));
    };
    const close = () => { d.remove(); scrim.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    scrim.onclick = close; document.addEventListener("keydown", onKey);
    render();
    document.body.append(scrim, d);
    d.querySelector("#closeDrawer").focus();
  }
}

/* ---------- maps (Leaflet, served from /vendor/leaflet) ---------- */
export function makeMap(el, center = [30.7395, 76.7815], zoom = 14) {
  if (!window.L) { el.innerHTML = `<div class="empty">Map unavailable.</div>`; return null; }
  const map = window.L.map(el, { scrollWheelZoom: false, zoomAnimation: true, fadeAnimation: true, markerZoomAnimation: true }).setView(center, zoom);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  return map;
}
export function pinIcon(cls, text) {
  return window.L.divIcon({ className: "", html: `<div class="pin ${cls}">${esc(text)}</div>`, iconSize: [40, 40], iconAnchor: [20, 24] });
}
/**
 * Draws an animated straight-line guide from `from` to `to` (a lane-marked
 * line, not a road route; real turn-by-turn directions open in Google Maps).
 * Returns a layer you can remove.
 */
export function routeLine(map, from, to) {
  if (!map || !window.L || !from || !to) return null;
  const pts = [[from.lat, from.lng], [to.lat, to.lng]];
  const g = window.L.layerGroup([
    window.L.polyline(pts, { color: "#343B48", weight: 12, opacity: 0.95, lineCap: "round", className: "route-glow" }),
    window.L.polyline(pts, { color: "#3B82F6", weight: 4, opacity: 0.9, lineCap: "round", className: "route-glow" }),
    window.L.polyline(pts, { color: "#E8ECF2", weight: 2, dashArray: "8 10", opacity: 0.95, className: "route-lane" }),
  ]).addTo(map);
  g.getLayers()[2].bindTooltip("Straight-line guide · use Directions for the road route", { className: "route-tip", sticky: true });
  map.flyToBounds(window.L.latLngBounds(pts).pad(0.35), { maxZoom: 16, duration: 0.6 });
  return g;
}
export const directionsUrl = (lat, lng, mode = "driving") => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${mode}`;

/* ---------- Festival Mode banner (driver home + festival page) ---------- */
export function festivalBanner(f, { compact = false } = {}) {
  if (!f.active || !f.activeZoneCount) {
    return `<div class="mini">${groundArt()}<div><b>Planning a busy day?</b><span class="small muted">During festivals and big events, the Municipal Corporation can open extra temporary parking. You'll see it here, and get an alert if you searched nearby.</span></div></div>`;
  }
  const n = f.nearest;
  return `<section class="festival" aria-label="Festival Mode">
    ${lightsArt()}
    <div style="position:relative;max-width:640px">
      <span class="tag temp"><span class="alert-dot"></span>Festival Mode</span>
      <h2 style="margin-top:8px">${esc(f.label || "Extra parking open")} 🎉</h2>
      <p class="sub">The Municipal Corporation has opened temporary parking zones for today's crowds.</p>
      <div class="stats">
        <div class="stat"><b class="num" data-count="${f.activeZoneCount}">${f.activeZoneCount}</b><span>extra zone${f.activeZoneCount === 1 ? "" : "s"} open</span></div>
        <div class="stat"><b class="num" data-count="${f.extraFree}">${f.extraFree}</b><span>extra spaces free</span></div>
        ${n ? `<div class="stat"><b>${esc(sectorLabel(n.sector))}</b><span>nearest${n.distanceKm != null ? ` · ${n.distanceKm} km` : ""}</span></div>` : ""}
      </div>
      ${compact ? "" : `<div class="row">
        ${n ? `<a class="btn yellow" href="/zone?id=${encodeURIComponent(n._id)}">Find festival parking</a>` : ""}
        <a class="btn on-dark" href="/festival">View all extra parking</a>
      </div>`}
    </div>
  </section>`;
}

/* ---------- illustrations (inline SVG, no stock photos) ---------- */
export const lightsArt = () => `<svg class="lights" viewBox="0 0 220 120" aria-hidden="true"><path d="M0 18 Q55 60 110 22 T220 20" fill="none" stroke="#FFE38A" stroke-width="2"/>${[14, 40, 66, 92, 118, 144, 170, 196].map((x, i) => `<g><line x1="${x}" y1="${26 + (i % 2) * 8}" x2="${x}" y2="${36 + (i % 2) * 8}" stroke="#FFE38A" stroke-width="2"/><circle cx="${x}" cy="${44 + (i % 2) * 8}" r="7" fill="${["#F8CB46", "#FF8A5B", "#FFFFFF", "#7FE0A0"][i % 4]}"/></g>`).join("")}<path d="M150 112 q10 -30 20 0 z" fill="#F8CB46"/><circle cx="160" cy="80" r="6" fill="#FF8A5B"/></svg>`;
export const houseCarArt = () => `<svg viewBox="0 0 140 100" class="art" aria-hidden="true"><rect x="0" y="84" width="140" height="16" rx="4" fill="#343B48"/><path d="M6 92 h14 M30 92 h14 M54 92 h14 M78 92 h14 M102 92 h14 M126 92 h10" stroke="#E8ECF2" stroke-width="2" stroke-dasharray="0"/><path d="M12 52 L44 25 L76 52 Z" fill="#3B82F6"/><rect x="18" y="50" width="52" height="34" rx="3" fill="#E2E8F0"/><rect x="38" y="64" width="12" height="20" rx="2" fill="#1D2C46"/><rect x="24" y="57" width="9" height="9" rx="2" fill="#FACC15"/><rect x="55" y="57" width="9" height="9" rx="2" fill="#FACC15"/><rect x="80" y="60" width="54" height="18" rx="8" fill="#3B82F6"/><path d="M88 60 q8 -12 22 -12 h6 q8 0 12 12" fill="#2563EB"/><rect x="96" y="52" width="20" height="8" rx="2" fill="#BFDBFE"/><circle cx="92" cy="80" r="6" fill="#0B1220"/><circle cx="122" cy="80" r="6" fill="#0B1220"/><circle cx="92" cy="80" r="2.5" fill="#A7B1C2"/><circle cx="122" cy="80" r="2.5" fill="#A7B1C2"/></svg>`;
export const groundArt = () => `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="40" width="60" height="20" rx="6" fill="#343B48"/><path d="M6 50 h8 M20 50 h8 M34 50 h8 M48 50 h8" stroke="#E8ECF2" stroke-width="2"/><rect x="10" y="20" width="30" height="20" rx="3" fill="#1D2C46" stroke="#FACC15" stroke-width="2"/><path d="M8 22 L25 10 L42 22 Z" fill="#FACC15"/><line x1="50" y1="12" x2="50" y2="42" stroke="#A7B1C2" stroke-width="2"/><path d="M50 12 h10 l-3 4 l3 4 h-10 z" fill="#FACC15"/></svg>`;
export const emptyArt = () => `<svg viewBox="0 0 120 72" aria-hidden="true"><path d="M0 60 Q60 40 120 60 V72 H0 Z" fill="#343B48"/><path d="M8 64 Q60 48 112 64" fill="none" stroke="#E8ECF2" stroke-width="2" stroke-dasharray="7 7"/><rect x="38" y="30" width="44" height="18" rx="8" fill="#3B82F6"/><path d="M45 30 q7 -11 17 -11 h4 q8 0 12 11" fill="#2563EB"/><circle cx="49" cy="50" r="5.5" fill="#0B1220" stroke="#A7B1C2" stroke-width="2"/><circle cx="72" cy="50" r="5.5" fill="#0B1220" stroke="#A7B1C2" stroke-width="2"/><rect x="96" y="14" width="10" height="26" rx="4" fill="#111C30" stroke="#29364A"/><circle cx="101" cy="20" r="2.6" fill="#EF4444"/><circle cx="101" cy="27" r="2.6" fill="#FACC15"/><circle cx="101" cy="34" r="2.6" fill="#22C55E"/><line x1="101" y1="40" x2="101" y2="56" stroke="#A7B1C2" stroke-width="2"/></svg>`;
/** A curving city road with dashed lane markings, a car, a P sign and a traffic light (hero art). */
export const roadArt = () => `<svg class="road-art" viewBox="0 0 520 170" aria-hidden="true">
  <path d="M0 170 C120 150 170 92 300 86 S460 96 520 60 V170 Z" fill="#262C37"/>
  <path d="M-10 170 C110 146 170 104 300 98 S470 104 530 72" fill="none" stroke="#343B48" stroke-width="54" stroke-linecap="round"/>
  <path d="M-10 170 C110 146 170 104 300 98 S470 104 530 72" fill="none" stroke="#4A5263" stroke-width="58" stroke-linecap="round" opacity=".35"/>
  <path d="M-10 170 C110 146 170 104 300 98 S470 104 530 72" fill="none" stroke="#343B48" stroke-width="52" stroke-linecap="round"/>
  <path d="M-10 170 C110 146 170 104 300 98 S470 104 530 72" fill="none" stroke="#E8ECF2" stroke-width="3" stroke-dasharray="16 14"/>
  <g transform="translate(250 72)"><rect x="0" y="6" width="58" height="20" rx="9" fill="#22C55E"/><path d="M8 6 q9 -13 22 -13 h4 q10 0 15 13" fill="#16A34A"/><rect x="18" y="-4" width="18" height="8" rx="2" fill="#DCFCE7"/><circle cx="14" cy="27" r="6.5" fill="#0B1220" stroke="#A7B1C2" stroke-width="2"/><circle cx="45" cy="27" r="6.5" fill="#0B1220" stroke="#A7B1C2" stroke-width="2"/></g>
  <g transform="translate(440 6)"><line x1="10" y1="34" x2="10" y2="70" stroke="#A7B1C2" stroke-width="3"/><rect x="0" y="0" width="20" height="36" rx="5" fill="#111C30" stroke="#29364A"/><circle cx="10" cy="8" r="4" fill="#EF4444" opacity=".45"/><circle cx="10" cy="18" r="4" fill="#FACC15" opacity=".45"/><circle cx="10" cy="28" r="4" fill="#22C55E"/></g>
  <g transform="translate(150 40)"><line x1="12" y1="26" x2="12" y2="58" stroke="#A7B1C2" stroke-width="3"/><rect x="0" y="0" width="24" height="26" rx="5" fill="#2563EB"/><text x="12" y="19" text-anchor="middle" font-size="16" font-weight="800" fill="#fff" font-family="Plus Jakarta Sans, sans-serif">P</text></g>
</svg>`;
export const spaceArt = (type) => {
  const roof = type === "covered-garage" || type === "stilt";
  return `<svg viewBox="0 0 160 84" aria-hidden="true"><rect x="0" y="68" width="160" height="16" fill="#343B48"/><path d="M4 76 h12 M26 76 h12 M48 76 h12 M70 76 h12 M92 76 h12 M114 76 h12 M136 76 h12" stroke="#E8ECF2" stroke-width="2"/>${roof ? '<path d="M20 30 L80 8 L140 30 Z" fill="#3B82F6"/><rect x="26" y="30" width="6" height="38" fill="#A7B1C2"/><rect x="128" y="30" width="6" height="38" fill="#A7B1C2"/>' : '<rect x="10" y="40" width="30" height="28" rx="3" fill="#E2E8F0"/><path d="M6 42 L25 26 L44 42 Z" fill="#3B82F6"/><rect x="21" y="52" width="8" height="16" rx="1.5" fill="#1D2C46"/>'}<rect x="${roof ? 50 : 62}" y="48" width="60" height="18" rx="8" fill="${type === "open-plot" ? "#22C55E" : "#FACC15"}"/><circle cx="${roof ? 62 : 74}" cy="68" r="6" fill="#0B1220" stroke="#A7B1C2" stroke-width="2"/><circle cx="${roof ? 98 : 110}" cy="68" r="6" fill="#0B1220" stroke="#A7B1C2" stroke-width="2"/><rect x="138" y="10" width="16" height="16" rx="4" fill="#2563EB"/><text x="146" y="22" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" font-family="Plus Jakarta Sans, sans-serif">P</text></svg>`;
};

/* ---------- loading skeletons ---------- */
export const skeletonCards = (n = 3) => Array.from({ length: n }, () => '<div class="skel skel-card" aria-hidden="true"></div>').join("");
export const skeletonBlock = (h = 160) => `<div class="skel" style="height:${h}px" aria-busy="true" aria-label="Loading"></div>`;

/* ---------- motion helpers ---------- */
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
/** Animates every [data-count] number inside root from its previous value (or 0) up to the new one. */
export function countUp(root = document) {
  root.querySelectorAll("[data-count]").forEach((el) => {
    const to = Number(el.dataset.count); const from = Number(el.dataset.from ?? 0);
    if (!Number.isFinite(to)) return;
    const fmt = (v) => Math.round(v).toLocaleString("en-IN");
    if (reduced() || from === to) { el.textContent = (el.dataset.prefix ?? "") + fmt(to) + (el.dataset.suffix ?? ""); return; }
    const t0 = performance.now(), dur = 600;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); const e = 1 - (1 - k) ** 3; el.textContent = (el.dataset.prefix ?? "") + fmt(from + (to - from) * e) + (el.dataset.suffix ?? ""); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
/** Small "bump" when a live number changes. */
export function bump(el) { if (!el) return; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

/* soft fade between pages for same-site links */
document.addEventListener("click", (e) => {
  const a = e.target.closest?.("a[href]");
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank" || reduced()) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith("/api") || (url.pathname === location.pathname && url.hash)) return;
  e.preventDefault();
  document.body.classList.add("leaving");
  setTimeout(() => { location.href = url.href; }, 140);
});
window.addEventListener("pageshow", () => document.body.classList.remove("leaving"));

/* static markup can ask for an icon with <span data-icon="car"></span> */
document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon, el.dataset.iconClass || "ico"); });
