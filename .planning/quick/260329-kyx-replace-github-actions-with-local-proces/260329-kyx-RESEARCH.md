# Quick Task 260329-kyx: Replace GitHub Actions with Local Processes - Research

**Researched:** 2026-03-29
**Domain:** Git hooks, Tauri cross-compilation, GitHub Releases API
**Confidence:** HIGH (hooks, API) / LOW (cross-compilation)

## Summary

Husky git hooks and GitHub Releases API via curl are straightforward and well-documented. The macOS local build is already proven (quick task 260327-edt). However, **cross-compiling Tauri for Windows and Linux from macOS is not production-viable** -- this is the critical finding that reshapes the plan.

**Primary recommendation:** Implement husky hooks + extend release.sh for macOS-only local builds with GitHub API upload. Defer Windows/Linux builds to a future solution (cheap CI, VM, or contributor machine).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Replace ci.yml with local git hooks (husky) for pre-commit/pre-push
- Run lint, typecheck, and tests locally before code reaches GitHub
- Remove ci.yml entirely
- Build all three platforms locally (macOS native, Windows/Linux via Docker)
- Remove release.yml entirely
- Extend release.sh with curl + GitHub REST API (not gh CLI) to Mimo01/taskflow-releases
- Token stored in environment variable (not hardcoded)

### Claude's Discretion
- Husky hook configuration details (which hooks run which checks)
- Docker image selection for cross-compilation
- Error handling and retry logic in upload script

### Deferred Ideas
None listed.
</user_constraints>

## Critical Finding: Tauri Cross-Compilation Is Not Viable

**Confidence: HIGH** -- verified via official Tauri docs and multiple community sources.

### Windows cross-compile from macOS

| Aspect | Status | Detail |
|--------|--------|--------|
| Rust cross-compile | Experimental | Requires `cargo-xwin`, downloads Windows SDKs (~1.5GB) |
| NSIS installer | Experimental | "should only be used as a last resort" per official docs |
| MSI installer | Impossible | WiX can only run on Windows |
| WebView2 | N/A for build | WebView2 is runtime-only; installer bundles bootstrapper |
| Code signing | Unsupported | "signing cross-platform builds is currently unsupported" |
| TAURI_SIGNING_PRIVATE_KEY | Works | Updater signing (Ed25519) is platform-independent |

**Verdict:** Experimental, unsupported signing, MSI impossible. Not production-ready.

### Linux cross-compile from macOS

| Aspect | Status | Detail |
|--------|--------|--------|
| WebKit2GTK | Blocker | Linux Tauri requires `libwebkit2gtk-4.1-dev` -- a Linux-only system library |
| Docker approach | Theoretically possible | Would need a full Ubuntu container with GTK dev libs, Rust, Node |
| AppImage/deb/rpm | Requires Linux | Bundling tools are Linux-native |

**Verdict:** Requires Docker with a heavy Ubuntu image. Docker is not currently installed on this machine.

### Environment Check

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Windows/Linux builds | NOT INSTALLED | -- | Cannot cross-compile |
| Rust (macOS targets) | macOS build | Available | aarch64 + x86_64 | -- |
| cargo-xwin | Windows cross-compile | NOT INSTALLED | -- | N/A (experimental anyway) |
| Node.js | Frontend build | Available | -- | -- |
| npm | Dependencies | Available | -- | -- |

**Missing dependencies with no fallback:**
- Docker -- blocks all cross-compilation plans
- Even with Docker, Windows cross-compile is experimental and signing is unsupported

### Recommendation

The user's decision to "build all three platforms locally" via Docker cross-compilation hits a hard wall. Options:

1. **macOS-only releases for now** -- ship what works, defer Windows/Linux
2. **Install Docker + attempt Linux builds** -- feasible but heavy setup, untested
3. **Keep minimal GitHub Actions for Windows/Linux** -- cheapest CI (only runs on tag push, ~10 min)
4. **Use a Windows VM/machine for Windows builds** -- manual but reliable

The planner should surface this blocker to the user with option 1 as the default.

## Husky Setup

**Confidence: HIGH**

### Installation
```bash
cd taskflow
npm install --save-dev husky
npx husky init
```

