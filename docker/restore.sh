#!/bin/sh
# Restores a database dump created by the backup service.
# Usage: docker compose -f docker-compose.prod.yml run --rm -v "$PWD/docker/restore.sh:/restore.sh:ro" backup /bin/sh /restore.sh tourflow-2026-11-05.sql.gz
set -e
FILE="/backups/$1"
[ -f "$FILE" ] || { echo "Backup not found: $FILE"; ls /backups; exit 1; }
echo "Restoring $FILE into database 'tourflow' (existing data will be replaced)..."
psql -h db -U tourflow -d postgres -c "DROP DATABASE IF EXISTS tourflow WITH (FORCE);"
psql -h db -U tourflow -d postgres -c "CREATE DATABASE tourflow OWNER tourflow;"
gunzip -c "$FILE" | psql -h db -U tourflow -d tourflow
echo "Done."
