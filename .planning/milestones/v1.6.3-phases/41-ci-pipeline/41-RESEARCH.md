# Phase 41: CI Pipeline - Research

**Researched:** 2026-03-25
**Domain:** GitHub Actions, Tauri v2 cross-platform build, cross-repo release publishing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** CI on private repo (`Mimo01/taskflow`) builds artifacts and publishes a GitHub Release to public repo (`Mimo01/taskflow-releases`) using a deploy key or PAT.
- **D-02:** Updater endpoint: `https://github.com/Mimo01/taskflow-releases/releases/latest/download/latest.json`
- **D-03:** Version policy URL: `https://raw.githubusercontent.com/Mimo01/taskflow-releases/main/version-policy.json`
- **D-04:** GitHub Releases API for version history: `https://api.github.com/repos/Mimo01/taskflow-releases/releases`
- **D-05:** Skip code signing for both macOS and Windows in this phase. Ship unsigned binaries. macOS users bypass Gatekeeper via right-click > Open; Windows users dismiss SmartScreen warning. Signing deferred to a future phase.
- **D-06:** Release notes authored manually in git tag annotations (`git tag -a v1.6.0 -m "release notes here"`). CI extracts tag message body and uses it as GitHub Release body + changelog for the update dialog.
- **D-07:** Workflow triggers on push of tags matching `v[0-9]*`.
- **D-08:** Fully automatic pipeline — tag push triggers build + publish with no manual approval gate.
- **D-09:** macOS: universal binary (single fat binary for aarch64 + x86_64). One build, one download for all Macs.
- **D-10:** Windows: x86_64 only.
- **D-11:** Linux: x86_64 only.
- **D-12:** Minimal artifact set per platform — updater artifact (.tar.gz/.zip) + one installer (.dmg for macOS, .msi for Windows, .AppImage for Linux). No duplicate installer formats.

### Claude's Discretion

- GitHub Actions runner versions (ubuntu-latest, macos-latest, windows-latest vs pinned)
- Cross-repo publish mechanism (deploy key vs PAT — both work)
- How to extract tag annotation for release notes (git command in CI)
- Tauri CLI build flags for universal binary
- Artifact naming convention
- Whether to run tests in CI before building (recommended but implementation detail)

### Deferred Ideas (OUT OF SCOPE)

- macOS code signing + notarization (Apple Developer ID $99/yr) — future phase when user base grows
- Windows code signing (Azure Trusted Signing or OV/EV cert) — future phase
- Multiple update channels (stable/beta/nightly) — explicitly out of scope per REQUIREMENTS.md
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CI-01 | CI builds cross-platform artifacts (macOS aarch64+x86_64, Windows x86_64, Linux x86_64) on git tag push | GitHub Actions matrix with tauri-action@v0; universal-apple-darwin target for macOS; separate matrix entries for Windows and Linux |
| CI-02 | CI publishes release artifacts to a separate public GitHub repo with GitHub Release notes | tauri-action `owner`/`repo` inputs + fine-grained PAT with contents:write on `taskflow-releases` repo |
</phase_requirements>

---

## Summary

Phase 41 wires up the complete distribution pipeline: a git tag push on `Mimo01/taskflow` (private) triggers a GitHub Actions workflow that builds cross-platform Tauri v2 artifacts and publishes them as a GitHub Release on `Mimo01/taskflow-releases` (public). Three platforms are required: macOS universal binary (aarch64 + x86_64 fat binary), Windows x86_64, and Linux x86_64. No code signing in this phase.

The official `tauri-apps/tauri-action@v0` action handles build, artifact collection, and GitHub Release creation. Cross-repo publishing is achieved by setting the action's `owner` and `repo` inputs to the public repo and supplying a PAT (stored as a repository secret) that has `contents: write` on `taskflow-releases`. The `GITHUB_TOKEN` default is scoped to the current repo only and cannot write to a different repo.

The most significant implementation challenge is injecting version-related environment variables (`APP_VERSION`, `APP_COMMIT_SHA`, `APP_BUILD_DATE`) into the build in a way that works on Windows, macOS, and Linux runners. The existing `tauri:build` npm script uses `eval $(node scripts/inject-version.cjs)` which is bash-only. In CI, the correct approach is a dedicated step that runs `inject-version.cjs` and writes each variable to `$GITHUB_ENV` (or the PowerShell equivalent), making them available to all subsequent steps including the tauri-action build.

