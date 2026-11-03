---
phase: quick-261103-lcd
plan: 01
subsystem: epic-progress
tags: [epic-detail, time-tracking, jira, tempo]
requires: []
provides: [remainingOf, timeWeightOf, bandsOf]
affects: [EpicProgressSection, EpicProgressSummary, IssueDetailContent]
tech-stack:
  added: []
  patterns: ["per-story band split (bandsOf) shared by summary + assignee buckets"]
key-files:
  created: []
  modified:
    - taskflow/src/lib/epic-progress.ts
    - taskflow/src/lib/epic-progress.test.ts
    - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.test.tsx
decisions:
  - "Time mode: Completed % = completed work (done weight + logged on open stories) / forecast total (logged + remaining)"
  - "Remaining = Jira aggregatetimeestimate on open stories (explicit 0 trusted), else max(estimate − logged, 0)"
  - "Tempo-only open stories get estimate = remaining + logged, so they are not 'unestimated'"
metrics:
  completed: 2026-11-03
  tasks: 2
  files: 7
---

# Quick 261103-lcd: Epic detail Time numbers use logged time and Jira remaining estimate

In Time mode, the epic's Completed %, hero caption, Remaining tile, assignee and status bars, and the Stories-row tooltip now come from logged time plus Jira's remaining estimate (`aggregatetimeestimate`), not only the original estimate. Count and SP numbers are unchanged.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Time model: remainingOf / timeWeightOf / bandsOf and the time-aware aggregates | 060758a3 |
| 2 | UI: Remaining note text and Stories-row remaining | 3a5e5b47 |

## What changed

- `epic-progress.ts`: two new private helpers, `originalOf` and `jiraRemaining`. `estimateOf` now falls back to remaining + logged for open stories that only have a remaining estimate (Tempo-style). Three new exports: `remainingOf`, `timeWeightOf` and `bandsOf`. `weightOf('time')` now returns `timeWeightOf`. `deriveSummary` and `deriveAssigneeBuckets` build their bands with `bandsOf`. `deriveTimeTotals.remaining` is now Σ `remainingOf`. For open stories with a Jira remaining estimate, `deriveTimeBurnup` uses logged + remaining as the estimate. Doc comments were updated to match.
- Checked by test: in Time mode, done + inProgress + todo == total, and inProgress + todo == remainingSeconds == deriveTimeTotals.remaining. The burnup's final-day gap also equals that remaining.
- `EpicProgressSummary.tsx`: REMAINING_NOTE now reads 'Open items · Time = Jira remaining estimate, else estimate − logged'.
- `EpicProgressSection.tsx`: updated the `assigneeBands` doc comment only.
- `IssueDetailContent.tsx`: the Stories-row remaining now comes from `remainingOf(story)`. The `catOf` import was removed because nothing uses it any more.

## Deviations from Plan

1. **[Rule 1 - expected test shift] `status bands (261001-rtw)` › 'time bands are estimate sums, not logged'** (epic-progress.test.ts). The plan did not list this test. Story B is open, has 5h logged against a 2h estimate and no remaining estimate. Under the new band model its 5h counts as done work, so the done band goes from 1h to 6h; to do stays at 2h and in progress is 0. I renamed the test and updated it to the new model.
2. **Other EpicProgressSection time-mode expectations.** Beyond the hero assertions the plan named, these shifted: the assignee chips (1h 30m / 0m / 1h), the 'to do 1h' hover label, `ASSIGNEE_TIME_ROWS` (60/0/40%), the hero tooltip rows, the person-bar segment widths (60% / 40%), and the hsz hero caption ('2h of 3h 30m'). Each change follows directly from the fixture arithmetic, and each has a comment in the test.
3. **Where the deriveRisks Tempo test lives.** It is in the existing `deriveRisks (261001-qvu)` describe rather than the new time-model block, so it can reuse the `base`/`fin()` setup there.
4. **Environment only.** The worktree had no `node_modules`, so I symlinked `taskflow/node_modules` to the main checkout's copy. It is gitignored and was not committed.

No production code was changed to make a test mock pass. No Count or SP expectations changed, and the release-detail tests pass without edits.

## Verification

- Full vitest suite passed in the pre-commit hook: 4374 passed, 2 skipped.
- `tsc --noEmit` is clean, and `biome check` is clean on all touched files.
- `remainingOf(story)` appears in IssueDetailContent.tsx, and `Math.max(est - logged` no longer appears there.

## Known Stubs

None.

## Self-Check: PASSED

- Commits 060758a3 and 3a5e5b47 are both in the branch log.
- All modified files exist.
