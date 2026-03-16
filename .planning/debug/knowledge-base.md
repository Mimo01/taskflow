# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## pinned-tabs-loading-bug -- Pinned tabs show loading spinner on cold start instead of issue metadata
- **Date:** 2026-03-16
- **Error patterns:** loading state, spinner, pinned tabs, cold start, cache empty, resolveIssueFromCache, no subscription
- **Root cause:** PinnedTabStrip resolved issue metadata via synchronous cache reads (resolveIssueFromCache) at render time but never actively fetched data. On cold start the react-query cache is empty and tabs show loading spinners indefinitely.
- **Fix:** Added fetchIssueSummary() lightweight endpoint (2 fields), useQueries in AppLayout to actively fetch for each pinned key, passed resolved map to PinnedTabStrip as prop. Simplified PinnedTabStrip to pure presentational component.
- **Files changed:** taskflow/src/services/jira.ts, taskflow/src/main.tsx, taskflow/src/components/app/PinnedTabStrip.tsx
---

## subtask-cards-shifted-right -- Subtask cards visually shifted right on sprint board
- **Date:** 2026-03-16
- **Error patterns:** subtask, shifted right, alignment, ml-4, margin-left, sprint board, TaskCard, isSubtask
- **Root cause:** TaskCard.tsx applied `ml-4 border-l-2 border-l-muted` unconditionally when isSubtask=true. On the sprint board, subtasks are already grouped in swimlane columns under their parent story, so the 1rem left margin caused unwanted rightward shift.
- **Fix:** Removed `ml-4` from the isSubtask styling in TaskCard, keeping only `border-l-2 border-l-muted` as a subtle visual indicator.
- **Files changed:** taskflow/src/routes/dashboard/TaskCard.tsx
---

## sprint-field-shows-dash -- Sprint field on issue detail shows dash instead of sprint name
- **Date:** 2026-03-16
- **Error patterns:** sprint, dash, No sprint, issue detail, sidebar, sprintFieldKey, customfield_10020, Jira DC, toString, parsing
- **Root cause:** IssueDetailSidebar sprint parsing only handled Array<{name,state}> (Jira Cloud format). On Jira DC, REST API v2 returns sprint data as Java toString strings, single objects, or objects with uppercase state "ACTIVE" -- all causing sprintName to resolve to null.
- **Fix:** Replaced inline parsing with robust extractSprintName() function handling all 5 Jira sprint field formats: array of objects, array of toString strings, single object, plain string, null/undefined. Includes case-insensitive state matching and regex name extraction from toString format.
- **Files changed:** taskflow/src/routes/dashboard/IssueDetailSidebar.tsx, taskflow/src/routes/dashboard/IssueDetailSidebar.test.ts
---
