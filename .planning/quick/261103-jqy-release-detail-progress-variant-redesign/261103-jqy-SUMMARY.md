---
phase: quick-261103-jqy
plan: 01
subsystem: release-detail
tags: [release-detail, progress, timeline, ui]
requires: [previousVersion (releaseBurnup.ts), dateKeyMs]
provides: [deriveReleaseTrain, formatTrainSummary, placeTrainLabels, ReleaseTrain]
affects: [ReleaseTimeline, ReleaseBurnup aside, useReleaseDetail, ReleaseDetailPage]
tech-stack:
  added: []
  patterns: [pure derivation module + callback-ref ResizeObserver label layout]
key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/releaseTrain.ts
    - taskflow/src/routes/dashboard/release-detail/releaseTrain.test.ts
  modified:
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.test.tsx
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx
decisions:
  - "Release train window start uses previousVersion() so it matches the burnup axis start"
  - "Train labels are placed in pixels; edge-clamped labels anchor to their edge (left/right) so width-estimate error never pushes them outside the track"
  - "Window-start name gets priority 2 (above other ahead names) so 'R-11-17' survives collisions with intermediate versions"
metrics:
  duration: ~25m
  completed: 2026-11-03
---

# Quick 261103-jqy: Release detail Progress "Release train" variant Summary

The thin-history variant of the Progress slot now shows a release train for upcoming releases. TODAY is a filled dot on the left, and every unreleased dated version ahead is a proportionally placed tick. The previous version's tick is captioned "window opens", and the release's window segment is emphasised up to a hollow RELEASE ring on the right. A single muted line underneath reads "N releases ahead · window X d · in Y d". This fixes the old bug where TODAY was clamped onto the window start.

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | Pure `releaseTrain.ts`: `deriveReleaseTrain`, `formatTrainSummary`, `placeTrainLabels` (+13 tests) | 843129a1 |
| 2 | ReleaseTimeline renders the train when `summary.train` is set; the hook derives `releaseTrain`; the page threads `train` through `timelineSummary`; the aside reads "after <prev>" while the window is ahead | 37a4b9ff |
| 3 | Throwaway vite preview + headless screenshot at 260/420px, light + dark; files deleted (not committed) | n/a |

## Verification

- `vitest run src/routes/dashboard/release-detail src/routes/dashboard/ReleaseDetailPage`: 36 files, 772 tests pass. The full suite also passes in the pre-commit hook (4361 tests).
- `tsc --noEmit` is clean, and biome is clean on the touched files.
- The `ReleaseBurnup.tsx` diff touches only the `aside` (the `lead` word); the chart branch is byte-identical.
- Screenshot: `/private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/f1187303-433b-4a01-9d0b-72d61962703b/scratchpad/train.png`. It covers three cases (1 ahead; 3 ahead with two close together; window open) at 260px and 420px, light and dark. Nothing wraps, labels never overlap, colliding names are dropped while their ticks stay, and TODAY sits inside the window when the window is open.

## Deviations from Plan

- **Label placement detail:** `placeTrainLabels` also returns `x0/x1/align` so the renderer can pin clamped edge labels by their edge, not by an estimated width.
- **Label priority:** tick names use priority 2 for the window-start version and 1 for others. The plan specified priority 1 for all tick names; the change keeps the "window opens" name when intermediate versions collide with it.
- **Tooling:** the cached full Chromium could not be launched from this sandbox, so I used the Playwright `chromium_headless_shell-1223` binary instead (same engine).
- **Zero-length windows:** `formatTrainSummary` omits `window 0 d` (the plan says "omitting unknown or zero parts").

## Known Stubs

None.

## Self-Check: PASSED

- releaseTrain.ts and releaseTrain.test.ts exist; commits 843129a1 and 37a4b9ff are present on worktree-agent-a0854bb3aa63ff0e6.
- The throwaway preview files are removed and the working tree is clean.
