import { prisma } from "../../config/prisma.js";
import { broadcastIncidentAcked } from "../../config/socket.js";
import { recalculateAndBroadcastPriority } from "../readings/readings.service.js";

export interface IncidentFilterOptions {
  from?: string;
  to?: string;
  zoneId?: string;
  status?: string;
}

export async function getHistoricalIncidents(filters: IncidentFilterOptions) {
  const where: any = {};

  if (filters.zoneId) {
    where.zoneId = filters.zoneId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.from || filters.to) {
    where.openedAt = {};
    if (filters.from) {
      where.openedAt.gte = new Date(filters.from);
    }
    if (filters.to) {
      where.openedAt.lte = new Date(filters.to);
    }
  }

  const incidents = await prisma.incident.findMany({
    where,
    orderBy: { openedAt: "desc" },
    include: {
      zone: { select: { name: true } },
      ackUser: { select: { id: true, name: true, email: true } },
      transitions: { orderBy: { occurredAt: "asc" } },
    },
  });

  return incidents.map((inc: any) => ({
    id: inc.id,
    zone_id: inc.zoneId,
    zone_name: inc.zone.name,
    status: inc.status,
    hazard_types: inc.hazardTypes,
    peak_risk_score: inc.peakRiskScore,
    source: inc.source,
    opened_at: inc.openedAt.toISOString(),
    acknowledged_by: inc.acknowledgedBy,
    acknowledged_by_user: inc.ackUser,
    acknowledged_at: inc.acknowledgedAt ? inc.acknowledgedAt.toISOString() : null,
    resolved_at: inc.resolvedAt ? inc.resolvedAt.toISOString() : null,
    duration_seconds: inc.resolvedAt
      ? Math.floor((inc.resolvedAt.getTime() - inc.openedAt.getTime()) / 1000)
      : Math.floor((Date.now() - inc.openedAt.getTime()) / 1000),
    transitions: inc.transitions,
  }));
}

export async function getIncidentById(incidentId: string) {
  const inc = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      zone: { select: { name: true } },
      ackUser: { select: { id: true, name: true, email: true } },
      transitions: { orderBy: { occurredAt: "asc" } },
    },
  });

  if (!inc) {
    throw new Error("Incident not found");
  }

  return {
    id: inc.id,
    zone_id: inc.zoneId,
    zone_name: inc.zone.name,
    status: inc.status,
    hazard_types: inc.hazardTypes,
    peak_risk_score: inc.peakRiskScore,
    source: inc.source,
    opened_at: inc.openedAt.toISOString(),
    acknowledged_by: inc.acknowledgedBy,
    acknowledged_by_user: inc.ackUser,
    acknowledged_at: inc.acknowledgedAt ? inc.acknowledgedAt.toISOString() : null,
    resolved_at: inc.resolvedAt ? inc.resolvedAt.toISOString() : null,
    duration_seconds: inc.resolvedAt
      ? Math.floor((inc.resolvedAt.getTime() - inc.openedAt.getTime()) / 1000)
      : Math.floor((Date.now() - inc.openedAt.getTime()) / 1000),
    transitions: inc.transitions,
  };
}

export async function acknowledgeIncident(incidentId: string, userId: string) {
  const now = new Date();

  const updateResult = await prisma.incident.updateMany({
    where: {
      id: incidentId,
      acknowledgedBy: null,
    },
    data: {
      acknowledgedBy: userId,
      acknowledgedAt: now,
      status: "ACKED",
    },
  });

  if (updateResult.count === 0) {
    const existing = await prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!existing) {
      return { success: false, statusCode: 404, error: "incident_not_found", detail: "Incident ID does not exist" };
    }

    return { success: false, statusCode: 409, error: "already_acknowledged", detail: "Incident has already been acknowledged" };
  }

  await prisma.incidentTransition.create({
    data: {
      incidentId,
      fromState: "OPEN",
      toState: "ACKED",
      riskScore: 0,
      occurredAt: now,
    },
  });

  broadcastIncidentAcked({
    incident_id: incidentId,
    acknowledged_by: userId,
    acknowledged_at: now.toISOString(),
  });

  await recalculateAndBroadcastPriority();

  return {
    success: true,
    statusCode: 200,
    incident_id: incidentId,
    acknowledged_by: userId,
    acknowledged_at: now.toISOString(),
  };
}
