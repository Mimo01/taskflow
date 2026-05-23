---
phase: quick
plan: 260317-wes
subsystem: ui/sidebar
tags: [sidebar, cleanup, ui]
dependency_graph:
  requires: []
  provides: [sidebar-without-create-button]
  affects: [Sidebar.tsx, main.tsx]
tech_stack:
  added: []
  patterns: [prop-removal, dead-code-cleanup]
key_files:
  modified:
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/main.tsx
decisions:
  - "Removed SidebarProps interface entirely since onOpenCreate was its only field"
  - "Removed unused btnBase variable (dead code after button removal)"
metrics:
  duration_minutes: 3
  completed: "2026-03-17T22:24:00Z"
---

# Quick Task 260317-wes: Remove Create Issue from Sidebar Summary

Remove Create Issue button from Sidebar while keeping it available via Command Palette (Cmd+K).

## What Was Done

### Task 1: Remove Create Issue button from Sidebar

Removed the Create Issue button and all associated code from the Sidebar component:

1. **Sidebar.tsx:**
   - Removed `PlusSquare` import from lucide-react
   - Removed `SidebarProps` interface (was only `onOpenCreate`)
   - Changed component signature from `Sidebar({ onOpenCreate }: SidebarProps)` to `Sidebar()`
   - Removed the Create Issue `<button>` block
   - Removed unused `btnBase` variable (dead code after button removal)

2. **main.tsx:**
   - Removed `onOpenCreate={handleOpenCreate}` prop from `<Sidebar>` call
   - `handleOpenCreate` kept intact -- still used by CommandPalette (line 404)

**Commit:** `6c7951b`

## Verification

- "Create Issue" in Sidebar.tsx: 0 matches
- "onOpenCreate" in Sidebar.tsx: 0 matches
- "onOpenCreate" in CommandPalette.tsx: 3 matches (unchanged)
- TypeScript compiles cleanly for both modified files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Dead code] Removed unused btnBase variable**
- **Found during:** Task 1
- **Issue:** After removing the Create Issue button, the `btnBase` variable was defined but never used
- **Fix:** Removed the 3-line `btnBase` declaration
- **Files modified:** taskflow/src/components/app/Sidebar.tsx

## Self-Check: PASSED

- [x] taskflow/src/components/app/Sidebar.tsx exists and has no Create Issue button
- [x] taskflow/src/main.tsx has `<Sidebar />` without onOpenCreate
- [x] Commit 6c7951b exists and contains the changes
