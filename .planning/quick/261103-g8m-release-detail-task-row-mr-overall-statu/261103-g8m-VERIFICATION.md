---
phase: quick-261103-g8m
verified: 2026-11-03T00:00:00Z
status: human_needed
score: 8/8 must-haves verified
---

# Quick 261103-g8m Verification

**Goal:** release-detail task row shows overall MR status chip; details and fixes in a popover; aggregate BR/MS cells; single MR uses the same chip.

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dots (capped at 4 slots) plus short label, no !iid, title or link on the row | VERIFIED | `mrStatusSummary` and `mrStateDotClass` in UnifiedTaskTable.tsx. Chip at ~L1081. Zero hits for mr-cell-link, mr-extra-count or selectDisplayMr in src or tests. |
| 2 | Single MR uses the same chip and popover | VERIFIED | There is one has-MRs branch. Test at ~L2860 covers a lone merged MR. |
| 3 | Aggregate BR/MS come from allMrs (flag > ok > na) with no inline fix buttons | VERIFIED | L1057-1058 use `aggregateMark(allMrs...)`. Exported `aggregateMark` is unit-tested. |
| 4 | The popover lists every MR (iid link, state, title, author, per-MR BR/MS DriftActionCell) | VERIFIED | `MrPopoverLine`, `sortPopoverMrs`, and `ul.relative` with `li.group/row` (L1147-1201). |
| 5 | A flagged aggregate opens the same popover; ok/na stay inert | VERIFIED | `AggregateFlagTrigger` is a PopoverTrigger in the same Root. `DriftCellSlot interactive` is derived from the mark. |
| 6 | Chip and flagged aggregate clicks do not open the peek | VERIFIED | `stopPropagation` on both triggers; sibling-overlay classes `pointer-events-auto relative z-10`. |
| 7 | A failed fix persists across popover close and reopen | VERIFIED | `everOpened` state drives `keepMounted`, which `popover.tsx` forwards to Portal. A test at L2801 covers it. |
| 8 | pending/failed/none/unavailable slots are unchanged | VERIFIED | The branches are kept, and the release-detail tests pass. |

## Behavioral checks

- `npx vitest run src/routes/dashboard/release-detail/`: 33 files, 714 tests, all pass.
- `npx tsc --noEmit`: clean.
- `npx biome check` on the 3 touched files: clean.
- The 3 commits (cbfa3cfe, 8491ffd1, 86822781) touch only the 3 planned files.

## Anti-patterns

None found. No TBD/FIXME markers were added, and the stale comments were removed.

## Human verification required

1. **Visual one-line chip layout**
   - Test: open a release with a multi-MR task at wide, ≤860px and ≤520px widths.
   - Expected: the row reads like `●○ 1/2 merged` on one line. At ≤520px the flagged BR/MS still opens the popover.
   - Why human: layout and container queries are not checkable in jsdom.
2. **Popover behaviour in Tauri**
   - Test: right-click `!iid` in the popover (does the popover close?). Click a flagged BR. Click elsewhere on the row.
   - Expected: the LinkContextMenu opens, the popover opens, and the issue peek opens.
   - Why human: it needs a real webview and pointer behaviour.
