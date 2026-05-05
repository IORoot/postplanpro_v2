#!/usr/bin/env bash
set -euo pipefail

# Multi-user load suite listener.
#
# Purpose
# - Single-file load-test webhook listener for the receiving server.
# - Bash + python3 only. No external pip deps. Works on a stock Ubuntu/Debian VM.
#
# What this does
# - Serves POST /webhook on HOST:PORT.
# - Buckets requests by load_test_run_id so multiple concurrent runs (or back-to-back
#   runs) don't get tangled in one big file.
# - Per-run output:
#       <log-dir>/<run_id>/requests.ndjson
#       <log-dir>/<run_id>/rollups.ndjson
#       <log-dir>/<run_id>/run-summary.json   (re-written every rollup tick)
# - Top-level <log-dir>/all-rollups.ndjson rollup feed (for dashboards) and
#   <log-dir>/all-requests.ndjson tail-able stream of every request.
# - Detects duplicate sequences per (run_id) for the multi-user posting tests.
# - Optional auth via x-load-test-token header.
# - GET /healthz and GET /metrics (text/plain rollup snapshot) for monitoring.
#
# Quick start
#   ./load-test-listener-standalone.sh --port 4000 --auth-token CHANGEME
#
# Pair with the load runner via env on the runner box:
#   export LISTENER_URL=http://<receiver-ip>:4000/webhook
#   export LISTENER_TOKEN=CHANGEME

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-4000}"
LOG_DIR="${LOG_DIR:-./load-test-listener-logs}"
ROLLUP_WINDOW_SECONDS="${ROLLUP_WINDOW_SECONDS:-10}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
MAX_BODY_BYTES="${MAX_BODY_BYTES:-1048576}"

usage() {
	cat <<'EOF'
Usage: load-test-listener-standalone.sh [options]

Options:
  --host <host>          Bind host (default: 0.0.0.0)
  --port <port>          Bind port (default: 4000)
  --log-dir <path>       Output directory for ndjson logs (default: ./load-test-listener-logs)
  --window-seconds <n>   Rollup window seconds (default: 10)
  --auth-token <token>   Require x-load-test-token header (recommended on public IPs)
  --max-body-bytes <n>   Reject bodies larger than this (default: 1048576)
  --help                 Show help

Env vars (alternative to flags):
  HOST, PORT, LOG_DIR, ROLLUP_WINDOW_SECONDS, AUTH_TOKEN, MAX_BODY_BYTES

Endpoints:
  POST /webhook    Webhook ingest (this is where load runners send to)
  GET  /healthz    Liveness probe (returns 200 OK)
  GET  /metrics    Plain-text snapshot of current per-run counters
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--host)
		HOST="$2"
		shift 2
		;;
	--port)
		PORT="$2"
		shift 2
		;;
	--log-dir)
		LOG_DIR="$2"
		shift 2
		;;
	--window-seconds)
		ROLLUP_WINDOW_SECONDS="$2"
		shift 2
		;;
	--auth-token)
		AUTH_TOKEN="$2"
		shift 2
		;;
	--max-body-bytes)
		MAX_BODY_BYTES="$2"
		shift 2
		;;
	--help)
		usage
		exit 0
		;;
	*)
		echo "Unknown option: $1" >&2
		usage
		exit 1
		;;
	esac
done

mkdir -p "$LOG_DIR"

echo "Starting multi-user load-test listener"
echo "  host: $HOST"
echo "  port: $PORT"
echo "  log_dir: $LOG_DIR"
echo "  rollup_window_seconds: $ROLLUP_WINDOW_SECONDS"
echo "  max_body_bytes: $MAX_BODY_BYTES"
if [[ -n "$AUTH_TOKEN" ]]; then
	echo "  auth: enabled (x-load-test-token required)"
else
	echo "  auth: disabled (consider setting --auth-token in production)"
fi

