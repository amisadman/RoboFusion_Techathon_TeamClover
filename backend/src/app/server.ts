import http from "http";
import app from "./app.js";
import { initSocket } from "./config/socket.js";
import { prisma } from "./config/prisma.js";
import { updateZoneCacheItem } from "./modules/readings/readings.service.js";
import { startOfflineCheckerInterval } from "./utils/offlineChecker.js";
import { runDataRetentionPruning } from "./utils/retentionJob.js";
import { seedDatabase } from "./config/seed.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const PORT = Number(process.env.PORT) || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const server = http.createServer(app);
const io = initSocket(server, FRONTEND_URL);

// Boot Recovery sequence (Test 9a & 23e)
async function performBootRecovery() {
  console.log("Starting backend boot recovery sequence...");
  try {
    // Automatically seed core zones & default admin/staff users if missing
    await seedDatabase();

    const activeZones = await prisma.zone.findMany({
      where: { archived: false },
      include: {
        readings: {
          orderBy: { receivedAt: "desc" },
          take: 1,
        },
        incidents: {
          where: { status: { in: ["OPEN", "ACKED"] } },
          orderBy: { openedAt: "desc" },
          take: 1,
        },
      },
    });

    for (const zone of activeZones) {
      const latestReading = zone.readings[0];
      const activeIncident = zone.incidents[0];

      if (!latestReading) {
        // Never reported since this zone was created -- leave it out of
        // the cache so the offline-checker's DB sweep (offlineChecker.ts)
        // picks it up and correctly marks it OFFLINE on its next pass,
        // instead of silently defaulting to SAFE forever.
        console.log(`[Boot Recovery] Zone '${zone.id}' has no reading history -- left for offline sweep`);
        continue;
      }

      let state: "SAFE" | "WARNING" | "CRITICAL" | "OFFLINE" = latestReading.state as any;
      const riskScore = latestReading.riskScore;
      const seq = latestReading.seq;
      const occupied = latestReading.motion;
      let criticalStartedAt: number | undefined = undefined;

      if (activeIncident) {
        state = "CRITICAL";
        criticalStartedAt = activeIncident.openedAt.getTime();
      }

      updateZoneCacheItem(zone.id, {
        seq,
        state,
        riskScore,
        occupied,
        criticalStartedAt,
        // Seed lastSeenAt from the last persisted reading so the
        // offline-checker can correctly judge staleness immediately after
        // a restart, rather than treating a just-restored stale zone as
        // freshly seen.
        lastSeenAt: latestReading.receivedAt.getTime(),
      });

      console.log(`[Boot Recovery] Zone '${zone.id}' restored state: ${state}, score: ${riskScore}`);
    }
  } catch (error) {
    console.error("Boot recovery error (DB may be uninitialized):", error);
  }
}

export async function startServer() {
  await performBootRecovery();
  startOfflineCheckerInterval(5000);

  // Data retention policy (Test 21, docs/backup-strategy.md §3): prune raw
  // Reading rows older than 90 days. Runs once at boot, then daily.
  // NOTE: this is an in-process interval, which is only correct for a
  // single backend instance -- if this ever runs horizontally scaled,
  // move this to a platform-level cron job instead.
  runDataRetentionPruning().catch((err) => console.error("[Data Retention] initial run failed:", err));
  setInterval(() => {
    runDataRetentionPruning().catch((err) => console.error("[Data Retention] scheduled run failed:", err));
  }, ONE_DAY_MS);

  // Explicitly bind to "0.0.0.0" for Docker and cloud hosts like Render
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 SCS-RG Backend listening on 0.0.0.0:${PORT}`);
  });
}

export { server, io };
