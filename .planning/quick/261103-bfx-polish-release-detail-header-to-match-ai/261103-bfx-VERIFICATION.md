---
phase: quick-261103-bfx
verified: 2026-11-03
status: passed
score: 7/7 must-haves verified
---

# Quick 261103-bfx Verification

Goal: release detail header matches AIO cycle detail; MR labels and the "N MRs without label" warning move to a full-width strip under the graphs; layout holds at band, 2x2, 640 and 440 container widths.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Labels and warning sit in their own full-width strip, not in the MR cell | VERIFIED | `ReleaseDetailPage.tsx` ~L530 renders `<MrLabels>` inside `release-stats`, after the graph grid. `ReleaseMrDonut` no longer imports `MrLabels`. |
| 2 | The chip comes first, then all pills with no cap; both toggle the filter with aria-pressed | VERIFIED | `MrLabels.tsx` renders the chip, then a hairline, then `labelSummary.map` with no cap. `UNLABELED_FILTER` is still exported and imported by `UnifiedTaskTable`. No `MAX_LABEL_ROWS` or `mr-labels-grid` remain in code. The only match is a `queryByTestId` null assertion in a test. |
| 3 | The MR cell is a ring only | VERIFIED | Screenshots at 1300 and 400 show the ring with no legend or labels. |
| 4 | Header, done bar, graphs and strip read as one bordered block | VERIFIED | `release-stats` has `border-y px-6 py-4`, and `ReleaseHeader` has `pt-3 pb-2`. |
| 5 | Meta stays two lines with the description below it | VERIFIED | `PropertyStrip` uses `mt-1` and the screenshots confirm the layout. |
| 6 | The title row never wraps, and actions go icon-only | VERIFIED | The title row is `flex items-center justify-between gap-3`. Actions are `flex-none`, and the "Refreshed" text carries `@max-[640px]/page:hidden`. At 400px the title truncates, the actions stay on the row, and the strip wraps with no overflow. |
| 7 | The skeleton mirrors the new geometry | VERIFIED | Changed in f17b6548, and its tests pass. |

## Behavioral checks
- `npx vitest run src/routes/dashboard/ReleaseDetailPage.test.tsx src/routes/dashboard/release-detail`: 33 files, 689 tests, all pass.
- The 32d0a85f commit adds class-contract tests for the responsive behaviour.
- Screenshots viewed: bfx-1300.png and bfx-400.png. The empty box in the graph slot is a mock placeholder, not a regression.
- No TODO, FIXME, TBD or XXX markers in the touched component files.

## Notes
- I viewed only the 1300 and 400 screenshots. The 1000 and 600 widths are covered by the class-contract tests only.
- I did not run tsc or biome. The pre-commit hook runs both and all three commits landed.

## Human verification
None required.
