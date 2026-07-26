"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { api } from "@/lib/api";
import type {
  ZoneSummary,
  ZoneStateEvent,
  PriorityUpdateEvent,
  ZoneOfflineEvent,
  IncidentOpenedEvent,
  IncidentAckedEvent,
  IncidentResolvedEvent,
} from "@/types/contract";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

type IncidentEvent =
  | { type: "opened"; payload: IncidentOpenedEvent; at: number }
  | { type: "acked"; payload: IncidentAckedEvent; at: number }
  | { type: "resolved"; payload: IncidentResolvedEvent; at: number };

export interface RiskHistoryPoint {
  timestamp: string;
  risk_score: number;
}

interface RealtimeContextValue {
  connected: boolean;
  zones: Record<string, ZoneSummary>;
  priorityQueue: PriorityUpdateEvent["ranked"];
  incidentEvents: IncidentEvent[];
  historyBuffer: Record<string, RiskHistoryPoint[]>;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const MAX_INCIDENT_EVENTS = 50;
const MAX_HISTORY_POINTS = 60;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [zones, setZones] = useState<Record<string, ZoneSummary>>({});
  const [priorityQueue, setPriorityQueue] = useState<PriorityUpdateEvent["ranked"]>([]);
  const [incidentEvents, setIncidentEvents] = useState<IncidentEvent[]>([]);
  const [historyBuffer, setHistoryBuffer] = useState<Record<string, RiskHistoryPoint[]>>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initial snapshot via REST
    api
      .getZones()
      .then((list) => {
        setZones((prev) => {
          const merged: Record<string, ZoneSummary> = { ...prev };
          for (const z of list) merged[z.zone_id] = { ...z, ...merged[z.zone_id] };
          return merged;
        });

        setHistoryBuffer((prev) => {
          const updated = { ...prev };
          const nowIso = new Date().toISOString();
          for (const z of list) {
            if (!updated[z.zone_id] || updated[z.zone_id].length === 0) {
              updated[z.zone_id] = [{ timestamp: z.last_seen_at || nowIso, risk_score: z.risk_score }];
            }
          }
          return updated;
        });
      })
      .catch((err) => console.error("initial /api/zones fetch failed", err));

    const socket = io(BACKEND_URL, { withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("zone:state", (evt: ZoneStateEvent) => {
      setZones((prev) => ({
        ...prev,
        [evt.zone_id]: {
          ...prev[evt.zone_id],
          zone_id: evt.zone_id,
          state: evt.state,
          risk_score: evt.risk_score,
          occupied: evt.occupied,
          last_seen_at: evt.updated_at,
          contributions: evt.contributions,
        } as ZoneSummary,
      }));

      setHistoryBuffer((prev) => {
        const currentBuffer = prev[evt.zone_id] || [];
        const newPoint: RiskHistoryPoint = { timestamp: evt.updated_at, risk_score: evt.risk_score };
        const updatedBuffer = [...currentBuffer, newPoint].slice(-MAX_HISTORY_POINTS);
        return {
          ...prev,
          [evt.zone_id]: updatedBuffer,
        };
      });
    });

    socket.on("priority:update", (evt: PriorityUpdateEvent) => {
      setPriorityQueue(evt.ranked);
    });

    socket.on("zone:offline", (evt: ZoneOfflineEvent) => {
      setZones((prev) => ({
        ...prev,
        [evt.zone_id]: {
          ...prev[evt.zone_id],
          zone_id: evt.zone_id,
          state: "OFFLINE",
          last_seen_at: evt.last_seen_at,
        } as ZoneSummary,
      }));
    });

    const pushIncidentEvent = (e: IncidentEvent) =>
      setIncidentEvents((prev) => [...prev.slice(-(MAX_INCIDENT_EVENTS - 1)), e]);

    socket.on("incident:opened", (payload: IncidentOpenedEvent) =>
      pushIncidentEvent({ type: "opened", payload, at: Date.now() })
    );
    socket.on("incident:acked", (payload: IncidentAckedEvent) =>
      pushIncidentEvent({ type: "acked", payload, at: Date.now() })
    );
    socket.on("incident:resolved", (payload: IncidentResolvedEvent) =>
      pushIncidentEvent({ type: "resolved", payload, at: Date.now() })
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ connected, zones, priorityQueue, incidentEvents, historyBuffer }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within <RealtimeProvider>");
  return ctx;
}
