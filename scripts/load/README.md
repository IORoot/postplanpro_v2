# Multi-user load suite

Scripts and runbooks for the multi-user load suite: realistic UI scenarios with
Playwright + high-scale virtual users with k6, plus a standalone listener for
the receiving server and a result summarizer.

## Layout

```
scripts/load/
├── README.md                          (this file)
├── docker-compose.k6.yml              (dedicated k6 runner container)
├── deps-manifest.txt                  (declared install/cleanup deps)
├── install-prod-deps.sh               (apt + k6 installer; idempotent, supports --dry-run)
├── cleanup-prod-deps.sh               (matching uninstall; needs --confirm-destroy)
├── k6-multi-user-ui.js                (k6 high-scale UI traffic)
├── k6-multi-user-posting.js           (k6 multi-user concurrent posting)
├── seed-multi-user-load-data.ts       (insert tagged users/posts in the app DB)
├── cleanup-multi-user-load-data.ts    (delete only tagged data by run id)
├── summarize-load-results.ts          (aggregate Playwright + k6 + listener)
├── lib/
│   └── guardrails.mjs                 (prod gating + run id helpers)
└── listener/
    ├── load-test-listener-standalone.sh
    └── README.md
```

The Playwright multi-user runner lives next to the rest of the e2e tests at
`tests/e2e/load/`.

## Wired npm scripts


| Script                      | What it does                                                       |
| --------------------------- | ------------------------------------------------------------------ |
| `npm run load:install-deps` | Install apt + k6 deps from the manifest. Use `-- --dry-run` first. |
| `npm run load:cleanup-deps` | Reverse the install. Requires `-- --confirm-destroy`.              |
| `npm run load:listener`     | Start the receiver listener. Defaults to port 4000.                |
| `npm run load:seed`         | Insert tagged users/posts into the app DB.                         |
| `npm run load:cleanup`      | Delete only tagged rows by `--run-id` or `--all`.                  |
| `npm run load:ui:pw`        | Run the Playwright multi-user UI suite.                            |
| `npm run load:ui:k6`        | Run the k6 high-scale UI script.                                   |
| `npm run load:posting:k6`   | Run the k6 multi-user posting script.                              |
| `npm run load:summary`      | Aggregate run artifacts into `summary.json` + `summary.md`.        |


## Container-first production setup

Production host may not have `bun`. This runbook assumes `node` + `npm` exist inside app container.

- Run app-side scripts (`load:seed`, `load:cleanup`, `load:summary`, `load:ui:pw`) **inside app container**.
- Run k6 either:
  - inside app container if `k6` installed there, or
  - on separate runner host/container with network access.
- Run listener on receiver host (bash + python3 only).

Example aliases (Docker Compose):

```bash
APP_C="postplanpro_v2-app-1"   # change to your container name
DC="docker compose"             # or docker-compose

# run npm script inside container
$DC exec -e ALLOW_PROD_LOAD_TEST=1 -e FORCE_PROD_LOAD_TEST=1 "$APP_C" npm run load:seed -- --help
```

Example aliases (plain Docker):

```bash
APP_C="postplanpro_v2-app-1"
docker exec -e ALLOW_PROD_LOAD_TEST=1 -e FORCE_PROD_LOAD_TEST=1 "$APP_C" npm run load:seed -- --help
```

## Exact commands (copy/paste)

### 0) Set shared vars (runner shell)

```bash
export APP_C="postplanpro_v2-app-1"
export RUN_ID="$(date -u +loadtest-%Y%m%dT%H%M%SZ-multi)"
export APP_HOST="147.182.254.224"
export LISTENER_HOST="188.166.156.198"
export LISTENER_PORT="4000"
export LISTENER_TOKEN="dG9rZW4xMjMK"
export TARGET_URL="http://${LISTENER_HOST}:${LISTENER_PORT}/webhook"
export BASE_URL="https://postplanpro.com"
```

### 0b) Shortcut scripts (recommended)

Instead of long commands, run:

```bash
./scripts/load/test-load-seed.sh
./scripts/load/test-load-k6-posting.sh
./scripts/load/test-load-ui-pw.sh
./scripts/load/test-load-k6-ui.sh
./scripts/load/test-load-summary.sh
./scripts/load/test-load-cleanup.sh
```

