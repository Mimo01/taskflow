---
phase: quick
plan: 260513-awc
subsystem: sprint-board
tags: [epic-pill, sprint-board, ui, jira-color]
dependency_graph:
  requires: []
  provides: [epic-pill-in-sprint-board-swimlane-headers]
  affects: [StoryHeaderRow, SprintBoardTab]
tech_stack:
  added: []
  patterns: [epicColorToTailwind, EpicColorResult]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
decisions:
  - Reordered assignee block to after status badge to match target layout (epic pill | status | assignee)
  - Used EpicColorResult type import (not ReturnType<typeof epicColorToTailwind>) for cleaner props interface
  - Sticky overlay StoryHeaderRow uses inline IIFE to derive epic values without introducing extra variables in the outer scope
metrics:
  duration: "~15 minutes"
  completed: "2026-05-13"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 260513-awc: Sprint Board Epic Pill Summary

**One-liner:** Clickable Jira-colored epic name pill added to sprint board swimlane headers (StoryHeaderRow) between key+summary and status badge, wired through SprintBoardTab at both the virtualized and sticky overlay call sites.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add epic pill props to StoryHeaderRow and render between key+summary and status | 437a53f | StoryHeaderRow.tsx |
| 2 | Pass epic data from SprintBoardTab into StoryHeaderRow at both call sites | 21978e0 | SprintBoardTab.tsx |

## What Was Built

**StoryHeaderRow.tsx:**
- Added four optional props: `epicKey`, `epicName`, `epicColorResult` (typed as `EpicColorResult`), `onEpicClick`
- Imported `EpicColorResult` type from `@/lib/epicColors`
- Renders a `<button>` pill with Jira epic color when all three data props are truthy; `e.stopPropagation()` prevents the row click from opening the story detail sheet
- Reordered layout: epic pill now appears after key+summary and before status badge; assignee moved to after status badge (matches target layout in plan)

**SprintBoardTab.tsx:**
- Imported `epicColorToTailwind` from `@/lib/epicColors`
- Built `epicColorMap: Map<string, string>` alongside `epicNameMap` from the `epicsBasic` query result
- Added `epicNameMap`, `epicColorMap`, `epicLinkFieldKey` props to `VirtualizedSwimlanes` interface and destructuring
- `renderSwimlane`: derives `storyEpicKey / storyEpicName / storyEpicColorResult` per story and passes to `StoryHeaderRow`
- Non-virtualized fallback path (jsdom/SSR): same derivation pattern, passes props to `StoryHeaderRow`
- Sticky overlay `StoryHeaderRow`: passes epic props derived inline from `stickyHeader.story`
- `<VirtualizedSwimlanes>` JSX: receives `epicNameMap`, `epicColorMap`, `epicLinkFieldKey`

## Verification

- TypeScript compiles clean (`npx tsc --noEmit` — zero errors)
- Epic pill renders only when `epicKey && epicName && epicColorResult` are all truthy (no layout shift when no epic link)
- Pill uses `epicColorToTailwind` — same function as BacklogRow and EpicsPage
- Clicking the pill calls `setSelectedIssueKey(epicKey)` — opens the epic's detail sheet
- Both virtualized rows (`renderSwimlane`) and sticky overlay header wired

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: taskflow/src/routes/dashboard/StoryHeaderRow.tsx
- FOUND: taskflow/src/routes/dashboard/SprintBoardTab.tsx
- FOUND commit: 437a53f (StoryHeaderRow)
- FOUND commit: 21978e0 (SprintBoardTab)
- TypeScript: 0 errors
