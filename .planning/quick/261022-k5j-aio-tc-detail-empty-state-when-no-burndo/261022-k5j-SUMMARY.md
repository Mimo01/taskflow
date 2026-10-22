# Quick 261022-k5j Summary

Burndown section on the AIO cycle detail page now always renders; with no series it shows a compact empty state (neutral Hourglass badge, "Testing not started", "Burndown appears after the first execution"), or ClipboardList + "No test cases in this cycle" when the cycle has zero cases. The state fills the existing relative min-h body via `absolute inset-0`, so it adds no height.

## Changes
- CycleBurndown.tsx: `noCases` prop, `cycle-burndown-empty` branch replacing `return null`.
- CycleKpiTiles.tsx: removed the section gate, passes `noCases={runs?.length === 0}`, doc comment updated.
- CycleBurndown.test.tsx: 2 component tests, replaced the "hides the section" test, added a no-cases tile test.

## Commit
- 2dabcab2 fix(261022-k5j): burndown empty state before first execution

## Deviations
- Worktree base was off; reset to 6876b28e as instructed. Symlinked node_modules (untracked/ignored).
- Biome auto-reformatted one file (long subline line wrap).

## Verification
Full vitest suite (3805 passed), biome and tsc clean.