All scripts read env vars from step 0. Useful overrides:

```bash
USERS=200 POSTS_PER_USER=10 ./scripts/load/test-load-seed.sh
VUS=2000 RUN_TO_COMPLETION=1 ./scripts/load/test-load-k6-posting.sh
UI_USERS=50 PLAYWRIGHT_LOAD_WORKERS=8 ./scripts/load/test-load-ui-pw.sh
VUS=10000 DURATION=3m ./scripts/load/test-load-k6-ui.sh
POST_THROUGHPUT_MIN_RPS=250 ./scripts/load/test-load-summary.sh
./scripts/load/test-load-cleanup.sh --dry-run
```

### 1) Receiver machine: install + run listener

SSH into receiver machine:

```bash
ssh root@188.166.156.198
```

Create folder and copy listener:

```bash
mkdir -p /opt/postplanpro-load/listener
cd /opt/postplanpro-load/listener
```

Paste `scripts/load/listener/load-test-listener-standalone.sh` into this folder, then:

```bash
chmod +x load-test-listener-standalone.sh
```

Open firewall (Ubuntu UFW example):

```bash
ufw allow ${LISTENER_PORT}/tcp
ufw status
```

Start listener (exact command):

```bash
HOST=0.0.0.0 \
PORT=${LISTENER_PORT} \
LOG_DIR=/var/log/postplanpro-load \
ROLLUP_WINDOW_SECONDS=10 \
AUTH_TOKEN=${LISTENER_TOKEN} \
./load-test-listener-standalone.sh
```

Run listener in background with log file (optional):

```bash
nohup env HOST=0.0.0.0 PORT=${LISTENER_PORT} LOG_DIR=/var/log/postplanpro-load ROLLUP_WINDOW_SECONDS=10 AUTH_TOKEN=${LISTENER_TOKEN} \
  ./load-test-listener-standalone.sh > /var/log/postplanpro-load/listener.out 2>&1 &
echo $! > /var/run/postplanpro-load-listener.pid
```

Health checks:

```bash
curl -fsS "http://127.0.0.1:${LISTENER_PORT}/healthz"
curl -fsS "http://127.0.0.1:${LISTENER_PORT}/metrics" | head -n 20
```

Token/auth preflight from runner:

```bash
curl -i -X POST "${TARGET_URL}" \
  -H "content-type: application/json" \
  -H "x-load-test-token: ${LISTENER_TOKEN}" \
  --data '{"load_test_run_id":"manual-check","load_test_sequence":1,"sent_at":"2026-01-01T00:00:00Z"}'
```

Expected: `HTTP/1.1 200`. If `401`, token mismatch.

Stop background listener:

```bash
kill "$(cat /var/run/postplanpro-load-listener.pid)"
```

### 2) Runner machine: verify app container tools

```bash
docker exec "$APP_C" npm --version
docker exec "$APP_C" node --version
docker exec "$APP_C" npm run load:seed -- --help
docker exec "$APP_C" npm run load:summary -- --help
```

Verify dedicated k6 compose file exists:

```bash
test -f scripts/load/docker-compose.k6.yml && echo "OK k6 compose file"
```

### 3) Seed multi-user test data (inside app container)

```bash
docker exec \
  -e ALLOW_PROD_LOAD_TEST=1 \
  -e FORCE_PROD_LOAD_TEST=1 \
  -e LOAD_TEST_RUN_ID="$RUN_ID" \
  "$APP_C" \
  npm run load:seed -- \
  --users 1000 \
  --posts-per-user 5 \
  --target "$TARGET_URL" \
  --run-id "$RUN_ID" \
  --tier admin
```

### 4) Run k6 posting test (separate k6 container)

