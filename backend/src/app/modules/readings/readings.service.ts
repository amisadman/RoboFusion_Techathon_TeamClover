import { prisma } from "../../config/prisma.js";
import { ReadingPayload, ReadingResponseAccepted } from "../../types/contract.js";
import { calculateRiskFusion } from "../../utils/riskFusion.js";
import { getFlameDebounceAndWarmup, applyDecay } from "../../utils/debounce.js";
import {
  broadcastZoneState,
  broadcastPriorityUpdate,
  broadcastIncidentOpened,
  broadcastIncidentResolved,
} from "../../config/socket.js";
import { rankCriticalZones, CriticalZoneInfo } from "../../utils/priorityRanking.js";
import { KNOWN_HAZARD_TYPES } from "../../utils/hazardTypes.js";

// In-memory zone state cache
interface ZoneCacheItem {
  seq: number;
  state: "SAFE" | "WARNING" | "CRITICAL" | "OFFLINE";
  riskScore: number;
  occupied: boolean;
  criticalStartedAt?: number;
  lastResponse?: ReadingResponseAccepted;
  lastSeenAt?: number;
}

const zoneCache: Record<string, ZoneCacheItem> = {};

export function getZoneCache(): Record<string, ZoneCacheItem> {
  return zoneCache;
}

export function updateZoneCacheItem(zoneId: string, item: Partial<ZoneCacheItem>) {
  const current = zoneCache[zoneId] || {
    seq: 0,
    state: "SAFE",
    riskScore: 0,
    occupied: false,
  };
  zoneCache[zoneId] = {
    ...current,
    ...item,
  };
}

export async function getPriorityQueue() {
  const openIncidents = await prisma.incident.findMany({
    where: { status: "OPEN" },
  });

  const cache = getZoneCache();
  const criticalItems: CriticalZoneInfo[] = openIncidents.map((inc) => {
    const cachedItem = cache[inc.zoneId];
    return {
      incident_id: inc.id,
      zone_id: inc.zoneId,
      risk_score: inc.peakRiskScore,
      occupied: cachedItem?.occupied || false,
      openedAt: inc.openedAt.getTime(),
      source: inc.source as "sensor" | "manual_override" | "nl_report",
      hazard_types: inc.hazardTypes,
    };
  });

  return rankCriticalZones(criticalItems);
}

