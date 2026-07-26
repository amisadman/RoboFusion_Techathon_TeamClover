"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { User02Icon } from "@hugeicons/core-free-icons";
import { formatRiskScore } from "@/lib/format";
import { HazardStatusIndicator } from "@/components/hazard-status-indicator";
import { CriticalTimer } from "@/components/dashboard/critical-timer";
import { Button } from "@/components/ui/button";
import { useAckIncident } from "@/hooks/use-ack-incident";
import type { useOpenIncidentsByZone } from "@/hooks/use-open-incidents-by-zone";
import type { PriorityUpdateEvent, ZoneSummary } from "@/types/contract";

type Ranked = PriorityUpdateEvent["ranked"][number];

function formatSourceLabel(source?: string | null): string {
  if (!source) return "Sensor";
  if (source === "manual_override") return "Manual Override";
  if (source === "nl_report") return "NL Report";
  return "Sensor";
}

function LedgerRow({
  row,
  zone,
  openIncidentsByZone,
}: {
  row: Ranked;
  zone: ZoneSummary | undefined;
  openIncidentsByZone: ReturnType<typeof useOpenIncidentsByZone>;
}) {
  const { acknowledge, isPending } = useAckIncident();
  const incident = openIncidentsByZone[row.zone_id];

  return (
    <li className="flex items-start gap-3 border-b border-hairline p-3 last:border-b-0">
      <span className="font-mono text-2xl leading-none font-semibold text-text-muted tabular-nums" aria-hidden="true">
        {String(row.rank).padStart(2, "0")}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-heading text-sm font-semibold text-foreground">
            {zone?.name ?? row.zone_id}
          </span>
          <span className="rounded-sm border border-hairline px-1 py-0.5 text-[0.625rem] font-medium text-text-muted">
            {formatSourceLabel(row.source)}
          </span>
          {zone && <HazardStatusIndicator state={zone.state} size="sm" />}
          {row.occupied && (
            <span className="inline-flex items-center gap-1 text-[0.625rem] text-text-muted">
              <HugeiconsIcon icon={User02Icon} strokeWidth={2} className="size-3" />
              Occupied
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-sm text-foreground tabular-nums">
            Risk {formatRiskScore(row.risk_score)}
          </span>
          {zone?.state === "CRITICAL" && <CriticalTimer seconds={row.seconds_critical} />}
        </div>

        <p className="mt-1 text-xs text-text-muted">{row.reason}</p>
      </div>

      <Button
        size="sm"
        variant="destructive"
        className="shrink-0"
        disabled={!incident || isPending(incident.id)}
        onClick={() => incident && acknowledge(incident.id)}
      >
        Acknowledge
      </Button>
    </li>
  );
}

export function DispatchLedger({
  ranked,
  zones,
  openIncidentsByZone,
}: {
  ranked: PriorityUpdateEvent["ranked"];
  zones: Record<string, ZoneSummary>;
  openIncidentsByZone: ReturnType<typeof useOpenIncidentsByZone>;
}) {
  if (ranked.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center">
        <p className="text-sm text-foreground">All zones reporting normal.</p>
        <p className="text-xs text-text-muted">No action needed.</p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col">
      {ranked.map((row) => (
        <LedgerRow
          key={row.zone_id}
          row={row}
          zone={zones[row.zone_id]}
          openIncidentsByZone={openIncidentsByZone}
        />
      ))}
    </ol>
  );
}
