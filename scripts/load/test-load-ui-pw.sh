#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)/test-load-common.sh"

LOAD_TEST_SEED_USERS="${LOAD_TEST_SEED_USERS:-100}"
UI_USERS="${UI_USERS:-100}"
UI_ITERATIONS="${UI_ITERATIONS:-3}"
PLAYWRIGHT_LOAD_WORKERS="${PLAYWRIGHT_LOAD_WORKERS:-12}"

# Production app images may not ship Playwright tests/config.
# Copy required files into running container before executing.
docker exec "${APP_C}" sh -lc "mkdir -p /app/tests"
docker cp "${REPO_ROOT}/playwright.config.ts" "${APP_C}:/app/playwright.config.ts"
docker cp "${REPO_ROOT}/tests/." "${APP_C}:/app/tests/"

docker exec \
  -e PLAYWRIGHT_LOAD_MODE=1 \
  -e LOAD_TEST_SEED_USERS="${LOAD_TEST_SEED_USERS}" \
  -e UI_USERS="${UI_USERS}" \
  -e UI_ITERATIONS="${UI_ITERATIONS}" \
  -e PLAYWRIGHT_LOAD_WORKERS="${PLAYWRIGHT_LOAD_WORKERS}" \
  -e BASE_URL="${BASE_URL}" \
  -e PLAYWRIGHT_BASE_URL="${BASE_URL}" \
  -e LOAD_TEST_RUN_ID="${RUN_ID}" \
  "${APP_C}" \
  npm run load:ui:pw -- tests/e2e/load/multi-user-ui.spec.ts \
  "$@"
