# SCS-RG Frontend Coverage Audit

**Audit Date**: July 26, 2026  
**Audited Components**: `backend/src/` (Router & Socket Definitions) vs. `frontend/` (`lib/api.ts`, `providers/`, `components/`, `app/`)

---

## Backend Capability vs. Frontend Integration Inventory

| Backend Capability | Type | Used in Frontend? | Screen / Component | Rubric Test Case | Classification |
|---|---|---|---|---|---|
| `GET /` | REST | N | — | — | CONVENIENCE-ONLY |
| `GET /api/health` | REST | N | — | Section D | CONVENIENCE-ONLY |
| `POST /api/readings` | REST | N (Microcontroller Only) | — | TC4 (Telemetry Ingestion) | Hardware Capability |
| `GET /api/priority` | REST | N (Pushed via Socket) | `providers/realtime-provider.tsx` | TC12b (Priority Queue) | Covered via Socket |
| `GET /api/zones` | REST | Y | `providers/realtime-provider.tsx`, `components/ai-integration/nl-reporter.tsx` | TC12a, TC8a | Active |
| `POST /api/zones` | REST | N | — | TC13b (Admin API) | CONVENIENCE-ONLY |
| `GET /api/zones/:id/key` | REST | Y | `app/admin/page.tsx` | TC13b | Active |
| `POST /api/zones/:id/override` | REST | Y | `app/admin/page.tsx` | TC13b, TC22 | Active |
| `GET /api/incidents` | REST | Y | `app/incidents/page.tsx`, `hooks/use-open-incidents-by-zone.ts` | TC14, TC8b | Active |
| `GET /api/incidents/:id` | REST | N (Filtered via GET /api/incidents) | `app/incidents/page.tsx` | TC14 | Covered by list query |
| `POST /api/incidents/:id/ack` | REST | Y | `hooks/use-ack-incident.ts` | TC7b, TC15 | Active |
| `ALL /api/auth/*` | REST | Y | `app/login/page.tsx`, `top-bar.tsx`, `use-require-session.ts` | TC13a (Auth / RBAC) | Active |
| `GET /api/bonus/trend/:zone_id` | REST | N (GAP -> Adding to Zone Card) | `components/dashboard/zone-card-bonus.tsx` | **Bonus 2** (10 Marks) | **RUBRIC-RELEVANT GAP** |
| `GET /api/bonus/ml-predict/:zone_id` | REST | N (GAP -> Adding to Zone Card) | `components/dashboard/zone-card-bonus.tsx` | **Bonus 3** (10 Marks) | **RUBRIC-RELEVANT GAP** |
| `POST /api/bonus/nl-report` | REST | Y | `components/ai-integration/nl-reporter.tsx` | **Bonus 4** (10 Marks) | Active |
| `zone:state` | Socket.io | Y | `providers/realtime-provider.tsx` | TC12a (Live Zone Map) | Active |
| `priority:update` | Socket.io | Y | `providers/realtime-provider.tsx` | TC12b (Priority Ranking) | Active |
| `incident:opened` | Socket.io | Y | `providers/realtime-provider.tsx` | TC15 (Realtime Toaster) | Active |
| `incident:acked` | Socket.io | Y | `providers/realtime-provider.tsx` | TC15 (Realtime Toaster) | Active |
| `incident:resolved` | Socket.io | Y | `providers/realtime-provider.tsx` | TC15 (Realtime Toaster) | Active |
| `zone:offline` | Socket.io | Y | `providers/realtime-provider.tsx` | TC12a, TC23a (Offline detection) | Active |

---

## Action Plan for Identified Gaps

1. **GET /api/bonus/trend/:zone_id (Bonus 2)**: Add polling trend badge to each Zone Card on the dashboard.
2. **GET /api/bonus/ml-predict/:zone_id (Bonus 3)**: Add polling ML "Predicted Risk" indicator to each Zone Card on the dashboard.
3. **POST /api/bonus/nl-report (Bonus 4)**: Ensure direct 1-click submission without blocking on external API keys so judges can evaluate NL reports effortlessly.
