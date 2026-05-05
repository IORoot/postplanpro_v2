#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." &> /dev/null && pwd)"

APP_C="${APP_C:-postplanpro_v2-app-1}"
RUN_ID="${RUN_ID:-$(date -u +loadtest-%Y%m%dT%H%M%SZ-multi)}"
LISTENER_HOST="${LISTENER_HOST:-188.166.156.198}"
LISTENER_PORT="${LISTENER_PORT:-4000}"
LISTENER_TOKEN="${LISTENER_TOKEN:-CHANGE_ME_STRONG_TOKEN}"
TARGET_URL="${TARGET_URL:-http://${LISTENER_HOST}:${LISTENER_PORT}/webhook}"
BASE_URL="${BASE_URL:-https://postplanpro.com}"

require_cmd() {
	command -v "$1" >/dev/null 2>&1 || {
		echo "Missing command: $1" >&2
		exit 1
	}
}

require_cmd docker
require_cmd npm

echo "APP_C=${APP_C}"
echo "RUN_ID=${RUN_ID}"
echo "TARGET_URL=${TARGET_URL}"
echo "BASE_URL=${BASE_URL}"