This creates `.husky/` directory and adds `"prepare": "husky"` to package.json scripts.

### Recommended Hook Configuration

**Pre-commit** (fast, < 5s):
```bash
# .husky/pre-commit
cd taskflow
npm run lint
npm run format:check
```

**Pre-push** (heavier, < 60s):
```bash
# .husky/pre-push
cd taskflow
npm run check    # biome check + tsc --noEmit
npx vitest run
```

Rationale: lint on every commit catches formatting issues early. Full typecheck + tests on push avoids slowing down frequent commits but catches errors before they reach remote.

### Monorepo Path Consideration

Husky hooks run from the repo root (`/Users/mimo/Desktop/Tasker/`), but the npm project is in `taskflow/`. The hooks must `cd taskflow` before running commands. Alternatively, use husky's directory config:

```json
// package.json (root level) -- NOT needed if hooks cd manually
```

Since there is no root-level package.json, husky must be installed in `taskflow/` and configured to set Git's `core.hooksPath`:

```bash
cd taskflow
npx husky init
# This creates taskflow/.husky/ and sets core.hooksPath = taskflow/.husky
```

**Gotcha:** Husky v9+ uses `core.hooksPath`. Since the git repo root is the parent of `taskflow/`, the `prepare` script needs to handle this:

```json
"prepare": "cd .. && husky taskflow/.husky"
```

This tells Git to look for hooks in `taskflow/.husky/` relative to repo root.

### lint-staged (Optional)

For pre-commit, `lint-staged` runs linters only on staged files (faster). Version 16.4.0 is current.

```bash
npm install --save-dev lint-staged
```

```json
// package.json
"lint-staged": {
  "src/**/*.{ts,tsx}": ["biome check --no-errors-on-unmatched"]
}
```

Pre-commit hook would then be:
```bash
cd taskflow && npx lint-staged
```

## GitHub Releases API (curl)

**Confidence: HIGH** -- already proven in quick task 260327-edt.

### Authentication
```bash
# Environment variable
export RELEASES_REPO_TOKEN="ghp_..."
AUTH_HEADER="Authorization: token $RELEASES_REPO_TOKEN"
```

Token needs `repo` scope (or `public_repo` if taskflow-releases is public).

### Create Release
```bash
RELEASE_RESPONSE=$(curl -s -X POST \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  https://api.github.com/repos/Mimo01/taskflow-releases/releases \
  -d "{
    \"tag_name\": \"v$VERSION\",
    \"target_commitish\": \"main\",
    \"name\": \"Taskflow v$VERSION\",
    \"body\": \"$TAG_BODY\",
    \"draft\": false,
    \"prerelease\": false
  }")

RELEASE_ID=$(echo "$RELEASE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
```

### Upload Asset
```bash
UPLOAD_URL="https://uploads.github.com/repos/Mimo01/taskflow-releases/releases/$RELEASE_ID/assets"

curl -s -X POST \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/octet-stream" \
  "$UPLOAD_URL?name=$(basename $FILE)" \
  --data-binary @"$FILE"
```

### Upload latest.json (Tauri Updater Manifest)

The updater checks `https://github.com/Mimo01/taskflow-releases/releases/latest/download/latest.json`. This file must be a release asset with platform-keyed download URLs and Ed25519 signatures.

```json
{
  "version": "1.6.1",
  "notes": "Release notes here",
  "pub_date": "2026-03-29T00:00:00Z",
  "platforms": {
    "darwin-universal": {
      "signature": "<contents of .sig file>",
      "url": "https://github.com/Mimo01/taskflow-releases/releases/download/v1.6.1/Taskflow.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "<contents of .sig file>",
      "url": "https://github.com/Mimo01/taskflow-releases/releases/download/v1.6.1/Taskflow.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "<contents of .sig file>",
      "url": "https://github.com/Mimo01/taskflow-releases/releases/download/v1.6.1/Taskflow.app.tar.gz"
    }
  }
}
```

### Update README in Releases Repo

The current release.yml clones the releases repo and overwrites README.md. The same can be done via the GitHub Contents API:

