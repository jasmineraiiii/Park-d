# Park'd API — guide for the frontend

Park'd 2.0 adds **Festival Mode** (temporary overflow zones), **Neighbourhood Parking** (residents rent driveways by the hour) and a **notification centre**. New sections are marked 2.0.

Base URL: `http://localhost:4000/api` locally, or `https://<your-app>.onrender.com/api` once deployed.

- All requests and responses are JSON.
- Protected endpoints need the header `Authorization: Bearer <token>`. You get the token from `/auth/driver`, `/auth/attendant` or `/auth/admin`. Keep the three tokens under separate storage keys. Store it in `localStorage`.
- Every error looks like `{ "code": "limit-reached", "message": "Only 3 of 36 slots (10%) can be reserved here…" }`. Show `message` to the user; use `code` for logic.

| code | HTTP | meaning |
| --- | --- | --- |
| `bad-request` | 400 | missing or wrong input |
| `unauthenticated` | 401 | no or expired token, wrong PIN |
| `permission-denied` | 403 | wrong role (e.g. a worker token on an MC endpoint), or a lot not assigned to this worker |
| `not-found` | 404 | no such lot, slot, booking or receipt |
| `invalid-state`, `already-active`, `limit-reached`, `slot-taken` | 409 | the rules said no (e.g. slot just taken, already booked) |
| `expired` | 410 | the 15-minute hold ran out |
| `lot-closed` | 422 | outside opening hours, or a temporary zone that isn't active |
| `rate-limited` | 429 | too many requests |

## Live updates (Socket.io)

```js
import { io } from "socket.io-client";
// same host as the API, without /api. Pass the token to get your own notifications (optional).
const socket = io("http://localhost:4000", { auth: { token } });
socket.on("lot:update", (s) => { /* s = stats object below, for s.lotId */ });
socket.on("slot:update", (slot) => { /* { _id, lotId, number, kind, state, updatedAt } */ });
// 2.0
socket.on("festival:update", (f) => { /* same shape as GET /festival */ });
socket.on("zone:update", (z) => { /* { zoneId, status? } → refetch the zone */ });
socket.on("listing:update", (l) => { /* { listingId, status?, deleted? } */ });
socket.on("notification:new", (n) => { /* only to the signed-in user: { _id, type, title, body, link, createdAt } */ });
socket.on("overflow:new", (e) => { /* MC admins only: { lotId, lotName, occupancyPct, recommendedZoneIds, status } */ });
```

Send nothing; just listen. Update the matching lot card, map pin and slot grid when an event arrives.

## Shapes

**Lot** (from `/lots`, `/lots/:id`, `/search`)
```json
{ "_id": "s8-inner", "id": "s8-inner", "name": "Sector 8 Inner Market Parking", "sector": "8",
  "address": "Inner market, Sector 8-B", "lat": 30.7443, "lng": 76.7973, "capacity": 36, "feeInr": 14,
  "opensAt": 9, "closesAt": 22, "tags": ["market","food"], "popular": true, "coordinatesVerified": false,
  "distanceKm": 0.4,
  "stats": { "lotId": "s8-inner", "capacity": 36, "available": 17, "occupied": 19, "reserved": 0,
             "reservableTotal": 3, "reservableFree": 3, "occupancyPct": 53, "open": true,
             "updatedAt": "2026-10-12T06:12:47.831Z" } }
```
`distanceKm` appears only when you pass a location. 2.0: every lot has `kind: "regular" | "temporary"`; temporary zones also carry `zone: { status: "scheduled"|"active"|"closed", approved, autoActivate, startsAt, endsAt, linkedLotIds, entryPoints[], vehicles[], restrictions, accessibility, demo }` and `stats.zoneStatus`. `/lots` and `/search` include temporary zones **only while active**; tag them "Temporary". `opensAt 0` + `closesAt 24` means open 24 hours. Colour rule used in the prototype: free share < 8% or 0 → red "Nearly full"/"Full", < 25% → amber "Limited", else green "Plenty".

