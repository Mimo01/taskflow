#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh v1.7 "Release notes here"
# Runs tests + lint, then tags and pushes.

TAG="${1:?Usage: release.sh <tag> [message]}"
MSG="${2:-$TAG}"

# Validate tag format
if [[ ! "$TAG" =~ ^v[0-9] ]]; then
  echo "Error: tag must start with v and a digit (e.g. v1.7)" >&2
  exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo "Error: uncommitted changes. Commit or stash first." >&2
  exit 1
fi

echo "Running tests..."
npx vitest run

echo "Running lint + typecheck..."
npm run check

echo "All checks passed. Tagging $TAG..."
git tag -a "$TAG" -m "$MSG"

echo "Pushing..."
git push origin main
git push origin "$TAG"

echo "Done. Release workflow triggered for $TAG."