**Primary recommendation:** Use `tauri-apps/tauri-action@v0` with a 3-job matrix (macOS universal, Windows, Linux), extract tag annotation with `git tag -l --format='%(contents:body)' $GITHUB_REF_NAME`, and publish to `taskflow-releases` via a fine-grained PAT stored as `RELEASES_REPO_TOKEN` secret. Also replace the two placeholder URLs in `tauri.conf.json` and `useVersionPolicyCheck.ts` as part of this phase.

---

## Standard Stack

### Core

| Library/Tool | Version | Purpose | Why Standard |
|--------------|---------|---------|--------------|
| tauri-apps/tauri-action | v0 (latest) | Build Tauri apps and publish GitHub Releases in CI | Official Tauri-maintained action; handles artifact discovery, updater JSON, cross-platform builds |
| actions/checkout | v4 | Checkout repo in CI | Current standard; v4 uses Node 20 |
| actions/setup-node | v4 | Install Node.js on runner | Current standard |
| dtolnay/rust-toolchain | stable | Install Rust with custom targets | Community standard for Rust CI; supports `targets` input |
| swatinem/rust-cache | v2 | Cache Rust compile artifacts | Prevents 10-20 min cold Rust builds on every run |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| ubuntu-22.04 runner | — | Linux build host | Required for libwebkit2gtk-4.1-dev compatibility; ubuntu-latest may be 24.04 which has different webkit package names |
| macos-latest runner | — | macOS build host | Arm-native runner (M1+); installs both rust targets for universal binary |
| windows-latest runner | — | Windows build host | x86_64 Windows; uses PowerShell by default |

### Fine-grained PAT requirements

A fine-grained Personal Access Token scoped to `Mimo01/taskflow-releases` with:
- **Repository permissions:** Contents = Read and write
- **No other permissions needed**

This token is stored as a secret named `RELEASES_REPO_TOKEN` in `Mimo01/taskflow` and passed as `GITHUB_TOKEN` env in the tauri-action step.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fine-grained PAT | Deploy key | Deploy keys can only push/pull code, not create releases via API |
| Fine-grained PAT | Classic PAT with repo scope | Classic PATs grant broad access; fine-grained PAT scoped to one repo is safer |
| ubuntu-22.04 | ubuntu-latest | ubuntu-latest may advance to 24.04; libwebkit2gtk-4.1-dev availability differs; pin to 22.04 for stability |

---

## Architecture Patterns

### Recommended Workflow Structure

```
.github/
└── workflows/
    └── release.yml       # single file, matrix across 3 platforms
```

The workflow file lives in `taskflow/.github/workflows/release.yml` (inside the Tauri app directory, since that is the git repo root for CI purposes; the private repo root is `/Users/mimo/Desktop/Tasker` but only `taskflow/` is the actual app — confirm git remote location).

**Note:** Since the project root `/Users/mimo/Desktop/Tasker` is the git repo (contains `.git/`), the workflow file goes at `/Users/mimo/Desktop/Tasker/.github/workflows/release.yml`.

### Pattern 1: Version Injection via GITHUB_ENV

The existing `tauri:build` script uses `eval $(node scripts/inject-version.cjs)` which works locally on macOS/Linux but breaks on Windows runners (PowerShell does not support `eval`).

The CI-safe approach splits this into a dedicated step:

```yaml
# Step: Inject version into tauri.conf.json and set env vars
- name: Inject version
  shell: bash
  working-directory: taskflow
  run: |
    node scripts/inject-version.cjs >> $GITHUB_ENV

- name: Build and release
  uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.RELEASES_REPO_TOKEN }}
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
    APP_VERSION: ${{ env.APP_VERSION }}
    APP_COMMIT_SHA: ${{ env.APP_COMMIT_SHA }}
    APP_BUILD_DATE: ${{ env.APP_BUILD_DATE }}
  with:
    projectPath: taskflow
    tagName: v__VERSION__
    releaseName: Taskflow v__VERSION__
    releaseBody: ${{ steps.tag_body.outputs.body }}
    releaseDraft: false
    prerelease: false
    owner: Mimo01
    repo: taskflow-releases
    args: ${{ matrix.args }}
```

