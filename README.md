# Park'd — Smart Parking for Chandigarh

Park'd brings municipal parking, neighbourhood spaces, citizens, attendants, and city administrators into one live parking network. Citizens can check availability before they leave, while attendants update occupancy from a phone and the Municipal Corporation can respond to busy lots and event demand.

The system is designed to make existing parking easier to find and manage without requiring parking sensors or camera installations at every lot. It combines live updates from attendants with temporary event parking and bookable resident spaces.

## Tech stack

- **Frontend:** React 19, Vite 6, Tailwind CSS 4, Leaflet, Socket.io Client
- **Backend:** Node.js, Express, MongoDB with Mongoose, Socket.io
- **Authentication:** JSON Web Tokens and bcrypt
- **Maps:** Leaflet and OpenStreetMap tiles; Google Maps can open turn-by-turn directions
- **AI integrations:** Hands-free browser voice assistant (Web Speech API — SpeechRecognition & SpeechSynthesis), Groq-powered insights when configured, with rule-based fallback
- **Deployment:** Vercel frontend; backend can run as a separate Node service

## What Park'd can do

### Hands-free AI voice assistant

- **Completely voice-driven parking:** Citizens can ask for parking, check live availability, and reserve a spot entirely hands-free while driving, without needing to browse or tap through the app.
- **Conversational destination search:** Say destination names in everyday natural language (e.g., *"Take me to Sector 17"*, *"Parking near Elante Mall"*, or *"Sukhna Lake"*). The assistant speaks out total live vacancies across nearby lots and recommends the closest open municipal parking lot.
- **ETA & arrival vacancy forecasting:** Predicts whether spots will still be available when the citizen arrives based on distance, travel time, and occupancy trends over the past hour.
- **Voice reservation & payment:** Citizens can say *"Yes"* to reserve a space immediately, select a payment method via voice (Google Pay, PhonePe, Paytm, or BHIM), and receive a 30-minute hold.
- **Exact bay directions & navigation:** Speaks turn-by-turn guidance right down to the specific bay (e.g., *"Row B, 4th bay from the entrance"*) and automatically opens Google Maps turn-by-turn driving navigation.
- **Hands-free slot resolution:** If someone has occupied a citizen's walk-in bay, saying *"Someone is in my slot"* triggers an automatic re-assignment to another free bay and alerts the attendant on duty.
- **Interactive robot avatar:** Animated floating companion with interactive moods (floating, blinking, waving on hover, and speech bounce) using native browser Web Speech synthesis with Indian English voice prioritization and zero third-party voice latency or API key dependencies.

### Find municipal parking

- Browse Chandigarh Municipal Corporation parking locations and search by sector or landmark.
- See current availability, capacity, occupancy, opening status, parking fee, and reservable spaces.
- Use map pins and lot details to compare nearby options. Availability is color-coded to make busy lots easy to spot.
- Open external driving directions to a selected lot. Park'd's in-app route guide is a straight-line direction aid, not live traffic routing.
- If the backend is unavailable, the landing page can show its clearly labelled simulated sample data.

### Citizen dashboard

- Search parking and inspect live lot maps and numbered slot layouts.
- Reserve a space from the limited reservable pool. A reservation holds the selected space for up to 15 to 30 minutes while the citizen completes the demo payment flow.
- Check in for a reservation or use the walk-in flow, then see the active parking session, vehicle, reservation, and receipts in the dashboard.
- Find a parked car and review reservations and parking history.
- See alternative lots when a location is close to full.
- Receive in-app alerts for relevant parking, booking, and event updates; notification preferences can be managed from the profile.

### Festival Mode and temporary parking

- Give the Municipal Corporation a way to open temporary parking zones for festivals, events, and overflow demand.
- Show active zones to citizens on a map with availability, operating windows, entry information, restrictions, and accessibility details where provided.
- Notify citizens who recently searched near a newly opened zone.
- Let administrators configure overflow thresholds and buffers, review recommended zones, approve and activate a zone, assign staff, and manage its operating window.
- Use a demo-fill control to simulate a busy lot and demonstrate the overflow workflow.

### Neighbourhood Parking

