"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Incident } from "@/types/contract";
import { useRealtime } from "@/providers/realtime-provider";

// The priority:update socket payload (types/contract.ts PriorityUpdateEvent)
// is zone-ranked and carries no incident_id, but the Dispatch Ledger's
// Acknowledge action needs one. This bridges the gap with the existing
// api.getIncidents({status:"OPEN"}) endpoint instead of inventing a new
// field on the socket payload -- see the chat writeup for the flagged gap.
export function useOpenIncidentsByZone() {
  const { incidentEvents } = useRealtime();
  const [byZone, setByZone] = useState<Record<string, Incident>>({});

  useEffect(() => {
    let cancelled = false;
    api
      .getIncidents({ status: "OPEN" })
      .then((incidents) => {
        if (cancelled) return;
        const map: Record<string, Incident> = {};
        for (const incident of incidents) map[incident.zone_id] = incident;
        setByZone(map);
      })
      .catch((err) => console.error("failed to load open incidents", err));
    return () => {
      cancelled = true;
    };
  }, [incidentEvents.length]);

  return byZone;
}
