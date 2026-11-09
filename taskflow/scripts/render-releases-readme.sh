#!/usr/bin/env bash
# Render the public releases-repo README from releases-readme.template.md.
#
# Usage: render-releases-readme.sh <version> [--assets <file>]
#   <version>        bare semver, e.g. 1.14.18
#   --assets <file>  newline-separated release asset names; every
#                    releases/download/v<version>/<name> link in the README
#                    must be present in it, otherwise exit 1.
# Env: RELEASE_DATE (YYYY-MM-DD, default today UTC)
# Rendered README goes to stdout; diagnostics go to stderr.
set -euo pipefail

usage() {
  echo "usage: $(basename "$0") <version> [--assets <file>]" >&2
  exit 2
}

VERSION=""
ASSETS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --assets)
      [ $# -ge 2 ] || usage
      ASSETS="$2"
      shift 2
      ;;
    -*)
      usage
      ;;
    *)
      [ -z "$VERSION" ] || usage
      VERSION="$1"
      shift
      ;;
  esac
done

[ -n "$VERSION" ] || usage
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]]; then
  echo "invalid version '$VERSION' (expected bare semver like 1.14.18)" >&2
  exit 2
fi

DATE="${RELEASE_DATE:-$(date -u +%Y-%m-%d)}"
if ! [[ "$DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "invalid RELEASE_DATE '$DATE' (expected YYYY-MM-DD)" >&2
  exit 2
fi

if [ -n "$ASSETS" ] && [ ! -r "$ASSETS" ]; then
  echo "assets file not readable: $ASSETS" >&2
  exit 2
fi

TEMPLATE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/releases-readme.template.md"
if [ ! -r "$TEMPLATE" ]; then
  echo "template not found: $TEMPLATE" >&2
  exit 2
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

sed -e "s/{{VERSION}}/$VERSION/g" -e "s/{{DATE}}/$DATE/g" "$TEMPLATE" > "$TMP/readme.md"

if grep -q '{{' "$TMP/readme.md"; then
  echo "unresolved placeholders in rendered README:" >&2
  grep -n '{{' "$TMP/readme.md" >&2
  exit 1
fi

if [ -n "$ASSETS" ]; then
  tr -d '\r' < "$ASSETS" > "$TMP/assets.txt"
  { grep -oE "releases/download/v${VERSION}/[^)\"' <>]+" "$TMP/readme.md" || true; } \
    | sed 's#.*/##' | sort -u > "$TMP/links.txt"
  if [ ! -s "$TMP/links.txt" ]; then
    echo "no download links found in rendered README; refusing to skip validation" >&2
    exit 1
  fi
  : > "$TMP/missing.txt"
  while IFS= read -r name; do
    if ! grep -qxF -- "$name" "$TMP/assets.txt"; then
      echo "$name" >> "$TMP/missing.txt"
    fi
  done < "$TMP/links.txt"
  if [ -s "$TMP/missing.txt" ]; then
    echo "README links reference assets missing from v$VERSION:" >&2
    cat "$TMP/missing.txt" >&2
    exit 1
  fi
fi

cat "$TMP/readme.md"
