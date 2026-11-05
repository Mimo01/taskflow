# Quick 261105-g4u: Remove tooltip delay in release detail Summary

Release detail tooltips now open instantly: the three graph-row triggers use `delay={0}` and the burnup recharts tooltip has its 400ms slide animation turned off.

## Changes
- `rowToggle.tsx`: removed `ROW_TOOLTIP_DELAY` (600); kept `ROW_TOOLTIP_SIDE = 'right'`; JSDoc updated.
- `ReleaseStatusRows.tsx`, `ReleaseTypeWaffle.tsx`, `ReleaseAssigneeRows.tsx`: `delay={0}`, import cleaned.
- `ReleaseBurnup.tsx`: `isAnimationActive={false}` on `ChartTooltip`.
- Audit: every `TooltipTrigger` under release detail now passes `delay={0}`. Shared default of 150 in `components/ui/tooltip.tsx` is unchanged.

## Verification
tsc clean, biome clean on touched dir, full vitest suite passed (280 files) in the pre-commit hook.

## Deviations
- The worktree started on a different base than the requested one, so I reset it to a8df1156 as the branch check instructs. Otherwise none.

## Commit
- Both tasks in one commit (hash reported in the final reply).

## Self-Check: PASSED