export async function processReading(payload: ReadingPayload): Promise<ReadingResponseAccepted> {
  const { zone_id, seq, timestamp_ms, sensors, sensor_health } = payload;
  const nowMs = Date.now();

  const cache = zoneCache[zone_id] || {
    seq: -1,
    state: "SAFE",
    riskScore: 0,
    occupied: false,
  };

  // Always refresh lastSeenAt on incoming valid HTTP request
  cache.lastSeenAt = nowMs;

  // Node reboot recovery: if node sequence resets to 1, reset sequence cache
  if (seq === 1 && cache.seq > 1) {
    console.log(`🔄 [Zone Node Reboot] Resetting sequence cache for zone '${zone_id}'`);
    cache.seq = 0;
  }

  // 1. Sequence deduplication check (Test 6d)
  if (seq <= cache.seq && cache.lastResponse) {
    return {
      ...cache.lastResponse,
      server_seq_ack: seq,
    };
  }

  // 2. Debounce and Warm-up evaluation (pure function of raw sensor values,
  // doesn't need a score, so it can run before fusion)
  const { debouncedFlame, isWarmUp } = getFlameDebounceAndWarmup(zone_id, sensors.flame_raw);

  // 3. Compute Risk Fusion for THIS cycle
  const fusion = calculateRiskFusion(sensors, debouncedFlame, isWarmUp);

  // 4. Apply decay smoothing to the FRESH fusion score (never a stale
  // previously-stored score -- see docs/audit-findings.md F2)
  const activeScore = applyDecay(zone_id, fusion.riskScore);

  let state = fusion.state;
  if (activeScore >= 65.0) state = "CRITICAL";
  else if (activeScore >= 30.0) state = "WARNING";
  else state = "SAFE";

  const isDisconnected = Object.values(sensor_health).some((h) => h === "disconnected");
  if (isDisconnected) {
    state = "OFFLINE";
  }

  const criticalStartedAt =
    state === "CRITICAL"
      ? cache.state === "CRITICAL"
        ? cache.criticalStartedAt || nowMs
        : nowMs
      : undefined;

  try {
    await prisma.reading.create({
      data: {
        zoneId: zone_id,
        seq,
        flameRaw: sensors.flame_raw,
        gasRaw: sensors.gas_raw,
        waterRaw: sensors.water_raw,
        motion: sensors.motion,
        riskScore: activeScore,
        state,
        recordedAt: new Date(timestamp_ms),
      },
    });

    await prisma.zone.update({
      where: { id: zone_id },
      data: { lastSeenAt: new Date() },
    });
  } catch (error: any) {
    if (error?.code !== "P2002") {
      console.error("Failed to save reading:", error);
    }
  }

  if (state === "CRITICAL") {
    const existingIncident = await prisma.incident.findFirst({
      where: {
        zoneId: zone_id,
        status: { in: ["OPEN", "ACKED"] },
      },
    });

    if (!existingIncident) {
      const hazards: string[] = [];
      if (debouncedFlame) hazards.push(KNOWN_HAZARD_TYPES[0]); // "fire"
      if (sensors.gas_raw > 400) hazards.push(KNOWN_HAZARD_TYPES[1]); // "gas"
      if (sensors.water_raw > 400) hazards.push(KNOWN_HAZARD_TYPES[2]); // "water"

      const newIncident = await prisma.incident.create({
        data: {
          zoneId: zone_id,
          status: "OPEN",
          hazardTypes: hazards.length > 0 ? hazards : [KNOWN_HAZARD_TYPES[0]],
          peakRiskScore: activeScore,
          source: "sensor",
          transitions: {
            create: {
              fromState: cache.state,
              toState: "CRITICAL",
              riskScore: activeScore,
            },
          },
        },
      });

      broadcastIncidentOpened({
        incident_id: newIncident.id,
        zone_id,
        hazard_types: newIncident.hazardTypes,
        opened_at: newIncident.openedAt.toISOString(),
        risk_score: activeScore,
      });
    } else if (activeScore > existingIncident.peakRiskScore) {
      await prisma.incident.update({
        where: { id: existingIncident.id },
        data: { peakRiskScore: activeScore },
      });
    }
  } else if (state === "SAFE" && (cache.state === "CRITICAL" || cache.state === "WARNING")) {
    const activeIncident = await prisma.incident.findFirst({
      where: {
        zoneId: zone_id,
        status: { in: ["OPEN", "ACKED"] },
      },
    });

    if (activeIncident) {
      const resolvedAt = new Date();
      await prisma.incident.update({
        where: { id: activeIncident.id },
        data: {
          status: "RESOLVED",
          resolvedAt,
        },
      });

      await prisma.incidentTransition.create({
        data: {
          incidentId: activeIncident.id,
          fromState: cache.state,
          toState: "SAFE",
          riskScore: activeScore,
          occurredAt: resolvedAt,
        },
      });

      broadcastIncidentResolved({
        incident_id: activeIncident.id,
        resolved_at: resolvedAt.toISOString(),
      });
    }
  }

  const response: ReadingResponseAccepted = {
    accepted: true,
    state,
    risk_score: activeScore,
    commands: {
      led: state === "OFFLINE" ? "offline" : fusion.commands.led,
      buzzer: state === "OFFLINE" ? false : fusion.commands.buzzer,
      relay_cutoff: state === "OFFLINE" ? false : fusion.commands.relay_cutoff,
    },
    server_seq_ack: seq,
  };

  zoneCache[zone_id] = {
    seq,
    state,
    riskScore: activeScore,
    occupied: sensors.motion,
    criticalStartedAt,
    lastResponse: response,
    lastSeenAt: nowMs,
  };

  broadcastZoneState({
    zone_id,
    state,
    risk_score: activeScore,
    contributions: fusion.contributions,
    occupied: sensors.motion,
    updated_at: new Date().toISOString(),
  });

  await recalculateAndBroadcastPriority();

  return response;
}

export async function recalculateAndBroadcastPriority() {
  const ranked = await getPriorityQueue();
  broadcastPriorityUpdate({ ranked });
}
