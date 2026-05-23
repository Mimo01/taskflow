# Phase 59: Dashboard Cleanup + Dependency Removal - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 10 (8 deleted/replaced + 6 patched + 2 tests updated + 1 package.json)
**Analogs found:** 10 / 10

---

## File Classification

| File | Action | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `taskflow/src/routes/dashboard/index.tsx` | REPLACE with stub | component | none (static) | self (existing file to be replaced) | self |
| `taskflow/src/routes/dashboard/WidgetGrid.tsx` | DELETE | component | event-driven | — | delete |
| `taskflow/src/routes/dashboard/WidgetCard.tsx` | DELETE | component | event-driven | — | delete |
| `taskflow/src/routes/dashboard/WidgetPicker.tsx` | DELETE | component | event-driven | — | delete |
| `taskflow/src/routes/dashboard/WorkloadTab.tsx` | DELETE | component | request-response | — | delete |
| `taskflow/src/routes/dashboard/WorkloadSkeleton.tsx` | DELETE | component | none | — | delete |
| `taskflow/src/routes/dashboard/WorkloadTab.test.tsx` | DELETE | test | — | — | delete |
| `taskflow/src/routes/dashboard/widgets/` | DELETE (11 files + registry.ts) | component + config | request-response | — | delete |
| `taskflow/src/stores/settings.store.ts` | PATCH | store | CRUD | self (existing migration chain) | self |
| `taskflow/src/routes/routes.tsx` | PATCH | config | request-response | self | self |
| `taskflow/src/components/app/sidebar-items.ts` | PATCH | config | none | self | self |
| `taskflow/src/main.tsx` | PATCH (line 292) | utility | request-response | self | self |
| `taskflow/src/routes/dashboard/WikiRenderer.tsx` | PATCH (line 869) | component | none | `src/routes/dashboard/DiscussionThreads.tsx` | exact (same pattern) |
| `taskflow/src/routes/dashboard/DiscussionThreads.tsx` | PATCH (line 60) | component | none | `src/routes/dashboard/WikiRenderer.tsx` | exact (same pattern) |
| `taskflow/src/stores/settings.store.test.ts` | PATCH | test | — | self | self |
| `taskflow/src/routes/settings/Settings.test.tsx` | PATCH | test | — | self | self |
| `taskflow/package.json` | PATCH | config | — | self | self |

---

## Pattern Assignments

### 1. `taskflow/src/routes/dashboard/index.tsx` — REPLACE with stub

**Action:** Overwrite entire file contents. The current file is 118 lines with many imports. Replace with the exact one-line stub from CONTEXT.md D-01 and UI-SPEC.md "Stub Component Contract".

**Stub to write** (verbatim per D-01 and UI-SPEC):
```tsx
export default function Dashboard() {
  return <div />;
}
```

No imports, no props, no logic, no styling. Phase 60 overwrites this entirely.

---

### 2. Files to DELETE outright (no replacement)

Delete these files using `rm`. No stub left behind.

**Widget components** (`taskflow/src/routes/dashboard/widgets/`):
- `CustomJqlWidget.tsx`
- `MrHealthWidget.tsx`
- `NotificationsWidget.tsx`
- `PinnedIssuesWidget.tsx`
- `ReleasesWidget.tsx`
- `SavedFiltersWidget.tsx`
- `SprintHealthWidget.tsx`
- `SprintProgressWidget.tsx`
- `SubtasksWidget.tsx`
- `WorkloadWidget.tsx`
- `registry.ts`

**Dashboard components** (`taskflow/src/routes/dashboard/`):
- `WidgetGrid.tsx`
- `WidgetCard.tsx`
- `WidgetPicker.tsx`
- `WorkloadTab.tsx`
- `WorkloadSkeleton.tsx`
- `WorkloadTab.test.tsx`

**Critical ordering constraint (CONTEXT.md D-04):** The registry import in `settings.store.ts` (line 16) MUST be removed in the same commit as deleting `widgets/registry.ts`. Do not delete the registry file before patching the store, or do both atomically.

---

### 3. `taskflow/src/stores/settings.store.ts` — PATCH (version bump + field/action removal)

**Analog:** Self. Migration chain pattern established across v1–v18.

**Line 8 — biome-ignore comment:** Remove this comment along with the import it guards. The TDZ circular dependency comment exists solely because of the registry import ordering requirement. Once the registry import is gone, the biome-ignore is no longer needed.

**Line 16 — import to DELETE:**
```typescript
// DELETE this entire line:
import { getDefaultDashboardLayout, WIDGET_REGISTRY } from '@/routes/dashboard/widgets/registry';
```

