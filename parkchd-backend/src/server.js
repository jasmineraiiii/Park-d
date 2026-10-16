import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { Server } from "socket.io";
import { ENV } from "./config.js";
import { connectDb } from "./db.js";
import { errorHandler } from "./errors.js";
import { startJobs } from "./jobs/index.js";
import { setIo } from "./realtime.js";
import { api } from "./routes/index.js";
import { syncLotCoordinates } from "./seed/syncCoords.js";

const origins = ENV.corsOrigin === "*" ? "*" : ENV.corsOrigin.split(",").map((s) => s.trim());

const app = express();
app.set("trust proxy", 1); // Render/Railway sit behind a proxy
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "upgrade-insecure-requests": null, // allow plain http on localhost
      "img-src": ["'self'", "data:", "https://*.tile.openstreetmap.org"], // map tiles
    },
  },
}));
app.use(cors({ origin: origins }));
app.use(express.json({ limit: "100kb" }));

// The web UI (home, driver app, host pages, worker app, MC dashboard) lives in /public.
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
app.use(express.static(publicDir, { extensions: ["html"] }));
// Leaflet (map library) served from node_modules, so no outside script hosts are needed.
app.use("/vendor/leaflet", express.static(path.join(publicDir, "..", "node_modules", "leaflet", "dist")));
app.use("/api", api);
app.use((_req, res) => res.status(404).json({ code: "not-found", message: "No such endpoint. Check API.md." }));
app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: origins } });
setIo(io);

await connectDb();
await syncLotCoordinates().catch((e) => console.warn("[db] could not sync lot locations:", e.message));
startJobs();
server.listen(ENV.port, () => console.log(`[api] Park'd API on http://localhost:${ENV.port}  (AI assistant: ${ENV.groqKey ? "Groq" : "rules fallback"})`));

export { app, server };
