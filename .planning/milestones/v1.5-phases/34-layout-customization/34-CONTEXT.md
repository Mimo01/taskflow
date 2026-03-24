# Phase 34: Layout Customization - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can personalize their workspace with a customizable sidebar (show/hide/reorder items) and a widget-based dashboard (add/remove/resize/drag widgets in a grid layout). Dev/PM roles become presets rather than restrictions. Layout persists across app restarts.

</domain>

<decisions>
## Implementation Decisions

### Sidebar Customization
- **D-01:** All sidebar nav items are customizable (show/hide) — only Settings stays pinned at the bottom
- **D-02:** Any role can access any sidebar item — developers can add Sprint Progress, PMs can add My Tasks. Roles become presets, not restrictions. All routes already exist.
- **D-03:** Sidebar visibility and order are managed from Settings > Appearance page — not inline in the sidebar itself
- **D-04:** Drag-to-reorder happens only in the Settings > Appearance sidebar items list, not in the live sidebar. Sidebar stays clean during normal use.

### Dashboard Widget System
- **D-05:** Free-form drag + resize grid using `react-grid-layout` (new dependency) — handles collision detection, auto-compaction, responsive breakpoints
- **D-06:** Per-widget min/max size constraints — each widget type defines its own min/max grid units to prevent unusable sizes
- **D-07:** "Add widget" button on the dashboard opens a picker dropdown/dialog showing available widgets with descriptions. Click to add.
- **D-08:** Duplicate widgets are allowed — same widget type can appear multiple times on the dashboard

### Widget Catalog
- **D-09:** Maximize widget variety using existing data sources. Initial catalog:
  1. **My Subtasks** — open subtasks assigned to me (existing SubtasksPanel)
  2. **MR Health** — MR status overview (existing MrHealthPanel)
  3. **Sprint Health** — sprint overview with key metrics (existing SprintHealthPanel)
  4. **Recent Notifications** — last N notifications from notification store
  5. **Sprint Progress** — compact sprint progress with status breakdown
  6. **My MR Attention** — compact MR attention list
  7. **Releases Overview** — upcoming releases with status badges
  8. **Workload Summary** — team workload at a glance
  9. **Saved Filters** — quick-access filter shortcuts
  10. **Pinned Issues** — compact list of pinned tab issues
  11. **Custom JQL** — user enters a JQL query, widget shows matching issues
- **D-10:** All widgets reuse existing data fetching (React Query hooks) — no new API calls except Custom JQL widget which uses the existing Jira search endpoint

### Persistence & Presets
- **D-11:** Sidebar items array and dashboard layout are persisted by extending `settings.store.ts` (Zustand + LazyStore) — same mechanism as existing `sidebarCollapsed`
- **D-12:** Dev/PM presets restore both sidebar items AND dashboard widgets together — one-click full reset to role default
- **D-13:** Changing role in Settings does NOT touch the layout — user must explicitly apply a preset to get the role's default layout. Respects customization.

### Claude's Discretion
- Widget picker UI design (dropdown vs dialog vs popover)
- react-grid-layout column count and breakpoint configuration
- Default grid positions for each widget type
- How Custom JQL widget handles JQL validation/errors
- Animation/transition style for widget drag and resize
- Settings > Appearance sidebar items list styling
- Which widgets are included in Dev vs PM default presets

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sidebar (existing)
- `taskflow/src/components/app/Sidebar.tsx` — Current hardcoded sidebar with role-based nav items, collapse toggle, section labels
- `taskflow/src/stores/settings.store.ts` — `sidebarCollapsed` state, role field, Zustand persist with LazyStore and migration versioning

### Dashboard (existing)
- `taskflow/src/routes/dashboard/index.tsx` — Current hardcoded 2-column dashboard with role switching, token loading, SubtasksPanel/MrHealthPanel/SprintHealthPanel
- `taskflow/src/routes/dashboard/SubtasksPanel.tsx` — My subtasks widget source
- `taskflow/src/routes/dashboard/MrHealthPanel.tsx` — MR health widget source
- `taskflow/src/routes/dashboard/SprintHealthPanel.tsx` — Sprint health widget source

### Drag-and-drop (existing)
- `taskflow/package.json` — `@dnd-kit/core` already installed (used for sprint board DnD)

### Settings (existing)
- `taskflow/src/routes/settings/Settings.tsx` — Multi-page settings with sidebar navigation (Appearance page exists)

### Requirements
- `.planning/REQUIREMENTS.md` §Layout — LAYOUT-01 through LAYOUT-07

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SubtasksPanel`, `MrHealthPanel`, `SprintHealthPanel`: Existing dashboard panels — wrap as widgets with size constraints
- `SprintProgressTab`, `WorkloadTab`, `ReleasesTab`, `MrAttentionTab`: Full-page components — create compact widget variants
- `useSettingsStore` with LazyStore persist: Extend for sidebar items + dashboard layout arrays
- `@dnd-kit/core`: Already installed for sprint board — available for sidebar reorder in Settings
- `notification.store.ts`: Existing notification data — source for Recent Notifications widget
- `filter.store.ts`: Saved filters data — source for Saved Filters widget
- `usePinnedTabs` (or pinned tab store): Pinned issues — source for Pinned Issues widget

### Established Patterns
- Zustand stores with `persist` + LazyStore + versioned `migrate` function — follow for new layout state fields
- Prop threading (no React context) — dashboard widgets receive props from parent, not context
- React Query for data fetching — widgets use existing query hooks, share cache
- Role-based conditional rendering in `Sidebar.tsx` — will be replaced with data-driven rendering from stored items array

### Integration Points
- `Sidebar.tsx`: Replace hardcoded NavLink blocks with dynamic rendering from `sidebarItems[]` in settings store
- `Dashboard index.tsx`: Replace hardcoded grid with `react-grid-layout` powered by `dashboardLayout[]` from settings store
- `Settings.tsx` Appearance page: Add "Sidebar Items" section with toggle + drag-reorder list
- `Settings.tsx` Appearance page (or new Dashboard section): Add preset apply buttons (Dev/PM)
- `settings.store.ts`: Add `sidebarItems`, `dashboardLayout`, `applySidebarPreset()`, `applyDashboardPreset()`, migration for new version

</code_context>

<specifics>
## Specific Ideas

- User wants maximum widget variety — "as much widgets as possible so users can customize their dashboard however they want"
- Custom JQL widget: user-defined JQL query that shows matching issues — enables power-user dashboard personalization
- Duplicate widgets allowed — e.g., two Custom JQL widgets with different queries

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-layout-customization*
*Context gathered: 2026-03-23*
