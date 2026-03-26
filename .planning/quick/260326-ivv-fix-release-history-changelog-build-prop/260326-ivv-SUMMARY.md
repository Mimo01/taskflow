---
phase: quick
plan: 260326-ivv
subsystem: release-tooling
tags: [release, changelog, scripts, bash]
dependency_graph:
  requires: []
  provides: [categorized-changelog-generation, auto-changelog-in-release-script]
  affects: [github-releases-body, app-version-history, whats-new-dialog]
tech_stack:
  added: []
  patterns: [conventional-commits-parsing, bash-script-pipeline]
key_files:
  created:
    - taskflow/scripts/generate-changelog.sh
  modified:
    - taskflow/scripts/release.sh
decisions:
  - "Use printf + git tag -F - for multi-line tag annotation instead of -m to ensure body is correctly extracted by CI's %(contents:body)"
  - "Skip test/docs/ci/chore commit types as not user-facing; fall back to 'Internal improvements and maintenance.' when no user-facing commits"
metrics:
  duration: 80s
  completed: 2026-03-26
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Quick Task 260326-ivv: Fix Release History Changelog Build Prop Summary

**One-liner:** Bash changelog generator that parses conventional commits into categorized markdown, wired into release.sh so GitHub Releases (and the app's VersionHistoryList/WhatsNewDialog) receive structured release notes automatically.

## What Was Built

### Task 1 — generate-changelog.sh (commit: 98e8b32)

New script `taskflow/scripts/generate-changelog.sh`:

- Takes two optional args: new tag/ref (default: HEAD) and previous tag (default: auto-detected via `git describe`)
- Parses `git log --format='%s'` for the commit range
- Categorizes conventional commits into: Features (`feat:`), Bug Fixes (`fix:`), Improvements (`refactor:`)
- Skips non-user-facing types: `test:`, `docs:`, `ci:`, `chore:`
- Commits without a recognized prefix land in "Other Changes"
- Strips the `type(scope): ` prefix and capitalizes the description
- Falls back to "Internal improvements and maintenance." when all commits are internal-only
- Pure bash — no Node/npm dependencies

### Task 2 — release.sh updated (commit: a9685fe)

Updated `taskflow/scripts/release.sh`:

- When called without a custom message: auto-detects previous tag, calls `generate-changelog.sh`, prints changelog to terminal, then creates the annotated tag
- Tag annotation format: subject = tag name, body = changelog markdown (CI extracts body via `%(contents:body)`)
- Switched from `git tag -a -m` to `git tag -a -F -` (pipe from stdin) for reliable multi-line message support
- When called with a custom message: uses it as-is (backward compatible)
- Usage: `./scripts/release.sh v1.7` or `./scripts/release.sh v1.7 "Custom notes"`

## Data Flow After This Change

1. `release.sh` creates annotated tag — body contains `### Features / ### Bug Fixes` markdown
2. CI extracts body: `git tag -l --format='%(contents:body)'`
3. CI passes body as `releaseBody` to tauri-action which sets GitHub Release body
4. App fetches GitHub Releases API; `release.body` rendered by ReactMarkdown in VersionHistoryList
5. On update, Tauri updater sources changelog from release notes; stored and shown in WhatsNewDialog

No frontend changes were needed.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- taskflow/scripts/generate-changelog.sh: exists and executable
- taskflow/scripts/release.sh: exists and executable
- Commits 98e8b32 and a9685fe verified in git log
- `bash scripts/generate-changelog.sh v1.6 v1.5` produces ### Features and ### Bug Fixes sections
