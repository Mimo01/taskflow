---
phase: quick-261103-kbn
plan: 01
subsystem: release-detail
tags: [burnup, release-detail, recharts]
requires: []
provides: [deriveBurnupFrame, burnup frame mode]
affects: [ReleaseBurnup, ReleaseTimeline, useReleaseDetail, ReleaseDetailPage]
tech-stack:
  added: []
  patterns: [same-chart empty frame instead of a separate placeholder component]
key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/release-detail/releaseBurnup.ts
    - taskflow/src/routes/dashboard/release-detail/releaseBurnup.test.ts
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.test.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.test.tsx
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  deleted:
    - taskflow/src/routes/dashboard/release-detail/releaseTrain.ts
    - taskflow/src/routes/dashboard/release-detail/releaseTrain.test.ts
decisions:
  - Frame (only) draws a faint ideal diagonal; real chart still has none (user decision overrides P94 D-04 for the frame)
  - Frame scope unit is issue count (summary.total), matching the burnup scope series
metrics:
  completed: 2026-11-03
  tasks: 3
---

# Quick 261103-kbn: Empty burnup frame replaces release train Summary

When an upcoming release has fewer than 2 days of history, it now gets the real burnup chart drawn empty: a dashed flat scope line at today's issue count, a faint ideal diagonal ending on the RELEASE marker, the TODAY line and band once the window is open, and an "opens in N d" caption while it is not. The release train from 261103-jqy is gone.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1. deriveBurnupFrame helper | 61e45486 | 5 test cases (not open, open, null cases, scope 0, DST) |
| 2. Frame mode + remove train | 6b22bfd3 | 4 train files restored from 843129a1~1, releaseTrain.* deleted |
| 3. Screenshot verification | (no commit) | No defects found; throwaway preview removed |

## Verification

- tsc clean; biome clean on touched files; the full vitest suite passed through the pre-commit hook (4354 passed).
- `grep -rn "releaseTrain\|summary\.train\|TrainTrack" taskflow/src` returns nothing.
- `git diff -w HEAD~1 HEAD -- ReleaseBurnup.tsx`: the real path only gains `showFrame`-gated conditionals. No children were reordered and no props changed. The data prop now goes through a typed `chartData` const, which is `plotted` when not in frame mode.
- Screenshot `/private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/f1187303-433b-4a01-9d0b-72d61962703b/scratchpad/kbn-frame.png` covers (a) not yet open, (b) window open with 1 point, and (c) the real chart, each at 260/420px in light and dark. The frame shares axes, ticks and the RELEASE label with the real chart. The ideal line meets the RELEASE line. The caption is on one line with the body height unchanged. The frame has no green and no dots, and the real chart is unchanged.

## Deviations from Plan

- [Rule 3 - Blocking] Recharts typing rejected `frame.points | plotted` as ComposedChart data. Added a `chartData: readonly (BurnupPoint | BurnupFramePoint)[]` const. This is a type-only change with no effect on behaviour.
- TDD: following the hook constraint, test and implementation went into one commit, so no separate RED run was recorded for Task 1.

## Known Stubs

None.

## Self-Check: PASSED
- Commits 61e45486 and 6b22bfd3 exist on worktree-agent-a1e273437521f00f6.
- The screenshot file exists. The throwaway preview files and the node_modules symlink have been removed.
