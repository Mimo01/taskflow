# Quick Task 260610-ew2: Send story to top/bottom of sprint - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Task Boundary

On the Backlog view, add right-click context-menu options on a story to "send to top of sprint" and "send to bottom of sprint". The operation reorders the story to the first/last position **within its own section** — its current sprint if it's a sprint story, or the backlog if it's a backlog story.

</domain>

<decisions>
## Implementation Decisions

### Applies to
- Both sprint stories AND backlog stories.
- **Always operates within the story's OWN section** — never moves the story between sprints or into/out of a sprint. A sprint story goes to top/bottom of that sprint; a backlog story goes to top/bottom of the backlog.
- This means NO call to `addIssuesToSprint` / `moveIssuesToBacklog` — pure rank-within-section.

### Menu layout
- Two flat context-menu items (not a submenu): "Send to top" and "Send to bottom".
- Labels should read naturally for the section. Since it always targets the row's own section, generic wording like "Send to top" / "Send to bottom" is acceptable; the planner may use "top of sprint"/"top of backlog" wording if it can cheaply tell which section the row is in. Claude's discretion on exact label text — keep it short.
- Add to the existing context menu in `BacklogRow.tsx` (the same one that hosts "Move to..." and "Flag").

### Update style
- Optimistic + rollback, reusing the existing `rankMutation` pattern in `BacklogPage.tsx` (set `localOrder` override immediately, roll back on error, invalidate on settle). Match the drag-to-reorder UX exactly — ideally route through the same mutation.

### Claude's Discretion
- Exact label strings and whether to show/disable the item when the story is already at top/bottom (a no-op guard is nice-to-have but not required).
- Whether to compute top/bottom target from the current rendered section order (including any `localOrder` override) — should mirror how drag computes neighbors.

</decisions>

<specifics>
## Specific Ideas

Reuse, do not rebuild:
- `rankIssueApi(baseUrl, token, issueKey, rankCustomFieldId, position)` — `services/jira/rank-api.ts`. Top = `{ rankBeforeIssue: firstKey }`, bottom = `{ rankAfterIssue: lastKey }`.
- `rankMutation` in `BacklogPage.tsx` (~lines 861-919) — optimistic order + rollback + invalidate already implemented for drag.
- `resolveIntraRankFromDrop()` / `sortByKeyOrder()` in `backlogDragHelpers.ts` — neighbor resolution logic.
- Existing context menu wiring: `BacklogRow.tsx` lines ~294-371, `ContextMenuItem` from `components/ui/context-menu.tsx`, callback-prop pattern (like `onMoveToSprint`/`onToggleFlag`).

</specifics>

<canonical_refs>
## Canonical References

No external specs. Jira ranking semantics: `PUT /rest/agile/1.0/issue/rank` with `rankBeforeIssue`/`rankAfterIssue`.

</canonical_refs>
