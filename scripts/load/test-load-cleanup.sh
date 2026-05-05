#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)/test-load-common.sh"

docker exec \
  -e ALLOW_PROD_LOAD_TEST=1 \
  -e FORCE_PROD_LOAD_TEST=1 \
  "${APP_C}" \
  npm run load:cleanup -- \
  --run-id "${RUN_ID}" \
  "$@"
