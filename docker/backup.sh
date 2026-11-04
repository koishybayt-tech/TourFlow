#!/bin/sh
# Daily database dump. Old dumps (older than 14 days) are pruned.
while true; do
  pg_dump -h db -U tourflow tourflow | gzip > "/backups/tourflow-$(date +%F).sql.gz"
  find /backups -name 'tourflow-*.sql.gz' -mtime +14 -delete
  sleep 86400
done
