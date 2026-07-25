# SCS-RG System Architecture & Data Flow (Test Case 27)

This document describes the software architecture, modular layering, and real-time data pipeline for the **Multi-Hazard Smart Campus Safety & Response Grid (SCS-RG)**.

---

## 1. System Architecture Diagram

```mermaid
flowchart TD
    subgraph Edge ["Zone Nodes (Edge / Wokwi ESP32)"]
        ESP1["Zone Node 1 (IoT Lab)<br/>Flame, MQ-2, Water, PIR"]
        ESP2["Zone Node 2 (Server Room)<br/>Flame, MQ-2, Water, PIR"]
        ESP3["Zone Node 3 (Data Science Lab)<br/>Flame, MQ-2, Water, PIR"]
    end

    subgraph Backend ["Express + TypeScript Backend"]
        MW["Zone Auth Middleware<br/>(X-Zone-Key Validation)"]
        Ingest["Ingestion Controller<br/>POST /api/readings"]
        RiskEngine["Risk Fusion Engine<br/>Weighted Formula + Debouncing"]
        IncidentMgr["Incident Lifecycle Manager<br/>First-Write-Wins Atomic Ack"]
        PriorityEngine["Priority Ranking Engine<br/>CRITICAL Sorting"]
        BootRecovery["Boot Recovery Sequence<br/>State Restoration"]
    end

    subgraph Database ["PostgreSQL Database (Prisma ORM)"]
        DB[(PostgreSQL Database)]
    end

    subgraph Realtime ["Socket.io Event Server"]
        Socket["Socket.io Server<br/>zone:state, priority:update,<br/>incident:opened, incident:acked"]
    end

    subgraph Frontend ["Next.js Command Dashboard"]
        Dash["React Command Center<br/>Zone Map, Priority Queue, Incident Timeline"]
        AuthClient["Better Auth Client<br/>Session & RBAC (Staff / Admin)"]
    end

    ESP1 -- "HTTP POST /api/readings (JSON)" --> MW
    ESP2 -- "HTTP POST /api/readings (JSON)" --> MW
    ESP3 -- "HTTP POST /api/readings (JSON)" --> MW

    MW --> Ingest
    Ingest --> RiskEngine
    RiskEngine --> IncidentMgr
    IncidentMgr --> PriorityEngine

    RiskEngine -- "Prisma Client" --> DB
    IncidentMgr -- "Prisma Client" --> DB

    RiskEngine -- "State Push" --> Socket
    PriorityEngine -- "Priority Push" --> Socket
    IncidentMgr -- "Incident Event" --> Socket

    Socket -- "WebSocket Push" --> Dash
    Dash -- "REST HTTP (Better Auth)" --> AuthClient
    AuthClient -- "Session / RBAC" --> Backend
```

---

## 2. Telemetry Processing Pipeline

1. **Ingestion & Validation**:
   - ESP32 nodes POST raw sensor readings every 500ms–1s to `/api/readings` with header `X-Zone-Key`.
   - Middleware validates the key against the database cache.

2. **Server-Side Risk Fusion**:
   - Calculates Risk Fusion Score ($0.0 - 100.0$) using weighted formula:
     $$\text{RiskScore} = w_{fire} \cdot S_{fire} + w_{gas} \cdot S_{gas} + w_{water} \cdot S_{water} + w_{occ} \cdot S_{occ}$$
   - Applies N=5 debouncing, linear decay, and warm-up window evaluation.

3. **Database Persistence & Incident State Machine**:
   - Saves raw reading to PostgreSQL `Reading` table.
   - If `risk_score >= 65.0`, transitions state to `CRITICAL` and opens a new `Incident`.

4. **Real-Time Push Broadcasting**:
   - Socket.io broadcasts `zone:state` and `priority:update` to all connected frontend clients instantly.