HOST="$HOST" \
PORT="$PORT" \
LOG_DIR="$LOG_DIR" \
ROLLUP_WINDOW_SECONDS="$ROLLUP_WINDOW_SECONDS" \
AUTH_TOKEN="$AUTH_TOKEN" \
MAX_BODY_BYTES="$MAX_BODY_BYTES" \
python3 - <<'PY'
import json
import os
import signal
import threading
import time
from collections import defaultdict
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_int_env(name: str, default: int, minimum: int | None = None, maximum: int | None = None) -> int:
    raw = os.getenv(name, str(default)).strip()
    value = int(raw)
    if minimum is not None and value < minimum:
        raise ValueError(f"{name} must be >= {minimum}")
    if maximum is not None and value > maximum:
        raise ValueError(f"{name} must be <= {maximum}")
    return value


HOST = os.getenv("HOST", "0.0.0.0")
PORT = parse_int_env("PORT", 4000, 1, 65535)
LOG_DIR = Path(os.getenv("LOG_DIR", str(Path.cwd() / "load-test-listener-logs")))
AUTH_TOKEN = os.getenv("AUTH_TOKEN", "").strip() or None
WINDOW_SECONDS = parse_int_env("ROLLUP_WINDOW_SECONDS", 10, 1)
MAX_BODY_BYTES = parse_int_env("MAX_BODY_BYTES", 1048576, 1)

LOG_DIR.mkdir(parents=True, exist_ok=True)
ALL_REQUESTS_PATH = LOG_DIR / "all-requests.ndjson"
ALL_ROLLUPS_PATH = LOG_DIR / "all-rollups.ndjson"

UNKNOWN_RUN_ID = "_unknown_run"


class RunBucket:
    __slots__ = (
        "run_id",
        "lock",
        "started_at_iso",
        "total_received",
        "total_rejected",
        "window_received",
        "window_bytes",
        "window_latency_count",
        "window_latency_ms",
        "window_start_ms",
        "seen_sequences",
        "duplicate_sequences",
        "personas",
        "scenarios",
        "status_counts",
        "requests_file",
        "rollups_file",
    )

    def __init__(self, run_id: str) -> None:
        self.run_id = run_id
        self.lock = threading.Lock()
        self.started_at_iso = iso_now()
        self.total_received = 0
        self.total_rejected = 0
        self.window_received = 0
        self.window_bytes = 0
        self.window_latency_count = 0
        self.window_latency_ms = 0.0
        self.window_start_ms = time.time() * 1000.0
        self.seen_sequences: set[int] = set()
        self.duplicate_sequences = 0
        self.personas: dict[str, int] = defaultdict(int)
        self.scenarios: dict[str, int] = defaultdict(int)
        self.status_counts: dict[str, int] = defaultdict(int)
        run_dir = LOG_DIR / safe_run_dir_name(run_id)
        run_dir.mkdir(parents=True, exist_ok=True)
        self.requests_file = open(run_dir / "requests.ndjson", "a", encoding="utf-8")
        self.rollups_file = open(run_dir / "rollups.ndjson", "a", encoding="utf-8")


def safe_run_dir_name(run_id: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in run_id)[:160]


class State:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.runs: dict[str, RunBucket] = {}
        self.stop_event = threading.Event()
        self.all_requests_file = open(ALL_REQUESTS_PATH, "a", encoding="utf-8")
        self.all_rollups_file = open(ALL_ROLLUPS_PATH, "a", encoding="utf-8")
        self.start_iso = iso_now()


STATE = State()


def get_or_create_run(run_id: str) -> RunBucket:
    with STATE.lock:
        bucket = STATE.runs.get(run_id)
        if bucket is None:
            bucket = RunBucket(run_id)
            STATE.runs[run_id] = bucket
    return bucket


def write_json_line(file_handle, payload: dict) -> None:
    file_handle.write(json.dumps(payload, separators=(",", ":")) + "\n")
    file_handle.flush()