**Lines 30–38 — interface block to DELETE** (the `DashboardLayoutItem` interface):
```typescript
// DELETE lines 30-38:
export interface DashboardLayoutItem {
  i: string; // unique instance ID e.g. 'my-subtasks-1'
  type: string; // widget type from registry e.g. 'my-subtasks'
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  config?: Record<string, unknown>; // widget-specific config (JQL query etc.)
}
```

**Lines 175–183 — SettingsState interface fields to DELETE:**
```typescript
// DELETE these lines from SettingsState interface:
  /** Dashboard widget layout grid. Default: DEV_DASHBOARD_PRESET. */
  dashboardLayout: DashboardLayoutItem[];
  setDashboardLayout: (layout: DashboardLayoutItem[]) => void;
  addDashboardWidget: (widgetType: string) => void;
  removeDashboardWidget: (widgetId: string) => void;
  updateWidgetConfig: (widgetId: string, config: Record<string, unknown>) => void;
```

**Lines 321, 336–370 — initial state and actions to DELETE:**
```typescript
// Line 321: DELETE this initial value:
      dashboardLayout: getDefaultDashboardLayout('dev'),

// Lines 336-355: DELETE setDashboardLayout + addDashboardWidget implementations:
      setDashboardLayout: (layout) => set({ dashboardLayout: layout }),
      addDashboardWidget: (widgetType) =>
        set((s) => {
          const reg = WIDGET_REGISTRY[widgetType];
          if (!reg) return s;
          const count = s.dashboardLayout.filter((w) => w.type === widgetType).length;
          const newItem: DashboardLayoutItem = {
            i: `${widgetType}-${count + 1}-${Date.now()}`,
            type: widgetType,
            x: 0,
            y: Infinity,
            w: reg.defaultSize.w,
            h: reg.defaultSize.h,
            minW: reg.minSize.w,
            minH: reg.minSize.h,
            maxW: reg.maxSize.w,
            maxH: reg.maxSize.h,
          };
          return { dashboardLayout: [...s.dashboardLayout, newItem] };
        }),
      removeDashboardWidget: (widgetId) =>
        set((s) => ({
          dashboardLayout: s.dashboardLayout.filter((w) => w.i !== widgetId),
        })),
      updateWidgetConfig: (widgetId, config) =>
        set((s) => ({
          dashboardLayout: s.dashboardLayout.map((w) =>
            w.i === widgetId ? { ...w, config: { ...w.config, ...config } } : w,
          ),
        })),
```

**Lines 366–370 — `applyPreset` action to PATCH** (remove the `dashboardLayout` half):
```typescript
// BEFORE (lines 366-370):
      applyPreset: (preset) =>
        set({
          sidebarItems: getDefaultSidebarItems(preset),
          dashboardLayout: getDefaultDashboardLayout(preset),
        }),

// AFTER:
      applyPreset: (preset) =>
        set({
          sidebarItems: getDefaultSidebarItems(preset),
        }),
```

**Migration version bump — lines 375–376:**
```typescript
// BEFORE:
      version: 18,

// AFTER:
      version: 19,
```

**Migration guard to ADD** (after existing `if (version < 18)` block, before the `return` at line 457):
```typescript
        if (version < 19) {
          // No new fields to initialize. Version bump drops dashboardLayout from
          // persisted shape implicitly — Zustand LazyStore ignores extra keys.
        }
```

Per CONTEXT.md D-03 and "Claude's Discretion": the body comment can be omitted if the executor prefers — the guard itself (even with empty body) is sufficient to advance the persisted version. Either form is correct. The `// no delete` approach is consistent with all prior v1–v18 guards which never call `delete`.

**Existing migration pattern** (lines 376–458) — keep all `if (version < N)` blocks unchanged. Only add the new `if (version < 19)` guard at the end. Reference excerpt of the established style:
```typescript
// Established migration style (copy this pattern for v19 guard):
        if (version < 18) {
          if (s.flaggedFieldKey === undefined) s.flaggedFieldKey = 'customfield_10021';
        }
        // ADD HERE:
        if (version < 19) {
          // No new fields to initialize.
        }
        return persisted as SettingsState;
```

---

### 4. `taskflow/src/routes/routes.tsx` — PATCH (remove WorkloadTab lazy import + route entry)

**Analog:** Self. Pattern is `const X = lazy(() => import(...))` + route entry `{ path: '/x', element: withLazy(X) }`.

**Line 16 — import to DELETE:**
```typescript
// DELETE this line:
const WorkloadTab = lazy(() => import('./dashboard/WorkloadTab'));
```

**Line 44 — route entry to DELETE:**
```typescript
// DELETE this line from the routes array:
  { path: '/workload', element: withLazy(WorkloadTab) },
```

No other changes needed. The `/dashboard` route (line 37) stays and its element `<Dashboard />` already points to the stub-replaced index.

---

### 5. `taskflow/src/components/app/sidebar-items.ts` — PATCH (remove workload entry + preset references)

