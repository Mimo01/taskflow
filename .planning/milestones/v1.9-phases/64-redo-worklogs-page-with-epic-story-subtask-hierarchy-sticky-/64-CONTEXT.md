# Phase 64: Redo worklogs page with epic/story/subtask hierarchy, sticky headers and columns, clickable tasks with breadcrumbs, and log entry editing - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the flat person×day pivot table in WorklogsPage with a Jira issue hierarchy (Epic → Story → Subtask) as the row dimension. Add sticky date header row and sticky first column (issue name). Make task rows clickable (in-app navigation to `/issue/:key`). Add log entry editing via cell click popover (edit/delete/add individual Jira worklogs from the table).

The filter bar (person filter + date presets + saved filters from Phase 63) is KEPT unchanged. Only the table structure and data model are replaced.

Phase 64 implements TEMPO-08 (previously deferred from v2).

</domain>

<decisions>
## Implementation Decisions

### Row Organization
- **D-01:** Tasks-only rows — no person column. Primary row dimension is Jira issue hierarchy: Epic header row → Story row (indented) → Subtask row (further indented).
- **D-02:** All hierarchy levels always expanded — no collapse/expand state needed.
- **D-03:** Cells aggregate all worklog entries for that issue+day (sum of `timeSpentSeconds`). Zero cells render blank (same rule as Phase 62 D-08). No entry-count badge on cells.
- **D-04:** Person filter remains. Default = current user (me). Filter still sends `author.name` to `fetchWorklogs`. With no person selected, table shows all people's hours aggregated into each cell.

### Jira Enrichment
- **D-05:** Batch JQL after worklogs load. After `fetchWorklogs` returns, collect all unique `issueKey` values, fire ONE Jira search: `key in (KEY-1, KEY-2, ...)` fetching `summary`, `issuetype`, `parent` fields. Single dependent `useQuery` that fires only when worklogs data is ready and unique keys are known.
- **D-06:** 3-level hierarchy: Epic → Story → Subtask. Worklogs logged on a story appear under that story row. Worklogs logged on a subtask appear under subtask → story → epic. Worklogs logged on an epic appear directly under the epic row.
- **D-07:** Unresolvable `issueKey` (deleted or inaccessible issue): render the key as the row label (e.g., `KEY-123`) with muted/strikethrough style. Hours are included in totals — not silently dropped.

### Breadcrumb Behavior
- **D-08:** Clicking a task row calls `onIssueClick(issueKey)` — a prop passed from `main.tsx` using the existing `handleIssueClick` pattern. Same as BacklogPage, SprintBoardPage, and other issue-showing pages.
- **D-09:** "Breadcrumbs" = the app nav trail in the top bar. When navigating Worklogs → Issue, the trail shows "Worklogs > ISSUE-KEY". This is handled automatically by `handleIssueClick` (called with `resetTrail = false`). No custom breadcrumb UI needed in the table.
- **D-10:** Only leaf rows trigger `onIssueClick`. Epic and Story header rows without direct worklogs may optionally be clickable too — Claude's discretion.

### Log Entry Editing
- **D-11:** Clicking a non-zero cell opens a popover showing individual worklog entries for that issue+day pair. Each entry shows: time spent (formatted), author display name, comment (if any), with an edit (pencil) icon and delete (trash) icon.
- **D-12:** "Add entry" button inside the popover to create a new worklog for that issue+date. Reuses or mirrors `LogWorkPopover` from `issue-detail/LogWorkPopover.tsx`.
- **D-13:** Uses existing `updateWorklog`, `deleteWorklog`, `createWorklog` from `taskflow/src/services/jira/worklogs.ts`. No new Tempo write API needed — Jira worklog API is the source.
- **D-14:** After any mutation (create/update/delete), invalidate TanStack Query cache key `['tempo', 'worklogs', ...]` so the table refetches automatically. Same pattern used in `IssueDetailPage.tsx` (lines 270–291).

