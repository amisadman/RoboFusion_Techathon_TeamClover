// Mirrors docs/contract.md exactly. This file is duplicated (not shared
// via a monorepo package) into frontend/src/types/contract.ts — see
// plan.md §11.5. If you change a field here, change it there too, and
// update docs/contract.md, and tell your teammates out loud.

export type HazardState = "SAFE" | "WARNING" | "CRITICAL" | "OFFLINE";

export interface ReadingPayload {
  zone_id: string;
  seq: number;
  timestamp_ms: number;
  sensors: {
    flame_raw: number;
    gas_raw: number;
    water_raw: number;
    motion: boolean;
  };
  sensor_health: {
    flame: "ok" | "disconnected";
    gas: "ok" | "disconnected";
    water: "ok" | "disconnected";
    motion: "ok" | "disconnected";
  };
}

export interface ReadingResponseAccepted {
  accepted: true;
  state: HazardState;
  risk_score: number;
  commands: {
    led: "green" | "yellow" | "red" | "offline";
    buzzer: boolean;
    relay_cutoff: boolean;
  };
  server_seq_ack: number;
}

export interface ReadingResponseRejected {
  accepted: false;
  error: string;
  detail: string;
  field: string;
}

export type ReadingResponse = ReadingResponseAccepted | ReadingResponseRejected;

export interface ZoneStateEvent {
  zone_id: string;
  state: HazardState;
  risk_score: number;
  contributions: { fire: number; gas: number; water: number; occupancy: number };
  occupied: boolean;
  updated_at: string;
}

export interface PriorityUpdateEvent {
  ranked: Array<{
    zone_id: string;
    rank: number;
    risk_score: number;
    occupied: boolean;
    seconds_critical: number;
    reason: string;
    source?: "sensor" | "manual_override" | "nl_report";
    incident_id?: string;
  }>;
}

export interface IncidentOpenedEvent {
  incident_id: string;
  zone_id: string;
  hazard_types: string[];
  opened_at: string;
  risk_score: number;
}

export interface IncidentAckedEvent {
  incident_id: string;
  acknowledged_by: string;
  acknowledged_at: string;
}

export interface IncidentResolvedEvent {
  incident_id: string;
  resolved_at: string;
}

export interface ZoneOfflineEvent {
  zone_id: string;
  last_seen_at: string;
}
