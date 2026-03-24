# Phase 34: Layout Customization - Research

**Researched:** 2026-03-23
**Domain:** Dashboard widget grid, sidebar customization, drag-and-drop, Zustand persistence
**Confidence:** HIGH

## Summary

Phase 34 transforms the hardcoded sidebar and dashboard into user-customizable layouts. The sidebar gets data-driven rendering with visibility toggles and drag-reorder (managed in Settings > Appearance). The dashboard gets a widget-based grid layout powered by `react-grid-layout` with 11 widget types. Both persist via the existing Zustand + LazyStore mechanism in `settings.store.ts`.

The codebase is well-structured for this change. Existing panels (`SubtasksPanel`, `MrHealthPanel`, `SprintHealthPanel`) already manage their own data fetching via React Query and receive credentials as props. Full-page components (`SprintProgressTab`, `WorkloadTab`, etc.) fetch their own tokens internally and will need compact widget variants. The `@dnd-kit/core` library is already installed for sidebar reorder in Settings. `react-grid-layout` is the only new dependency.

**Primary recommendation:** Implement in three stages: (1) settings store extensions + sidebar data-driven rendering, (2) react-grid-layout integration + widget card shell + existing panel widgets, (3) compact widget variants + Custom JQL widget + presets.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: All sidebar nav items are customizable (show/hide) -- only Settings stays pinned at the bottom
- D-02: Any role can access any sidebar item -- roles become presets, not restrictions. All routes already exist.
- D-03: Sidebar visibility and order are managed from Settings > Appearance page -- not inline in the sidebar itself
- D-04: Drag-to-reorder happens only in the Settings > Appearance sidebar items list, not in the live sidebar
- D-05: Free-form drag + resize grid using `react-grid-layout` (new dependency)
- D-06: Per-widget min/max size constraints -- each widget type defines its own min/max grid units
- D-07: "Add widget" button opens a picker dropdown/dialog showing available widgets with descriptions
- D-08: Duplicate widgets are allowed -- same widget type can appear multiple times
- D-09: 11 widget types in initial catalog (My Subtasks, MR Health, Sprint Health, Recent Notifications, Sprint Progress, My MR Attention, Releases Overview, Workload Summary, Saved Filters, Pinned Issues, Custom JQL)
- D-10: All widgets reuse existing data fetching (React Query hooks) -- no new API calls except Custom JQL
- D-11: Sidebar items array and dashboard layout persisted by extending `settings.store.ts` (Zustand + LazyStore)
- D-12: Dev/PM presets restore both sidebar items AND dashboard widgets together
- D-13: Changing role in Settings does NOT touch the layout -- user must explicitly apply a preset

### Claude's Discretion
- Widget picker UI design (dropdown vs dialog vs popover)
- react-grid-layout column count and breakpoint configuration
- Default grid positions for each widget type
- How Custom JQL widget handles JQL validation/errors
- Animation/transition style for widget drag and resize
- Settings > Appearance sidebar items list styling
- Which widgets are included in Dev vs PM default presets

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAYOUT-01 | User can choose which sidebar items are visible | Extend settings store with `sidebarItems[]` array; data-driven Sidebar.tsx rendering; Switch toggles in AppearanceSection |
| LAYOUT-02 | User can reorder sidebar items via drag-and-drop | @dnd-kit/core already installed; SidebarItemsList in Settings > Appearance with vertical sortable list |
| LAYOUT-03 | User can apply Dev or PM preset to restore default sidebar configuration | PresetButtons component with confirmation dialog; `applySidebarPreset()` in settings store |
| LAYOUT-04 | User can add/remove/resize dashboard widgets in a grid layout | react-grid-layout with WidthProvider; WidgetCard with remove button; WidgetPicker dialog; per-widget min/max constraints |
| LAYOUT-05 | User can drag dashboard widgets to rearrange layout | react-grid-layout handles drag natively via draggableHandle selector `.widget-drag-handle` |
| LAYOUT-06 | Dashboard layout persists across app restarts | `dashboardLayout[]` in settings store with Zustand persist + LazyStore; migration version bump |
| LAYOUT-07 | User can reset dashboard to Dev or PM preset layout | `applyDashboardPreset()` in settings store; same PresetButtons component |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-grid-layout | 2.2.2 | Dashboard widget grid with drag, resize, responsive breakpoints | De facto standard for React dashboard grids. Peer deps `react >= 16.3.0` -- compatible with React 19. Handles collision detection, auto-compaction, responsive columns. |
| @types/react-grid-layout | 2.1.0 | TypeScript definitions for react-grid-layout | Required -- react-grid-layout ships no built-in types |
| @dnd-kit/core | 6.3.1 (installed) | Sidebar item reorder in Settings | Already in project for sprint board DnD. Reuse for vertical sortable list. |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | 5.0.11 | State management + persistence | Settings store extension for sidebarItems + dashboardLayout |
| @tanstack/react-query | 5.90.21 | Data fetching | All widgets use existing query hooks |
| lucide-react | 0.577.0 | Icons | Widget icons, drag handles, remove buttons |
| @base-ui/react | 1.2.0 | UI primitives | Switch for sidebar item toggles |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-grid-layout | @hello-pangea/dnd + manual grid | react-grid-layout handles resize + collision + responsive breakpoints out of the box; hand-rolling would be weeks of work |
| react-grid-layout | gridstack.js | Heavier, jQuery legacy, less React-native. react-grid-layout is purpose-built for React |

