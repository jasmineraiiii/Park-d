// All collections. (Park'd 2.0 adds temporary zones as a kind of lot,
// overflow events, settings, notifications and Neighbourhood Parking.) Lots and slots use readable string ids ("s17-ml",
// "s17-ml:P07") so they are easy to read in Atlas and in API responses.

import mongoose from "mongoose";
const { Schema, model } = mongoose;
const opts = { versionKey: false, timestamps: false };

/* ---------------- lots ---------------- */
const LotSchema = new Schema({
  _id: { type: String },                 // "s17-ml"
  name: { type: String, required: true },
  sector: { type: String, required: true }, // "17" or "Industrial Area Ph I"
  address: String,
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  capacity: { type: Number, required: true, min: 1 },
  feeInr: { type: Number, required: true, min: 0 },
  opensAt: { type: Number, default: 0 },  // hour, 0-24
  closesAt: { type: Number, default: 24 }, // 24 = midnight; 0 & 24 = open all day
  tags: [String],
  popular: { type: Boolean, default: false },
  coordinatesVerified: { type: Boolean, default: false },

  // "regular" = municipal lot. "temporary" = Festival Mode overflow zone
  // (an MC-approved site such as a school ground). Zones reuse slots, stats,
  // worker tools and live updates exactly like regular lots.
  kind: { type: String, enum: ["regular", "temporary"], default: "regular", index: true },

  // Regular lots: when to recommend overflow zones.
  overflow: {
    thresholdPct: { type: Number, default: 90 },
    bufferPct: { type: Number, default: 5 },   // re-arm only after dropping below threshold - buffer
    zoneIds: [{ type: String }],                // approved nearby temporary zones
    armed: { type: Boolean, default: true },    // false after an alert until occupancy drops below the buffer
  },

  // Temporary zones only.
  zone: {
    status: { type: String, enum: ["scheduled", "active", "closed"], default: "scheduled" },
    approved: { type: Boolean, default: false },      // MC approval for this site
    autoActivate: { type: Boolean, default: false },  // pre-approved automatic activation policy
    startsAt: Date,                                   // operating window (dates)
    endsAt: Date,
    linkedLotIds: [{ type: String }],
    entryPoints: [String],                            // only verified entry/exit points
    vehicles: { type: [String], default: ["car", "two-wheeler"] },
    restrictions: String,
    accessibility: String,
    contact: String,
    contactPublic: { type: Boolean, default: false },
    activatedAt: Date,
    activatedBy: String,
    demo: { type: Boolean, default: false },
  },
}, opts);

/* ---------------- slots ---------------- */
const SlotSchema = new Schema({
  _id: { type: String },                 // "s17-ml:P07"
  lotId: { type: String, ref: "Lot", required: true, index: true },
  number: { type: String, required: true }, // "P07"
  order: { type: Number, required: true },  // 0-based, for sorting
  kind: { type: String, enum: ["general", "reservable"], required: true },
  state: { type: String, enum: ["available", "occupied", "reserved"], default: "available", index: true },
  sessionId: { type: Schema.Types.ObjectId, ref: "Session", default: null },
  reservationId: { type: String, ref: "Reservation", default: null },
  updatedAt: { type: Date, default: Date.now },
}, opts);

/* ---------------- users ---------------- */
const UserSchema = new Schema({
  name: { type: String, default: "Driver" },
  phone: { type: String, index: true, sparse: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true }, // driver/host sign-in (web app)
  googleSub: { type: String, unique: true, sparse: true }, // verified Google identity for web sign-in
  passwordHash: String,
  username: { type: String, unique: true, sparse: true }, // staff sign-in id, e.g. "att-17"
  pinHash: String,
  role: { type: String, enum: ["driver", "attendant", "admin"], default: "driver" },
  vehicleNo: String,
  assignedLotIds: [{ type: String, ref: "Lot" }],
  // These two pointers make "one booking / one parked car per driver" atomic:
  // a driver is claimed with a conditional update before any slot is touched.
  activeReservationId: { type: String, default: null },
  activeSessionId: { type: Schema.Types.ObjectId, default: null },
  // Festival Mode targeting (only stored for drivers who search or share location)
  recentSearches: [{ _id: false, label: String, sector: String, lat: Number, lng: Number, at: Date }],
  lastLocation: { lat: Number, lng: Number, at: Date },
  notificationPrefs: {
    festivalAlerts: { type: Boolean, default: true },
    bookingAlerts: { type: Boolean, default: true },
    push: { type: Boolean, default: false },
  },
  isHost: { type: Boolean, default: false }, // can list Neighbourhood Parking spaces
  hostStatus: { type: String, enum: ["active", "suspended"], default: "active" },
  createdAt: { type: Date, default: Date.now },
}, opts);

