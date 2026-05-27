# Quick Task 260528-19k: Remove My Tasks Page - Research

**Researched:** 2026-05-28
**Domain:** React/TypeScript codebase cleanup — route, components, store, sidebar
**Confidence:** HIGH (all findings from direct file inspection)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Remove "Show subtasks in My Tasks" toggle from WorkflowSection AND remove `showSubtasksInMyTasks` / `setShowSubtasksInMyTasks` from the settings store — clean break
- Do NOT add a redirect for `/my-tasks` — let it 404 naturally
- Delete associated test files (MyTasksTab.test.tsx)
- Remove MyTasksTab.tsx and MyTasksSkeleton.tsx component files
- Remove the my-tasks entry from SIDEBAR_NAV_ITEMS in sidebar-items.ts
- Remove the /my-tasks route from routes.tsx
- Clean up remaining references in CommandPalette, RecentItemsPopover, Sidebar tests
</user_constraints>

## Summary

Complete map of every my-tasks reference in the codebase. There are three categories of change: (1) delete files outright, (2) remove lines/blocks from existing files, (3) update tests. The critical non-obvious finding is that `SubtasksPanel.tsx` still calls `fetchMyTasksHierarchy` and links to `/my-tasks` — this component stays (it lives on the dashboard) but needs surgical edits. `fetchMyTasksHierarchy` in `jira.ts` must also stay because SubtasksPanel depends on it.

**Primary recommendation:** Work file-by-file with the map below. The settings store version must be bumped to 24 when removing `showSubtasksInMyTasks`.

---

## File-by-File Change Map

### Files to DELETE entirely

| File | Reason |
|------|--------|
| `taskflow/src/routes/dashboard/MyTasksTab.tsx` | The page component itself |
| `taskflow/src/routes/dashboard/MyTasksSkeleton.tsx` | Used only by MyTasksTab |
| `taskflow/src/routes/dashboard/MyTasksTab.test.tsx` | Tests for the deleted component |

---

### `taskflow/src/routes/routes.tsx`

**Remove:**
- Line 6: `import MyTasksTab from './dashboard/MyTasksTab';`
- Line 39: `{ path: '/my-tasks', element: <MyTasksTab /> },`

No lazy-wrapping needed — just delete both lines. [VERIFIED: direct file inspection]

---

### `taskflow/src/components/app/sidebar-items.ts`

**Remove:** The entire `my-tasks` object from `SIDEBAR_NAV_ITEMS` (lines 45–50):
```ts
{
  id: 'my-tasks',
  label: 'My Tasks',
  path: '/my-tasks',
  iconName: 'CheckSquare',
  section: 'main',
},
```

Also remove `CheckSquare` from the Lucide imports in `Sidebar.tsx` (line 18) — it is only referenced via `ICON_MAP` which resolves by name, and `my-tasks` is the only item using `CheckSquare`. [VERIFIED: direct file inspection — no other nav item uses iconName: 'CheckSquare']

---

### `taskflow/src/components/app/Sidebar.tsx`

Two changes:

1. **`PREFETCH_ROUTES` set (line 75):** Remove `'/my-tasks'` from the set:
   ```ts
   // Before
   const PREFETCH_ROUTES = new Set(['/dashboard', '/my-tasks', '/sprint-board', '/backlog', '/epics']);
   // After
   const PREFETCH_ROUTES = new Set(['/dashboard', '/sprint-board', '/backlog', '/epics']);
   ```

2. **Comment on line 255:** Remove the comment `// /my-tasks uses fetchMyTasksHierarchy which has complex internal logic — skip prefetch.` — it becomes meaningless noise.

3. **`CheckSquare` import (line 18):** Remove `CheckSquare` from the lucide-react import list since no remaining nav item uses it.

---

### `taskflow/src/stores/settings.store.ts`

Four changes:

1. **`initialSettings` (line 43):** Remove `showSubtasksInMyTasks: true,`

2. **`SettingsState` interface (line 114):** Remove `showSubtasksInMyTasks: boolean;` and its JSDoc comment.

3. **Actions:** Remove `setShowSubtasksInMyTasks: (v: boolean) => void;` from the interface (line 190) and the implementation `setShowSubtasksInMyTasks: (v) => set({ showSubtasksInMyTasks: v }),` (line 302).

4. **Version bump + migration:** Current version is `23`. Bump to `24`. Add a `version < 24` migration block that deletes the key:
   ```ts
   if (version < 24) {
     delete (s as Record<string, unknown>).showSubtasksInMyTasks;
   }
   ```
   Also remove the existing `version < 1` migration initializer for `showSubtasksInMyTasks` (line 351) — it's made redundant by the removal but leaving it causes no harm. Removing keeps the file clean.