**Installation:**
```bash
npm install react-grid-layout @types/react-grid-layout
```

**Note on CSS:** react-grid-layout requires importing its CSS for drag/resize visuals:
```typescript
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  stores/
    settings.store.ts         # Extended with sidebarItems[], dashboardLayout[], presets
  components/app/
    Sidebar.tsx               # Refactored: data-driven from sidebarItems[]
  routes/dashboard/
    index.tsx                 # Refactored: WidgetGrid replaces hardcoded grid
    WidgetGrid.tsx            # react-grid-layout wrapper
    WidgetCard.tsx            # Card shell: drag handle, title, remove, resize
    WidgetPicker.tsx          # Dialog listing available widget types
    widgets/
      registry.ts            # Widget type registry: id, title, icon, component, constraints
      SubtasksWidget.tsx      # Wrapper around existing SubtasksPanel
      MrHealthWidget.tsx      # Wrapper around existing MrHealthPanel
      SprintHealthWidget.tsx  # Wrapper around existing SprintHealthPanel
      NotificationsWidget.tsx # New: compact notification list
      SprintProgressWidget.tsx# Compact variant of SprintProgressTab
      MrAttentionWidget.tsx   # Compact variant of MrAttentionTab
      ReleasesWidget.tsx      # Compact variant of ReleasesTab
      WorkloadWidget.tsx      # Compact variant of WorkloadTab
      SavedFiltersWidget.tsx  # Quick-access filter shortcuts
      PinnedIssuesWidget.tsx  # Compact pinned tabs list
      CustomJqlWidget.tsx     # JQL input + results
  routes/settings/
    SidebarItemsList.tsx      # Toggle + reorder list for sidebar items
    PresetButtons.tsx         # Dev/PM preset apply with confirmation dialog
    AppearanceSection.tsx     # Extended with sidebar items section + presets
```

### Pattern 1: Widget Registry
**What:** A centralized registry mapping widget type IDs to their component, default size, min/max constraints, title, description, and icon.
**When to use:** For the widget picker, default layout generation, and rendering widgets by type.
**Example:**
```typescript
// widgets/registry.ts
import type { ComponentType } from 'react';

export interface WidgetDef {
  type: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType<{ widgetId: string }>;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize: { w: number; h: number };
}

export const WIDGET_REGISTRY: Record<string, WidgetDef> = {
  'my-subtasks': {
    type: 'my-subtasks',
    title: 'My Subtasks',
    description: 'Open subtasks assigned to you',
    icon: CheckSquare,
    component: SubtasksWidget,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 12, h: 8 },
  },
  // ... other widget types
};
```

### Pattern 2: Sidebar Items Array in Store
**What:** Store sidebar items as an ordered array of `{ id, label, icon, path, visible }` objects. Sidebar renders from this array.
**When to use:** Replacing the hardcoded role-based conditional nav links.
**Example:**
```typescript
// In settings.store.ts
export interface SidebarItem {
  id: string;
  visible: boolean;
}

// The full definition (label, icon, path) lives in a static registry
// Store only tracks id + visible + order (via array position)
interface SettingsState {
  // ...existing fields...
  sidebarItems: SidebarItem[];
  dashboardLayout: DashboardLayoutItem[];
  setSidebarItems: (items: SidebarItem[]) => void;
  setSidebarItemVisible: (id: string, visible: boolean) => void;
  reorderSidebarItem: (fromIndex: number, toIndex: number) => void;
  setDashboardLayout: (layout: DashboardLayoutItem[]) => void;
  addDashboardWidget: (widgetType: string) => void;
  removeDashboardWidget: (widgetId: string) => void;
  applyPreset: (preset: 'dev' | 'pm') => void;
}
```

