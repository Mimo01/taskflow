# Quick 261002-h9e: Enhance Changes tab with side-by-side diffs - Summary

Changes filter in issue-detail Activity now renders per-field-kind: collapsible Before|After word diff (jsdiff) for long text, Old -> New chips (with ∅ and status pills) for short fields, +/- token chips for multi-value fields, 5-minute same-author burst grouping, and an aligned icon/label column.

## Commits
- e10509b7 feat: changelogDiff helpers + tests; `diff@^9.0.0` added to dependencies
- 37251c7e feat: group-aware ChangelogEntry + tests; ActivityTimeline wired to groupChangeBursts

## Task 0
User approved `diff` (jsdiff) install; installed as runtime dependency.

## Deviations
- [Rule 1] Biome forbids shadowing global `toString`: renamed the helper param to `toStr` in changelogDiff.ts (no behavior change).
- Diff-column keys use cumulative char offset instead of array index (biome noArrayIndexKey).
- Ran `npm ci` in the worktree (no node_modules present); package-lock changes are only from the `diff` install.
- ActivityTimeline.test.tsx needed no change (mock still sufficient); `filterTimeline` import dropped from ActivityTimeline.

## Verification
Full vitest (3199 passed), tsc clean, biome clean on touched files, no dangerouslySetInnerHTML in ChangelogEntry.tsx. Manual in-app check not performed.

## Self-Check: PASSED
