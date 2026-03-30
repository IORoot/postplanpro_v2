#!/usr/bin/env bash
# Interactive semver bump: updates package.json, prepends changelog.md, optional tag/commit.
# From repo root: ./scripts/bump-version.sh
# Pre-push (optional): git config core.hooksPath scripts/git-hooks
# Skip in automation: SKIP_VERSION_BUMP=1 git push

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

HOOK=0
if [[ "${1:-}" == "--hook" ]]; then
	HOOK=1
fi

if [[ "$HOOK" == 1 ]]; then
	if [[ ! -c /dev/tty ]]; then
		exit 0
	fi
	read -r -p "Bump version before push? [y/N] " yn </dev/tty || true
	case "${yn:-}" in
	[Yy] | [Yy][Ee][Ss]) ;;
	*) exit 0 ;;
	esac
fi

CURRENT="$(node -p "require('./package.json').version")"
echo "Current version: $CURRENT"

if [[ -c /dev/tty ]]; then
	read -r -p "New version (semver, empty to cancel): " NEWVER </dev/tty || true
else
	read -r -p "New version (semver, empty to cancel): " NEWVER || true
fi

if [[ -z "${NEWVER:-}" ]]; then
	echo "Cancelled."
	exit 0
fi

if ! [[ "$NEWVER" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]]; then
	echo "Invalid semver: $NEWVER" >&2
	exit 1
fi

LAST_TAG="$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)"
if [[ -n "$LAST_TAG" ]]; then
	RANGE="${LAST_TAG}..HEAD"
else
	ROOT_COMMIT="$(git rev-list --max-parents=0 HEAD | tail -n 1)"
	RANGE="${ROOT_COMMIT}..HEAD"
fi

COMMITS="$(git log --pretty=format:'- %s (%h)' "$RANGE" 2>/dev/null || true)"
if [[ -z "$COMMITS" ]]; then
	COMMITS="- (no commits in range)"
fi

DATE="$(date +%Y-%m-%d)"
CHANGELOG="$ROOT/changelog.md"
TMP="$(mktemp)"

if [[ ! -f "$CHANGELOG" ]]; then
	printf '# Changelog\n\n' >"$CHANGELOG"
fi

BODY="$(tail -n +2 "$CHANGELOG")"
{
	printf '%s\n\n' '# Changelog'
	printf '%s\n\n' "## $NEWVER — $DATE"
	printf '%s\n\n' "$COMMITS"
	printf '%s' "$BODY"
} >"$TMP"
mv "$TMP" "$CHANGELOG"

node -e "
const fs = require('fs');
const v = process.argv[1];
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
p.version = v;
fs.writeFileSync('package.json', JSON.stringify(p, null, '\t') + '\n');
" "$NEWVER"

echo "Updated package.json and changelog.md to $NEWVER."

if [[ -c /dev/tty ]]; then
	read -r -p "Create annotated git tag v${NEWVER}? [y/N] " tagyn </dev/tty || true
	case "${tagyn:-}" in
	[Yy] | [Yy][Ee][Ss]) git tag -a "v${NEWVER}" -m "Release ${NEWVER}" && echo "Tagged v${NEWVER}." ;;
	esac

	read -r -p "Create git commit for package.json and changelog.md? [y/N] " cyn </dev/tty || true
	case "${cyn:-}" in
	[Yy] | [Yy][Ee][Ss])
		git add package.json changelog.md
		git commit -m "chore: release ${NEWVER}"
		echo "Created commit."
		;;
	esac
fi

if [[ "$HOOK" == 1 ]]; then
	echo "Push aborted so you can review. Run git push again when ready."
	exit 1
fi

echo "Done."
