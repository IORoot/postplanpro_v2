#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)/test-load-common.sh"
command -v docker >/dev/null 2>&1 || { echo "Missing command: docker" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Missing command: docker compose" >&2; exit 1; }

USERS="${USERS:-1000}"
POSTS_PER_USER="${POSTS_PER_USER:-5}"
VUS="${VUS:-500}"
RUN_TO_COMPLETION="${RUN_TO_COMPLETION:-1}"
MAX_DURATION="${MAX_DURATION:-20m}"

cd "${REPO_ROOT}"
mkdir -p "loadtest_results/${RUN_ID}"

ALLOW_PROD_LOAD_TEST=1 \
FORCE_PROD_LOAD_TEST=1 \
LOAD_TEST_RUN_ID="${RUN_ID}" \
TARGET_URL="${TARGET_URL}" \
LISTENER_TOKEN="${LISTENER_TOKEN}" \
USERS="${USERS}" \
POSTS_PER_USER="${POSTS_PER_USER}" \
VUS="${VUS}" \
RUN_TO_COMPLETION="${RUN_TO_COMPLETION}" \
MAX_DURATION="${MAX_DURATION}" \
docker compose -f scripts/load/docker-compose.k6.yml run --rm k6 \
  run scripts/load/k6-multi-user-posting.js \
  -e ALLOW_PROD_LOAD_TEST=1 \
  -e FORCE_PROD_LOAD_TEST=1 \
  -e TARGET_URL="${TARGET_URL}" \
  -e LISTENER_TOKEN="${LISTENER_TOKEN}" \
  -e USERS="${USERS}" \
  -e POSTS_PER_USER="${POSTS_PER_USER}" \
  -e VUS="${VUS}" \
  -e RUN_TO_COMPLETION="${RUN_TO_COMPLETION}" \
  -e MAX_DURATION="${MAX_DURATION}" \
  -e LOAD_TEST_RUN_ID="${RUN_ID}" \
  "$@"
