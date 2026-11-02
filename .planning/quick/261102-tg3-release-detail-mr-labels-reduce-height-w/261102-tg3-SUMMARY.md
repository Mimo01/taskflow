# Quick 261102-tg3 Summary

MrLabels now renders a column-major CSS grid (`grid-flow-col`, `gridTemplateRows: repeat(min(n,5), auto)`, 9.5rem-capped column tracks), so many labels flow into extra columns instead of growing taller than the 120px donut. All pills and the "No label" pill (now the last grid item, separator wrapper removed) stay visible.

- Commit: 948cc5b8
- Files: taskflow/src/routes/dashboard/release-detail/graphs/MrLabels.tsx, MrLabels.test.tsx
- Tests: added row-cap and fewer-than-5 row tests; full suite, biome and tsc pass.
- Deviations: rows clamped with Math.max(1, ...) to avoid invalid `repeat(0, auto)` in the all-labelled state. Worktree was reset to base 90d96d27 per branch check.
