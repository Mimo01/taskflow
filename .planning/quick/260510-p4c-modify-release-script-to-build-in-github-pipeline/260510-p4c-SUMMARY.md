---
phase: quick
plan: 260510-p4c
subsystem: release-pipeline
tags: [release, ci, github-actions, tauri, macos, cross-platform]
dependency_graph:
  requires: []
  provides:
    - "Simplified release.sh trigger (version-bump + tag push only)"
    - "Full CI release pipeline: macOS universal + Linux x86_64 + Windows x86_64"
    - "CI-owned GitHub release creation, artifact upload, latest.json, README update"
  affects:
    - taskflow/scripts/release.sh
    - .github/workflows/release-cross-platform.yml
tech_stack:
  added: []
  patterns:
    - "GitHub Actions matrix build (3 platforms)"
    - "Job dependency chain: build → create-release → upload-to-releases"
    - "Tag-push triggered CI release pipeline"
key_files:
  created: []
  modified:
    - taskflow/scripts/release.sh
    - .github/workflows/release-cross-platform.yml
decisions:
  - "CI owns all builds and release creation; local script is a thin trigger"
  - "create-release job outputs release_id to avoid curl-fetching in upload job"
  - "latest.json built from scratch covering all 3 platforms (no merge with existing)"
  - "macOS universal build uses rustup target add for both aarch64 and x86_64"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-10"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 260510-p4c: Modify Release Script to Build in GitHub Pipeline Summary

**One-liner:** Moved all Tauri builds and release publishing from a ~500-line local shell script into a 3-platform GitHub Actions pipeline; release.sh becomes a 112-line version-bump-and-tag-push trigger.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Simplify release.sh to version-bump-and-push-tag only | 446af80 | taskflow/scripts/release.sh |
| 2 | Extend CI workflow with macOS build, release creation, README update, and unified latest.json | 822c206 | .github/workflows/release-cross-platform.yml |

## What Was Done

**Task 1 — release.sh (446af80)**

Stripped the script from ~500 lines to 112 lines. Kept only:
- Phase A: pre-flight checks (semver format, clean working tree, git remote exists). Removed token and signing key detection entirely.
- Phase B: version bump via `bump-version.mjs` (or `--skip-bump` tag creation from CHANGELOG.md).
- Phase C (was H): `git push origin main && git push origin v$VERSION` — pushes tag to trigger CI.
- Phase D (was I): summary block pointing to GitHub Actions and the releases repo URL.

All of Phases C–G removed: local macOS universal build, Linux Docker build, GitHub release creation via curl, artifact upload, latest.json generation, README update.

**Task 2 — CI workflow (822c206)**

Extended `.github/workflows/release-cross-platform.yml` with:

1. **macOS in build matrix** — `macos-latest` with `target: universal-apple-darwin`. A dedicated step runs `rustup target add aarch64-apple-darwin x86_64-apple-darwin` before the Tauri build (required for universal builds on Apple Silicon runners). Artifact collection picks up DMG, `.app.tar.gz`, and `.app.tar.gz.sig`.

2. **`create-release` job** — Runs after `build` (with `always() && !cancelled()`). Checks out source, resolves version from tag or `workflow_dispatch` input, extracts tag annotation body for release notes, creates the GitHub release on `Mimo01/taskflow-releases` via the API, and outputs `release_id` for downstream consumption.

3. **`upload-to-releases` job** — Now `needs: [build, create-release]`. Reads `release_id` from `needs.create-release.outputs.release_id` (removes the previous curl-fetch of an already-existing release). Artifact upload loop unchanged.

4. **Unified latest.json** — Replaced the "merge with existing" approach with a Python script that builds latest.json from scratch covering all three platforms: `darwin-universal` / `darwin-x86_64` / `darwin-aarch64` (from macOS `.app.tar.gz.sig`), `linux-x86_64` (from `.AppImage.tar.gz.sig` glob), `windows-x86_64` (from `*nsis.zip.sig` glob).

5. **README update step** — Added to `upload-to-releases` after latest.json. Generates README with download links for macOS (DMG + updater tar), Linux (AppImage + deb), Windows (NSIS exe + MSI). Fetches current SHA, updates via GitHub Contents API with `base64 -w 0`.

6. **`workflow_dispatch` input** — Added `macos` to the platform choice options.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `bash -n taskflow/scripts/release.sh` — Syntax OK
- Script line count: 112 (under 120 limit)
- No forbidden patterns in release.sh (RELEASES_REPO_TOKEN, upload_asset, RELEASE_ID, docker, npx tauri build, npm run build all absent from executable code)
- `python3 -c "import yaml; yaml.safe_load(...)"` — YAML valid
- Workflow matrix: 3 entries (ubuntu-22.04, windows-latest, macos-latest)
- `create-release` job present with `outputs.release_id`
- `upload-to-releases` `needs: [build, create-release]` confirmed
- `needs.create-release.outputs.release_id` used (no curl-fetch of existing release)
- README update step present
- `darwin-universal` / `linux-x86_64` / `windows-x86_64` all present in latest.json script

## Self-Check: PASSED

- `446af80` exists in git log
- `822c206` exists in git log
- `taskflow/scripts/release.sh` present and 112 lines
- `.github/workflows/release-cross-platform.yml` present and YAML-valid