**Key insight:** `inject-version.cjs` already outputs `APP_VERSION=...\nAPP_COMMIT_SHA=...\nAPP_BUILD_DATE=...` to stdout (line 28 of the script). By redirecting that output to `$GITHUB_ENV`, those variables become available in all subsequent steps. The `tauri-action` then receives them as env vars, which Vite's define block reads via `process.env.*`.

Using `shell: bash` explicitly on the inject-version step makes this work cross-platform on GitHub Actions runners (all runners support bash even on Windows via Git Bash).

### Pattern 2: Tag Annotation Extraction

```yaml
# Step: Extract git tag annotation body for release notes
- name: Extract tag body
  id: tag_body
  shell: bash
  run: |
    BODY=$(git tag -l --format='%(contents:body)' $GITHUB_REF_NAME)
    # Escape for GitHub Actions multiline output
    echo "body<<EOF" >> $GITHUB_OUTPUT
    echo "$BODY" >> $GITHUB_OUTPUT
    echo "EOF" >> $GITHUB_OUTPUT
```

This uses the Git format spec `%(contents:body)` which returns everything after the first blank line in the tag annotation message (D-06 pattern: `git tag -a v1.6.0 -m "Subject\n\nBody here"`). The body is used as the GitHub Release description and is what `tauri-action` uploads as `latest.json`'s `notes` field.

### Pattern 3: Matrix for 3 Platforms (D-09 universal macOS)

```yaml
strategy:
  fail-fast: false
  matrix:
    include:
      - platform: macos-latest
        args: --target universal-apple-darwin
        rust_targets: aarch64-apple-darwin,x86_64-apple-darwin
      - platform: windows-latest
        args: --target x86_64-pc-windows-msvc
        rust_targets: x86_64-pc-windows-msvc
      - platform: ubuntu-22.04
        args: ''
        rust_targets: ''
```

For the universal binary, both Rust targets must be installed on the macOS runner before building:

```yaml
- name: Install Rust stable
  uses: dtolnay/rust-toolchain@stable
  with:
    targets: ${{ matrix.rust_targets }}
```

Then `tauri build --target universal-apple-darwin` lipo-combines both slices into a single `.app.tar.gz` + `.dmg`.

### Pattern 4: Cross-Repo Publish

`tauri-action` accepts `owner` and `repo` inputs to publish to a different repository. The `GITHUB_TOKEN` env var must be a PAT with write access to the target repo (the default `secrets.GITHUB_TOKEN` is scoped to the current repo only).

```yaml
- uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.RELEASES_REPO_TOKEN }}  # PAT with contents:write on taskflow-releases
  with:
    owner: Mimo01
    repo: taskflow-releases
    tagName: v__VERSION__
```

The `__VERSION__` placeholder is replaced by tauri-action from `tauri.conf.json`'s `version` field — which has been written by `inject-version.cjs` in the previous step.

### Pattern 5: Placeholder URL Replacement

Two files contain placeholder URLs that must be replaced as part of this phase before any release is possible:

| File | Placeholder | Replace With |
|------|-------------|--------------|
| `taskflow/src-tauri/tauri.conf.json` | `https://github.com/OWNER/RELEASES_REPO/releases/latest/download/latest.json` | `https://github.com/Mimo01/taskflow-releases/releases/latest/download/latest.json` (D-02) |
| `taskflow/src/hooks/useVersionPolicyCheck.ts` | `https://raw.githubusercontent.com/OWNER/RELEASES_REPO/main/version-policy.json` | `https://raw.githubusercontent.com/Mimo01/taskflow-releases/main/version-policy.json` (D-03) |

Additionally, Phase 40 left a placeholder in the version history API URL — verify:
- `taskflow/src` for `PLACEHOLDER/PLACEHOLDER` in GitHub Releases API calls

### Pattern 6: Ed25519 Updater Signing (required for tauri-plugin-updater)

`tauri-plugin-updater` verifies downloaded artifacts using an Ed25519 public key configured in `tauri.conf.json`. The private key must be set as env vars in CI for signing:

