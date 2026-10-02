# 261002-fp7 Summary

Risks card now shows one icon+token pill per risk (no +N overflow); per-person breakdown is separated by a divider and "By person" heading.

Commit: 05cc905c

## Changes
- `epic-progress.ts`: `EpicRisk.token` (overdue `Nd`, late `+Nd`, unestimated/unassigned count, stalled/scope null).
- `EpicProgressSummary.tsx`: `RiskOverflow` and 2-visible limit removed; pills h-4 (card geometry unchanged), amber for warning, muted for info.
- `EpicProgressSection.tsx`: `epic-assignee-block` (`mt-6 border-t pt-4`), heading, rows in `mt-2`.

## Intentional test changes
- Overflow test ("folds the rest into +N") replaced by "every risk as its own pill, no +N" (tokens, severity, icons, card height).
- "opens the hidden risks from +N" replaced by "every risk is its own pill and opens its own popover".
- Overdue chip textContent expectation 'Overdue 3 days' -> '3d' (accessible name unchanged).
- Added: per-person block divider/heading/order test; token assertions in deriveRisks tests.

## Deviations
None. The new pill test uses 3 risks (overdue/unestimated/unassigned); a 4-risk fixture was not built.