**Slot**: `{ "_id": "s8-inner:P02", "lotId": "s8-inner", "number": "P02", "order": 1, "kind": "general" | "reservable", "state": "available" | "occupied" | "reserved", "updatedAt": "…" }`. The last 10% of numbered slots are `reservable`.

**Reservation**: `{ "_id": "PK-7F3K2Q", "lotId", "slotId", "slotNumber": "P34", "driverId", "feeInr": 14, "createdAt", "expiresAt", "status": "pending-payment" | "held" | "checked-in" | "expired" | "cancelled", "paymentId", "sessionId" }`. Show a countdown to `expiresAt`.

**Session** (a parked car): `{ "_id", "lotId", "slotId", "slotNumber", "driverId", "vehicleNo", "source", "startedAt", "endedAt", "feeInr", "paymentId", "status": "active" | "closed" | "voided" }`.

**Payment**: `{ "_id", "reference": "DEMO-UPI-…", "amountInr", "method": "upi" | "cash", "upiApp", "purpose": "reservation" | "parking" | "neighbourhood", "lotId" (or "listingId"), "slotNumber", "createdAt", "status", "simulated": true }`. While `simulated` is true, label receipts "Simulated payment".

## Endpoints

### Public (no token)

| Method | Path | Body / query | Returns |
| --- | --- | --- | --- |
| GET | `/health` | | `{ ok, ai, time }` (`ai` = Groq key set) |
| GET | `/lots` | `?lat=30.74&lng=76.78` optional | `{ lots: Lot[] }` (nearest first when lat/lng given) |
| GET | `/lots/:id` | | `{ lot: Lot, slots: Slot[] }` |
| GET | `/search` | `?q=sec 22` / `elante` / `17` | `{ query, place: {kind, label, lat, lng, sector} \| null, lots: Lot[], totalAvailable }` |
| POST | `/assistant` | `{ message, lat?, lng? }` | `{ reply, lotIds: string[], source: "groq" \| "rules" }` |

Assistant example: `{"message": "sector 22 mein parking hai?"}` → `{"reply": "Haan, Sector 22 mein …", "lotIds": ["s22-kiran"], "source": "groq"}`. Show `reply` as a chat bubble and `lotIds` as lot cards.

### Sign-in

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/auth/driver` | `{ phone?, name?, vehicleNo? }` (all optional) | `{ token, user }` |
| POST | `/auth/attendant` | `{ username: "att-17", pin: "1717" }` | `{ token, user }` — workers only (`user.assignedLotIds`) |
| POST | `/auth/admin` | `{ username: "mc-admin", pin: "2026" }` | `{ token, user }` — MC only |
| GET | `/auth/me` | token | `{ user }` |

Drivers: call `/auth/driver` once on first open (no screen needed) and keep the token. The same phone number always returns the same driver.

Web app accounts (2.0):

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/auth/register` | `{ name, email, password (8+ chars), vehicleNo?, phone? }` | `201 { token, user }` — a driver account |
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` (drivers only; staff use `/auth/attendant` and `/auth/admin`) |
| POST | `/auth/google` | `{ credential }` | `{ token, user }` (verifies a Google Identity Services ID token and signs in or creates a citizen account; requires `GOOGLE_CLIENT_ID`) |
| PATCH | `/me` | `{ name?, vehicleNo? }` | `{ user }` |

`user` now also has `email` and (for staff) `username`. Demo web logins: `driver@demo.parkd`, `host1@demo.parkd` … `host3@demo.parkd`, password `parkd-demo`.

### Driver (driver token)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/me/activity` | | `{ activeSession, activeReservation, sessions[], reservations[], payments[] }` — use for Home banner, My Car, Reservations, Profile |
| POST | `/reservations` | `{ lotId, slotId? }` | 201 `{ reservation }` (status `pending-payment`, 15-min hold starts) |
| GET | `/reservations/:id` | | `{ reservation }` |
| POST | `/reservations/:id/pay` | `{ upiApp: "Google Pay" \| "PhonePe" \| "Paytm" \| "BHIM" }` | `{ reservation, payment }` |
| POST | `/reservations/:id/check-in` | | `{ session }` (car is now in My Car) |
| POST | `/reservations/:id/cancel` | | `{ reservation }` |
| POST | `/lots/:id/check-in` | `{ slotId? }` | 201 `{ session }` — driver self check-in on a walk-in slot (demo) |
| POST | `/sessions/:id/pay` | `{ upiApp }` | `{ payment }` |
| POST | `/sessions/:id/end` | | `{ session }` — refused until paid |
| GET | `/payments/:id` | | `{ payment, lot: { name, address } }` — receipt |