```
TAURI_SIGNING_PRIVATE_KEY  — base64 content or path to .key file
TAURI_SIGNING_PRIVATE_KEY_PASSWORD  — password (can be empty string)
```

The public key is embedded in the app at build time via `tauri.conf.json`:
```json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6..."
    }
  }
}
```

**Key generation (one-time, before first CI run):**
```bash
cd taskflow
npm run tauri -- signer generate -w ~/.tauri/taskflow.key
```

Outputs: private key file + public key string. The public key goes in `tauri.conf.json`. The private key content is stored as `TAURI_SIGNING_PRIVATE_KEY` GitHub secret.

### Pattern 7: Linux Dependencies

Ubuntu 22.04 runners need WebKit and system dependencies before the Rust build:

```yaml
- name: Install Linux dependencies
  if: matrix.platform == 'ubuntu-22.04'
  run: |
    sudo apt-get update
    sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

`libappindicator3-dev` is needed for tray icon support. `patchelf` is needed for AppImage bundling. `librsvg2-dev` for icon rendering.

### Recommended Project Structure

```
.github/
└── workflows/
    └── release.yml           # tag-triggered cross-platform build + release workflow
taskflow/
├── src-tauri/
│   └── tauri.conf.json       # updater.pubkey (add), endpoints (replace PLACEHOLDER)
├── src/
│   └── hooks/
│       └── useVersionPolicyCheck.ts  # replace PLACEHOLDER URL
└── scripts/
    └── inject-version.cjs    # existing — no changes needed
```

### Anti-Patterns to Avoid

- **Using `eval` for env var injection in CI:** `eval $(node scripts/inject-version.cjs)` works locally but fails on Windows PowerShell runners. Use `>> $GITHUB_ENV` with `shell: bash` instead.
- **Using default `GITHUB_TOKEN` for cross-repo publish:** The automatic `secrets.GITHUB_TOKEN` is scoped to the current repository only. A PAT with `contents: write` on the releases repo is required.
- **Pinning tauri-action to a SHA instead of v0:** v0 is the semver-floating tag maintained by the Tauri team; it receives bug fixes. Pinning to a specific commit prevents receiving fixes while still exposing to supply-chain risk.
- **Using ubuntu-latest for Linux builds:** ubuntu-latest may advance to 24.04 where `libwebkit2gtk-4.1-dev` availability differs. Pin to `ubuntu-22.04` for stable builds.
- **Building macOS with two separate matrix entries (aarch64 + x86_64) instead of universal:** Decision D-09 specifies one universal binary. Using separate entries creates two separate `.dmg` files with different names, which is harder for users and wastes CI minutes.
- **Omitting `fail-fast: false`:** Without this, a Windows build failure cancels the macOS and Linux jobs, preventing any artifacts from being uploaded to the release.
- **Not setting `releaseDraft: false`:** If left as draft, users cannot download and the updater endpoint returns nothing. Since D-08 requires fully automatic publish, use `releaseDraft: false`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collect build artifacts from multiple runners | Custom artifact upload/download steps | `tauri-apps/tauri-action@v0` | Action handles artifact path detection across target directories (including universal-apple-darwin), assembles latest.json, creates release |
| latest.json generation | Manual JSON construction | `tauri-apps/tauri-action@v0` with `uploadUpdaterJson: true` (default) | Correct platform keys (darwin-universal, windows-x86_64, linux-x86_64), signature embedding, timing with release creation |
| Rust dependency caching | Custom cache logic | `swatinem/rust-cache@v2` | Handles cache key based on Cargo.lock, restores target/ directory, dramatically speeds up builds |
| Cross-platform env var setting | OS-specific scripts | `$GITHUB_ENV` with `shell: bash` | Works on all three runners; GitHub Actions guarantees bash is available |

**Key insight:** The `tauri-action` does the heavy lifting of: running `npm install` (or detecting package manager), running `tauri build` with the right args, finding all bundle artifacts regardless of target subdirectory, generating and uploading `latest.json`, and creating the GitHub Release with all assets attached in a single atomic operation.

---

## Common Pitfalls

### Pitfall 1: Ed25519 Key Not Set — Silent Build Success, Runtime Updater Failure

**What goes wrong:** `tauri build` succeeds even if `TAURI_SIGNING_PRIVATE_KEY` is not set, but the generated `latest.json` will have empty `signature` fields. The updater plugin will then reject every update as "invalid signature" at runtime.
**Why it happens:** Signing is not enforced at build time; the bundler generates unsigned artifacts without error.
**How to avoid:** Generate the Ed25519 key pair before writing the workflow. Add `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as repository secrets. Add an explicit check step in the workflow that fails if the secret is empty.
**Warning signs:** `latest.json` has `"signature": ""` or `"signature": null` in the published release assets.

