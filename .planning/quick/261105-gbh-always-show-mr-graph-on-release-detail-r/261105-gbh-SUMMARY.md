---
phase: quick-261105-gbh
plan: 01
subsystem: release-detail
tags: [release-detail, graphs, donut, layout]
requirements: [QUICK-261105-gbh]
key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusDonut.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusDonut.test.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseGraphGrid.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseGraphGrid.test.tsx
  modified:
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.test.tsx
    - taskflow/src/routes/dashboard/release-detail/releaseBuckets.ts
    - taskflow/src/routes/dashboard/release-detail/graphs/GraphSlot.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx
  deleted:
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.test.tsx
decisions:
  - BAND_MIN_WIDTH raised 1180 -> 1400 after screenshots (1280 made burnup and type waffle too tight)
  - Below 640px the grid is a single column (the 440 breakpoint became redundant because the donut pair fits side by side down to ~400)
completed: 2026-11-05
---

# Quick 261105-gbh: Always-on MR donut, By status ring donut, ReleaseGraphGrid

The MR donut is always rendered, with its state taken from the three-channel MR union rather than the milestone match. "By status" is now its own always-shown 3-slice ring donut (To do / In progress / Done). The two donuts sit side by side as a matched pair in a new `ReleaseGraphGrid` layout.

## Commits
- edeeba5d: By status ring donut (`statusDonutSlices`, `ReleaseStatusDonut`, shared `DonutCentre`, MR empty label "No merge requests yet")
- 16823db0: Always-on MR donut, `ReleaseGraphGrid`, removal of `ReleaseStatusRows`, `fitStatusRows`, `statusBarWidth` and the `release-mrs-none` paragraph
- 9f6b4402: Layout polish from screenshots (band threshold 1400, 2x2 right column floor)

## Behaviour
- `donutState`: not configured -> empty; union MR total > 0 -> ready; failed or unavailable channels -> error; drift loading or matched milestone without data -> loading; else empty. `MrLabels` shows whenever the state is ready.
- Status tooltip rows are exact Jira status names, at most 4 (a category with more than 4 statuses shows the top 3 plus "+N more"). No legend. Slice-click filtering was not built because AioDonut has no click support (per CONTEXT).
- Layout: band `[Burnup][Status | MRs][Type][Assignee]`; 2x2 `burnup | pair` then `assignee | type`; below 640px one column (burnup, pair, type, assignee) with the pair still side by side.

## Deviations
- [Rule 1 - layout] The first screenshot pass showed the 1280px band squeezed the burnup and wrapped the By type squares, and the 2x2 right column wrapped them too. Fixed by raising `BAND_MIN_WIDTH` to 1400 and changing the 2x2 columns to `minmax(0,1.2fr) | minmax(300px,1fr)`. Existing tests that used 1300px for the band now use 1500px.
- The plan's 640/440 two-step collapse became a single 640 collapse (the `@max-[440px]` class assertion was dropped from the test).
- Test fixtures that supply `milestoneMRs`/`releaseMrs` now also supply `mrDonutCounts`, matching the real hook, which derives the counts from the union.
- AioDonut was not changed; `DonutCentre` (in GraphSlot.tsx) gives both donuts identical centre typography.

## Known limitation
At exactly ~641px the By type waffle wraps its last square onto a second line (waffle capacity is capped by the cell width, existing behaviour); accepted.

## Screenshots (headless Chromium, placeholder fixture data)
Directory: /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/27871fa8-4f64-49e9-a38d-098a8969e145/scratchpad/261105-gbh/
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/27871fa8-4f64-49e9-a38d-098a8969e145/scratchpad/261105-gbh/w1440.png (band)
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/27871fa8-4f64-49e9-a38d-098a8969e145/scratchpad/261105-gbh/w1280.png (2x2)
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/27871fa8-4f64-49e9-a38d-098a8969e145/scratchpad/261105-gbh/w1180.png (2x2)
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/27871fa8-4f64-49e9-a38d-098a8969e145/scratchpad/261105-gbh/w900.png (2x2)
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/27871fa8-4f64-49e9-a38d-098a8969e145/scratchpad/261105-gbh/w700-forced641.png (2x2 at 641px)
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/27871fa8-4f64-49e9-a38d-098a8969e145/scratchpad/261105-gbh/w600.png (single column)
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/27871fa8-4f64-49e9-a38d-098a8969e145/scratchpad/261105-gbh/w500-forced400.png (container forced to 400px; headless window minimum is 500)
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/27871fa8-4f64-49e9-a38d-098a8969e145/scratchpad/261105-gbh/w1440-dark.png (dark theme)
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/27871fa8-4f64-49e9-a38d-098a8969e145/scratchpad/261105-gbh/w900-mrs-empty.png (MR slot empty state)

Preview files (`src/__preview`, `preview-release-graphs.html`) were deleted before the final code commit.

## Self-Check: PASSED
Commits edeeba5d, 16823db0, 9f6b4402 exist; full vitest, tsc and biome green on each; grep finds no `ReleaseStatusRows`, `fitStatusRows`, `statusBarWidth`, `release-mrs-none` or "in this milestone yet" in src.

## Final state after UAT (approved 2026-11-05)

The donut-pair design above was rejected at UAT ("two plain pie charts", band too tall at the 1400px cutoff) and reworked inline over several rounds. What shipped:

- **Band (from 1180px, BAND_MIN_WIDTH restored):** `[Progress][By status over By type][By assignee][Merge requests]`, identical for every release (data-driven re-pairing was tried in 96a343cb and removed in 121cae91 at the user's request).
- **By status:** `ReleaseStatusRows` rewritten as 3 rows (To do / In progress / Done) on By type's row geometry (84px name column + muted icons, 12px lines). Hover lists exact statuses (≤4, "+N more"); click toggles the Status filter for every status in the category. `ReleaseStatusDonut` deleted.
- **By type / By status counts:** fixed right-edge count column, aligned with By assignee.
- **By assignee:** `fitAssigneeRows` fills the height of the status/type stack (band) or the MR slot (2x2), never fewer than the old cap.
- **Merge requests:** always shown (state from the three-channel MR union, no milestone needed), last, in its own 190px+ column. In the band the ring grows to fill the column (120–160px, 12px margin, larger centre text from 150px); no text under it (a merged-count line and a task-coverage line were both rejected).
- **Progress:** in the band the plot fills the row height (`fill`, min 120px).
- **Loading skeleton:** `ReleaseDetailSkeleton` mirrors the new grid in every layout.

UAT commits: ab3120e7, 99b687e4, 2000fda0, 96a343cb, 121cae91, 8d8098c0, 31b44a63, 641abf9e.
