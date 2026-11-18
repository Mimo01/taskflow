---
phase: 101-issue-drafts-large-create-edit-modal
plan: 05
subsystem: ui
tags: [labels, fix-versions, create-edit-modal, react-query]
requires:
  - phase: 101-01
    provides: FormState.labels / fixVersions and SET_FIELD dispatch
provides:
  - orderFixVersions shared ordering helper
  - useProjectFixVersions shared versions query hook
  - LabelsField and FixVersionField modal controls
affects: [101-08]
tech-stack:
  patterns: [Popover multi-select with leading check slot, shared query key with issue sidebar]
key-files:
  created:
    - taskflow/src/lib/fix-version-order.ts
    - taskflow/src/lib/fix-version-order.test.ts
    - taskflow/src/hooks/useProjectFixVersions.ts
    - taskflow/src/routes/dashboard/create-edit-issue/LabelsField.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/LabelsField.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/FixVersionField.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/FixVersionField.test.tsx
  modified:
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
key-decisions:
  - "Hook reads jiraBaseUrl from the auth store (nullable) and guards it in enabled and queryFn; key unchanged"
requirements-completed: [UI-01, DRAFT-04]
duration: 15min
completed: 2026-11-18
---

# Phase 101 Plan 05: Labels and Fix Version controls Summary

Labels token input and fix-version popover multi-select for the modal, plus a shared ordering helper and versions hook now used by the issue sidebar too.

## Tasks
1. Shared `orderFixVersions` + `useProjectFixVersions`; FieldsSection refactored (behaviour unchanged, existing tests pass).
2. `LabelsField` (Enter adds, trims, splits on whitespace, dedupes, Esc clears text only when present, Cmd+Enter untouched) and `FixVersionField` (Popover, leading check slot, released / no date badges, None placeholder).

## Deviations from Plan
None. Pre-commit full-suite runs hit load-related timeouts in unrelated tests (WorklogsPage, EpicDetailSheet, IssueDetailParts, FindBar); commits retried.

## Self-Check: PASSED
