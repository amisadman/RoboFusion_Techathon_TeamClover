export interface CriticalZoneInfo {
  incident_id?: string;
  zone_id: string;
  risk_score: number;
  occupied: boolean;
  openedAt: number; // ms timestamp when incident was opened
  source?: "sensor" | "manual_override" | "nl_report";
  hazard_types?: string[];
}

export interface RankedZoneResult {
  zone_id: string;
  rank: number;
  risk_score: number;
  occupied: boolean;
  seconds_critical: number;
  reason: string;
  source?: "sensor" | "manual_override" | "nl_report";
  incident_id?: string;
}

export function rankCriticalZones(zones: CriticalZoneInfo[]): RankedZoneResult[] {
  const now = Date.now();

  const sorted = [...zones].sort((a, b) => {
    // 1. Sort by peakRiskScore DESC
    if (b.risk_score !== a.risk_score) {
      return b.risk_score - a.risk_score;
    }
    // 2. Sort by occupied DESC (true > false)
    if (a.occupied !== b.occupied) {
      return a.occupied ? -1 : 1;
    }
    // 3. Sort by seconds open DESC (longer open time first)
    const secondsA = Math.floor((now - a.openedAt) / 1000);
    const secondsB = Math.floor((now - b.openedAt) / 1000);
    return secondsB - secondsA;
  });

  return sorted.map((z, index) => {
    const secondsCritical = Math.max(0, Math.floor((now - z.openedAt) / 1000));
    let reason = "";

    if (z.source === "nl_report") {
      reason = `reported via text input, risk ${z.risk_score}, open ${secondsCritical}s`;
    } else if (z.source === "manual_override") {
      reason = `manual override, risk ${z.risk_score}, open ${secondsCritical}s`;
    } else {
      const occStr = z.occupied ? "occupied" : "empty";
      reason = `risk ${z.risk_score}, ${occStr}, critical ${secondsCritical}s`;
    }

    return {
      zone_id: z.zone_id,
      rank: index + 1,
      risk_score: z.risk_score,
      occupied: z.occupied,
      seconds_critical: secondsCritical,
      reason,
      source: z.source || "sensor",
      incident_id: z.incident_id,
    };
  });
}