### Pitfall 2: `tauri.conf.json` version remains `0.0.0-dev` because inject-version step ran after tauri-action

**What goes wrong:** The release is tagged `v0.0.0-dev` or the `__VERSION__` placeholder is not substituted.
**Why it happens:** `inject-version.cjs` writes the version directly to `tauri.conf.json`. If the inject step runs after tauri-action starts, or if the GITHUB_ENV variables aren't forwarded to the tauri-action env block, the version stays as the placeholder.
**How to avoid:** Ensure the inject-version step runs as a distinct step before the tauri-action step. Explicitly forward `APP_VERSION`, `APP_COMMIT_SHA`, `APP_BUILD_DATE` in the tauri-action `env:` block.

### Pitfall 3: Cross-Repo Release Tag Already Exists

**What goes wrong:** If the same semver tag (e.g. `v1.6.0`) was pushed twice or a previous run partially completed, tauri-action may fail with "tag already exists" or "release already exists" errors.
**Why it happens:** GitHub Releases are idempotent within a repo — you cannot create two releases for the same tag. tauri-action does not automatically delete and recreate.
**How to avoid:** Only push a given semver tag once. If a re-run is needed, delete the release and tag from `taskflow-releases` manually before re-running.
**Warning signs:** Workflow job fails with HTTP 422 "Unprocessable Entity" from GitHub API.

### Pitfall 4: macOS Universal Build Fails — Missing Rust Target

**What goes wrong:** `tauri build --target universal-apple-darwin` fails with "error: toolchain 'stable-aarch64-apple-darwin' does not contain component 'rust-std' for target 'x86_64-apple-darwin'".
**Why it happens:** `universal-apple-darwin` requires both `aarch64-apple-darwin` AND `x86_64-apple-darwin` Rust targets to be installed on the runner. Installing only one fails.
**How to avoid:** In the `dtolnay/rust-toolchain` step for the macOS matrix entry, set `targets: aarch64-apple-darwin,x86_64-apple-darwin` (comma-separated, both required).

### Pitfall 5: Windows PowerShell eval Failure

**What goes wrong:** If the inject-version step uses `eval $(node scripts/inject-version.cjs)` on Windows, the step fails: `eval: command not found` or `The term 'eval' is not recognized`.
**Why it happens:** PowerShell is the default shell on `windows-latest` runners. `eval` is a bash built-in.
**How to avoid:** Explicitly set `shell: bash` on the inject-version step. All GitHub Actions runners include Git Bash (bash) even on Windows.

### Pitfall 6: tauri-action Uploads to Wrong Repo (Default GITHUB_TOKEN)

**What goes wrong:** The release is created on `Mimo01/taskflow` (private) instead of `Mimo01/taskflow-releases` (public).
**Why it happens:** The `env.GITHUB_TOKEN` defaults to `secrets.GITHUB_TOKEN` which is scoped to the current repository. Even with `owner: Mimo01` and `repo: taskflow-releases` set, the default token does not have access to the releases repo.
**How to avoid:** Create a fine-grained PAT with `contents: write` on `taskflow-releases`. Store it as `RELEASES_REPO_TOKEN`. Use `GITHUB_TOKEN: ${{ secrets.RELEASES_REPO_TOKEN }}` in the tauri-action env block.

### Pitfall 7: version-policy.json Not Present on First Release

