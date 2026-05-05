#!/usr/bin/env bash
set -euo pipefail

# Remove load-test dependencies installed by install-prod-deps.sh and restore the
# host to its pre-install baseline.
#
# This is destructive (apt purge) - explicit confirmation required.
#
# Flags
#   --dry-run                Print actions, change nothing
#   --confirm-destroy        Required to actually remove anything
#   --keep-apt-pkgs          Keep apt packages, only remove k6 + marker
#   --remove-pw-browsers     Also remove Playwright browser cache (~/.cache/ms-playwright)
#   -h | --help              Show help
#
# Manifest: scripts/load/deps-manifest.txt
# Marker:   /var/lib/postplanpro-load-deps.installed

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
MANIFEST="${SCRIPT_DIR}/deps-manifest.txt"
DRY_RUN=0
CONFIRM=0
KEEP_APT=0
REMOVE_PW=0
MARKER_FILE="/var/lib/postplanpro-load-deps.installed"

usage() {
	sed -n '3,18p' "$0"
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--dry-run) DRY_RUN=1; shift ;;
	--confirm-destroy) CONFIRM=1; shift ;;
	--keep-apt-pkgs) KEEP_APT=1; shift ;;
	--remove-pw-browsers) REMOVE_PW=1; shift ;;
	-h|--help) usage; exit 0 ;;
	*) echo "Unknown flag: $1" >&2; usage; exit 1 ;;
	esac
done

if [[ "$DRY_RUN" -eq 0 ]] && [[ "$CONFIRM" -eq 0 ]]; then
	echo "Refusing to proceed. Pass --confirm-destroy or --dry-run." >&2
	exit 1
fi

run() {
	if [[ "$DRY_RUN" -eq 1 ]]; then
		echo "DRY-RUN $*"
	else
		echo "+ $*"
		eval "$@"
	fi
}

if [[ ! -f "$MANIFEST" ]]; then
	echo "Manifest not found: $MANIFEST" >&2
	exit 1
fi

if [[ "${EUID}" -ne 0 ]] && [[ "$DRY_RUN" -eq 0 ]]; then
	echo "This script needs root (sudo)." >&2
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
		marker) MARKER_FILE="$rest" ;;
	esac
done

if [[ "$NEED_K6" -eq 1 ]]; then
	echo "==> Removing k6"
	run "DEBIAN_FRONTEND=noninteractive apt-get purge -y k6 || true"
	run "rm -f /etc/apt/sources.list.d/k6.list /etc/apt/keyrings/k6.gpg"
fi

if [[ "$KEEP_APT" -eq 0 ]] && [[ ${#APT_PKGS[@]} -gt 0 ]]; then
	# We deliberately keep curl/ca-certificates/gnupg because they're often pre-installed
	# on minimal images and other tools rely on them. Only purge clearly load-test-only pkgs.
	REMOVE=()
	for p in "${APT_PKGS[@]}"; do
		case "$p" in
			python3|curl|ca-certificates|gnupg|tar) ;;
			*) REMOVE+=("$p") ;;
		esac
	done
	if [[ ${#REMOVE[@]} -gt 0 ]]; then
		echo "==> Removing apt packages: ${REMOVE[*]}"
		run "DEBIAN_FRONTEND=noninteractive apt-get purge -y ${REMOVE[*]}"
	fi
fi

run "DEBIAN_FRONTEND=noninteractive apt-get autoremove -y || true"
run "apt-get update -y || true"

if [[ "$REMOVE_PW" -eq 1 ]]; then
	echo "==> Removing Playwright browser cache from common locations"
	run "rm -rf /root/.cache/ms-playwright"
	if [[ -n "${SUDO_USER:-}" ]]; then
		run "rm -rf /home/${SUDO_USER}/.cache/ms-playwright"
	fi
fi

if [[ -f "$MARKER_FILE" ]]; then
	run "rm -f '$MARKER_FILE'"
	echo "==> Marker removed: $MARKER_FILE"
fi

echo "Done."