/* ---------------- sessions (a car parked in a slot) ---------------- */
const SessionSchema = new Schema({
  lotId: { type: String, ref: "Lot", required: true, index: true },
  slotId: { type: String, ref: "Slot", required: true },
  slotNumber: String,
  driverId: { type: Schema.Types.ObjectId, ref: "User", default: null }, // null for walk-ins registered by attendants
  vehicleNo: String,
  source: { type: String, enum: ["attendant", "driver-checkin", "reservation", "seed", "simulated"], required: true },
  startedAt: { type: Date, default: Date.now, index: true },
  endedAt: Date,
  feeInr: Number,
  paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
  status: { type: String, enum: ["active", "closed", "voided"], default: "active", index: true },
}, opts);

/* ---------------- reservations ---------------- */
const ReservationSchema = new Schema({
  _id: { type: String },                 // booking id shown to drivers, "PK-7F3K2Q"
  lotId: { type: String, ref: "Lot", required: true, index: true },
  slotId: { type: String, ref: "Slot", required: true },
  slotNumber: String,
  driverId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  feeInr: Number,
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ["pending-payment", "held", "checked-in", "expired", "cancelled"], default: "pending-payment", index: true },
  paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
  sessionId: { type: Schema.Types.ObjectId, ref: "Session", default: null },
}, opts);

/* ---------------- payments ---------------- */
const PaymentSchema = new Schema({
  reference: { type: String, required: true, unique: true }, // shown on receipts
  amountInr: { type: Number, required: true },
  method: { type: String, enum: ["upi", "cash"], required: true },
  upiApp: { type: String, enum: ["Google Pay", "PhonePe", "Paytm", "BHIM", null], default: null },
  purpose: { type: String, enum: ["reservation", "parking", "neighbourhood"], required: true },
  lotId: { type: String, ref: "Lot", default: null, index: true },
  listingId: { type: String, default: null }, // Neighbourhood Parking payments
  slotNumber: String,
  driverId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  recordedBy: { type: Schema.Types.ObjectId, ref: "User", default: null }, // attendant for cash / attendant-recorded UPI
  status: { type: String, enum: ["success", "failed"], default: "success" },
  simulated: { type: Boolean, default: true }, // true until a real gateway confirms payments
  createdAt: { type: Date, default: Date.now, index: true },
}, opts);

/* ---------------- audit log ---------------- */
const AuditSchema = new Schema({
  at: { type: Date, default: Date.now, index: true },
  actorId: { type: String, default: "system" },
  actorName: String,
  actorRole: { type: String, enum: ["driver", "attendant", "admin", "system"], default: "system" },
  action: { type: String, required: true }, // "slot.occupy", "reservation.expire", ...
  lotId: { type: String, default: null, index: true },
  slotNumber: String,
  detail: String,
}, opts);

export const Lot = model("Lot", LotSchema);
export const Slot = model("Slot", SlotSchema);
export const User = model("User", UserSchema);
export const Session = model("Session", SessionSchema);
export const Reservation = model("Reservation", ReservationSchema);
export const Payment = model("Payment", PaymentSchema);
export const AuditLog = model("AuditLog", AuditSchema);

/* ---------------- Festival Mode ---------------- */
const OverflowSchema = new Schema({
  lotId: { type: String, required: true, index: true },
  crossedAt: { type: Date, default: Date.now, index: true },
  occupancyPct: Number,
  recommendedZoneIds: [String],
  note: String,
  status: { type: String, enum: ["pending", "activated", "auto-activated", "dismissed", "no-zone"], default: "pending", index: true },
  actedBy: String,
  actedAt: Date,
}, opts);

// Small key-value settings, e.g. { _id: "festival", active, label, startedBy, startedAt }
const SettingSchema = new Schema({ _id: String }, { ...opts, strict: false });

const NotificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, required: true }, // zone.opened, overflow.alert, booking.confirmed, ...
  title: String,
  body: String,
  link: String,                          // deep link, e.g. "/zone?id=tz-s8-a"
  key: { type: String, required: true }, // dedupe key: one notification per (user, key)
  readAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
}, opts);
NotificationSchema.index({ userId: 1, key: 1 }, { unique: true });
NotificationSchema.index({ userId: 1, createdAt: -1 });

/* ---------------- Neighbourhood Parking ---------------- */
const ListingSchema = new Schema({
  _id: { type: String },                  // "nl-XXXXXX"
  hostId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true },
  type: { type: String, enum: ["driveway", "covered-garage", "open-plot", "stilt"], required: true },
  spaces: { type: Number, default: 1, min: 1, max: 10 },
  vehicleFit: { type: [String], default: ["hatchback", "sedan"] }, // hatchback, sedan, suv, two-wheeler
  covered: { type: Boolean, default: false },
  dimensions: String,      // e.g. "5 m x 2.5 m"
  surface: String,         // e.g. "Paved"
  entranceWidth: String,
  clearance: String,
  sector: { type: String, required: true },
  landmark: String,
  // public, approximate (~150 m) position for discovery
  approxLat: Number,
  approxLng: Number,
  // PRIVATE: revealed only to the booking's driver near the booking time, and to the host
  exactLat: Number,
  exactLng: Number,
  exactAddress: String,
  accessInstructions: String,
  ratePerHourInr: { type: Number, required: true, min: 1, max: 1000 },
  // weekly windows in Chandigarh time: days 0=Sun..6=Sat, "HH:MM"
  availability: [{ _id: false, days: [Number], start: String, end: String }],
  blockedDates: [String], // "YYYY-MM-DD"
  rules: String,
  status: { type: String, enum: ["pending", "active", "paused", "rejected", "suspended"], default: "pending", index: true },
  statusNote: String,
  verified: { type: Boolean, default: false }, // only after a real check
  declarationAccepted: { type: Boolean, default: false },
  demo: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, opts);

const NBookingSchema = new Schema({
  _id: { type: String },                  // "NB-XXXXXX"
  listingId: { type: String, required: true, index: true },
  hostId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  driverId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  start: { type: Date, required: true, index: true },
  end: { type: Date, required: true },
  hours: Number,
  rateInr: Number,
  subtotalInr: Number,
  feeInr: { type: Number, default: 0 },
  totalInr: Number,
  vehicleNo: String,
  status: { type: String, enum: ["pending-payment", "confirmed", "cancelled-by-driver", "cancelled-by-host", "completed", "expired", "no-show"], default: "pending-payment", index: true },
  holdExpiresAt: Date,
  paymentId: { type: Schema.Types.ObjectId, default: null },
  refundInr: { type: Number, default: 0 },
  cancelledAt: Date,
  createdAt: { type: Date, default: Date.now },
}, opts);

const ReviewSchema = new Schema({
  bookingId: { type: String, required: true, unique: true },
  listingId: { type: String, required: true, index: true },
  driverId: { type: Schema.Types.ObjectId, required: true },
  stars: { type: Number, min: 1, max: 5, required: true },
  comment: String,
  createdAt: { type: Date, default: Date.now },
}, opts);

const ReportSchema = new Schema({
  bookingId: { type: String, required: true },
  listingId: String,
  reporterId: { type: Schema.Types.ObjectId, required: true },
  reporterRole: { type: String, enum: ["driver", "host"] },
  kind: { type: String, enum: ["no-show", "space-blocked", "damage", "safety", "other"], required: true },
  details: String,
  status: { type: String, enum: ["open", "resolved"], default: "open", index: true },
  createdAt: { type: Date, default: Date.now },
}, opts);

export const OverflowEvent = model("OverflowEvent", OverflowSchema);
export const Setting = model("Setting", SettingSchema);
export const Notification = model("Notification", NotificationSchema);
export const Listing = model("Listing", ListingSchema);
export const NBooking = model("NBooking", NBookingSchema);
export const Review = model("Review", ReviewSchema);
export const Report = model("Report", ReportSchema);