---

### `taskflow/src/routes/settings/WorkflowSection.tsx`

Remove the "Show subtasks in My Tasks" toggle block. Specifically:

1. **Destructure:** Remove `showSubtasksInMyTasks` and `setShowSubtasksInMyTasks` from the `useSettingsStore()` destructure (lines 16–17).

2. **JSX:** Remove the entire `<label>` block for "Show subtasks in My Tasks" (lines 47–61). The "Collapse parent stories by default" toggle above it stays. The surrounding `<div className="flex flex-col gap-4">` container stays (it still holds the sprint collapse toggle).

---

### `taskflow/src/routes/dashboard/SubtasksPanel.tsx`

**Keep the component** — it lives on the Dashboard page, not the My Tasks page.

Two changes:

1. **"View My Tasks" link (line 131):** The `<Link to="/my-tasks">` must be removed or changed to a dead-end. Since the route no longer exists, remove the link entirely. The `hasMore` branch text "View all N in My Tasks" also goes. Simplest: remove the entire `{/* View all link */}` block (lines 129–133). If you want to preserve the "view more" hint, convert it to plain text with no link — but the CONTEXT says clean removal, so just delete it.

2. **Comment (line 7):** Remove the comment referencing "Shares the 'jira-issues' cache with MyTasksTab" — MyTasksTab is gone.

**Do NOT remove** `fetchMyTasksHierarchy` import or the query — SubtasksPanel still uses that data to populate the My Subtasks widget on the Dashboard.

---

### `taskflow/src/services/jira.ts`

**No changes needed.** `fetchMyTasksHierarchy` (line 549) must stay — SubtasksPanel still calls it. The comment on line 350 (`@param assignedToMe — my-tasks variant`) is internal documentation for a different function and is harmless to leave.

---

### `taskflow/src/main.tsx`

Two changes:

1. **`routeLabel` function (line 288):** Remove `if (pathname.startsWith('/my-tasks')) return 'My Tasks';`

2. **Comment on line 331:** `// Cache shapes vary: sprint-board is flat JiraIssue[], my-tasks is { issues: JiraIssue[] },` — remove the `my-tasks` mention from the comment. The actual code below it (line 342–355) still works because it handles `{ issues: [] }` shape generically; it won't break. Just update the comment to not mention my-tasks.

---

### `taskflow/src/routes/dashboard/WikiRenderer.tsx`

**Line 914:** Remove the `'/my-tasks': 'My Tasks',` entry from the `staticLabels` record.

---

### `taskflow/src/routes/dashboard/DiscussionThreads.tsx`

**Line 56:** Remove the `'/my-tasks': 'My Tasks',` entry from the `staticLabels` record (identical pattern to WikiRenderer).

---

### `taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts`

**Line 115:** Remove `queryClient.invalidateQueries({ queryKey: ['jira-issues', 'my-tasks'] });`

This invalidation was a courtesy cache-bust when an issue is created/updated. Removing it is safe — SubtasksPanel uses the same cache key but the data will refresh on the next staleTime cycle (30s). [VERIFIED: direct file inspection]

---

### `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx`

**Line 253:** Remove `queryClient.invalidateQueries({ queryKey: ['jira-issues', 'my-tasks'] });`

Same rationale as useIssueMutations above.

---

### `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts`

**Line 44:** Remove `queryClient.invalidateQueries({ queryKey: ['jira-issues', 'my-tasks'] });`

Same rationale.

---

### `taskflow/src/components/app/CommandPalette.tsx`

Lines 93–98 read the `['jira-issues', 'my-tasks', ...]` cache entry:
```ts
const cachedMyTasks = queryClient.getQueryData<{ issues: JiraIssue[] }>([
  'jira-issues',
  'my-tasks',
  activeJiraProject,
  storyPointsFieldKey,
]);
```
And lines 108–110 iterate it:
```ts
for (const issue of cachedMyTasks?.issues ?? []) {
  if (!issuesMap.has(issue.key)) issuesMap.set(issue.key, issue);
}
```

**Remove both blocks** (lines 93–113 merge into just the sprint-board loop). The deduplication still works with only `cachedSprintBoard`. The `allIssues` variable stays as is.

---

### `taskflow/src/components/app/RecentItemsPopover.tsx`

