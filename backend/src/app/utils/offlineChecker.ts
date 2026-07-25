import { prisma } from "../config/prisma.js";
import { getZoneCache, updateZoneCacheItem, recalculateAndBroadcastPriority } from "../modules/readings/readings.service.js";
import { broadcastZoneOffline, broadcastZoneState } from "../config/socket.js";

// Appendix A / contract.md §4.5: a zone is OFFLINE if no valid reading has
// been received in > 10 seconds. This is the recurring server-side sweep
// that actually enforces that -- without it, a zone's displayed state only
// ever changes when a NEW reading arrives, so a genuinely-dead zone would
// freeze at its last known state forever instead of going OFFLINE.
const OFFLINE_THRESHOLD_MS = 10_000;

function markOffline(zoneId: string, lastSeenAtMs: number) {
  updateZoneCacheItem(zoneId, { state: "OFFLINE" });

  const last_seen_at = new Date(lastSeenAtMs).toISOString();

  broadcastZoneOffline({ zone_id: zoneId, last_seen_at });
  broadcastZoneState({
    zone_id: zoneId,
    state: "OFFLINE",
    risk_score: 0,
    contributions: { fire: 0, gas: 0, water: 0, occupancy: 0 },
    occupied: false,
    updated_at: last_seen_at,
  });

  console.log(`📴 [Offline Checker] Zone '${zoneId}' marked OFFLINE (last seen ${last_seen_at})`);
  recalculateAndBroadcastPriority();
}

async function sweepOfflineZones() {
  const cache = getZoneCache();
  const now = Date.now();

  // Zones that have reported at least once since this process booted:
  // check the cached lastSeenAt for staleness.
  for (const [zoneId, item] of Object.entries(cache)) {
    if (item.state === "OFFLINE") continue;
    if (item.lastSeenAt === undefined) continue; // covered by the DB pass below
    if (now - item.lastSeenAt > OFFLINE_THRESHOLD_MS) {
      markOffline(zoneId, item.lastSeenAt);
    }
  }

  // Zones with no cache entry at all (never reported since this process
  // booted, and boot recovery had no prior Reading to seed from either) --
  // per Appendix A these are just as OFFLINE as a zone that went stale.
  const dbZones = await prisma.zone.findMany({
    where: { archived: false },
    select: { id: true, lastSeenAt: true },
  });

  for (const zone of dbZones) {
    if (cache[zone.id]) continue; // already handled above
    markOffline(zone.id, zone.lastSeenAt ? zone.lastSeenAt.getTime() : now);
  }
}

export function startOfflineCheckerInterval(intervalMs: number = 5000): NodeJS.Timeout {
  console.log(`📡 [Offline Checker] Sweeping every ${intervalMs}ms for zones stale > ${OFFLINE_THRESHOLD_MS}ms`);
  return setInterval(() => {
    sweepOfflineZones().catch((err) => console.error("[Offline Checker] sweep failed:", err));
  }, intervalMs);
}
