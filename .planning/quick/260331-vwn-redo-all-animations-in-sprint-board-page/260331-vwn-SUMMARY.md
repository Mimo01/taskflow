---
phase: quick-260331-vwn
plan: 01
subsystem: sprint-board-ui
tags: [animation, css, sprint-board, ux]
dependency_graph:
  requires: []
  provides: [smooth-sprint-board-animations]
  affects: [SprintBoardTab, StoryHeaderRow, sheet]
tech_stack:
  added: []
  patterns: [css-grid-height-animation, opacity-transform-transition, base-ui-sheet-animation]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
    - taskflow/src/components/ui/sheet.tsx
decisions:
  - Used CSS grid-template-rows animation (0fr/1fr) for swimlane expand/collapse — avoids max-height issues and works with variable content height
  - Used opacity+translateY(-100%) for sticky header instead of max-height — eliminates layout thrash from max-height transitions
  - Used duration-[250ms] arbitrary value for sheet — duration-250 is not a valid Tailwind v4 class
  - Clear sticky header on VirtualizedSwimlanes re-mount AND on showSkeleton false transition — belt-and-suspenders approach for reload fix
metrics:
  duration: 15m
  completed: 2026-03-31
  tasks_completed: 2
  files_modified: 3
---

# Phase quick-260331-vwn Plan 01: Sprint Board Animation Overhaul Summary

**One-liner:** Replaced all jank-prone sprint board animations with CSS grid height transitions, opacity+transform sticky header, animated chevron rotation, and a smoother sheet slide.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix sticky header, swimlane collapse animation, reload bug | 2a298ac | SprintBoardTab.tsx, StoryHeaderRow.tsx |
| 2 | Improve sheet slide animation | 751e06b | sheet.tsx |

## What Was Built

### Task 1: SprintBoardTab + StoryHeaderRow

**Sticky header overlay** — Replaced `transition-[max-height,opacity]` with `transition-[opacity,transform]`. The hidden state is now `opacity:0 + translateY(-100%)` instead of `maxHeight:0px`. Eliminates layout thrash from max-height transitions and removes the flicker on show/hide.

**Swimlane expand/collapse** — Replaced `{isExpanded && (...)}` conditional rendering with a CSS grid height animation wrapper:
- Outer div: `grid transition-[grid-template-rows] duration-200 ease-out` with `gridTemplateRows: isExpanded ? '1fr' : '0fr'`
- Inner div: `overflow-hidden min-h-0` (overflow-hidden is critical — without it content leaks during collapse)
- Applied to both the virtual `renderSwimlane` path and the non-virtual fallback

**Reload fix** — Two layers of protection:
1. `prevShowSkeletonRef` tracks the `showSkeleton` transition; when it goes from `true` to `false`, `setStickyHeader(null)` is called — fires when data finishes loading
2. `VirtualizedSwimlanes` scroll effect now clears `lastStickyKeyRef` and calls `onStickyHeaderChange(null)` at the very start (before setting up the scroll listener) — fires on every component re-mount

**Chevron** — Replaced the conditional `ChevronDown`/`ChevronRight` swap with a single `ChevronRight` that rotates 90 degrees via `transition-transform duration-200` and `rotate-90` when expanded. Removed the unused `ChevronDown` import.

### Task 2: Sheet slide animation

- Translate distance increased from `2.5rem` to `5rem` for all four sides — gives a more visible, satisfying entrance
- Duration changed from `duration-200` to `duration-[250ms]` — slightly more deliberate feel
- Easing changed from `ease-in-out` to `ease-out` — snappier entry (deceleration curve for entrances feels more natural)
- Overlay backdrop duration left at `duration-150` — appears slightly faster than the sheet to establish context

## Deviations from Plan

### Constraint-driven changes

**1. [Constraint] Used `duration-[250ms]` instead of `duration-250`**
- Plan specified `duration-250` which is not a valid Tailwind v4 class
- Used `duration-[250ms]` arbitrary value as specified in the task constraints
- Files modified: taskflow/src/components/ui/sheet.tsx

No other deviations. Plan executed as written.

## Test Results

- TypeScript: compiles without errors (both tasks)
- SprintBoardTab.test.tsx: 20/20 tests pass

## Known Stubs

None.

## Self-Check: PASSED

- taskflow/src/routes/dashboard/SprintBoardTab.tsx — FOUND
- taskflow/src/routes/dashboard/StoryHeaderRow.tsx — FOUND
- taskflow/src/components/ui/sheet.tsx — FOUND
- Commit 2a298ac — FOUND
- Commit 751e06b — FOUND
