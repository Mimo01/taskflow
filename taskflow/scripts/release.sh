#!/usr/bin/env bash
set -euo pipefail

# Usage: echo "<release notes>" | ./scripts/release.sh <version> [--skip-bump]
# Example: printf '### Fixed\n- Bug fix' | ./scripts/release.sh 1.7.1
# Example: ./scripts/release.sh 1.7.1 --skip-bump  (version already bumped)
#
# Full local release lifecycle:
#   A. Pre-flight checks
#   B. Version bump (delegates to bump-version.mjs)
#   C. Local builds (macOS native + Linux via Docker)
#   D. Create GitHub release on Mimo01/taskflow-releases
#   E. Upload artifacts
#   F. Generate and upload latest.json (Tauri updater manifest)
#   G. Update README in releases repo
#   H. Push tag + commits to origin
#   I. Summary
#
# Credentials (auto-detected in this order):
#   RELEASES_REPO_TOKEN  — 1) env var, 2) macOS Keychain (git credential-osxkeychain)
#   TAURI_SIGNING_PRIVATE_KEY — 1) env var, 2) ~/.tauri/taskflow.key
#   TAURI_SIGNING_PRIVATE_KEY_PASSWORD — env var (empty string if not set)
#
# Platform scope: macOS (native universal) + Linux x86_64 (Docker)
# Windows: Not currently supported from macOS. Contribute a Windows build separately.

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASKFLOW_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$TASKFLOW_DIR")"

SKIP_BUMP=false
for arg in "$@"; do
  case "$arg" in
    --skip-bump) SKIP_BUMP=true ;;
  esac
done

# Strip flags to get version
VERSION=""
for arg in "$@"; do
  case "$arg" in
    --*) ;; # skip flags
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

# ─────────────────────────────────────────────────────────────────────────────
# PHASE A — Pre-flight checks
# ─────────────────────────────────────────────────────────────────────────────

echo "==> Pre-flight checks..."

# Validate semver format (bare X.Y.Z, no v prefix)
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be bare semver format X.Y.Z (e.g. 1.7.0, not v1.7.0)" >&2
  exit 1
fi

# Check for uncommitted changes
if ! git -C "$REPO_ROOT" diff-index --quiet HEAD --; then
  echo "Error: uncommitted changes. Commit or stash first." >&2
  exit 1
fi

# Auto-detect RELEASES_REPO_TOKEN from macOS Keychain if not set
if [[ -z "${RELEASES_REPO_TOKEN:-}" ]]; then
  echo "    RELEASES_REPO_TOKEN not set, trying macOS Keychain..."
  RELEASES_REPO_TOKEN=$(printf 'protocol=https\nhost=github.com\n' \
    | git credential-osxkeychain get 2>/dev/null \
    | grep password | cut -d= -f2) || true
  if [[ -z "$RELEASES_REPO_TOKEN" ]]; then
    echo "Error: RELEASES_REPO_TOKEN not found in env or Keychain." >&2
    echo "  Set it with: export RELEASES_REPO_TOKEN=ghp_..." >&2
    exit 1
  fi
  echo "    Token loaded from macOS Keychain."
fi

# Auto-detect TAURI_SIGNING_PRIVATE_KEY from ~/.tauri/taskflow.key if not set
if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
  TAURI_KEY_FILE="$HOME/.tauri/taskflow.key"
  if [[ -f "$TAURI_KEY_FILE" ]]; then
    echo "    Loading signing key from $TAURI_KEY_FILE..."
    TAURI_SIGNING_PRIVATE_KEY="$(cat "$TAURI_KEY_FILE")"
    export TAURI_SIGNING_PRIVATE_KEY
  else
    echo "Error: TAURI_SIGNING_PRIVATE_KEY not set and $TAURI_KEY_FILE not found." >&2
    echo "  Set it with: export TAURI_SIGNING_PRIVATE_KEY=\$(cat ~/.tauri/taskflow.key)" >&2
    exit 1
  fi
fi
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"

AUTH_HEADER="Authorization: token $RELEASES_REPO_TOKEN"
RELEASES_API="https://api.github.com/repos/Mimo01/taskflow-releases"

echo "    Version: $VERSION"
echo "    Token: set"
echo "    Signing key: set"
echo "    All pre-flight checks passed."

# ─────────────────────────────────────────────────────────────────────────────
# PHASE B — Version bump
# ─────────────────────────────────────────────────────────────────────────────

echo ""
if [[ "$SKIP_BUMP" == "true" ]]; then
  echo "==> Phase B: Version bump... SKIPPED (--skip-bump)"
  cd "$TASKFLOW_DIR"
  # Still need the tag for Phase D (release body) and Phase H (push)
  if ! git -C "$REPO_ROOT" rev-parse "v$VERSION" &>/dev/null; then
    echo "    Creating tag v$VERSION on HEAD..."
    # Extract release notes from CHANGELOG.md for this version
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

