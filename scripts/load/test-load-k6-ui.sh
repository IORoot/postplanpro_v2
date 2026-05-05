#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)/test-load-common.sh"
command -v docker >/dev/null 2>&1 || { echo "Missing command: docker" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Missing command: docker compose" >&2; exit 1; }

VUS="${VUS:-5000}"
DURATION="${DURATION:-2m}"

cd "${REPO_ROOT}"

ALLOW_PROD_LOAD_TEST=1 \
FORCE_PROD_LOAD_TEST=1 \
LOAD_TEST_RUN_ID="${RUN_ID}" \
BASE_URL="${BASE_URL}" \
VUS="${VUS}" \
DURATION="${DURATION}" \
docker compose -f scripts/load/docker-compose.k6.yml run --rm k6 \
  run scripts/load/k6-multi-user-ui.js \
  -e ALLOW_PROD_LOAD_TEST=1 \
  -e FORCE_PROD_LOAD_TEST=1 \
  -e BASE_URL="${BASE_URL}" \
  -e VUS="${VUS}" \
  -e DURATION="${DURATION}" \
  -e LOAD_TEST_RUN_ID="${RUN_ID}" \
  "$@"
