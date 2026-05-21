---
slug: 260521-hq7
status: complete
commit: 7f4d96cd
date: 2026-05-21
---

# Summary

Added weekend (gray) and holiday (red) column coloring to the worklog pivot table.

## Changes

- `taskflow/src/services/tempo/schedule.ts` — new `fetchUserSchedule` function, POSTs to `/rest/tempo-core/2/user/schedule/search`, returns `Map<string, ScheduleDayType>`
- `taskflow/src/services/tempo/index.ts` — re-exports schedule module
- `taskflow/src/routes/worklogs/WorklogsPage.tsx` — adds `useQuery` for schedule (staleTime 24h), `dayColClass` helper, applies classes to `<th>` and `<td>` cells per day column

## Behavior

- `NON_WORKING_DAY` (weekends) → `bg-muted/80` (gray tint)
- `HOLIDAY` → `bg-red-50 dark:bg-red-950/30` (red tint)
- `WORKING_DAY` → no tint (unchanged)
- Schedule fetch is per current user, degrades gracefully (empty map) if API unavailable
