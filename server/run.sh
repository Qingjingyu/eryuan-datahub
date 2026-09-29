#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if [ -f .env.local ]; then set -a; source .env.local; set +a; fi
export DATAHUB_DB="${DATAHUB_DB:-sqlite:///./storage/datahub.db}"
export DATAHUB_STORAGE="${DATAHUB_STORAGE:-./storage}"
mkdir -p storage/{01_raw,02_staging,03_curated,04_index_input,05_agent_output,90_archive}
exec uvicorn app.main:app --host "${DATAHUB_HOST:-0.0.0.0}" --port "${DATAHUB_PORT:-13001}"
