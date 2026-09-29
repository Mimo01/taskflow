# Quick 260929-fnq Summary

**One-liner:** New My Day band "In Review — my subtasks" (indigo) for foreign in-review stories containing my subtasks, placed between "In Review with my MR" and "In Progress", implemented via a pure predicate applied in groupByMyDay.

## Commits
- 24c6d1c2: feat(260929-fnq): add in-review-my-subtasks band to My Day sort (lib + tests)
- 58f2c9c4: feat(260929-fnq): label and indigo dot for In Review — my subtasks band (page)

## Changes
- `taskflow/src/lib/my-tasks-sort.ts`: 7-band MY_DAY_BANDS (done = 6), exported IN_REVIEW_MY_SUBTASKS_BAND / DONE_BAND, `isForeignReviewWithMySubtask`, lift in groupByMyDay Pass 3 (Math.min, guarded against parentBand <= 3 and DONE_BAND). classifyBand/subtreeBand signatures unchanged; subtreeBand cap uses DONE_BAND.
- `taskflow/src/lib/my-tasks-sort.test.ts`: indices renumbered; new predicate + groupByMyDay cases (lift, D-05 guard, precedence, Reviewed-done guard, ordering).
- `taskflow/src/routes/my-tasks/MyTasksPage.tsx`: label + bg-indigo-500 dot; both maps typed Record<MyDayBand, string>.

## Verification
Full vitest (2788 passed), tsc clean, biome clean on lib files (page has only pre-existing warnings).

## Deviations
None to production logic. Environment only: worktree reset to base c6198341 (initial HEAD was 540def1c); CONTEXT.md/RESEARCH.md are untracked in the main checkout so were read from there; taskflow/node_modules symlinked (gitignored) to the main checkout to run tooling.

## Self-Check: PASSED
