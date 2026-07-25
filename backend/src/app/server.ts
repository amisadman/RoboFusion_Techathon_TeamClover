import http from "http";
import app from "./app.js";
import { initSocket } from "./config/socket.js";
import { prisma } from "./config/prisma.js";
import { updateZoneCacheItem } from "./modules/readings/readings.service.js";
import { startOfflineCheckerInterval } from "./utils/offlineChecker.js";

const PORT = Number(process.env.PORT) || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const server = http.createServer(app);
const io = initSocket(server, FRONTEND_URL);

// Boot Recovery sequence (Test 9a & 23e)
async function performBootRecovery() {
  console.log("Starting backend boot recovery sequence...");
  try {
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

      let state: "SAFE" | "WARNING" | "CRITICAL" | "OFFLINE" = "SAFE";
      let riskScore = 0;
      let seq = 0;
      let occupied = false;
      let criticalStartedAt: number | undefined = undefined;

      if (latestReading) {
        state = latestReading.state as any;
        riskScore = latestReading.riskScore;
        seq = latestReading.seq;
        occupied = latestReading.motion;
      }

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

  // Explicitly bind to "0.0.0.0" for Docker and cloud hosts like Render
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 SCS-RG Backend listening on 0.0.0.0:${PORT}`);
  });
}

export { server, io };
