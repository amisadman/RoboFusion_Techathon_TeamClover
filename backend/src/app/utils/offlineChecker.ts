import { prisma } from "../config/prisma.js";
import { getZoneCache, updateZoneCacheItem } from "../modules/readings/readings.service.js";
import { broadcastZoneOffline, broadcastZoneState } from "../config/socket.js";

const OFFLINE_TIMEOUT_MS = 10000; // 10 seconds timeout

export function startOfflineCheckerInterval(intervalMs: number = 5000): NodeJS.Timeout {
  console.log("Starting background zone offline health checker interval...");

  return setInterval(async () => {
    try {
      const activeZones = await prisma.zone.findMany({
        where: { archived: false },
        select: { id: true, lastSeenAt: true },
      });

      const now = Date.now();
      const cache = getZoneCache();

      for (const zone of activeZones) {
        if (!zone.lastSeenAt) continue;

        const timeSinceLastSeen = now - zone.lastSeenAt.getTime();
        const cachedItem = cache[zone.id];

        if (timeSinceLastSeen > OFFLINE_TIMEOUT_MS && cachedItem && cachedItem.state !== "OFFLINE") {
          console.warn(`[Offline Checker] Zone '${zone.id}' timed out (${timeSinceLastSeen}ms). Marking OFFLINE.`);

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
            risk_score: cachedItem.riskScore,
            contributions: { fire: 0, gas: 0, water: 0, occupancy: 0 },
            occupied: false,
            updated_at: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error("Offline checker error:", error);
    }
  }, intervalMs);
}
