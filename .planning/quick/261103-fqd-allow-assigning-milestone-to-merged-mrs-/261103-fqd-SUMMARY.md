---
phase: quick-261103-fqd
plan: 01
tags: [release-detail, drift, gitlab, milestone]
key-files:
  modified:
    - taskflow/src/routes/dashboard/release-detail/driftDetection.ts
    - taskflow/src/routes/dashboard/release-detail/driftDetection.test.ts
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
metrics:
  completed: 2026-11-03
---

# Quick 261103-fqd: Assign milestone to merged MRs Summary

Merged MRs now get a real MS drift mark and a clickable assign-milestone cell in release detail. BR stays an em dash, because GitLab rejects a retarget on a merged MR.

## Changes
- `driftDetection.ts`: new exported `isMilestoneEvaluated` (opened + merged). The merged branch of `buildDriftRows` computes `ms` and sets `flagged` from task or ms. Doc comments were updated.
- `UnifiedTaskTable.tsx`: BR is gated on `evaluated`, MS renders always, in both `MrSubLine` and `TaskMrCell`. `DriftActionCell` already renders an em dash for a `na` mark, so closed rows are unchanged.
- Tests: new `isMilestoneEvaluated` matrix, merged ms flag/ok/na cases, and the count helpers. The `261103-eu3` count test was rewritten as `261103-fqd`. The UI test covers the BR dash and the MS button with its mutation.

## Commits
- b15034bb: feat(261103-fqd) (both tasks, one commit because of the pre-commit full-suite hook)

## Deviations
- The two tasks were combined in one commit. The base reset to 48463907 was needed because the worktree started at an older commit. Otherwise none.

## Verification
Full vitest suite passed (4313 tests), tsc was clean, and biome was clean on the 4 touched files.
