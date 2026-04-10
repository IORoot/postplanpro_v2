#!/usr/bin/env sh
# Called from the host crontab (installed by .github/workflows/deploy.yml).
# Loads .env next to the repo root and hits the send-due-posts endpoint.
#
# Prefer hitting the container via localhost (see CRON_INTERNAL_BASE_URL / CRON_HOST_PORT). Using
# APP_BASE_URL often goes through nginx/HTTPS; many proxies strip custom headers, which causes 401
# even when CRON_SECRET is correct inside the container.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
set -a
# shellcheck disable=SC1091
. ./.env
set +a
: "${CRON_SECRET:?CRON_SECRET not set in .env}"
# Align with server: strip CR/whitespace so the header matches the container env (Windows CRLF in .env breaks auth otherwise).
CRON_SECRET=$(printf '%s' "$CRON_SECRET" | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

# Target URL: internal first (default localhost + published host port), then public APP_BASE_URL as last resort.
if [ -n "${CRON_INTERNAL_BASE_URL:-}" ]; then
	CRON_TARGET="${CRON_INTERNAL_BASE_URL%/}/api/cron/send-due-posts"
elif [ "${CRON_USE_APP_BASE_URL:-0}" = "1" ] || [ "${CRON_USE_APP_BASE_URL:-}" = "true" ]; then
	: "${APP_BASE_URL:?APP_BASE_URL not set in .env (or set CRON_INTERNAL_BASE_URL)}"
	CRON_TARGET="${APP_BASE_URL%/}/api/cron/send-due-posts"
else
	CRON_HOST_PORT="${CRON_HOST_PORT:-3000}"
	CRON_TARGET="http://127.0.0.1:${CRON_HOST_PORT}/api/cron/send-due-posts"
fi

/usr/bin/curl -fsS -H "X-Cron-Secret: ${CRON_SECRET}" "$CRON_TARGET" || true
