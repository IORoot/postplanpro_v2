# Multi-user load suite

Scripts and runbooks for the multi-user load suite: realistic UI scenarios with
Playwright + high-scale virtual users with k6, plus a standalone listener for
the receiving server and a result summarizer.

## Layout

```
scripts/load/
├── README.md                          (this file)
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

| Script | What it does |
| --- | --- |
| `bun run load:install-deps` | Install apt + k6 deps from the manifest. Use `-- --dry-run` first. |
| `bun run load:cleanup-deps` | Reverse the install. Requires `-- --confirm-destroy`. |
| `bun run load:listener` | Start the receiver listener. Defaults to port 4000. |
| `bun run load:seed` | Insert tagged users/posts into the app DB. |
| `bun run load:cleanup` | Delete only tagged rows by `--run-id` or `--all`. |
| `bun run load:ui:pw` | Run the Playwright multi-user UI suite. |
| `bun run load:ui:k6` | Run the k6 high-scale UI script. |
| `bun run load:posting:k6` | Run the k6 multi-user posting script. |
| `bun run load:summary` | Aggregate run artifacts into `summary.json` + `summary.md`. |

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

2. On the runner host (staging by default — switch to prod only with the
   guardrail flags above):

   ```bash
   export RUN_ID=$(date -u +loadtest-%Y%m%dT%H%M%SZ-multi)
   export TARGET_URL=http://<receiver>:4000/webhook
   export LISTENER_TOKEN=CHANGEME
   export BASE_URL=https://staging.postplanpro.com
   export LOAD_TEST_RUN_ID=$RUN_ID

   bun run load:seed -- \
     --users 1000 --posts-per-user 5 --target $TARGET_URL --run-id $RUN_ID

   bun run load:posting:k6 -- \
     -e TARGET_URL=$TARGET_URL -e LISTENER_TOKEN=$LISTENER_TOKEN \
     -e USERS=1000 -e POSTS_PER_USER=5 -e VUS=500 \
     -e LOAD_TEST_RUN_ID=$RUN_ID

   PLAYWRIGHT_LOAD_MODE=1 LOAD_TEST_SEED_USERS=10 UI_USERS=10 \
     LOAD_TEST_RUN_ID=$RUN_ID bun run test:e2e

   bun run load:summary -- --run-id $RUN_ID
   bun run load:cleanup -- --run-id $RUN_ID
   ```

3. Inspect:

   ```bash
   cat loadtest_results/$RUN_ID/summary.md
   ```

## Recipe: UI realism only (Playwright)

```bash
PLAYWRIGHT_LOAD_MODE=1 LOAD_TEST_SEED_USERS=50 UI_USERS=50 \
  PLAYWRIGHT_LOAD_WORKERS=8 bun run test:e2e
```

`SCENARIO_MIX` and `UI_USERS` are also editable in the admin "Multi-user load
test settings" panel. The Playwright process reads env first; export the same
values to mirror the admin DB.

## Recipe: high-scale virtual users only (k6)

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
  `bun run load:cleanup -- --run-id <id>` immediately. The cleanup is
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

| Env | Default | Meaning |
| --- | --- | --- |
| `ERROR_RATE_MAX` | 0.05 | Max combined error rate across UI + posting. |
| `UI_LATENCY_P95_MS_MAX` | 2000 | UI p95 latency ceiling. |
| `POST_LATENCY_P95_MS_MAX` | 2000 | Posting p95 latency ceiling. |
| `POST_THROUGHPUT_MIN_RPS` | 100 | Min listener peak rps. |

Exit code is non-zero when any threshold fails, so this script can gate CI.
