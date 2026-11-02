# Quick 261102-pk9: Exact date+time on hover - Summary

Added shared `exactDateTime(iso)` helper (lib/relative-time.ts) and applied it as `title` tooltips on Created/Updated (FieldsSection), comment created and "(edited)" (InlineComment), and worklog/changelog times. Due date untouched.

Commit: 6ef21fb1

## Deviations
- [Rule 3] Existing `ChangelogEntry.test.tsx` asserted the old `toLocaleString()` title; updated it to use `exactDateTime` (format changed to medium date + short time per plan).

Verification: full vitest suite (4211 tests), tsc, biome pass.
