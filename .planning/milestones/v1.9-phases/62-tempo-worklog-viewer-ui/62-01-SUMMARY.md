---
phase: 62-tempo-worklog-viewer-ui
plan: "01"
subsystem: sidebar-routing
tags: [sidebar, routing, tempo, feature-gate, lucide, react-router]
dependency_graph:
  requires: []
  provides:
    - worklogs sidebar nav item gated by tempoEnabled
    - /worklogs route registered via withLazy(WorklogsPage)
    - WorklogsPage stub ready for Plan 02 replacement
  affects:
    - taskflow/src/components/app/sidebar-items.ts
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/components/app/Sidebar.test.tsx
    - taskflow/src/routes/routes.tsx
    - taskflow/src/routes/worklogs/WorklogsPage.tsx
tech_stack:
  added: []
  patterns:
    - fine-grained useSettingsStore selector (IN-01 pattern) for tempoEnabled
    - negation-of-disable-condition gate clause matching AIO gate shape
    - withLazy(Component) wrapping lazy import for route code-splitting
key_files:
  created:
    - taskflow/src/routes/worklogs/WorklogsPage.tsx
  modified:
    - taskflow/src/components/app/sidebar-items.ts
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/components/app/Sidebar.test.tsx
    - taskflow/src/routes/routes.tsx
decisions:
  - "WorklogsPage is an intentional stub: Plan 62-02 will overwrite it with the full data-table implementation without touching routes.tsx"
  - "tempoEnabled gate uses fail-closed logic: undefined evaluates as falsy, keeping the link hidden when settings migration hasn't run yet"
  - "worklogs added to both devVisible and pmVisible so the tempoEnabled gate is the single source of truth for user-facing visibility"
metrics:
  duration: ~8 minutes
  completed: "2026-05-21"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
---

# Phase 62 Plan 01: Sidebar Wiring + Route Stub Summary

Wired the Tempo Worklogs viewer into the app shell: Clock-icon sidebar nav item gated by `tempoEnabled` in the Tracking section, `/worklogs` route registered via `withLazy(WorklogsPage)`, and a minimal stub page with a clear Plan 62-01 marker ready for Plan 02 to overwrite.

## What Was Built

### Task 1: Sidebar nav definition + Clock icon + tempoEnabled gate
- `sidebar-items.ts`: inserted `{ id: 'worklogs', label: 'Worklogs', path: '/worklogs', iconName: 'Clock', section: 'tracking' }` after the `releases` entry (end of Tracking section, before Testing/AIO block)
- `sidebar-items.ts`: added `'worklogs'` to both `devVisible` and `pmVisible` Sets in `getDefaultSidebarItems` so both role presets include it — `tempoEnabled` is the authoritative user-facing gate
- `Sidebar.tsx`: added `Clock` import (alphabetical between `ChevronRight` and `FlaskConical`)
- `Sidebar.tsx`: added `Clock,` entry to `ICON_MAP`
- `Sidebar.tsx`: added `const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);` fine-grained selector (IN-01 pattern, after `selectedAioProjectKey`)
- `Sidebar.tsx`: added `!(nav.id === 'worklogs' && !tempoEnabled)` AND-clause to `sectionedItems` filter, mirroring the AIO gate shape — fails closed when `tempoEnabled` is `undefined`

### Task 2: Sidebar.test.tsx tempoEnabled gate tests (D-06)
- Added `let mockTempoEnabled = false;` alongside existing mock variables
- Added `tempoEnabled: mockTempoEnabled` to the settings store mock state object
- Added `{ id: 'worklogs', visible: true }` to the `sidebarItems` mock array (required so the visibleIds Set passes the item through to the gate predicate)
- Added `describe('Sidebar — tempoEnabled gate')` block with two `it()` tests:
  - D-06: shows Worklogs link when `tempoEnabled=true` (asserts `getByText('Worklogs')`)
  - D-06: hides Worklogs link when `tempoEnabled=false` (asserts `queryByText('Worklogs')` is null)
- All 7 Sidebar tests pass (5 existing aioEnabled gate tests + 2 new tempoEnabled tests)

### Task 3: WorklogsPage stub + /worklogs route
- Created `taskflow/src/routes/worklogs/WorklogsPage.tsx` — minimal flex-column stub with `<h1>Worklogs</h1>` heading, Plan 62-01 stub marker comment, no data-fetching code
- `routes.tsx`: added `const WorklogsPage = lazy(() => import('./worklogs/WorklogsPage'));` after `AioTestRunDetailPage`
- `routes.tsx`: added `{ path: '/worklogs', element: withLazy(WorklogsPage) }` after `/releases` entry
- Build passes; TypeScript compiles clean

## Plan 02 Readiness

`taskflow/src/routes/worklogs/WorklogsPage.tsx` exists with a `Plan 62-01 stub` comment and exports a default function named `WorklogsPage`. Plan 02 can overwrite this file in-place — `routes.tsx` requires no further changes.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Stub page body "Plan 62-02 will implement this view." | `taskflow/src/routes/worklogs/WorklogsPage.tsx` | Intentional — Plan 02 replaces this file with the full worklog data-table implementation |

## Deviations from Plan

### Worktree node_modules resolution

**Found during:** Task 2 (running tests)
**Issue:** The worktree directory has no `node_modules`; running `npm test` from the worktree failed with `ERR_MODULE_NOT_FOUND: @vitejs/plugin-react`. The main repo's `node_modules` was located at the sibling `taskflow/` directory.
**Fix:** Created a symlink `taskflow/src` → actually no — created `worktree/taskflow/node_modules` → `main/taskflow/node_modules` symlink. Tests then ran and passed correctly from the worktree directory.
**Impact:** Zero — no source code changes, test results valid.

## Threat Flags

None. The stub page introduces no network endpoints, no auth paths, no file access, no schema changes. The `tempoEnabled` gate fails closed (undefined → falsy → link hidden) per T-62-01 mitigation.

## Self-Check: PASSED

- `taskflow/src/routes/worklogs/WorklogsPage.tsx` — FOUND
- `taskflow/src/components/app/sidebar-items.ts` — worklogs entry present (id, iconName, devVisible, pmVisible)
- `taskflow/src/components/app/Sidebar.tsx` — Clock import, ICON_MAP entry, tempoEnabled selector, gate clause
- `taskflow/src/components/app/Sidebar.test.tsx` — tempoEnabled gate describe block, 7 tests pass
- `taskflow/src/routes/routes.tsx` — lazy declaration + /worklogs route entry
- Commits: edb22e92, 7daca7fe, f1de8b02 — all present in git log
