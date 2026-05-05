#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)/test-load-common.sh"

USERS="${USERS:-1000}"
POSTS_PER_USER="${POSTS_PER_USER:-5}"
TIER="${TIER:-admin}"

docker exec \
  -e ALLOW_PROD_LOAD_TEST=1 \
  -e FORCE_PROD_LOAD_TEST=1 \
  -e LOAD_TEST_RUN_ID="${RUN_ID}" \
  "${APP_C}" \
  npm run load:seed -- \
  --users "${USERS}" \
  --posts-per-user "${POSTS_PER_USER}" \
  --target "${TARGET_URL}" \
  --run-id "${RUN_ID}" \
  --tier "${TIER}" \
  "$@"
