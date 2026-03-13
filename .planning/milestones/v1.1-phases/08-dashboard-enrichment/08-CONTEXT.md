# Phase 8: Dashboard Enrichment - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform both the Developer and PM dashboards from simple count-card overviews into richer, information-dense panels. Developer dashboard: replace the 3 count cards with 4 widgets — My Subtasks, MR Health Summary, Sprint Health, and Recent Notifications. PM dashboard: replace or enrich the 3 count cards with a sprint health panel and a notifications panel alongside the existing releases card. No new data sources beyond what the existing query cache already fetches (plus a potential sprint end-date call).

</domain>

<decisions>
## Implementation Decisions

### Dashboard layout
- **Replace** the 3 count cards entirely — do not keep them at the top
- Dev dashboard: 4 richer panels arranged at Claude's discretion (2×2 grid recommended given typical wider-than-tall screen)
- Dashboard scroll behavior: Claude's discretion (scrollable preferred for reliability across screen sizes)
- PM dashboard **is enriched in this phase**: sprint health panel + notifications panel added (existing Sprint Completion %, Team Workload, Next Release cards are replaced/upgraded)

### My Subtasks widget (Dev)
- Each row shows: **Jira key + title + status badge + parent story name**
  - e.g. `PROJ-42  Fix login bug  [In Progress]  ‹ PROJ-10 Auth overhaul`
- Max **5 subtasks** shown; if more exist, a muted "View all in My Tasks" link appears at the bottom navigating to the My Tasks tab
- Subtask rows are **clickable** — clicking opens the Jira issue URL in the system browser (same deep-link pattern as elsewhere in the app)
- Orphan subtasks (parent story not in current sprint) are hidden — carries forward from Phase 7
- **Empty state:** friendly muted message — "No open subtasks in the current sprint"

### MR Health Summary widget (Dev)
- Shows a breakdown of the current user's open MRs by review state: **Needs Review / Approved / Changes Requested** (counts)
- Data source: `assignedMrs` query already in the dashboard — derive state from MR approval status
- Empty state: "No open MRs"

### Sprint Health widget (Dev + PM)
- Shows: **days left · % points done · at-risk count**
  - e.g. "5 days left · 47% done · 2 at-risk"
- At-risk definition: **Claude's discretion** — recommended heuristic: in-progress items where `timeSpentSeconds == 0` (started but no time logged), since that's available without extra API calls
- **At-risk items are listed** below the summary line (task titles, not just count) — if none, list is omitted
- Sprint days remaining requires sprint end date — **Claude should audit** whether `fetchSprintIssues` or the existing sprint query returns `endDate`; if not available, add the minimal Jira sprint API call needed rather than skipping days-remaining entirely
- Uses `['jira-issues', 'sprint-board', activeJiraProject]` cache — no new Jira fetch unless end date is missing

### Notifications inline widget (Dev + PM)
- Shows **last 3 unread** notifications from the notifications store (`useNotificationsStore`)
- Each row: **source icon (Jira/GitLab) + entity title + body preview** (~60 chars), matching the TopBar NotificationPopover row style
- Clicking a row **opens the detail inline** within the widget (not navigation) — same pattern as NotificationPopover's detail view
- **Empty state:** "No unread notifications" — widget stays visible
- **"View all notifications" link** at the bottom — navigates to the Notifications route
- Reads from store directly (no new fetch — store is populated by TopBar's polling query)

### Claude's Discretion
- Developer dashboard panel arrangement (2×2 grid recommended)
- Dashboard scroll vs fixed-height behavior
- At-risk heuristic implementation (recommended: in-progress + timeSpentSeconds == 0)
- Sprint end date strategy (audit existing data first; add minimal API call if unavailable)
- Exact panel header styling, spacing, and widget borders

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `taskflow/src/routes/dashboard/index.tsx`: existing dashboard with queries already set up — `my-tasks`, `gitlab-mrs`, `gitlab-reviewer-mrs-dashboard`, `sprint-board`, `jira-fix-versions`, `gitlab-current-user`; all reusable, just replace card rendering with panel rendering
- `useNotificationsStore`: exposes `items` (NotificationItem[]) and `readIds` (string[]) — derive unread list directly, no new fetch
- `NotificationRow.tsx` + `NotificationDetail.tsx`: existing notification UI components — reuse or adapt for inline widget
- `shadcn/ui Badge`: available for status chips on subtask rows (used since Phase 5)
- `TaskRow.tsx`: existing subtask row rendering with key + title — extend with status badge + parent story name

### Established Patterns
- Graceful-hide: hide sections/columns when data unavailable (Phase 5/6 pattern) — apply to time tracking and sprint end date
- `issuetype.subtask === true` for subtask detection — never name comparison (Phase 5)
- Deep-link to Jira: `window.open(jiraBaseUrl + '/browse/' + issue.key)` or equivalent — used elsewhere in app
- `issue.fields.parent?.key` and `issue.fields.parent?.fields.summary` for parent story context (available since Phase 5 type extension)
- TanStack Query cache sharing: dashboard already shares cache keys with MyTasksTab and SprintBoardTab — no duplicate fetches

### Integration Points
- `dashboard/index.tsx`: replace `devCards`/`pmCards` arrays + grid rendering with panel components
- `useNotificationsStore`: import directly in dashboard (no query needed — store is updated by TopBar's polling)
- Sprint end date: check `fetchSprintIssues` response or add `fetchActiveSprint` call that returns `endDate` from `/rest/agile/1.0/board/{boardId}/sprint` — boardId may need to be stored during onboarding or discovered

</code_context>

<specifics>
## Specific Ideas

- My Subtasks row target: `PROJ-42  Fix login bug  [In Progress]  ‹ PROJ-10 Auth overhaul`
- Sprint health summary line: `5 days left · 47% done · 2 at-risk`
- At-risk list below summary: task key + title, muted/smaller text
- Notifications row: `[GitLab icon]  PROJ-42: Fix login bug  —  "LGTM, approving..."`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-dashboard-enrichment*
*Context gathered: 2026-03-13*
