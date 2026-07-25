import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import type { ReadingResponse } from "./types/contract.js";

const PORT = Number(process.env.PORT) || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const app = express();

app.use(cors({ origin: FRONTEND_URL, credentials: true }));

// Better Auth MUST be mounted before express.json(), or the auth client
// hangs on "pending" — see plan.md §11.1. Do not move this line down.
app.all("/api/auth/*", toNodeHandler(auth));

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ---------------------------------------------------------------------
// M1 STUBS — hardcoded but contract-shaped, so Wokwi and Frontend can
// build against the real deployed URL immediately. Replace with real
// logic (risk fusion, debounce, Prisma persistence) in M2.
// ---------------------------------------------------------------------

app.post("/api/readings", (req, res) => {
  const response: ReadingResponse = {
    accepted: true,
    state: "SAFE",
    risk_score: 0,
    commands: { led: "green", buzzer: false, relay_cutoff: false },
    server_seq_ack: req.body?.seq ?? 0,
  };
  res.json(response);
});

app.get("/api/zones", (_req, res) => {
  res.json([
    { zone_id: "iot_lab", state: "SAFE", risk_score: 0 },
    { zone_id: "server_room", state: "SAFE", risk_score: 0 },
    { zone_id: "data_science_lab", state: "SAFE", risk_score: 0 },
  ]);
});

// ---------------------------------------------------------------------

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: FRONTEND_URL, credentials: true },
});

io.on("connection", (socket) => {
  console.log("dashboard connected:", socket.id);
});

server.listen(PORT, () => {
  console.log(`backend listening on :${PORT}`);
});

export { io };
