# Phase 5: API Foundation + Quick Wins - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the Jira data layer with parent/subtask/time-tracking fields and a two-query subtask fetch strategy; add `state=opened` filtering to any GitLab MR calls missing it; and fix the Releases tab to sort correctly and show released/unreleased/overdue badges. No UI changes to My Tasks, Sprint Board, or Workload — those consume the new fields in later phases.

</domain>

<decisions>
## Implementation Decisions

### Releases sorting
- Sort newest→oldest by `releaseDate`
- Undated releases (no `releaseDate`) appear at the bottom of the list, below all dated releases

### Releases status labels
- "Overdue" badge only (not "X days overdue") — date is already visible in the row
- "In X days" for future unreleased releases (e.g. "In 5 days")
- "Due today" as a special badge for same-day releases (not "Overdue", not "In 0 days")

### Released/unreleased badge design
- Color-coded shadcn chip badges:
  - Released → green chip
  - Unreleased (future) → amber chip
  - Overdue → red chip
  - Due today → blue chip
- Badge placement: after the release name, before the date
- Status badge (Released/Unreleased) and timing label ("In 5 days" / "Overdue" / "Due today") are separate elements — not merged into one badge

### Story points field discovery
- `discoverStoryPointsField()` runs once at app startup (when credentials load) and caches result in settings store
- Discovery tries fields in order: `customfield_10016` → `story_points` → `customfield_10028`
- If discovery fails entirely: silent fallback to `customfield_10016` — no user-visible error
- No settings banner or manual override for this phase

### Subtask fetch strategy
- `fetchSprintIssues` gains a two-query strategy: first query gets sprint parent issues, second query gets `issuetype in subtaskIssueTypes() AND parent in (KEY-1, KEY-2, ...)`
- If the second (subtask) query fails: return parent issues only, silently — no error state shown
- Sprint fetch does NOT request the `description` field for subtasks — description is fetched separately when a task is opened
- JQL chunking threshold for the parent key list: Claude's discretion based on Jira DC URL length limits

### Claude's Discretion
- JQL chunking batch size for the subtask second query
- Exact `discoverStoryPointsField()` API call (likely `GET /rest/api/2/field` + name matching)
- Whether GitLab MR search (`searchGitLabMRs`) needs `state=opened` added (Claude audits all MR calls)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shadcn/ui` badge component: available — use for Released/Unreleased/Overdue/Due today chips
- `fetchFixVersions` in `jira.ts`: already fetches fix versions; returns `(data.values ?? [])` defensively — needs sort + no type changes required
- `ReleasesTab.tsx`: renders `matchedVersions` list — add badge rendering and sort in `useMemo`
- `JiraFixVersion` interface: has `released: boolean` and `releaseDate?: string` — sufficient for badge logic without type changes
- `settings.store.ts`: Zustand store — good place to cache the discovered story points field key

### Established Patterns
- `customfield_10016`: hardcoded in `JiraIssue.fields` — extend type to also accept dynamic key or use index signature
- Single `fetch` abstraction via `@tauri-apps/plugin-http` — all new API calls follow same pattern
- TanStack Query with `staleTime` caching — story points field discovery fits as a one-time query with `staleTime: Infinity`
- Graceful degradation pattern: `fetchFixVersions` and `searchJira` both return empty/fallback on failure — subtask fetch follows same pattern

### Integration Points
- `fetchSprintIssues` callers: `MyTasksTab`, `SprintBoardTab`, `WorkloadTab`, `SprintProgressTab` — all receive `JiraIssue[]`; adding new fields is non-breaking (optional fields)
- `fetchAssignedMRs` and `fetchReviewerMRs` already have `state=opened` — audit `searchGitLabMRs` (line 422) for missing filter
- `ReleasesTab.tsx` `useMemo` block: add sort before `versions.map()` — clean insertion point

</code_context>

<specifics>
## Specific Ideas

- Row layout target: `v2.1.0  [Released]   2025-12-01   0/12 done`
- Status badge + separate timing element: `v2.1.0  [Unreleased]  In 5 days  2025-12-01`
- Badge color mapping maps to the urgency signal: green = done, amber = watch, red = action needed, blue = today

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-api-foundation-quick-wins*
*Context gathered: 2026-03-12*
