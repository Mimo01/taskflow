# Quick Task 261102-fkr Summary

Release-detail "Not covered by tasks above" rows now show a reason pill, MR author, all reviewers and an Open/Draft/Merged/Closed/Locked pill. The section header shows a total count and per-reason chips computed from `filteredSecondaryRows`.

Commit: 29360ad5

## Files
- taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
- taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
- taskflow/src/services/gitlab.ts (`reviewers[].avatar_url?` added to the type)

## Verification
- UnifiedTaskTable tests: 123/123 pass. The pre-commit hook ran the full suite: 4156 pass.
- `tsc` clean. `biome check` clean on the three touched files.
- No existing test asserted the dropped row title `author — state`.
- No AlertTriangle remains inside `secondary-key-flagged`. The two remaining uses near it are the header badges.

## Deviations
- Tasks 1 and 2 were committed together as one commit. Both edit the same file and the pre-commit hook runs the full suite. The work for both tasks is complete.
- The reviewers cell has no `role="group"` or `aria-label`. Biome's `useSemanticElements` flagged `role="group"`, so the cell carries only `title="Reviewers: a, b"`.
- The row title was removed as planned.

## Known stubs
None.

## Self-Check: PASSED
