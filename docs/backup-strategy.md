# SCS-RG Backup & Recovery Strategy (Test Case 20)

This document describes the automated database backup mechanism and disaster recovery path for the **Multi-Hazard Smart Campus Safety & Response Grid (SCS-RG)** PostgreSQL database.

---

## 1. Backup Approach

- **Scheduled Export**: Daily automated execution of `scripts/backup.sh` via cron or managed cloud service backup (Render / Supabase daily backups).
- **Export Format**: Standard SQL dump created using `pg_dump "$DATABASE_URL"`.
- **Storage Location**: Backups are written to secure off-site object storage (S3 / GCS) or separate file system volumes.

---

## 2. Disaster Recovery Path

In the event of database failure or corrupted instance data:

### Step 1: Provision Clean Database Target
Ensure PostgreSQL instance is running and reachable via `DATABASE_URL`.

### Step 2: Restore Schema & Data
Execute `psql` restore from the latest SQL backup file:
```bash
psql "$DATABASE_URL" < backups/scsrg_backup_YYYYMMDD_HHMMSS.sql
```

### Step 3: Run Boot Recovery Sequence
Restart the Express backend server (`npm run start`). Upon startup:
1. `performBootRecovery()` queries PostgreSQL for active zones, latest readings, and open incidents.
2. In-memory risk scores, debouncing states, and priority queue rankings are automatically reconstructed before incoming connections are accepted.

---

## 3. Data Loss & Recovery Boundaries

- **Recovery Point Objective (RPO)**: At most the time elapsed since the last `pg_dump` export or last sensor HTTP POST reading (live readings are persisted to PostgreSQL immediately upon arrival).
- **Data Retention Boundary**: Raw sensor readings older than 90 days are pruned via `retentionJob.ts`, while all historical `Incident` and `IncidentTransition` records are preserved indefinitely.
