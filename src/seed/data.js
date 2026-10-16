// Demo dataset for ParkChd.
// IMPORTANT: every lot, capacity, fee and coordinate is ILLUSTRATIVE. They are
// placed near real Chandigarh markets and landmarks, but they are not Municipal
// Corporation records. Replace with verified MC data before real use.

// Lot coordinates verified against Google Maps (Oct 2026). Capacities, fees and hours are demo values.
export const LOTS = [
  { id: "s17-ml", name: "Sector 17 Multi-Level Parking", sector: "17", address: "Bridge Market, Sector 17-D", lat: 30.741842, lng: 76.78134, capacity: 96, opensAt: 0, closesAt: 24, tags: ["multi-level", "market", "covered"], popular: true },
  { id: "s17-plaza", name: "Sector 17 Plaza Parking", sector: "17", address: "Plaza parking, Shopping Plaza, Sector 17-C", lat: 30.738798, lng: 76.783086, capacity: 72, opensAt: 8, closesAt: 23, tags: ["market", "surface"], popular: true },
  { id: "s17-neelam", name: "Neelam Cinema Parking", sector: "17", address: "Near Neelam Cinema, Sector 17-D", lat: 30.739671, lng: 76.780755, capacity: 40, opensAt: 9, closesAt: 23, tags: ["market", "surface"] },
  { id: "s22-shastri", name: "Shastri Market Parking", sector: "22", address: "Shastri Market, Sector 22-B", lat: 30.73386, lng: 76.773887, capacity: 60, opensAt: 9, closesAt: 22, tags: ["market", "surface"], popular: true },
  { id: "s22-kiran", name: "Sector 22-D Market Parking", sector: "22", address: "Near Kiran Cinema, Sector 22 market", lat: 30.730956, lng: 76.773247, capacity: 40, opensAt: 9, closesAt: 22, tags: ["market", "surface"] },
  { id: "s35-c", name: "Sector 35-C Market Parking", sector: "35", address: "Inner market, Sector 35-C", lat: 30.724594, lng: 76.759802, capacity: 64, opensAt: 9, closesAt: 23, tags: ["market", "food"], popular: true },
  { id: "s34-piccadily", name: "Piccadily Square Parking", sector: "34", address: "Piccadily Square, Sector 34-A", lat: 30.723376, lng: 76.767646, capacity: 48, opensAt: 10, closesAt: 23, tags: ["market", "cinema"] },
  { id: "s8-inner", name: "Sector 8 Inner Market Parking", sector: "8", address: "Sector 8 market, Sector 8-B", lat: 30.740839, lng: 76.799288, capacity: 36, opensAt: 9, closesAt: 22, tags: ["market", "food"], popular: true },
  { id: "s9-market", name: "Sector 9 Market Parking", sector: "9", address: "Sector 9-D market", lat: 30.74675, lng: 76.793945, capacity: 40, opensAt: 9, closesAt: 21, tags: ["market"] },
  { id: "s7-market", name: "Sector 7 Market Parking", sector: "7", address: "Sector 7-C market, Madhya Marg", lat: 30.73374, lng: 76.79822, capacity: 32, opensAt: 9, closesAt: 22, tags: ["market", "food"] },
  { id: "s11-market", name: "Sector 11 Market Parking", sector: "11", address: "Medical Market, Sector 11-D", lat: 30.759942, lng: 76.782487, capacity: 30, opensAt: 9, closesAt: 21, tags: ["market"] },
  { id: "s43-isbt", name: "ISBT Sector 43 Parking", sector: "43", address: "Inter State Bus Terminal, Sector 43", lat: 30.716731, lng: 76.742992, capacity: 80, opensAt: 0, closesAt: 24, tags: ["transit", "24 hours"] },
  { id: "elante-p1", name: "Elante Mall Area Parking", sector: "Industrial Area Ph I", address: "Purv Marg, Industrial Area Phase I", lat: 30.706815, lng: 76.800311, capacity: 100, opensAt: 10, closesAt: 23, tags: ["mall", "covered"], popular: true, feeInr: 30 },
  { id: "sukhna", name: "Sukhna Lake Parking", sector: "1", address: "Sukhna Lake car parking, Sector 5", lat: 30.745112, lng: 76.809384, capacity: 80, opensAt: 5, closesAt: 22, tags: ["tourist", "surface"] },
  { id: "rock-garden", name: "Rock Garden Parking", sector: "1", address: "Uttar Marg, near Rock Garden, Sector 1", lat: 30.752896, lng: 76.803403, capacity: 60, opensAt: 9, closesAt: 19, tags: ["tourist", "surface"] },
  { id: "rose-garden", name: "Rose Garden Parking", sector: "16", address: "Zakir Hussain Rose Garden, Sector 16", lat: 30.747571, lng: 76.784555, capacity: 40, opensAt: 6, closesAt: 21, tags: ["tourist", "surface"] },
  { id: "pgi", name: "PGIMER Visitor Parking", sector: "12", address: "PGIMER, Sector 12", lat: 30.768243, lng: 76.776333, capacity: 90, opensAt: 0, closesAt: 24, tags: ["hospital", "24 hours"], feeInr: 10 },
].map((l) => ({ feeInr: 14, opensAt: 0, closesAt: 24, popular: false, ...l }));

