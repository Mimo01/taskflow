---
phase: quick
plan: 260609-cmd
subsystem: command-palette
tags: [navigation, ux, full-page]
dependency_graph:
  requires: []
  provides: [command-palette full-page issue navigation]
  affects: [CommandPalette.tsx]
tech_stack:
  added: []
  patterns: [onIssueClick full-page routing]
key_files:
  modified:
    - taskflow/src/components/app/CommandPalette.tsx
    - taskflow/src/components/app/CommandPalette.test.tsx
decisions:
  - handleIssueSelect routes to onIssueClick (full-page) not onOpenIssue (peek) — consistent with key-button behavior already in place
metrics:
  duration: ~5min
  completed: 2026-06-09
---

# Phase quick Plan 260609-cmd: CommandPalette Full-Page Issue Navigation Summary

**One-liner:** Command palette body-click and recent-item selection now route to full-page issue detail via `onIssueClick` instead of the peek panel via `onOpenIssue`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Route all issue selections to full-page navigation | 36c44c7f | CommandPalette.tsx |
| 2 | Update PALETTE-02 test to assert full-page navigation | 765b6c65 | CommandPalette.test.tsx |

## What Was Built

`handleIssueSelect` in `CommandPalette.tsx` previously called `onOpenIssue(issueKey)` (peek panel). Changed to `onIssueClick?.(issueKey)` (full-page detail). This affects:

- Issue rows in the "Issues" group (search state)
- Direct Match group results
- Live Jira search results
- Closed Jira search results
- Recent-item Jira entries (default state) — these call `handleIssueSelect(item.id)` so they get full-page automatically

The `handleIssueKeyClick` function (key-button click) was already correct and untouched. The `onOpenIssue` prop is retained in the interface as other consumers still pass it.

PALETTE-02 test updated to assert `onIssueClick` called with `'TEST-1'` and `onOpenIssue` NOT called on body click. 17/17 tests pass.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `taskflow/src/components/app/CommandPalette.tsx` modified (handleIssueSelect updated)
- [x] `taskflow/src/components/app/CommandPalette.test.tsx` modified (PALETTE-02 assertions flipped)
- [x] Commit 36c44c7f exists
- [x] Commit 765b6c65 exists
- [x] 17/17 CommandPalette tests pass

## Self-Check: PASSED
