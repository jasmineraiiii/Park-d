// End-to-end check of the whole API against a running server.
//   npm run smoke                                   (server on localhost:4000)
//   API_URL=https://your-app.onrender.com npm run smoke
// It creates test drivers and bookings and cleans up after itself, but run
// `npm run seed` again before your demo to start from fresh data.

import { io } from "socket.io-client";

const BASE = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
let passed = 0, failed = 0;

async function call(method, path, body, token) {
  const res = await fetch(`${BASE}/api${path}`, {
    method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${extra}`); }
}
const newDriver = async (n) => (await call("POST", "/auth/driver", { name: `Smoke ${n}`, vehicleNo: `CH01 T ${n}` })).data.token;

(async () => {
  console.log(`Park'd smoke test → ${BASE}\n`);

  console.log("Public");
  const h = await call("GET", "/health");
  check("health ok", h.status === 200 && h.data.ok, JSON.stringify(h.data));
  const lots = await call("GET", "/lots");
  check("17 regular lots with stats", lots.data.lots?.filter((l) => l.kind !== "temporary").length === 17 && lots.data.lots[0].stats);
  // a lot that is open right now (some close at night), preferring Sector 9 market
  const openLots = lots.data.lots.filter((l) => l.kind !== "temporary" && l.stats.open && l.stats.reservableFree >= 2 && l.stats.available - l.stats.reservableFree >= 3);
  const lotId = (openLots.find((l) => l._id === "s9-market") ?? openLots.find((l) => l._id !== "s17-ml") ?? openLots[0])._id;
  console.log(`    (testing reservations at ${lotId})`);
  const detail = await call("GET", `/lots/${lotId}`);
  check("lot detail with numbered slots", detail.data.slots?.length === detail.data.lot?.capacity && detail.data.slots[0].number === "P01");
  const reservable = detail.data.slots.filter((s) => s.kind === "reservable");
  check("reservation pool is 10% of capacity", reservable.length === Math.floor(detail.data.lot.capacity * 0.1));
  const s = await call("GET", "/search?q=sec%2022");
  check("search 'sec 22' finds Sector 22 lots", s.data.place?.label === "Sector 22" && s.data.lots.length >= 2);
  const s2 = await call("GET", "/search?q=elante");
  check("search 'elante' finds the mall", s2.data.place?.label === "Elante Mall");
  const a = await call("POST", "/assistant", { message: "Is there parking in sector 17 right now?" });
  check(`assistant answers (${a.data.source})`, typeof a.data.reply === "string" && a.data.reply.length > 0, JSON.stringify(a.data));
  console.log(`    → "${a.data.reply}"`);

  console.log("\nLive updates");
  const sock = io(BASE, { transports: ["websocket"] });
  const updates = [];
  sock.on("lot:update", (u) => updates.push(u));
  await new Promise((r) => sock.on("connect", r));
  check("socket connected", sock.connected);

  console.log("\nReservation flow");
  const d1 = await newDriver(1), d2 = await newDriver(2);
  const free = reservable.find((x) => x.state === "available");
  // two drivers try the SAME slot at the same moment
  const [r1, r2] = await Promise.all([
    call("POST", "/reservations", { lotId, slotId: free._id }, d1),
    call("POST", "/reservations", { lotId, slotId: free._id }, d2),
  ]);
  const wins = [r1, r2].filter((r) => r.status === 201);
  check("double booking blocked (exactly one wins)", wins.length === 1, `${r1.status} ${r2.status}`);
  const [winTok, loseTok] = r1.status === 201 ? [d1, d2] : [d2, d1];
  const booking = wins[0].data.reservation;
  check("booking id looks like PK-XXXXXX", /^PK-[A-Z2-9]{6}$/.test(booking._id));
  const again = await call("POST", "/reservations", { lotId }, winTok);
  check("one active booking per driver", again.status === 409 && again.data.code === "already-active");
  const early = await call("POST", `/reservations/${booking._id}/check-in`, null, winTok);
  check("can't check in before paying", early.status === 409);
  const pay = await call("POST", `/reservations/${booking._id}/pay`, { upiApp: "PhonePe" }, winTok);
  check("pay reservation (demo UPI)", pay.status === 200 && pay.data.reservation.status === "held" && pay.data.payment.simulated === true);
  const payAgain = await call("POST", `/reservations/${booking._id}/pay`, { upiApp: "PhonePe" }, winTok);
  check("can't pay twice", payAgain.status === 409);
  const other = await call("GET", `/reservations/${booking._id}`, null, loseTok);
  check("other drivers can't see your booking", other.status === 404);
  const ci = await call("POST", `/reservations/${booking._id}/check-in`, null, winTok);
  check("check in → slot occupied", ci.status === 200 && ci.data.session.status === "active");
  const act = await call("GET", "/me/activity", null, winTok);
  check("Find My Car shows the slot", act.data.activeSession?.slotNumber === booking.slotNumber);
  const end = await call("POST", `/sessions/${ci.data.session._id}/end`, null, winTok);
  check("leave lot (reservation fee covers entry)", end.status === 200);

  console.log("\n10% cap");
  const capLot = (openLots.find((l) => l._id === "s11-market") ?? openLots.find((l) => l._id !== lotId && l._id !== "s17-ml") ?? openLots.find((l) => l._id !== lotId))._id;
  const capDetail = (await call("GET", `/lots/${capLot}`)).data;
  const poolFree = capDetail.slots.filter((x) => x.kind === "reservable" && x.state === "available").length;
  const tokens = await Promise.all(Array.from({ length: poolFree + 1 }, (_, i) => newDriver(100 + i)));
  const results = await Promise.all(tokens.map((t) => call("POST", "/reservations", { lotId: capLot }, t)));
  const ok = results.filter((r) => r.status === 201);
  check(`only ${poolFree} of ${poolFree + 1} drivers can reserve`, ok.length === poolFree && results.some((r) => r.data.code === "limit-reached"), results.map((r) => r.status).join(","));
  await Promise.all(ok.map((r, i) => call("POST", `/reservations/${r.data.reservation._id}/cancel`, null, tokens[results.indexOf(r)])));
  const afterCancel = (await call("GET", `/lots/${capLot}`)).data.lot.stats.reservableFree;
  check("cancel releases the holds", afterCancel === capDetail.lot.stats.reservableFree);

  console.log("\nWalk-in + driver payment");
  const d3 = await newDriver(3);
  const walk = await call("POST", `/lots/${lotId}/check-in`, {}, d3);
  check("driver check-in on a walk-in slot", walk.status === 201);
  const leaveUnpaid = await call("POST", `/sessions/${walk.data.session._id}/end`, null, d3);
  check("can't leave before paying", leaveUnpaid.status === 409);
  const pp = await call("POST", `/sessions/${walk.data.session._id}/pay`, { upiApp: "Google Pay" }, d3);
  check("pay parking", pp.status === 200);
  const rec = await call("GET", `/payments/${pp.data.payment._id}`, null, d3);
  check("receipt", rec.data.payment?.reference?.startsWith("DEMO-UPI-"));
  await call("POST", `/sessions/${walk.data.session._id}/end`, null, d3);

  console.log("\nAttendant");
  const bad = await call("POST", "/auth/attendant", { username: "att-17", pin: "0000" });
  check("wrong PIN refused", bad.status === 401);
  const att = (await call("POST", "/auth/attendant", { username: "att-17", pin: "1717" })).data.token;
  const workerAtMc = await call("POST", "/auth/admin", { username: "att-17", pin: "1717" });
  check("worker can't sign in at the MC login", workerAtMc.status === 401);
  const notMine = await call("POST", "/attendant/lots/s9-market/entry", { method: "cash" }, att); // not assigned to att-17
  check("attendant can't touch other lots", notMine.status === 403);
  const asDriver = await call("POST", "/attendant/lots/s17-ml/entry", { method: "cash" }, d3);
  check("drivers can't use attendant endpoints", asDriver.status === 403);
  const before = (await call("GET", "/lots/s17-ml")).data.lot.stats.available;
  const entry = await call("POST", "/attendant/lots/s17-ml/entry", { vehicleNo: "ch01 x 9", method: "cash" }, att);
  check("one-tap entry assigns a slot", entry.status === 201 && entry.data.session.vehicleNo === "CH01 X 9");
  const afterEntry = (await call("GET", "/lots/s17-ml")).data.lot.stats.available;
  check("free count dropped by 1", afterEntry === before - 1, `${before} → ${afterEntry}`);
  const unpaid = await call("POST", "/attendant/lots/s17-ml/entry", { method: undefined }, att);
  const blockedExit = await call("POST", `/attendant/slots/${encodeURIComponent(unpaid.data.slot._id)}/exit`, null, att);
  check("exit blocked until fee recorded", blockedExit.status === 409);
  const cash = await call("POST", `/attendant/slots/${encodeURIComponent(unpaid.data.slot._id)}/payment`, { method: "cash" }, att);
  check("record cash", cash.status === 200 && cash.data.payment.method === "cash");
  const ex = await call("POST", `/attendant/slots/${encodeURIComponent(unpaid.data.slot._id)}/exit`, null, att);
  check("car exited, slot free", ex.status === 200);
  const noReason = await call("POST", `/attendant/slots/${encodeURIComponent(entry.data.slot._id)}/correct`, { reason: "" }, att);
  check("correction needs a reason", noReason.status === 400);
  const corr = await call("POST", `/attendant/slots/${encodeURIComponent(entry.data.slot._id)}/correct`, { reason: "Tapped wrong slot" }, att);
  check("correction voids and frees", corr.status === 200);
  const tx = await call("GET", "/attendant/lots/s17-ml/transactions", null, att);
  check("transactions + audit log", Array.isArray(tx.data.payments) && tx.data.log.some((l) => l.action === "slot.correct"));

  console.log("\nMC admin");
  const adm = (await call("POST", "/auth/admin", { username: "mc-admin", pin: "2026" })).data.token;
  const mcAtWorker = await call("POST", "/auth/attendant", { username: "mc-admin", pin: "2026" });
  check("MC account can't sign in at the worker login", mcAtWorker.status === 401);
  const noAdmin = await call("GET", "/admin/overview", null, att);
  check("attendants can't open the MC dashboard", noAdmin.status === 403);
  const ov = await call("GET", "/admin/overview", null, adm);
  check("overview", ov.data.capacity === 1008 && ov.data.sectors.length > 5 && ov.data.revenue.totalInr > 0);
  const hr = await call("GET", "/admin/hourly", null, adm);
  check("hourly chart data (24 hours)", hr.data.hours?.length === 24);
  const at = await call("GET", "/admin/attendants", null, adm);
  check("attendant summaries", at.data.attendants?.length === 4);
  const au = await call("GET", "/admin/audit?type=reservation", null, adm);
  check("audit log filter", au.data.entries.length > 0 && au.data.entries.every((e) => e.action.startsWith("reservation")));
  const fee = await call("PATCH", "/admin/lots/s9-market", { feeInr: 15 }, adm);
  check("change a lot's fee", fee.data.lot?.feeInr === 15);
  await call("PATCH", "/admin/lots/s9-market", { feeInr: 14 }, adm);
  const ins = await call("GET", "/admin/insights", null, adm);
  check(`AI insights (${ins.data.source})`, ins.data.insights?.length >= 1);
  ins.data.insights?.forEach((x) => console.log(`    → ${x}`));


  /* ============================ PARK'D 2.0 ============================ */
  {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const att22 = (await call("POST", "/auth/attendant", { username: "att-22", pin: "2222" })).data.token;
  const adminFest = async () => (await call("GET", "/admin/festival", null, adm)).data;
  const lotOverflow = async (id) => (await adminFest()).lots.find((l) => l._id === id);
  const eventsFor = async (id) => (await call("GET", "/admin/overflow", null, adm)).data.events.filter((e) => e.lotId === id);

  console.log("\nFestival Mode: zones start inactive");
  const f0 = await call("GET", "/festival");
  check("Festival Mode off after seeding", f0.data.active === false && f0.data.zones.length === 0);
  check("inactive zones are not in /lots", !(await call("GET", "/lots")).data.lots.some((l) => l.kind === "temporary"));
  const entryClosed = await call("POST", "/attendant/lots/tz-s17/entry", { method: "cash" }, att);
  check("worker can't register entries in an inactive zone", entryClosed.data.code === "lot-closed", JSON.stringify(entryClosed.data));
  const unappr = await call("POST", "/admin/zones/tz-unapproved/activate", null, adm);
  check("unapproved, unstaffed zone can't be activated", unappr.status === 409 || unappr.data.code === "invalid-state", JSON.stringify(unappr.data));
  const fz = await adminFest();
  check("admin sees why a zone isn't ready", fz.zones.find((z) => z._id === "tz-unapproved")?.problems.length >= 2);

  console.log("\nFestival Mode: overflow detection (Sector 17 Multi-Level, threshold 90%, buffer 5%)");
  const fan = (await call("POST", "/auth/driver", { name: "Smoke Festival Fan" })).data.token;
  await call("GET", "/search?q=sector%2017", null, fan); // remembered for targeting
  const fill = await call("POST", "/admin/demo/fill", { lotId: "s17-ml", targetPct: 95 }, adm);
  check("demo fill pushes the lot over 90%", fill.status === 200 && fill.data.filled >= 0 && fill.data.overflow, JSON.stringify(fill.data).slice(0, 200));
  let evs = await eventsFor("s17-ml");
  check("exactly one overflow event", evs.length === 1, `got ${evs.length}`);
  check("event recommends the approved, staffed zone", evs[0]?.status === "pending" && evs[0].recommendedZoneIds.includes("tz-s17"));
  const allEvents = (await call("GET", "/admin/overflow", null, adm)).data.events;
  check("unapproved zones are never recommended", allEvents.every((e) => !e.recommendedZoneIds.includes("tz-unapproved")));
  check("lot is disarmed after alerting", (await lotOverflow("s17-ml")).overflow.armed === false);

  // more cars while still above threshold → no duplicate alert
  const occ = async () => (await call("GET", "/lots/s17-ml")).data;
  let d17 = await occ();
  const freeGen = d17.slots.find((x) => x.state === "available");
  if (freeGen) await call("POST", "/attendant/lots/s17-ml/entry", { slotId: freeGen._id, method: "cash" }, att);
  await sleep(1800);
  check("no duplicate alert while the lot stays full", (await eventsFor("s17-ml")).length === 1);

  // drop into the buffer band (85–90%) → still disarmed, then back up → no new event
  const exitUntil = async (pct) => {
    for (let i = 0; i < 20; i++) {
      d17 = await occ();
      if (d17.lot.stats.occupancyPct < pct) return;
      const s = d17.slots.find((x) => x.state === "occupied");
      await call("POST", `/attendant/slots/${encodeURIComponent(s._id)}/exit`, null, att);
    }
  };
  await exitUntil(90);
  await sleep(1800);
  d17 = await occ();
  check(`inside the buffer (${d17.lot.stats.occupancyPct}%) the lot stays disarmed`, (await lotOverflow("s17-ml")).overflow.armed === false);
  for (const s of d17.slots.filter((x) => x.state === "available" && x.kind === "general").slice(0, 3)) await call("POST", "/attendant/lots/s17-ml/entry", { slotId: s._id, method: "cash" }, att);
  await sleep(1800);
  check("crossing 90% again inside the buffer doesn't re-alert", (await eventsFor("s17-ml")).length === 1);
  await exitUntil(85);
  await sleep(1800);
  check("below threshold − buffer the lot re-arms", (await lotOverflow("s17-ml")).overflow.armed === true);

  console.log("\nFestival Mode: MC activation, notifications, alternatives");
  evs = await eventsFor("s17-ml");
  const actEv = await call("POST", `/admin/overflow/${evs[0]._id}/activate`, {}, adm);
  check("MC activates the recommended zone", actEv.status === 200, JSON.stringify(actEv.data));
  const evAgain = await call("POST", `/admin/overflow/${evs[0]._id}/activate`, {}, adm);
  check("a recommendation can only be acted on once", evAgain.status >= 400);
  const twice = await call("POST", "/admin/zones/tz-s17/activate", null, adm);
  check("activating an active zone is refused", twice.data.code === "invalid-state");
  const f1 = await call("GET", "/festival");
  check("drivers see Festival Mode with the zone", f1.data.active && f1.data.zones.some((z) => z._id === "tz-s17") && f1.data.extraFree > 0);
  check("zone contact details stay private", f1.data.zones.every((z) => z.zone.contactPublic || z.zone.contact === undefined));
  await sleep(800);
  const notes = (await call("GET", "/notifications", null, fan)).data.items.filter((n) => n.type === "zone.opened" || /extra parking/i.test(n.title));
  check("nearby driver notified exactly once", notes.length === 1, `got ${notes.length}`);
  check("notification deep-links to the zone", notes[0]?.link === "/zone?id=tz-s17");
  const stranger = (await call("POST", "/auth/driver", { name: "Smoke Far Away" })).data.token;
  check("drivers who didn't search nearby aren't notified", (await call("GET", "/notifications", null, stranger)).data.items.length === 0);

  const alt = await call("GET", "/lots/s17-ml/alternatives");
  check("alternatives exclude the full lot and closed/full sites", alt.data.suggestions.length > 0 && alt.data.suggestions.every((x) => x._id !== "s17-ml" && x.stats.open && x.stats.available > 0));
  check("alternatives say traffic is not used", /traffic is not used/i.test(alt.data.note));
  // every time a site is the top pick its score is penalised for 10 minutes, so traffic spreads out
  const first = await call("GET", "/lots/s17-ml/alternatives");
  const topId = first.data.suggestions[0]?._id;
  let last = first;
  for (let i = 0; i < 6; i++) last = await call("GET", "/lots/s17-ml/alternatives");
  const pen = (r) => r.data.suggestions.find((x) => x._id === topId)?.loadPenalty;
  const after = pen(last);
  check("repeated top picks are penalised to spread load (capped at 0.4)", after === undefined || after > pen(first) || after === 0.4, `${topId}: penalty ${pen(first)} → ${after}`);

  const zEntry = await call("POST", "/attendant/lots/tz-s17/entry", { method: "upi", upiApp: "PhonePe" }, att);
  check("worker registers a car in the active zone", zEntry.status === 201, JSON.stringify(zEntry.data));
  const off = await call("POST", "/admin/zones/tz-s17/deactivate", null, adm);
  check("MC closes the zone", off.status === 200);
  const blocked = await call("POST", "/attendant/lots/tz-s17/entry", { method: "cash" }, att);
  check("closed zone blocks new entries", blocked.data.code === "lot-closed");
  const ex = await call("POST", `/attendant/slots/${encodeURIComponent(zEntry.data.slot._id)}/exit`, null, att);
  check("parked cars can still exit a closed zone", ex.status === 200, JSON.stringify(ex.data));
  check("driver list no longer shows the zone", !(await call("GET", "/lots")).data.lots.some((l) => l._id === "tz-s17"));
  const banner = await call("POST", "/admin/festival", { active: true, label: "Smoke test" }, adm);
  check("MC can switch the banner on", banner.data.setting?.active === true);
  await call("POST", "/admin/festival", { active: false }, adm);
  check("worker sees assigned temporary zones", (await call("GET", "/attendant/lots", null, att22)).data.lots.some((l) => l._id === "tz-s22"));

  console.log("\nNeighbourhood Parking: discovery and privacy");
  const disc = await call("GET", "/listings?q=sector%208");
  check("search near Sector 8 finds listings", disc.data.listings.length >= 2);
  check("public listings never include the exact address", disc.data.listings.every((l) => !("exactAddress" in l) && !("exactLat" in l) && !("accessInstructions" in l)));
  check("pending listings are hidden", (await call("GET", "/listings/nl-demo7")).status === 404);
  check("ratings hidden until 3 reviews", disc.data.listings.every((l) => l.rating === null));

  console.log("\nNeighbourhood Parking: booking");
  const IST = (d) => new Date(Date.now() + 5.5 * 3600000 + d * 86400000).toISOString().slice(0, 10);
  const tomorrow = IST(1);
  const nd1 = (await call("POST", "/auth/driver", { name: "Smoke NB 1", vehicleNo: "CH01 NB 1" })).data.token;
  const nd2 = (await call("POST", "/auth/driver", { name: "Smoke NB 2" })).data.token;
  const nd3 = (await call("POST", "/auth/driver", { name: "Smoke NB 3" })).data.token;
  const host0 = (await call("POST", "/auth/driver", { phone: "9800000301" })).data.token;
  const q = await call("GET", "/listings/nl-demo1/quote?hours=2");
  check("quote: 2 h × ₹50 = ₹100", q.data.totalInr === 100);
  const noPolicy = await call("POST", "/neighbourhood-bookings", { listingId: "nl-demo1", date: tomorrow, start: "16:00", hours: 2 }, nd1);
  check("booking needs the cancellation policy accepted", noPolicy.status === 400);
  const b1 = await call("POST", "/neighbourhood-bookings", { listingId: "nl-demo1", date: tomorrow, start: "16:00", hours: 2, acceptPolicy: true, totalInr: 1 }, nd1);
  check("server prices the booking (ignores client total)", b1.status === 201 && b1.data.booking.totalInr === 100 && b1.data.booking.status === "pending-payment", JSON.stringify(b1.data));
  const overlap = await call("POST", "/neighbourhood-bookings", { listingId: "nl-demo1", date: tomorrow, start: "17:00", hours: 1, acceptPolicy: true }, nd2);
  check("overlapping booking refused (unpaid hold counts)", overlap.data.code === "slot-taken");
  const race = await Promise.all([nd2, nd3].map((t) => call("POST", "/neighbourhood-bookings", { listingId: "nl-demo1", date: tomorrow, start: "19:00", hours: 1, acceptPolicy: true }, t)));
  check("two drivers at once: exactly one gets the space", race.filter((r) => r.status === 201).length === 1 && race.some((r) => r.data.code === "slot-taken"), race.map((r) => r.status).join(","));
  const outside = await call("POST", "/neighbourhood-bookings", { listingId: "nl-demo1", date: tomorrow, start: "21:00", hours: 1, acceptPolicy: true }, nd2);
  check("booking outside the host's hours refused", outside.data.code === "invalid-state");
  const badDur = await call("POST", "/neighbourhood-bookings", { listingId: "nl-demo1", date: tomorrow, start: "16:00", hours: 0.75, acceptPolicy: true }, nd2);
  check("duration must be 1–12 h in 30-min steps", badDur.status === 400);
  const own = await call("POST", "/neighbourhood-bookings", { listingId: "nl-demo1", date: IST(2), start: "16:00", hours: 1, acceptPolicy: true }, host0);
  check("hosts can't book their own space", own.data.code === "invalid-state");
  const av = await call("GET", `/listings/nl-demo1/availability?date=${tomorrow}`);
  check("availability shows the booked half-hours as taken", av.data.slots.find((s) => s.start === "16:30")?.free === 0 && av.data.slots.find((s) => s.start === "18:00")?.free === 1);

  const bid = b1.data.booking._id;
  const pay = await call("POST", `/neighbourhood-bookings/${bid}/pay`, { upiApp: "Google Pay" }, nd1);
  check("demo UPI payment confirms the booking", pay.data.booking?.status === "confirmed" && pay.data.payment?.simulated === true);
  const view = await call("GET", `/neighbourhood-bookings/${bid}`, null, nd1);
  check("address locked until 2 h before start", view.data.access.locked === true && !JSON.stringify(view.data).includes("DEMO-8A"));
  const hostView = await call("GET", `/neighbourhood-bookings/${bid}`, null, host0);
  check("host always sees the address", /DEMO-8A/.test(hostView.data.access.exactAddress ?? ""));
  check("other drivers can't open the booking", (await call("GET", `/neighbourhood-bookings/${bid}`, null, nd3)).status === 404);
  check("driver and host notified", (await call("GET", "/notifications", null, nd1)).data.items.some((n) => n.type === "booking.confirmed") && (await call("GET", "/notifications", null, host0)).data.items.some((n) => n.type === "booking.new"));

  // reveal: find any listing with a start slot within the next 2 hours today
  let revealed = null;
  for (const id of ["nl-demo3", "nl-demo6", "nl-demo4", "nl-demo1"]) {
    const a = (await call("GET", `/listings/${id}/availability?date=${IST(0)}`)).data;
    const s = (a.slots ?? []).find((x, i, arr) => !x.past && x.free > 0 && arr[i + 1]?.free > 0 && Date.parse(`${IST(0)}T${x.start}:00+05:30`) - Date.now() > 6 * 60000 && Date.parse(`${IST(0)}T${x.start}:00+05:30`) - Date.now() < 2 * 3600000);
    if (!s) continue;
    const b = await call("POST", "/neighbourhood-bookings", { listingId: id, date: IST(0), start: s.start, hours: 1, acceptPolicy: true }, nd2);
    if (b.status !== 201) continue;
    await call("POST", `/neighbourhood-bookings/${b.data.booking._id}/pay`, { upiApp: "BHIM" }, nd2);
    revealed = (await call("GET", `/neighbourhood-bookings/${b.data.booking._id}`, null, nd2)).data;
    break;
  }
  if (revealed) check("address revealed within 2 h of a confirmed booking", revealed.access.locked !== true && /DEMO/.test(revealed.access.exactAddress));
  else console.log("  – skipped reveal check (no host hours in the next 2 h right now)");

  const rev = await call("POST", "/reviews", { bookingId: bid, stars: 5 }, nd1);
  check("reviews only after a completed booking", rev.data.code === "invalid-state");
  const rep = await call("POST", "/reports", { bookingId: bid, kind: "space-blocked", details: "Smoke test report" }, nd1);
  check("driver can report a problem", rep.status === 201);
  const del = await call("DELETE", "/host/listings/nl-demo1", null, host0);
  check("host can't delete a space with upcoming bookings", del.data.code === "invalid-state");
  const hb = await call("GET", "/host/bookings", null, host0);
  check("host dashboard shows the booking and demo earnings", hb.data.bookings.some((b) => b._id === bid) && hb.data.earningsInr >= 100);

  const cancel = await call("POST", `/neighbourhood-bookings/${bid}/cancel`, null, nd1);
  check("cancelling ≥ 1 h before start refunds in full", cancel.data.booking?.status === "cancelled-by-driver" && cancel.data.booking.refundInr === 100);
  const raceWinner = race.find((r) => r.status === 201).data.booking;
  const winnerTok = race[0].status === 201 ? nd2 : nd3;
  const revBefore = (await call("GET", "/admin/overview", null, adm)).data.revenue.totalInr;
  await call("POST", `/neighbourhood-bookings/${raceWinner._id}/pay`, { upiApp: "Paytm" }, winnerTok);
  const revAfter = (await call("GET", "/admin/overview", null, adm)).data.revenue.totalInr;
  check("MC parking revenue excludes neighbourhood payments", revBefore === revAfter, `${revBefore} → ${revAfter}`);
  const hostCancel = await call("POST", `/host/bookings/${raceWinner._id}/cancel`, null, host0);
  check("host cancellation refunds the driver in full", hostCancel.data.booking?.status === "cancelled-by-host" && hostCancel.data.booking.refundInr === raceWinner.totalInr);

  console.log("\nNeighbourhood Parking: hosting and MC moderation");
  const newHost = (await call("POST", "/auth/driver", { name: "Smoke Host" })).data.token;
  const body = { title: "Smoke test driveway", type: "driveway", spaces: 1, vehicleFit: ["sedan"], sector: "22", lat: 30.733, lng: 76.775, exactAddress: "House SMOKE-1 (fictional)", ratePerHourInr: 30, availability: [{ days: [0, 1, 2, 3, 4, 5, 6], start: "09:00", end: "18:00" }] };
  check("listing needs the ownership declaration", (await call("POST", "/host/listings", body, newHost)).status === 400);
  const created = await call("POST", "/host/listings", { ...body, declaration: true }, newHost);
  const nid = created.data.listing?._id;
  check("new listing waits for MC review", created.status === 201 && created.data.listing.status === "pending");
  check("pending listing not bookable", (await call("GET", `/listings/${nid}`)).status === 404);
  const nbAdmin = await call("GET", "/admin/neighbourhood", null, adm);
  check("MC sees it in the moderation queue + the open report", nbAdmin.data.pending.some((l) => l._id === nid) && nbAdmin.data.openReports >= 1);
  check("only MC can moderate", (await call("POST", `/admin/listings/${nid}/approve`, {}, newHost)).status === 403);
  await call("POST", `/admin/listings/${nid}/approve`, {}, adm);
  check("approved listing goes live", (await call("GET", `/listings/${nid}`)).status === 200);
  await call("POST", `/admin/listings/${nid}/suspend`, { note: "Smoke test" }, adm);
  check("suspended listing disappears", (await call("GET", `/listings/${nid}`)).status === 404);
  check("host notified about moderation", (await call("GET", "/notifications", null, newHost)).data.items.some((n) => n.type === "listing.suspend"));
  await call("POST", `/admin/listings/${nid}/reinstate`, {}, adm);
  await call("DELETE", `/host/listings/${nid}`, null, newHost);
  const rid = nbAdmin.data.reports.find((r) => r.status === "open")?._id;
  check("MC resolves a report", (await call("POST", `/admin/reports/${rid}/resolve`, null, adm)).data.report?.status === "resolved");

  }


  console.log("\nWeb app accounts (email + password)");
  {
    const mail = `smoke${Date.now()}@example.com`;
    const reg = await call("POST", "/auth/register", { name: "Smoke Web", email: mail, password: "parkd-smoke-1" });
    check("driver can sign up with email + password", reg.status === 201 && reg.data.user?.email === mail);
    check("duplicate email refused", (await call("POST", "/auth/register", { name: "x", email: mail, password: "parkd-smoke-1" })).status === 409);
    check("short password refused", (await call("POST", "/auth/register", { name: "x", email: `b${mail}`, password: "short" })).status === 400);
    check("wrong password refused", (await call("POST", "/auth/login", { email: mail, password: "nope-nope" })).status === 401);
    const lg = await call("POST", "/auth/login", { email: mail, password: "parkd-smoke-1" });
    check("log in with email + password", lg.status === 200 && lg.data.token);
    const upd = await call("PATCH", "/me", { vehicleNo: "ch01 zz 9999" }, lg.data.token);
    check("driver updates vehicle number", upd.data.user?.vehicleNo === "CH01 ZZ 9999");
    check("staff can't log in with the email form", (await call("POST", "/auth/login", { email: "mc-admin", password: "2026" })).status === 401);
    check("demo host has a web login", (await call("POST", "/auth/login", { email: "host1@demo.parkd", password: "parkd-demo" })).status === 200);
  }

  check("live 'lot:update' events received", updates.length > 0, `got ${updates.length}`);
  sock.close();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("Smoke test crashed:", e.message); process.exit(1); });