/** Typical share of each lot that is occupied; used to seed and simulate. */
export const BUSY = {
  "s17-ml": 0.86, "s17-plaza": 0.94, "s17-neelam": 0.7, "s22-shastri": 0.9, "s22-kiran": 0.62,
  "s35-c": 0.8, "s34-piccadily": 0.72, "s8-inner": 0.5, "s9-market": 0.58, "s7-market": 0.45,
  "s11-market": 0.4, "s43-isbt": 0.66, "elante-p1": 0.78, "sukhna": 0.55, "rock-garden": 0.48,
  "rose-garden": 0.35, pgi: 0.88,
};

export const LANDMARKS = [
  { id: "lm-elante", name: "Elante Mall", aliases: ["elante", "nexus elante", "elante mall"], lat: 30.706815, lng: 76.800311, sector: "Industrial Area Ph I" },
  { id: "lm-sukhna", name: "Sukhna Lake", aliases: ["sukhna", "lake"], lat: 30.745112, lng: 76.809384, sector: "1" },
  { id: "lm-rock", name: "Rock Garden", aliases: ["rock garden", "nek chand"], lat: 30.752896, lng: 76.803403, sector: "1" },
  { id: "lm-rose", name: "Rose Garden", aliases: ["rose garden", "zakir hussain"], lat: 30.747771, lng: 76.784513, sector: "16" },
  { id: "lm-isbt43", name: "ISBT Sector 43", aliases: ["isbt", "bus stand 43", "isbt 43"], lat: 30.717167, lng: 76.743415, sector: "43" },
  { id: "lm-pgi", name: "PGIMER", aliases: ["pgi", "pgimer", "hospital"], lat: 30.768243, lng: 76.776333, sector: "12" },
  { id: "lm-capitol", name: "Capitol Complex", aliases: ["capitol", "secretariat", "high court"], lat: 30.7589, lng: 76.8065, sector: "1" },
  { id: "lm-plaza", name: "Sector 17 Plaza", aliases: ["plaza", "17 plaza"], lat: 30.740549, lng: 76.782074, sector: "17" },
  { id: "lm-piccadily", name: "Piccadily Square", aliases: ["piccadily", "piccadilly"], lat: 30.723376, lng: 76.767646, sector: "34" },
];

/** Approximate sector centres, so a search for a sector without a lot still finds the nearest parking. */
export const SECTOR_CENTRES = {
  "1": { lat: 30.7560, lng: 76.8070 }, "7": { lat: 30.7400, lng: 76.8030 }, "8": { lat: 30.7440, lng: 76.7965 },
  "9": { lat: 30.7480, lng: 76.7880 }, "10": { lat: 30.7525, lng: 76.7810 }, "11": { lat: 30.7570, lng: 76.7740 },
  "12": { lat: 30.7650, lng: 76.7760 }, "14": { lat: 30.7600, lng: 76.7660 }, "15": { lat: 30.7530, lng: 76.7700 },
  "16": { lat: 30.7465, lng: 76.7780 }, "17": { lat: 30.7395, lng: 76.7815 }, "18": { lat: 30.7340, lng: 76.7880 },
  "19": { lat: 30.7290, lng: 76.7950 }, "20": { lat: 30.7240, lng: 76.7870 }, "21": { lat: 30.7290, lng: 76.7800 },
  "22": { lat: 30.7330, lng: 76.7745 }, "23": { lat: 30.7390, lng: 76.7670 }, "24": { lat: 30.7440, lng: 76.7600 },
  "26": { lat: 30.7330, lng: 76.8070 }, "32": { lat: 30.7150, lng: 76.7790 }, "33": { lat: 30.7180, lng: 76.7720 },
  "34": { lat: 30.7225, lng: 76.7690 }, "35": { lat: 30.7240, lng: 76.7600 }, "36": { lat: 30.7290, lng: 76.7540 },
  "37": { lat: 30.7350, lng: 76.7470 }, "43": { lat: 30.7190, lng: 76.7430 }, "44": { lat: 30.7140, lng: 76.7520 },
};

/**
 * Staff accounts. Change these PINs before the demo if the repo is public.
 * Attendants only see and change their assigned lots.
 */
