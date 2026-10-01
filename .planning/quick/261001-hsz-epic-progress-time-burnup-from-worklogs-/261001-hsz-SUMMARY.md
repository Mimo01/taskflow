---
phase: quick-261001-hsz
plan: 01
subsystem: epic-progress
tags: [jira, worklogs, recharts, tooltips]
requires: [261001-g5q]
provides: [fetchEpicWorklogs, estimateOf, deriveTimeBurnup, EpicTimeBurnup]
key-files:
  created:
    - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/lib/epic-progress.ts
    - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
    - taskflow/src/routes/dashboard/EpicProgressCells.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
completed: 2026-10-01
---

# Quick 261001-hsz: Epic progress time burnup from worklogs Summary

Worklog-based Estimate/Logged collapse-model burnup in Time mode, subtask-else-own estimate formula, non-card divider layout, and whole-bar tooltips on every progress bar.

## Commits

- c061d337: worklog fetcher, estimate formula, collapse-model deriveTimeBurnup (Task 1)
- 8f80181c: section rework, lazy EpicTimeBurnup, crosshair, whole-bar tooltips (Task 2)
- d383e151: quick-peek tooltip and Stories-list mini time bars (Task 3)

## Deviations from Plan

**1. [Test change not in the list] epic-progress.test.ts `deriveTimeTotals sums and guards zero estimate`**
Remaining expectation changed 1800 to 5400. The Remaining formula changed from Σ aggregatetimeestimate to Σ open max(est − logged, 0) (the plan's own Task 1 behavior), so this lib-level assertion had to follow. Verified by hand: A max(3600-1800)=1800 plus B 3600 = 5400.

**2. [Intentional change 6, partial] Section Time-tile test**
The Remaining tile value stays "2h" with the new formula (T-2 open, est 7200, logged 0). To make the test discriminate the formulas I changed T-2's Jira `rem` fixture from 7200 to 3600; the expectation stayed "Remaining2h" with an explanatory comment.

**3. [Hit-area structure] EpicProgressCells quick-peek**
Instead of putting the bar classes (overflow-hidden, bg-muted) on the padded trigger, the trigger is a `py-1 -my-1` wrapper div carrying `data-testid="epic-progress-bar"` with the original bar div nested inside. This avoids painting the muted background into the padding. Segment testids and widths are unchanged.

**4. [Test update] EpicProgressSection hover tests**
Status-bar hover test scopes the "50%" assertion to the tooltip lines, because "50%" also appears in the "% done" tile. Plan-listed changes 2-5 applied as specified.

No production code was bent to fit test mocks.

## Notes

- Pre-existing fetchAllSearchPages 200-step bug left untouched, as instructed.
- WKWebView hover behavior is unverifiable in jsdom; manual UAT in Tauri remains needed (RESEARCH A2).
- Estimate derivation assumption A1 (aggregate OE = own + subtasks) should be checked against one live epic.

## Known Stubs

None.

## Self-Check: PASSED

All three commits exist; full pre-commit suite (biome, tsc, 2926 tests) passed on each.
