# Quick Task 260606-s09: Research — Unassigned assignee filter

**Mode:** quick-task
**Date:** 2026-06-06

## Findings (verified against codebase)

### Shared filter component
- `taskflow/src/components/UnifiedFilterBar.tsx` — used by BOTH Backlog and Sprint Board.
  - `FilterDropdown` (generic, reusable) at lines ~53-164.
  - Assignee dropdown wired at ~541-545 via `filterOptions` prop.
- BacklogPage imports it (line 51, rendered ~1231). SprintBoardTab imports it (line 36, rendered ~1693).

### Filter state
- `taskflow/src/stores/filter.store.ts`: `activeAssignees: Set<string>`, `toggleAssignee(name: string)`.
- Persisted quick-filters store assignees as string arrays → rehydrated into Sets.
- Values are **display names**, not account IDs.

### Filtering logic (client-side, two near-identical predicates)
- Backlog `BacklogPage.tsx:651-657`:
  ```ts
  const assigneeMatch = (() => {
    if (activeAssignees.size === 0) return true;
    const name = issue.fields.assignee?.displayName ?? '';
    return Array.from(activeAssignees).some((q) => name.toLowerCase().includes(q.toLowerCase()));
  })();
  ```
- Sprint Board `SprintBoardTab.tsx:1539-1546`: identical logic.
- Uses **substring** match — this is why a literal "Unassigned" string sentinel is fragile and a dedicated sentinel is preferred.

### Unassigned in data model
- `taskflow/src/services/jira/types.ts:12`: `assignee: { displayName; avatarUrls } | null`.
- Unassigned ⇒ `issue.fields.assignee === null` (predicate currently coerces to `''`).

### Dropdown option source
- Options derived from assignees present on visible issues:
  - Backlog: `BacklogPage.tsx:621-624`.
  - Sprint Board: `SprintBoardTab.tsx:1509-1514`.
- No "Unassigned" option exists today. Decision: inject the sentinel option only when ≥1 visible issue is unassigned.

### Existing "Unassigned" display convention
- `cached-avatar.tsx:55-57` (`isUnassigned`), `BacklogRow.tsx:186`, `FieldsSection.tsx:378`, `ReleaseDetailPage.tsx:198`.

## Pitfalls
- **Substring collision**: do NOT match the sentinel via substring; gate it strictly on `assignee === null`.
- **Predicate drift**: two views have duplicated predicates — keep them behaviorally identical (or extract a shared helper).
- **Persisted filters**: sentinel value flows through `quickFilters` string arrays + the Set — ensure round-trips cleanly (it's just another string).
- Not related to the fetch-once page-cap pitfall: options here come from already-loaded view issues, not a separate paged picker fetch.

## Recommended shape
1. Define a shared sentinel constant + label.
2. Inject sentinel option (top of list) only when an unassigned issue is visible — in both option builders.
3. Update both predicates: `if (selected has sentinel && assignee === null) return true;` then the existing named-substring match, excluding the sentinel from the substring pass.
4. Ensure `FilterDropdown` renders the sentinel with its human label "Unassigned".
