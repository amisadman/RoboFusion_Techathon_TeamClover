"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertDiamondIcon } from "@hugeicons/core-free-icons";
import { useRealtime } from "@/providers/realtime-provider";
import { useAckIncident } from "@/hooks/use-ack-incident";
import { Button } from "@/components/ui/button";
import { formatRiskScore } from "@/lib/format";

function toastId(incidentId: string) {
  return `incident-${incidentId}`;
}

function OpenedIncidentToast({
  incidentId,
  zoneName,
  hazardTypes,
  riskScore,
}: {
  incidentId: string;
  zoneName: string;
  hazardTypes: string[];
  riskScore: number;
}) {
  const { acknowledge, isPending } = useAckIncident();

  return (
    <div className="flex w-full items-start gap-2.5 rounded-sm border border-critical bg-surface p-3 text-text-primary shadow-none">
      <HugeiconsIcon icon={AlertDiamondIcon} strokeWidth={2} className="mt-0.5 size-4 shrink-0 text-critical" />
      <div className="flex-1 space-y-1">
        <p className="font-heading text-sm font-semibold text-critical">Incident opened -- {zoneName}</p>
        <p className="text-xs text-text-muted">
          {hazardTypes.length > 0 ? hazardTypes.join(", ") : "Hazard detected"} · Risk{" "}
          <span className="font-mono">{formatRiskScore(riskScore)}</span>
        </p>
      </div>
      <Button
        size="sm"
        variant="destructive"
        disabled={isPending(incidentId)}
        onClick={async () => {
          const handled = await acknowledge(incidentId);
          if (handled) toast.dismiss(toastId(incidentId));
        }}
      >
        Acknowledge
      </Button>
    </div>
  );
}

export function RealtimeToaster() {
  const { incidentEvents, zones } = useRealtime();
  const processedCount = useRef(0);

  useEffect(() => {
    const newEvents = incidentEvents.slice(processedCount.current);
    processedCount.current = incidentEvents.length;

    for (const event of newEvents) {
      if (event.type === "opened") {
        const zoneName = zones[event.payload.zone_id]?.name ?? event.payload.zone_id;
        toast.custom(
          () => (
            <OpenedIncidentToast
              incidentId={event.payload.incident_id}
              zoneName={zoneName}
              hazardTypes={event.payload.hazard_types}
              riskScore={event.payload.risk_score}
            />
          ),
          { id: toastId(event.payload.incident_id), duration: Infinity }
        );
      } else if (event.type === "acked" || event.type === "resolved") {
        toast.dismiss(toastId(event.payload.incident_id));
      }
    }
    // zones is intentionally excluded -- it updates far more often than
    // incidentEvents and we only need the latest snapshot when a new event
    // actually arrives, not a re-run on every zone tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentEvents]);

  return null;
}
