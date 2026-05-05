#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)/test-load-common.sh"

ERROR_RATE_MAX="${ERROR_RATE_MAX:-0.05}"
UI_LATENCY_P95_MS_MAX="${UI_LATENCY_P95_MS_MAX:-2000}"
POST_LATENCY_P95_MS_MAX="${POST_LATENCY_P95_MS_MAX:-2000}"
POST_THROUGHPUT_MIN_RPS="${POST_THROUGHPUT_MIN_RPS:-100}"

docker exec \
  -e ERROR_RATE_MAX="${ERROR_RATE_MAX}" \
  -e UI_LATENCY_P95_MS_MAX="${UI_LATENCY_P95_MS_MAX}" \
  -e POST_LATENCY_P95_MS_MAX="${POST_LATENCY_P95_MS_MAX}" \
  -e POST_THROUGHPUT_MIN_RPS="${POST_THROUGHPUT_MIN_RPS}" \
  -e LOAD_TEST_RUN_ID="${RUN_ID}" \
  "${APP_C}" \
  npm run load:summary -- \
  --run-id "${RUN_ID}" \
  "$@"
