import "dotenv/config";

// Business rules. Change them here, nowhere else.
export const RULES = {
  defaultFeeInr: 14,
  reservationFeeInr: 14,
  reservableShare: 0.1, // only 10% of a lot can be reserved
  holdMinutes: 15,
  highOccupancyPct: 85, // admin alert threshold
  timeZone: "Asia/Kolkata", // opening hours and charts use Chandigarh time
};

export const ENV = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/parkchd",
  jwtSecret: process.env.JWT_SECRET || "",
  groqKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  simulate: process.env.SIMULATE === "true",
};

if (!ENV.jwtSecret) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is not set. Add it to your environment variables.");
  }
  ENV.jwtSecret = "dev-only-secret-change-me";
  console.warn("[config] JWT_SECRET not set; using an insecure development secret.");
}