- Let residents list driveways, covered garages, open plots, and stilt parking by the hour.
- Let citizens filter spaces by location, date, start time, duration, price, walking distance, and vehicle type, then book an available space.
- Protect host privacy: citizens initially see an approximate area; the exact address unlocks two hours before the booking.
- Give hosts tools to create, edit, pause, and manage listings and bookings, with demo earnings shown in their dashboard.
- Support booking cancellation, reviews, and reports. Municipal administrators can review listings, moderate reports, and suspend or reinstate listings.

### Parking attendant tools

- Give each attendant access to assigned municipal lots, including assigned temporary zones.
- Update numbered slots as vehicles enter and leave, record cash or UPI payment method, and correct mistakes with a logged reason.
- See the vehicle queue for app reservations and the current live slot grid.
- Review a 24-hour activity report and export it as CSV.
- Include a barrier control in the demo interface; it is a simulation and is not connected to physical gate hardware.

### Municipal Corporation dashboard

- Monitor network capacity, current occupancy, available spaces, open lots, and simulated revenue from a live overview.
- Review entries-per-hour analytics, busy lots, system audit events, and AI-generated operational insights (with rule-based fallback).
- View lots on a city map, adjust lot fees and overflow settings, manage staff, and inspect API response times measured by the browser.
- Manage Festival Mode zones and moderate Neighbourhood Parking listings and reports.
- Follow occupancy and zone changes as they happen through live updates.

## Why Park'd is different

- **People-powered availability:** attendants update parking activity on phones, giving citizens useful availability without requiring a sensor or camera in each space.
- **One network for different kinds of supply:** municipal lots, temporary event overflow, and resident-provided spaces can all help citizens find parking.
- **Demand response for events:** occupancy thresholds can prompt administrators to open approved temporary capacity and alert nearby citizens.
- **Privacy-aware sharing:** neighbourhood listings reveal an approximate location first and delay the exact address until shortly before a confirmed booking.
- **Operational accountability:** slot changes, payment records, reservations, and corrections support digital receipts and an audit trail for municipal operations.

## Run it online

Open the live Park'd app at [park-d.vercel.app](https://park-d.vercel.app/).

**Demo accounts**

- **Citizen:** `driver@demo.parkd` / `parkd-demo` (or create an account from the sign-up page)
- **Space host:** `host1@demo.parkd` / `parkd-demo` (`host2` and `host3` are also available)
- **Parking attendant:** Staff ID `att-17`, PIN `1717` (also `att-22` / `2222`, `att-north` / `0808`, `att-east` / `4343`)
- **Municipal administrator:** Staff ID `mc-admin`, PIN `2026`


## Run locally

Start the backend first, then the frontend.

```bash
# Terminal 1 — backend
cd parkchd-backend
npm install
npm run seed      # demo lots, temporary zones, hosts, and listings
npm run dev       # http://localhost:4000

# Terminal 2 — frontend, from the repository root
npm install
npm run dev       # http://localhost:5173; /api and live updates proxy to :4000
```

If `npm install` cannot reach the registry configured in `.npmrc`, use:

```bash
npm install --registry=https://registry.npmjs.org/ --replace-registry-host=registry.npmmirror.com
```

Build the frontend with `npm run build`.

## Demo mode — no money or funds are transferred

Payments, refunds, and host earnings are simulated. **No money or funds are transferred.** Demo lots, temporary zones, hosts, and neighbourhood listings are fictional. The barrier control does not operate physical hardware. Park'd's in-app map guide is not live traffic routing; external directions open in Google Maps. Phone push notifications are not connected.

## Deploy

The frontend is configured for Vercel (`vercel.json`). Set `VITE_API_URL` to the deployed backend URL and `VITE_GOOGLE_CLIENT_ID` to the Google OAuth **Web client ID**. On the backend, set `CORS_ORIGIN` to `https://park-d.vercel.app` and `GOOGLE_CLIENT_ID` to that same Web client ID. The client ID is public configuration; never put the OAuth client secret in the frontend. After changing environment variables, redeploy the frontend and backend. Google sign-in is configured for the Vercel site; localhost must be added as an authorized JavaScript origin before using Google sign-in locally.

See [API.md](API.md) for backend endpoints, live events, data shapes, and demo workflows.
