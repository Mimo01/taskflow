---
phase: quick-260519-fgq
plan: "01"
subsystem: sprint-board, backlog, issue-detail
tags: [flagged, sprint-board, backlog, issue-detail, context-menu, polish]
dependency_graph:
  requires: [quick-260519-eol]
  provides: [FLAG-FIX-01, FLAG-FIX-02, FLAG-FIX-03]
  affects: [FieldsSection, StoryHeaderRow, SprintBoardTab, TaskCard, BacklogRow]
tech_stack:
  added: []
  patterns: [ContextMenuGroup with ContextMenuLabel for visual section separation, optional prop extension on existing components]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
    - taskflow/src/routes/dashboard/BacklogPage.test.tsx
    - taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx
decisions:
  - Reused existing handleToggleFlag(issueKey) for all three StoryHeaderRow call sites; no new state or mutations needed
  - Yellow tint on StoryHeaderRow follows the same Tailwind classes as TaskCard and BacklogRow for visual consistency
  - Guard condition on StoryHeaderRow changed from !onTransition to !onTransition && !onToggleFlag so flag-only context menus still render
metrics:
  duration: ~25 minutes
  completed: "2026-05-19T11:39:36Z"
  tasks_completed: 2
  files_modified: 8
---

# Phase quick-260519-fgq Plan 01: Fix Flag Feature — Move Flag Row + Labeled Flag Section + Story Wiring Summary

**One-liner:** Relocated Flagged MetaRow between Fix Versions and Created in issue detail sidebar, wrapped Flag/Unflag in labeled ContextMenuGroup sections across TaskCard/BacklogRow/StoryHeaderRow, and wired flag toggle to swimlane story headers in SprintBoardTab at all three call sites.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Move Flagged MetaRow + labeled Flag section in TaskCard + BacklogRow | bd90fcfa | FieldsSection.tsx, TaskCard.tsx, BacklogRow.tsx |
| 2 | Add flag wiring to StoryHeaderRow + pass from SprintBoardTab at all three call sites | cc48a9b2 | StoryHeaderRow.tsx, SprintBoardTab.tsx, 3 test files |

## What Was Built

### Task 1
- **FieldsSection.tsx:** The Flagged MetaRow IIFE block was cut from its position immediately after the Priority MetaRow and pasted between the closing `</MetaRow>` of Fix Versions and `<MetaRow label="Created">`. The block contents (button, flag icon, mutation call, error text) are unchanged.
- **TaskCard.tsx:** The bare `<ContextMenuItem>` for Flag/Unflag was wrapped in `<ContextMenuGroup><ContextMenuLabel>Flag</ContextMenuLabel><ContextMenuSeparator />[item]</ContextMenuGroup>`, visually separated from the Move to... section by the existing separator.
- **BacklogRow.tsx:** Same labeled-section pattern applied — `<ContextMenuGroup><ContextMenuLabel>Flag</ContextMenuLabel><ContextMenuSeparator />[item]</ContextMenuGroup>`.

### Task 2
- **StoryHeaderRow.tsx:** Added `isFlagged?: boolean` and `onToggleFlag?: () => void` props. When `isFlagged`, the row background switches to yellow tint (matching TaskCard/BacklogRow classes) and a Flag icon appears before the storyKey span. The early-return guard changed from `!onTransition` to `!onTransition && !onToggleFlag`. The ContextMenu content gates the Move to... block behind `onTransition &&` and appends the labeled Flag section when `onToggleFlag` is provided. Imported `Flag` from lucide-react alongside existing `ChevronRight`.
- **SprintBoardTab.tsx:** All three StoryHeaderRow usages now receive `isFlagged={isIssueFlagged(story/stickyHeader.story, flaggedFieldKey)}` and `onToggleFlag={() => onToggleFlag/handleToggleFlag(story.key)}`. The VirtualizedSwimlanes component already had `flaggedFieldKey` and `onToggleFlag` in its prop interface (used for TaskCard wiring); no interface changes needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mocks for @/services/jira missing isIssueFlagged**
- **Found during:** Task 2 verification — `npx vitest run src/routes/dashboard` reported 35 failures across 3 test files
- **Issue:** `SprintBoardTab.test.tsx`, `BacklogPage.test.tsx`, and `IssueDetailSheet.test.tsx` each define a `vi.mock('@/services/jira', ...)` that doesn't include `isIssueFlagged` (or `setIssueFlagged`). Once the component code paths exercised by the tests reached `isIssueFlagged`, Vitest threw "No isIssueFlagged export is defined on the mock".
- **Fix:** Added `isIssueFlagged: vi.fn().mockReturnValue(false)` and `setIssueFlagged: vi.fn().mockResolvedValue(undefined)` to all three mocks. Also added `flaggedFieldKey: 'customfield_10021'` to the settings store mock in SprintBoardTab.test.tsx and BacklogPage.test.tsx (which destructure it from `useSettingsStore`).
- **Files modified:** SprintBoardTab.test.tsx, BacklogPage.test.tsx, IssueDetailSheet.test.tsx
- **Commit:** cc48a9b2

## Verification

- `pnpm exec tsc --noEmit` exits 0 (clean)
- All 401 dashboard tests pass (24 test files, 0 failures)
- Flagged MetaRow position confirmed: line 810 in FieldsSection.tsx appears after Fix Versions MetaRow (line 762) and before Created MetaRow (line 841)
- TaskCard.tsx: `ContextMenuLabel>Flag<` at line 232 inside `ContextMenuGroup`
- BacklogRow.tsx: `ContextMenuLabel>Flag<` at line 253 inside `ContextMenuGroup`
- SprintBoardTab.tsx: `onToggleFlag` appears 8 times (prop interface × 1, VirtualizedSwimlanes prop × 1, TaskCard wires × 2, StoryHeaderRow wires × 3, sticky overlay × 1)

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced.

## Self-Check: PASSED

- [x] FieldsSection.tsx modified — confirmed
- [x] TaskCard.tsx modified — confirmed
- [x] BacklogRow.tsx modified — confirmed
- [x] StoryHeaderRow.tsx modified — confirmed
- [x] SprintBoardTab.tsx modified — confirmed
- [x] Task 1 commit bd90fcfa — confirmed in git log
- [x] Task 2 commit cc48a9b2 — confirmed in git log
- [x] All 401 dashboard tests pass — confirmed
- [x] tsc --noEmit clean — confirmed
