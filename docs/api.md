# SCS-RG Complete API & WebSocket Specification (Test Case 28)

Complete API specification for the **Multi-Hazard Smart Campus Safety & Response Grid (SCS-RG)**.

---

## 1. REST API Specification

| Endpoint | Method | Header / Auth | Description | Success Response | Error Codes |
|---|---|---|---|---|---|
| `/` | `GET` | Public | Root backend check | `200 OK` | - |
| `/api/health` | `GET` | Public | Database & server health check | `200 OK` | `500` |
| `/api/readings` | `POST` | `X-Zone-Key` | Microcontroller sensor ingestion | `200 OK` | `400`, `401` |
| `/api/zones` | `GET` | Session | Read live state of all campus zones | `200 OK` | `401` |
| `/api/zones` | `POST` | Session + Admin | Dynamically register a new zone | `201 Created` | `400`, `401`, `403` |
| `/api/zones/:id/key` | `GET` | Session + Admin | Retrieve zone API key | `200 OK` | `401`, `403`, `404` |
| `/api/zones/:id/override` | `POST` | Session + Admin | Admin manual override (`CRITICAL`/`SAFE`) | `200 OK` | `400`, `401`, `403` |
| `/api/incidents` | `GET` | Session | Query historical incidents (`from`, `to`, `zone_id`, `status`) | `200 OK` | `401` |
| `/api/incidents/:id` | `GET` | Session | Single incident details & transition timeline | `200 OK` | `401`, `404` |
| `/api/incidents/:id/ack` | `POST` | Session | Acknowledge incident (Atomic first write wins) | `200 OK` | `401`, `404`, `409` |
| `/api/priority` | `GET` | Session | HTTP Priority Queue fallback | `200 OK` | `401` |
| `/api/bonus/trend/:zone_id` | `GET` | Session | Short-term risk trend calculation | `200 OK` | `401` |
| `/api/bonus/ml-predict/:zone_id` | `GET` | Session | ML logistic regression risk prediction | `200 OK` | `401` |
| `/api/bonus/nl-report` | `POST` | Session | Natural-language incident report parser | `200 OK` | `400`, `401` |

---

## 2. Socket.io Event Specification

| Event Name | Direction | Trigger | Payload Description |
|---|---|---|---|
| `zone:state` | Server $\rightarrow$ Client | Zone telemetry update | `{ zone_id, state, risk_score, contributions, occupied, updated_at }` |
| `priority:update` | Server $\rightarrow$ Client | Priority ranking change | `{ ranked: [ { zone_id, rank, risk_score, occupied, seconds_critical, reason } ] }` |
| `incident:opened` | Server $\rightarrow$ Client | New incident opened | `{ incident_id, zone_id, hazard_types, opened_at, risk_score }` |
| `incident:acked` | Server $\rightarrow$ Client | Incident acknowledged | `{ incident_id, acknowledged_by, acknowledged_at }` |
| `incident:resolved` | Server $\rightarrow$ Client | Incident resolved | `{ incident_id, resolved_at }` |
| `zone:offline` | Server $\rightarrow$ Client | Node telemetry timeout ($>10$s) | `{ zone_id, last_seen_at }` |