export const STAFF = [
  { username: "att-17", name: "Harpreet", role: "attendant", pin: "1717", phone: "+91 98000 00011", assignedLotIds: ["s17-ml", "s17-plaza", "s17-neelam", "tz-s17"] },
  { username: "att-22", name: "Ramesh", role: "attendant", pin: "2222", phone: "+91 98000 00022", assignedLotIds: ["s22-shastri", "s22-kiran", "s35-c", "s34-piccadily", "tz-s22"] },
  { username: "att-north", name: "Gurdeep", role: "attendant", pin: "0808", phone: "+91 98000 00033", assignedLotIds: ["s8-inner", "s9-market", "s7-market", "s11-market", "rose-garden", "pgi", "tz-s8-a", "tz-s8-b"] },
  { username: "att-east", name: "Sunita", role: "attendant", pin: "4343", phone: "+91 98000 00044", assignedLotIds: ["sukhna", "rock-garden", "elante-p1", "s43-isbt"] },
  { username: "mc-admin", name: "MC Parking Cell", role: "admin", pin: "2026", phone: "+91 172 0000000" },
];

/* ================= Park'd 2.0 demo data ================= */

/**
 * Festival Mode temporary zones. ALL FICTIONAL: names, capacities, positions
 * and approvals are placeholders until the Municipal Corporation verifies
 * real sites. Positions are approximate, in the right sector.
 */
export const ZONES = [
  { id: "tz-s8-a", name: "Demo Overflow Ground A — near Sector 8 Market", sector: "8", address: "Demo location near Sector 8-B market (not verified)", lat: 30.7458, lng: 76.7950, capacity: 60, feeInr: 14, opensAt: 0, closesAt: 24,
    approved: true, autoActivate: false, linkedLotIds: ["s8-inner", "s7-market", "s9-market"], entryPoints: ["Demo gate on the inner road (verify on site)"], vehicles: ["car", "two-wheeler"], restrictions: "Cars and two-wheelers only. No buses or trucks.", accessibility: "Level ground; accessible spots near the gate (demo info).", contact: "Site attendant: demo contact", contactPublic: false },
  { id: "tz-s8-b", name: "Demo Overflow Ground B — Sector 8/9 road", sector: "8", address: "Demo location on the Sector 8/9 dividing road (not verified)", lat: 30.7469, lng: 76.7922, capacity: 40, feeInr: 14, opensAt: 0, closesAt: 24,
    approved: true, autoActivate: false, linkedLotIds: ["s8-inner", "s9-market"], entryPoints: [], vehicles: ["car"], restrictions: "Cars only.", accessibility: "", contact: "", contactPublic: false },
  { id: "tz-s17", name: "Demo Overflow Ground C — near Sector 17", sector: "17", address: "Demo location near Sector 17 (not verified)", lat: 30.7362, lng: 76.7868, capacity: 80, feeInr: 14, opensAt: 0, closesAt: 24,
    approved: true, autoActivate: false, linkedLotIds: ["s17-ml", "s17-plaza", "s17-neelam"], entryPoints: ["Demo north gate", "Demo south gate"], vehicles: ["car", "two-wheeler"], restrictions: "No heavy vehicles.", accessibility: "Accessible spots near the north gate (demo info).", contact: "", contactPublic: false },
  { id: "tz-s22", name: "Demo Overflow Ground D — near Sector 22/35", sector: "22", address: "Demo location between Sector 22 and 35 markets (not verified)", lat: 30.7298, lng: 76.7688, capacity: 50, feeInr: 14, opensAt: 0, closesAt: 24,
    approved: true, autoActivate: true, linkedLotIds: ["s22-shastri", "s22-kiran", "s35-c", "s34-piccadily"], entryPoints: [], vehicles: ["car", "two-wheeler"], restrictions: "", accessibility: "", contact: "", contactPublic: false },
  { id: "tz-unapproved", name: "Demo Site E — awaiting MC approval", sector: "16", address: "Demo location near Sector 16 (not approved)", lat: 30.7428, lng: 76.7762, capacity: 30, feeInr: 14, opensAt: 0, closesAt: 24,
    approved: false, autoActivate: true, linkedLotIds: ["s17-plaza"], entryPoints: [], vehicles: ["car"], restrictions: "", accessibility: "", contact: "", contactPublic: false },
];

/** Which zones each regular lot may overflow into. */
export const OVERFLOW_LINKS = {
  "s8-inner": ["tz-s8-a", "tz-s8-b"], "s9-market": ["tz-s8-b", "tz-s8-a"], "s7-market": ["tz-s8-a"],
  "s17-ml": ["tz-s17"], "s17-plaza": ["tz-s17", "tz-unapproved"], "s17-neelam": ["tz-s17"],
  "s22-shastri": ["tz-s22"], "s22-kiran": ["tz-s22"], "s35-c": ["tz-s22"], "s34-piccadily": ["tz-s22"],
};