def flush_run_rollup(bucket: RunBucket, reason: str = "interval") -> dict:
    now_ms = time.time() * 1000.0
    with bucket.lock:
        elapsed_ms = max(1.0, now_ms - bucket.window_start_ms)
        rate = round((bucket.window_received * 1000.0) / elapsed_ms, 3)
        avg_latency = (
            round(bucket.window_latency_ms / bucket.window_latency_count, 2)
            if bucket.window_latency_count > 0
            else None
        )
        rollup = {
            "timestamp": iso_now(),
            "run_id": bucket.run_id,
            "reason": reason,
            "window_seconds": round(elapsed_ms / 1000.0, 3),
            "window_received": bucket.window_received,
            "window_bytes": bucket.window_bytes,
            "avg_end_to_end_latency_ms": avg_latency,
            "rate_per_second": rate,
            "total_received": bucket.total_received,
            "total_rejected": bucket.total_rejected,
            "duplicate_sequences": bucket.duplicate_sequences,
            "unique_personas": len(bucket.personas),
            "unique_scenarios": len(bucket.scenarios),
            "status_counts": dict(bucket.status_counts),
        }
        bucket.window_start_ms = now_ms
        bucket.window_received = 0
        bucket.window_bytes = 0
        bucket.window_latency_count = 0
        bucket.window_latency_ms = 0.0

    write_json_line(bucket.rollups_file, rollup)
    write_json_line(STATE.all_rollups_file, rollup)

    summary_path = LOG_DIR / safe_run_dir_name(bucket.run_id) / "run-summary.json"
    summary = {
        "run_id": bucket.run_id,
        "started_at": bucket.started_at_iso,
        "last_update_at": rollup["timestamp"],
        "total_received": rollup["total_received"],
        "total_rejected": rollup["total_rejected"],
        "duplicate_sequences": rollup["duplicate_sequences"],
        "unique_personas": rollup["unique_personas"],
        "unique_scenarios": rollup["unique_scenarios"],
        "status_counts": rollup["status_counts"],
        "personas": dict(bucket.personas),
        "scenarios": dict(bucket.scenarios),
    }
    summary_path.write_text(json.dumps(summary, separators=(",", ":")), encoding="utf-8")
    return rollup


