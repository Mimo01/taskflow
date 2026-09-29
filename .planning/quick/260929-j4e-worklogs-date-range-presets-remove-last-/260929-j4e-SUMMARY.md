# Quick 260929-j4e: Worklogs date range presets Summary

Worklogs presets are now This Week, Last 7 Days, This Month, Last Month (rolling, month-end clamped), Custom; legacy saved filters fall back to This Week.

## Commits
- 10f84e30 feat: pure range helpers module + tests (`taskflow/src/lib/worklog-date-ranges.ts`)
- a3ff085a feat: DatePreset union swap, `normalizeDatePreset`, tempo-filters store v2 migrate, WorklogsPage + tests

## Key changes
- New ids `last-7-days`, `last-month-to-date` (old `last-month` id not reused so legacy values migrate unambiguously).
- Store persist version 2 maps saved filter presets through `normalizeDatePreset`; page also normalizes in `handleLoadFilter` and has a switch `default`.
- Removed page-private helpers (`localISO`, last-week, last-month, last-working-day). `standup-date.ts` untouched.

## Deviations from Plan
- Used the `@/lib/worklog-date-ranges` alias in WorklogsPage (per plan-checker note).
- node_modules symlinked from the main repo checkout into the worktree (untracked, not committed).

## Verification
Full vitest suite (2850 pass), tsc, biome green via pre-commit on both commits.

## Self-Check: PASSED