No code changes needed. The comment on line 23 mentions `my-tasks ({ issues: JiraIssue[] })` — this is a JSDoc comment describing cache shapes. The code itself uses generic `getQueriesData` and handles `{ issues: [] }` shape generically; removing the My Tasks page does not break it. Optionally update the comment on line 23 and line 29 to remove the `my-tasks` mention, but this is cosmetic only.

---

## Test File Changes

### `taskflow/src/components/app/Sidebar.test.tsx`

The mock `sidebarItems` on line 72–81 includes `{ id: 'my-tasks', visible: true }`. Remove that entry. No tests assert on "My Tasks" text, so removal won't break any existing assertions.

### `taskflow/src/routes/settings/Settings.test.tsx`

Two locations:
1. **Lines 122–130:** `sidebarItems` mock includes `{ id: 'my-tasks', visible: true }` — remove it.
2. **Lines 253–266:** `WorkflowSection content` describe block has tests that assert `showSubtasksInMyTasks` and `setShowSubtasksInMyTasks` — specifically:
   - "renders show subtasks toggle" (line 252) — **delete this test**
   - "subtasks toggle reflects showSubtasksInMyTasks from store (true by default)" (line 266) — **delete this test**
   - "toggling subtasks calls setShowSubtasksInMyTasks" (line 279) — **delete this test**
   - The `mockSettingsStore` on line 91 includes `showSubtasksInMyTasks: true` and `setShowSubtasksInMyTasks: vi.fn()` — **remove both lines**

### `taskflow/src/routes/settings/ConnectionsSection.test.tsx`

The mock `mockSettingsStore` on lines 43–66 includes:
- `showSubtasksInMyTasks: true,` (line 47) — **remove**
- `setShowSubtasksInMyTasks: vi.fn(),` (line 60) — **remove**

### `taskflow/src/routes/settings/SidebarItemsList.test.tsx`

Line 57: Test asserts `setSidebarItemVisible` is called with `'my-tasks', false` for checkbox index 1:
```ts
await user.click(checkboxes[1]);
expect(setSidebarItemVisible).toHaveBeenCalledWith('my-tasks', false);
```
After removing the my-tasks item from `SIDEBAR_NAV_ITEMS`, checkbox index 1 will be `standup-notes`. **Update this test** to use `'standup-notes'` as the expected id, or update the assertion to whatever is now index 1 in the sorted items.

### `taskflow/src/routes/dashboard/SubtasksPanel.test.tsx`

Line 43 mocks `fetchMyTasksHierarchy`. This stays because SubtasksPanel still calls it. No changes needed to this test file.

---

## Summary Table

| File | Action |
|------|--------|
| `routes/dashboard/MyTasksTab.tsx` | DELETE |
| `routes/dashboard/MyTasksSkeleton.tsx` | DELETE |
| `routes/dashboard/MyTasksTab.test.tsx` | DELETE |
| `routes/routes.tsx` | Remove import + route object |
| `components/app/sidebar-items.ts` | Remove my-tasks nav item object |
| `components/app/Sidebar.tsx` | Remove from PREFETCH_ROUTES, remove comment, remove CheckSquare import |
| `stores/settings.store.ts` | Remove field + setter, bump version to 24, add migration |
| `routes/settings/WorkflowSection.tsx` | Remove "Show subtasks in My Tasks" toggle |
| `routes/dashboard/SubtasksPanel.tsx` | Remove "View My Tasks" link block and stale comment |
| `services/jira.ts` | No changes |
| `main.tsx` | Remove routeLabel entry, update comment |
| `routes/dashboard/WikiRenderer.tsx` | Remove '/my-tasks' from staticLabels |
| `routes/dashboard/DiscussionThreads.tsx` | Remove '/my-tasks' from staticLabels |
| `routes/dashboard/create-edit-issue/useIssueMutations.ts` | Remove invalidateQueries call |
| `routes/dashboard/issue-detail/FieldsSection.tsx` | Remove invalidateQueries call |
| `routes/dashboard/issue-detail/useFieldMutation.ts` | Remove invalidateQueries call |
| `components/app/CommandPalette.tsx` | Remove cachedMyTasks read + loop |
| `components/app/RecentItemsPopover.tsx` | Comments only (optional) |
| `components/app/Sidebar.test.tsx` | Remove my-tasks from sidebarItems mock |
| `routes/settings/Settings.test.tsx` | Remove mock fields + 3 test cases |
| `routes/settings/ConnectionsSection.test.tsx` | Remove 2 mock fields |
| `routes/settings/SidebarItemsList.test.tsx` | Update checkbox index 1 assertion |

## Sources

- All findings: direct file inspection [VERIFIED]
