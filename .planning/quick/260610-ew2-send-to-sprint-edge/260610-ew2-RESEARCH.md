# Quick Task 260610-ew2: Research — Send story to top/bottom of section

**Mode:** quick-task
**Date:** 2026-06-10

## Summary

Everything needed already exists. This is a wiring task: add two context-menu items in `BacklogRow.tsx`, plumb two callbacks down from `BacklogPage.tsx`, and reuse the existing `rankMutation` to rank the story before the first / after the last issue of its own section. No new API, no sprint-membership change.

## Key integration points (verified against codebase)

### Context menu (where the items go)
- `taskflow/src/routes/dashboard/BacklogRow.tsx` lines ~294-371: context menu only renders when `onMoveToSprint`/`onMoveToBacklog`/`onToggleFlag` props are present. Add new optional callbacks (e.g. `onSendToTop` / `onSendToBottom`) and a `ContextMenuGroup` with two `ContextMenuItem`s. Include the new callbacks in the "should I render the menu" guard.
- `taskflow/src/components/ui/context-menu.tsx`: `ContextMenuItem`, `ContextMenuGroup`, `ContextMenuSeparator` (Base UI). Existing items show the idiom.

### Ranking API (the action)
- `taskflow/src/services/jira/rank-api.ts` → `rankIssueApi(baseUrl, token, issueKey, rankCustomFieldId, position)`; `PUT /rest/agile/1.0/issue/rank`; 204 on success; `ApiError` on 401/403.
  - **Top:** `{ rankBeforeIssue: firstKeyInSection }`
  - **Bottom:** `{ rankAfterIssue: lastKeyInSection }`
- Re-exported via `services/jira.ts` line 27.

### Optimistic reorder (the UX)
- `BacklogPage.tsx` `rankMutation` (~lines 861-919): `onMutate` cancels refetches + sets `localOrder` Map<sectionId, string[]> override; `onError` rolls back; `onSettled` invalidates `['gh-backlog', boardId]`. **Prefer routing the new handlers through this same mutation** so behavior matches drag exactly.
- Neighbor/order helpers in `taskflow/src/routes/dashboard/backlogDragHelpers.ts`: `sortByKeyOrder()` (respects `localOrder`), `resolveIntraRankFromDrop()` / `resolveIntraSectionRank()`. Use the section's current rendered order to find first/last key.

### Section membership (how to know the story's section)
- `BacklogPage.tsx` lines ~406-466: `issueIdToSprintId` reverse index → `sprintSections` (active/future sprints + their issues); backlog section = unassigned issues (~684). The handler must resolve the row's section, take its ordered keys, and pick first (top) / last (bottom).

## Pitfalls
- **Don't change sprint membership.** Top/bottom is intra-section only — do NOT call `addIssuesToSprint`/`moveIssuesToBacklog`.
- **Compute first/last from the same order drag uses** (the `localOrder`-aware sorted keys), or the optimistic move and the persisted rank can disagree.
- **No-op when already at the edge:** if the story is already first (for top) or last (for bottom), skip the API call (avoid a pointless 204 + refetch). Optional but cheap.
- **rankCustomFieldId** must be passed through exactly as the drag path does — it's required by `rankIssueApi`.
- Biome baseline is GREEN — run `npm run check` after; `biome lint` ≠ `check`.