```bash
# Get current README SHA
SHA=$(curl -s -H "$AUTH_HEADER" \
  https://api.github.com/repos/Mimo01/taskflow-releases/contents/README.md \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('sha',''))")

# Update README
curl -s -X PUT \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  https://api.github.com/repos/Mimo01/taskflow-releases/contents/README.md \
  -d "{
    \"message\": \"docs: update download links to v$VERSION\",
    \"content\": \"$(echo "$README_CONTENT" | base64)\",
    \"sha\": \"$SHA\"
  }"
```

## TAURI_SIGNING_PRIVATE_KEY for Local Builds

**Confidence: HIGH**

Must be set as an actual environment variable (`.env` files do NOT work):

```bash
export TAURI_SIGNING_PRIVATE_KEY="<key content or path to key file>"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<password if set>"
```

The key is the Ed25519 private key generated during Phase 38. It signs the updater artifacts (.tar.gz.sig). This is separate from macOS code signing (Apple Developer ID) or Windows code signing (Authenticode).

For the release script, the user should either:
- Export these in their shell profile (~/.zshrc)
- Or the script should check and prompt if missing

## Common Pitfalls

### Pitfall 1: Husky hooks path in monorepo
**What goes wrong:** Husky installs hooks relative to package.json, but Git looks for hooks relative to .git
**Why:** Git repo root is `/Tasker/`, npm project is `/Tasker/taskflow/`
**How to avoid:** Use `"prepare": "cd .. && husky taskflow/.husky"` in taskflow/package.json

### Pitfall 2: GitHub upload URL uses different host
**What goes wrong:** Using `api.github.com` for uploads fails
**Why:** Asset uploads go to `uploads.github.com`, not `api.github.com`
**How to avoid:** Always use `https://uploads.github.com/repos/...` for `--data-binary` uploads

### Pitfall 3: Duplicate asset names
**What goes wrong:** Re-uploading an asset with the same name fails with 422
**Why:** GitHub requires unique asset names per release
**How to avoid:** Delete existing asset first, or delete and recreate the release

### Pitfall 4: TAURI_SIGNING_PRIVATE_KEY in .env
**What goes wrong:** Build fails saying key is not set
**Why:** Tauri does not read from .env files for signing keys
**How to avoid:** Always use `export` in the shell session

### Pitfall 5: Version files modified by build
**What goes wrong:** inject-version.cjs modifies package.json, tauri.conf.json, Cargo.toml
**Why:** Build-time version injection writes to source files
**How to avoid:** Run `git checkout -- src-tauri/tauri.conf.json package.json src-tauri/Cargo.toml` after build

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git hooks | Manual .git/hooks scripts | husky v9 | Team-shared, auto-install via prepare script |
| Staged file linting | Custom git diff parsing | lint-staged | Handles partial staging, binary files, edge cases |
| Release creation | Raw curl orchestration | Existing proven pattern from 260327-edt | Already tested with this repo |

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Windows Installer docs](https://v2.tauri.app/distribute/windows-installer/) -- cross-compile limitations
- [Tauri v2 GitHub Pipelines](https://v2.tauri.app/distribute/pipelines/github/) -- CI approach
- [Tauri v1 Cross-Platform Compilation](https://v1.tauri.app/v1/guides/building/cross-platform/) -- still relevant for v2
- [Tauri Environment Variables](https://v2.tauri.app/reference/environment-variables/) -- TAURI_SIGNING_PRIVATE_KEY
- [GitHub REST API - Releases](https://docs.github.com/en/rest/releases/releases) -- API reference
- [GitHub REST API - Release Assets](https://docs.github.com/en/rest/releases/assets) -- upload API
- [Husky docs](https://typicode.github.io/husky/) -- setup guide
- Quick task 260327-edt PLAN.md -- proven local build + API upload pattern

### Secondary (MEDIUM confidence)
- [stefanbuck/upload-github-release-asset gist](https://gist.github.com/stefanbuck/ce788fee19ab6eb0b4447a85fc99f447)
- [Husky + lint-staged guide](https://dev.to/_d7eb1c1703182e3ce1782/git-hooks-with-husky-and-lint-staged-the-complete-setup-guide-for-2025-53ji)
