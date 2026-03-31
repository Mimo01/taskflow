---
phase: quick
plan: 260331-wzn
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/app/sidebar-items.ts
  - taskflow/src/routes/routes.tsx
  - taskflow/src/main.tsx
  - taskflow/src/routes/dashboard/widgets/registry.ts
  - taskflow/src/routes/settings/Settings.test.tsx
autonomous: true
requirements: [QUICK]
must_haves:
  truths:
    - "MR Attention does not appear in the sidebar navigation"
    - "Navigating to /mr-attention does not render a page"
    - "MR Attention widget is not available in the dashboard widget registry"
    - "All tests pass after removal"
  artifacts:
    - removed: "taskflow/src/routes/dashboard/MrAttentionTab.tsx"
    - removed: "taskflow/src/routes/dashboard/MrAttentionTab.test.tsx"
    - removed: "taskflow/src/routes/dashboard/MrAttentionSkeleton.tsx"
    - removed: "taskflow/src/routes/dashboard/widgets/MrAttentionWidget.tsx"
  key_links:
    - from: "sidebar-items.ts"
      to: "routes.tsx"
      via: "mr-attention entry removed from both"
---

<objective>
Remove the MR Attention feature entirely: sidebar nav entry, dedicated page/route, dashboard widget, skeleton, and all associated test files.

Purpose: User no longer wants the MR Attention page — clean removal without replacement.
Output: Codebase with no MR Attention references in active code.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/components/app/sidebar-items.ts
@taskflow/src/routes/routes.tsx
@taskflow/src/main.tsx
@taskflow/src/routes/dashboard/widgets/registry.ts
@taskflow/src/routes/settings/Settings.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove MR Attention sidebar entry, route, and breadcrumb</name>
  <files>
    taskflow/src/components/app/sidebar-items.ts
    taskflow/src/routes/routes.tsx
    taskflow/src/main.tsx
    taskflow/src/routes/settings/Settings.test.tsx
  </files>
  <action>
1. In `sidebar-items.ts`:
   - Remove the `mr-attention` entry from `SIDEBAR_NAV_ITEMS` array (lines 66-71: id 'mr-attention', label 'MR Attention', path '/mr-attention')
   - Remove `'mr-attention'` from the `devVisible` set in `getDefaultSidebarItems` (line 96)

2. In `routes.tsx`:
   - Remove the import of `MrAttentionTab` (line 6: `import MrAttentionTab from './dashboard/MrAttentionTab'`)
   - Remove the route entry (line 41: `{ path: '/mr-attention', element: <MrAttentionTab /> }`)

3. In `main.tsx`:
   - Remove the breadcrumb label line (line 259: `if (pathname.startsWith('/mr-attention')) return 'MR Attention';`)

4. In `Settings.test.tsx`:
   - Remove `{ id: 'mr-attention', visible: true }` from the mock sidebarItems array (line 128)
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>No MR Attention references in sidebar config, routing, breadcrumbs, or settings tests</done>
</task>

<task type="auto">
  <name>Task 2: Remove MR Attention widget and delete component files</name>
  <files>
    taskflow/src/routes/dashboard/widgets/registry.ts
    taskflow/src/routes/dashboard/MrAttentionTab.tsx (DELETE)
    taskflow/src/routes/dashboard/MrAttentionTab.test.tsx (DELETE)
    taskflow/src/routes/dashboard/MrAttentionSkeleton.tsx (DELETE)
    taskflow/src/routes/dashboard/widgets/MrAttentionWidget.tsx (DELETE)
  </files>
  <action>
1. In `registry.ts`:
   - Remove the import of `MrAttentionWidget` (line 28: `import MrAttentionWidget from './MrAttentionWidget'`)
   - Remove the `'mr-attention'` entry from `WIDGET_REGISTRY` (lines 97-106)

2. Delete the following files entirely:
   - `taskflow/src/routes/dashboard/MrAttentionTab.tsx`
   - `taskflow/src/routes/dashboard/MrAttentionTab.test.tsx`
   - `taskflow/src/routes/dashboard/MrAttentionSkeleton.tsx`
   - `taskflow/src/routes/dashboard/widgets/MrAttentionWidget.tsx`

Note: `MrHealthPanel.tsx` and `MyTasksTab.tsx` have comments mentioning MrAttentionTab for cache-sharing context. These are just code comments — update them to remove stale references to MrAttentionTab (e.g., in MyTasksTab.tsx lines 82, 108, 134 and MrHealthPanel.tsx lines 8-9). Change comments to only reference the remaining components that share the cache.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit && npx vitest run --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>All MrAttention files deleted, widget registry clean, TypeScript compiles, all tests pass</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with no errors
- `npx vitest run` — all tests pass
- No remaining imports or references to MrAttention in active source files (grep confirms)
</verification>

<success_criteria>
- MR Attention sidebar item gone from nav definitions and presets
- /mr-attention route removed
- MR Attention dashboard widget removed from registry
- All 4 MrAttention component/test files deleted
- TypeScript compilation clean
- All tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/260331-wzn-remove-the-mr-attention-from-sidebar-and/260331-wzn-SUMMARY.md`
</output>
