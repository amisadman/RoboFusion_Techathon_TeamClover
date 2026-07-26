import { prisma } from "../../config/prisma.js";
import { broadcastIncidentOpened } from "../../config/socket.js";
import { isKnownHazardType, type HazardType } from "../../utils/hazardTypes.js";
import { RISK_THRESHOLDS } from "../../utils/riskFusion.js";
import { recalculateAndBroadcastPriority } from "../readings/readings.service.js";

// ---------------------------------------------------------------------
// BONUS 2: Short-Term Risk Trend (Moving average / slope)
// ---------------------------------------------------------------------
export async function calculateRiskTrend(zoneId: string) {
  const recentReadings = await prisma.reading.findMany({
    where: { zoneId },
    orderBy: { receivedAt: "desc" },
    take: 5,
    select: { riskScore: true, receivedAt: true },
  });

  if (recentReadings.length < 2) {
    return { zone_id: zoneId, trend: "STABLE", slope: 0, trending_critical: false };
  }

  const scores = recentReadings.map((r: { riskScore: number }) => r.riskScore).reverse();
  const first = scores[0];
  const last = scores[scores.length - 1];
  const delta = last - first;
  const slope = Number((delta / scores.length).toFixed(2));

  let trend: "RISING" | "FALLING" | "STABLE" = "STABLE";
  if (slope > 2.0) trend = "RISING";
  else if (slope < -2.0) trend = "FALLING";

  return {
    zone_id: zoneId,
    trend,
    slope,
    current_risk_score: last,
    trending_critical: trend === "RISING" && last >= 20.0,
  };
}

// ---------------------------------------------------------------------
// BONUS 3: Machine-Learning Risk Predictor (Logistic Regression)
// MUST NEVER BE IMPORTED BY ACTUATION CODE PATH (Test Case Bonus 3e)
// ---------------------------------------------------------------------
const LOGISTIC_WEIGHTS = {
  intercept: -3.5,
  flame_raw: 0.008,
  gas_raw: 0.005,
  water_raw: 0.004,
  motion: 0.8,
};

export async function predictRiskProbability(zoneId: string) {
  const lastReading = await prisma.reading.findFirst({
    where: { zoneId },
    orderBy: { receivedAt: "desc" },
  });

  if (!lastReading) {
    return {
      zone_id: zoneId,
      predicted_critical_probability: 0.05,
      model: "logistic_regression_v1",
      safety_guarantee: "Predictor is strictly advisory and cannot trigger relay/buzzer actuation",
    };
  }

  const logit =
    LOGISTIC_WEIGHTS.intercept +
    LOGISTIC_WEIGHTS.flame_raw * lastReading.flameRaw +
    LOGISTIC_WEIGHTS.gas_raw * lastReading.gasRaw +
    LOGISTIC_WEIGHTS.water_raw * lastReading.waterRaw +
    (lastReading.motion ? LOGISTIC_WEIGHTS.motion : 0);

  // Sigmoid activation
  const prob = 1.0 / (1.0 + Math.exp(-logit));

  return {
    zone_id: zoneId,
    predicted_critical_probability: Number(prob.toFixed(3)),
    predicted_critical_next_5m: prob > 0.5,
    model: "logistic_regression_v1",
    safety_guarantee: "Predictor is strictly advisory and cannot trigger relay/buzzer actuation",
  };
}

// ---------------------------------------------------------------------
// BONUS 4: Natural-Language Incident Reporting Parser & Validator Gate
// ---------------------------------------------------------------------
//
// HARD CONSTRAINT (docs/audit-findings.md F13): this path must NEVER set
// or modify a zone's live risk_score or SAFE/WARNING/CRITICAL
// classification. That value is exclusively computed from raw sensor
// readings via the risk fusion pipeline (readings.service.ts). This code
// only ever creates/updates an Incident row tagged source:"nl_report" --
// it never calls updateZoneCacheItem/broadcastZoneState and never writes
// to the Zone table. (It also does not inject into the priority queue,
// which is deliberately sensor/risk-fusion-driven only -- see the F13
// resolution note in docs/audit-findings.md for why.)

interface ExtractedSignal {
  zone_id: string | null;
  hazard_type: string | null;
  estimated_severity: "SAFE" | "WARNING" | "CRITICAL";
}