def parse_timestamp_ms(value):
    if not value:
        return None
    v = str(value).strip()
    if v.endswith("Z"):
        v = v[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(v).timestamp() * 1000.0
    except ValueError:
        return None


class ListenerHandler(BaseHTTPRequestHandler):
    server_version = "MultiUserLoadListener/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        return

    def _send(self, code: int, payload, content_type: str = "application/json") -> None:
        if isinstance(payload, (dict, list)):
            data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        else:
            data = str(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/healthz":
            self._send(200, {"ok": True, "started_at": STATE.start_iso, "runs": len(STATE.runs)})
            return
        if parsed.path == "/metrics":
            lines = [
                "# multi-user load-test listener",
                f"listener_started_at {STATE.start_iso}",
                f"listener_runs_total {len(STATE.runs)}",
            ]
            with STATE.lock:
                bucket_items = list(STATE.runs.items())
            for run_id, bucket in bucket_items:
                with bucket.lock:
                    lines.append(f'listener_run_received{{run_id="{run_id}"}} {bucket.total_received}')
                    lines.append(f'listener_run_duplicates{{run_id="{run_id}"}} {bucket.duplicate_sequences}')
                    lines.append(f'listener_run_rejected{{run_id="{run_id}"}} {bucket.total_rejected}')
            self._send(200, "\n".join(lines) + "\n", content_type="text/plain; charset=utf-8")
            return
        self._send(404, {"ok": False, "error": "Not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/webhook":
            self._send(404, {"ok": False, "error": "Not found"})
            return

        if AUTH_TOKEN:
            provided = (self.headers.get("x-load-test-token") or "").strip()
            if provided != AUTH_TOKEN:
                bucket = get_or_create_run(UNKNOWN_RUN_ID)
                with bucket.lock:
                    bucket.total_rejected += 1
                    bucket.status_counts["401"] += 1
                self._send(401, {"ok": False, "error": "Unauthorized"})
                return

        content_length = int(self.headers.get("Content-Length") or "0")
        if content_length > MAX_BODY_BYTES:
            bucket = get_or_create_run(UNKNOWN_RUN_ID)
            with bucket.lock:
                bucket.total_rejected += 1
                bucket.status_counts["413"] += 1
            self._send(413, {"ok": False, "error": "Body too large"})
            return

        body = self.rfile.read(content_length) if content_length > 0 else b""
        request_at_ms = time.time() * 1000.0
        try:
            payload = json.loads(body.decode("utf-8")) if body else None
        except json.JSONDecodeError:
            payload = None

        run_id = None
        sequence = None
        persona = None
        scenario = None
        sent_at = None
        scheduled_at = None
        if isinstance(payload, dict):
            run_id_val = payload.get("load_test_run_id")
            run_id = run_id_val.strip() if isinstance(run_id_val, str) and run_id_val.strip() else None
            seq_val = payload.get("load_test_sequence")
            if isinstance(seq_val, int):
                sequence = seq_val
            elif isinstance(seq_val, str) and seq_val.strip().lstrip("-").isdigit():
                sequence = int(seq_val.strip())
            persona_val = payload.get("load_test_persona")
            persona = persona_val.strip() if isinstance(persona_val, str) and persona_val.strip() else None
            scenario_val = payload.get("load_test_scenario")
            scenario = scenario_val.strip() if isinstance(scenario_val, str) and scenario_val.strip() else None
            sent_at = payload.get("sent_at")
            scheduled_at = payload.get("scheduled_at")

        bucket_run_id = run_id or UNKNOWN_RUN_ID
        bucket = get_or_create_run(bucket_run_id)

        sent_at_ms = parse_timestamp_ms(sent_at)
        scheduled_at_ms = parse_timestamp_ms(scheduled_at)
        latency_ms = None
        if sent_at_ms is not None:
            latency_ms = round(request_at_ms - sent_at_ms, 2)
        elif scheduled_at_ms is not None:
            latency_ms = round(request_at_ms - scheduled_at_ms, 2)

        is_duplicate = False
        with bucket.lock:
            bucket.total_received += 1
            bucket.window_received += 1
            bucket.window_bytes += len(body)
            bucket.status_counts["200"] += 1
            if latency_ms is not None:
                bucket.window_latency_count += 1
                bucket.window_latency_ms += latency_ms
            if isinstance(sequence, int):
                if sequence in bucket.seen_sequences:
                    bucket.duplicate_sequences += 1
                    is_duplicate = True
                else:
                    bucket.seen_sequences.add(sequence)
            if persona:
                bucket.personas[persona] += 1
            if scenario:
                bucket.scenarios[scenario] += 1
            total_received = bucket.total_received

        record = {
            "timestamp": iso_now(),
            "method": "POST",
            "path": parsed.path,
            "body_bytes": len(body),
            "load_test_run_id": run_id,
            "load_test_sequence": sequence,
            "load_test_persona": persona,
            "load_test_scenario": scenario,
            "scheduled_at": scheduled_at if isinstance(scheduled_at, str) else None,
            "sent_at": sent_at if isinstance(sent_at, str) else None,
            "end_to_end_latency_ms": latency_ms,
            "duplicate_sequence": is_duplicate,
        }
        write_json_line(bucket.requests_file, record)
        write_json_line(STATE.all_requests_file, record)

        self._send(200, {"ok": True, "total_received": total_received, "duplicate": is_duplicate})


def rollup_loop():
    while not STATE.stop_event.wait(WINDOW_SECONDS):
        with STATE.lock:
            buckets = list(STATE.runs.values())
        for bucket in buckets:
            flush_run_rollup(bucket, "interval")


def shutdown(signum, frame):
    print(f"Received signal {signum}. Shutting down listener.", flush=True)
    STATE.stop_event.set()
    with STATE.lock:
        buckets = list(STATE.runs.values())
    for bucket in buckets:
        try:
            flush_run_rollup(bucket, "shutdown")
        finally:
            try:
                bucket.requests_file.close()
            except Exception:
                pass
            try:
                bucket.rollups_file.close()
            except Exception:
                pass
    try:
        STATE.all_requests_file.close()
    except Exception:
        pass
    try:
        STATE.all_rollups_file.close()
    except Exception:
        pass
    os._exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print(
        json.dumps(
            {
                "event": "listener_started",
                "host": HOST,
                "port": PORT,
                "log_dir": str(LOG_DIR),
                "rollup_window_seconds": WINDOW_SECONDS,
                "auth_enabled": bool(AUTH_TOKEN),
                "max_body_bytes": MAX_BODY_BYTES,
            },
            separators=(",", ":"),
        ),
        flush=True,
    )

    threading.Thread(target=rollup_loop, daemon=True).start()
    ThreadingHTTPServer((HOST, PORT), ListenerHandler).serve_forever()
PY
