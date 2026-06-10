---
phase: quick-260610-ew2
plan: 01
subsystem: backlog
tags: [backlog, context-menu, rank, dnd]
requires:
  - resolveIntraRankFromDrop (existing drag rank math)
  - rankMutation (existing optimistic rank PUT path)
provides:
  - resolveSendToEdge pure helper (top/bottom → IntraSectionRank)
  - Send to top / Send to bottom context-menu items on backlog rows
affects:
  - taskflow/src/routes/dashboard/BacklogPage.tsx
  - taskflow/src/routes/dashboard/BacklogRow.tsx
tech-stack:
  added: []
  patterns:
    - "Synthesise drop overKey (first/last) to reuse drag's neighbour/position math — no hand-rolled rank logic"
key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/backlogDragHelpers.ts
    - taskflow/src/routes/dashboard/__tests__/backlogDragHelpers.test.ts
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx
decisions:
  - "resolveSendToEdge delegates to resolveIntraRankFromDrop so persisted rank == optimistic order, identical to drag"
  - "handleSendToEdge uses localOrder-aware base order (override ?? server keys), never touches sprint membership"
  - "Generic labels 'Send to top'/'Send to bottom' per CONTEXT; ArrowUpToLine/ArrowDownToLine icons (lucide, already a dep)"
metrics:
  duration: ~12m
  completed: 2026-06-10
---

# Quick 260610-ew2: Send story to top/bottom of section Summary

Right-clicking a backlog row now offers "Send to top" / "Send to bottom" which rerank the
story to the first/last position of its OWN section (its sprint or the backlog bucket),
persisted via the same optimistic `rankMutation` as drag-to-reorder — sprint membership never
changes.

## What Was Built

- **`resolveSendToEdge(currentKeys, activeKey, edge)`** in `backlogDragHelpers.ts`: a pure
  helper that synthesises the drop's `overKey` (first key for `top`, last for `bottom`) and
  delegates to the existing `resolveIntraRankFromDrop`, so the persisted Jira rank exactly
  matches the optimistic order. Returns `null` (no PUT) when the key is missing, the section
  has fewer than 2 rows, or the row is already at the chosen edge.
- **7 unit tests** extending the existing helper describe blocks (top, bottom, already-at-top
  no-op, already-at-bottom no-op, missing key, single-element section, rollback base parity).
- **`handleSendToEdge`** in `BacklogPage.tsx`: resolves the row's own section via
  `findSectionOfKey`, takes the same `localOrder.get(sectionId) ?? getSectionKeys(sectionId)`
  base order drag uses, and routes through `rankMutation.mutate` with the identical payload
  shape as `handleDragEnd`. No `addIssuesToSprint` / `moveIssuesToBacklog` on this path.
- **Prop plumbing** `onSendToTop` / `onSendToBottom` threaded
  BacklogPage → VirtualizedBacklogTable → BacklogRow.
- **Context-menu "Reorder" group** in `BacklogRow.tsx` with two items (icons
  `ArrowUpToLine` / `ArrowDownToLine`), separated from prior groups; the menu-render guard now
  includes the new callbacks so a row with only send-to-edge handlers still shows the menu.

## TDD Gate Compliance

Task 1 followed RED → GREEN:
- RED commit `adea9398` — `test(...)`: 7 failing tests (`resolveSendToEdge is not a function`).
- GREEN commit `fa368357` — `feat(...)`: helper added, all 46 helper tests pass.

## Verification

- `npx vitest run src/routes/dashboard/__tests__/backlogDragHelpers.test.ts` → 46/46 pass.
- `npm run check` (biome + tsc) → exit 0, baseline GREEN preserved.

## Deviations from Plan

**1. [Rule 3 - Blocking] Worktree had no `taskflow/node_modules`**
- **Found during:** Task 1 verification (vitest failed to load config — missing
  `@vitejs/plugin-react`).
- **Fix:** Symlinked the main checkout's installed `taskflow/node_modules` into the worktree
  (`ln -s /Users/mimo/Documents/Projects/taskflow/taskflow/node_modules node_modules`). Same
  lockfile, non-destructive, faster than a full reinstall. Confirmed `git check-ignore` covers
  it, so no stray untracked entry. No package install was performed.
- **Files modified:** none (environment only).
- **Commit:** n/a.

Otherwise the plan executed exactly as written.

## Self-Check: PASSED
- Files: all 4 modified files present.
- Commits: adea9398, fa368357, d2d90aeb, 43476ea6 all in history.
