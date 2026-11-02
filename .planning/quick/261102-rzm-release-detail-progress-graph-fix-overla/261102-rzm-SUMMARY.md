---
phase: quick-261102-rzm
plan: 01
subsystem: release-detail
tags: [recharts, svg-layout, burnup]
key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/graphs/burnupLabelLayout.ts
    - taskflow/src/routes/dashboard/release-detail/graphs/burnupLabelLayout.test.ts
  modified:
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.test.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.width.test.tsx
decisions:
  - "End labels live inside the plot box only; marker labels own the band above it, so the two can never collide"
  - "Same-day / too-close TODAY+RELEASE merge into one 'TODAY · RELEASE' label; otherwise split-anchored (left one end, right one start)"
  - "Flipped (left of last point) end labels sit above their own line; headroom above scope is now pixel-based"
  - "timeTicks gets the inner plot width, not the container width"
metrics:
  commits: [88d24fda]
  completed: 2026-11-02
---

# Quick 261102-rzm: Release detail Progress graph label overlap fix

One pure, property-tested `layoutBurnupLabels` (driven by the measured plot width AND height) replaces the ad-hoc `PLOT_PX=110` / `position:'top'` / `flip` logic in `ReleaseBurnup`.

## Matrix
37 scenarios (same-day / 1,2,3,5 days apart / released late / only TODAY / only RELEASE / neither / left-edge / right-edge / future release / scope==done small+large / done 0 / 1 of 2 / scope-1 / scope 1 / on-tick and near-top scope / 450-3 / 999-998 / 50-49 / ranges 1d, 2d, 2w, 3mo, 1y, year boundary / adversarial combos) x sheets 280/400/560/760/1100px at compact 110, 280/560/1100 at compact 200, 400 at compact 140, non-compact 400/1100, in light and dark. Contact sheets: `screenshots/before-*` and `screenshots/after-*` (placeholder data only).

## Failures before (confirmed in before sheets)
- TODAY/RELEASE labels overprinted each other: A1-A4, A6, B5, D1, D2, E1, E2, E4, E5, E6.
- TODAY label overprinted the scope end label (nearly every compact cell: A5, A7, B2, B3, C3, C5, C7-C11, D3-D6).
- End label clipped at right edge (E5 "1 scope · done"); end labels right of the last point at the axis end overflowed the 40px margin (B3, B5, D1, D2).
- "0 done" / "done" labels on the x tick row or on the lines at compact heights (C3, C6, E4).
- Hardcoded 110px plot used for spacing at 140/200px bands.

## After
All cells at 280/400/1100 compact 110, 280 compact 200 and 400 non-compact were viewed in light; dark was viewed at 1100 compact 110 (cropped). No overlaps, clipping or tick collisions seen. Remaining judgement calls: in very short compact plots (64px inner) the scope line is squashed slightly by the new pixel headroom; flipped end labels briefly mask a few px of the line behind their background rect only where scope history rises steeply (D5/B4); at 280px x ticks drop to 2-3 labels. Sheets for 560, 760, 140 and the other dark sizes were generated but not individually inspected (geometry is theme-independent).

## Deviations
- [Rule 1] `ReleaseBurnup.width.test.tsx` expected timeTicks to receive container width; updated to the inner plot width (intentional change, ticks previously over-counted by 80px).
- Headroom rule replaced (half-step when >80%) with a pixel-based one so a label above the scope line always fits; this was needed after a first layout pass put "scope" below its line in flipped cases.
- Property test loop uses a candidate-based search (not exhaustive 1px scan) for speed; full suite 4217 tests pass.

## Self-Check: PASSED
Commit 88d24fda exists; preview scaffolding deleted; git status clean except the quick dir.
