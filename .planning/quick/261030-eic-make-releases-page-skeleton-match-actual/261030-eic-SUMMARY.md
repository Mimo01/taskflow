---
phase: quick-261030-eic
plan: 01
tags: [releases, skeleton, layout-shift]
key-files:
  modified:
    - taskflow/src/routes/dashboard/ReleasesSkeleton.tsx
    - taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.tsx
    - taskflow/src/routes/dashboard/releases-list/ReleasesHero.tsx
    - taskflow/src/routes/dashboard/releases-list/ReleasesHero.test.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
  created:
    - taskflow/src/routes/dashboard/ReleasesSkeleton.test.tsx
completed: 2026-10-30
---

# Quick 261030-eic: Releases skeleton matches the loaded page

The Releases first-load skeleton now mirrors the loaded DOM: a Today row, two month labels, a Next-release card, one full row, three quiet rows, and a muted Released panel with 3 rows and a show-older line. It uses the shared `ROW_GRID`, `RAIL_LINE` and `LABEL_CLASS` constants, which are now exported from `ReleaseAgenda`. The header shows a summary-line placeholder while loading (`ReleasesHero` `loading` prop, wired from `ReleasesTab` via `showSkeleton`).

## Commits
- a8beefc8: skeleton rebuild and tests, shared constants exported
- 45842716: hero summary placeholder and tests

## Deviations from Plan
None. The wrapper-line-box placeholder technique was used throughout, and the pill skeleton is h-5 w-[5.5rem] to match STATUS_PILL_LAYOUT_CLASS (min-w-[5.5rem], text-xs plus py-0.5).

## Verification
Dashboard vitest suite, biome on touched files, and tsc are clean. No visual check was done in the app.

## Self-Check: PASSED
