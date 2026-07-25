## 4. THE CONTRACT
 
Copy this into `docs/contract.md` in M0. Everything else is built against it. Also encode it as `contract.ts` types (Section 11).
 
### 4.1 Zone node → backend
 
`POST /api/readings`
Header: `X-Zone-Key: <per-zone api key>`
 
```json
{
  "zone_id": "iot_lab",
  "seq": 1423,
  "timestamp_ms": 918273,
  "sensors": {
    "flame_raw": 812,
    "gas_raw": 340,
    "water_raw": 120,
    "motion": true
  },
  "sensor_health": {
    "flame": "ok",
    "gas": "ok",
    "water": "ok",
    "motion": "ok"
  }
}
```
 
- `seq` is monotonic per zone. Backend ignores `seq <= last_seen[zone]`. This is our dedup mechanism (Test 6d).
- `*_raw` are raw ADC/sensor values. **The node never sends a risk score or a state.** Backend computes both (Test 6 condition).
- `sensor_health` values: `"ok"` | `"disconnected"`. Drives OFFLINE (Test 4d, 23a).
### 4.2 Backend → zone node (the same HTTP response)

Wrapped in the same `{success, message, data}` envelope every other REST
endpoint uses (`backend/src/app/utils/sendResponse.ts` applies it
uniformly, including to `/api/readings`). All three zone-node firmware
sketches parse this wrapped shape (`r["success"]`, then
`r["data"]["accepted"]` / `r["data"]["commands"]`) -- this is not just the
dashboard's shape, it's what the firmware itself expects too.

```json
{
  "success": true,
  "message": "Reading ingested successfully",
  "data": {
    "accepted": true,
    "state": "CRITICAL",
    "risk_score": 78.4,
    "commands": {
      "led": "red",
      "buzzer": true,
      "relay_cutoff": true
    },
    "server_seq_ack": 1423
  }
}
```
 
Rejection shape (HTTP 400), same envelope:
 
```json
{
  "success": false,
  "message": "water_raw: water_raw must be >= 0",
  "data": {
    "accepted": false,
    "error": "invalid_payload",
    "detail": "water_raw must be >= 0",
    "field": "water_raw"
  }
}
```
 
Never silently absorbed (Test 6b, 23f).
 
`led` values: `"green"` | `"yellow"` | `"red"` | `"offline"`.
Firmware rule: **only `relay_cutoff` and `buzzer` fire on CRITICAL. WARNING is visual only.** (Test 5b)
 
### 4.3 Backend → dashboard (Socket.io events)
 
| Event | Payload |
|---|---|
| `zone:state` | `{ zone_id, state, risk_score, contributions: {fire, gas, water, occupancy}, occupied, updated_at }` |
| `priority:update` | `{ ranked: [ { zone_id, rank, risk_score, occupied, seconds_critical, reason } ] }` |
| `incident:opened` | `{ incident_id, zone_id, hazard_types, opened_at, risk_score }` |
| `incident:acked` | `{ incident_id, acknowledged_by, acknowledged_at }` |
| `incident:resolved` | `{ incident_id, resolved_at }` |
| `zone:offline` | `{ zone_id, last_seen_at }` |
 
`reason` is a prebuilt human string, e.g. `"risk 82, occupied, critical 45s"` — the dashboard renders it verbatim. That is the Test 12c "visible justification" mark, basically free.
 
### 4.4 REST endpoints (Test 8)
 
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/readings` | `X-Zone-Key` | Ingestion |
| GET | `/api/zones` | session | All zone states in **one** call (Test 8a) |
| GET | `/api/incidents?from=&to=&zone_id=&status=` | session | Historical, date-range filterable (Test 8b) |
| POST | `/api/incidents/:id/ack` | session | 404 if incident doesn't exist (Test 8c) |
| POST | `/api/zones/:id/override` | **admin** | Manual override |
| GET | `/api/health` | public | System health |
| ALL | `/api/auth/*` | — | Better Auth handler (mounted first, see §11) |
 
### 4.5 State enum
 
`SAFE` | `WARNING` | `CRITICAL` | `OFFLINE` — exact strings, everywhere, both sides.