# ─────────────────────────────────────────────────────────────────────────────
# PHASE C — Local builds
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "==> Phase C: Local builds..."

# --- macOS: native universal build ---
echo "  --> macOS universal build..."
cd "$TASKFLOW_DIR"
eval "$(node scripts/inject-version.cjs)"
npm run build
npx tauri build --target universal-apple-darwin

# Restore version-injected files and Cargo.lock to avoid dirty state
git -C "$REPO_ROOT" checkout -- taskflow/src-tauri/tauri.conf.json taskflow/package.json taskflow/src-tauri/Cargo.toml taskflow/src-tauri/Cargo.lock

MACOS_BUNDLE_DIR="$TASKFLOW_DIR/src-tauri/target/universal-apple-darwin/release/bundle"
MACOS_DMG="$MACOS_BUNDLE_DIR/dmg/Taskflow_${VERSION}_universal.dmg"
MACOS_APP_TGZ="$MACOS_BUNDLE_DIR/macos/Taskflow.app.tar.gz"
MACOS_APP_SIG="$MACOS_BUNDLE_DIR/macos/Taskflow.app.tar.gz.sig"

# Verify macOS artifacts exist
for f in "$MACOS_DMG" "$MACOS_APP_TGZ" "$MACOS_APP_SIG"; do
  if [[ ! -f "$f" ]]; then
    echo "Error: Expected macOS artifact not found: $f" >&2
    exit 1
  fi
done
echo "    macOS artifacts built successfully."

# --- Linux: Docker-based build ---
LINUX_BUILD_SUCCESS=false
LINUX_BUNDLE_DIR=""

if command -v docker &>/dev/null && docker info &>/dev/null; then
  echo "  --> Linux build (Docker)..."
  LINUX_BUNDLE_DIR="$TASKFLOW_DIR/src-tauri/target/x86_64-unknown-linux-gnu/release/bundle"

  # Build using Docker with Ubuntu + Rust + WebKit2GTK
  docker run --rm \
    -v "$REPO_ROOT:/workspace" \
    -w "/workspace/taskflow" \
    -e "TAURI_SIGNING_PRIVATE_KEY=$TAURI_SIGNING_PRIVATE_KEY" \
    -e "TAURI_SIGNING_PRIVATE_KEY_PASSWORD=${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}" \
    ubuntu:22.04 \
    bash -c "
      set -euo pipefail
      apt-get update -qq
      apt-get install -y -qq \
        curl build-essential pkg-config \
        libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev \
        libappindicator3-dev librsvg2-dev patchelf
      # Install Node.js
      curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
      apt-get install -y -qq nodejs
      # Install Rust
      curl -fsSL https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
      source \$HOME/.cargo/env
      rustup target add x86_64-unknown-linux-gnu
      # Build
      npm ci
      eval \$(node scripts/inject-version.cjs)
      npm run build
      cargo tauri build --target x86_64-unknown-linux-gnu
    "

  # Restore version-injected files and Cargo.lock to avoid dirty state
  git -C "$REPO_ROOT" checkout -- taskflow/src-tauri/tauri.conf.json taskflow/package.json taskflow/src-tauri/Cargo.toml taskflow/src-tauri/Cargo.lock

  LINUX_APPIMAGE="$LINUX_BUNDLE_DIR/appimage/taskflow_${VERSION}_amd64.AppImage"
  LINUX_APPIMAGE_SIG="$LINUX_BUNDLE_DIR/appimage/taskflow_${VERSION}_amd64.AppImage.tar.gz.sig"
  LINUX_APPIMAGE_TGZ="$LINUX_BUNDLE_DIR/appimage/taskflow_${VERSION}_amd64.AppImage.tar.gz"
  LINUX_DEB="$LINUX_BUNDLE_DIR/deb/taskflow_${VERSION}_amd64.deb"

  if [[ -f "$LINUX_APPIMAGE_TGZ" ]] && [[ -f "$LINUX_DEB" ]]; then
    LINUX_BUILD_SUCCESS=true
    echo "    Linux artifacts built successfully."
  else
    echo "    Warning: Linux build completed but expected artifacts not found. Continuing without Linux." >&2
  fi
else
  echo "    Docker not available (not installed or daemon not running). Skipping Linux build." >&2
  echo "    CI will handle Linux + Windows builds." >&2
fi

# ─────────────────────────────────────────────────────────────────────────────
# PHASE D — Create GitHub release on Mimo01/taskflow-releases
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "==> Phase D: Creating GitHub release..."

# Extract tag annotation body
TAG_BODY="$(git -C "$REPO_ROOT" tag -l --format='%(contents:body)' "v$VERSION")"

