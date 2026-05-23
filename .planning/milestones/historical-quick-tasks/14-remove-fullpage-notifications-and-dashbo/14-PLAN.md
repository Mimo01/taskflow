---
phase: quick-14
plan: 14
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/notifications/index.tsx
  - taskflow/src/routes/dashboard/NotificationsPanel.tsx
  - taskflow/src/routes/dashboard/NotificationsPanel.test.tsx
  - taskflow/src/routes/dashboard/index.tsx
  - taskflow/src/components/app/Sidebar.tsx
  - taskflow/src/main.tsx
autonomous: true
requirements: [QUICK-14]

must_haves:
  truths:
    - "Dashboard no longer shows a Notifications card (for any role)"
    - "Sidebar no longer has a Notifications nav link"
    - "Top bar bell icon + popover still works"
    - "No dead imports or broken references remain"
  artifacts:
    - path: "taskflow/src/routes/dashboard/index.tsx"
      provides: "Dashboard without NotificationsPanel"
    - path: "taskflow/src/components/app/Sidebar.tsx"
      provides: "Sidebar without Notifications NavLink"
    - path: "taskflow/src/main.tsx"
      provides: "Router without /notifications route"
  key_links:
    - from: "taskflow/src/routes/dashboard/index.tsx"
      to: "NotificationsPanel"
      via: "import + JSX"
      pattern: "NotificationsPanel"
    - from: "taskflow/src/components/app/Sidebar.tsx"
      to: "/notifications"
      via: "NavLink"
      pattern: "/notifications"
    - from: "taskflow/src/main.tsx"
      to: "NotificationsPage"
      via: "import + route"
      pattern: "NotificationsPage"
---

<objective>
Remove the fullpage notifications route (/notifications) and the dashboard NotificationsPanel card.

Purpose: Notifications are now exclusively surfaced through the top-bar bell + popover. The dedicated page and dashboard card are redundant and add navigation complexity.
Output: Three surfaces cleaned — dashboard index, sidebar, and router. TopBar bell/popover and all notification infrastructure (store, polling, services) are untouched.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove NotificationsPanel from dashboard and delete its files</name>
  <files>
    taskflow/src/routes/dashboard/index.tsx,
    taskflow/src/routes/dashboard/NotificationsPanel.tsx,
    taskflow/src/routes/dashboard/NotificationsPanel.test.tsx
  </files>
  <action>
    1. Edit `taskflow/src/routes/dashboard/index.tsx`:
       - Remove `import NotificationsPanel from './NotificationsPanel'`
       - In the `pm` role branch: the grid currently holds `SprintHealthPanel` + `NotificationsPanel`. Remove `<NotificationsPanel />` so only `SprintHealthPanel` remains. Change the grid to `grid-cols-1` (single column) since only one panel is left.
       - In the developer/tech-lead branch: the 2x2 grid currently holds SubtasksPanel, MrHealthPanel, SprintHealthPanel, NotificationsPanel. Remove `<NotificationsPanel />`. The remaining three panels stay in the `grid-cols-1 lg:grid-cols-2` grid (asymmetric layout is fine).
    2. Delete `taskflow/src/routes/dashboard/NotificationsPanel.tsx`
    3. Delete `taskflow/src/routes/dashboard/NotificationsPanel.test.tsx`
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Dashboard renders without NotificationsPanel; no TypeScript errors from dashboard files; NotificationsPanel files deleted.</done>
</task>

<task type="auto">
  <name>Task 2: Remove /notifications route from router and Bell NavLink from sidebar</name>
  <files>
    taskflow/src/main.tsx,
    taskflow/src/components/app/Sidebar.tsx
  </files>
  <action>
    1. Edit `taskflow/src/main.tsx`:
       - Remove `import NotificationsPage from './routes/notifications/index'`
       - Remove the route entry `{ path: '/notifications', element: <NotificationsPage /> }` from the router children array
    2. Edit `taskflow/src/components/app/Sidebar.tsx`:
       - Remove the `Bell` import from lucide-react
       - Remove the entire `<NavLink to="/notifications" ...>` block (the Bell icon + "Notifications" span) from the bottom utility section
    3. Verify no other file imports from `./routes/notifications/index` (the fullpage component). The sub-components NotificationRow, NotificationDetail, NotificationPopover remain — they are used by TopBar/NotificationPopover.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>TypeScript compiles clean; `grep -r "NotificationsPage" taskflow/src` returns no results; `grep -r 'to="/notifications"' taskflow/src` returns no results.</done>
</task>

</tasks>

<verification>
After both tasks:
- `cd /Users/mimo/Desktop/Tasker/taskflow && npm run build` completes without errors
- `grep -r "NotificationsPanel" taskflow/src` returns no results
- `grep -r "NotificationsPage" taskflow/src` returns no results
- `grep -r 'to="/notifications"' taskflow/src` returns no results
- NotificationPopover, NotificationRow, NotificationDetail, notifications.store, useNotificationPolling — all still present and referenced by TopBar
</verification>

<success_criteria>
- Dashboard cards: SubtasksPanel + MrHealthPanel + SprintHealthPanel only (developer); SprintHealthPanel only (PM)
- Sidebar bottom section: Debug Logs (when debugMode) + Settings only — no Bell/Notifications link
- Top bar: Bell icon with badge and popover still fully functional
- Build passes with zero TypeScript errors
- No orphaned imports
</success_criteria>

<output>
After completion, create `.planning/quick/14-remove-fullpage-notifications-and-dashbo/14-SUMMARY.md`
</output>