Reservation flow: `POST /reservations` → `POST /reservations/:id/pay` → (drive) → `POST /reservations/:id/check-in` → `GET /me/activity` shows the car.

### Worker / attendant (token from `/auth/attendant`; only their `assignedLotIds`)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/lots/:id` | | slot grid (public endpoint) |
| GET | `/attendant/slots/:slotId` | | `{ slot, session, reservation }` for the slot sheet |
| POST | `/attendant/lots/:lotId/entry` | `{ slotId?, vehicleNo?, method?: "cash" \| "upi", upiApp? }` | 201 `{ session, slot }` — no `slotId` = next free walk-in slot (one-tap); no `method` = unpaid |
| POST | `/attendant/slots/:slotId/payment` | `{ method: "cash" \| "upi", upiApp? }` | `{ payment }` |
| POST | `/attendant/slots/:slotId/exit` | | `{ ok }` — refused until the fee is recorded |
| POST | `/attendant/slots/:slotId/correct` | `{ reason }` (3+ characters) | `{ ok }` — undo a wrong assignment, logged |
| POST | `/reservations/:id/check-in` | | driver with a booking arrived |
| POST | `/reservations/:id/cancel` | | release a hold |
| GET | `/attendant/lots/:lotId/transactions` | | `{ payments[], collectedInr, log[] }` (last 24 h) |

Slot ids contain a colon (`s17-ml:P07`): use `encodeURIComponent(slotId)` in URLs.

### MC admin (token from `/auth/admin`)

| Method | Path | Body / query | Returns |
| --- | --- | --- | --- |
| GET | `/admin/overview` | | `{ lots:{total, openNow}, capacity, available, occupancyPct, revenue:{totalInr, payments, upiInr, cashInr, upiCount, cashCount, byApp[]}, sectors[], alerts[], recent[] }` |
| GET | `/admin/hourly` | | `{ hours: [{ hour: 0-23, entries }] }` (Chandigarh time, last 24 h) |
| GET | `/admin/attendants` | | `{ attendants: [{ name, assignedLotIds, collectedInr, cashToDepositInr, corrections, lastAction }] }` |
| GET | `/admin/audit` | `?type=slot \| reservation \| payment \| lot \| system&lotId=` | `{ entries[] }` |
| GET | `/admin/insights` | | `{ insights: string[3], source: "groq" \| "rules" }` |
| PATCH | `/admin/lots/:id` | `{ feeInr: 15 }` | `{ lot }` |

## 2.0 · Festival Mode

Temporary zones are lots with `kind: "temporary"`. A zone takes cars only when it is **approved**, inside its `startsAt`–`endsAt` window, has a **worker assigned**, and has been **activated** (by the MC, or automatically when its pre-approved `autoActivate` policy is on and a linked lot overflows).

Overflow: every regular lot has `overflow: { thresholdPct: 90, bufferPct: 5, zoneIds[], armed }`. When occupancy crosses the threshold the server creates **one** overflow event, notifies MC admins and disarms; it re-arms only after occupancy falls below threshold − buffer.

