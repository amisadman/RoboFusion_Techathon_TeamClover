#!/bin/bash
# SCS-RG Automated PostgreSQL Backup Script (Test Case 20)
# Usage: ./scripts/backup.sh

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/scsrg_backup_${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"

echo "Starting automated PostgreSQL database export..."

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set."
  exit 1
fi

pg_dump "$DATABASE_URL" > "$BACKUP_FILE"

echo "✅ Backup successfully exported to: ${BACKUP_FILE}"
