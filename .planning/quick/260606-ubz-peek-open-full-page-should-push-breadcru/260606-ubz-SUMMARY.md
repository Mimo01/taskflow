---
quick_id: 260606-ubz
description: peek open-full-page should push breadcrumb
date: 2026-06-06
status: complete
mode: quick (inline)
---

# Summary — Quick Task 260606-ubz

## What changed

`taskflow/src/main.tsx` — the peek panel's `onNavigateFull` handler now calls
`handleIssueClick(key)` instead of `handleIssueClick(key, true)`. Dropping the
`resetTrail=true` argument lets the normal breadcrumb logic run: the source page
(list route via `routeLabel`, or the parent issue when drilling issue→issue) is
pushed onto the breadcrumb trail before navigating to `/issue/${key}`.

## Why

`resetTrail=true` ran `breadcrumbReset()` and pushed nothing, wiping the trail on
peek → full-page navigation. The full issue page then had no entry to navigate
back to the page the peek was opened from.

## Verification

- `npx tsc --noEmit` — passes (EXIT 0).
- Behavior: opening the peek from a list page (backlog/sprint board) and clicking
  "Open full page" now leaves a breadcrumb back to that list page; opening from an
  issue detail page pushes the parent issue.

## Files

- `taskflow/src/main.tsx` (peek `onNavigateFull` handler)
