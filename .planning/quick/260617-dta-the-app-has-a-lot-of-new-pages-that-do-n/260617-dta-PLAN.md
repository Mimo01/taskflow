---
phase: quick
plan: 260617-dta
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/shortcuts.ts
  - taskflow/src/main.tsx
  - taskflow/src-tauri/src/lib.rs
autonomous: true
requirements: []
must_haves:
  truths:
    - "All sidebar pages have a keyboard shortcut to open them directly"
    - "Shortcuts appear in the Command Palette Navigation group with their key hint"
    - "Shortcuts appear in the Keyboard Shortcuts Panel under Navigation"
    - "Shortcuts work from the macOS Go menu in the native menu bar"
  artifacts:
    - path: "taskflow/src/lib/shortcuts.ts"
      provides: "Nav shortcut entries for all pages"
      contains: "nav-dashboard, nav-my-tasks, nav-standup, nav-epics, nav-merge-requests, nav-releases, nav-worklogs"
    - path: "taskflow/src/main.tsx"
      provides: "useHotkeys bindings and listen handlers for new shortcuts"
    - path: "taskflow/src-tauri/src/lib.rs"
      provides: "Go menu items with accelerators for new pages"
  key_links:
    - from: "taskflow/src/lib/shortcuts.ts"
      to: "taskflow/src/components/app/CommandPalette.tsx"
      via: "NAV_SHORTCUTS filter"
      pattern: "NAV_SHORTCUTS"
    - from: "taskflow/src-tauri/src/lib.rs"
      to: "taskflow/src/main.tsx"
      via: "Tauri emit + listen"
      pattern: "menu-nav-"
---

<objective>
Add keyboard shortcuts and native macOS menu entries for all sidebar pages that currently lack them.

Pages currently without shortcuts: Dashboard, My Tasks, Standup Notes, Epics, Merge Requests, Releases, Worklogs. AIO Cycles has a dynamic route and is excluded.

Purpose: Users can navigate to any page via keyboard or the native Go menu without touching the mouse.

Output: Seven new nav shortcuts registered in shortcuts.ts, wired in main.tsx (useHotkeys + Tauri event listeners), and exposed in lib.rs Go menu with accelerators.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/STATE.md
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/lib/shortcuts.ts
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/main.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src-tauri/src/lib.rs
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/components/app/sidebar-items.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Register new nav shortcuts in shortcuts.ts</name>
  <files>taskflow/src/lib/shortcuts.ts</files>
  <action>
    Append seven new Navigation category entries to the SHORTCUTS array in `taskflow/src/lib/shortcuts.ts`, after the existing nav entries (nav-settings, nav-devtools). Each entry needs id, defaultKey, description, category: 'Navigation', displayKeys, and navMeta with label and route.

    Add in this order with these exact key assignments (chosen to avoid collisions with existing Cmd+Shift+S/B/N/D and Cmd+,):

    - id: 'nav-dashboard', defaultKey: 'mod+shift+h', description: 'Go to Dashboard', displayKeys: ['⌘', '⇧', 'H'], navMeta: { label: 'Dashboard', route: '/dashboard' }
    - id: 'nav-my-tasks', defaultKey: 'mod+shift+t', description: 'Go to My Tasks', displayKeys: ['⌘', '⇧', 'T'], navMeta: { label: 'My Tasks', route: '/my-tasks' }
    - id: 'nav-standup', defaultKey: 'mod+shift+u', description: 'Go to Standup Notes', displayKeys: ['⌘', '⇧', 'U'], navMeta: { label: 'Standup Notes', route: '/standup-notes' }
    - id: 'nav-epics', defaultKey: 'mod+shift+e', description: 'Go to Epics', displayKeys: ['⌘', '⇧', 'E'], navMeta: { label: 'Epics', route: '/epics' }
    - id: 'nav-merge-requests', defaultKey: 'mod+shift+m', description: 'Go to Merge Requests', displayKeys: ['⌘', '⇧', 'M'], navMeta: { label: 'Merge Requests', route: '/merge-requests' }
    - id: 'nav-releases', defaultKey: 'mod+shift+r', description: 'Go to Releases', displayKeys: ['⌘', '⇧', 'R'], navMeta: { label: 'Releases', route: '/releases' }
    - id: 'nav-worklogs', defaultKey: 'mod+shift+w', description: 'Go to Worklogs', displayKeys: ['⌘', '⇧', 'W'], navMeta: { label: 'Worklogs', route: '/worklogs' }

    The navMeta field is typed as optional in ShortcutEntry but NAV_SHORTCUTS filter requires it non-null; all seven entries must include navMeta so they appear in the Command Palette navigation group automatically.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && grep -c "nav-dashboard\|nav-my-tasks\|nav-standup\|nav-epics\|nav-merge-requests\|nav-releases\|nav-worklogs" src/lib/shortcuts.ts</automated>
  </verify>
  <done>Seven new nav-* ids are present in shortcuts.ts and all include navMeta with route and label.</done>
