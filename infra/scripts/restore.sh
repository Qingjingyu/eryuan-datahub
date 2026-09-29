#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
BACKUP_DIR="${1:?usage: ./scripts/restore.sh /absolute/path/to/backup-dir}"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"
test -f "$BACKUP_DIR/postgres.dump"
test -f "$BACKUP_DIR/SHA256SUMS"
(cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS)
set -a; source .env; set +a
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${DATAHUB_S3_BUCKET:?DATAHUB_S3_BUCKET is required}"
: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"

COMPOSE="docker compose -f docker-compose.prod.yml"
echo "stopping API and worker"
$COMPOSE stop worker nginx backend

echo "restoring PostgreSQL from $BACKUP_DIR/postgres.dump"
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$POSTGRES_DB' AND pid<>pg_backend_pid();" >/dev/null
$COMPOSE exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges < "$BACKUP_DIR/postgres.dump"

echo "restoring object storage"
$COMPOSE run --rm \
  -e MC_HOST_local="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@minio:9000" \
  -e DATAHUB_S3_BUCKET="$DATAHUB_S3_BUCKET" \
  -v "$BACKUP_DIR/storage:/backup:ro" ${MINIO_MC_IMAGE:-minio/mc:RELEASE.2024-11-05T11-29-47Z} \
  sh -c 'mc mirror --overwrite /backup "local/$DATAHUB_S3_BUCKET"'

echo "starting services"
$COMPOSE up -d backend worker nginx
$COMPOSE exec -T backend python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/health/ready').read().decode())"
echo "restore complete"
