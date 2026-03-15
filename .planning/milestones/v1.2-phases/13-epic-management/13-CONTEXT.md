# Phase 13: Epic Management - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Epic list, epic detail view (with stories under the epic), cross-view epic filtering (sprint board + backlog), and create new epic. The backlog's existing epic filter (BACK-04) is already complete — Phase 13 adds the same filter to the sprint board and introduces a dedicated epics surface.

</domain>

<decisions>
## Implementation Decisions

### Epic list surface
- Full-page `/epics` route, same pattern as `/backlog`
- Sidebar: shared section **above** role-specific links — visible to both Developer and PM (not inside either role section)
- Each row shows: epic name + status badge + story count + total story points + completion progress bar (done stories / total) + assignee avatars of contributors
- Data loading: fetch epics first via JQL (`issuetype = Epic ORDER BY updated DESC`), then enrich per-epic to get story counts and points

### Epic detail view
- Opens as a **wide sheet slide-over** (same pattern as IssueDetailSheet, ~85vw)
- Internal layout is two-column: **left column = stories list**, **right sidebar = epic metadata** (status, description, dates)
- Stories list rows: issue key + summary + status badge + assignee avatar + story points
- Clicking a story row opens IssueDetailSheet for that story (reuses existing infrastructure at AppLayout level)
- Opened from: clicking the epic name row on the `/epics` list

### Sprint board epic filter (EPIC-02)
- Filter bar at the **top of the sprint board** — epic-only combobox, same visual style as BacklogFilterBar
- When an epic filter is active: **hide** story header rows whose epic link doesn't match (and their subtask cards). Stories with no epic are hidden when any filter is active.
- Per-view local state — independent from the backlog's epic filter. Each view has its own controls.

### Create epic (EPIC-04)
- Entry point: **"+ Create Epic" button** in the `/epics` page header
- **Separate simpler dialog** — not the existing CreateEditIssueModal (avoids createmeta complexity for Epic type)
- Fields: **Epic Name** (required, uses instance-specific epic name custom field) + **Description** (optional) + **Assignee** (optional) + **Priority** (optional)
- On success: invalidate epics list cache

### Claude's Discretion
- Epic badge click behavior in backlog rows and sprint board cards (currently calls `onIssueClick(epicKey)` which opens IssueDetailSheet for the epic as a raw issue) — Claude decides whether to repurpose to open the new EpicDetailSheet or keep current behavior
- Exact epic name field ID submission on create (use the `epicNameFieldKey` from settings store, discovered via `com.pyxis.greenhopper.jira:gh-epic-label` — same discovery as other custom fields)
- Progress bar visual design (simple filled bar or segmented by status category)
- Assignee avatar overlap/count display on epic list rows (how many avatars to show before "+N" overflow)
- Animation and transition for the epic detail sheet
- Empty state for epic list and epic detail stories list

</decisions>

<specifics>
## Specific Ideas

- Sidebar placement mirrors any other shared cross-role feature: above the role-specific sections, not inside either dev or PM section
- Epic detail sheet should feel like a scoped version of the sprint board — stories are the primary unit, metadata is secondary
- The simpler create-epic dialog avoids the risk of Jira returning unexpected required fields from createmeta for the Epic issue type

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IssueDetailSheet` (AppLayout level): opens any issue by key — stories under an epic will link into it; the new EpicDetailSheet is a sibling pattern
- `BacklogFilterBar`: epic combobox pattern fully built — the sprint board filter bar is a simplified version (epic-only)
- `BacklogRow.tsx`: row design with key + summary + status + assignee + points — reference for stories list rows inside epic detail
- `CreateEditIssueModal`: pattern for dialog at AppLayout level; the new create-epic dialog follows the same mounting/trigger approach
- `epicColorClass()` in BacklogRow: hash-based epic color helper — reuse for any colored epic badges in the epics list
- `CreateEditIssueModal` already fetches epics via: `issuetype = Epic AND statusCategory != Done ORDER BY updated DESC` — reuse this JQL for the epics list fetch
- `epicNameFieldKey` in settings store: already discovered and available (via `com.pyxis.greenhopper.jira:gh-epic-label`) — needed for epic create submission

### Established Patterns
- Full-page routes in `main.tsx` as flat children of AppLayout: `{ path: 'epics', element: <EpicsPage /> }`
- `NavLink` in `Sidebar.tsx` with `navLinkClass` — add `/epics` NavLink in the shared section
- Wide sheet at AppLayout level (same as IssueDetailSheet) — `useState<string | null>` for `selectedEpicKey`
- TanStack Query with explicit queryKey: `['jira-epics', projectKey, jiraBaseUrl]`
- Two-query enrichment pattern (established in sprint board): fetch list, then batch-fetch related data
- Stronghold PAT read pattern (async on mount)
- `discoverCustomFields()` result in settings store — `epicLinkFieldKey` and `epicNameFieldKey` already resolved

### Integration Points
- `Sidebar.tsx`: add `/epics` NavLink in a shared section above role-specific blocks (refactor may be needed to add a shared section)
- `main.tsx`: add `{ path: 'epics', element: <EpicsPage /> }` route; mount EpicDetailSheet at AppLayout level alongside IssueDetailSheet and CreateEditIssueModal
- `SprintBoardTab.tsx`: add epic filter bar at the top; filter `boardGroups` useMemo by `epicLinkFieldKey` match
- `BacklogFilterBar` already handles EPIC-02 for the backlog — no changes needed there

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-epic-management*
*Context gathered: 2026-03-14*