</task>

<task type="auto">
  <name>Task 2: Wire shortcuts in main.tsx (useHotkeys + Tauri listeners)</name>
  <files>taskflow/src/main.tsx</files>
  <action>
    In `taskflow/src/main.tsx`, add useHotkeys calls and Tauri event listeners for all seven new pages. Follow the existing KEYS-03 pattern exactly.

    After the existing `useHotkeys('mod+shift+d', ...)` line, add:

      useHotkeys('mod+shift+h', () => navigate('/dashboard'));
      useHotkeys('mod+shift+t', () => navigate('/my-tasks'));
      useHotkeys('mod+shift+u', () => navigate('/standup-notes'));
      useHotkeys('mod+shift+e', () => navigate('/epics'));
      useHotkeys('mod+shift+m', () => navigate('/merge-requests'));
      useHotkeys('mod+shift+r', () => navigate('/releases'));
      useHotkeys('mod+shift+w', () => navigate('/worklogs'));

    In the Tauri `listen` array (the one inside the useEffect that registers menu listeners), add after `listen('menu-dev-tools', ...)`:

      listen('menu-nav-dashboard', () => navigate('/dashboard')),
      listen('menu-nav-my-tasks', () => navigate('/my-tasks')),
      listen('menu-nav-standup', () => navigate('/standup-notes')),
      listen('menu-nav-epics', () => navigate('/epics')),
      listen('menu-nav-merge-requests', () => navigate('/merge-requests')),
      listen('menu-nav-releases', () => navigate('/releases')),
      listen('menu-nav-worklogs', () => navigate('/worklogs')),

    In the `on_menu_event` match arm (the string list in the match block), add all seven new menu ids:
      "menu-nav-dashboard" | "menu-nav-my-tasks" | "menu-nav-standup" | "menu-nav-epics" | "menu-nav-merge-requests" | "menu-nav-releases" | "menu-nav-worklogs"

    Wait — the on_menu_event match is in lib.rs not main.tsx. Only add useHotkeys and listen() here.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && grep -c "nav-dashboard\|nav-my-tasks\|nav-standup\|nav-epics\|nav-merge-requests\|nav-releases\|nav-worklogs" src/main.tsx</automated>
  </verify>
  <done>main.tsx has 7 useHotkeys calls and 7 listen() entries for the new pages.</done>
</task>

