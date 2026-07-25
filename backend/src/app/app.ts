import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth.js";

import healthRouter from "./modules/health/health.router.js";
import readingsRouter from "./modules/readings/readings.router.js";
import zonesRouter from "./modules/zones/zones.router.js";
import incidentsRouter from "./modules/incidents/incidents.router.js";
import bonusRouter from "./modules/bonus/bonus.router.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const app = express();

app.use(cors({ origin: FRONTEND_URL, credentials: true }));

// Better Auth MUST be mounted before express.json(), or the auth client
// hangs on "pending" — see plan.md §11.1. Do not move this line down.
app.all("/api/auth/*", toNodeHandler(auth));

app.use(express.json());

// Register API Module Routers
app.use("/api", healthRouter);
app.use("/api", readingsRouter);
app.use("/api", zonesRouter);
app.use("/api", incidentsRouter);
app.use("/api", bonusRouter);

export default app;