**Line 74 — SIDEBAR_NAV_ITEMS entry to DELETE:**
```typescript
// DELETE this entry from SIDEBAR_NAV_ITEMS array:
  { id: 'workload', label: 'Workload', path: '/workload', iconName: 'Users', section: 'tracking' },
```

**Lines 110 — `pmVisible` set entry to DELETE:**
```typescript
// BEFORE (inside pmVisible Set, line ~110):
    'workload',

// AFTER: remove 'workload' from pmVisible entirely
```

Full `pmVisible` set after patch:
```typescript
  const pmVisible = new Set([
    'dashboard',
    'my-tasks',
    'sprint-board',
    'backlog',
    'epics',
    'merge-requests',
    'sprint-progress',
    'releases',
    'aio-projects',
  ]);
```

`devVisible` (lines 94–101) has no `'workload'` entry — no change needed there.

---

### 6. `taskflow/src/main.tsx` — PATCH (remove workload branch from `routeLabel`)

**Line 292 — branch to DELETE:**
```typescript
// BEFORE (line 292):
    if (pathname.startsWith('/workload')) return 'Workload';

// AFTER: delete this line entirely
```

The surrounding context (lines 284–299) for reference — surrounding lines stay unchanged:
```typescript
  function routeLabel(pathname: string): string {
    if (pathname.startsWith('/sprint-board')) return 'Sprint Board';
    if (pathname.startsWith('/backlog')) return 'Backlog';
    if (pathname.startsWith('/my-tasks')) return 'My Tasks';
    if (pathname.startsWith('/epics')) return 'Epics';
    if (pathname.startsWith('/dashboard')) return 'Overview';
    if (pathname.startsWith('/sprint-progress')) return 'Sprint Progress';
    // DELETE: if (pathname.startsWith('/workload')) return 'Workload';
    if (pathname.startsWith('/releases')) return 'Releases';
    if (pathname.startsWith('/issue/')) return 'Issue';
    if (pathname.startsWith('/merge-requests')) return 'Merge Requests';
    if (pathname.startsWith('/mr/')) return 'MR Detail';
    if (pathname.startsWith('/release/')) return 'Release';
    return 'Home';
  }
```

---

### 7. `taskflow/src/routes/dashboard/WikiRenderer.tsx` — PATCH (remove workload staticLabel entry)

**Line 869 — entry to DELETE from `staticLabels` record:**
```typescript
// BEFORE (lines 862-873):
  const staticLabels: Record<string, string> = {
    '/sprint-board': 'Sprint Board',
    '/backlog': 'Backlog',
    '/my-tasks': 'My Tasks',
    '/epics': 'Epics',
    '/dashboard': 'Overview',
    '/sprint-progress': 'Sprint Progress',
    '/workload': 'Workload',          // DELETE this line
    '/releases': 'Releases',
    '/merge-requests': 'Merge Requests',
  };

// AFTER:
  const staticLabels: Record<string, string> = {
    '/sprint-board': 'Sprint Board',
    '/backlog': 'Backlog',
    '/my-tasks': 'My Tasks',
    '/epics': 'Epics',
    '/dashboard': 'Overview',
    '/sprint-progress': 'Sprint Progress',
    '/releases': 'Releases',
    '/merge-requests': 'Merge Requests',
  };
```

---

### 8. `taskflow/src/routes/dashboard/DiscussionThreads.tsx` — PATCH (remove workload staticLabel entry)

**Line 60 — identical pattern to WikiRenderer.tsx:**
```typescript
// BEFORE (lines 53-64):
  const staticLabels: Record<string, string> = {
    '/sprint-board': 'Sprint Board',
    '/backlog': 'Backlog',
    '/my-tasks': 'My Tasks',
    '/epics': 'Epics',
    '/dashboard': 'Overview',
    '/sprint-progress': 'Sprint Progress',
    '/workload': 'Workload',          // DELETE this line
    '/releases': 'Releases',
    '/merge-requests': 'Merge Requests',
  };

// AFTER: same result shape as WikiRenderer.tsx patch above
```

---

### 9. `taskflow/src/stores/settings.store.test.ts` — PATCH (remove widget test block)

**Lines 21–25 — imports to DELETE:**
```typescript
// DELETE these 3 imports (lines 21-25):
import {
  DEV_DASHBOARD_PRESET,
  PM_DASHBOARD_PRESET,
  WIDGET_REGISTRY,
} from '@/routes/dashboard/widgets/registry';
```

**Lines 56–186 — entire `describe` block to DELETE:**

Delete the entire `describe('settings.store — layout customization (Phase 34)', ...)` block (lines 56–187). This removes all `dashboardLayout`, `addDashboardWidget`, `removeDashboardWidget`, `updateWidgetConfig`, `DEV_DASHBOARD_PRESET`, `PM_DASHBOARD_PRESET`, and `WIDGET_REGISTRY` test cases.