# Escape for JSON (replace newlines with \n, escape quotes and backslashes)
TAG_BODY_JSON="$(printf '%s' "$TAG_BODY" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")"

RELEASE_RESPONSE=$(curl -s -X POST \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  "$RELEASES_API/releases" \
  -d "{
    \"tag_name\": \"v$VERSION\",
    \"target_commitish\": \"main\",
    \"name\": \"Taskflow v$VERSION\",
    \"body\": $TAG_BODY_JSON,
    \"draft\": false,
    \"prerelease\": false
  }")

RELEASE_ID=$(echo "$RELEASE_RESPONSE" | python3 -c "
import sys, json
data = json.loads(sys.stdin.read(), strict=False)
if 'id' not in data:
    print('Error: GitHub API did not return a release id. Response:', file=sys.stderr)
    print(json.dumps(data, indent=2), file=sys.stderr)
    sys.exit(1)
print(data['id'])
")

echo "    Release created: ID $RELEASE_ID"
echo "    URL: https://github.com/Mimo01/taskflow-releases/releases/tag/v$VERSION"

# ─────────────────────────────────────────────────────────────────────────────
# PHASE E — Upload artifacts
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "==> Phase E: Uploading artifacts..."

UPLOAD_BASE="https://uploads.github.com/repos/Mimo01/taskflow-releases/releases/$RELEASE_ID/assets"

upload_asset() {
  local file="$1"
  local name
  name="$(basename "$file")"
  echo "    Uploading $name..."
  local response
  response=$(curl -s -X POST \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/octet-stream" \
    "$UPLOAD_BASE?name=$name" \
    --data-binary @"$file")
  # Check for errors
  echo "$response" | python3 -c "
import sys, json
data = json.loads(sys.stdin.read(), strict=False)
if 'id' not in data:
    print('Error uploading $name. Response:', file=sys.stderr)
    print(json.dumps(data, indent=2), file=sys.stderr)
    sys.exit(1)
print('      OK: ' + data.get('browser_download_url', '(no url)'))
"
}

# Upload macOS artifacts
upload_asset "$MACOS_DMG"
upload_asset "$MACOS_APP_TGZ"
upload_asset "$MACOS_APP_SIG"

# Upload Linux artifacts (if built)
if [[ "$LINUX_BUILD_SUCCESS" == "true" ]]; then
  upload_asset "$LINUX_APPIMAGE_TGZ"
  upload_asset "$LINUX_APPIMAGE_SIG"
  upload_asset "$LINUX_DEB"
fi

# ─────────────────────────────────────────────────────────────────────────────
# PHASE F — Generate and upload latest.json (Tauri updater manifest)
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "==> Phase F: Generating and uploading latest.json..."

PUB_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Write tag body to temp file to avoid shell escaping issues with special characters
printf '%s' "$TAG_BODY" > /tmp/taskflow-tag-body.txt

LINUX_ARG=""
if [[ "$LINUX_BUILD_SUCCESS" == "true" ]]; then
  LINUX_ARG="linux-x86_64 $LINUX_APPIMAGE_TGZ"
fi

python3 - "$VERSION" "$MACOS_APP_SIG" "$PUB_DATE" "/tmp/taskflow-tag-body.txt" \
  $LINUX_ARG \
  <<'PYEOF' > /tmp/taskflow-latest.json
import sys, json, os

version = sys.argv[1]
sig_file = sys.argv[2]
pub_date = sys.argv[3]
notes_file = sys.argv[4]

with open(notes_file) as f:
    notes = f.read().strip()

with open(sig_file) as f:
    macos_sig = f.read().strip()

macos_url = f"https://github.com/Mimo01/taskflow-releases/releases/download/v{version}/Taskflow.app.tar.gz"
macos_entry = {"signature": macos_sig, "url": macos_url}

data = {
    "version": version,
    "notes": notes,
    "pub_date": pub_date,
    "platforms": {
        "darwin-universal": macos_entry,
        "darwin-x86_64": macos_entry,
        "darwin-aarch64": macos_entry
    }
}

# Optional Linux (argv[5] = platform key, argv[6] = .tar.gz path)
if len(sys.argv) > 6:
    linux_platform = sys.argv[5]
    linux_tgz = sys.argv[6]
    for sig_path in [linux_tgz + ".sig", linux_tgz.replace(".AppImage.tar.gz", ".AppImage.tar.gz.sig")]:
        if os.path.exists(sig_path):
            with open(sig_path) as f:
                linux_sig = f.read().strip()
            linux_filename = os.path.basename(linux_tgz)
            linux_url = f"https://github.com/Mimo01/taskflow-releases/releases/download/v{version}/{linux_filename}"
            data["platforms"][linux_platform] = {"signature": linux_sig, "url": linux_url}
            break

print(json.dumps(data, indent=2))
PYEOF

echo "    Uploading latest.json..."
LATEST_UPLOAD_RESPONSE=$(curl -s -X POST \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  "$UPLOAD_BASE?name=latest.json" \
  --data-binary @/tmp/taskflow-latest.json)

echo "$LATEST_UPLOAD_RESPONSE" | python3 -c "
import sys, json
data = json.loads(sys.stdin.read(), strict=False)
if 'id' not in data:
    print('Error uploading latest.json. Response:', file=sys.stderr)
    print(json.dumps(data, indent=2), file=sys.stderr)
    sys.exit(1)
print('    OK: ' + data.get('browser_download_url', '(no url)'))
"

# ─────────────────────────────────────────────────────────────────────────────
# PHASE G — Update README in releases repo (GitHub Contents API)
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "==> Phase G: Updating releases repo README..."

# Build README content
README_CONTENT="# Taskflow

## Download

### macOS
- [Taskflow_${VERSION}_universal.dmg](https://github.com/Mimo01/taskflow-releases/releases/latest/download/Taskflow_${VERSION}_universal.dmg)
- [Taskflow.app.tar.gz](https://github.com/Mimo01/taskflow-releases/releases/latest/download/Taskflow.app.tar.gz) (for updater)
"

if [[ "$LINUX_BUILD_SUCCESS" == "true" ]]; then
  README_CONTENT+="
### Linux
- [taskflow_${VERSION}_amd64.AppImage.tar.gz](https://github.com/Mimo01/taskflow-releases/releases/latest/download/taskflow_${VERSION}_amd64.AppImage.tar.gz) (AppImage)
- [taskflow_${VERSION}_amd64.deb](https://github.com/Mimo01/taskflow-releases/releases/latest/download/taskflow_${VERSION}_amd64.deb) (Debian/Ubuntu)
"
else
  README_CONTENT+="
### Linux
Linux builds are not yet available from this release. Docker is required for cross-compilation from macOS.

### Windows
Windows builds are not yet available. Windows cross-compilation from macOS is not supported.
"
fi

README_CONTENT+="
---
_Latest release: v${VERSION}_
"

# Base64-encode README content (macOS-compatible)
README_B64=$(printf '%s' "$README_CONTENT" | base64)

# Get current README SHA
SHA=$(curl -s -H "$AUTH_HEADER" \
  "$RELEASES_API/contents/README.md" \
  | python3 -c "
import sys, json
data = json.loads(sys.stdin.read(), strict=False)
sha = data.get('sha', '')
print(sha)
")

# Update README via Contents API
UPDATE_RESPONSE=$(curl -s -X PUT \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  "$RELEASES_API/contents/README.md" \
  -d "{
    \"message\": \"docs: update download links to v$VERSION\",
    \"content\": \"$README_B64\",
    \"sha\": \"$SHA\"
  }")

echo "$UPDATE_RESPONSE" | python3 -c "
import sys, json
data = json.loads(sys.stdin.read(), strict=False)
if 'content' not in data:
    print('Error updating README. Response:', file=sys.stderr)
    print(json.dumps(data, indent=2), file=sys.stderr)
    sys.exit(1)
print('    README updated successfully.')
"

# ─────────────────────────────────────────────────────────────────────────────
# PHASE H — Push tag + commits to origin
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "==> Phase H: Pushing to origin..."

git -C "$REPO_ROOT" push origin main
git -C "$REPO_ROOT" push origin "v$VERSION"
echo "    Pushed main and tag v$VERSION to origin."

# ─────────────────────────────────────────────────────────────────────────────
# PHASE I — Summary
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "=========================================="
echo "  Release v$VERSION complete!"
echo "=========================================="
echo ""
echo "Release URL: https://github.com/Mimo01/taskflow-releases/releases/tag/v$VERSION"
echo ""
echo "Artifacts uploaded:"
echo "  macOS:"
echo "    - Taskflow_${VERSION}_universal.dmg"
echo "    - Taskflow.app.tar.gz"
echo "    - Taskflow.app.tar.gz.sig"
if [[ "$LINUX_BUILD_SUCCESS" == "true" ]]; then
  echo "  Linux:"
  echo "    - taskflow_${VERSION}_amd64.AppImage.tar.gz"
  echo "    - taskflow_${VERSION}_amd64.AppImage.tar.gz.sig"
  echo "    - taskflow_${VERSION}_amd64.deb"
else
  echo "  Linux: NOT built (Docker not available or build failed)"
fi
echo "  Updater manifest:"
echo "    - latest.json"
echo ""
echo "Platforms not built in this release:"
if [[ "$LINUX_BUILD_SUCCESS" == "false" ]]; then
  echo "  - Linux (requires Docker)"
fi
echo "  - Windows (cross-compilation from macOS not supported)"
