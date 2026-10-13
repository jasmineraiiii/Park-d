# Park'd — web app

The Park'd UI (React 19 + Vite + Tailwind 4) connected to the Park'd backend
(`parkchd-backend`: Express, MongoDB, Socket.io). The landing page, sign-in
page and dashboards are the original design; their data and buttons now come
from the live API.

## Run it locally

1. Start the backend first (in the `parkchd-backend` folder):
   ```bash
   npm install
   npm run seed      # demo data: lots, temporary zones, hosts, listings
   npm run dev       # http://localhost:4000
   ```
2. Start this app:
   ```bash
   npm install
   npm run dev       # http://localhost:5173  (/api and live updates are proxied to :4000)
   ```
   If `npm install` can't reach `registry.npmmirror.com` (set in `.npmrc`), run
   `npm install --registry=https://registry.npmjs.org/ --replace-registry-host=registry.npmmirror.com`.
3. `npm run build` checks that everything compiles.

## Demo sign-in

| Role on the sign-in page | Log in with | Backend account |
| --- | --- | --- |
| Driver | `driver@demo.parkd` / `parkd-demo` (or **Sign Up** with any email) | driver |
| Driver (host) | `host1@demo.parkd` / `parkd-demo` (also host2, host3) | driver who lists spaces |
| Worker | Staff ID `att-17`, PIN `1717` (also att-22 / 2222, att-north / 0808, att-east / 4343) | attendant |
| Developer | Staff ID `mc-admin`, PIN `2026` | Municipal Corporation admin |

Staff accounts are issued by the MC, so Worker and Developer only have **Log in**.
Google / Facebook sign-in buttons say they aren't connected yet.

## What's connected

- **Landing page "Find a slot"**: live lot counts from the server. If the server
  can't be reached it shows the built-in sample list, labelled "Simulated live data".
- **Driver dashboard**: Home (active reservation / parked car, receipts), Explore
  (server search, live map with pins and a straight-line guide, live slot view,
  reserve one of the 10% reservable slots, demo UPI payment, walk-in check-in,
  alternatives when a lot is 85%+ full), **Festival Mode**, **Neighbourhood**
  (filters, approximate-location map, 3-step booking, address unlocks 2 h before
  the start, cancel / review / report), Reservations, My Car (Find my car),
  **Host a Space** (list, edit, pause, delete, bookings, demo earnings), Profile
  (name, notification preferences).
- **Worker dashboard**: assigned lots incl. temporary zones, live slot grid with
  entry / payment / exit / correction, vehicle queue of app reservations, 24 h report
  with CSV export.
- **Developer (MC) dashboard**: live overview, entries-per-hour chart, audit log,
  AI insights, **Festival Mode** (banner, overflow recommendations, zone approval /
  activation, thresholds, demo fill), **Neighbourhood** moderation, all lots with fee
  editing, staff list, API response times measured from the browser.
- **Notifications** bell (all roles), pushed live over Socket.io.

## Not real in this demo

Payments, refunds and host earnings are simulated (no money moves). Lots, zones,
hosts and listings are fictional demo data. The barrier gate control has no
hardware behind it. Drive times and live traffic come from Google Maps when you
open directions; Park'd itself only draws a straight-line guide. Phone push
notifications and Google / Facebook sign-in are not connected.

## Deploy

Vercel (see `vercel.json`): set `VITE_API_URL` to the deployed backend URL.
On the backend set `CORS_ORIGIN` to the Vercel URL (or `*` for the hackathon).
