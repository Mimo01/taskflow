---
phase: 50-draggable-sidebar-resize
plan: "02"
subsystem: sidebar
tags: [resize, sidebar, drag-handle, useResizable, inline-style]
dependency_graph:
  requires:
    - taskflow/src/hooks/useResizable.ts (plan 50-01)
    - taskflow/src/stores/settings.store.ts (version 14, plan 50-01)
  provides:
    - taskflow/src/components/app/Sidebar.tsx (drag-to-resize wired)
  affects:
    - Plan 50-04 (human verify — Sidebar.tsx is the primary visual verification target)
tech_stack:
  added: []
  patterns:
    - useResizable hook wired with sidebarWidth from useSettingsStore
    - Inline style={{ width }} replaces Tailwind width classes for dynamic user-controlled width
    - Conditional transition-all suppressed while isDragging (resolves RESEARCH.md A3)
    - Drag handle div: absolute right-0, w-2, z-20, cursor-ew-resize, aria-hidden, border-color var(--ring) on hover/drag
    - D-02: drag handle rendered only when !sidebarCollapsed
    - D-01: sidebarCollapsed ? 64 : width — collapse toggle independent of drag width
key_files:
  created: []
  modified:
    - taskflow/src/components/app/Sidebar.tsx
decisions:
  - "Drag handle inserted before chevron toggle button: ordering puts drag affordance at z-20 above chevron at z-10, matching plan spec"
  - "Pre-existing BacklogPage test failure (BACK-02) confirmed out-of-scope — fails on base commit before any Sidebar changes"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-10"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 50 Plan 02: Sidebar Drag-to-Resize Wiring Summary

Main navigation sidebar wired with useResizable hook — inline style width, drag handle affordance, and collapse-independent resize.

## What Was Built

**Sidebar.tsx wired with useResizable** (`taskflow/src/components/app/Sidebar.tsx` — modified):

Four targeted changes made to the component:

1. **Import added**: `import { useResizable } from '@/hooks/useResizable'` after existing React imports.

2. **Store selectors added**: `sidebarWidth` and `setSidebarWidth` read from `useSettingsStore` via individual selectors (matching existing selector pattern in the file).

3. **Hook call added**: `useResizable({ initialWidth: sidebarWidth, min: 160, max: 320, onCommit: setSidebarWidth })` — returns `{ width, isDragging, handleMouseDown }`. Bounds match D-05 (160px min / 320px max).

4. **`<aside>` element replaced**:
   - `w-16` and `w-16 md:w-56` Tailwind width classes removed entirely
   - `style={{ width: sidebarCollapsed ? 64 : width }}` drives width at runtime — D-01 preserved (collapse always 64px, expand restores drag-set width)
   - `shrink-0` kept as Tailwind class (prevents Pitfall 4: double-shrink during drag)
   - `transition-all duration-200` conditionally applied only when `!isDragging` (resolves RESEARCH.md A3 — prevents CSS transition fighting drag feedback)

5. **Drag handle div added** (inserted immediately after `<aside>` opening tag, before chevron button):
   - Conditionally rendered: `{!sidebarCollapsed && ...}` — D-02 satisfied (no affordance in collapsed state)
   - `aria-hidden="true"` — mouse-only, no keyboard role
   - `onMouseDown={handleMouseDown}` — starts drag
   - `className="absolute right-0 top-0 h-full w-2 cursor-ew-resize z-20 border-r border-border transition-colors duration-100"`
   - `z-20` — above chevron button at `z-10`
   - Border color: `var(--ring)` on hover (via `onMouseEnter`/`onMouseLeave` inline style mutations) and always while `isDragging` (via `style={{ borderColor: isDragging ? 'var(--ring)' : undefined }}`)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| d2bb4ab | feat | wire Sidebar.tsx with useResizable drag-to-resize |

## Deviations from Plan

None — plan executed exactly as written. All five changes (import, selectors, hook call, `<aside>` replacement, drag handle div) implemented per the plan specification.

### Out-of-scope pre-existing failure logged

**BacklogPage.test.tsx — BACK-02** (`moving an issue to a sprint invalidates jira-backlog-sprint-stories cache key`) fails on the base commit (`0610f0e`) before any changes in this plan. Confirmed by stashing changes and running the test. This failure is unrelated to Sidebar.tsx and is outside the scope of this plan per the deviation rules scope boundary.

## Known Stubs

None — all wiring is complete. `useResizable` reads from the persisted `sidebarWidth` store field (default 224), applies it as inline style, and commits via `setSidebarWidth` on mouseup.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or trust boundary crossings. Width is clamped to [160, 320] in `useResizable` before being committed to the store.

## Self-Check

Files modified:
- taskflow/src/components/app/Sidebar.tsx — FOUND

Commits:
- d2bb4ab — FOUND

Done criteria:
- `style={{ width: sidebarCollapsed ? 64 : width }}` — 1 match
- `useResizable(` — 1 match
- `w-16` count — 0 (removed)
- `!sidebarCollapsed` — 2 matches (drag handle conditional + existing content)
- `aria-hidden` — 1 match
- `cursor-ew-resize` — 1 match
- `setSidebarWidth` — 2 matches (selector + onCommit)
- `shrink-0` — 5 matches (present, not removed)
- TypeScript: exits 0
- Tests: 846 passed, 1 pre-existing unrelated failure (BacklogPage BACK-02)

## Self-Check: PASSED
