"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

// Shared Acknowledge action for the Dispatch Ledger and the incident
// toaster. Handles the 409 "already acknowledged" case as a normal
// outcome, not an error -- someone else on the team got there first.
export function useAckIncident() {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function acknowledge(incidentId: string) {
    setPendingIds((prev) => new Set(prev).add(incidentId));
    try {
      await api.ackIncident(incidentId);
      toast.success("Incident acknowledged");
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.message("Incident already acknowledged");
        return true;
      }
      toast.error("Acknowledge failed", {
        description: "Check the connection and try again.",
      });
      return false;
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(incidentId);
        return next;
      });
    }
  }

  return { acknowledge, isPending: (incidentId: string) => pendingIds.has(incidentId) };
}
