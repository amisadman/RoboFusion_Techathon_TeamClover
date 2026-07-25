# SCS-RG Database Entity-Relationship Diagram (Test Case 29)

This document presents the complete PostgreSQL Database Entity-Relationship Diagram (ERD) powering the **Multi-Hazard Smart Campus Safety & Response Grid (SCS-RG)**.

---

## 1. Entity-Relationship Diagram

```mermaid
erDiagram
    user ||--o{ session : "has sessions"
    user ||--o{ account : "has accounts"
    user ||--o{ Incident : "acknowledges"

    Zone ||--o{ Sensor : "contains"
    Zone ||--o{ Reading : "records"
    Zone ||--o{ Incident : "experiences"

    Incident ||--o{ IncidentTransition : "logs history"

    user {
        string id PK
        string name
        string email UK
        boolean emailVerified
        string role "staff | admin"
        datetime createdAt
        datetime updatedAt
    }

    session {
        string id PK
        string token UK
        string userId FK
        datetime expiresAt
        datetime createdAt
    }

    account {
        string id PK
        string userId FK
        string providerId
        string accountId
    }

    verification {
        string id PK
        string identifier
        string value
        datetime expiresAt
    }

    Zone {
        string id PK
        string name
        string apiKey UK
        string hazardProfile
        boolean archived
        datetime lastSeenAt
    }

    Sensor {
        string id PK
        string zoneId FK
        string type "flame | gas | water | motion"
        string unit "raw_adc | boolean"
    }

    Reading {
        string id PK
        string zoneId FK
        int seq
        int flameRaw
        int gasRaw
        int waterRaw
        boolean motion
        float riskScore
        string state "SAFE | WARNING | CRITICAL | OFFLINE"
        datetime recordedAt
        datetime receivedAt
    }

    Incident {
        string id PK
        string zoneId FK
        string status "OPEN | ACKED | RESOLVED"
        stringArray hazardTypes
        float peakRiskScore
        string source "sensor | manual_override"
        datetime openedAt
        string acknowledgedBy FK
        datetime acknowledgedAt
        datetime resolvedAt
    }

    IncidentTransition {
        string id PK
        string incidentId FK
        string fromState
        string toState
        float riskScore
        datetime occurredAt
    }
```

---

## 2. Key Relationships & Index Optimizations

- **`Reading` Composite Index**: `@@index([zoneId, receivedAt])` and `@@unique([zoneId, seq])` for sequence deduplication and time-series range queries.
- **`Incident` Composite Index**: `@@index([status, openedAt])` enabling sub-millisecond query performance for active and historical alert dashboards.
- **Referential Integrity**: `onDelete: Restrict` on `Zone -> Sensor`, `Zone -> Reading`, and `Zone -> Incident` preventing cascading hard-deletes of historical campus data.