```bash
mkdir -p "loadtest_results/${RUN_ID}"
chmod 0777 "loadtest_results/${RUN_ID}" || true
docker compose -f scripts/load/docker-compose.k6.yml run --rm \
  --user "$(id -u):$(id -g)" \
  k6 \
  run scripts/load/k6-multi-user-posting.js \
  -e ALLOW_PROD_LOAD_TEST=1 \
  -e FORCE_PROD_LOAD_TEST=1 \
  -e TARGET_URL="$TARGET_URL" \
  -e LISTENER_TOKEN="$LISTENER_TOKEN" \
  -e USERS=1000 \
  -e POSTS_PER_USER=5 \
  -e VUS=500 \
  -e RUN_TO_COMPLETION=1 \
  -e MAX_DURATION=20m \
  -e LOAD_TEST_RUN_ID="$RUN_ID"
```

### 5) Run Playwright multi-user UI test (inside app container)

```bash
docker exec \
  -e PLAYWRIGHT_LOAD_MODE=1 \
  -e LOAD_TEST_SEED_USERS=100 \
  -e UI_USERS=100 \
  -e UI_ITERATIONS=3 \
  -e PLAYWRIGHT_LOAD_WORKERS=12 \
  -e BASE_URL="$BASE_URL" \
  -e PLAYWRIGHT_BASE_URL="$BASE_URL" \
  -e LOAD_TEST_RUN_ID="$RUN_ID" \
  "$APP_C" \
  npm run load:ui:pw -- tests/e2e/load/multi-user-ui.spec.ts
```

### 6) Run k6 high-scale UI test (separate k6 container)

```bash
mkdir -p "loadtest_results/${RUN_ID}"
chmod 0777 "loadtest_results/${RUN_ID}" || true
docker compose -f scripts/load/docker-compose.k6.yml run --rm \
  --user "$(id -u):$(id -g)" \
  k6 \
  run scripts/load/k6-multi-user-ui.js \
  -e ALLOW_PROD_LOAD_TEST=1 \
  -e FORCE_PROD_LOAD_TEST=1 \
  -e BASE_URL="$BASE_URL" \
  -e VUS=5000 \
  -e DURATION=2m \
  -e LOAD_TEST_RUN_ID="$RUN_ID"
```

### 7) Summarize pass/fail

```bash
docker exec \
  -e ERROR_RATE_MAX=0.05 \
  -e UI_LATENCY_P95_MS_MAX=2000 \
  -e POST_LATENCY_P95_MS_MAX=2000 \
  -e POST_THROUGHPUT_MIN_RPS=100 \
  -e LOAD_TEST_RUN_ID="$RUN_ID" \
  "$APP_C" \
  npm run load:summary -- \
  --run-id "$RUN_ID"
```

Read summary files:

```bash
docker exec "$APP_C" sh -lc "cat loadtest_results/$RUN_ID/summary.md"
docker exec "$APP_C" sh -lc "cat loadtest_results/$RUN_ID/summary.json"
```

### 8) Cleanup seeded data

```bash
docker exec \
  -e ALLOW_PROD_LOAD_TEST=1 \
  -e FORCE_PROD_LOAD_TEST=1 \
  "$APP_C" \
  npm run load:cleanup -- \
  --run-id "$RUN_ID"
```

Dry-run cleanup first (optional):

```bash
docker exec "$APP_C" npm run load:cleanup -- --run-id "$RUN_ID" --dry-run
```

## Production guardrails

All load scripts respect the same two flags before running against any
production-looking host (matches `*.postplanpro.com`):

- `ALLOW_PROD_LOAD_TEST=1` (also editable via the admin "Multi-user load test settings" panel)
- `FORCE_PROD_LOAD_TEST=1` (must always be set on the CLI as an explicit confirmation)

Scripts also enforce per-mode concurrency caps. Override only if you understand
the risk:

- `OVERRIDE_LOAD_CAPS=1` lifts the cap.

Every Node-based script writes a `run-metadata.json` to its output folder so a
later operator can tell exactly what was run and how.

## Standard run id and output folder

```
loadtest_results/<run_id>/
├── run-metadata.json
├── playwright-events.ndjson
├── playwright-summary.json
├── k6-ui-summary.json
├── k6-ui-raw.json
├── k6-posting-summary.json
├── k6-posting-raw.json
├── seed-summary.json (when seed step ran)
├── summary.json     (from load:summary)
└── summary.md
```

The receiver writes per-run artifacts under `<log-dir>/<run_id>/` (see
`listener/README.md`).

## Recipe: full multi-user round trip