<task type="auto">
  <name>Task 3: Add Go menu items and event routing in lib.rs</name>
  <files>taskflow/src-tauri/src/lib.rs</files>
  <action>
    In `taskflow/src-tauri/src/lib.rs`, add seven new menu items to the "Go" submenu and route their events.

    After `nav_backlog_item` (before the `go_menu` Submenu::with_items call), declare:

      let nav_dashboard_item = MenuItemBuilder::new("Dashboard")
          .id("menu-nav-dashboard")
          .accelerator("CmdOrCtrl+Shift+H")
          .build(handle)?;
      let nav_my_tasks_item = MenuItemBuilder::new("My Tasks")
          .id("menu-nav-my-tasks")
          .accelerator("CmdOrCtrl+Shift+T")
          .build(handle)?;
      let nav_standup_item = MenuItemBuilder::new("Standup Notes")
          .id("menu-nav-standup")
          .accelerator("CmdOrCtrl+Shift+U")
          .build(handle)?;
      let nav_epics_item = MenuItemBuilder::new("Epics")
          .id("menu-nav-epics")
          .accelerator("CmdOrCtrl+Shift+E")
          .build(handle)?;
      let nav_merge_requests_item = MenuItemBuilder::new("Merge Requests")
          .id("menu-nav-merge-requests")
          .accelerator("CmdOrCtrl+Shift+M")
          .build(handle)?;
      let nav_releases_item = MenuItemBuilder::new("Releases")
          .id("menu-nav-releases")
          .accelerator("CmdOrCtrl+Shift+R")
          .build(handle)?;
      let nav_worklogs_item = MenuItemBuilder::new("Worklogs")
          .id("menu-nav-worklogs")
          .accelerator("CmdOrCtrl+Shift+W")
          .build(handle)?;

    In `go_menu` Submenu::with_items, restructure the items list to group them logically with a separator before Settings. Suggested order:

      &nav_dashboard_item,
      &nav_my_tasks_item,
      &nav_standup_item,
      &PredefinedMenuItem::separator(handle)?,
      &nav_sprint_item,
      &nav_backlog_item,
      &nav_epics_item,
      &PredefinedMenuItem::separator(handle)?,
      &nav_merge_requests_item,
      &PredefinedMenuItem::separator(handle)?,
      &nav_releases_item,
      &nav_worklogs_item,
      &nav_notifications_item,
      &PredefinedMenuItem::separator(handle)?,
      &nav_settings_item,

    In the `on_menu_event` match arm, extend the existing string list to include all seven new ids:
      "menu-nav-dashboard" | "menu-nav-my-tasks" | "menu-nav-standup" | "menu-nav-epics" | "menu-nav-merge-requests" | "menu-nav-releases" | "menu-nav-worklogs"

    Add these to the existing match pattern alongside the current ids (they all use the same `let _ = app.emit(id, ());` body).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && cargo build 2>&1 | tail -5</automated>
  </verify>
  <done>Rust compiles without errors. All seven menu-nav-* ids are declared, included in the Go submenu, and routed in on_menu_event.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| keyboard → navigate() | Hotkey triggers client-side navigation only; no external input |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation |
|-----------|----------|-----------|-------------|------------|
| T-dta-01 | Tampering | Tauri menu accelerators | accept | All routes are internal; no user-supplied data in navigation paths |
</threat_model>

<verification>
1. Run `npm run check` in taskflow/ — biome + tsc must pass clean
2. Run `cargo build` in taskflow/ — Rust must compile
3. Open app and press Cmd+Shift+H → should navigate to Dashboard
4. Open Command Palette (Cmd+F) with empty query → Navigation group should list all new pages with their shortcuts
5. Open Keyboard Shortcuts panel (Cmd+/) → Navigation section should show all new entries
6. Use macOS menu bar Go menu → all new pages should appear with accelerators
</verification>

<success_criteria>
- All seven new pages (Dashboard, My Tasks, Standup Notes, Epics, Merge Requests, Releases, Worklogs) have keyboard shortcuts
- Shortcuts registered in shortcuts.ts, wired in main.tsx, and exposed in lib.rs Go menu
- `npm run check` and `cargo build` both pass
- Command Palette Navigation group automatically shows all new shortcuts (via NAV_SHORTCUTS filter — no changes to CommandPalette.tsx needed)
- Keyboard Shortcuts Panel automatically shows all new shortcuts (via SHORTCUTS array — no changes to KeyboardShortcutsPanel.tsx needed)
</success_criteria>

<output>
Create `.planning/quick/260617-dta-the-app-has-a-lot-of-new-pages-that-do-n/260617-dta-SUMMARY.md` when done
</output>
