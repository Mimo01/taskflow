---
phase: 101-issue-drafts-large-create-edit-modal
plan: 04
subsystem: drafts
tags: [pure-functions, snapshot, validation, tdd]
requires: [101-01, 101-03]
provides:
  - "lib/issue-draft-snapshot.ts: toIssueSnapshot, snapshotToFormPatch, hasUserContent, hasEpicContent, keptFieldsAfterCreate, validateSnapshot, StaleNotes"
affects: [101-09, 101-10]
key-files:
  created:
    - taskflow/src/lib/issue-draft-snapshot.ts
    - taskflow/src/lib/issue-draft-snapshot.test.ts
requirements-completed: [UI-02, DRAFT-01, DRAFT-04]
metrics:
  tasks: 1
  completed: 2026-11-18
---

# Phase 101 Plan 04: Issue draft snapshot rules Summary

Pure, React-free functions that convert form state to a draft snapshot and back, gate on user content (D-12), compute Create another kept fields (D-07, all custom fields kept) and validate a resumed draft against live data (D-15) without ever clearing on an unknown lookup.

## Tasks

1. RED to GREEN in one commit (pre-commit hook runs the full suite): 14 tests cover every behavior case, including the exact UI-SPEC stale strings. tsc and biome clean.

## Deviations from Plan

- Worktree base mismatch at start was corrected with the sanctioned `git reset --hard` to the expected base.
- Multiple removed fix versions are joined with `; ` in a single `notes.fixVersions` string (the plan only specified the single-version case).
- Pre-commit full suite hit load-related timeouts in unrelated tests (IssueDetailContent and similar); commit retried unchanged without `--no-verify`.

## Known Stubs

None.

## Self-Check: PASSED
