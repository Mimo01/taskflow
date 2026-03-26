#!/usr/bin/env bash
# generate-changelog.sh — Generates a categorized markdown changelog from conventional commits.
#
# Usage: generate-changelog.sh [new-tag-or-ref] [prev-tag]
#   $1 = new ref (default: HEAD)
#   $2 = previous tag (default: auto-detected via git describe)
#
# Output: Markdown changelog to stdout.

set -euo pipefail

NEW_REF="${1:-HEAD}"
PREV_TAG="${2:-}"

# Auto-detect previous tag if not provided
if [[ -z "$PREV_TAG" ]]; then
  if [[ "$NEW_REF" == "HEAD" ]]; then
    PREV_TAG=$(git describe --tags --abbrev=0 HEAD 2>/dev/null || echo "")
  else
    # Find the tag just before NEW_REF
    PREV_TAG=$(git describe --tags --abbrev=0 "${NEW_REF}^" 2>/dev/null || echo "")
  fi
fi

if [[ -z "$PREV_TAG" ]]; then
  RANGE="$NEW_REF"
else
  RANGE="$PREV_TAG..$NEW_REF"
fi

# Collect commits in the range
COMMITS=$(git log --format='%s' "$RANGE" 2>/dev/null || echo "")

if [[ -z "$COMMITS" ]]; then
  echo "Internal improvements and maintenance."
  exit 0
fi

# Accumulators for each category
FEATURES=""
BUG_FIXES=""
IMPROVEMENTS=""
OTHER=""

while IFS= read -r commit; do
  [[ -z "$commit" ]] && continue

  # Extract description: strip "type(scope): " or "type: " prefix
  description=$(echo "$commit" | sed 's/^[a-z]*([^)]*): //' | sed 's/^[a-z]*: //')
  # Capitalize first letter
  description="$(echo "${description:0:1}" | tr '[:lower:]' '[:upper:]')${description:1}"

  if echo "$commit" | grep -qE '^feat(\(|:)'; then
    FEATURES="${FEATURES}- ${description}\n"
  elif echo "$commit" | grep -qE '^fix(\(|:)'; then
    BUG_FIXES="${BUG_FIXES}- ${description}\n"
  elif echo "$commit" | grep -qE '^refactor(\(|:)'; then
    IMPROVEMENTS="${IMPROVEMENTS}- ${description}\n"
  elif echo "$commit" | grep -qE '^(test|docs|ci|chore)(\(|:)'; then
    # Skip non-user-facing commit types
    :
  else
    # No conventional prefix — treat as Other Changes
    OTHER="${OTHER}- ${commit}\n"
  fi
done <<< "$COMMITS"

OUTPUT=""

if [[ -n "$FEATURES" ]]; then
  OUTPUT="${OUTPUT}### Features\n${FEATURES}\n"
fi

if [[ -n "$BUG_FIXES" ]]; then
  OUTPUT="${OUTPUT}### Bug Fixes\n${BUG_FIXES}\n"
fi

if [[ -n "$IMPROVEMENTS" ]]; then
  OUTPUT="${OUTPUT}### Improvements\n${IMPROVEMENTS}\n"
fi

if [[ -n "$OTHER" ]]; then
  OUTPUT="${OUTPUT}### Other Changes\n${OTHER}\n"
fi

if [[ -z "$OUTPUT" ]]; then
  echo "Internal improvements and maintenance."
else
  # Print output, collapsing consecutive blank lines
  printf "%b" "$OUTPUT" | cat -s | sed '/^[[:space:]]*$/{ $d; }'
fi
