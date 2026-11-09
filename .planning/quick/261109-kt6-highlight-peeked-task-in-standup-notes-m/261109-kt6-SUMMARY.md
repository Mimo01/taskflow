---
quick_id: 261109-kt6
status: complete
commit: 1e2461a9
---

# Quick 261109-kt6 Summary: Highlight peeked task in Standup Notes main view

Standup Notes was the only list that didn't mark the issue open in the peek sidebar.

## Changes
- `IssueActivityGroup.tsx` — `ActivityGroupHeader` (Yesterday story + sub-task headers): `useIsPeeked` + `PEEKED_ROW_CLASS` + `data-peeked`. `focus-within:bg-muted/50` applies only when not peeked: it outranks the plain peek tint, and the overlay button keeps focus after the click that opens the peek.
- `TodayInProgressSection.tsx`, `TodayUpNextSection.tsx` — `IssueRow`: same opt-in.
- All three dropped `rounded` so the selection is a straight band (matches 261109-jzm My Tasks).
- `standup-peek-highlight.test.tsx` — 3 tests; verified failing 3/3 without the fix.

## Not changed
- MR rows (nested/standalone/MRs Awaiting You) open the MR peek, not the issue peek store — out of scope.
- Yesterday sub-item rows (comments/transitions) aren't issue rows.

## Verification
tsc clean, biome clean, full vitest suite passed on commit (4513 passed).
