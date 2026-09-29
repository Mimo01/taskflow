# Quick Task 260929-h2q: Order subtasks by Jira subtask order wherever subtasks are listed - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Task Boundary

Wherever the app lists stories, they stay in rank order (works today — DO NOT change story/parent ordering).
Wherever the app lists subtasks, they must be ordered by the parent's Jira subtask order (`parent.fields.subtasks`
sequence), not by rank. User first noticed the problem on the My Tasks page (subtasks currently inherit rank order
from the JQL `ORDER BY Rank`).

Note: code lives in the `taskflow/` subdirectory of the repo (e.g. `taskflow/src/...`).

</domain>

<decisions>
## Implementation Decisions

### Ordering rule (user-modified)
- PRIMARY: subtasks under a parent follow the parent's `fields.subtasks` array order (Jira's subtask sequence,
  which is manually reorderable in Jira). "Use the fields.subtasks order anywhere possible."
- FALLBACK: where the parent's `fields.subtasks` is not available and fetching it is not reasonably cheap,
  order by numeric key ascending (issue number part, e.g. X-99 before X-100 — NEVER lexical string compare).
  Subtask keys not found in the parent's `fields.subtasks` list go after the listed ones, by numeric key.
- Status (done vs open) does NOT affect subtask order — pure subtask order.
- Story/parent ordering stays exactly as is (rank). Band grouping on My Tasks stays as is.

### Scope — ALL of these surfaces (user selected all)
1. My Tasks page (`src/lib/my-tasks-sort.ts` groupByMyDay + the non-My-Day grouping in `src/routes/my-tasks/MyTasksPage.tsx`)
2. Standup Notes Today sections (`src/routes/standup-notes/filterSprintItems.ts` → TodayInProgressSection / TodayUpNextSection, and the TodayColumn copy text)
3. Sprint Board swimlanes (`src/routes/dashboard/SprintBoardTab.tsx` ~line 1464 swimlanes useMemo) — subtask cards within each swimlane/column
4. Issue Detail subtask list (`src/routes/dashboard/IssueDetailView.tsx` / `fetchEnrichedSubtasks` in `src/services/jira.ts`) — already uses fields.subtasks; verify enrichment preserves order
5. Standup Notes Yesterday sub-task groups (`src/routes/standup-notes/YesterdayColumn.tsx` ~line 562, currently `localeCompare` on key → lexical bug)
6. Worklogs hierarchy (`src/routes/worklogs/WorklogsPage.tsx` storyNode.subtasks Map — insertion order)
7. Dashboard "My Subtasks" panel (`src/routes/dashboard/SubtasksPanel.tsx`) — flat cross-story list: keep relative parent order, reorder subtasks of the same parent per the rule (i.e. group-stable ordering)

### Sprint Board (decided after research)
- Sprint Board swimlanes use the NUMERIC KEY fallback only. NO new fetch/request for subtask order on the board
  (user explicitly declined the extra `fetchSubtaskOrder` request).

### Issue Detail
- Already correct (fetchEnrichedSubtasks preserves fields.subtasks order) — no change needed.

### Claude's Discretion
- Put the comparator/ordering logic in ONE shared pure helper (e.g. `src/lib/subtask-order.ts`) and reuse it everywhere; do not re-inline per view.
- Whether to add `subtasks` to the `fields=` list of a given fetch (to get parent order) vs. use the numeric-key fallback — decide per surface based on cost; prefer adding the field when the parent is already fetched in that query. Beware shared fetcher cache keys (editing a shared services/jira.ts fetcher affects every consumer).
- Unit tests for the helper plus a regression test for My Tasks ordering.

</decisions>

<specifics>
## Specific Ideas

- Numeric key compare: split on the last '-', compare project prefix then integer.
- Stories must remain in rank order — tests should assert parent order unchanged.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
