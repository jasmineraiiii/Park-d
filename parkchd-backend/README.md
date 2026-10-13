# Park'd 2.0

Smart parking for Chandigarh. Node.js + Express API with MongoDB, Socket.io live updates and a GroqCloud AI assistant, plus a web UI for drivers, hosts, workers and the Municipal Corporation. Every rule is enforced on the server.

What's in 2.0:
- **Festival Mode**: MC-approved temporary overflow zones. Lots raise one alert when they cross 90% full; the MC opens the recommended zone (or a zone with a pre-approved policy opens itself); nearby drivers get one notification; full lots suggest spread-out alternatives.
- **Neighbourhood Parking**: residents list driveways and garages by the hour. Approximate location only until 2 hours before the booking, server-side pricing, no overbooking, cancellation refunds, reviews (shown after 3), reports and MC moderation.
- **Notification centre** (bell) for drivers, hosts, workers and the MC, with deduplication.
- The Park'd look: logo, bright green / cream / yellow, rounded cards, small illustrations.

- `API.md`: the full endpoint guide. Give it to the frontend developer.
- `npm run smoke`: 119 automated checks of the whole API, including two drivers grabbing the same slot (or the same driveway) at the same moment, overflow threshold/buffer behaviour and address privacy.
- `npm run demo:festival`: fills Sector 17 Multi-Level with simulated cars so the overflow alert appears on stage.

## Step by step

### Step 1: Install Node.js

Install Node.js 18 or newer from nodejs.org, then run `node -v` to check.

### Step 2: Install the project

```bash
cd parkchd-backend
npm install
cp .env.example .env        # on Windows: copy .env.example .env
```

### Step 3: Create the database (MongoDB Atlas, free)

1. Sign up at mongodb.com/atlas.
2. Create a **free M0 cluster**, choosing the Mumbai region.
3. Under **Database Access**, add a user with a password. Avoid `@` or `#` in the password, since they break the connection string.
4. Under **Network Access**, add `0.0.0.0/0` (allow from anywhere). Your laptop and Render both need access.
5. Click **Connect → Drivers** and copy the connection string.
6. Paste it into `.env` as `MONGODB_URI`. Put your password in it, and add `parkchd` before the `?`:
   ```
   MONGODB_URI=mongodb+srv://ravi:MyPass123@cluster0.ab12c.mongodb.net/parkchd?retryWrites=true&w=majority
   ```
7. Set `JWT_SECRET` in `.env` to any long random string.

### Step 4: Get a GroqCloud key (for the AI assistant)

1. Sign up at console.groq.com.
2. Go to **API Keys → Create API Key** and copy it.
3. Paste it into `.env` as `GROQ_API_KEY`. Keep it secret: never put it in the frontend or on GitHub.

Without a key, the assistant still answers using simple rules, so nothing breaks.

### Step 5: Load the demo data

```bash
npm run seed
```

This creates 17 lots, 1,008 numbered slots, the staff accounts and a demo driver. It also generates realistic occupancy and the last 24 hours of history for the charts. Use `npm run seed -- --empty` to start with every slot free. It also creates 5 temporary zones (all inactive), 3 demo hosts and 7 neighbourhood listings (one waiting for MC review). All of it is fictional and labelled Demo. Seeding deletes existing data first.

### Step 6: Run it

```bash
npm run dev
```

You should see `Park'd API on http://localhost:4000`. Open http://localhost:4000/api/health to confirm. In a second terminal, run the full check:

```bash
npm run smoke
```

All checks should pass. The smoke test creates and removes test bookings, so run `npm run seed` again before a demo.

### Step 6b: Open the web UI

With the server running, open **http://localhost:4000**:

| Page | URL | Login |
| --- | --- | --- |
| Home | `/` | none |
| Worker login → Worker app | `/worker/login` → `/worker/dashboard` | `att-17` / 1717 (and the other worker IDs) |
| MC login → MC dashboard | `/mc/login` → `/mc/dashboard` | `mc-admin` / 2026 |
| Driver app | `/driver` | none (creates a test driver; or sign in with a phone) |
| Festival parking | `/festival`, `/zone?id=tz-s17` | none |
| Neighbourhood Parking | `/neighbourhood` → `/listing?id=…` → `/booking?id=…` | none (driver token created automatically) |
| Host dashboard + wizard | `/host`, `/host-new` | phone `9800000301` (or 302, 303) |

The two staff logins are separate: a worker ID is refused at the MC login and the MC ID is refused at the worker login. Each page has a black **What's happening** box that shows every API call and live event as it happens. Open the worker app and the MC dashboard side by side, tap **New car · Cash**, and watch the counts change in both.

