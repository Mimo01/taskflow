---
phase: quick
plan: 260404-rub
subsystem: ci
tags: [github-actions, release, cross-platform, tauri, monorepo]
dependency_graph:
  requires: []
  provides: [cross-platform-release-ci]
  affects: [taskflow-releases]
tech_stack:
  added: []
  patterns: [github-actions-matrix, tauri-action, artifact-upload, latest-json-merge]
key_files:
  created:
    - .github/workflows/release-cross-platform.yml
  modified: []
decisions:
  - Adapted pmkar release-cross-platform.yml directly — structure identical, only names/paths changed
  - defaults run working-directory: taskflow on build job; artifact collection steps override to working-directory: . to use repo-root-relative paths
  - projectPath: taskflow on tauri-action so it locates src-tauri in the monorepo subdirectory
  - cache-dependency-path: taskflow/package-lock.json for npm cache in monorepo
  - workspaces: taskflow/src-tauri for rust-cache in monorepo
  - All pmkar_ artifact names replaced with taskflow_ prefix
  - All pmkar-releases repo references replaced with taskflow-releases (Mimo01/taskflow-releases)
metrics:
  duration: ~5 minutes
  completed: 2026-04-04
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Quick Task 260404-rub: Set Up GitHub Actions Release Process Summary

**One-liner:** Cross-platform GitHub Actions release workflow for Taskflow monorepo — tag push triggers Linux + Windows Tauri builds and publishes artifacts to Mimo01/taskflow-releases with latest.json.

## What Was Built

A single GitHub Actions workflow file at `.github/workflows/release-cross-platform.yml` that:

1. **Triggers** on version tag pushes (`v[0-9]+.[0-9]+.[0-9]+`) and manual `workflow_dispatch` with platform selector
2. **Build matrix** — two parallel jobs: `ubuntu-22.04` (linux) and `windows-latest`
3. **Monorepo adaptations** — all npm/build commands run in `taskflow/` working directory via `defaults: run: working-directory: taskflow`
4. **Tauri build** via `tauri-apps/tauri-action@v0` with `projectPath: taskflow`
5. **Artifact collection** — AppImage + deb for Linux; NSIS exe + MSI for Windows; all with `.sig` updater signatures
6. **Upload job** — downloads all artifacts and publishes to `Mimo01/taskflow-releases` releases, with existing-asset-deletion before re-upload and latest.json merge for the Tauri updater

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| `defaults: run: working-directory: taskflow` | All npm/Cargo commands are run from inside the monorepo subdir |
| Artifact collection steps use `working-directory: .` | Bundle paths are `taskflow/target/...` relative to repo root — must override the default |
| `projectPath: taskflow` on tauri-action | Tells the action where to find `src-tauri` |
| `cache-dependency-path: taskflow/package-lock.json` | npm cache key must point to the subdir lockfile |
| `workspaces: taskflow/src-tauri` | rust-cache workspace path in monorepo |
| `RELEASES_REPO_PAT` secret | Cross-repo write to Mimo01/taskflow-releases (GITHUB_TOKEN only has read on the source repo) |

## Secrets Required

The following secrets must be configured in the GitHub repo settings before the workflow can run:

- `GITHUB_TOKEN` — auto-provided by GitHub Actions (read-only on source repo)
- `TAURI_SIGNING_PRIVATE_KEY` — Ed25519 private key for updater artifact signing
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — passphrase for the signing key
- `RELEASES_REPO_PAT` — personal access token with `repo` write scope on `Mimo01/taskflow-releases`

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create cross-platform release workflow | e9afd62 | `.github/workflows/release-cross-platform.yml` |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `.github/workflows/release-cross-platform.yml` — FOUND (338 lines, above 200 minimum)
- Commit e9afd62 — FOUND
- `grep -c "pmkar"` returns 0 — no pmkar references remain
- `taskflow-releases` referenced in upload job URLs — FOUND
- `working-directory: taskflow` at build job level — FOUND
- `projectPath: taskflow` on tauri-action — FOUND
- `cache-dependency-path: taskflow/package-lock.json` — FOUND
- `workspaces: taskflow/src-tauri` — FOUND
- `taskflow_` prefix on all artifact names — FOUND
