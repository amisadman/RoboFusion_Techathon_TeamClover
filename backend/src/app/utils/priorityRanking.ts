export interface CriticalZoneInfo {
  zone_id: string;
  risk_score: number;
  occupied: boolean;
  criticalStartedAt: number; // ms timestamp when state became CRITICAL
}

export interface RankedZoneResult {
  zone_id: string;
  rank: number;
  risk_score: number;
  occupied: boolean;
  seconds_critical: number;
  reason: string;
}

export function rankCriticalZones(zones: CriticalZoneInfo[]): RankedZoneResult[] {
  const now = Date.now();

  const sorted = [...zones].sort((a, b) => {
    // 1. Sort by risk_score DESC
    if (b.risk_score !== a.risk_score) {
      return b.risk_score - a.risk_score;
    }
    // 2. Sort by occupied DESC (true > false)
    if (a.occupied !== b.occupied) {
      return a.occupied ? -1 : 1;
    }
    // 3. Sort by seconds_critical DESC (longer critical time first)
    const secondsA = Math.floor((now - a.criticalStartedAt) / 1000);
    const secondsB = Math.floor((now - b.criticalStartedAt) / 1000);
    return secondsB - secondsA;
  });

  return sorted.map((z, index) => {
    const secondsCritical = Math.max(0, Math.floor((now - z.criticalStartedAt) / 1000));
    const occStr = z.occupied ? "occupied" : "empty";
    const reason = `risk ${z.risk_score}, ${occStr}, critical ${secondsCritical}s`;

    return {
      zone_id: z.zone_id,
      rank: index + 1,
      risk_score: z.risk_score,
      occupied: z.occupied,
      seconds_critical: secondsCritical,
      reason,
    };
  });
}
