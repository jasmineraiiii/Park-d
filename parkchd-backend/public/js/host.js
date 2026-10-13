// Host dashboard: listings (status, pause, edit, delete), bookings and demo earnings.
import { $, api, dateTime, driverPhoneLogin, emptyArt, ensureDriver, esc, houseCarArt, inr, live, mountHeader, run, sectorLabel, spaceArt, spaceTypeLabel, toast } from "./common.js";

const ROLE = "driver";
const call = (m, p, b) => api(m, p, b, ROLE);
$("#art").innerHTML = houseCarArt();
const STATUS = { pending: ["Waiting for MC review", ""], active: ["Live", "green"], paused: ["Paused", ""], rejected: ["Not approved", "red"], suspended: ["Suspended by MC", "red"] };
const BSTATUS = { confirmed: "Confirmed", completed: "Completed", "cancelled-by-driver": "Cancelled by driver", "cancelled-by-host": "Cancelled by you", "no-show": "No-show" };

$("#phoneForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const phone = $("#phone").value.trim();
  if (!/^\d{10}$/.test(phone)) { toast("Enter a 10-digit phone number.", true); return; }
  if (await run(() => driverPhoneLogin(phone))) location.reload();
});

async function load() {
  const [{ listings }, bk] = await Promise.all([call("GET", "/host/listings"), call("GET", "/host/bookings")]);
  const upcoming = bk.bookings.filter((b) => b.status === "confirmed" && new Date(b.end) > Date.now());
  $("#kpis").innerHTML = `
    <div class="kpi"><div class="label">Earnings (demo)</div><div class="value">${inr(bk.earningsInr)}</div><div class="sub">${esc(bk.note)}</div></div>
    <div class="kpi"><div class="label">Live listings</div><div class="value">${listings.filter((l) => l.status === "active").length}</div><div class="sub">${listings.length} total</div></div>
    <div class="kpi"><div class="label">Upcoming bookings</div><div class="value">${upcoming.length}</div><div class="sub">${bk.bookings.length} all time</div></div>`;

  $("#listings").innerHTML = listings.length ? listings.map((l) => {
    const [label, tone] = STATUS[l.status] ?? [l.status, ""];
    return `<article class="lcard nb" data-id="${esc(l._id)}">
      <div class="art">${spaceArt(l.type)}</div>
      <div class="row" style="gap:6px"><span class="tag ${tone}">${esc(label)}</span><span class="tag">${esc(spaceTypeLabel(l.type))}</span>${l.demo ? '<span class="tag demo">Demo</span>' : ""}</div>
      <h3>${esc(l.title)}</h3>
      <div class="meta"><span>${esc(sectorLabel(l.sector))}</span><span>${inr(l.ratePerHourInr)}/h</span><span>${l.spaces} space${l.spaces === 1 ? "" : "s"}</span><span>${l.rating ? `★ ${l.rating.avg}` : `${l.reviewCount} review${l.reviewCount === 1 ? "" : "s"}`}</span></div>
      ${l.statusNote ? `<div class="notice ${tone === "red" ? "red" : "grey"} small">${esc(l.statusNote)}</div>` : ""}
      <div class="foot">
        ${l.status === "active" ? `<button class="btn small" data-act="pause" type="button">Pause</button>` : l.status === "paused" ? `<button class="btn small primary" data-act="resume" type="button">Resume</button>` : ""}
        ${["rejected", "suspended"].includes(l.status) ? "" : `<a class="btn small" href="/host-new?id=${encodeURIComponent(l._id)}">Edit</a>`}
        <button class="btn small danger" data-act="delete" type="button">Delete</button>
      </div>
    </article>`;
  }).join("") : `<div class="empty" style="grid-column:1/-1">${emptyArt()}No spaces yet. <a href="/host-new">List your first space</a></div>`;

  $("#bookings").innerHTML = bk.bookings.length ? `<thead><tr><th>Booking</th><th>Space</th><th>When</th><th>Driver</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>` +
    bk.bookings.map((b) => `<tr><td><a href="/booking?id=${esc(b._id)}">${esc(b._id)}</a></td><td>${esc(b.title)}</td><td>${dateTime(b.start)} · ${b.hours} h</td><td>${esc(b.driverFirstName ?? "Driver")}${b.vehicleNo ? ` · ${esc(b.vehicleNo)}` : ""}</td><td class="num">${inr(b.totalInr)}${b.refundInr ? ` <span class="small muted">(refunded ${inr(b.refundInr)})</span>` : ""}</td><td>${esc(BSTATUS[b.status] ?? b.status)}</td>
      <td>${b.status === "confirmed" && new Date(b.end) > Date.now() ? `<button class="btn small danger" data-cancel="${esc(b._id)}" type="button">Cancel</button>` : ""}</td></tr>`).join("") + "</tbody>"
    : `<tbody><tr><td class="muted">No bookings yet.</td></tr></tbody>`;
}

$("#listings").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]"); if (!btn) return;
  const id = btn.closest("[data-id]").dataset.id;
  const act = btn.dataset.act;
  if (act === "delete" && !window.confirm("Delete this listing? This can't be undone.")) return;
  const ok = act === "delete" ? await run(() => call("DELETE", `/host/listings/${id}`), "Listing deleted")
    : await run(() => call("PATCH", `/host/listings/${id}`, { status: act === "pause" ? "paused" : "active" }), act === "pause" ? "Paused: drivers can't book it" : "Live again");
  if (ok) load();
});
$("#bookings").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-cancel]"); if (!btn) return;
  if (!window.confirm("Cancel this booking? The driver gets a full refund.")) return;
  if (await run(() => call("POST", `/host/bookings/${btn.dataset.cancel}/cancel`), "Booking cancelled. Driver refunded (demo).")) load();
});

(async () => {
  const user = await ensureDriver().catch(() => null);
  mountHeader({ role: ROLE, label: "Host", who: user?.name, nav: "/host", links: [{ href: "/neighbourhood", text: "Browse spaces" }, { href: "/driver", text: "Driver" }] });
  $("#whoami").textContent = user ? `Signed in as ${user.name}${user.phone ? ` (${user.phone})` : " (test driver; sign in with a phone to keep your listings)"}.` : "";
  live({ notification: () => load(), listing: () => load() }, ROLE);
  try { await load(); } catch (e) { toast(e.message, true); }
})();