1. On the receiver host:
  ```bash
   ./scripts/load/listener/load-test-listener-standalone.sh \
     --port 4000 --auth-token CHANGEME \
     --log-dir /var/log/postplanpro-load
  ```
2. On runner side:
  ```bash
  export RUN_ID=$(date -u +loadtest-%Y%m%dT%H%M%SZ-multi)
  export TARGET_URL=http://188.166.156.198:4000/webhook
  export LISTENER_TOKEN=dG9rZW4xMjMK
  export BASE_URL=https://postplanpro.com

  ./scripts/load/test-load-seed.sh
  ./scripts/load/test-load-k6-posting.sh
  ./scripts/load/test-load-ui-pw.sh
  ./scripts/load/test-load-k6-ui.sh
  ./scripts/load/test-load-summary.sh
  ```
3. Inspect:
  ```bash
  cat loadtest_results/$RUN_ID/summary.md
  ```

## Recipe: UI realism only (Playwright)

```bash
docker exec \
  -e PLAYWRIGHT_LOAD_MODE=1 \
  -e LOAD_TEST_SEED_USERS=50 \
  -e UI_USERS=50 \
  -e PLAYWRIGHT_LOAD_WORKERS=8 \
  "$APP_C" npm run load:ui:pw -- tests/e2e/load/multi-user-ui.spec.ts
```

`SCENARIO_MIX` and `UI_USERS` are also editable in the admin "Multi-user load
test settings" panel. The Playwright process reads env first; export the same
values to mirror the admin DB.

## Recipe: high-scale virtual users only (k6)

Preferred (dedicated k6 container via compose file):

```bash
mkdir -p "loadtest_results/${RUN_ID}"
chmod 0777 "loadtest_results/${RUN_ID}" || true
docker compose -f scripts/load/docker-compose.k6.yml run --rm \
  --user "$(id -u):$(id -g)" \
  k6 \
  run scripts/load/k6-multi-user-ui.js \
  -e ALLOW_PROD_LOAD_TEST=1 \
  -e FORCE_PROD_LOAD_TEST=1 \
  -e BASE_URL=https://staging.postplanpro.com \
  -e VUS=5000 \
  -e DURATION=2m \
  -e LOAD_TEST_RUN_ID="$RUN_ID"
```

Alternative (native k6 on host):

```bash
k6 run scripts/load/k6-multi-user-ui.js \
  -e BASE_URL=https://staging.postplanpro.com \
  -e VUS=5000 -e DURATION=2m
```

For 10,000 users, raise the runner ulimit (`ulimit -n 65536`) and consider
splitting across two runner hosts.

## Stopping a run

- Ctrl+C the foreground load runner.
- Send `SIGTERM` to the listener; it flushes a final rollup before exit.
- If a seed left posts in the app DB you don't want fired, run
`npm run load:cleanup -- --run-id <id>` immediately. The cleanup is
transactional and removes only tagged data.

## Suggested wider tests

The plan also covers these "wise extras" you can mix in by combining the
existing scripts:

- Burst login storm: `k6-multi-user-ui.js` with `VUS=2000 DURATION=1m` and no
`SESSION_COOKIE` so all VUs hit `/auth/login`.
- Read-while-send: run `load:posting:k6` and `load:ui:k6` simultaneously
against the same `RUN_ID`.
- Callback flood: re-use `load:posting:k6` pointed at the app's callback URL
rather than the listener (configure via `TARGET_URL`).
- Failure spike: use a flaky listener (kill mid-run) and verify the app's retry
counters in `/reports`.

## Thresholds

`load:summary` evaluates four thresholds (overridable via env):


| Env                       | Default | Meaning                                      |
| ------------------------- | ------- | -------------------------------------------- |
| `ERROR_RATE_MAX`          | 0.05    | Max combined error rate across UI + posting. |
| `UI_LATENCY_P95_MS_MAX`   | 2000    | UI p95 latency ceiling.                      |
| `POST_LATENCY_P95_MS_MAX` | 2000    | Posting p95 latency ceiling.                 |
| `POST_THROUGHPUT_MIN_RPS` | 100     | Min listener peak rps.                       |


Exit code is non-zero when any threshold fails, so this script can gate CI.