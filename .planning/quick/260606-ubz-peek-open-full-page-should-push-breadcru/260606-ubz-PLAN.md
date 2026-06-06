---
quick_id: 260606-ubz
description: peek open-full-page should push breadcrumb
date: 2026-06-06
mode: quick (inline)
---

# Quick Task 260606-ubz: Peek "Open full page" should preserve breadcrumb

## Problem

The issue preview (peek panel) has an "Open full page" action. It navigates to
the full issue page correctly, but the user is left with no breadcrumb to return
to the page the peek was opened from.

## Root cause

`taskflow/src/main.tsx` — the peek's `onNavigateFull` handler called
`handleIssueClick(key, true)`. The second arg is `resetTrail`; `true` runs
`breadcrumbReset()` and pushes nothing, so the trail is wiped on navigation.
Every breadcrumb-preserving navigation calls `handleIssueClick(key)` (resetTrail
defaults to `false`), which pushes the source page (list route or parent issue)
onto the trail before navigating.

## Task

1. **`taskflow/src/main.tsx`** — change the `onNavigateFull` handler to call
   `handleIssueClick(key)` (drop `resetTrail=true`) so the source page is pushed
   onto the breadcrumb trail.
   - verify: `npx tsc --noEmit` passes; opening peek from a list page and
     clicking "Open full page" leaves a back breadcrumb to that list page.
   - done: peek → full page navigation preserves a return breadcrumb.
