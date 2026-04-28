#!/usr/bin/env bash
set -euo pipefail

# Purpose:
# - Single-file load-test webhook listener for second server.
# - Requires bash + python3 only.
#
# What this does:
# - Serves POST /webhook on HOST:PORT.
# - Writes per-request logs to requests.ndjson.
# - Writes rolling throughput logs to rollups.ndjson.
# - Optional auth via x-load-test-token header.

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-4000}"
LOG_DIR="${LOG_DIR:-./load-test-listener-logs}"
ROLLUP_WINDOW_SECONDS="${ROLLUP_WINDOW_SECONDS:-10}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

usage() {
	cat <<'EOF'
Usage: load-test-listener-standalone.sh [options]

Options:
  --host <host>          Bind host (default: 0.0.0.0)
  --port <port>          Bind port (default: 4000)
  --log-dir <path>       Output directory for ndjson logs
  --window-seconds <n>   Rollup window seconds (default: 10)
  --auth-token <token>   Require x-load-test-token header
  --help                 Show help

Env vars (alternative):
  HOST, PORT, LOG_DIR, ROLLUP_WINDOW_SECONDS, AUTH_TOKEN
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

echo "Starting standalone load-test listener"
echo "  host: $HOST"
echo "  port: $PORT"
echo "  log_dir: $LOG_DIR"
echo "  rollup_window_seconds: $ROLLUP_WINDOW_SECONDS"
if [[ -n "$AUTH_TOKEN" ]]; then
	echo "  auth: enabled (x-load-test-token required)"
else
	echo "  auth: disabled"
fi

HOST="$HOST" \
PORT="$PORT" \
LOG_DIR="$LOG_DIR" \
ROLLUP_WINDOW_SECONDS="$ROLLUP_WINDOW_SECONDS" \
AUTH_TOKEN="$AUTH_TOKEN" \
python3 - <<'PY'
import json
import os
import signal
import threading
import time
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

LOG_DIR.mkdir(parents=True, exist_ok=True)
REQUESTS_LOG_PATH = LOG_DIR / "requests.ndjson"
ROLLUPS_LOG_PATH = LOG_DIR / "rollups.ndjson"


class MetricsState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.total_received = 0
        self.total_rejected = 0
        self.window_received = 0
        self.window_bytes = 0
        self.window_latency_count = 0
        self.window_latency_ms = 0.0
        self.window_start_ms = time.time() * 1000.0
        self.stop_event = threading.Event()


STATE = MetricsState()
REQUESTS_LOG_FILE = open(REQUESTS_LOG_PATH, "a", encoding="utf-8")
ROLLUPS_LOG_FILE = open(ROLLUPS_LOG_PATH, "a", encoding="utf-8")


def write_json_line(file_handle, payload: dict) -> None:
    file_handle.write(json.dumps(payload, separators=(",", ":")) + "\n")
    file_handle.flush()


def flush_rollup(reason: str = "interval") -> None:
    now_ms = time.time() * 1000.0
    with STATE.lock:
        elapsed_ms = max(1.0, now_ms - STATE.window_start_ms)
        rate_per_second = round((STATE.window_received * 1000.0) / elapsed_ms, 3)
        avg_latency = (
            round(STATE.window_latency_ms / STATE.window_latency_count, 2)
            if STATE.window_latency_count > 0
            else None
        )
        rollup = {
            "timestamp": iso_now(),
            "reason": reason,
            "window_seconds": round(elapsed_ms / 1000.0, 3),
            "window_received": STATE.window_received,
            "window_rejected": STATE.total_rejected,
            "window_bytes": STATE.window_bytes,
            "avg_end_to_end_latency_ms": avg_latency,
            "rate_per_second": rate_per_second,
            "total_received": STATE.total_received,
            "total_rejected": STATE.total_rejected,
        }
        STATE.window_start_ms = now_ms
        STATE.window_received = 0
        STATE.window_bytes = 0
        STATE.window_latency_count = 0
        STATE.window_latency_ms = 0.0

    write_json_line(ROLLUPS_LOG_FILE, rollup)
    print(f"[rollup] {json.dumps(rollup, separators=(',', ':'))}", flush=True)


def parse_timestamp_ms(value: str | None) -> float | None:
    if not value:
        return None
    v = value.strip()
    if v.endswith("Z"):
        v = v[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(v).timestamp() * 1000.0
    except ValueError:
        return None


class ListenerHandler(BaseHTTPRequestHandler):
    server_version = "LoadTestListenerPython/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        return

    def _send(self, code: int, payload: dict):
        data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/webhook":
            self._send(404, {"ok": False, "error": "Not found"})
            return

        if AUTH_TOKEN:
            provided = (self.headers.get("x-load-test-token") or "").strip()
            if provided != AUTH_TOKEN:
                with STATE.lock:
                    STATE.total_rejected += 1
                self._send(401, {"ok": False, "error": "Unauthorized"})
                return

        content_length = int(self.headers.get("Content-Length") or "0")
        body = self.rfile.read(content_length)
        request_at_ms = time.time() * 1000.0
        payload = None
        try:
            payload = json.loads(body.decode("utf-8")) if body else None
        except json.JSONDecodeError:
            payload = None

        scheduled_at = payload.get("scheduled_at") if isinstance(payload, dict) else None
        sent_at = payload.get("sent_at") if isinstance(payload, dict) else None
        sent_at_ms = parse_timestamp_ms(sent_at) if isinstance(sent_at, str) else None
        scheduled_at_ms = parse_timestamp_ms(scheduled_at) if isinstance(scheduled_at, str) else None

        latency_ms = None
        if sent_at_ms is not None:
            latency_ms = round(request_at_ms - sent_at_ms, 2)
        elif scheduled_at_ms is not None:
            latency_ms = round(request_at_ms - scheduled_at_ms, 2)

        run_id = payload.get("load_test_run_id") if isinstance(payload, dict) else None
        sequence = payload.get("load_test_sequence") if isinstance(payload, dict) else None
        request_id = f"{run_id}:{sequence}" if isinstance(run_id, str) else None

        with STATE.lock:
            STATE.total_received += 1
            STATE.window_received += 1
            STATE.window_bytes += len(body)
            if latency_ms is not None:
                STATE.window_latency_count += 1
                STATE.window_latency_ms += latency_ms
            total_received = STATE.total_received

        write_json_line(
            REQUESTS_LOG_FILE,
            {
                "timestamp": iso_now(),
                "method": "POST",
                "path": parsed.path,
                "body_bytes": len(body),
                "request_id": request_id,
                "load_test_run_id": run_id if isinstance(run_id, str) else None,
                "load_test_sequence": sequence if isinstance(sequence, int) else None,
                "scheduled_at": scheduled_at if isinstance(scheduled_at, str) else None,
                "sent_at": sent_at if isinstance(sent_at, str) else None,
                "end_to_end_latency_ms": latency_ms,
            },
        )

        self._send(200, {"ok": True, "total_received": total_received})


def rollup_loop():
    while not STATE.stop_event.wait(WINDOW_SECONDS):
        flush_rollup("interval")


def shutdown(signum, frame):
    print(f"Received signal {signum}. Shutting down listener.", flush=True)
    STATE.stop_event.set()
    flush_rollup("shutdown")
    REQUESTS_LOG_FILE.close()
    ROLLUPS_LOG_FILE.close()
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
                "requests_log": str(REQUESTS_LOG_PATH),
                "rollups_log": str(ROLLUPS_LOG_PATH),
                "rollup_window_seconds": WINDOW_SECONDS,
                "auth_enabled": bool(AUTH_TOKEN),
            },
            separators=(",", ":"),
        ),
        flush=True,
    )

    threading.Thread(target=rollup_loop, daemon=True).start()
    ThreadingHTTPServer((HOST, PORT), ListenerHandler).serve_forever()
PY