### Sticky Table
- **D-15 (Claude's discretion):** Date header row: `position: sticky; top: 0; z-index: 20` (covering scrolled content). First column (issue name): `position: sticky; left: 0; z-index: 10` (but lower than header corner cell which needs both sticky top + left). Cell background must match the page background to avoid bleed-through. Container uses `overflow-auto` on the table wrapper div.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §"v2 Requirements" — TEMPO-08 (epic/story/subtask hierarchy — now Phase 64 scope)

### Phase Details
- `.planning/ROADMAP.md` §"Phase 64" — phase goal and dependencies

### Prior Phase Context (MUST read before touching WorklogsPage)
- `.planning/phases/63-tempo-saved-filters-test-pass/63-CONTEXT.md` — saved filters store and UI decisions (all kept in Phase 64)
- `.planning/phases/62-tempo-worklog-viewer-ui/62-CONTEXT.md` — date presets, person filter, cell format, timezone rules (D-07..D-11 especially)
- `.planning/phases/61-tempo-probe-service-layer/61-CONTEXT.md` — Tempo service structure and auth

### WorklogsPage (current state — table body being replaced)
- `taskflow/src/routes/worklogs/WorklogsPage.tsx` — current implementation; filter bar and state kept, pivot table replaced
- `taskflow/src/routes/worklogs/WorklogsPage.test.tsx` — test file to update for new table structure

### Jira Worklog API (for editing)
- `taskflow/src/services/jira/worklogs.ts` — `createWorklog`, `updateWorklog`, `deleteWorklog` implementations (already built and tested)
- `taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx` — existing create worklog popover (reuse or mirror)
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` lines 270–291 — mutation + invalidation pattern to mirror

### Jira Issue Enrichment (for hierarchy)
- `taskflow/src/services/jira.ts` — JQL search function; use for batch `key in (...)` query with `fields=summary,issuetype,parent`

### Issue Navigation Pattern
- `taskflow/src/main.tsx` line 314 — `handleIssueClick(issueKey, resetTrail)` definition; thread as `onIssueClick` prop to WorklogsPage
- `taskflow/src/lib/internalLinks.ts` — internal link resolution (for reference)

### Tempo Service (unchanged)
- `taskflow/src/services/tempo/worklogs.ts` — `fetchWorklogs(baseUrl, token, usernames, from, to)` — not changing
- `taskflow/src/services/tempo/types.ts` — `TempoWorklog` type (`author.name`, `author.displayName`, `dateStarted`, `timeSpentSeconds`, `issueKey`)

### Saved Filters Store (unchanged, must coexist)
- `taskflow/src/stores/tempo-filters.store.ts` — persisted Tempo filter store from Phase 63; not changing

### Sticky Table Reference
- `taskflow/src/routes/dashboard/MergeRequestListPage.tsx` — uses `overflow-hidden` + `overflow-auto` scroll containment pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createWorklog`, `updateWorklog`, `deleteWorklog` — `taskflow/src/services/jira/worklogs.ts` — already built, tested, used in IssueDetailPage
- `LogWorkPopover` — `taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx` — reusable create worklog popover; mirror or import directly
- `fetchWorklogs` — `taskflow/src/services/tempo/worklogs.ts` — unchanged; still the primary data source
- `formatSeconds` — currently local in WorklogsPage; extract to a shared util or keep inline
- Date helpers (`enumerateDays`, `getThisWeekRange`, `getLastWeekRange`, etc.) — keep unchanged from current WorklogsPage
- `useTempoFiltersStore` — `taskflow/src/stores/tempo-filters.store.ts` — saved filters persist across Phase 64

### Established Patterns
- **Batch JQL enrichment**: `jql: key in (KEY-1, KEY-2, ...)` + `fields: summary,issuetype,parent` — standard Jira search call; find existing JQL helpers in `jira.ts`
- **TanStack Query dependent query**: second `useQuery` that `enabled` only when first query has data (worklogs → enrichment)
- **Mutation + cache invalidation**: `useMutation` → `onSuccess: () => queryClient.invalidateQueries(...)` — pattern from IssueDetailPage
- **Sticky table CSS**: `sticky top-0 z-20` (header), `sticky left-0 z-10` (first column), corner cell needs both; cell `bg-background` to cover underlying content
- **Issue click prop**: `onIssueClick: (issueKey: string) => void` threaded from `main.tsx` route → page component

### Integration Points
- `taskflow/src/main.tsx` — WorklogsPage route render needs `onIssueClick={handleIssueClick}` prop added
- The table wrapper div switches from flat pivot to hierarchy tree: `{ epic: { stories: { story: { subtasks: { subtask: { dayMap } } } } } }`
- `useQuery` for worklogs (existing) + new dependent `useQuery` for Jira enrichment (new) + `useMutation` per cell action (new)

</code_context>

<specifics>
## Specific Ideas

- The filter bar (preset pills, person combobox, saved filters row, save button) is fully KEPT from Phase 63. Only the `<table>` in the table area is replaced.
- Epic rows: bold, slightly larger text or different background (e.g., `bg-muted/40`). Story rows: normal weight, slight indent (`pl-4`). Subtask rows: further indent (`pl-8`), smaller text.
- The `pivot` useMemo computation in the current WorklogsPage is replaced by a `hierarchy` useMemo that builds: `Map<epicKey, { summary, stories: Map<storyKey, { summary, subtasks: Map<subtaskKey, { summary, dayMap }> }> }>`
- Issues logged directly on an Epic (no story parent): appear directly under the epic row, at story-level indentation
- Issues with unknown/missing parent chain (e.g., a story with no epic): rendered under a synthetic "No Epic" group
- The `TempoWorklog` type from Phase 61 probe — verify whether `issueKey` field exists on the Tempo response (it should; check `tempo/types.ts` before assuming)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 64-redo-worklogs-page-with-epic-story-subtask-hierarchy-sticky*
*Context gathered: 2026-05-22*
