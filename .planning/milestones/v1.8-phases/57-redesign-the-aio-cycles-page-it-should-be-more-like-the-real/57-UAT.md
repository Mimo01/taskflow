---
phase: 57
status: passed
verdict: PASS
date: 2026-05-15
note: "All checks pass after 7 inline fixes applied during session — see Fixes applied section"
---

# Phase 57 UAT — AioProjectOverviewPage live verification

**UAT date:** 2026-05-15
**App version:** git SHA eed2c3b
**AIO instance:** jira.orange.sk (anonymised)

## Checks

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | Two-panel layout | PASS | w-64 left tree + flex-1 right panel, border between panels renders correctly |
| 2 | Folder tree all levels | PASS | Recursive hierarchy renders; chevron rotate + child indent confirmed |
| 3 | Cycle count badges | PASS | Badge counts match `/count` endpoint response |
| 4 | Ungrouped entry | PASS | Appears at bottom of tree when countMap['-1'] > 0 |
| 5 | Folder selection loads cycles | PASS | Fixed inline: POST body with `folderID: {comparisonType: "IN", list: [...subtreeIDs]}` — correct cycles load per folder |
| 6 | 5-column table | PASS | Key (mono) / Name (NavLink) / Owner / Total tests / Progress render correctly |
| 7 | Progress bar segments and colors | PASS | Fixed inline: status IDs corrected (51=Not Run, 52=In Progress, 53=Passed, 54=Failed, 55=Blocked, 901=N/A→Pass); now fetched dynamically from `/config` |
| 8 | Owner column resolves displayName | PASS | Fixed inline: switched from `?username=` to `?key=` param; JIRAUSER* keys now resolve to real names |
| 9 | No first-load auth flash | PASS | Credential gate works; no 401 flash |
| 10 | No skeleton-to-data layout jump | PASS | Column widths consistent between skeleton and data phases |
| 11 | Cycle Name NavLink works | PASS | Navigates to `/aio-cycle/{projectKey}/{cycleKey}` correctly |
| 12 | Regression smoke | PASS | AioCycleDetailPage, AioTestRunDetailPage, sidebar AIO nav, Settings AIO picker all work |
| 13 | API shape correct (paged POST body) | PASS | Fixed inline: `/testcycle/paged` and `/testcycle/summary/paged` both use POST with correct body shapes confirmed from live network inspection |

## Fixes applied during UAT

The following were discovered and fixed inline during this session (all committed, all tests green):

1. **Wrong Jira project ID** — folder/count endpoint was receiving AIO-internal ID (43) instead of Jira numeric ID (10134). Fixed: added `fetchJiraProjectNumericId` using `/rest/api/2/project/{key}`.
2. **405 on /testcycle/paged** — endpoint requires POST not GET; also required `t={timestamp}` param. Fixed.
3. **POST body format** — `/testcycle/paged` body requires `{columns, sortingData, timeZone, folderID}` shape; `/testcycle/summary/paged` body is a raw array of cycle IDs. Fixed.
4. **User lookup used wrong param** — `?username=JIRAUSER*` returns "does not exist"; correct param is `?key=`. Fixed.
5. **Status ID mapping wrong** — hardcoded map had 51/53/54 incorrect. Fixed, then made dynamic via `/config` endpoint.
6. **Folder click didn't re-filter** — query had no folder dependency; cycles loaded once and stayed. Fixed: query key includes `selectedFolderID`, POST body includes `folderID` filter with subtree IDs.
7. **Show closed toggle removed** — user requested removal; toggle and all related state deleted.

## Gaps

none — all checks pass after inline fixes applied during session.
