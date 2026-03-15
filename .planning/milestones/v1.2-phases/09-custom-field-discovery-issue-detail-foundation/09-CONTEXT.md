# Phase 9: Custom Field Discovery + Issue Detail Foundation - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Full issue detail view accessible from any screen in the app. Users can read the description and comments, see all issue metadata, edit key fields inline, and post comments — without opening Jira. Custom field discovery infrastructure (discoverCustomFields) powers this phase and all later phases.

</domain>

<decisions>
## Implementation Decisions

### Detail panel presentation
- Opens as a shadcn Sheet slide-over (not route navigation) — keeps board DndContext mounted for Phase 10
- Wide sheet layout: ~60% left column (title, description, subtasks, comments), ~40% right sidebar (metadata fields)
- Sidebar contains: priority, assignee, reporter, status, story points, epic, sprint, labels, fix versions, dates, linked issues
- Skeleton placeholders while issue loads — sheet opens instantly with visible structure

### Description rendering
- Rich wiki markup rendering: jira2md converts Jira wiki markup → markdown, react-markdown renders it
- Same pipeline for comments (consistent look)
- Scrollable section within the sheet (no collapse/expand)
- Jira DC always returns wiki markup strings (never ADF) — no ADF handling needed

### Inline editing
- Editable fields: assignee, priority, story points, labels
- Edit mode interaction: Claude's discretion (click-to-edit, pencil-on-hover, or dedicated popover — align with existing StatusPopover pattern where appropriate)
- Optimistic update + rollback on failure (inline error message, same as StatusPopover)
- On success: update field locally + invalidate issue cache in background so sprint board also refreshes
- Description editing is NOT in scope for this phase (deferred to Phase 11 create/edit form)
- Status transitions NOT added to the detail panel in this phase (already available on the sprint board)

### Subtask list
- Appears in the main content column, below the description and above the comment thread
- Each row: issue key + summary + status badge
- Clicking a subtask opens its own issue detail sheet

### Comment experience
- Read and post comments
- Thread ordered newest-first
- Compose box with basic formatting toolbar: bold/italic, code block, bullet list
- Formatting converts to Jira wiki markup before sending to API
- Each comment shows: author avatar + name + relative timestamp ("John D. • 2h ago")
- Same rich renderer for existing comments

### Linked issues
- Shown in the right sidebar
- All link types displayed with type label: "Blocks: PROJ-45", "Relates to: PROJ-12"
- Each linked issue shows key + summary

### Custom field discovery
- discoverCustomFields() replaces discoverStoryPointsField() — single call resolves story points, epic link, epic name, and Account field IDs
- Field IDs are instance-specific and must never be hardcoded
- Discovery result cached for the session (run once, not per-issue)

### Claude's Discretion
- Exact edit mode interaction pattern (click-to-edit inline, pencil-on-hover, or popover) — align with existing StatusPopover for consistency
- Sheet width (e.g., 70vw on desktop, full-width on mobile)
- Exact skeleton layout and animation
- Label editing UX (multi-select popover or comma-separated input)

</decisions>

<specifics>
## Specific Ideas

- Layout reference: Jira's own issue view — main content left, metadata sidebar right
- Edit feedback reference: existing StatusPopover pattern (optimistic + inline rollback)
- Comment header style: "John D. • 2h ago" (avatar + name + relative time)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `adfToPlainText()` in SearchResultPanel.tsx: plain-text extractor — NOT a markup renderer; do not repurpose for wiki markup. New jira2md + react-markdown pipeline is the replacement for the detail view.
- `StatusPopover.tsx`: optimistic update + rollback pattern — reference for inline editing UX
- `TaskCard.tsx`: compact issue card with key + summary + health dot — reusable for subtask list rows and linked issue rows
- `discoverStoryPointsField()` in jira.ts: single-field discovery — extend into discoverCustomFields() that resolves all instance-specific field IDs
- UI components available: badge, button, input, select, tabs, popover — Sheet component needs to be added via shadcn

### Established Patterns
- TanStack Query with explicit queryKey per resource (e.g., `['jira-issue-detail', key, jiraBaseUrl]`) — never reuse sprint board cache
- Optimistic updates via query cache mutation + rollback on error
- Stronghold for token reads (async on mount)
- Settings store for storyPointsFieldKey and other discovered field IDs

### Integration Points
- Issue detail sheet triggered from: TaskCard (sprint board), TaskRow (My Tasks), SearchResultPanel (search), notification rows
- All entry points pass an issue key; sheet fetches full issue independently
- Sheet must not break the DndContext of the sprint board (confirmed: Sheet approach is correct)
- Query invalidation after edits should refresh sprint board and my tasks caches

</code_context>

<deferred>
## Deferred Ideas

- Description editing (rich text editor for editing the description) — Phase 11 create/edit form
- Status transitions from the detail panel — already on sprint board; defer to Phase 10 board redesign
- Comment reactions or threading/replies — not in scope for v1.2
- Attachment viewing — out of scope (listed in PROJECT.md out of scope)

</deferred>

---

*Phase: 09-custom-field-discovery-issue-detail-foundation*
*Context gathered: 2026-03-13*
