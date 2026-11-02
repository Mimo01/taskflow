# Quick 261102-tg3 Summary

MrLabels now renders a column-major CSS grid (`grid-flow-col`, `gridTemplateRows: repeat(min(n,5), auto)`, 9.5rem-capped column tracks), so many labels flow into extra columns instead of growing taller than the 120px donut. All pills and the "No label" pill (now the last grid item, separator wrapper removed) stay visible.

- Commit: 948cc5b8
- Files: taskflow/src/routes/dashboard/release-detail/graphs/MrLabels.tsx, MrLabels.test.tsx
- Tests: added row-cap and fewer-than-5 row tests; full suite, biome and tsc pass.
- Deviations: rows clamped with Math.max(1, ...) to avoid invalid `repeat(0, auto)` in the all-labelled state. Worktree was reset to base 90d96d27 per branch check.

## Follow-ups (orchestrator, same session)

- `626b759b`: column tracks `fit-content(9.5rem)` instead of `minmax(0, 9.5rem)` (the latter grew every column to 9.5rem).
- `9a66bd64`: per user request "make No label special", the warning moved out of the grid into an orange "N MRs without label" banner on top spanning the block (soft tint, no outline, orange icon, bold count; still the unlabelled filter toggle). Grid row cap drops to 4 when the banner shows.
- Latest: a hairline `<hr>` divides the banner from the pills (block ≈121px vs 120px donut).
- `35336628`: banner restyled as an accent-bar callout (faint orange tint, 3px orange left bar, `rounded-r`), user-picked variant A of four rendered options.
- UAT approved 2026-11-02.
