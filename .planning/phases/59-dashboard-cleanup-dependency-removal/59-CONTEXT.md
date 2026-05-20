# Phase 59: Dashboard Cleanup + Dependency Removal - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove the widget-based dashboard system (WidgetGrid, WidgetCard, WidgetPicker, 11 widget types, registry), the Workload page and all its routing/sidebar references, and the react-grid-layout + @types/react-grid-layout packages — leaving the build clean and all remaining tests passing. Replace the deleted dashboard index with a minimal stub component so the `/dashboard` route stays valid until Phase 60 adds the real static dashboard.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Placeholder
- **D-01:** Replace `taskflow/src/routes/dashboard/index.tsx` with a minimal stub: `export default function Dashboard() { return <div />; }` — no imports, no logic. Phase 60 overwrites this file entirely.

### Cleanup Breadth
- **D-02:** All workload references are removed in Phase 59 — not deferred to Phase 63. This includes:
  - `taskflow/src/routes/dashboard/WikiRenderer.tsx` — remove the `'/workload': 'Workload'` path-to-label entry
  - `taskflow/src/routes/dashboard/DiscussionThreads.tsx` — remove the `'/workload': 'Workload'` path-to-label entry
  - `taskflow/src/main.tsx:292` — remove the `if (pathname.startsWith('/workload')) return 'Workload'` branch
  - `taskflow/src/components/app/sidebar-items.ts` — remove the `workload` sidebar entry and any workload-related preset IDs

### Store Migration
- **D-03:** Bump `settings.store.ts` from version 18 to 19. Remove `dashboardLayout` field, `addDashboardWidget`, `removeDashboardWidget`, `updateWidgetConfig` actions, and the `import { getDefaultDashboardLayout, WIDGET_REGISTRY }` from registry. No explicit `delete` in the migration body — Zustand's LazyStore ignores extra persisted keys that are absent from the new store shape (consistent with all 18 prior migrations, which only add fields, never delete them). A bare `if (version < 19) { /* no new fields to set */ }` guard is sufficient to advance the persisted version number.

### Pre-decided (from STATE.md)
- **D-04:** Deletion is atomic — registry files, store update, and widget test block removed in a single commit to avoid a window where `settings.store.ts` imports a deleted registry file.
- **D-05:** Verify cleanup with `npm run build`, not just `tsc`. react-grid-layout imports CSS which fails silently in TypeScript type-checking but breaks at Vite build time.

### Claude's Discretion
- Store migration guard body: if no new fields need to be introduced at v19, the guard block can be omitted entirely (bump version only). Claude decides based on whether any net-new field initialization is needed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Removals — REMOVE-01, REMOVE-02, QUAL-03 (the three requirements this phase covers)

### Phase Details
- `.planning/ROADMAP.md` §"Phase 59: Dashboard Cleanup + Dependency Removal" — success criteria (5 criteria), goal statement

### Store
- `taskflow/src/stores/settings.store.ts` — current v18 store; all widget fields and actions to be removed; migration pattern reference

### Files to Delete
- `taskflow/src/routes/dashboard/WidgetGrid.tsx`
- `taskflow/src/routes/dashboard/WidgetCard.tsx`
- `taskflow/src/routes/dashboard/WidgetPicker.tsx`
- `taskflow/src/routes/dashboard/WorkloadTab.tsx`
- `taskflow/src/routes/dashboard/WorkloadSkeleton.tsx`
- `taskflow/src/routes/dashboard/WorkloadTab.test.tsx`
- `taskflow/src/routes/dashboard/widgets/` (entire folder: 11 widget files + `registry.ts`)
- `taskflow/src/routes/dashboard/index.tsx` (replaced by stub, not just deleted)

### Files to Patch
- `taskflow/src/routes/routes.tsx` — remove `WorkloadTab` lazy import and `/workload` route entry
- `taskflow/src/components/app/sidebar-items.ts` — remove workload sidebar item and preset reference
- `taskflow/src/main.tsx` — remove pathname `'/workload'` branch (line ~292)
- `taskflow/src/routes/dashboard/WikiRenderer.tsx` — remove `'/workload': 'Workload'` lookup entry
- `taskflow/src/routes/dashboard/DiscussionThreads.tsx` — remove `'/workload': 'Workload'` lookup entry
- `taskflow/src/stores/settings.store.ts` — version bump, remove widget fields/actions/import

### Tests to Update
- `taskflow/src/stores/settings.store.test.ts` — remove widget test block (imports of `WIDGET_REGISTRY`, `DEV_DASHBOARD_PRESET`, and all `dashboardLayout`/`addDashboardWidget`/`removeDashboardWidget`/`updateWidgetConfig` test cases)
- `taskflow/src/routes/settings/Settings.test.tsx` — audit for widget references; remove any found

### Package
- `taskflow/package.json` — remove `react-grid-layout` and `@types/react-grid-layout`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `taskflow/src/stores/settings.store.ts` — LazyStore migration pattern (v1–v18): only `if (version < N) { s.newField = default; }` style; no deletions. Match this style for v19.
- `taskflow/src/routes/routes.tsx` — `withLazy()` wrapper pattern for lazy routes; removing WorkloadTab entry is straightforward.

### Established Patterns
- Migration guards only initialize new fields (additive). The v19 guard may be empty body if no new fields are added at this version.
- `npm run build` is the authoritative verification step (Vite catches CSS import failures that `tsc` misses).
- Biome handles linting post-deletion — run `npx biome check --write` after the file deletions to clean up any newly-stale imports.

### Integration Points
- `settings.store.ts` hard-imports `registry.ts` via `import { getDefaultDashboardLayout, WIDGET_REGISTRY } from '@/routes/dashboard/widgets/registry'` — this import must be removed before or at the same commit as registry deletion (not after).
- `react-grid-layout` is imported in `WidgetGrid.tsx` (including CSS). Once `WidgetGrid.tsx` is deleted, the package can be uninstalled without leaving a dangling CSS import.
- The `/dashboard` route in `routes.tsx` keeps its entry — just swaps `<Dashboard />` (old widget component) for the new stub.

</code_context>

<specifics>
## Specific Ideas

- No "Dashboard coming soon" text in the stub — genuinely empty `<div />` is preferred. Phase 60 is the very next phase and will replace the stub immediately.
- No explicit `delete (persisted as any).dashboardLayout` in the v19 migration — implicit drop via Zustand's LazyStore ignore-extra-keys behavior is the correct approach for this codebase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 59-Dashboard Cleanup + Dependency Removal*
*Context gathered: 2026-05-20*