### Pattern 3: WidthProvider HOC for react-grid-layout
**What:** react-grid-layout needs explicit width. WidthProvider HOC auto-detects container width.
**When to use:** Always wrap ReactGridLayout with WidthProvider unless you manually manage width.
**Example:**
```typescript
import { WidthProvider, Responsive } from 'react-grid-layout';

const ResponsiveGridLayout = WidthProvider(Responsive);

function WidgetGrid({ layout, onLayoutChange }: Props) {
  return (
    <ResponsiveGridLayout
      layouts={{ lg: layout }}
      breakpoints={{ lg: 1200, md: 996, sm: 768 }}
      cols={{ lg: 12, md: 8, sm: 4 }}
      rowHeight={80}
      margin={[16, 16]}
      compactType="vertical"
      draggableHandle=".widget-drag-handle"
      onLayoutChange={(current, allLayouts) => onLayoutChange(current)}
    >
      {layout.map(item => (
        <div key={item.i}>
          <WidgetCard widgetId={item.i} widgetType={item.widgetType} onRemove={...} />
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
```

### Pattern 4: Dashboard Layout Item Shape
**What:** Each dashboard widget needs both react-grid-layout positioning data and the widget type identifier.
**When to use:** In the settings store and when passing to react-grid-layout.
**Example:**
```typescript
export interface DashboardLayoutItem {
  i: string;       // unique instance ID (e.g., 'my-subtasks-1', 'custom-jql-2')
  type: string;    // widget type from registry (e.g., 'my-subtasks', 'custom-jql')
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  // Widget-specific config (e.g., JQL query for Custom JQL widget)
  config?: Record<string, unknown>;
}
```

### Anti-Patterns to Avoid
- **Storing component references in state:** Store widget type IDs, not components. Components are resolved from the registry at render time.
- **Passing all credentials as props through WidgetGrid:** Each widget should fetch its own credentials internally (like SprintProgressTab does) rather than threading jiraToken/gitlabToken through the grid. The existing three dashboard panels that take credentials as props need wrapper widgets that handle token loading internally.
- **Syncing react-grid-layout state on every drag frame:** Only persist layout on `onLayoutChange` (which fires on drop), not during drag.
- **Using react-grid-layout for the sidebar items list:** Sidebar reorder is a simple vertical sort list -- use @dnd-kit/core which is already installed and simpler for this case.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Grid drag + resize + collision | Custom drag-and-drop grid system | react-grid-layout | Collision detection, auto-compaction, responsive breakpoints, resize handles -- hundreds of edge cases |
| Responsive grid breakpoints | Manual media query logic | react-grid-layout Responsive component | Built-in breakpoint support with per-breakpoint column counts |
| Container width detection | ResizeObserver wrapper | react-grid-layout WidthProvider | Standard HOC that handles container width for the grid |
| Sidebar item reorder | Custom drag handlers | @dnd-kit/core sortable | Already installed, proven in sprint board, handles keyboard accessibility |
| Toggle switches | Custom checkbox-like controls | shadcn Switch / @base-ui/react Switch | Accessible, styled, consistent with project design |

## Common Pitfalls

### Pitfall 1: react-grid-layout CSS Not Imported
**What goes wrong:** Widgets render but drag/resize handles are invisible; layout appears broken.
**Why it happens:** react-grid-layout requires its own CSS for drag placeholders and resize handles.
**How to avoid:** Import both CSS files in the dashboard entry point or in WidgetGrid.tsx:
```typescript
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
```
**Warning signs:** Drag works but no visual placeholder; resize handle not visible.

### Pitfall 2: Zustand Migration Version Not Bumped
**What goes wrong:** Existing users get `sidebarItems: undefined` causing runtime errors.
**Why it happens:** Adding new fields to persisted store without incrementing version and adding migration logic.
**How to avoid:** Bump version from 8 to 9, add `if (version < 9)` block that sets defaults for `sidebarItems` and `dashboardLayout`.
**Warning signs:** TypeError on first load after upgrade; store appears empty.

### Pitfall 3: react-grid-layout Key/Layout Desync
**What goes wrong:** Widgets disappear, duplicate, or layout resets unexpectedly.
**Why it happens:** The `key` prop on grid children must match the `i` field in the layout array exactly. Adding/removing widgets without keeping both in sync causes errors.
**How to avoid:** Derive rendered children directly from the layout array. Never maintain a separate children list.
**Warning signs:** Console warnings about missing keys; widgets not appearing at correct positions.