**What goes wrong:** The updater's version policy check (`useVersionPolicyCheck.ts`) fetches from `raw.githubusercontent.com/Mimo01/taskflow-releases/main/version-policy.json`. If this file does not exist in the `taskflow-releases` repo, the fetch fails. However, the code is correctly designed to fail-open (returns `null` policy), so this is a degraded experience rather than a crash.
**Why it happens:** `version-policy.json` is a static file that must be committed to the `taskflow-releases` repo root before any app versions are distributed.
**How to avoid:** Create `taskflow-releases` repo with `version-policy.json` at root before running any release CI. Initial content: `{"softMinimum": "0.0.0", "hardMinimum": "0.0.0"}` (no enforcement until intentionally bumped).

### Pitfall 8: Rust Compilation Cache Miss on First Run

**What goes wrong:** First CI run takes 30-45 minutes because all Rust dependencies compile from scratch. Teams conclude "CI is broken" and abandon it.
**Why it happens:** `swatinem/rust-cache@v2` requires a successful run to populate the cache. The first run always starts cold.
**How to avoid:** This is expected behavior. Document it. The cache key is based on `Cargo.lock`, so subsequent runs with the same dependencies hit the cache and complete in ~5-10 minutes.

---

## Code Examples

### Complete Workflow Skeleton

```yaml
# Source: tauri-apps/tauri-action README + v2.tauri.app/distribute/pipelines/github/
name: Release

on:
  push:
    tags:
      - 'v[0-9]*'

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: true

jobs:
  release:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: --target universal-apple-darwin
            rust_targets: aarch64-apple-darwin,x86_64-apple-darwin
          - platform: windows-latest
            args: --target x86_64-pc-windows-msvc
            rust_targets: x86_64-pc-windows-msvc
          - platform: ubuntu-22.04
            args: ''
            rust_targets: ''

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: npm
          cache-dependency-path: taskflow/package-lock.json

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.rust_targets }}

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: taskflow/src-tauri -> target

      - name: Install frontend dependencies
        working-directory: taskflow
        run: npm ci

      - name: Extract tag annotation body
        id: tag_body
        shell: bash
        run: |
          BODY=$(git tag -l --format='%(contents:body)' "$GITHUB_REF_NAME")
          echo "body<<EOF" >> $GITHUB_OUTPUT
          echo "$BODY" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Inject version
        shell: bash
        working-directory: taskflow
        run: node scripts/inject-version.cjs >> $GITHUB_ENV

      - name: Build and release
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.RELEASES_REPO_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          APP_VERSION: ${{ env.APP_VERSION }}
          APP_COMMIT_SHA: ${{ env.APP_COMMIT_SHA }}
          APP_BUILD_DATE: ${{ env.APP_BUILD_DATE }}
        with:
          projectPath: taskflow
          tagName: v__VERSION__
          releaseName: Taskflow v__VERSION__
          releaseBody: ${{ steps.tag_body.outputs.body }}
          releaseDraft: false
          prerelease: false
          owner: Mimo01
          repo: taskflow-releases
          args: ${{ matrix.args }}
```

### Key Generation (One-Time Setup)

```bash
# Run locally before CI setup
cd taskflow
npm run tauri -- signer generate -w ~/.tauri/taskflow.key
# Outputs:
#   Public key: <base64 string>  → goes in tauri.conf.json plugins.updater.pubkey
#   Private key: saved at ~/.tauri/taskflow.key  → content goes in TAURI_SIGNING_PRIVATE_KEY secret
```

### tauri.conf.json updater section (after URL replacement + pubkey addition)

```json
{
  "plugins": {
    "updater": {
      "pubkey": "<base64 public key from signer generate>",
      "endpoints": [
        "https://github.com/Mimo01/taskflow-releases/releases/latest/download/latest.json"
      ]
    }
  }
}
```

### latest.json structure (generated by tauri-action)

```json
{
  "version": "1.6.0",
  "notes": "Release notes from tag annotation body",
  "pub_date": "2026-03-25T00:00:00Z",
  "platforms": {
    "darwin-universal": {
      "signature": "<ed25519 sig>",
      "url": "https://github.com/Mimo01/taskflow-releases/releases/download/v1.6.0/Taskflow_1.6.0_universal.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "<ed25519 sig>",
      "url": "https://github.com/Mimo01/taskflow-releases/releases/download/v1.6.0/Taskflow_1.6.0_x64_en-US.msi.zip"
    },
    "linux-x86_64": {
      "signature": "<ed25519 sig>",
      "url": "https://github.com/Mimo01/taskflow-releases/releases/download/v1.6.0/taskflow_1.6.0_amd64.AppImage.tar.gz"
    }
  }
}
```

