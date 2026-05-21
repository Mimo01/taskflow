---
slug: 260521-hq7
title: Color worklog weekends gray and holidays red
date: 2026-05-21
status: in-progress
---

# Color Worklog Weekends Gray and Holidays Red

Fetch the user's work schedule from Jira Tempo Core API and use the day types
to tint weekend (NON_WORKING_DAY) columns gray and holiday columns red in the
worklog pivot table.

## API

`POST /rest/tempo-core/2/user/schedule/search`
Body: `{"from":"YYYY-MM-DD","to":"YYYY-MM-DD"}`
Returns array with `schedule.days[]` where each day has `type`: WORKING_DAY | NON_WORKING_DAY | HOLIDAY

## Tasks

- [ ] Create `taskflow/src/services/tempo/schedule.ts` with `fetchUserSchedule`
- [ ] Export from `taskflow/src/services/tempo/index.ts`
- [ ] Add `useQuery` for schedule in `WorklogsPage.tsx`
- [ ] Apply day-type CSS classes to column headers and cells
- [ ] Commit
