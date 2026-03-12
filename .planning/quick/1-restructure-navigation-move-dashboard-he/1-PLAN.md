---
phase: quick-1
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/main.tsx
  - taskflow/src/routes/dashboard/index.tsx
  - taskflow/src/components/app/Sidebar.tsx
  - taskflow/src/stores/dashboard.store.ts
autonomous: true
requirements:
  - restructure-nav-1

must_haves:
  truths:
    - "Sidebar shows Dashboard, then role-specific page links (filtered by role), then Settings — flat, no grouping headers"
    - "Each former tab is reachable at its own route: /my-tasks, /sprint-board, /mr-attention (dev) and /sprint-progress, /workload, /releases (pm)"
    - "/dashboard renders a role-aware overview page with summary cards, not tabs"
    - "Role-specific sidebar links show only for the current role"
    - "Existing tab components (MyTasksTab, SprintBoardTab, etc.) render unchanged at their new routes"
  artifacts:
    - path: "taskflow/src/main.tsx"
      provides: "Route definitions for all 6 new flat routes + updated /dashboard"
    - path: "taskflow/src/routes/dashboard/index.tsx"
      provides: "Role-aware overview page with summary cards (no tabs)"
    - path: "taskflow/src/components/app/Sidebar.tsx"
      provides: "Role-filtered flat nav: Dashboard → [role pages] → Settings"
  key_links:
    - from: "taskflow/src/components/app/Sidebar.tsx"
      to: "main.tsx routes"
      via: "react-router-dom Link to='/my-tasks' etc."
      pattern: "to=\"/(my-tasks|sprint-board|mr-attention|sprint-progress|workload|releases)\""
    - from: "taskflow/src/routes/dashboard/index.tsx"
      to: "useSettingsStore"
      via: "role check for conditional card content"
      pattern: "useSettingsStore.*role"
---

<objective>
Restructure navigation by promoting each dashboard tab to its own route, updating the sidebar with role-aware flat links, and replacing the Dashboard page with a role-aware overview/summary page.

Purpose: The current tab-based Dashboard is a single page with all feature content. Moving each tab to its own route gives each view a persistent URL, enables direct navigation from the sidebar, and frees the Dashboard route to serve as a meaningful at-a-glance overview.

Output: Updated main.tsx with 6 new routes, updated Sidebar with role-filtered nav links, new Dashboard overview page with summary cards.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@taskflow/src/main.tsx
@taskflow/src/components/app/Sidebar.tsx
@taskflow/src/routes/dashboard/index.tsx
@taskflow/src/stores/dashboard.store.ts
@taskflow/src/stores/settings.store.ts
</context>

<interfaces>
<!-- Key types and patterns the executor needs. -->

From taskflow/src/stores/settings.store.ts:
```typescript
// Role type
role: 'developer' | 'pm' | null
// Access via:
const role = useSettingsStore((s) => s.role);
```

From taskflow/src/routes/dashboard/ (existing tab components — unchanged, just re-routed):
```
MyTasksTab        → src/routes/dashboard/MyTasksTab.tsx
SprintBoardTab    → src/routes/dashboard/SprintBoardTab.tsx
MrAttentionTab    → src/routes/dashboard/MrAttentionTab.tsx
SprintProgressTab → src/routes/dashboard/SprintProgressTab.tsx
WorkloadTab       → src/routes/dashboard/WorkloadTab.tsx
ReleasesTab       → src/routes/dashboard/ReleasesTab.tsx
```

Current Sidebar Link style (copy for new links):
```tsx
<Link
  to="/dashboard"
  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent transition-colors"
>
  <LayoutDashboard className="h-4 w-4 shrink-0" />
  <span className="hidden md:block">Dashboard</span>
</Link>
```

