---
phase: quick-261001-hsz
verified: 2026-10-01T00:00:00Z
status: human_needed
score: 9/9 must-haves verified (automated)
---

# Quick 261001-hsz Verification

**Status:** human_needed

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Estimate formula (subtasks else own) used everywhere | VERIFIED | `estimateOf` in epic-progress.ts:119; used by IssueDetailContent mini bar and deriveTimeBurnup |
| 2 | Estimated and Remaining tile tooltips explain formulas | VERIFIED | EpicProgressSection.tsx:205 (ESTIMATE_FORMULA_NOTE), :218 ("Replaces Jira's remaining estimate") |
| 3 | Time Remaining = Σ open max(est − logged, 0) | VERIFIED | deriveTimeTotals plus tests pass |
| 4 | Collapse-model Estimate/Logged series | VERIFIED | deriveTimeBurnup: done gives logged-so-far, open gives max(est, logged); startDay fallback to axis start |
| 5 | Lazy worklog query, skeleton, error plus Retry | VERIFIED | EpicTimeBurnup.tsx key `jira-epic-worklogs`, "Couldn't load worklogs", Retry; mounted only for the time metric |
| 6 | Dashed crosshair, full date, Remaining row | VERIFIED (code) | `cursor` with strokeDasharray at EpicTimeBurnup:128 and the section's BAR_CURSOR; Remaining row at :149 |
| 7 | Whole-bar status and assignee tooltips | VERIFIED (code) | `epic-status-bar` and `epic-assignee-bar` triggers, trackCursorAxis="x" |
| 8 | Quick-peek shared Tooltip, no title | VERIFIED | EpicProgressCells.tsx TooltipTrigger; only retry titles remain |
| 9 | Stories mini bar (overrun, empty, tooltip) | VERIFIED | `story-time-bar`, `data-overrun`, `data-empty` in IssueDetailContent.tsx; Remaining is 0 for done stories |
| 10 | Non-card full-width layout with dividers | VERIFIED | SECTION_CLASS `border-t border-b ... py-5 my-6`; no Card import |

Fetcher: fetchEpicWorklogs chunks keys at 50, uses the concurrent search helper (fail-closed), tops up only truncated worklogs with bounded workers, and rolls subtasks up to the parent. The fetchEpicStories JQL is untouched (0 "Epic Link" diff hits). No `.at(` use and no debt markers.

## Spot checks

- vitest on 8 touched and neighbouring files: 232/232 passed.
- `tsc --noEmit`: clean.
- `biome check` on touched files: clean.

## Human verification required

1. **Hover in the real Tauri/WKWebView app.** Hover the burnup (Count, SP and Time modes), status bar, assignee bars, epics-list quick-peek bar and Stories mini bars. Expected: tooltip opens anywhere on the bar, the dashed vertical cursor is visible, and Time mode shows a Remaining row. Why human: jsdom cannot prove WebKit hover or recharts cursor rendering.
2. **Visual layout.** Check the full-width divider layout, the skeleton geometry match, and that Stories rows stay one line with the mini bar. Why human: visual.
3. **Time mode against live Jira.** Check the lazy worklog load, and that the final Estimate − Logged gap equals the Remaining tile. Why human: needs real Jira data.

## Gaps

None found.
