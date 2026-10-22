# Quick 261014-crk: AIO cycle detail polish Summary

Execution Distribution donut beside a de-duplicated 2x2 tile grid, plus a Defect Summary with Status and Priority donuts, built on recharts 3.8 fixed-size `PieChart` (no Cell, no ResponsiveContainer).

## Commits
- 1ba1adb1: feat(261014-crk): aio cycle chart helpers (`lib/aio-cycle-charts.ts` + 13 unit tests)
- 2eef77bf: feat(261014-crk): execution distribution donut + de-duplicated cycle stats
- 8a27276c: feat(261014-crk): defect summary status + priority pies

## What changed
- `AioDonut.tsx` (shared donut + same-size ring skeleton), `ExecutionDonut.tsx` (160px, centre `executed/total`, loading ring, "No runs recorded" empty ring).
- `CycleKpiTiles.tsx`: tiles are Pass rate (pass/executed), Re-runs, Unlinked failures, Open defects in a fixed `grid-cols-2`; donut beside on `@3xl`, stacked below when narrow. Progress bar removed (`cycle-progress-bar` / `progress-seg-*` gone). `lastExecuted` prop dropped (header already shows it).
- `DefectSummary.tsx` replaces `SummaryStrip`: "Defect Summary" with Status (by category) and Priority (icon-severity colours) cards, plus the plain `Sev:` line. No centre count, no latest-run toggle. `severityOf` now lives here and is imported by `DefectsList`.
- Page tests updated to assert donut/tile testids and centre text instead of segment widths.

## Deviations
None of substance. The worktree had no `node_modules`; symlinked the main checkout's (gitignored) to run tests. The worktree was also reset to 9645fb7b per the branch check.

## UAT points
- FLAG: Pass rate is now passed/executed, not passed/total (de-duplication against the donut share). Cheap to revert.
- Check the not-run slice colour (gray-300) is readable against the card.
- A donut was rejected earlier on the cycles list dashboard (261013-l97); confirm it is wanted here.
- "Show only latest run" toggle intentionally omitted: defect data is already latest-run only (cycles.ts:588).
- No slice labels, only hover tooltips (at most 4 rows). Critical and Should share a colour (both use highest.svg).
- Narrow the window and confirm the donut stacks below the tiles.
- Hover tooltips on donut slices were not tested in jsdom; verify visually in the app.

## Known Stubs
None.

## Verification
Full vitest suite (3370 passed), tsc clean, biome clean on touched files (pre-commit ran on each commit).

## Self-Check: PASSED

## UAT polish rounds (2026-10-14) — APPROVED by user

Planned work (3 tasks, 1ba1adb1..8a27276c) was reworked inline over UAT; final approved state: 1ad49963, plus review follow-ups e3523b7f and final sizing/legend tweaks through f25174ab (approved).

| Commit(s) | Change |
|---|---|
| 760be34f | Layout bug: the container-query flex-row was on the container element itself (cannot restyle itself) so the donut never went beside the tiles; moved to an inner wrapper. Defect donuts in one row with a name/count key. |
| 3e333692, 46ddb7d3 | Defect donuts moved into the stats block (not duplicated in the Defects tab). |
| 0cd72acd, 0da6d0d5 | Tooltip hidden behind the donut centre label: explicit tooltip z-index above the overlay. |
| b0a69f1e, 4ba4747d (Fable design review) | Three headed sections (Cycle Statistics / Execution Distribution / Defect Summary); shared h3 heading style, donut sizing, reflow, skeletons. Critique in 261014-crk-DESIGN-REVIEW.md. |
| 355ca9c7, 0ca45c07, 476275cb, f37ed625 | Single row: tiles \| large execution donut \| stacked defect donuts; sizes/spacing/key width. |
| eb5456cc | Tiles now Pass rate, Ready to retest (failing cases whose defects are all Done), Unlinked failures, Re-runs. Open defects dropped (derivable from the status donut): no figure shown twice. |
| 03aea13d .. 047a2178, 169f49ad, 7a7178cf, 76b84a8e, 1ec406c6, 7cd63ad7 | Larger ambient icons (72px), distinct icon + tint per card chosen by rendering them cropped (top-right is clipped); neutral value colour; restored the "Unlinked failures" label clobbered by an icon find-and-replace (label assertions added). |
| 5b083f62, fc81e80f, 59abd365, 1ad49963 | Severity donut + removed the "Sev:" line from the Defects tab (column kept); severity shown as the label only ('Major', not '2-Major'), ordered by the number; key shows up to 5 entries (4 + "+N more"); defect donuts 76px. |

Notes
- Pass rate is passed/executed (was passed/total).
- "Show only latest run" toggle omitted: cycle defects are already latest-run only.
- Review follow-ups FIXED after approval (tests proven to fail pre-fix): unknown/missing Jira status category now counts as To Do in the status donut (WR-01/02); priority colour keys off the scheme level name first (Must/Should no longer grey), icon filename only as fallback (WR-03); "of N failing" on the Ready-to-retest / Unlinked tiles is derived from the runs list, the same source as their numerators (IN-03).
- Still open (minor): defect donuts have no loading skeleton for the severity block; defect key/tooltip row-key collision when a status is literally named "Other" (IN-02).
- Final sizing (f25174ab): execution donut 192px, defect donuts 68px stacked (Status, Priority, Severity); key capped at 3 rows (2 + "+N more", the 5-row experiment was reverted as too tall); loading skeleton shows all three defect donuts.
- The earlier "no loading skeleton for the severity block" open item is resolved.
