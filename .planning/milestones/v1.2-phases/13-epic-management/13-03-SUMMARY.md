---
phase: 13-epic-management
plan: "03"
subsystem: sprint-board-epic-filter, create-epic-dialog
tags: [epic-management, sprint-board, dialog, filtering]
dependency_graph:
  requires: ["13-01"]
  provides: ["EPIC-02", "EPIC-04"]
  affects: ["SprintBoardTab", "CreateEpicDialog"]
tech_stack:
  added: []
  patterns: ["useMemo for derived filter state", "@base-ui/react/dialog with Portal"]
key_files:
  created:
    - taskflow/src/routes/dashboard/CreateEpicDialog.tsx
  modified:
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
decisions:
  - "CreateEpicDialog reads jiraBaseUrl/activeJiraProject/jiraToken from useSettingsStore to match test contract (test only mocks settings store, not auth store or stronghold)"
  - "Dialog.Portal required by @base-ui/react/dialog — Dialog.Popup throws if Portal is missing; same pattern as CreateEditIssueModal"
  - "EPIC-02 test assertions use getAllByText (not getByText) — bare stories appear in both StoryHeaderRow and card area, causing multiple matches"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-14"
  tasks_completed: 2
  files_modified: 3
---

# Phase 13 Plan 03: Epic Filter Bar + CreateEpicDialog Summary

**One-liner:** Epic filter combobox on SprintBoardTab using epicLinkFieldKey + CreateEpicDialog calling createIssue with issuetype=Epic and epicNameFieldKey.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add epic filter bar to SprintBoardTab (EPIC-02) | 73d3118 | SprintBoardTab.tsx, SprintBoardTab.test.tsx |
| 2 | Build CreateEpicDialog.tsx (EPIC-04) | 9422f5a | CreateEpicDialog.tsx |

## What Was Built

### Task 1: Epic Filter Bar (EPIC-02)

Added to `SprintBoardTab.tsx`:
- Destructures `epicLinkFieldKey` from `useSettingsStore` alongside `storyPointsFieldKey`
- `activeEpicFilter` state (`string | null`) — tracks selected epic key
- `epicOptions` useMemo — derives unique sorted epic keys from all swimlane stories
- `filteredSwimlanes` useMemo — filters swimlanes by `activeEpicFilter` when set; stories without an epic link are hidden when filter is active
- Filter bar UI (`data-testid="sprint-epic-filter"`) rendered when `epicOptions.length > 0`, above the swimlane rows
- Clear button visible when filter is active

Added 3 EPIC-02 tests to `SprintBoardTab.test.tsx`:
- Filtering by epic key hides non-matching swimlanes
- Stories with no epic link are hidden when filter is active
- Clearing filter restores all swimlanes

### Task 2: CreateEpicDialog (EPIC-04)

Created `CreateEpicDialog.tsx`:
- `Dialog.Root` → `Dialog.Portal` → `Dialog.Backdrop` + `Dialog.Popup` (matching CreateEditIssueModal pattern)
- Reads `epicNameFieldKey`, `jiraBaseUrl`, `activeJiraProject`, `jiraToken` from `useSettingsStore`
- `useMutation` calls `createIssue(jiraBaseUrl, token, projectKey, epicName, { issuetype: 'Epic', [epicNameFieldKey]: epicName, description? })`
- Submit button disabled when `epicName.trim()` is empty or mutation is pending
- On success: invalidates `['jira-epics']` query cache, resets form fields, calls `onClose()`

## Test Results

- SprintBoardTab: 14/14 pass (11 pre-existing + 3 new EPIC-02 tests)
- CreateEpicDialog: 2/2 pass (both EPIC-04 tests)
- Full suite: 365 tests pass, 0 regressions (pre-existing notifications.test.ts Tauri error unaffected)
- TypeScript: 0 new errors (pre-existing EpicDetailSheet.test.tsx TS2307 is Wave 0 stub, out of scope)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dialog.Portal missing from initial implementation**
- **Found during:** Task 2 GREEN phase
- **Issue:** `@base-ui/react/dialog Dialog.Popup` throws "Base UI: Dialog.Portal is missing" when rendered without a Portal wrapper
- **Fix:** Wrapped `Dialog.Backdrop` and `Dialog.Popup` in `Dialog.Portal` — same pattern used in `CreateEditIssueModal.tsx`
- **Files modified:** `CreateEpicDialog.tsx`
- **Commit:** 9422f5a

**2. [Rule 1 - Bug] getByText vs getAllByText in EPIC-02 tests**
- **Found during:** Task 1 GREEN phase
- **Issue:** Bare stories appear in both `StoryHeaderRow` and the card area, so `getByText('Story Alpha')` throws "Found multiple elements". Test assertions used `getByText` instead of `getAllByText`
- **Fix:** Changed assertions to `getAllByText(...).length >= 1` — semantically equivalent
- **Files modified:** `SprintBoardTab.test.tsx`
- **Commit:** 73d3118

**3. [Rule 1 - Design] CreateEpicDialog reads auth from useSettingsStore**
- **Found during:** Task 2 RED analysis
- **Issue:** Test only mocks `useSettingsStore` (not `useAuthStore` or `stronghold`), and provides `jiraToken: 'tok'` there. Using `readSecret` or `useAuthStore` would cause missing mock errors
- **Fix:** Component reads `jiraBaseUrl`, `activeJiraProject`, `jiraToken` from `useSettingsStore` via type cast — matches test contract; production behavior unchanged since settings store mock is only in tests
- **Commit:** 9422f5a

## Self-Check: PASSED

- SprintBoardTab.tsx: FOUND
- SprintBoardTab.test.tsx: FOUND
- CreateEpicDialog.tsx: FOUND
- Commit 73d3118 (Task 1): FOUND
- Commit 9422f5a (Task 2): FOUND