### Pitfall 4: Widget Credential Threading
**What goes wrong:** Widgets fail to load data because they lack auth tokens.
**Why it happens:** Existing `SubtasksPanel`, `MrHealthPanel`, `SprintHealthPanel` receive tokens as props from Dashboard. In a widget system, the parent doesn't know which widgets exist.
**How to avoid:** Create widget wrappers that internally read tokens from stores/Stronghold, similar to how `SprintProgressTab` and `WorkloadTab` already do. The wrapper pattern:
```typescript
function SubtasksWidget() {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  useEffect(() => {
    readSecret('jira-pat').then(setJiraToken).catch(() => setJiraToken(null));
  }, [jiraBaseUrl]);

  if (!jiraToken) return <WidgetSkeleton />;
  return <SubtasksPanel jiraBaseUrl={jiraBaseUrl!} jiraToken={jiraToken} ... />;
}
```
**Warning signs:** Widgets show loading state indefinitely.

### Pitfall 5: Initial Layout for New Users
**What goes wrong:** New users see an empty dashboard; returning users with no prior sidebarItems see nothing.
**Why it happens:** Not providing sensible defaults when store fields are undefined.
**How to avoid:** Migration sets role-appropriate defaults. If role is null (pre-onboarding), use Dev preset as default. The migration should check existing role and apply matching preset.
**Warning signs:** Blank sidebar or empty dashboard on first load.

### Pitfall 6: Tailwind vs react-grid-layout CSS Conflicts
**What goes wrong:** Grid items have unexpected sizing or transitions conflict.
**Why it happens:** Tailwind resets and react-grid-layout's inline styles can clash, especially with transitions.
**How to avoid:** Let react-grid-layout control positioning via inline styles (it does this by default). Don't apply Tailwind positioning/sizing utilities to the grid item wrapper divs. Only style the inner WidgetCard.
**Warning signs:** Widgets jump to wrong positions; transitions are janky.

## Code Examples

### Extending settings.store.ts Migration
```typescript
// In the persist config
version: 9,
migrate: (persisted, version) => {
  const s = persisted as Record<string, unknown>;
  // ... existing migrations (version < 1 through < 8) ...

  if (version < 9) {
    // Default sidebar items based on current role
    const role = s.role as string | null;
    s.sidebarItems = getDefaultSidebarItems(role === 'pm' ? 'pm' : 'dev');
    s.dashboardLayout = getDefaultDashboardLayout(role === 'pm' ? 'pm' : 'dev');
  }
  return persisted as SettingsState;
},
```

### Sidebar Nav Item Registry (static, not in store)
```typescript
// components/app/sidebar-items.ts
export interface SidebarNavDef {
  id: string;
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
}

export const SIDEBAR_NAV_ITEMS: SidebarNavDef[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { id: 'my-tasks', label: 'My Tasks', path: '/my-tasks', icon: CheckSquare },
  { id: 'sprint-board', label: 'Sprint Board', path: '/sprint-board', icon: KanbanSquare },
  { id: 'backlog', label: 'Backlog', path: '/backlog', icon: List },
  { id: 'epics', label: 'Epics', path: '/epics', icon: BookOpen },
  { id: 'merge-requests', label: 'Merge Requests', path: '/merge-requests', icon: GitMerge },
  { id: 'mr-attention', label: 'MR Attention', path: '/mr-attention', icon: GitMerge },
  { id: 'sprint-progress', label: 'Sprint Progress', path: '/sprint-progress', icon: BarChart2 },
  { id: 'workload', label: 'Workload', path: '/workload', icon: Users },
  { id: 'releases', label: 'Releases', path: '/releases', icon: Tag },
];

// Settings is NOT in the list -- it's always pinned at the bottom
```

### Data-Driven Sidebar Rendering
```typescript
// In Sidebar.tsx -- replace hardcoded NavLinks
const sidebarItems = useSettingsStore((s) => s.sidebarItems);

// Merge stored order/visibility with static definitions
const visibleItems = sidebarItems
  .filter(item => item.visible)
  .map(item => SIDEBAR_NAV_ITEMS.find(def => def.id === item.id))
  .filter(Boolean);

return (
  <nav>
    {visibleItems.map(def => (
      <NavLink key={def.id} to={def.path} className={navLinkClass}>
        <def.icon className="h-4 w-4 shrink-0" />
        <span className={labelClass}>{def.label}</span>
      </NavLink>
    ))}
  </nav>
);
```