### Step 7: Deploy (Render, free)

1. Push this folder to GitHub. `.env` is ignored, which is correct.
2. On render.com, choose **New → Web Service** and pick the repo.
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance type: Free
3. Under **Environment**, add `MONGODB_URI`, `JWT_SECRET`, `GROQ_API_KEY`, `GROQ_MODEL`, `CORS_ORIGIN` (your teammate's frontend URL, or `*`), `NODE_ENV=production`, `SIMULATE=true` if you want cars to move during the demo, and `DEMO_TOOLS=true` to keep the Festival Mode fill button (set it to `false` for real use).
4. Deploy. Your API will be at `https://<name>.onrender.com/api`.
5. Test it with `API_URL=https://<name>.onrender.com npm run smoke`, then `npm run seed` to reset the data.

Render's free tier sleeps after 15 minutes without traffic, and the first request then takes up to a minute. Open the URL a few minutes before you present.

### Step 8: Hand over to the frontend

Send your teammate `API.md` and the deployed URL. They need:
- `fetch(API + "/lots")` and `/lots/:id` for the map and lot pages.
- `socket.io-client` listening for `lot:update` and `slot:update`. That's the live "count drops on every phone" moment.
- The token from `/auth/driver`, `/auth/attendant` (workers) or `/auth/admin` (MC) in an `Authorization: Bearer` header.

## The web app (React UI)

The teammate's React app (`Park-d`, Vite + Tailwind) is the main front end and talks to this API.
Run this backend on port 4000, then in the `Park-d` folder run `npm install` and `npm run dev`
(http://localhost:5173 — `/api` and live updates are proxied here). Its README lists the demo
sign-ins. When it's deployed separately (e.g. Vercel), set `VITE_API_URL` there and `CORS_ORIGIN` here.

The plain HTML pages in `public/` (driver, host, worker, MC) still work at http://localhost:4000
and are handy as a backup or for testing.

## How the important rules work

| Rule | Where |
| --- | --- |
| Only 10% of a lot can be reserved | the seed marks the last 10% of slots `reservable`; only those can be booked |
| No double booking | conditional updates ("set reserved only if still available") plus a per-lot lock in `services/locks.js` |
| One booking / one parked car per driver | the driver is claimed first with a conditional update on `activeReservationId` / `activeSessionId` |
| 15-minute hold | `jobs/index.js` releases expired holds every minute |
| Can't leave without paying | `endSession` and `attendantExit` refuse unpaid sessions |
| Attendants only touch their lots; only the MC changes fees | `requireLotAccess`, `requireAuth("admin")` |
| Everything is logged | `audit()` writes to `auditlogs` on every change |
| Temporary zones only take cars when approved, in their window, staffed and active | `zoneProblems()` + `isLotOpen()` |
| One overflow alert per crossing; re-arm below threshold − buffer | `checkOverflow()` (disarm with a conditional update first) |
| Each driver gets a zone alert once | notification dedupe key + unique index |
| Neighbourhood price set by the server, never overbooked | `quote()` + overlap count under a per-listing lock |
| Exact address only 2 h before start | `getBooking()` returns `access.locked` until then |
| AI never invents availability | Groq only sees the live counts we send; it falls back to rules if Groq fails |

## Files

```
public/                  the basic web UI (plain HTML/CSS/JS, served by the server)
  index.html             landing page (Driver, Host, Worker, MC)
  driver.html            driver app: map, search, AI, reserve, festival banner, alternatives
  festival.html, zone.html            Festival Mode: all extra zones, one zone
  neighbourhood.html, listing.html, booking.html   Neighbourhood Parking for drivers
  host.html, host-new.html            host dashboard and listing wizard
  worker/login.html, worker/dashboard.html          worker app (incl. temporary zones)
  mc/login.html, mc/dashboard.html                  MC dashboard (Festival Mode + moderation)
  img/                   logo, icons     manifest.webmanifest
  css/style.css          Park'd dark navy theme: colour tokens, components, motion (respects reduced motion)
  js/common.js           API calls, tokens, header + bell, live updates, maps, illustrations
  js/<page>.js           one module per page (the security policy blocks inline scripts)
```

```
src/server.js            starts Express + Socket.io, connects MongoDB, starts jobs
src/config.js            business rules (₹14, 10%, 15 min) and environment settings
src/models/index.js      all collections (lots + zones, slots, bookings, listings, notifications, …)
src/routes/index.js      every endpoint
src/services/parking.js  all booking, parking, attendant and admin rules
src/services/admin.js    dashboard figures
src/services/assistant.js GroqCloud assistant + MC insights
src/services/search.js   "sec 17" / landmark search
src/services/festival.js Festival Mode: zone checks, activation, overflow detection, alternatives, demo fill
src/services/neighbourhood.js  listings, availability, booking, privacy reveal, cancellation, reviews, moderation
src/services/notify.js   notification centre (deduplicated); push.js is a stub
src/realtime.js          Socket.io rooms and events
src/jobs/index.js        hold expiry, overflow checks, booking expiry/completion/reminders, optional simulation
src/seed/                demo data and seed script
scripts/smoke.js         end-to-end test (119 checks)
scripts/demo-festival.js stage helper: fill a lot to trigger overflow
```

## Judge demo script (about 6 minutes)

Before you start: `npm run seed`, then open three windows: **MC** (`/mc/login`, `mc-admin` / 2026), **Driver** (`/driver`) and **Worker** (`/worker/login`, `att-17` / 1717).

1. **The problem (30 s).** Driver window: live map and lot cards. "Every count you see is live from the server."
2. **Search from home (30 s).** Driver: type `sector 17` and search. Ask the assistant "Is there parking near Sector 17?". Searching also tells Park'd this driver is heading to Sector 17.
3. **A festival crowd arrives (1 min).** MC window → **Festival Mode** → choose *Sector 17 Multi-Level* → **Demo: fill to 95%** (or run `npm run demo:festival`). Point out: one overflow alert appears, the bell rings, the zone checklist shows *Demo Overflow Ground C* is approved, inside its window and staffed, while *Demo Site E* is blocked (not approved, no worker).
4. **The MC decides (30 s).** Press **Activate** on the recommendation. Optionally type a banner label and **Turn on**.
5. **Drivers find out (1 min).** Driver window: the green Festival banner appears without a refresh, and the bell has "Extra parking is now available!". Open it → zone page with gates, rules, accessibility and directions. Open Sector 17 Multi-Level: it's 90%+ full, so Park'd suggests alternatives, with the temporary zone among them.
6. **The worker runs the zone (30 s).** Worker window: pick "🎉 Demo Overflow Ground C · temporary, ACTIVE" → **New car · Cash**. The driver's map pin updates live.
7. **Neighbourhood Parking (1.5 min).** Driver → **Explore private parking** → Sector 8 → a driveway. Show the approximate circle (not the house). Pick tomorrow, a time and 2 hours → price from the server → accept the policy → pay with a UPI app (demo). The booking page says the address unlocks 2 hours before the start.
8. **Hosts and the MC (1 min).** `/host` with phone `9800000301`: the new booking and demo earnings. `/host-new`: the 4-step wizard with the ownership declaration. MC → **Neighbourhood**: approve the waiting listing; show reports and suspend.
9. **Close (15 s).** MC audit log: every action is recorded. `npm run smoke`: 119 checks pass.

## What's real and what's demo

| Area | In this build | Needed for real use |
| --- | --- | --- |
| Lot, slot, zone and booking rules | **Real**: enforced on the server with atomic updates and locks; covered by `npm run smoke` | — |
| Live updates, notification centre | **Real** (Socket.io + stored notifications) | Phone push: connect FCM/APNs in `src/services/push.js` |
| Parking lots, temporary zones, hosts, listings | **Demo data**, fictional and labelled Demo; coordinates not verified | MC's verified lot list, approved event sites, real host sign-ups |
| Occupancy history and "Demo: fill" cars | **Simulated** | Attendant entries (already supported) or sensors/cameras |
| Payments (UPI, cash, neighbourhood bookings, refunds, host earnings) | **Simulated**: no money moves | A payment gateway (Razorpay/Cashfree/PayU) with server-side order creation and verified webhooks; payouts to hosts |
| Overflow detection | **Real** logic on live counts | — |
| "Prediction" | None. Park'd uses current counts only | Historical models if wanted later |
| Alternatives and drive times | Straight-line distance and free spaces; **live road traffic is not used** | A routing/traffic API |
| Driver and host sign-in | Phone number without OTP (demo) | SMS OTP |
| Staff sign-in | Demo PINs | OTP or SSO; change PINs |
| Host verification | Declaration checkbox + MC review | Document checks, RWA/society consent where required |
| AI assistant | GroqCloud on live counts, with a rules fallback | — |

## Before real use

- Replace the demo lots with verified MC data and coordinates.
- **Real payments:** connect a gateway (Razorpay, Cashfree or PayU UPI). Create the order on the server and mark payments paid only from the gateway's verified webhook. Never trust a "paid" message from the app. Never collect UPI PINs.
- Replace staff PINs with phone OTP login, and change the demo PINs.
- MongoDB Atlas backups and a paid Render plan, so the server doesn't sleep.