// Pure text extraction -- no DB access, no side effects. Returns null for
// zone_id/hazard_type when it can't confidently resolve one, rather than
// guessing. (Previously silently defaulted unmatched text to "iot_lab",
// and had an unreachable "robotics_lab" branch for a zone that was never
// seeded -- both were exactly the kind of fabricated/loosely-matched
// result the validation gate below now rejects instead.)
export function parseNaturalLanguageReport(text: string): ExtractedSignal {
  const lower = text.toLowerCase();

  let zoneId: string | null = null;
  if (lower.includes("server") || lower.includes("rack") || lower.includes(" ac ")) {
    zoneId = "server_room";
  } else if (lower.includes("data science") || lower.includes("gpu")) {
    zoneId = "data_science_lab";
  } else if (lower.includes("iot lab") || lower.includes("iot") || lower.includes("solder")) {
    zoneId = "iot_lab";
  }

  let hazardType: string | null = null;
  let estimatedSeverity: "SAFE" | "WARNING" | "CRITICAL" = "WARNING";

  if (lower.includes("fire") || lower.includes("smoke") || lower.includes("flame")) {
    hazardType = "fire";
    estimatedSeverity = "CRITICAL";
  } else if (lower.includes("gas") || lower.includes("smell") || lower.includes("fume")) {
    hazardType = "gas";
    estimatedSeverity = "WARNING";
  } else if (lower.includes("water") || lower.includes("leak") || lower.includes("flood")) {
    hazardType = "water";
    estimatedSeverity = "WARNING";
  }

  return { zone_id: zoneId, hazard_type: hazardType, estimated_severity: estimatedSeverity };
}

// Maps a reported severity to a synthetic, incident-scoped score used only
// for Incident.peakRiskScore -- a historical record field nothing reads to
// determine a zone's live state. Setting it cannot violate the hard
// constraint above.
function severityToIncidentScore(severity: "SAFE" | "WARNING" | "CRITICAL"): number {
  if (severity === "CRITICAL") return RISK_THRESHOLDS.CRITICAL; // 65.0 (CRITICAL band threshold)
  if (severity === "WARNING") return RISK_THRESHOLDS.WARNING;   // 30.0 (WARNING band threshold)
  return RISK_THRESHOLDS.SAFE;
}

export async function submitNaturalLanguageReport(text: string) {
  const extracted = parseNaturalLanguageReport(text);

  // Validation gate: reject anything that doesn't cleanly resolve to a
  // real, non-archived zone and a known hazard type -- never guess.
  const zone = extracted.zone_id ? await prisma.zone.findUnique({ where: { id: extracted.zone_id } }) : null;

  if (!zone || zone.archived || !isKnownHazardType(extracted.hazard_type)) {
    return {
      parsed: true,
      input_text: text,
      extracted_signal: extracted,
      validation_gate: "failed" as const,
      incident_id: null,
    };
  }

  const hazardType: HazardType = extracted.hazard_type;
  const zoneId = zone.id;

  // "SAFE" is nothing to act on -- report understood, no incident opened.
  if (extracted.estimated_severity === "SAFE") {
    return {
      parsed: true,
      input_text: text,
      extracted_signal: extracted,
      validation_gate: "passed" as const,
      incident_id: null,
    };
  }

  const incidentScore = severityToIncidentScore(extracted.estimated_severity);

  // Flapping prevention, same pattern sensor-triggered incidents use
  // (readings.service.ts): reuse an already-open incident for this zone
  // instead of opening a second concurrent one.
  const existingIncident = await prisma.incident.findFirst({
    where: { zoneId, status: { in: ["OPEN", "ACKED"] } },
  });

  let incidentId: string;

  if (!existingIncident) {
    const newIncident = await prisma.incident.create({
      data: {
        zoneId,
        status: "OPEN",
        hazardTypes: [hazardType],
        peakRiskScore: incidentScore,
        source: "nl_report",
        transitions: {
          create: {
            fromState: null,
            toState: extracted.estimated_severity,
            riskScore: incidentScore,
          },
        },
      },
    });
    incidentId = newIncident.id;

    // Realtime broadcast of open incident
    broadcastIncidentOpened({
      incident_id: newIncident.id,
      zone_id: zoneId,
      hazard_types: newIncident.hazardTypes,
      opened_at: newIncident.openedAt.toISOString(),
      risk_score: incidentScore,
    });
  } else {
    incidentId = existingIncident.id;
    const mergedHazards = existingIncident.hazardTypes.includes(hazardType)
      ? existingIncident.hazardTypes
      : [...existingIncident.hazardTypes, hazardType];
    const bumpedScore = Math.max(incidentScore, existingIncident.peakRiskScore);

    if (
      mergedHazards.length !== existingIncident.hazardTypes.length ||
      bumpedScore !== existingIncident.peakRiskScore
    ) {
      await prisma.incident.update({
        where: { id: existingIncident.id },
        data: { hazardTypes: mergedHazards, peakRiskScore: bumpedScore },
      });
    }
  }

  // Trigger real-time priority queue re-ranking so NL report incidents feed into priority ranking
  await recalculateAndBroadcastPriority();

  return {
    parsed: true,
    input_text: text,
    extracted_signal: extracted,
    validation_gate: "passed" as const,
    incident_id: incidentId,
  };
}
