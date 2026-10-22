---
phase: 92-advanced-global-search-prioritized-ranking-current-sprint-up
plan: 04
subsystem: search
tags: [ranking, tiers, grouping, pure-lib]
requires: [92-01]
provides: [buildSearchIndex, entryFromJiraIssue, classifyBodyHit, buildResultModel, resolveKeyLookup, isKeyLikeQuery, findIndexEntry, matchesSecondary, PER_TIER_CAP, TOTAL_CAP]
affects: [92-05]
key-files:
  created: [taskflow/src/lib/global-search.ts, taskflow/src/lib/global-search.test.ts]
decisions:
  - Subtasks (indexed or from Jira) are always forced into their resolvable parent's tier and group; unknown parent renders standalone
  - Caps never split a group; first group in a section always shows; total cap 40 skipped for expanded tiers
  - isSubtask derived from parentKey (GhTypeEntity has no subtask flag)
requirements: [D-01, D-04, D-05, D-06, D-07, D-08, D-13, D-16, D-17, D-19, D-20]
metrics:
  tasks: 2
  completed: 2026-10-16
---

# Phase 92 Plan 04: Global search ranking model Summary

React-free `global-search.ts` implementing the sprint-tier index (Current > next > later sprints > Backlog > Closed), body-hit field classification, parent/subtask grouping with dimmed context parents, per-tier and total caps, key lookup and secondary filtering, covered by 29 unit tests.

## Commits
- 2b45011a: feat(92-04): both tasks in one commit (pre-commit hook runs the full suite, so RED/GREEN and the two tasks were combined).

## Deviations from Plan
- Worktree base was behind main; reset to main per the startup check. Ran `npm ci` for node_modules.
- Tasks 1 and 2 committed together rather than separately (both edit the same two files; hook runs full suite).
- Fuzzy-ordering test uses a subsequence-typo title ('chec kout flow') because fuzzysort rejects transpositions below the 0.35 threshold; no production change.
- Biome `--write` applied to the two new files only.

## Known Stubs
None.

## Self-Check: PASSED
Full vitest suite (3666 tests), tsc --noEmit, biome check all clean.
