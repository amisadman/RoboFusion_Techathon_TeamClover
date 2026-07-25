// Mirrors backend-api.md exactly, as of the /api/... wrapper decision.
// This is the file the plan calls "the duplicated contract.ts" -- if
// the backend's response shape changes, this file and docs/contract.md
// both need updating, and the team needs to hear about it.

export type HazardState = "SAFE" | "WARNING" | "CRITICAL" | "OFFLINE";
export type IncidentStatus = "OPEN" | "ACKED" | "RESOLVED";
export type IncidentSource = "sensor" | "manual_override" | "nl_report";

// Every REST endpoint wraps its payload in this envelope.
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ZoneSummary {
  zone_id: string;
  name: string;
  hazard_profile: string;
  state: HazardState;
  risk_score: number;
  occupied: boolean;
  last_seen_at: string;
}

export interface IncidentTransition {
  id: string;
  // Note: these three fields are camelCase in the API response, unlike
  // everything else which is snake_case -- confirmed quirk, not a typo.
  fromState: HazardState | null;
  toState: HazardState;
  riskScore: number;
  occurredAt: string;
}

export interface Incident {
  id: string;
  zone_id: string;
  zone_name: string;
  status: IncidentStatus;
  hazard_types: string[];
  peak_risk_score: number;
  source: IncidentSource;
  opened_at: string;
  acknowledged_by: string | null;
  acknowledged_by_user: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  duration_seconds: number;
  transitions: IncidentTransition[];
}

export interface IncidentFilters {
  from?: string;
  to?: string;
  zone_id?: string;
  status?: IncidentStatus;
}

export interface OverrideResult {
  success: boolean;
  zone_id: string;
  state: HazardState;
  override_by: string;
}

// --- Socket.io event payloads. Confirmed unwrapped/flat, unchanged
// from the original contract -- do NOT apply ApiResponse<T> to these. ---

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

// --- Bonus endpoints ---

export interface TrendResponse {
  zone_id: string;
  trend: "RISING" | "FALLING" | "STABLE";
  slope: number;
  current_risk_score: number;
  trending_critical: boolean;
}

export interface MlPredictResponse {
  zone_id: string;
  predicted_critical_probability: number;
  predicted_critical_next_5m: boolean;
  model: string;
  safety_guarantee: string;
}

export interface NlReportResponse {
  parsed: boolean;
  input_text: string;
  extracted_signal: {
    zone_id: string;
    hazard_type: string;
    estimated_severity: HazardState;
  };
  validation_gate: "passed" | "failed";
}
