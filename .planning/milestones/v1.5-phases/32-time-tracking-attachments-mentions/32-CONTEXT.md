# Phase 32: Time Tracking, Attachments & Mentions - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can log and manage work time on issues, view/upload file attachments, and @mention teammates in comments with autocomplete. Dashboard-level time aggregation, attachment inline editing/annotation, and real-time collaboration are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Time Tracking Input
- **D-01:** Combined input — natural language text field ("2h 30m", "1d", "45m") as primary, with a small clock icon that opens a duration picker (hours + minutes) as fallback for users who prefer structure
- **D-02:** Log work form includes: time spent input, date picker (defaults to today), optional comment field

### Time Tracking Display
- **D-03:** Time tracking summary placement — Claude's discretion (sidebar field row recommended for consistency with existing field layout pattern from D-08 Phase 31)
- **D-04:** Log work trigger — Claude's discretion (sidebar button recommended for contextual placement near the time data)
- **D-05:** Log work form appearance — Claude's discretion (popover from button recommended, matching StatusPopover pattern)

### Attachment Viewing
- **D-06:** Attachments displayed in a collapsible "Attachments (N)" section below the description, above the activity timeline
- **D-07:** Image attachments render as thumbnail grid; non-image files as a compact list with filename, size, and download link
- **D-08:** Clicking an image thumbnail opens a lightbox overlay with full-size view and close/next/prev navigation. AuthImage component handles authenticated fetching.

### Attachment Upload
- **D-09:** Upload via "Attach file" button in section header + drag-and-drop onto the attachments section area
- **D-10:** Single file upload at a time (Jira API limitation per REQUIREMENTS.md out-of-scope note). Progress indicator per file.

### @Mention Autocomplete
- **D-11:** Typing "@" in CommentComposer opens a floating popover anchored to cursor position in the textarea
- **D-12:** Popover shows filtered list of project assignable users (avatar + display name), fetched from `/rest/api/2/user/assignable/search?project={key}` and cached with TanStack Query
- **D-13:** Arrow keys to navigate, Enter to select. Selection inserts `[~username]` wiki markup into the textarea
- **D-14:** Mentions render in WikiRenderer as highlighted styled spans: "@Display Name" with subtle background/bold — non-clickable (no user profile in Taskflow)

### Worklog Timeline Integration
- **D-15:** Worklogs render as medium two-line entries in the Activity Timeline: avatar + name + time spent on first line, optional worklog comment as smaller second line
- **D-16:** New [Worklogs] filter chip added to TimelineFilterChips alongside [All] [Changes] [Comments] (extending D-07 from Phase 31)
- **D-17:** Edit/delete own worklogs via inline 3-dot menu — same pattern as comment edit/delete. Edit opens the time input inline.

### Claude's Discretion
- Time tracking summary exact layout and progress visualization
- Log work trigger placement and form appearance
- Lightbox component implementation approach
- Attachment section collapse/expand default state
- Worklog entry hover/focus states
- Duration parser implementation details
- Mention popover debounce and minimum character threshold

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Issue detail page
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` — Main issue detail route; integration point for attachments section and worklog timeline entries
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — Content area where attachments section will be added below description
- `taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx` — Right sidebar; integration point for time tracking summary row
- `taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx` — Activity timeline component; must extend with worklog entry type and filter chip

### Comment system
- `taskflow/src/routes/dashboard/CommentComposer.tsx` — Comment input with wiki markup toolbar; must enhance with @mention autocomplete
- `taskflow/src/routes/dashboard/WikiRenderer.tsx` — Jira wiki markup renderer; must add [~username] mention rendering

### Jira services
- `taskflow/src/services/jira/worklogs.ts` — Existing worklog fetch (author names only); must expand to return full worklog objects
- `taskflow/src/services/jira/client.ts` — `fetchAllWorklogPages` pagination helper; reuse for full worklog data
- `taskflow/src/services/jira/types.ts` — `JiraAttachment` type already defined; add worklog types
- `taskflow/src/services/jira/index.ts` — Barrel re-export; add new attachment/worklog/user modules

### Existing components
- `taskflow/src/routes/dashboard/AuthImage.tsx` — Authenticated Jira image fetching with blob URLs; reuse for attachment thumbnails
- `taskflow/src/routes/dashboard/issue-detail/TimelineFilterChips.tsx` — Filter chip component; extend with [Worklogs] chip
- `taskflow/src/routes/dashboard/issue-detail/ChangelogEntry.tsx` — Compact timeline entry; reference pattern for worklog entry styling

### Requirements
- `.planning/REQUIREMENTS.md` — TIME-01 through TIME-05, DETAIL-06 through DETAIL-09

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AuthImage` (AuthImage.tsx): Handles authenticated Jira image fetching with blob URLs — reuse directly for attachment thumbnails
- `JiraAttachment` type (types.ts): Already defined with `id`, `filename`, `content` (URL), `thumbnail`, `mimeType` — attachment field already on `JiraIssueDetail`
- `fetchAllWorklogPages` (client.ts): Pagination helper for worklogs — reuse for full worklog data retrieval
- `ActivityTimeline` (ActivityTimeline.tsx): Unified timeline with filter chips — extend with worklog entry type
- `TimelineFilterChips` (TimelineFilterChips.tsx): Filter chip component — add [Worklogs] chip
- `CommentComposer` (CommentComposer.tsx): Wiki markup toolbar with Textarea — enhance with @mention trigger
- `WikiRenderer` (WikiRenderer.tsx): Wiki markup to React rendering — add `[~username]` mention support
- `StatusPopover` pattern: Popover UI pattern — reference for log work form popover
- `Badge` component (shadcn/ui): Reuse for attachment count badge and filter chips
- `useFieldMutation` (useFieldMutation.ts): Field mutation pattern — reference for worklog CRUD mutations

### Established Patterns
- Jira service modules: 14 focused domain files with barrel re-export — new attachment/worklog/user services follow same pattern
- `apiFetch` wrapper with operation labeling for dev tools request logging
- TanStack Query for all data fetching with staleTime and enabled guards
- 3-dot menu for edit/delete own items (comments pattern) — reuse for worklogs
- `readSecret('jira-pat')` for authenticated API calls

### Integration Points
- `IssueDetailContent.tsx` — Add attachments section below description
- `IssueDetailSidebar.tsx` — Add time tracking summary field row
- `ActivityTimeline.tsx` — Add worklog entry type and [Worklogs] filter chip
- `CommentComposer.tsx` — Add @mention autocomplete with cursor-anchored popover
- `WikiRenderer.tsx` — Add [~username] mention rendering
- Jira REST API v2 endpoints: `/rest/api/2/issue/{key}/worklog` (CRUD), `/rest/api/2/issue/{key}/attachments` (upload), `/rest/api/2/user/assignable/search` (mention users)

</code_context>

<specifics>
## Specific Ideas

- Combined time input: natural language primary with fallback picker — like Jira's own "Log Work" dialog but enhanced
- Attachment section should feel like GitHub's file attachment area — clean thumbnails grid for images, compact list for other files
- @mention popover should feel like Slack — cursor-anchored, avatar + name, arrow keys + Enter
- Worklog timeline entries are medium-height (two lines) — not as compact as changelog, not as heavy as comments
- Inline 3-dot menu for worklog edit/delete — consistent with comment CRUD pattern established in Phase 31

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-time-tracking-attachments-mentions*
*Context gathered: 2026-03-22*