Current router setup in main.tsx uses createHashRouter — new routes follow same pattern:
```tsx
{ path: '/my-tasks', element: <MyTasksTab /> }
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add flat routes to router and update Sidebar with role-aware nav links</name>
  <files>taskflow/src/main.tsx, taskflow/src/components/app/Sidebar.tsx, taskflow/src/stores/dashboard.store.ts</files>
  <action>
**main.tsx:** Import the 6 tab components (MyTasksTab, SprintBoardTab, MrAttentionTab, SprintProgressTab, WorkloadTab, ReleasesTab) and add their routes to the createHashRouter children array:
```
{ path: '/my-tasks', element: <MyTasksTab /> }
{ path: '/sprint-board', element: <SprintBoardTab /> }
{ path: '/mr-attention', element: <MrAttentionTab /> }
{ path: '/sprint-progress', element: <SprintProgressTab /> }
{ path: '/workload', element: <WorkloadTab /> }
{ path: '/releases', element: <ReleasesTab /> }
```
Keep `/dashboard` route pointing to the existing Dashboard component (will be updated in Task 2).

**Sidebar.tsx:** Replace the role label placeholder div with role-conditional Link items. Use the same Link className as the existing Dashboard link. Import appropriate Lucide icons (CheckSquare for My Tasks, KanbanSquare for Sprint Board, GitMerge for MR Attention, BarChart2 for Sprint Progress, Users for Workload, Tag for Releases). Structure:
1. Dashboard link (always shown)
2. Developer links (shown only when `role === 'developer'`): My Tasks → /my-tasks, Sprint Board → /sprint-board, MR Attention → /mr-attention
3. PM links (shown only when `role === 'pm'`): Sprint Progress → /sprint-progress, Workload → /workload, Releases → /releases
4. Settings link at bottom (unchanged)

Remove the `ROLE_LABELS` constant and the old role label div — they are replaced by the nav links.

**dashboard.store.ts:** The `DashTab`, `PmDashTab` types and the store state (`activeTab`, `pmActiveTab`) are no longer needed since tabs are replaced by routes. Remove the file entirely OR simplify it to an empty store export so nothing breaks. Check if `useDashboardStore` is imported anywhere else before removing — if other files import it, keep a minimal stub. The route components (MyTasksTab etc.) do not use the dashboard store, so it can be safely removed. Delete dashboard.store.ts.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -40</automated>
  </verify>
  <done>TypeScript compiles without errors. Sidebar imports correctly. All 6 new routes registered. dashboard.store.ts removed (or confirmed unused).</done>
</task>

<task type="auto">
  <name>Task 2: Replace Dashboard page with role-aware overview summary cards</name>
  <files>taskflow/src/routes/dashboard/index.tsx</files>
  <action>
Rewrite `taskflow/src/routes/dashboard/index.tsx` as a role-aware overview page. Remove all tab/Tabs imports and useDashboardStore usage.

The page renders a grid of summary cards. Use a 3-column grid on large screens, 1-column on mobile (same Tailwind pattern as rest of app: `grid grid-cols-1 sm:grid-cols-3 gap-4`).

Each card is a simple div with `rounded-lg border border-border bg-card p-4` styling. Cards contain:
- A label (text-sm text-muted-foreground)
- A prominent value (text-2xl font-bold) — use a static placeholder string like `"—"` since live data queries are out of scope for this task
- Optionally a small sub-label

**Developer cards (role === 'developer' or role === null fallback to developer):**
1. Active Sprint Tasks — label: "Active Sprint Tasks", value: "—"
2. Open MRs — label: "Open MRs", value: "—"
3. MRs Needing Attention — label: "MRs Needing Attention", value: "—"

**PM cards (role === 'pm'):**
1. Sprint Completion — label: "Sprint Completion", value: "—"
2. Team Workload — label: "Team Workload", value: "—"
3. Next Release — label: "Next Release", value: "—"

Add a page heading: `<h1 className="text-xl font-semibold">Overview</h1>` above the grid.

Wrap in `<div className="flex flex-col h-full p-4 gap-4">` to match existing page layout.

No data fetching — all values are static `"—"` placeholders. The cards/widgets layout makes them easy to wire up later (as per the user decision: "keep it extensible").

The component should only import: React (if needed), `useSettingsStore` from `@/stores/settings.store`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -40</automated>
  </verify>
  <done>TypeScript compiles without errors. dashboard/index.tsx renders role-conditional summary cards with no tab components or useDashboardStore references.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    - 6 new routes: /my-tasks, /sprint-board, /mr-attention, /sprint-progress, /workload, /releases
    - Updated sidebar with role-filtered flat nav links
    - New Dashboard overview page with summary cards (no tabs)
  </what-built>
  <how-to-verify>
    1. Run `cd /Users/mimo/Desktop/Tasker/taskflow && npm run dev` to start the app
    2. Complete onboarding (or use an existing session) as Developer role
    3. Verify sidebar shows: Dashboard, My Tasks, Sprint Board, MR Attention, Settings
    4. Click each sidebar link — verify it navigates to the correct page (the existing tab content)
    5. Click Dashboard — verify the overview page with "Active Sprint Tasks", "Open MRs", "MRs Needing Attention" cards
    6. Switch role to PM in Settings
    7. Verify sidebar now shows: Dashboard, Sprint Progress, Workload, Releases, Settings
    8. Verify Dashboard overview shows PM cards (Sprint Completion, Team Workload, Next Release)
    9. Navigate to /sprint-progress, /workload, /releases via sidebar — verify content loads
  </how-to-verify>
  <resume-signal>Type "approved" or describe any issues found</resume-signal>
</task>

</tasks>

<verification>
- TypeScript compiles without errors after both code tasks
- All 6 former tab routes are registered in createHashRouter
- Sidebar renders role-specific links based on current role from useSettingsStore
- Dashboard/index.tsx has no Tabs import, no useDashboardStore import
- dashboard.store.ts is deleted (no remaining imports)
</verification>

<success_criteria>
- Sidebar displays flat role-aware nav (Dashboard + role pages + Settings)
- Each former tab accessible at its own URL
- /dashboard shows a role-conditional overview with summary cards
- No TypeScript errors
- Existing tab component behavior unchanged at new routes
</success_criteria>

<output>
After completion, create `.planning/quick/1-restructure-navigation-move-dashboard-he/1-SUMMARY.md` with what was built, files changed, and any decisions made during execution.
</output>
