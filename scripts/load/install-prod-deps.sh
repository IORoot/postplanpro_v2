#!/usr/bin/env bash
set -euo pipefail

# Install load-test dependencies on a production-side host (runner or receiver).
#
# Idempotent: re-running just verifies/upgrades.
#
# Flags
#   --dry-run        Print actions, change nothing
#   --skip-k6        Don't install k6 (use this on the receiver-only box)
#   --include-pw     Also install Playwright system dependencies + browsers
#   -h | --help      Show help
#
# Manifest: scripts/load/deps-manifest.txt
# Marker file: /var/lib/postplanpro-load-deps.installed (set on success)

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
MANIFEST="${SCRIPT_DIR}/deps-manifest.txt"
DRY_RUN=0
SKIP_K6=0
INCLUDE_PW=0
MARKER_FILE="/var/lib/postplanpro-load-deps.installed"

usage() {
	sed -n '3,16p' "$0"
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--dry-run) DRY_RUN=1; shift ;;
	--skip-k6) SKIP_K6=1; shift ;;
	--include-pw) INCLUDE_PW=1; shift ;;
	-h|--help) usage; exit 0 ;;
	*) echo "Unknown flag: $1" >&2; usage; exit 1 ;;
	esac
done

run() {
	if [[ "$DRY_RUN" -eq 1 ]]; then
		echo "DRY-RUN $*"
	else
		echo "+ $*"
		eval "$@"
	fi
}

require_root() {
	if [[ "${EUID}" -ne 0 ]] && [[ "$DRY_RUN" -eq 0 ]]; then
		echo "This script needs root (sudo)." >&2
		exit 1
	fi
}

if [[ ! -f "$MANIFEST" ]]; then
	echo "Manifest not found: $MANIFEST" >&2
	exit 1
fi

require_root

if ! command -v apt-get >/dev/null 2>&1; then
	echo "apt-get not available. This script targets Debian/Ubuntu. Install manually:" >&2
	cat "$MANIFEST" >&2
	exit 1
fi

mapfile -t MANIFEST_LINES < <(grep -Ev '^\s*(#|$)' "$MANIFEST" || true)

APT_PKGS=()
NEED_K6=0
for line in "${MANIFEST_LINES[@]}"; do
	kind="${line%%:*}"
	rest="${line#*:}"
	case "$kind" in
		apt) APT_PKGS+=("$rest") ;;
		k6) NEED_K6=1 ;;
		marker) ;;
		*) echo "Unknown manifest kind: $kind" >&2; exit 1 ;;
	esac
done

echo "==> Updating apt index"
run "apt-get update -y"

if [[ ${#APT_PKGS[@]} -gt 0 ]]; then
	echo "==> Installing apt packages: ${APT_PKGS[*]}"
	run "DEBIAN_FRONTEND=noninteractive apt-get install -y ${APT_PKGS[*]}"
fi

if [[ "$NEED_K6" -eq 1 ]] && [[ "$SKIP_K6" -eq 0 ]]; then
	echo "==> Installing k6 from Grafana apt repo"
	run "install -d -m 0755 /etc/apt/keyrings"
	run "curl -fsSL https://dl.k6.io/key.gpg | gpg --dearmor -o /etc/apt/keyrings/k6.gpg"
	run "chmod 0644 /etc/apt/keyrings/k6.gpg"
	run "echo 'deb [signed-by=/etc/apt/keyrings/k6.gpg] https://dl.k6.io/deb stable main' > /etc/apt/sources.list.d/k6.list"
	run "apt-get update -y"
	run "DEBIAN_FRONTEND=noninteractive apt-get install -y k6"
fi

if [[ "$INCLUDE_PW" -eq 1 ]]; then
	if ! command -v npx >/dev/null 2>&1; then
		echo "npx not found - install Node.js / Bun first if you want Playwright on this host." >&2
	else
		echo "==> Installing Playwright browsers + system deps"
		run "npx --yes playwright install --with-deps chromium"
	fi
fi

if [[ "$DRY_RUN" -eq 0 ]]; then
	mkdir -p "$(dirname "$MARKER_FILE")"
	{
		echo "installed_at=$(date -u +%FT%TZ)"
		echo "manifest=$MANIFEST"
		echo "skip_k6=$SKIP_K6"
		echo "include_pw=$INCLUDE_PW"
	} > "$MARKER_FILE"
	echo "==> Marker written: $MARKER_FILE"
fi

echo "==> Verifying installs"
for pkg in "${APT_PKGS[@]}"; do
	if dpkg -s "$pkg" >/dev/null 2>&1; then
		echo "ok: apt $pkg"
	else
		echo "MISSING apt $pkg" >&2
	fi
done
if [[ "$NEED_K6" -eq 1 ]] && [[ "$SKIP_K6" -eq 0 ]]; then
	if command -v k6 >/dev/null 2>&1; then
		echo "ok: k6 $(k6 version 2>/dev/null | head -n1)"
	else
		echo "MISSING k6" >&2
	fi
fi
echo "Done."
