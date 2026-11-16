---
phase: 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
plan: 09
subsystem: releases-list
tags: [releases, agenda, f5, ui]
requires: [93-07]
provides:
  - ambient-curves.tsx (AMBIENT_CURVES, AmbientCurves) shared by dashboard and Releases hero
  - ReleasesHero, ReleaseAgenda (+ ReleaseAgendaParts), ReleasedPanel presentational components
affects: [93-10]
key-files:
  created:
    - taskflow/src/components/ambient-curves.tsx
    - taskflow/src/routes/dashboard/releases-list/ReleasesHero.tsx
    - taskflow/src/routes/dashboard/releases-list/ReleasesHero.test.tsx
    - taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.tsx
    - taskflow/src/routes/dashboard/releases-list/ReleaseAgendaParts.tsx
    - taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.test.tsx
    - taskflow/src/routes/dashboard/releases-list/ReleasedPanel.tsx
    - taskflow/src/routes/dashboard/releases-list/ReleasedPanel.test.tsx
  modified:
    - taskflow/src/routes/dashboard/index.tsx
decisions:
  - "Issues-slot wrapper classes (height and gap) are fixed per variant, never per data state, so rows do not shift when breakdowns arrive (D-09)"
metrics:
  completed: 2026-10-29
  tasks: 3
---

# Phase 93 Plan 09: F5 hero, agenda rail and Released panel Summary

F5 presentational pieces rendered from the 93-07 agenda model: dashboard-style hero with shared ambient curves, agenda rail with hollow ring dots, TODAY line, month dividers, a prominent next-release card, a shared 150/70/100 column system, and a separate muted Released panel.

## Commits
- 2f627e84: releases hero with shared ambient curves (dashboard hero refactored to `<AmbientCurves />`, 8 tests)
- c0ec3e20: F5 agenda rail and next-release card (13 tests, including the D-09 loading-to-loaded stability case)
- 484b11e2: released panel (6 tests)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Issues slot wrapper gap differed by data state**
- **Found during:** Task 2 (the D-09 stability test failed on first run)
- **Issue:** wrapper added `gap-2`/`gap-3` only in the started state, so wrapper classes changed once data arrived
- **Fix:** the gap is now set on the wrapper by variant, identical in every state
- **Files modified:** ReleaseAgendaParts.tsx

**2. [Setup]** The worktree base was reset to the specified commit 40052714 (it started on a different base). node_modules was symlinked.

The `.claude/skills/sketch-findings-taskflow` references were read from the main checkout by absolute path, since `.claude/` is absent in worktrees.

## Known Stubs
None.

## Threat Flags
None. Text children and attributes only; no `dangerouslySetInnerHTML`; fixtures use placeholder names.

## Self-Check: PASSED
Hero, agenda and panel tests pass; tsc and biome clean on touched files; full vitest suite passed in the pre-commit hook.
