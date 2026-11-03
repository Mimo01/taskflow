---
status: complete
phase: quick-261103-g8m
plan: 01
completed: 2026-11-03
commits: [cbfa3cfe, 8491ffd1, 86822781]
key-files:
  modified:
    - taskflow/src/components/ui/popover.tsx
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
---

# Quick 261103-g8m: Release detail task row MR overall status

The primary task row now shows one chip for all of the task's MRs: state dots plus a short progress label. The BR and MS cells show the worst mark across every MR. Per-MR details and fixes moved into a popover that the chip or a flagged aggregate opens.

## What changed

- `popover.tsx`: `PopoverContent` accepts optional `keepMounted` (to Portal) and `side`/`align`/`sideOffset` (to Positioner). Existing callers are unaffected.
- `UnifiedTaskTable.tsx`:
  - New helpers `aggregateMark` and `mrStatusSummary` (both exported) and `mrStateDotClass` (module-private).
  - `TaskMrCell` rewritten as chip (`mr-status-chip`), aggregate `task-drift-br` / `task-drift-ms`, and one popover per row with lazy keepMounted.
  - The popover lists all MRs, sorted flagged, then opened, merged, closed, iid descending. Each line has `!iid` (LinkContextMenu + openExternal), state badge, title, author, and per-MR `DriftActionCell`s (`drift-br` / `drift-ms`) keyed by `mr.id`.
  - Deleted `selectDisplayMr`, the `+N` marker, `mr-cell-link`, `mr-extra-count`, the GitMerge import, and stale comments.
  - The `TOOLTIP_SURFACE` and `Popover*` imports are added.
- Tests: 160 tests in `UnifiedTaskTable.test.tsx`, up from 166 before. The selection and `+N` tests were replaced and the per-MR action tests now open the popover first. New tests cover aggregateMark, mrStatusSummary, sticky failure across close/reopen, overlay coexistence, `group/row`, and the 3-dot + `+N` cap. The full suite passed on each commit through the pre-commit hook.

## Deviations from Plan

- **Extra testids (small addition):** `data-testid="mr-popover"` on `PopoverContent` and `mr-popover-line` on each `li`, for test targeting. No behaviour change.
- **Task 1:** `mrStateDotClass` was temporarily exported because tsc flags an unused function (TS6133) before Task 2 uses it. It is private again in Task 2.
- **Task 2 test helper:** `openMrPopover` is idempotent (it skips the click if `aria-expanded="true"`) and returns the visible popover. Several rows can have a hidden keepMounted popover at once.
- **Test-only fix (a11y test):** the focus test now waits for the popup to claim its initial focus before focusing the cell. Without that wait it failed intermittently in the full-file run, because Base UI moves focus asynchronously. No production code was bent.
- **Task 3 merged into the earlier commits:** many of its behaviours (sibling/overlay, no peek, flagged ordering, aria-label) were already covered by the migrated tests in Task 2. Task 3 added the close/reopen sticky-failure test, `group/row`, scroller `relative`, the dot cap, and ok-aggregate inertness. No production bug was found.
- Open question 1 (mirror the red error on the row while closed): resolved as planned. The row shows the orange flag, and the red retry waits in the popover.

## Known Stubs

None.

## UAT (from plan, for the user)

1. Row reads e.g. `●○ 1/2 merged` on one line at wide, <=860px and <=520px widths. At <=520px the MR column is hidden and a flagged BR/MS still opens the popover.
2. A flagged BR opens the popover; the Retarget icon shows on line hover.
3. Right-click on `!iid` in the popover opens the LinkContextMenu. Check whether the popover closes (Research A2). The failure state survives either way.
4. Clicking elsewhere on the row still opens the issue peek.

## Self-Check: PASSED

Commits cbfa3cfe, 8491ffd1 and 86822781 exist. Biome and tsc are clean on the touched files. The release-detail suite (714 tests) passes.

## UAT polish (2026-11-03, approved)

User-driven iterations after the initial build; final shipped design:

- **Task columns:** Key / Summary / MRs / BR / MS / Status / Assignee (Status beside Assignee).
- **Row MR status:** constant 5rem column. A mix of live states draws a 16px segmented ring (merged green, open blue, draft grey) with the merged/live count (`1/2`). When every MR shares one state there is no ring; the row shows that state's glyph and a word (✓ Merged, Open / Draft / Closed icons). Closed MRs never count in the ring or the number. Labels use sentence case. Slot states are a 16px glyph plus one word: spinner, Unknown, No MR, No MS.
- **Popover:** 40rem, styled like the Notifications popover. Each MR line shows the state glyph and word, `!iid`, the title with the leading task key stripped, the author avatar and full name, and BR/MS. Lines are sorted by MR number ascending and never reorder.
- **Uncovered-MRs table:** the MR state column uses the same glyph and word style (locked shows as Closed).
- **Row BR/MS:**
  - One MR: the cell fixes that MR in place.
  - Several MRs: clicking fixes every flagged MR in the column (`useMrGroupFix`: parallel writes, rollback for the failed ones only, sticky "N of M failed — click to retry"). The hover glyph is ListChecks.
  - A flag that can't be auto-fixed: the cell opens the popover.
- **Bug fixed during UAT:** the row cell unmounted when the optimistic patch flipped its mark, which lost the spinner and the sticky failure. `RowDriftCell` now branches on the task's shape and fix readiness, never on the live mark. A regression test was proven to fail on the old code.

Final commits: cbfa3cfe … 0c3c3c58 (see git log `quick-261103-g8m`).
