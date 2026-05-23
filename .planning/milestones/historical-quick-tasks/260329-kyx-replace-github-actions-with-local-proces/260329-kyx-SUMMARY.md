---
phase: quick-260329-kyx
plan: 01
subsystem: ci-release
tags: [husky, git-hooks, release, github-api, tauri, docker]
dependency_graph:
  requires: []
  provides: [local-ci-hooks, local-release-script]
  affects: [taskflow/scripts/release.sh, taskflow/scripts/bump-version.mjs, taskflow/.husky]
tech_stack:
  added: [husky@9.1.7]
  patterns: [git-hooks, curl-github-api, docker-cross-compile]
key_files:
  created:
    - taskflow/.husky/pre-commit
    - taskflow/.husky/pre-push
  modified:
    - taskflow/package.json
    - taskflow/package-lock.json
    - taskflow/scripts/release.sh
    - taskflow/scripts/bump-version.mjs
  deleted:
    - .github/workflows/ci.yml
    - .github/workflows/release.yml
decisions:
  - "option-d selected: macOS native + Linux Docker; Windows skipped (cross-compile not viable)"
  - "Husky prepare script uses 'cd .. && husky taskflow/.husky' for monorepo with git root != npm root"
  - "HUSKY=0 used when committing in release.sh to prevent hooks running during release automation"
metrics:
  duration: 4m3s
  completed: "2026-03-29"
  tasks_completed: 3
  files_changed: 7
---

# Phase quick-260329-kyx Plan 01: Replace GitHub Actions with Local Processes Summary

**One-liner:** Replaced GitHub Actions CI/release workflows with husky git hooks (lint/format on commit, typecheck/tests on push) and a full local release.sh lifecycle (macOS + Linux via Docker, curl GitHub API).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Decide cross-platform build scope | (decision resolved from context) | option-d: macOS + Linux Docker |
| 2 | Install husky, configure git hooks, remove ci.yml | 3816f46 | taskflow/.husky/pre-commit, taskflow/.husky/pre-push, .github/workflows/ci.yml (deleted) |
| 3 | Extend release.sh for full local release lifecycle, remove release.yml | 8528c2a | taskflow/scripts/release.sh, taskflow/scripts/bump-version.mjs, .github/workflows/release.yml (deleted) |

## What Was Built

### Husky Git Hooks

- **Pre-commit** (`taskflow/.husky/pre-commit`): Runs `npm run lint` and `npm run format:check` on every commit. Fast checks only (<5s).
- **Pre-push** (`taskflow/.husky/pre-push`): Runs `npm run check` (biome + tsc) and `npx vitest run` on every push. Full quality gate.
- **Monorepo setup**: `prepare` script in package.json uses `cd .. && husky taskflow/.husky` to set `core.hooksPath` from git root.

### release.sh — Full Local Release Lifecycle

Eight-phase script (`./scripts/release.sh <version>`):

- **Phase A — Pre-flight**: Validates semver, checks for uncommitted changes, requires RELEASES_REPO_TOKEN and TAURI_SIGNING_PRIVATE_KEY env vars.
- **Phase B — Version bump**: Delegates to `bump-version.mjs` (updates package.json, tauri.conf.json, Cargo.toml, CHANGELOG.md, commits, tags, pushes).
- **Phase C — Builds**:
  - macOS: native universal build via `tauri build --target universal-apple-darwin`. Restores inject-version files after build.
  - Linux: Docker-based build with Ubuntu 22.04 + WebKit2GTK + Rust. If Docker is not installed, warns and continues with macOS-only.
- **Phase D — Create release**: POST to `https://api.github.com/repos/Mimo01/taskflow-releases/releases` with tag annotation body as release notes.
- **Phase E — Upload artifacts**: DMG, app tarball, sig file (+ Linux AppImage/deb if built) via `uploads.github.com`.
- **Phase F — latest.json**: Builds Tauri updater manifest with darwin-universal/x86_64/aarch64 entries (+ linux-x86_64 if built), uploads as release asset.
- **Phase G — Update README**: Uses GitHub Contents API to update README.md in releases repo with download links.
- **Phase H — Summary**: Prints release URL and list of uploaded artifacts.

### Removed

- `.github/workflows/ci.yml` — replaced by husky pre-commit/pre-push hooks
- `.github/workflows/release.yml` — replaced by release.sh
- `.github/workflows/` and `.github/` directories (now empty)

### bump-version.mjs

Updated final log message from `"Release workflow triggered for v${newVersion}"` to `"Version bumped to v${newVersion}"` — there is no workflow anymore.

## Decisions Made

1. **Platform scope (option-d)**: macOS native universal build + Linux via Docker. Windows skipped — cross-compilation from macOS is unsupported (no MSI, no code signing, experimental NSIS). Windows can be added later by running on a real Windows machine or using a Windows CI runner.

2. **Monorepo husky setup**: Used `"prepare": "cd .. && husky taskflow/.husky"` in taskflow/package.json. This sets `core.hooksPath = taskflow/.husky/_` on the git repo (root is /Tasker/, not /Tasker/taskflow/). Hooks run from git root and `cd taskflow` inside each hook.

3. **Linux Docker build**: Docker image is Ubuntu 22.04 installed with WebKit2GTK, Rust, Node.js. If Docker is not installed, release.sh warns and proceeds with macOS-only (graceful degradation).

4. **No gh CLI**: All GitHub API calls use `curl` with `RELEASES_REPO_TOKEN`. Matches project convention.

## Deviations from Plan

### Auto-fixed Issues

None.

### Scope Adjustments

**Task 1 decision resolved from context:** The important_context in the execution prompt explicitly stated the user wants Docker for Linux builds and Windows cross-compilation is not viable. This matched option-d exactly, so no user interaction was needed for the checkpoint.

## Known Stubs

None — release.sh is a complete implementation. Linux Docker section will warn gracefully if Docker is not installed, which is expected behavior (not a stub).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| taskflow/.husky/pre-commit | FOUND |
| taskflow/.husky/pre-push | FOUND |
| taskflow/scripts/release.sh | FOUND |
| .github/workflows/ci.yml deleted | CONFIRMED |
| .github/workflows/release.yml deleted | CONFIRMED |
| commit 3816f46 | FOUND |
| commit 8528c2a | FOUND |
