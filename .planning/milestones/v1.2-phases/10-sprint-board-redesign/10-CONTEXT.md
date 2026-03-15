# Phase 10: Sprint Board Redesign - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the sprint board so subtasks are the primary kanban cards grouped under parent story headers, all team members are visible, drag-to-move status transitions work with optimistic update + rollback, and users can quickly create issues from the board without leaving it. Issue detail sheet (BOARD-05) is already wired from Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Board layout
- **Grouped kanban** (not swimlane): columns = statuses, story headers appear as non-draggable section dividers within each column grouping their subtasks
- A story with subtasks in 3 columns appears as a minimal header row in each of those columns
- Story headers are minimal: issue key + summary (truncated), muted background, clickable to open issue detail sheet
- Stories with NO subtasks appear as regular draggable TaskCards in their own status column — they are not hidden
- Only subtask cards are draggable (stories serve only as headers unless they have no subtasks)

### Drag behavior
- Full card is the drag surface (no dedicated drag handle) — click = open detail, drag = move; dnd-kit distinguishes by movement threshold
- **Pre-validate using Jira transitions API**: fetch valid transitions per issue before rendering; columns that cannot receive a given card are visually indicated as invalid drop targets (disabled highlight)
- On failed transition (Jira API rejection after drop): card snaps back to original column + inline error on card (same pattern as StatusPopover rollback — consistent with existing app UX)

### Create from board (BOARD-04)
- **Inline quick-create**: each status column has a small '+ Add' button at the bottom
- Clicking opens an inline text input at the bottom of that column — summary only (just a text field, press Enter to create)
- Created issue defaults to that column's Jira status
- Issue type defaults to Story (no subtasks context) — assignee, points, epic set via issue detail after creation
- No modal, no navigation away from board

### Column definition
- Columns come from the **Jira workflow statuses API** (not derived from current sprint cards) — ensures all valid transition targets are always shown, including empty columns
- Empty columns always shown (valid drag targets — real Jira behavior)
- Column order: **status category** first (To Do → In Progress → Done), then alphabetical within each category
- This requires one extra API call (`GET /rest/api/2/project/{key}/statuses`) but gives reliable, stable column set

### Claude's Discretion
- Exact visual treatment of invalid drop target columns (e.g., muted/striped overlay, reduced opacity)
- Exact story header card design within the Tailwind/shadcn system
- Drag overlay/ghost card appearance while dragging
- Transition loading indicator while Jira API call is in flight

</decisions>

<specifics>
## Specific Ideas

- The board should feel like Jira's own sprint board — story headers as non-interactive section dividers, subtasks as the movable units
- Inline quick-create is the only create entry point from this phase; the full form (all fields) comes in Phase 11
- Pre-fetching valid transitions per card is the chosen approach — not "try and rollback" — so users know where they can drag before touching the card

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TaskCard.tsx`: compact card with key, summary, assignee avatar, health dot — reuse for subtask cards and bare story cards; extend or create `StoryHeader` variant for grouped headers
- `StatusPopover.tsx`: optimistic update + rollback pattern — reference for inline error handling on failed drag transitions
- `IssueDetailSheet`: already wired (BOARD-05 done); `setSelectedIssueKey` pattern in SprintBoardTab is the hook point
- `SprintBoardTab.tsx`: existing kanban layout to rebuild — `boardGroups` useMemo, DndContext placement, column derivation all need rework

### Established Patterns
- `@dnd-kit/core` v6 (stable API) — confirmed in research notes; `@dnd-kit/react` new API is not production-ready
- Optimistic updates via TanStack Query cache mutation + rollback on error
- Jira transition calls already exist via `updateIssueStatus` (used by StatusPopover) — reuse for drag drops
- `discoverCustomFields()` in settings store — field IDs available; no re-discovery needed
- Stronghold PAT read pattern (async on mount)

### Integration Points
- `fetchProjectStatuses(jiraBaseUrl, token, projectKey)` — new API call needed for workflow columns (Jira DC: `GET /rest/api/2/project/{key}/statuses`)
- `fetchIssueTransitions(jiraBaseUrl, token, issueKey)` — new or existing call to get valid transitions per issue (Jira DC: `GET /rest/api/2/issue/{key}/transitions`)
- `SprintBoardTab.tsx` stays as the main container; DndContext wraps the column layout
- `IssueDetailSheet` sits as a sibling outside DndContext (established in Phase 9 — keeps DndContext mounted while sheet is open)
- Column status list from workflow API replaces current `Array.from(new Set(stories.map(s => s.fields.status.name)))` derivation

</code_context>

<deferred>
## Deferred Ideas

- Full create/edit form with all fields (assignee, points, epic, description) — Phase 11
- Story drag-to-reorder within a column (rank reorder) — out of scope per PROJECT.md (Jira rank API unreliable on DC)
- Subtask-to-story reassignment by dragging across story groups — not in BOARD requirements; own phase if needed
- Board filters (filter by assignee, epic, label) — EPIC-02 covers epic filter in Phase 13; assignee/label filter not yet scoped

</deferred>

---

*Phase: 10-sprint-board-redesign*
*Context gathered: 2026-03-14*
