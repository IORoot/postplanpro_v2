#!/usr/bin/env sh
# Called from the host crontab (installed by .github/workflows/deploy.yml).
# Loads .env next to the repo root and hits the send-due-posts endpoint.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
set -a
# shellcheck disable=SC1091
. ./.env
set +a
: "${CRON_SECRET:?CRON_SECRET not set in .env}"
: "${APP_BASE_URL:?APP_BASE_URL not set in .env}"
/usr/bin/curl -fsS -H "X-Cron-Secret: ${CRON_SECRET}" "${APP_BASE_URL%/}/api/cron/send-due-posts" || true