/** Demo hosts (drivers who also host). Fictional. Sign in on the driver page with these phone numbers. */
export const HOSTS = [
  { phone: "9800000301", name: "Host A (demo)", vehicleNo: "CH01 HA 0301" },
  { phone: "9800000302", name: "Host B (demo)", vehicleNo: "CH01 HB 0302" },
  { phone: "9800000303", name: "Host C (demo)", vehicleNo: "CH01 HC 0303" },
];

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6], MON_SAT = [1, 2, 3, 4, 5, 6];
/** Fictional Neighbourhood Parking listings. Addresses are placeholders. */
export const LISTINGS = [
  { host: 0, title: "Private driveway near Sector 8 Inner Market", type: "driveway", spaces: 1, vehicleFit: ["hatchback", "sedan"], covered: false, dimensions: "5 m x 2.6 m", surface: "Paved", entranceWidth: "2.8 m", sector: "8", landmark: "Sector 8 Inner Market", lat: 30.7462, lng: 76.7991, rate: 50,
    availability: [{ days: EVERY_DAY, start: "16:00", end: "21:00" }], exactAddress: "House DEMO-8A, Sector 8-B, Chandigarh (fictional)", access: "Demo: park straight in; keep the side gate clear. Ring the bell if the gate is shut.", rules: "No overnight parking. Don't block the neighbour's gate." },
  { host: 0, title: "Covered garage, Sector 8-C", type: "covered-garage", spaces: 1, vehicleFit: ["hatchback", "sedan", "suv"], covered: true, dimensions: "5.5 m x 3 m", clearance: "2.2 m", sector: "8", landmark: "Sector 8 Inner Market", lat: 30.7432, lng: 76.8001, rate: 45,
    availability: [{ days: MON_SAT, start: "10:00", end: "20:00" }], exactAddress: "House DEMO-8C, Sector 8-C, Chandigarh (fictional)", access: "Demo: garage door is left open during your booking.", rules: "SUVs welcome. No engine idling inside." },
  { host: 1, title: "Open plot for 2 cars near Sector 8 market", type: "open-plot", spaces: 2, vehicleFit: ["hatchback", "sedan", "suv"], covered: false, surface: "Gravel", sector: "8", landmark: "Sector 8 Inner Market", lat: 30.7478, lng: 76.7957, rate: 40,
    availability: [{ days: EVERY_DAY, start: "08:00", end: "23:00" }], exactAddress: "Plot DEMO-8P, Sector 8-A, Chandigarh (fictional)", access: "Demo: enter from the back lane.", rules: "Two cars max at a time." },
  { host: 1, title: "Driveway near Sector 17 Plaza (Sector 18 side)", type: "driveway", spaces: 1, vehicleFit: ["hatchback", "sedan"], covered: false, sector: "18", landmark: "Sector 17 Plaza", lat: 30.7336, lng: 76.7906, rate: 50,
    availability: [{ days: EVERY_DAY, start: "09:00", end: "21:00" }], exactAddress: "House DEMO-18, Sector 18-D, Chandigarh (fictional)", access: "Demo: park on the left half of the driveway.", rules: "No overnight parking." },
  { host: 2, title: "Stilt parking near Shastri Market (Sector 21 side)", type: "stilt", spaces: 1, vehicleFit: ["hatchback", "sedan"], covered: true, clearance: "2.1 m", sector: "21", landmark: "Shastri Market", lat: 30.7286, lng: 76.7791, rate: 40,
    availability: [{ days: MON_SAT, start: "11:00", end: "21:00" }], exactAddress: "House DEMO-21, Sector 21-C, Chandigarh (fictional)", access: "Demo: ask the guard for space 2.", rules: "Low clearance: no roof carriers." },
  { host: 2, title: "Two-wheeler space near Sector 35 market", type: "driveway", spaces: 2, vehicleFit: ["two-wheeler"], covered: false, sector: "35", landmark: "Sector 35 Market", lat: 30.7256, lng: 76.7581, rate: 20,
    availability: [{ days: EVERY_DAY, start: "10:00", end: "22:00" }], exactAddress: "House DEMO-35, Sector 35-B, Chandigarh (fictional)", access: "Demo: park by the side wall.", rules: "Two-wheelers only." },
];
/** One listing waiting for MC approval, to demo moderation. */
export const PENDING_LISTING = { host: 2, title: "Driveway near Sector 9 market", type: "driveway", spaces: 1, vehicleFit: ["hatchback", "sedan"], covered: false, sector: "9", landmark: "Sector 9 Market", lat: 30.7496, lng: 76.7871, rate: 45,
  availability: [{ days: EVERY_DAY, start: "10:00", end: "20:00" }], exactAddress: "House DEMO-9, Sector 9-C, Chandigarh (fictional)", access: "Demo access note.", rules: "" };
