# Phase 12: Backlog View - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

A dedicated full-page backlog view for sprint grooming: browse all issues not in any active or future sprint, filter by epic/label/assignee, select and move issues to the active sprint, and create new stories. Issue detail panel (BACK-05) reuses the Phase 9 IssueDetailSheet. Create story (BACK-03) reuses the Phase 11 Create/Edit modal.

</domain>

<decisions>
## Implementation Decisions

### Sidebar placement & roles
- Full-page route: `/backlog`
- Visible to **both Developer and PM** roles
- Position in sidebar:
  - Developer section: after Sprint Board, before MR Attention
  - PM section: after Workload, before Releases

### Row information
- **Stories only** — no subtasks in the backlog list (subtasks appear in issue detail)
- Each row shows: issue key + summary + story points + assignee avatar + epic badge (colored chip)
- Epic badge matches Jira's backlog style — colored chip with epic name
- Clicking any row opens IssueDetailSheet (BACK-05 — already solved by Phase 9 infra)

### Move-to-sprint UX
- Each row has a checkbox; selecting any row reveals a **sticky bulk action bar** at the bottom of the page
- Action bar shows: "Move X issues to active sprint" button + deselect count
- On click: **optimistic immediate removal** from the backlog list + API call
- On failure: rollback (issues reappear) + inline error in the action bar — consistent with StatusPopover rollback pattern
- If no active sprint exists: action bar is shown but "Move to sprint" button is **disabled** with a tooltip: "No active sprint in this project"

### Filter bar design
- Horizontal filter bar below the page header: [Epic ▾] [Label ▾] [Assignee ▾] dropdowns
- Active filters shown as dismissible chips in the same bar
- Multiple active filters use **AND logic** (narrows results)
- Filters are applied client-side after fetching the full backlog (no new JQL per filter change)

### Create story
- "**+ Create Story**" button in the page header (top-right)
- Opens the existing Phase 11 Create/Edit modal with issue type pre-set to Story
- On successful create: backlog list invalidates and new story appears in the list

### Claude's Discretion
- Exact epic badge color assignment (derive from epic key hash, or cycle through a palette)
- Checkbox placement within the row (left edge vs. hover-reveal)
- Exact sticky action bar position and animation
- Skeleton placeholder while backlog loads
- Empty state copy when backlog is empty or filters match nothing

</decisions>

<specifics>
## Specific Ideas

- Backlog JQL (validated in research): `project = ${projectKey} AND (sprint is EMPTY OR sprint not in (openSprints(), futureSprints())) AND issuetype not in subtaskIssueTypes() ORDER BY created DESC`
- Move-to-sprint API: Jira Agile REST `POST /rest/agile/1.0/sprint/{sprintId}/issue` with `{ issues: [key1, key2] }`
- Active sprint ID is already fetched by `fetchActiveSprint()` in jira.ts — reuse, don't re-fetch
- Filter bar visually matches any existing filter UI patterns in the app (if none exist, this is the first — keep it simple)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IssueDetailSheet`: already wired, opens by issue key — BACK-05 is free from Phase 9
- `CreateEditIssueModal` (Phase 11): accepts `defaultIssueType` prop — pass `"Story"` from the backlog header button
- `fetchActiveSprint()` in jira.ts: fetches active sprint ID and name — needed for move-to-sprint action and the "no active sprint" guard
- `fetchAllPages()` in jira.ts: handles paginated JQL — use for the full backlog fetch
- `TaskRow.tsx`: existing row component — may need a backlog-specific variant (adds checkbox, epic badge, story points column), or a new `BacklogRow.tsx` built alongside it
- `StatusPopover.tsx`: rollback pattern reference for failed move-to-sprint

### Established Patterns
- Full-page routes in `src/routes/{name}/index.tsx` + `{Name}.tsx` — follow this structure for `/backlog`
- Sidebar `NavLink` items grouped by role in `Sidebar.tsx` — add `/backlog` NavLink in both dev and PM sections
- TanStack Query with explicit queryKey: `['jira-backlog', projectKey, jiraBaseUrl]`
- Optimistic update via query cache mutation + rollback on error
- Stronghold PAT read pattern (async on mount)
- `discoverCustomFields()` result in settings store — `epicLinkFieldKey` + `epicNameFieldKey` already resolved; needed to extract epic badge data from backlog issues

### Integration Points
- `Sidebar.tsx`: add `/backlog` NavLink in both dev and PM sections
- `main.tsx`: add `{ path: 'backlog', lazy: () => import('./routes/backlog') }` route
- `AppLayout` (in main.tsx): IssueDetailSheet is already mounted at AppLayout level — no changes needed for BACK-05
- `CreateEditIssueModal` is already in AppLayout — pass `defaultIssueType="Story"` trigger from the backlog page header button; needs `onOpenCreate` prop thread similar to Sidebar's existing pattern
- On successful move: invalidate `['jira-sprint-issues']` cache (sprint board should reflect new issues) + `['jira-backlog']`
- On successful create: invalidate `['jira-backlog']` cache

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-backlog-view*
*Context gathered: 2026-03-14*
