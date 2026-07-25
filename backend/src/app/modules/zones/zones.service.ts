import { prisma } from "../../config/prisma.js";
import { getZoneCache, updateZoneCacheItem, recalculateAndBroadcastPriority } from "../readings/readings.service.js";
import { broadcastZoneState, broadcastIncidentOpened, broadcastIncidentResolved } from "../../config/socket.js";
import { HazardState } from "../../types/contract.js";

export async function getAllZonesState() {
  const dbZones = await prisma.zone.findMany({
    where: { archived: false },
    select: {
      id: true,
      name: true,
      hazardProfile: true,
      lastSeenAt: true,
    },
  });

  const cache = getZoneCache();

  return dbZones.map((z: any) => {
    const cached = cache[z.id] || {
      state: "SAFE",
      riskScore: 0,
      occupied: false,
    };

    return {
      zone_id: z.id,
      name: z.name,
      hazard_profile: z.hazardProfile,
      state: cached.state as HazardState,
      risk_score: cached.riskScore,
      occupied: cached.occupied,
      last_seen_at: z.lastSeenAt ? z.lastSeenAt.toISOString() : null,
    };
  });
}

export async function applyAdminOverride(
  zoneId: string,
  targetState: "CRITICAL" | "SAFE",
  adminUserId: string
) {
  const zone = await prisma.zone.findUnique({
    where: { id: zoneId },
  });

  if (!zone || zone.archived) {
    throw new Error("Zone not found or archived");
  }

  const cache = getZoneCache();
  const previousState = cache[zoneId]?.state || "SAFE";
  const newScore = targetState === "CRITICAL" ? 85.0 : 0.0;

  updateZoneCacheItem(zoneId, {
    state: targetState,
    riskScore: newScore,
    criticalStartedAt: targetState === "CRITICAL" ? Date.now() : undefined,
  });

  if (targetState === "CRITICAL") {
    // Open override incident
    const existingIncident = await prisma.incident.findFirst({
      where: { zoneId, status: { in: ["OPEN", "ACKED"] } },
    });

    if (!existingIncident) {
      const incident = await prisma.incident.create({
        data: {
          zoneId,
          status: "OPEN",
          hazardTypes: ["manual_override"],
          peakRiskScore: newScore,
          source: "manual_override",
          transitions: {
            create: {
              fromState: previousState,
              toState: "CRITICAL",
              riskScore: newScore,
            },
          },
        },
      });

      broadcastIncidentOpened({
        incident_id: incident.id,
        zone_id: zoneId,
        hazard_types: incident.hazardTypes,
        opened_at: incident.openedAt.toISOString(),
        risk_score: newScore,
      });
    }
  } else {
    // Resolve any open incident
    const activeIncident = await prisma.incident.findFirst({
      where: { zoneId, status: { in: ["OPEN", "ACKED"] } },
    });

    if (activeIncident) {
      const resolvedAt = new Date();
      await prisma.incident.update({
        where: { id: activeIncident.id },
        data: { status: "RESOLVED", resolvedAt },
      });

      await prisma.incidentTransition.create({
        data: {
          incidentId: activeIncident.id,
          fromState: previousState,
          toState: "SAFE",
          riskScore: 0,
          occurredAt: resolvedAt,
        },
      });

      broadcastIncidentResolved({
        incident_id: activeIncident.id,
        resolved_at: resolvedAt.toISOString(),
      });
    }
  }

  broadcastZoneState({
    zone_id: zoneId,
    state: targetState,
    risk_score: newScore,
    contributions: { fire: 0, gas: 0, water: 0, occupancy: 0 },
    occupied: cache[zoneId]?.occupied || false,
    updated_at: new Date().toISOString(),
  });

  recalculateAndBroadcastPriority();

  return {
    success: true,
    zone_id: zoneId,
    state: targetState,
    override_by: adminUserId,
  };
}
