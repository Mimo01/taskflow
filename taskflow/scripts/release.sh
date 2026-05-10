#!/usr/bin/env bash
set -euo pipefail

# Usage: echo "<release notes>" | ./scripts/release.sh <version> [--skip-bump]
# Example: printf '### Fixed\n- Bug fix' | ./scripts/release.sh 1.7.1
# Example: ./scripts/release.sh 1.7.1 --skip-bump  (version already bumped)
#
# Simplified release trigger:
#   A. Pre-flight checks (version format, clean working tree, git remote)
#   B. Version bump (delegates to bump-version.mjs) + tag creation
#   C. Push tag to origin → triggers CI (builds macOS/Linux/Windows, creates release, uploads artifacts)
#   D. Summary
#
# The GitHub Actions workflow handles all builds, release creation, artifact upload,
# latest.json generation, and README update.
#
# Credentials required in GitHub repository secrets (not needed locally):
#   TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, RELEASES_REPO_PAT

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASKFLOW_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$TASKFLOW_DIR")"

SKIP_BUMP=false
VERSION=""
for arg in "$@"; do
  case "$arg" in
    --skip-bump) SKIP_BUMP=true ;;
    --*) ;;
    *) VERSION="$arg" ;;
  esac
done

if [[ -z "$VERSION" ]]; then
  echo "Usage: echo '<release notes>' | release.sh <version> [--skip-bump]" >&2
  exit 1
fi

# Capture release notes from stdin early (before anything else reads stdin)
RELEASE_NOTES="$(cat)"
if [[ -z "$RELEASE_NOTES" ]] && [[ "$SKIP_BUMP" == "false" ]]; then
  echo "Error: No release notes provided on stdin." >&2
  echo "Usage: printf '### Fixed\n- Bug fix' | ./scripts/release.sh 1.7.1" >&2
  exit 1
fi

# --- Phase A: Pre-flight checks ---
echo "==> Pre-flight checks..."

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be bare semver format X.Y.Z (e.g. 1.7.0, not v1.7.0)" >&2
  exit 1
fi

if ! git -C "$REPO_ROOT" diff-index --quiet HEAD --; then
  echo "Error: uncommitted changes. Commit or stash first." >&2
  exit 1
fi

if ! git -C "$REPO_ROOT" remote get-url origin &>/dev/null; then
  echo "Error: git remote 'origin' not found." >&2
  exit 1
fi

echo "    Version: $VERSION"
echo "    Token: handled by CI"
echo "    Signing key: handled by CI"
echo "    All pre-flight checks passed."

# --- Phase B: Version bump ---
echo ""
if [[ "$SKIP_BUMP" == "true" ]]; then
  echo "==> Phase B: Version bump... SKIPPED (--skip-bump)"
  cd "$TASKFLOW_DIR"
  if ! git -C "$REPO_ROOT" rev-parse "v$VERSION" &>/dev/null; then
    echo "    Creating tag v$VERSION on HEAD..."
    NOTES="$(awk "/^## \\[$VERSION\\]/{found=1; next} /^## \\[/{if(found) exit} found" "$TASKFLOW_DIR/CHANGELOG.md" | sed '/^$/d')"
    TAG_MSG="$(printf 'v%s\n\n%s\n' "$VERSION" "$NOTES")"
    printf '%s' "$TAG_MSG" | git -C "$REPO_ROOT" tag -a "v$VERSION" -F -
    echo "    Tagged v$VERSION."
  fi
else
  echo "==> Phase B: Version bump..."
  cd "$TASKFLOW_DIR"
  printf '%s' "$RELEASE_NOTES" | node scripts/bump-version.mjs "$VERSION"
fi

# --- Phase C: Push tag to origin (triggers CI) ---
echo ""
echo "==> Phase C: Pushing to origin..."
git -C "$REPO_ROOT" push origin main
git -C "$REPO_ROOT" push origin "v$VERSION"
echo "    Pushed main and tag v$VERSION — CI will now build and publish the release."

# --- Phase D: Summary ---
echo ""
echo "=========================================="
echo "  Release v$VERSION triggered!"
echo "=========================================="
echo ""
echo "GitHub Actions will now:"
echo "  1. Build macOS universal, Linux x86_64, Windows x86_64"
echo "  2. Create release on Mimo01/taskflow-releases"
echo "  3. Upload artifacts + latest.json"
echo "  4. Update releases repo README"
echo ""
echo "Monitor progress:"
echo "  https://github.com/Mimo01/taskflow/actions"
echo ""
echo "Release will appear at:"
echo "  https://github.com/Mimo01/taskflow-releases/releases/tag/v$VERSION"