### Finding Additional GitHub Releases API Placeholder

Phase 40 used `PLACEHOLDER/PLACEHOLDER` for version history. Locate and replace:

```bash
# From repo root
grep -r "PLACEHOLDER" taskflow/src --include="*.ts" --include="*.tsx"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tauri-action@v0 uploading to same repo | tauri-action@v0 with `owner`/`repo` cross-repo | Always supported | PAT required instead of GITHUB_TOKEN |
| Separate aarch64 + x86_64 macOS matrix entries | Single `universal-apple-darwin` entry | Tauri v1.x+ | One .dmg for all Macs; cleaner updater (one darwin platform key) |
| Classic PAT (full repo scope) | Fine-grained PAT (single repo, contents only) | GitHub 2022 | Reduced blast radius if secret leaks |
| ubuntu-latest for Linux builds | ubuntu-22.04 pinned | Late 2024 | libwebkit2gtk-4.1 availability varies on newer Ubuntu |

**Deprecated/outdated:**
- `dtolnay/rust-toolchain@1.x` — use `@stable` (floating) for latest stable Rust
- `actions/cache` for Rust — superseded by `swatinem/rust-cache@v2` which handles workspace layout

---

## Open Questions

1. **Does `taskflow-releases` public repo already exist?**
   - What we know: D-01 specifies it as `Mimo01/taskflow-releases`
   - What's unclear: Whether the repo has been created yet, whether it has `version-policy.json` in root
   - Recommendation: Wave 0 task — verify repo exists and create with initial `version-policy.json` if not; this blocks the entire pipeline

2. **Has the Ed25519 signing key been generated from Phase 38?**
   - What we know: Phase 38 SUMMARY notes "Ed25519 signing key generation is irreversible — must be backed up in two locations during Phase 38" — but Phase 38's actual SUMMARY only completed the version injection; there is no mention of key generation in the Phase 38 SUMMARY.md tasks
   - What's unclear: Whether the key pair exists and `tauri.conf.json` has a `pubkey` field, or whether key generation is still pending
   - Recommendation: Check `tauri.conf.json` for `pubkey` field presence. If absent, key generation is a Wave 0 prerequisite. The private key must be stored as `TAURI_SIGNING_PRIVATE_KEY` GitHub secret before any build can produce valid signed artifacts.

3. **Does the inject-version step need `working-directory: taskflow`?**
   - What we know: `inject-version.cjs` uses `path.join(__dirname, '../src-tauri/tauri.conf.json')` so the script writes to the correct location regardless of cwd
   - What's unclear: Whether `npm ci` in the workflow step and `tauri-action`'s `projectPath: taskflow` are sufficient for the action to find `package.json`
   - Recommendation: Set `working-directory: taskflow` on the inject-version step to be explicit; use `projectPath: taskflow` in tauri-action

4. **Does tauri-action handle the `projectPath` correctly with a nested app directory?**
   - What we know: The git repo root is `/Users/mimo/Desktop/Tasker` but the Tauri app is in `taskflow/`. The workflow file will be at `.github/workflows/release.yml` in the repo root.
   - What's unclear: Whether `projectPath: taskflow` is sufficient for tauri-action to find `tauri.conf.json` and run `npm run tauri build` from the correct directory.
   - Recommendation: Use `projectPath: taskflow` in the tauri-action `with:` block. This is the documented parameter for monorepos or non-root Tauri apps.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| GitHub Actions runners (CI) | All build jobs | ✓ | ubuntu-22.04, macos-latest, windows-latest available | — |
| `Mimo01/taskflow-releases` repo | Cross-repo publishing | Unknown | — | Must be created before CI runs |
| Ed25519 signing key pair | Updater artifact signing | Unknown | — | Must be generated before CI runs |
| Fine-grained PAT for releases repo | Cross-repo publish auth | Unknown | — | Must be created and stored as secret |
| `TAURI_SIGNING_PRIVATE_KEY` secret | Updater signature in artifacts | Unknown | — | Must be set; no fallback (unsigned artifacts fail at runtime) |

**Missing dependencies with no fallback:**
- `Mimo01/taskflow-releases` GitHub repo must exist before the first CI run
- `TAURI_SIGNING_PRIVATE_KEY` GitHub secret must be set; artifacts signed with empty key fail runtime update verification
- `RELEASES_REPO_TOKEN` fine-grained PAT must exist with `contents: write` on `taskflow-releases`
- Ed25519 public key must be added to `tauri.conf.json` `plugins.updater.pubkey` before building

**Missing dependencies with fallback:**
- None; all blockers have no fallback

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm test` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CI-01 | Cross-platform artifacts built on tag push | manual-only | N/A — requires GitHub Actions runner environment | N/A |
| CI-02 | Release published to public repo with release notes | manual-only | N/A — requires GitHub API + actual release | N/A |

