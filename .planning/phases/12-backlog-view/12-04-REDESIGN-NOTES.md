# 12-04 Backlog Redesign Notes

## What Changed

### Design Pivot

The original BacklogPage showed a flat list of issues not in any sprint (using the
`fetchBacklogIssues` function and a single query). The new design is a Jira-style
sectioned layout:

1. Active sprint section (if any) — collapsible, labeled "Active"
2. Future sprint sections — one per sprint ordered by start date, labeled "Future"
3. Backlog section — unassigned issues, always at the bottom

### Files Modified

**`taskflow/src/services/jira.ts`**

Added two new exported items:

- `fetchSprintsForBoard(creds, boardId)` — Calls `GET /rest/agile/1.0/board/{boardId}/sprint?state=active,future`,
  returns `JiraActiveSprint[]` sorted active-first then future by `startDate`. Gracefully returns `[]` on any failure.

- `fetchBacklogView(creds, projectKey, ...)` — Combines:
  1. Board discovery (same pattern as `fetchActiveSprint`)
  2. `fetchSprintsForBoard` call
  3. Parallel sprint issue fetches via JQL `sprint = {id} AND issuetype != Sub-task ORDER BY rank ASC`
  4. Backlog issue fetch via JQL `project = {key} AND sprint is EMPTY AND issuetype != Sub-task ORDER BY rank ASC`

  Returns `BacklogViewData { sprints: Array<{ sprint: JiraActiveSprint; issues: JiraIssue[] }>, backlog: JiraIssue[] }`.

- `BacklogViewData` interface — exported for use by BacklogPage.

`fetchBacklogIssues` was **not changed** — kept for backward compatibility with any future callers.

**`taskflow/src/routes/dashboard/BacklogPage.tsx`**

Full rewrite:

- Query changed from `fetchBacklogIssues` → `fetchBacklogView` with query key `jira-backlog-view`
- `collapsedSections: Set<string>` state tracks which sections are collapsed (all open by default)
- `allIssues` memoized from all sprint issues + backlog issues (for filter options)
- `applyFilters(issues)` helper applies epic/label/assignee filter to any issue array
- `renderSection(sectionId, title, badge, issues, showCreateStory)` renders a collapsible section
  with header button, table of BacklogRow components, and optional "+ Create Story" button
- `handleMoveToSprint` updated to optimistically update `BacklogViewData` shape (both sprints and backlog arrays)
- `BacklogFilterBar` receives combined allIssues for filter options — filters apply across all sections

**`taskflow/src/routes/dashboard/BacklogPage.test.tsx`**

Full rewrite of test mocks and assertions:

- `fetchBacklogView` mocked instead of `fetchBacklogIssues`
- `makeSprint(id, name, state)` fixture helper added
- BACK-01: asserts sprint section headers render, Active/Future badges appear, issues from all sections
- BACK-02: added test for optimistic removal from sprint sections (not just backlog)
- BACK-05: added test for row click in sprint sections
- All 16 tests pass

**`taskflow/src/routes/dashboard/BacklogRow.tsx`** — No changes needed.

**`taskflow/src/routes/dashboard/BacklogFilterBar.tsx`** — No changes needed.

## Deviations from Plan (12-04-PLAN.md)

The 12-04 plan was for route/sidebar wiring (main.tsx + Sidebar.tsx). This redesign was
a user-requested design change applied before that plan executed. The route and sidebar
wiring in the original plan still needs to be done.

## Test Results

- 16/16 BacklogPage tests pass
- Full suite: 351 tests pass (18 pre-existing unhandled errors in gitlab.test.ts from
  Tauri plugin mocking — unrelated to backlog changes)
- TypeScript: `npx tsc --noEmit` clean

## Commits

- `b76d705` feat(12-04): add fetchSprintsForBoard and fetchBacklogView to jira.ts
- `e07f9bb` feat(12-04): rewrite BacklogPage to Jira-style sprint sections layout
- `83f76e1` refactor(12-04): update BacklogPage tests for Jira-style sprint section design
