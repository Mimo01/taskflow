---
status: complete
quick_id: 260609-fs9
---

# Quick Task 260609-fs9: Summary

**Task:** In comments (or other places?) when showing X days ago and is is more than one year ago, make it say years + days

## What Was Done

All three `relativeTime`/`formatTimeAgo` implementations now produce "X year[s] [Y day[s]] ago" for timestamps >= 365 days old. Previously they fell through to `Intl.RelativeTimeFormat` day-scale, producing strings like "397 days ago".

### Files Modified

- `taskflow/src/lib/formatTimeAgo.ts` — Added year branch above day-scale return
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — Added year branch to `relativeTime()`
- `taskflow/src/routes/settings/UpdatesSection.tsx` — Added year branch to local `relativeTime()` copy
- `taskflow/src/lib/formatTimeAgo.test.ts` — Added 28 lines of TDD tests (RED → GREEN)

### Unchanged (intentional)

- `formatTimeAgoStrict` compact badge ("7d") — left unchanged per scope
- `DiscussionThreads.tsx` `formatRelativeTime` — already falls back to formatted date after 7 days

## Commits

- `8fbd3bae` `test(quick-260609-fs9-01): add failing year+day tests for formatTimeAgo`
- `a9673c73` `feat(quick-260609-fs9-01): add year+day branch to all three relativeTime implementations`

## Test Results

18/18 tests pass. All 4 modified files are biome-clean.
