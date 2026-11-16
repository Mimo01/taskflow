---
phase: 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
plan: 08
subsystem: releases-list
tags: [timeline, release-list, f5, gap-closure]
requires: []
provides:
  - "lib/release-timeline.ts pure timeline model"
  - "ReleaseTimeline component (uncarded F5 graph)"
affects: [93-10]
tech-stack:
  added: []
  patterns: ["UTC date-key arithmetic", "ResizeObserver-driven responsive window"]
key-files:
  created:
    - taskflow/src/lib/release-timeline.ts
    - taskflow/src/lib/release-timeline.test.ts
    - taskflow/src/routes/dashboard/releases-list/ReleaseTimeline.tsx
    - taskflow/src/routes/dashboard/releases-list/ReleaseTimeline.test.tsx
  modified: []
decisions:
  - "Chip lanes use three interval lanes with tops [4, 86, 45] and lane-0 fallback, per the approved sketch render"
metrics:
  completed: 2026-10-29
---

# Phase 93 Plan 08: Release Timeline Graph Summary

Responsive F5 release timeline: real-date axis, 3-8 week window from track width, collision-free chip lanes with the next release first, bar only on the next chip, Today/prev/next controls that disable rather than hide.

## Commits
- f4c1abd1 feat(93-08): release timeline model (17 tests)
- 3edec7a4 feat(93-08): ReleaseTimeline graph (F5) (11 tests)

## Deviations from Plan

- Worktree base was corrected with `git reset --hard d82d46d5` at startup, as the startup check requires.
- One of my own test expectations was wrong (weeks=3 pan with no overdue starts from today-3, giving 2026-11-02); the test was fixed, not the code.
- The pre-commit full suite timed out twice on unrelated tests (IssueDetailSheet, EpicDetailSheet) under parallel-agent load; they pass on rerun. No code change.

## Known Stubs
None.

## Threat Flags
None. No dangerouslySetInnerHTML; names render as React text and title attributes only; fixtures use placeholder names.

## Self-Check: PASSED