| Method | Path | Auth | Body / query | Returns |
| --- | --- | --- | --- | --- |
| GET | `/festival` | — | `?lat=&lng=` optional | `{ active, label, citywideToggle, zones: Zone[], activeZoneCount, extraFree, nearest }` |
| GET | `/zones` | — | | `{ zones }` (active only) |
| GET | `/zones/:id` | — | | `{ zone }` (any status; show "not open" unless `zone.status === "active"`) |
| GET | `/lots/:id/alternatives` | — | `?lat=&lng=&vehicle=car\|two-wheeler` | `{ from, suggestions: Lot[3] (+distanceKm, driveMinutes, score), note }` |
| GET | `/alternatives` | — | `?q=sector 17` or `?lat=&lng=` | same |
| GET | `/attendant/lots` | worker | | `{ lots }` assigned lots incl. inactive zones |
| GET | `/admin/festival` | MC | | `{ setting, zones (+problems[], workers[]), lots (overflow config), overflow: Event[] }` |
| POST | `/admin/festival` | MC | `{ active: true, label? }` | `{ setting }` (banner switch only) |
| POST | `/admin/zones` | MC | `{ name, sector, lat, lng, capacity, ... }` | `{ zone }` (created unapproved) |
| PATCH | `/admin/zones/:id` | MC | `{ approved?, autoActivate?, startsAt?, endsAt?, entryPoints?, restrictions?, accessibility?, contact?, contactPublic?, feeInr? }` | `{ zone }` |
| POST | `/admin/zones/:id/activate` · `/deactivate` | MC | | `{ zone }` (closing blocks entries; parked cars can still exit) |
| GET | `/admin/overflow` | MC | | `{ events }` |
| POST | `/admin/overflow/:id/activate` | MC | `{ zoneId? }` | `{ ok }` opens the recommended zone |
| POST | `/admin/overflow/:id/dismiss` | MC | | `{ ok }` |
| PATCH | `/admin/lots/:id` | MC | `{ thresholdPct?, bufferPct?, zoneIds? }` | `{ lot }` |
| POST | `/admin/demo/fill` | MC | `{ lotId, targetPct: 95 }` | `{ filled, overflow }` **demo only**; off when `DEMO_TOOLS=false` |

Overflow event: `{ _id, lotId, lotName, occupancyPct, crossedAt, recommendedZoneIds[], recommended: [{ id, name }], status: "pending" | "activated" | "auto-activated" | "dismissed" | "no-zone", note }`.

Driver alerts: when a zone opens, drivers who searched that sector (or within 1.5 km) in the last 3 hours, or whose last location was within 2 km, get **one** notification linking to `/zone?id=…` (unless they turned `festivalAlerts` off). Alternatives use free spaces and straight-line distance only — **live road traffic is not used**; repeated top picks are penalised for 10 minutes to spread load.

## 2.0 · Notifications

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/notifications` | `?limit=50` | `{ items: [{ _id, type, title, body, link, readAt, createdAt }], unread }` |
| POST | `/notifications/:id/read` · `/notifications/read-all` | | `{ ok }` |
| PATCH | `/me/notification-prefs` | `{ festivalAlerts?, bookingAlerts?, push? }` | `{ user }` |

Any signed-in role. Each notification has a dedupe key, so the same alert is never sent twice. Phone push is a stub (`src/services/push.js`).

## 2.0 · Neighbourhood Parking

Listing (public view — **never** contains the exact address, exact coordinates or access instructions):
```json
{ "_id": "nl-demo1", "title": "Private driveway near Sector 8 Inner Market", "type": "driveway|covered-garage|open-plot|stilt",
  "spaces": 1, "vehicleFit": ["hatchback","sedan"], "covered": false, "sector": "8", "landmark": "Sector 8 Inner Market",
  "approxLat": 30.746, "approxLng": 76.799, "approxRadiusM": 150, "ratePerHourInr": 50,
  "availability": [{ "days": [0,1,2,3,4,5,6], "start": "16:00", "end": "21:00" }], "rules": "…",
  "host": { "firstName": "Host" }, "rating": null, "reviewCount": 0, "walkMinutes": 4, "distanceKm": 0.24,
  "cancellationPolicy": "…", "verified": false, "demo": true, "availableOn": { "date": "2026-10-12", "windows": [] } }
