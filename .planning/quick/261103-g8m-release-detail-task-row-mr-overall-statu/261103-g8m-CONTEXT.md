# Quick Task 261103-g8m: Release detail task row — MR overall status + details popover - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning

<domain>
## Task Boundary

On the release detail page (`taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx`), the primary task table's MR cell (`TaskMrCell`) currently shows ONE selected MR (`selectDisplayMr`): GitMerge `!iid` link (opens GitLab) + outline state badge + `+N` marker for the others, followed by BR/MS drift cells (with inline Retarget / Assign-milestone fix actions) for that one MR.

Replace this with an OVERALL status for all the task's MRs on the row, and move per-MR details (iid, title, author, links, per-MR drift + fixes) behind a popover. Scope: the primary task table row only. The secondary (uncovered-MRs) table / `MrSubLine` is out of scope unless trivially shared.

</domain>

<decisions>
## Implementation Decisions

### Row status display — Segmented state dots
- One small coloured dot per MR (state colour: merged green / opened blue / closed grey — reuse the existing state colour mapping), followed by a short label.
- Label examples: all merged → `merged`; mixed → `1/2 merged`; single open → `open`; all open → `open` (or `2 open`) — the label summarises progress toward merged.
- No `!iid`, no MR title, no direct GitLab link on the row.
- With many MRs, dots must not blow the column width (cap visible dots, e.g. >4 → collapse into a count). One row = one line at every density.
- The existing empty/loading/failed/unavailable slot states (`mr-slot-pending`, `mr-slot-failed`, `mr-slot-none`, `mr-slot-unavailable`) stay as they are.

### BR/MS columns — aggregate on row, fixes in popover
- The row keeps the BR and MS columns but shows the WORST state across all the task's MRs (flag if any MR is flagged; ok only if all evaluated are ok; na when none evaluable).
- The inline fix buttons move OUT of the row into the popover (one action per MR, per column).
- Clicking a flagged aggregate BR/MS cell opens the same popover (so the flag remains actionable from the row).

### Detail surface — popover anchored to the cell
- Clicking the status chip opens a popover listing every MR on the task: `!iid`, title, author, state, BR/MS mark with its fix action (existing `DriftActionCell` behaviour/state incl. sticky failure), and an open-in-GitLab link (keep `LinkContextMenu` + `openExternal`).
- Must coexist with the row's full-row overlay button (sibling-overlay convention: the trigger needs `pointer-events-auto relative z-10`, stopPropagation so the row doesn't open the issue peek).

### Single MR — same chip + popover
- A task with one MR uses the same dot chip + popover; no special-case direct link.

### Claude's Discretion
- Exact dot size/spacing, label wording, popover layout (should follow existing popover styling in the app, compact, overflow-safe — see memory: release-detail prefs: squarish label pills, overflow-safe action tables).
- Ordering of MRs in the popover (suggest flagged first, then open, then merged; iid desc).
- Whether the active category filter (UAT-91.1-B, `mrs` vs `allMrs`) restricts popover contents — row aggregate should describe the task (allMrs) while highlighting filter matches is optional; keep the WR-08 rationale intact.
- Accessibility: chip is a real button with aria-label summarising states (e.g. "2 merge requests: 1 merged, 1 open — show details").

</decisions>

<specifics>
## Specific Ideas

User-selected preview:
```
●● merged
●○ 1/2 merged
○  open
```
BR/MS preview:
```
Row:  ●○ 1/2 merged   ⚠   ✓
Popover:
  !42 merged  Fix login   BR —   MS ✓
  !57 open    Fix logout  BR ⚠[Retarget]  MS ✓
```

</specifics>

<canonical_refs>
## Canonical References

- `taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx` — `TaskMrCell`, `selectDisplayMr`, `DriftCellSlot`, `TaskRow`
- `taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx` — existing tests on mr-cell-link / mr-extra-count / drift-br / drift-ms testids
- Project skill `sketch-findings-taskflow` (release detail design)

</canonical_refs>