**CI-01 and CI-02 are integration behaviors that can only be verified by executing the GitHub Actions workflow against the actual GitHub environment.** Unit tests cannot simulate a tag push + multi-runner matrix build. Verification is:
1. Push a test tag to `Mimo01/taskflow`
2. Observe workflow run completes all 3 matrix jobs successfully
3. Verify `Mimo01/taskflow-releases` has a new release with expected artifacts
4. Verify `latest.json` is present with non-empty signatures
5. Verify an installed app detects and can download the update

### Sampling Rate

- **Per task commit:** `cd taskflow && npm test` (83 existing tests must remain green)
- **Per wave merge:** `cd taskflow && npm test`
- **Phase gate:** Manual end-to-end verification (tag push → release created → updater detects update) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No new test files needed — CI-01 and CI-02 are not unit-testable
- Existing 83 tests cover upstream behavior; they must stay green after URL placeholder replacement

*(Existing test infrastructure covers all unit-testable behavior. CI requirements are verified via live workflow execution.)*

---

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` file exists in the project root. No project-specific constraints to enforce beyond the CONTEXT.md decisions above.

---

## Sources

### Primary (HIGH confidence)

- [v2.tauri.app/distribute/pipelines/github/](https://v2.tauri.app/distribute/pipelines/github/) — Official Tauri v2 GitHub Actions workflow documentation; complete YAML example with matrix strategy
- [github.com/tauri-apps/tauri-action README](https://github.com/tauri-apps/tauri-action) — All action inputs including `owner`, `repo`, `tauriScript`, `uploadUpdaterJson`, `args`
- [v2.tauri.app/plugin/updater/](https://v2.tauri.app/plugin/updater/) — `TAURI_SIGNING_PRIVATE_KEY`/`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` env vars, `createUpdaterArtifacts` behavior, `latest.json` structure and platform key format
- [github.com/tauri-apps/tauri-action/issues/243](https://github.com/tauri-apps/tauri-action/issues/243) — Resolution confirming `universal-apple-darwin` target support in current tauri-action

### Secondary (MEDIUM confidence)

- [dev.to tauri v2 GitHub Actions guide](https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-github-actions-and-release-automation-part-22-2ef7) — Full workflow YAML with signing steps; verified against official docs
- [github.com/orgs/community/discussions/121022](https://github.com/orgs/community/discussions/121022) — GITHUB_TOKEN cross-repo permissions limitation confirmed
- WebSearch: `git tag -l --format='%(contents:body)'` for tag annotation extraction — consistent across multiple sources

### Tertiary (LOW confidence)

- None — all claims verified against official sources or official GitHub discussions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tauri-action@v0 is the official action; all inputs verified from GitHub README
- Architecture: HIGH — workflow patterns verified from official Tauri docs and resolved issues
- Pitfalls: HIGH — eval/PowerShell issue verified; cross-repo PAT requirement verified from GitHub community discussions; signing pitfall from official updater docs
- Environment availability: LOW — status of `taskflow-releases` repo and Ed25519 key is unknown; requires human verification

**Research date:** 2026-03-25
**Valid until:** 2026-06-25 (stable tooling; tauri-action@v0 floating tag; 90-day estimate)
