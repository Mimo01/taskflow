# Phase 74 — Deferred Items

Items discovered during Plan 06 execution that are OUT OF SCOPE per executor
deviation rules (pre-existing failures in unrelated files).

## Biome formatter regressions (pre-Plan-06 baseline drift) — FIXED INLINE

These two files had formatter complaints that pre-dated Plan 06 (the husky
pre-commit hook only runs `biome check --staged`, so they slipped past
Plans 01-05 commits). Fixed inline as a Rule 3 unblocker so the Plan 06
acceptance gate (`biome check .` 0 errors) could pass — the formatter
changes are pure whitespace, no semantic impact:

| File                                         | Fix                                                        |
| -------------------------------------------- | ---------------------------------------------------------- |
| `taskflow/src/routes/worklogs/WorklogCellPopover.tsx` | `<Popover>` opening tag split across lines per biome  |
| `taskflow/src/services/jira/greenhopper/types.ts`     | `versionsPerProject` Record<> collapsed to single line |

## Biome lint warnings (4) — useExhaustiveDependencies (pre-Plan-06)

Likewise pre-existing in files unrelated to GH-CUT-01:

- `src/routes/dashboard/SprintBoardTab.tsx:723`
- `src/services/jira/greenhopper/transitions.ts:315`
- `src/services/jira/greenhopper/useGhAllData.ts:48`
- `src/services/jira/greenhopper/useGhBacklogData.ts:56`

All `lint/correctness/useExhaustiveDependencies` (FIXABLE). Recommend
addressing in a dedicated lint-clean follow-up plan after Phase 74 closes.
