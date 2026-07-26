"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { User02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { formatRiskScore } from "@/lib/format";
import { HAZARD_STATE_RANK } from "@/lib/status";
import { HazardStatusIndicator } from "@/components/hazard-status-indicator";
import { HazardBreakdown } from "@/components/dashboard/hazard-breakdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ZoneSummary } from "@/types/contract";

function ZoneCard({ zone }: { zone: ZoneSummary }) {
  const borderClass =
    zone.state === "CRITICAL"
      ? "border-critical"
      : zone.state === "WARNING"
        ? "border-warning"
        : zone.state === "OFFLINE"
          ? "border-offline"
          : "border-safe";

  return (
    <Card className={cn("gap-3 rounded-sm border-2 bg-surface", borderClass)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-heading text-sm font-semibold text-foreground">{zone.name}</CardTitle>
          <HazardStatusIndicator state={zone.state} size="sm" />
        </div>
      </CardHeader>
      <CardContent className="flex items-end justify-between">
        <div>
          <p className="text-[0.625rem] tracking-wide text-text-muted uppercase">Risk score</p>
          <p className="font-mono text-xl leading-none text-foreground tabular-nums">
            {formatRiskScore(zone.risk_score)}
          </p>
        </div>
        {zone.occupied && (
          <span className="inline-flex items-center gap-1 rounded-sm border border-hairline px-1.5 py-0.5 text-[0.625rem] text-text-muted">
            <HugeiconsIcon icon={User02Icon} strokeWidth={2} className="size-3" />
            Occupied
          </span>
        )}
      </CardContent>
      <HazardBreakdown contributions={zone.contributions} riskScore={zone.risk_score} />
    </Card>
  );
}

export function ZoneMap({ zones }: { zones: Record<string, ZoneSummary> }) {
  const sorted = Object.values(zones).sort((a, b) => {
    const rankDiff = HAZARD_STATE_RANK[a.state] - HAZARD_STATE_RANK[b.state];
    if (rankDiff !== 0) return rankDiff;
    return b.risk_score - a.risk_score;
  });

  if (sorted.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-text-muted">
        No zones reporting yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((zone) => (
        <ZoneCard key={zone.zone_id} zone={zone} />
      ))}
    </div>
  );
}