### react-grid-layout Responsive Setup
```typescript
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGrid = WidthProvider(Responsive);

// Layout items need i, x, y, w, h, minW, minH, maxW, maxH
// The `i` field must match the `key` on the child div
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-grid-layout 1.x with class components | react-grid-layout 2.x with React 18+ support | v2.0.0 | Use WidthProvider(Responsive) pattern; legacy wrapper available but not needed |
| @dnd-kit/core 5.x | @dnd-kit/core 6.3.1 | Already installed | Stable API, no changes needed for sidebar reorder |

**Deprecated/outdated:**
- react-grid-layout `<ReactGridLayout>` without `Responsive`: Use `Responsive` variant for breakpoint support
- Manual layout persistence with localStorage: Project uses Zustand + Tauri LazyStore -- follow existing pattern

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAYOUT-01 | Sidebar items visibility toggle | unit | `cd taskflow && npx vitest run src/stores/settings.store.test.ts -x` | No -- Wave 0 |
| LAYOUT-02 | Sidebar items reorder | unit | `cd taskflow && npx vitest run src/stores/settings.store.test.ts -x` | No -- Wave 0 |
| LAYOUT-03 | Apply sidebar preset | unit | `cd taskflow && npx vitest run src/stores/settings.store.test.ts -x` | No -- Wave 0 |
| LAYOUT-04 | Add/remove/resize dashboard widgets | unit | `cd taskflow && npx vitest run src/stores/settings.store.test.ts -x` | No -- Wave 0 |
| LAYOUT-05 | Drag widgets to rearrange | manual-only | N/A -- react-grid-layout drag is visual/integration | N/A |
| LAYOUT-06 | Dashboard layout persists | unit | `cd taskflow && npx vitest run src/stores/settings.store.test.ts -x` | No -- Wave 0 |
| LAYOUT-07 | Reset dashboard to preset | unit | `cd taskflow && npx vitest run src/stores/settings.store.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/stores/settings.store.test.ts` -- extend with tests for sidebarItems, dashboardLayout, presets, migration v9
- [ ] No new test file needed for react-grid-layout rendering (visual/integration -- covered by manual testing)

## Open Questions

1. **react-grid-layout CSS integration with Tailwind v4**
   - What we know: react-grid-layout ships its own CSS that must be imported. Tailwind v4 uses @tailwindcss/vite plugin.
   - What's unclear: Whether react-grid-layout's CSS (which uses traditional class selectors) conflicts with Tailwind v4's layer system.
   - Recommendation: Import the CSS early in the component tree. If conflicts arise, scope with a wrapper class or copy the minimal required styles inline. LOW risk -- the CSS is mostly about positioning which uses inline styles anyway.

2. **Switch component availability**
   - What we know: The UI spec says to use shadcn Switch, but no `switch.tsx` exists in `src/components/ui/`.
   - What's unclear: Whether @base-ui/react provides a Switch or if shadcn Switch needs to be added.
   - Recommendation: Add shadcn Switch component via `npx shadcn@latest add switch` as part of implementation. Simple addition.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `settings.store.ts`, `Sidebar.tsx`, `Dashboard/index.tsx`, `AppearanceSection.tsx`, `package.json` -- all read directly
- UI Spec: `34-UI-SPEC.md` -- detailed interaction contracts, widget size constraints, presets
- npm registry: react-grid-layout 2.2.2 (latest), @types/react-grid-layout 2.1.0, peer deps `react >= 16.3.0`

### Secondary (MEDIUM confidence)
- [react-grid-layout GitHub releases](https://github.com/react-grid-layout/react-grid-layout/releases) -- v2.2.2 latest, React 18+ for v2 API, peer deps compatible with React 19
- [react-grid-layout npm](https://www.npmjs.com/package/react-grid-layout) -- package metadata

### Tertiary (LOW confidence)
- react-grid-layout CSS interaction with Tailwind v4 -- no specific documentation found; based on general knowledge of how inline styles override class-based positioning

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-grid-layout is the established standard, version verified on npm, peer deps confirmed compatible
- Architecture: HIGH - patterns derived directly from existing codebase structure and established react-grid-layout usage
- Pitfalls: HIGH - based on direct codebase analysis (credential threading, migration versioning) and known react-grid-layout requirements (CSS import, key sync)

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable ecosystem, no fast-moving dependencies)
