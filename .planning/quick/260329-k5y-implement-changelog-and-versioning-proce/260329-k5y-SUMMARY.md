---
phase: quick-260329-k5y
plan: "01"
subsystem: release-tooling
tags: [changelog, versioning, git-cliff, release-automation]
dependency_graph:
  requires: []
  provides: [changelog-automation, version-bump-workflow]
  affects: [taskflow/scripts/release.sh, taskflow/package.json]
tech_stack:
  added: [git-cliff@2.12.0]
  patterns: [conventional-commits, annotated-git-tags, single-command-release]
key_files:
  created:
    - taskflow/cliff.toml
    - taskflow/CHANGELOG.md
    - taskflow/scripts/bump-version.mjs
  modified:
    - taskflow/scripts/release.sh
    - taskflow/package.json
  deleted:
    - taskflow/scripts/generate-changelog.sh
decisions:
  - "Use git-cliff@2.12.0 via npx — no global install required"
  - "bump-version.mjs runs from taskflow/scripts/ but uses REPO_ROOT (one level above taskflow/) for git operations and git-cliff"
  - "Tag annotation: tagMessage = v{version} + blank line + tagBody (--strip header output), piped via stdin to git tag -a -F - "
  - "generate-changelog.sh removed entirely — git-cliff is strictly superior, no fallback needed"
metrics:
  duration: "~15 minutes"
  completed: "2026-03-29"
  tasks_completed: 2
  files_changed: 5
---

# Phase quick-260329-k5y Plan 01: Changelog and Versioning Process Summary

**One-liner:** git-cliff-based changelog generation with unified bump-version.mjs script that updates 3 version files, regenerates CHANGELOG.md, commits, creates annotated tag, and pushes in one command.

## What Was Built

Replaced the custom shell-based changelog generator (`generate-changelog.sh`) and manual release flow with a git-cliff-powered versioning workflow adapted from pmkar.

### cliff.toml

Conventional commit parser config placed in `taskflow/`. Skips GSD planning commits (`docs(quick`, `docs(gsd`) and version bump commits (`chore: bump version`). Groups remaining commits into: Features, Bug Fixes, Refactoring, Performance, Testing, Documentation, Miscellaneous, CI/CD.

### CHANGELOG.md

Full project changelog generated retroactively from all existing tags (v0.1.0 through v1.6.1). 18 non-conventional commits are skipped (expected per research — `filter_unconventional = true`).

### bump-version.mjs

Unified release script (Node ESM). Steps:
1. Validate semver format (`/^\d+\.\d+\.\d+$/`)
2. Update `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
3. Regenerate `CHANGELOG.md` via git-cliff (full history with `--tag v{version}`)
4. Generate tag body (unreleased notes only via `--unreleased --strip header`)
5. `git add -A && git commit -m "chore: bump version to {version}"`
6. `git tag -a v{version} -F -` with annotation piped via stdin
7. `git push origin main && git push origin v{version}`

REPO_ROOT is detected as `resolve(__dirname, '../..')` since the script lives in `taskflow/scripts/`.

### release.sh (updated)

Thin wrapper: validates bare semver arg, checks for uncommitted changes, runs `npx vitest run`, runs `npm run check`, then calls `node scripts/bump-version.mjs "$VERSION"`.

### package.json (updated)

Added `"bump": "node scripts/bump-version.mjs"` alongside existing `"release"` script.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 52d8d17 | feat(quick-260329-k5y): add cliff.toml and generate initial CHANGELOG.md |
| Task 2 | 2a4f5fb | feat(quick-260329-k5y): add bump-version.mjs, update release.sh, remove generate-changelog.sh |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- taskflow/cliff.toml: FOUND
- taskflow/CHANGELOG.md: FOUND (1472 lines, 10 version sections)
- taskflow/scripts/bump-version.mjs: FOUND (syntax OK)
- taskflow/scripts/release.sh: FOUND (calls bump-version.mjs)
- taskflow/scripts/generate-changelog.sh: DELETED
- taskflow/package.json: FOUND (bump + release scripts present)
- Commits 52d8d17 and 2a4f5fb: FOUND in git log
