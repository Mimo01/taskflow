---
phase: quick-260606-o5y
plan: 01
subsystem: sprint-board
tags: [peek, story-header, ui, a11y]
requires: [TaskCard PEEK-01/PEEK-05 split pattern]
provides:
  - StoryHeaderRow onOpenIssue prop (div[role=button] peek target + inner key button split)
  - All 3 StoryHeaderRow sites wired with onOpenIssue
affects:
  - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
tech-stack:
  added: []
  patterns:
    - "PEEK-01/PEEK-05 key/body split (mirrored from TaskCard.tsx)"
    - "rowInner fragment + branched outer wrapper (static role=button vs plain div) for clean biome a11y suppression"
key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
decisions:
  - "Used two static outer-wrapper branches (split vs degraded) instead of one conditional-attribute div, so biome's useSemanticElements suppression applies cleanly and no noStaticElementInteractions/unused-suppression warnings fire"
metrics:
  duration: ~12m
  completed: 2026-06-06
  tasks: 2
  files: 2
requirements: [PEEK-01, PEEK-05]
---

# Phase quick-260606-o5y Plan 01: Story Rows Open Issue Peek Summary

Story swimlane header rows on the sprint board now open the issue peek panel on body
click (PEEK-01) while the issue key still navigates to the full /issue/KEY page
(PEEK-05) — a near-mechanical port of TaskCard's key/body split into StoryHeaderRow,
wired at all three call sites including the sticky overlay.

## What Was Built

**Task 1 — StoryHeaderRow.tsx** (commit `743a2d82`, refined in `0ec11e41`):
- Added optional `onOpenIssue?: (key: string) => void` prop and `useKeyBodySplit = !!onOpenIssue` switch.
- Outer row wrapper now branches into a static `div[role=button]` peek target
  (split path) vs. a plain non-interactive `<div>` (degraded path), with the row
  body contents extracted into a shared `rowInner` fragment.
- The split-path div has `role="button"`, `tabIndex={0}`, `onClick → onOpenIssue(storyKey)`,
  and `onKeyDown` handling Enter/Space (`preventDefault` + `onOpenIssue`). `cursor-pointer`
  added only in the split path.
- Issue key demoted to an inner `<button>` calling `onOpenDetail(storyKey)` with
  `e.stopPropagation()` (PEEK-05); summary is now a plain `<span>` whose clicks bubble
  to the body → peek.
- Chevron `onClick` gained `e.stopPropagation()` so expand/collapse no longer leaks a peek-open.
- Epic pill already had `stopPropagation` (unchanged). ContextMenu wrapping, assignee
  block, status badge, subtask count, transitionError all unchanged.
- JSDoc updated to document the body→peek / key→full-page behavior.

**Task 2 — SprintBoardTab.tsx** (commit `0ec11e41`):
- Added `onOpenIssue={onOpenIssue}` to all three `StoryHeaderRow` instantiations
  (in-list virtualized x2 + sticky overlay), immediately after `onOpenDetail={setSelectedIssueKey}`.
- Total `onOpenIssue={onOpenIssue}` occurrences in the file is now 8 (4 prior card sites + 3 story-row sites + 1 other card site).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Biome warning] Outer wrapper restructured to keep baseline GREEN**
- **Found during:** Task 2 (`npm run check`)
- **Issue:** The plan's literal instruction (convert the single outer `<div>` to a
  peek target with conditional `role`/handlers) produced two biome warnings:
  `noStaticElementInteractions` (biome can't see `role="button"` when it's a
  conditional expression) and `suppressions/unused` (the `useSemanticElements`
  ignore had no static `role="button"` to attach to). The constraint requires the
  Biome baseline stay fully GREEN with no warnings.
- **Fix:** Mirrored TaskCard's actual structure more faithfully — extracted the row
  body into a `rowInner` fragment and branched the outer wrapper into a static
  `div[role=button]` (split path) vs. a plain `<div>` (degraded path). With a static
  `role="button"`, biome treats the div as a semantic button: the `useSemanticElements`
  suppression applies cleanly and `noStaticElementInteractions` no longer fires (no
  extra suppression needed, matching TaskCard).
- **Files modified:** taskflow/src/routes/dashboard/StoryHeaderRow.tsx
- **Commit:** `0ec11e41`

## Verification

- `npm run check` (biome check + tsc): GREEN, 0 warnings, 461 files checked.
- StoryHeaderRow.tsx contains `onOpenIssue`, the `useSemanticElements` biome-ignore
  comment, and 3 `e.stopPropagation()` calls (chevron, key button, epic pill).
- `grep -c 'onOpenIssue={onOpenIssue}' SprintBoardTab.tsx` = 8 (>= 7 required).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: taskflow/src/routes/dashboard/StoryHeaderRow.tsx
- FOUND: taskflow/src/routes/dashboard/SprintBoardTab.tsx
- FOUND commit: 743a2d82
- FOUND commit: 0ec11e41
