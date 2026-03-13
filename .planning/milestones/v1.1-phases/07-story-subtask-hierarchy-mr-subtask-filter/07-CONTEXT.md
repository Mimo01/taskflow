# Phase 7: Story/Subtask Hierarchy + MR Subtask Filter - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Group subtasks under their parent story cards in the Sprint Board (collapsible); filter orphan subtasks out of all views; and extend MR Attention to include MRs linked to stories where the current user has an assigned subtask. My Tasks hierarchy (`fetchMyTasksHierarchy`, `groupedData`, indented TaskRows) is already fully implemented — no changes needed there beyond the orphan filter.

</domain>

<decisions>
## Implementation Decisions

### Sprint Board: cross-column layout
- All subtasks nest under their parent story card in the parent's column, regardless of subtask status
- Story card is the anchor — subtasks always appear under the story, not scattered across columns
- Story cards always appear even if unassigned (subtasks can only nest under them)
- Column issue count shows stories only (not subtasks), consistent with pre-hierarchy view
- Story cards that have subtasks show a subtle subtask count chip (e.g. "3 subtasks")
- Story cards with no subtasks look the same as before (no chip)

### Sprint Board: collapse behavior
- Subtask groups default to **collapsed** on load — board stays clean, story cards with count chip signal hidden content
- Collapse is **per-story** — each story card independently expands/collapses; no global toggle
- Subtask count chip always visible (collapsed and expanded) — acts as a persistent summary
- Expand/collapse triggered by a **chevron button** on the card next to the subtask count chip — avoids conflict with future card-click behavior

### Orphan subtasks (parent not in current sprint)
- **Hidden entirely** — no badge, no separate orphan list
- If a subtask's parent story is not in the current sprint, it does not appear anywhere: not in My Tasks, not on Sprint Board
- Overrides HIER-03 requirement (which said "show parent badge") — user preference is to hide rather than badge
- `groupedData.orphans` in MyTasksTab should render nothing (or be filtered upstream in `fetchMyTasksHierarchy`)

### MRAT-02: subtask-linked story MRs
- MrAttentionTab must include MRs linked to stories where the current user has at least one assigned subtask
- **Data source:** Claude's discretion — can reuse `fetchMyTasksHierarchy` TanStack Query cache if populated, but must also work when the cache is empty (e.g. user navigates to MR Attention first). A dedicated minimal query or fallback fetch is acceptable.
- Subtask-linked MRs always appear unconditionally (no unresolved-discussion filter applied to them)
- These MRs show a subtle **"via [subtask key]"** label in MrRow so user understands why the MR appears (e.g. "via PROJ-101")

### Claude's Discretion
- How orphan filtering is applied (upstream in `fetchMyTasksHierarchy` return, or downstream in groupedData logic)
- Exact subtask count chip styling on TaskCard
- Chevron animation/transition for expand/collapse
- Which subtask key to show in the "via" label when multiple subtasks link to the same story

</decisions>

<specifics>
## Specific Ideas

- No specific visual references given — standard chevron + count chip pattern is fine
- "Via subtask" label should be subtle/muted, not prominent — it's explanatory metadata, not primary info

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TaskCard.tsx`: existing card component — add chevron button, subtask count chip, and collapsible subtask section
- `shadcn/ui Badge`: already used in Phase 5 Releases tab — use for subtask count chip on TaskCard
- `fetchMyTasksHierarchy`: already implemented in `jira.ts`, returns `{ issues, myIssueKeys }` — modify orphan filtering here or downstream
- `groupedData` in `MyTasksTab.tsx`: already computes parents/subtasks/orphans — just stop rendering orphans
- `MrRow.tsx`: existing MR row component — add optional "via [key]" label slot

### Established Patterns
- `issuetype.subtask === true` for subtask detection (never name comparison) — from Phase 5
- TanStack Query cache sharing between tabs (e.g. `['gitlab-mrs', gitlabBaseUrl]` shared between MyTasksTab and MrAttentionTab) — same pattern for subtask data
- Graceful-hide / silent fallback: if subtask data unavailable, show base MR list without subtask-linked additions
- `issue.fields.parent?.key` for parent key lookup — available on `JiraIssue` type

### Integration Points
- `SprintBoardTab.tsx`: renders `colIssues.map(issue => <TaskCard .../>)` — needs to split into parent groups with collapsible subtask sections
- `MrAttentionTab.tsx`: needs access to "stories where current user has subtasks" — likely a derived set from `fetchMyTasksHierarchy` or a minimal query
- `MrRow.tsx`: receives `linkedTask` prop — extend or add a `viaSubtaskKey?: string` prop for the label
- `fetchSprintIssues` in `MrAttentionTab`: already fetched for link key set — could also derive story keys from it if subtask data available

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-story-subtask-hierarchy-mr-subtask-filter*
*Context gathered: 2026-03-13*