```
`rating` stays `null` until a space has 3 reviews.

| Method | Path | Auth | Body / query | Returns |
| --- | --- | --- | --- | --- |
| GET | `/listings` | — | `?q=sector 8` or `?lat=&lng=`, `date=YYYY-MM-DD`, `start=HH:MM`, `hours`, `maxPrice`, `maxWalkMin`, `vehicle` | `{ place, listings }` (within 1.5 km or same sector) |
| GET | `/listings/:id` | — | | `{ listing, reviews }` |
| GET | `/listings/:id/availability` | — | `?date=` | `{ date, windows, spaces, slots: [{ start, free, past }] }` (30-min slots) |
| GET | `/listings/:id/quote` | — | `?hours=2` | `{ rateInr, hours, subtotalInr, feeInr, totalInr }` |
| POST | `/neighbourhood-bookings` | driver | `{ listingId, date, start, hours, acceptPolicy: true, vehicleNo? }` | `201 { booking }` status `pending-payment`, held 10 min. **Price is set by the server.** |
| POST | `/neighbourhood-bookings/:id/pay` | driver | `{ upiApp }` | `{ booking (confirmed), payment }` (demo UPI) |
| GET | `/neighbourhood-bookings` | driver | | `{ bookings }` |
| GET | `/neighbourhood-bookings/:id` | driver/host | | `{ booking, listing, access, canCancel, refundIfCancelledNow, canReview, review, role }` |
| POST | `/neighbourhood-bookings/:id/cancel` | driver | | `{ booking }` (refund in full if ≥ 1 h before start, else 0) |
| POST | `/reviews` | driver | `{ bookingId, stars 1–5, comment? }` | completed bookings only, one per booking |
| POST | `/reports` | driver/host | `{ bookingId, kind: no-show\|space-blocked\|damage\|safety\|other, details }` | `{ report }` |

Booking rules: inside one of the host's windows; 1–12 h in 30-minute steps; start ≥ 5 min from now; overlapping bookings (confirmed, or unpaid and still on hold) may never exceed `spaces` (`slot-taken`); hosts can't book their own space. `access` is `{ locked: true, unlocksAt, message }` until **2 hours before the start** for a confirmed booking, then `{ exactAddress, accessInstructions, lat, lng }`. Hosts always see it.

Host (any driver token; demo hosts sign in with `/auth/driver { phone }`):

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/host/listings` | | `{ listings }` (full, incl. private fields) |
| POST | `/host/listings` | `{ title, type, spaces, vehicleFit[], covered, sector, landmark, lat, lng, exactAddress, accessInstructions, ratePerHourInr, availability[], blockedDates[], rules, declaration: true }` | `201 { listing }` status `pending` |
| PATCH | `/host/listings/:id` | any field above, or `{ status: "paused" \| "active" }` | `{ listing }` |
| DELETE | `/host/listings/:id` | | refused while upcoming bookings exist |
| GET | `/host/bookings` | | `{ bookings, earningsInr, note }` (demo, no payouts) |
| POST | `/host/bookings/:id/cancel` | | driver refunded in full |

MC moderation: `GET /admin/neighbourhood` → `{ counts, bookingsThisWeek, openReports, pending[], listings[], reports[] }`; `POST /admin/listings/:id/approve|reject|suspend|reinstate` `{ note? }`; `GET /admin/listings?status=`; `GET /admin/reports`; `POST /admin/reports/:id/resolve`. MC parking revenue figures exclude neighbourhood payments.

## Demo accounts

| username | PIN | role | lots |
| --- | --- | --- | --- |
| `att-17` | 1717 | attendant | Sector 17 (3 lots) + zone `tz-s17` |
| `att-22` | 2222 | attendant | Sectors 22, 34, 35 + zone `tz-s22` (auto-activate) |
| `att-north` | 0808 | attendant | Sectors 7, 8, 9, 11, 16, PGI + zones `tz-s8-a`, `tz-s8-b` |
| `att-east` | 4343 | attendant | Sukhna, Rock Garden, Elante, ISBT 43 |
| `mc-admin` | 2026 | admin | all |

Demo driver phone: `9800000210`.
Demo hosts (fictional): phones `9800000301`, `9800000302`, `9800000303`. Listings `nl-demo1`…`nl-demo6` are live, `nl-demo7` waits for MC review. Zone `tz-unapproved` is deliberately unapproved and unstaffed. All demo zones, hosts and listings are fictional and labelled Demo.
