#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 1.7.0
#
# Runs tests and lint/typecheck, then calls bump-version.mjs to update version
# files, regenerate CHANGELOG.md, commit, tag, and push.

VERSION="${1:?Usage: release.sh <version> (e.g. 1.7.0)}"

# Validate semver format (bare X.Y.Z, no v prefix)
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be bare semver format X.Y.Z (e.g. 1.7.0, not v1.7.0)" >&2
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

echo "All checks passed. Bumping to $VERSION..."
node scripts/bump-version.mjs "$VERSION"
