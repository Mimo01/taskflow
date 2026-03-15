---
phase: 09-custom-field-discovery-issue-detail-foundation
plan: "07"
subsystem: ui
tags: [react, jira, sheet, dnd-kit, tanstack-query]

# Dependency graph
requires:
  - phase: 09-05
    provides: IssueDetailSheet component with issueKey/onClose/onOpenIssue props
  - phase: 09-06
    provides: CommentComposer + full IssueDetailSheet feature set

provides:
  - SprintBoardTab renders IssueDetailSheet; clicking any TaskCard opens the sheet with that issue's key
  - MyTasksTab renders IssueDetailSheet; clicking any TaskRow title opens the sheet with that issue's key
  - TaskCard accepts optional onClick prop — card body is clickable with keyboard support
  - TaskRow accepts optional onIssueClick prop — summary button calls onIssueClick(issue.key)
  - Subtask click-through wired: onOpenIssue=setSelectedIssueKey replaces current key without nesting sheets

affects:
  - 09-08 (search/notification entry points will follow same selectedIssueKey + IssueDetailSheet pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - selectedIssueKey state + IssueDetailSheet at root pattern for sheet entry points
    - IssueDetailSheet rendered outside DndContext DOM tree (React fragment sibling) to keep drag state alive

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/TaskRow.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.tsx

key-decisions:
  - "IssueDetailSheet is a named export (not default) — import { IssueDetailSheet } from './IssueDetailSheet'"
  - "SprintBoardTab: sheet rendered in React fragment sibling to board div, outside DndContext DOM subtree — preserves drag state while sheet is open"
  - "TaskRow summary wrapped in <button type=button> (not span) — native semantics, hover:underline, focus-visible ring for accessibility"
  - "onOpenIssue=setSelectedIssueKey implements stack-free subtask navigation: replaces key, old sheet closes, new one opens; no nested Sheet + no back button required in phase 9"

patterns-established:
  - "Sheet entry point pattern: const [selectedIssueKey, setSelectedIssueKey] = useState<string|null>(null) + <IssueDetailSheet issueKey={selectedIssueKey} onClose={() => setSelectedIssueKey(null)} onOpenIssue={setSelectedIssueKey} /> at JSX root"

requirements-completed: [ISSUE-01]

# Metrics
duration: 8min
completed: 2026-03-14
---

# Phase 9 Plan 07: IssueDetailSheet Entry Points Summary

**Sprint board and My Tasks tab wired to IssueDetailSheet via selectedIssueKey state; TaskCard and TaskRow now clickable with full keyboard accessibility and subtask navigation support**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-14T10:17:37Z
- **Completed:** 2026-03-14T10:25:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- TaskCard gains optional `onClick` prop; outer div is role=button with cursor-pointer, hover border highlight, and Enter/Space keyboard handler; existing onToggle chevron still stops propagation
- TaskRow gains optional `onIssueClick` prop; summary/title area replaced with a semantic `<button>` that calls `onIssueClick(issue.key)` — accessible, truncates properly, hover underline
- SprintBoardTab: `selectedIssueKey` state wired to all TaskCard `onClick` handlers (stories + expanded subtasks); IssueDetailSheet rendered as React fragment sibling outside DndContext DOM subtree, preserving drag state
- MyTasksTab: `selectedIssueKey` state wired to all TaskRow `onIssueClick` handlers; IssueDetailSheet rendered at JSX root

## Task Commits

1. **Task 1: Add onClick to TaskCard and onIssueClick to TaskRow** - `78c040f` (feat)
2. **Task 2: Wire IssueDetailSheet into SprintBoardTab and MyTasksTab** - `54b44bb` (feat)

## Files Created/Modified

- `taskflow/src/routes/dashboard/TaskCard.tsx` - Added `onClick?: () => void` prop; outer div now role=button with cursor-pointer and keyboard handler
- `taskflow/src/routes/dashboard/TaskRow.tsx` - Added `onIssueClick?: (issueKey: string) => void` prop; summary area converted from span to accessible button
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` - Added `selectedIssueKey` state, `onClick` on all TaskCards, `IssueDetailSheet` at JSX root outside DndContext
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` - Added `selectedIssueKey` state, `onIssueClick` on all TaskRows, `IssueDetailSheet` at JSX root

## Decisions Made

- IssueDetailSheet is a named export (`{ IssueDetailSheet }`) — corrected from default import attempt detected during tsc run
- Sheet placed as React fragment sibling to the board div in SprintBoardTab, keeping it outside DndContext's DOM subtree — DndContext remains mounted while sheet is open per RESEARCH.md decision
- `onOpenIssue={setSelectedIssueKey}` implements single-sheet subtask navigation (replaces key rather than stacking) — no nested Sheet, no scroll-lock conflict, no back button required in phase 9

## Deviations from Plan

None - plan executed exactly as written. The named-export correction was caught by tsc during Task 2 verification (auto-fix Rule 3 within same task commit).

## Issues Encountered

- IssueDetailSheet is exported as a named export, not a default export. Initial import used default syntax — caught by `npx tsc --noEmit` and corrected immediately within Task 2 before commit.

## Next Phase Readiness

- All sprint board and My Tasks issue cards now open IssueDetailSheet on click
- Plan 08 can wire the same `selectedIssueKey + IssueDetailSheet` pattern into search results and notification entries
- Pre-existing test failures in SubtasksPanel.test.tsx, ReleasesTab.test.tsx, and MyTasksTab skeleton test are unrelated to this plan's changes and were present before execution

---
*Phase: 09-custom-field-discovery-issue-detail-foundation*
*Completed: 2026-03-14*
