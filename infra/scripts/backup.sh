#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${BACKUP_ROOT:=$PWD/backups}"
STAMP="${BACKUP_STAMP:-$(date +%Y%m%d-%H%M%S)}"
TARGET="${1:-$BACKUP_ROOT/$STAMP}"
mkdir -p "$TARGET"
test -f .env
set -a; source .env; set +a
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${DATAHUB_S3_BUCKET:?DATAHUB_S3_BUCKET is required}"
: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"

echo "[$(date -Iseconds)] backing up PostgreSQL to $TARGET/postgres.dump"
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-privileges \
  > "$TARGET/postgres.dump"

echo "[$(date -Iseconds)] mirroring object storage to $TARGET/storage"
mkdir -p "$TARGET/storage"
docker compose -f docker-compose.prod.yml run --rm \
  -e MC_HOST_local="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@minio:9000" \
  -v "$TARGET/storage:/backup" ${MINIO_MC_IMAGE:-minio/mc:RELEASE.2024-11-05T11-29-47Z} \
  sh -c 'mc mirror --overwrite "local/$DATAHUB_S3_BUCKET" /backup'

sha256sum "$TARGET/postgres.dump" > "$TARGET/SHA256SUMS"
echo "backup complete: $TARGET"