The `beforeEach` at lines 57–64 uses `dashboardLayout: DEV_DASHBOARD_PRESET.map(...)` — this entire describe block goes away.

Tests within the block to remove (verify each is within lines 56–187 before deletion):
- `it('dashboardLayout defaults to DEV_DASHBOARD_PRESET...')` (line 71)
- `it('addDashboardWidget appends a new widget...')` (line 108)
- `it('removeDashboardWidget removes the widget...')` (line 122)
- `it('setDashboardLayout replaces the entire layout...')` (line 133)
- `it('updateWidgetConfig merges config...')` (line 142)
- `it('updateWidgetConfig merges into existing config...')` (line 152)
- `it('applyPreset("dev") sets sidebarItems...')` (line 165)
- `it('applyPreset("pm") sets sidebarItems...')` (line 179)

**Note:** The remaining `it('setSidebarItemVisible...')` and `it('reorderSidebarItem...')` tests inside the same describe block (lines 76–106) ALSO go away since their `beforeEach` uses `dashboardLayout`. The `sidebarItems` behavior is tested adequately by the existing describe blocks that remain.

**Surviving describes** (keep untouched):
- `describe('settings.store — keyboardOverrides (Phase 19)', ...)` — lines 27–54
- `describe('settings.store — updateCheckInterval (Phase 38)', ...)` — lines 189+
- All subsequent describe blocks (Phase 50, etc.)

---

### 10. `taskflow/src/routes/settings/Settings.test.tsx` — PATCH (remove workload + widget mock fields)

**Line 131 — entry to DELETE from `sidebarItems` mock array:**
```typescript
// DELETE this entry from the mockSettingsStore sidebarItems array (line 131):
    { id: 'workload', visible: false },
```

**Line 134 — field to DELETE from mockSettingsStore:**
```typescript
// DELETE (line 134):
  dashboardLayout: [],
```

**Lines 138–141 — action mocks to DELETE from mockSettingsStore:**
```typescript
// DELETE these 4 lines (138-141):
  setDashboardLayout: vi.fn(),
  addDashboardWidget: vi.fn(),
  removeDashboardWidget: vi.fn(),
  updateWidgetConfig: vi.fn(),
```

---

### 11. `taskflow/package.json` — PATCH (remove two packages)

**Line 42 — devDependency to DELETE:**
```json
"@types/react-grid-layout": "^1.3.6",
```

**Line 52 — dependency to DELETE:**
```json
"react-grid-layout": "^2.2.2",
```

After editing `package.json`, run:
```bash
npm install
```
to update `package-lock.json`. Then verify with `npm run build` per CONTEXT.md D-05.

---

## Shared Patterns

### Migration Version Bump Pattern
**Source:** `taskflow/src/stores/settings.store.ts` lines 375–458
**Apply to:** The v19 guard addition in settings.store.ts

All 18 prior migrations follow `if (version < N) { s.newField = default; }`. The v19 guard follows the same structure but with an empty (or comment-only) body since no new fields are initialized at this version. The version number in the `persist` options object (line 375) is bumped from `18` to `19` in parallel with adding the guard.

### Static Label Record Pattern
**Source:** `taskflow/src/routes/dashboard/WikiRenderer.tsx` lines 862–873 and `taskflow/src/routes/dashboard/DiscussionThreads.tsx` lines 53–64

Both files maintain identical `staticLabels: Record<string, string>` objects that mirror `routeLabel()` in `main.tsx`. All three must have the `'/workload': 'Workload'` entry removed to stay in sync.

---

## No Analog Found

All files in this phase are either being deleted or are self-referential patches. No net-new files are created that would require finding an external analog.

---

## Deletion Ordering Constraint

Per CONTEXT.md D-04, the following operations must happen in a single atomic commit (or at minimum before `npm run build` is run):

1. Delete `taskflow/src/routes/dashboard/widgets/registry.ts` (and all other widget files)
2. Remove `import { getDefaultDashboardLayout, WIDGET_REGISTRY } from '@/routes/dashboard/widgets/registry'` from `settings.store.ts` (line 16)
3. Remove all `dashboardLayout`/`addDashboardWidget`/`removeDashboardWidget`/`updateWidgetConfig` fields and actions from `settings.store.ts`
4. Replace `taskflow/src/routes/dashboard/index.tsx` with the stub

Running `npm run build` before step 2–4 after step 1 will produce a build error because `settings.store.ts` hard-imports the deleted registry.

---

## Metadata

**Analog search scope:** `taskflow/src/routes/dashboard/`, `taskflow/src/stores/`, `taskflow/src/components/app/`, `taskflow/src/main.tsx`, `taskflow/src/routes/routes.tsx`
**Files scanned:** 16
**Pattern extraction date:** 2026-05-20
