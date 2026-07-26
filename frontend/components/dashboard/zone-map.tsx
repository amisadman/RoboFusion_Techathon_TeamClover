"use client";

import { useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { User02Icon, ArrowUp02Icon, ArrowDown02Icon, MinusIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { formatRiskScore } from "@/lib/format";
import { HAZARD_STATE_RANK } from "@/lib/status";
import { api } from "@/lib/api";
import { HazardStatusIndicator } from "@/components/hazard-status-indicator";
import { HazardBreakdown } from "@/components/dashboard/hazard-breakdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ZoneSummary, TrendResponse, MlPredictResponse } from "@/types/contract";

function ZoneBonusPanel({ zoneId }: { zoneId: string }) {
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [predict, setPredict] = useState<MlPredictResponse | null>(null);

  useEffect(() => {
    let active = true;

    const fetchBonusData = () => {
      Promise.allSettled([
        api.trend(zoneId),
        api.mlPredict(zoneId),
      ]).then(([trendResult, predictResult]) => {
        if (!active) return;
        if (trendResult.status === "fulfilled") {
          setTrend(trendResult.value);
        }
        if (predictResult.status === "fulfilled") {
          setPredict(predictResult.value);
        }
      });
    };

    fetchBonusData();
    const timer = setInterval(fetchBonusData, 15000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [zoneId]);

  if (!trend && !predict) return null;

  const trendIcon =
    trend?.trend === "RISING"
      ? ArrowUp02Icon
      : trend?.trend === "FALLING"
        ? ArrowDown02Icon
        : MinusIcon;

  const trendWord =
    trend?.trend === "RISING"
      ? "Rising"
      : trend?.trend === "FALLING"
        ? "Falling"
        : "Stable";

  return (
    <div className="mt-2.5 border-t border-hairline pt-2.5 space-y-2 text-xs text-text-muted">
      {trend && (
        <div className="flex items-center justify-between">
          <span className="text-[0.625rem] tracking-wide font-medium uppercase text-text-muted">
            Trend
          </span>
          <div className="inline-flex items-center gap-1 font-medium text-text-muted">
            <HugeiconsIcon icon={trendIcon} strokeWidth={2} className="size-3.5" />
            <span>{trendWord}</span>
          </div>
        </div>
      )}

      {predict && (
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[0.625rem] tracking-wide font-medium uppercase text-text-muted">
              Predicted Risk
            </span>
            <span className="text-[0.5625rem] text-text-muted font-mono">
              {predict.model || "logistic_regression_v1"}
            </span>
          </div>
          <span className="font-mono text-sm font-semibold tabular-nums text-text-muted">
            {(predict.predicted_critical_probability * 100).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

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
    <Card className={cn("gap-3 rounded-sm border-2 bg-surface p-3", borderClass)}>
      <CardHeader className="p-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-heading text-sm font-semibold text-foreground">{zone.name}</CardTitle>
          <HazardStatusIndicator state={zone.state} size="sm" />
        </div>
      </CardHeader>
      <CardContent className="flex items-end justify-between p-0 my-2">
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
      <ZoneBonusPanel zoneId={zone.zone_id} />
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
