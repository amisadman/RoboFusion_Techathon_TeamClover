import { prisma } from "../config/prisma.js";
import { getZoneCache, updateZoneCacheItem } from "../modules/readings/readings.service.js";
import { broadcastZoneOffline, broadcastZoneState } from "../config/socket.js";

const OFFLINE_TIMEOUT_MS = 10000; // 10 seconds timeout
let tickCount = 0;

export function startOfflineCheckerInterval(intervalMs: number = 5000): NodeJS.Timeout {
  console.log("⏰ [Offline Checker] Started background health interval (5s ticker)");

  return setInterval(async () => {
    tickCount++;
    try {
      const activeZones = await prisma.zone.findMany({
        where: { archived: false },
        select: { id: true, lastSeenAt: true },
      });

      const now = Date.now();
      const cache = getZoneCache();
      let offlineCount = 0;

      for (const zone of activeZones) {
        if (!zone.lastSeenAt) continue;

        const timeSinceLastSeen = now - zone.lastSeenAt.getTime();
        const cachedItem = cache[zone.id];
        const currentState = cachedItem ? cachedItem.state : "SAFE";

        if (timeSinceLastSeen > OFFLINE_TIMEOUT_MS) {
          offlineCount++;

          if (currentState !== "OFFLINE") {
            console.warn(
              `⚠️ [Offline Checker] Zone '${zone.id}' timed out (${Math.round(
                timeSinceLastSeen / 1000
              )}s since last reading). Marking OFFLINE.`
            );

            updateZoneCacheItem(zone.id, {
              state: "OFFLINE",
            });

            broadcastZoneOffline({
              zone_id: zone.id,
              last_seen_at: zone.lastSeenAt.toISOString(),
            });

            broadcastZoneState({
              zone_id: zone.id,
              state: "OFFLINE",
              risk_score: cachedItem ? cachedItem.riskScore : 0,
              contributions: { fire: 0, gas: 0, water: 0, occupancy: 0 },
              occupied: false,
              updated_at: new Date().toISOString(),
            });
          }
        }
      }

      // Log status heartbeat every 6 ticks (~30s) or when zones time out
      if (tickCount % 6 === 0 || offlineCount > 0) {
        console.log(
          `ℹ️ [Offline Checker Heartbeat #http-${tickCount}] Inspected ${activeZones.length} zones (${offlineCount} offline)`
        );
      }
    } catch (error) {
      console.error("❌ [Offline Checker Error]:", error);
    }
  }, intervalMs);
}
