---
phase: quick-261102-u5r
plan: 01
subsystem: release-detail
tags: [burnup, timeline, release-detail, ui]
key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseProgressHeader.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseProgressHeader.test.tsx
  modified:
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/burnupLabelLayout.ts
    - taskflow/src/components/release/ReleaseIssueGraph.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
    - taskflow/src/routes/dashboard/release-detail/releaseBuckets.ts
metrics:
  completed: 2026-11-02
  tasks: 3
---

# Quick 261102-u5r: Release detail Progress graph redo

Shared countdown-only header above both burnup chart and thin-history timeline, marker-only burnup labels with a taller compact plot, and a tooltip-free top done bar.

## Commits
- e65e8b7c Task 1: ReleaseProgressHeader (countdown only, one line), track-only ReleaseTimeline (no justify-evenly/absolute wrapper, h-12, 10px uppercase markers), header rendered in both ReleaseBurnup states.
- 47e9985d Task 2: removed end labels and all end-label layout code; MarkerLabel has `kind` ('today'|'release'|'both'); TODAY foreground / RELEASE muted; BURNUP_MARGIN.right 40 -> 12; compact plot min 110 -> 150px (slot height 178).
- 210ca2ec Task 3: ReleaseIssueGraph bar has no tooltip (role=img + aria-label kept); removed statusNames and statusNameSummary everywhere; releaseTooltipRows left in lib.

## Deviations from Plan
None in production code. Notes:
- Tailwind needs a literal class, so `min-h-[150px]` is written literally alongside `COMPACT_PLOT_MIN = 150`.
- `layoutBurnupLabels` still returns `{ markers }` (kept the object shape).
- The marker property test now also asserts labels sit inside the top band above the plot.

## Verification
Each commit passed the pre-commit hook (biome, tsc, full vitest). Not visually UATed; user will do so.

## Self-Check: PASSED
