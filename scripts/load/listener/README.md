# Multi-User Load Listener

Standalone webhook receiver used during multi-user load tests. Bash + python3 only — no pip deps.

## What it does

- Serves `POST /webhook` and stores every request as NDJSON.
- Buckets requests by `load_test_run_id` so concurrent or back-to-back runs are separated.
- Detects duplicate `load_test_sequence` values per run.
- Aggregates per-run rollups (throughput, latency, status, persona/scenario fan-out).
- Exposes `GET /healthz` and a Prometheus-friendly `GET /metrics` snapshot.

## Run

```bash
./load-test-listener-standalone.sh \
  --host 0.0.0.0 \
  --port 4000 \
  --log-dir ./load-test-listener-logs \
  --auth-token CHANGEME
```

Or via env vars:

```bash
HOST=0.0.0.0 PORT=4000 LOG_DIR=./load-test-listener-logs AUTH_TOKEN=CHANGEME \
  ./load-test-listener-standalone.sh
```

## Output layout

```
load-test-listener-logs/
├── all-requests.ndjson           # tail-able stream of every request
├── all-rollups.ndjson            # tail-able stream of every rollup tick
└── <run_id>/
    ├── requests.ndjson           # per-run requests
    ├── rollups.ndjson            # per-run rolling stats
    └── run-summary.json          # latest snapshot of run totals
```

## Endpoints

| Method | Path        | Purpose                                                  |
| ------ | ----------- | -------------------------------------------------------- |
| POST   | `/webhook`  | Webhook ingest. Required body fields are documented below. |
| GET    | `/healthz`  | 200 OK liveness probe.                                   |
| GET    | `/metrics`  | text/plain rollup snapshot (one metric line per run).    |

## Expected payload fields (matched by load runners)

| Field                  | Type     | Notes                                              |
| ---------------------- | -------- | -------------------------------------------------- |
| `load_test_run_id`     | string   | Unique per run. Drives output bucketing.           |
| `load_test_sequence`   | integer  | Monotonic per run. Used for duplicate detection.   |
| `load_test_persona`    | string?  | Optional. Tracks per-virtual-user fan-out.         |
| `load_test_scenario`   | string?  | Optional. Tracks per-scenario distribution.        |
| `sent_at`              | ISO date | Used for end-to-end latency.                       |
| `scheduled_at`         | ISO date | Fallback for latency when `sent_at` not present.   |

## Production exposure

- Use `--auth-token` and pass `LISTENER_TOKEN` on the runner.
- Restrict the receiving port with the firewall (e.g., `ufw allow from <runner-ip> to any port 4000`).
- Consider running behind a reverse proxy with TLS for non-trusted runners.

## Quick smoke test

```bash
curl -fsS -X POST http://localhost:4000/webhook \
  -H 'content-type: application/json' \
  -H "x-load-test-token: CHANGEME" \
  -d '{"load_test_run_id":"smoke","load_test_sequence":1,"sent_at":"2026-01-01T00:00:00Z"}'

curl -fsS http://localhost:4000/healthz
curl -fsS http://localhost:4000/metrics
```
