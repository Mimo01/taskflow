#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh v1.7 ["Custom release notes"]
#
# When called without a message, auto-generates a categorized markdown changelog
# from conventional commits between the previous tag and the new tag.
# When called with a message, uses it as-is (backward compatible).
#
# The tag annotation format is:
#   Subject line (tag name)
#   <blank line>
#   Body (changelog markdown)
#
# CI extracts the body via: git tag -l --format='%(contents:body)'

TAG="${1:?Usage: release.sh <tag> [message]}"
CUSTOM_MSG="${2:-}"

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

# Build tag message body
if [[ -z "$CUSTOM_MSG" ]]; then
  # Auto-detect the previous tag
  PREV_TAG=$(git describe --tags --abbrev=0 HEAD 2>/dev/null || echo "")

  echo ""
  echo "Generating changelog from ${PREV_TAG:-beginning}..HEAD..."
  CHANGELOG=$(bash "$(dirname "$0")/generate-changelog.sh" "$TAG" "$PREV_TAG")

  echo ""
  echo "=== Release Changelog ==="
  echo "$CHANGELOG"
  echo "========================="
  echo ""

  TAG_BODY="$CHANGELOG"
else
  TAG_BODY="$CUSTOM_MSG"
fi

# Create annotated tag with subject = tag name, body = changelog
# Using -F - to support multi-line messages cleanly
printf "%s\n\n%s\n" "$TAG" "$TAG_BODY" | git tag -a "$TAG" -F -

echo "Pushing..."
git push origin main
git push origin "$TAG"

echo "Done. Release workflow triggered for $TAG."
