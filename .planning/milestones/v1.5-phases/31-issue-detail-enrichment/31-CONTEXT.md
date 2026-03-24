# Phase 31: Issue Detail Enrichment - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Enrich the issue detail page with a unified activity timeline (changelog + comments), timeline filtering, comment edit/delete, watcher toggle, overdue badges, and issue cloning. Time tracking, attachments, and @mentions are Phase 32.

</domain>

<decisions>
## Implementation Decisions

### Activity Timeline Layout
- **D-01:** Replace the existing Comments section with a unified Activity timeline that merges changelog entries (field changes, status transitions) and comments chronologically
- **D-02:** Comments render as full card-style entries (existing card design). Field changes render as compact single-line entries with muted text — like GitHub's issue timeline pattern
- **D-03:** Default sort order is newest-first (consistent with existing commentSortOrder default)
- **D-04:** Comment composer remains sticky at bottom of the timeline area

### Timeline Filter UX
- **D-05:** Filter controls are toggle chips (pill-shaped) in a row above the timeline: [All (24)] [Changes (16)] [Comments (8)]
- **D-06:** Each chip shows its count per type — gives instant activity breakdown
- **D-07:** Active chip is highlighted (use Badge component with outline variant). Easy to extend with [Worklogs] chip in Phase 32

### Watcher & Overdue Placement
- **D-08:** Watch/unwatch toggle appears as a sidebar field row alongside Status, Assignee, Priority etc. — eye icon + watcher count + click to toggle
- **D-09:** Overdue badge (red "Overdue" badge) appears everywhere due date is shown: issue detail sidebar, sprint board cards (TaskRow), backlog rows, and search results

### Clone Issue Behavior
- **D-10:** Clone button opens the existing CreateEditIssueModal pre-filled with source issue fields (summary prefixed "Clone - ", description, labels, priority, assignee). User can review/modify before saving.
- **D-11:** Clone button placed in the action bar alongside Pin, Edit, and Open in Jira buttons

### Already Implemented
- **D-12:** Comment edit/delete (DETAIL-03, DETAIL-04) are already fully implemented in IssueDetailPage.tsx — 3-dot menu with Edit/Delete for own comments, with inline editing and confirmation

### Claude's Discretion
- Loading states for changelog API fetch
- Changelog entry grouping (whether to group rapid consecutive field changes)
- Exact overdue badge styling and threshold behavior
- Icon choices for timeline entry types

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Issue detail page
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` — Main issue detail route with existing comment thread, breadcrumbs, sidebar layout
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — Content area: description, subtasks, action buttons (Pin/Edit/Open in Jira)
- `taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx` — Right sidebar with editable fields (status, assignee, priority, etc.)

### Jira services
- `taskflow/src/services/jira/comments.ts` — Comment CRUD (fetch, post, update, delete)
- `taskflow/src/services/jira/issues.ts` — Issue fetch, sprint issues, search
- `taskflow/src/services/jira/types.ts` — JiraComment, JiraIssue, JiraIssueDetail type definitions
- `taskflow/src/services/jira/index.ts` — Barrel re-export of all 14 domain modules

### Reusable components
- `taskflow/src/routes/dashboard/WikiRenderer.tsx` — Jira wiki markup to React rendering (used by comments and descriptions)
- `taskflow/src/routes/dashboard/CommentComposer.tsx` — Comment input with submit
- `taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts` — Issue creation mutations (for clone pre-fill)

### Requirements
- `.planning/REQUIREMENTS.md` — DETAIL-01 through DETAIL-05, DETAIL-10, DETAIL-11

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CommentCard` (IssueDetailPage.tsx): Memoized comment card with edit/delete — reuse as timeline comment entry
- `CommentComposer` (CommentComposer.tsx): Comment input — keep as sticky bottom in timeline
- `WikiRenderer` (WikiRenderer.tsx): Jira markup rendering — used for comment bodies in timeline
- `relativeTime()` (IssueDetailContent.tsx): Relative time formatter — reuse for all timeline entries
- `Badge` component (shadcn/ui): Use for filter chips and overdue badge
- `CreateEditIssueModal`: Existing create/edit form with createmeta field discovery — reuse for clone pre-fill
- `useFieldMutation` (issue-detail/useFieldMutation.ts): Field mutation pattern for sidebar — reuse for watcher toggle

### Established Patterns
- Jira service modules: 14 focused domain files with barrel re-export — new changelog/watchers services follow same pattern
- `apiFetch` wrapper with operation labeling for dev tools request logging
- `ApiError` class with isAuthError for structured HTTP error handling
- TanStack Query for all data fetching with staleTime and enabled guards
- `useSettingsStore` for UI preferences (commentSortOrder already exists)

### Integration Points
- `IssueDetailPage.tsx` — Timeline replaces the existing `<CommentThread>` section
- `IssueDetailSidebar` — Add watchers field row
- `IssueDetailContent.tsx` — Add Clone button to action bar alongside Pin/Edit/Open in Jira
- `TaskRow.tsx` — Add overdue badge to sprint board cards
- `BacklogPage.tsx` — Add overdue badge to backlog rows
- Jira REST API v2 endpoints: `/rest/api/2/issue/{key}?expand=changelog` for history, `/rest/api/2/issue/{key}/watchers` for watchers

</code_context>

<specifics>
## Specific Ideas

- Activity timeline should look like GitHub's issue timeline — compact gray text for field changes between full comment cards
- Filter chips styled like the existing Badge component with outline variant
- "Clone - " prefix on cloned issue summary (standard Jira clone behavior)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-issue-detail-enrichment*
*Context gathered: 2026-03-22*
