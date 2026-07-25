import type {
  ApiResponse,
  ZoneSummary,
  Incident,
  IncidentFilters,
  OverrideResult,
  TrendResponse,
  MlPredictResponse,
  NlReportResponse,
} from "@/types/contract";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message || `API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: "include", // required for Better Auth cookies cross-origin
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  let json: ApiResponse<T> | null = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON response (e.g. Render cold-start HTML error page)
  }

  if (!res.ok || !json?.success) {
    throw new ApiError(res.status, json, json?.message);
  }
  return json.data;
}

export const api = {
  health: () => request<{ status: string; database: string; time: string }>("/api/health"),

  getZones: () => request<ZoneSummary[]>("/api/zones"),

  getIncidents: (filters: IncidentFilters = {}) => {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][]
    );
    const qs = params.toString();
    return request<Incident[]>(`/api/incidents${qs ? `?${qs}` : ""}`);
  },

  ackIncident: (incidentId: string) =>
    request<{ incident_id: string; acknowledged_by: string; acknowledged_at: string }>(
      `/api/incidents/${incidentId}/ack`,
      { method: "POST" }
    ),

  override: (zoneId: string, state: "SAFE" | "WARNING" | "CRITICAL") =>
    request<OverrideResult>(`/api/zones/${zoneId}/override`, {
      method: "POST",
      body: JSON.stringify({ state }),
    }),

  createZone: (payload: { id: string; name: string; hazardProfile: string; apiKey: string }) =>
    request(`/api/zones`, { method: "POST", body: JSON.stringify(payload) }),

  getZoneKey: (zoneId: string) =>
    request<{ zone_id: string; name: string; api_key: string }>(`/api/zones/${zoneId}/key`),

  // Bonus endpoints
  trend: (zoneId: string) => request<TrendResponse>(`/api/bonus/trend/${zoneId}`),

  mlPredict: (zoneId: string) => request<MlPredictResponse>(`/api/bonus/ml-predict/${zoneId}`),

  nlReport: (text: string) =>
    request<NlReportResponse>(`/api/bonus/nl-report`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
};
