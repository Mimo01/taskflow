---
phase: 41-ci-pipeline
plan: 01
subsystem: infra
tags: [github-actions, tauri, ci-cd, release-pipeline, cross-platform]

# Dependency graph
requires: []
provides:
  - GitHub Actions release workflow triggering on semver tag push
  - macOS universal (arm64+x86_64), Windows x86_64, Linux x86_64 build matrix
  - Version injection via inject-version.cjs piped to GITHUB_ENV
  - All app source URLs wired to Mimo01/taskflow-releases public repo
affects: [deploy, versioning, updater, version-policy]

# Tech tracking
tech-stack:
  added: [github-actions, tauri-apps/tauri-action@v0, dtolnay/rust-toolchain, swatinem/rust-cache@v2]
  patterns: [tag-triggered-release, cross-platform-matrix-build, version-injection-via-env]

key-files:
  created:
    - .github/workflows/release.yml
  modified:
    - taskflow/src-tauri/tauri.conf.json
    - taskflow/src/hooks/useVersionPolicyCheck.ts
    - taskflow/src/routes/settings/UpdatesSection.tsx

key-decisions:
  - "RELEASES_REPO_TOKEN PAT (not GITHUB_TOKEN) used for cross-repo publish to Mimo01/taskflow-releases"
  - "shell: bash explicitly set on inject-version and tag_body steps for Windows PowerShell compatibility"
  - "fetch-depth: 0 on checkout required for git describe --tags in inject-version.cjs"
  - "fail-fast: false in strategy to prevent one platform failure from canceling other builds"
  - "releaseDraft: false for fully automatic publish without manual approval step"

patterns-established:
  - "Tag-triggered release: push v[0-9]* tag to trigger full 3-platform build"
  - "Version injection: node scripts/inject-version.cjs >> $GITHUB_ENV exports APP_VERSION/SHA/DATE"
  - "Cross-repo release: tauri-action owner/repo inputs route artifacts to public releases repo"

requirements-completed: [CI-01, CI-02]

# Metrics
duration: 8min
completed: 2026-03-25
---

# Phase 41 Plan 01: CI Pipeline Summary

**GitHub Actions release workflow building macOS universal + Windows x86_64 + Linux x86_64 on semver tag push, publishing to Mimo01/taskflow-releases with all app source URLs wired to real repo**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-25T09:30:00Z
- **Completed:** 2026-03-25T09:38:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced all placeholder URLs (OWNER/RELEASES_REPO, PLACEHOLDER/PLACEHOLDER) with real Mimo01/taskflow-releases endpoints across tauri.conf.json, useVersionPolicyCheck.ts, and UpdatesSection.tsx
- Created complete `.github/workflows/release.yml` with 3-platform build matrix, version injection, cross-repo PAT publishing, and pre-build test execution

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace all placeholder URLs with real Mimo01/taskflow-releases URLs** - `5b7fdb1` (feat)
2. **Task 2: Create GitHub Actions release workflow** - `fedd6ab` (feat)

## Files Created/Modified
- `.github/workflows/release.yml` - Complete CI release workflow: 3-platform matrix, inject-version, tauri-action publish to Mimo01/taskflow-releases
- `taskflow/src-tauri/tauri.conf.json` - Updater endpoint now points to real releases repo
- `taskflow/src/hooks/useVersionPolicyCheck.ts` - Version policy URL updated; placeholder comment replaced with real description
- `taskflow/src/routes/settings/UpdatesSection.tsx` - GitHub Releases API URL updated; TODO comment removed

## Decisions Made
- Used `shell: bash` explicitly on inject-version and tag_body steps to avoid PowerShell evaluation issues on Windows runners
- `fetch-depth: 0` on checkout is required — without it `git describe --tags` in inject-version.cjs falls back to `0.0.0-dev`
- `fail-fast: false` in matrix strategy allows all platforms to complete even if one fails
- `releaseDraft: false` for fully automatic publish (per D-08 in research)
- `RELEASES_REPO_TOKEN` (not `GITHUB_TOKEN`) because publishing goes to a separate repo (Mimo01/taskflow-releases)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failures in `jira.test.ts` (2 tests) and `ReleasesTab.test.tsx` (14 tests) were present before changes and are unrelated to URL replacements. These are known pre-existing regressions documented in PROJECT.md Known Caveats.

## User Setup Required
Before using the release workflow, the following GitHub Actions secrets must be configured in the main repo:
- `RELEASES_REPO_TOKEN` — fine-grained PAT with `contents:write` permission on Mimo01/taskflow-releases
- `TAURI_SIGNING_PRIVATE_KEY` — Tauri updater signing private key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — password for the signing private key

## Next Phase Readiness
- CI pipeline is complete. Releasing Taskflow requires: push a semver tag (e.g., `git tag v1.4.0 && git push --tags`)
- The workflow will build all 3 platforms and publish to Mimo01/taskflow-releases automatically
- Remaining: add `pubkey` to tauri.conf.json plugins.updater (requires key generation — human action, not in this plan)

---
*Phase: 41-ci-pipeline*
*Completed: 2026-03-25*

## Self-Check: PASSED

- FOUND: `.github/workflows/release.yml`
- FOUND: `taskflow/src-tauri/tauri.conf.json`
- FOUND: `taskflow/src/hooks/useVersionPolicyCheck.ts`
- FOUND: `taskflow/src/routes/settings/UpdatesSection.tsx`
- FOUND: `.planning/phases/41-ci-pipeline/41-01-SUMMARY.md`
- COMMIT `5b7fdb1` verified: feat(41-01): replace placeholder URLs
- COMMIT `fedd6ab` verified: feat(41-01): add GitHub Actions release workflow
