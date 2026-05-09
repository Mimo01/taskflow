---
phase: quick
plan: 260509-qor
subsystem: issue-detail
tags: [story-points, ux, null, clear]
dependency_graph:
  requires: []
  provides: [story-points-clear-ux]
  affects: [FieldsSection, IssueDetailSheet.test]
tech_stack:
  added: []
  patterns: [tdd-red-green, onMouseDown-preventDefault-blur-race]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx
decisions:
  - "Used onMouseDown preventDefault on Clear button to prevent Input onBlur firing commitSpEdit before click registers — without this the blur closes edit mode before the click is processed"
  - "Clear button is conditionally rendered only when storyPoints != null — no affordance to clear when already cleared"
  - "commitSpEdit guards against no-op: skips null mutation when original was already null"
metrics:
  duration_seconds: 102
  completed_date: "2026-05-09"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 2
---

# Quick Task 260509-qor: Story Points Allow Empty Summary

**One-liner:** Fixed commitSpEdit to send null (not 0) on empty input, and added a Clear (×) button in SP edit mode with blur-race prevention via onMouseDown preventDefault.

## What Was Done

Story points in issue detail previously sent `0` when the user cleared the input field, making it impossible to remove story points from an issue. Two changes were made to `FieldsSection.tsx`:

1. **`commitSpEdit` fix** — when the input is empty (after trim), the function now sends `{ value: null }` to the mutation instead of `Number("")` which is `0`. The guard `spOriginal.current !== null` prevents a no-op null→null mutation.

2. **Clear button** — a `×` button with `data-testid="story-points-clear"` is rendered alongside the Input when in SP edit mode, but only when `storyPoints != null`. Clicking it closes edit mode and sends `{ value: null }`. The `onMouseDown` with `e.preventDefault()` prevents the Input's `onBlur` from firing `commitSpEdit` before the click event is processed.

## TDD Gate Compliance

- RED commit `1af8156`: 3 new failing tests added for SP clear behavior
- GREEN commit `0293111`: Implementation makes all 23 tests pass

## Test Results

- 23/23 tests pass in `IssueDetailSheet.test.tsx`
- 3 new tests in `ISSUE-SP: story points clear` describe block
- 0 regressions in existing tests

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. The change is UI-only: null is a valid explicit value in the Jira API and the server validates as before. T-qor-01 (Tampering / commitSpEdit numeric parsing) disposition remains `accept` as documented in the plan threat model.

## Self-Check: PASSED

- `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` — modified, exists
- `taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx` — modified, exists
- RED commit `1af8156` — verified in git log
- GREEN commit `0293111` — verified in git log
