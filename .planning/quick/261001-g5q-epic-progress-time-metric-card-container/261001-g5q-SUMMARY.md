# Quick Task 261001-g5q Summary

Epic detail progress section gains a Time metric (Jira aggregate estimate/logged, story + subtasks), a Card container, and base-ui hover/focus tooltips.

## Commits
- ead77644 feat(261001-g5q): time metric in epic progress lib
- 18a6331d feat(261001-g5q): epic progress time metric, card container, tooltips

## What changed
- `services/jira.ts`: fetchEpicStories requests `aggregatetimeoriginalestimate`, `aggregatetimespent`, `aggregatetimeestimate`; optional fields on JiraIssue.
- `lib/epic-progress.ts`: Metric `'time'`; `secOf` coerces non-finite/negative to 0; `seconds` on StatusBucket, `logged`/`estimate` on AssigneeBucket; `deriveTimeTotals`, `formatMetric`.
- `components/ui/tooltip.tsx`: new base-ui Tooltip wrapper (default delay 150ms).
- `EpicProgressSection.tsx`: Card shell (section + skeleton), Count/SP/Time toggle, Time tiles, logged / estimate assignee value, "No time estimated" guard, tooltips on tiles, status segments, legend items, assignee name/segments/value, metric-formatted burnup tooltip and Y axis.

## Tests
Full vitest suite passed in the pre-commit hook for both commits (2892 passed). tsc and biome clean on touched files. EpicProgressCells.tsx untouched.

## Deviations
- Tooltip delay left at the 150ms default instead of 0; tests use `findBy*` (1s default timeout), no flakiness observed. No prop was added to the section for delay.
- The base worktree HEAD differed from the required base; reset to 605d3ce9 as instructed by the branch check.
- Native `title` attributes on status segments and assignee names were removed (replaced by tooltips) to avoid stacked tooltips, as planned.

## Known Stubs
None.
