---
phase: quick
plan: 260316-qc2
subsystem: command-palette
tags: [shortcuts, command-palette, navigation, single-source-of-truth]
dependency_graph:
  requires: []
  provides: [nav-shortcuts-registry, dynamic-nav-group]
  affects: [taskflow/src/lib/shortcuts.ts, taskflow/src/components/app/CommandPalette.tsx]
tech_stack:
  added: []
  patterns: [data-driven-ui, registry-pattern]
key_files:
  created: []
  modified:
    - taskflow/src/lib/shortcuts.ts
    - taskflow/src/components/app/CommandPalette.tsx
decisions:
  - NavMeta interface with route/action union covers both navigate and custom-action nav items
  - navActionHandlers map in CommandPalette dispatches action-based entries without per-item branching
metrics:
  duration_minutes: 2
  completed: "2026-03-16T18:01:23Z"
---

# Quick Task 260316-qc2: Generalize Navigation Shortcuts Summary

**One-liner:** Navigation group in CommandPalette now derived from shortcuts.ts NAV_SHORTCUTS registry -- adding a nav shortcut auto-appears in the palette with its key hint.

## What Was Done

### Task 1: Add optional nav metadata to ShortcutEntry and populate on Navigation entries
**Commit:** 3dcfee7

- Added `NavMeta` interface with `label`, `route`, and `action` fields
- Extended `ShortcutEntry` with optional `navMeta` field
- Populated `navMeta` on all 4 Navigation entries (sprint, backlog, notifications, settings)
- Exported `NAV_SHORTCUTS` convenience filter (type-narrowed to guarantee `navMeta` present)

### Task 2: Replace hardcoded Navigation group with dynamic rendering from NAV_SHORTCUTS
**Commit:** 8a4a11a

- Imported `NAV_SHORTCUTS` into CommandPalette.tsx
- Replaced 4 hardcoded `<CommandItem>` elements with a `.map()` over `NAV_SHORTCUTS`
- Added `navActionHandlers` record for action-based entries (open-notifications)
- Fixed existing bug: Settings item now shows its shortcut hint (cmd+comma) which was previously missing
- All 12 existing CommandPalette tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Settings shortcut hint was missing**
- **Found during:** Task 2
- **Issue:** The hardcoded Settings CommandItem had no `<CommandShortcut>` child
- **Fix:** Dynamic rendering from navMeta automatically includes `s.defaultKey` for all items
- **Files modified:** taskflow/src/components/app/CommandPalette.tsx
- **Commit:** 8a4a11a

## Verification

- TypeScript compiles clean (no new errors; pre-existing errors in PinnedTabStrip and SprintBoardTab.test are unrelated)
- All 12 CommandPalette tests pass
- Navigation items render: Sprint Board (cmd+shift+S), Backlog (cmd+shift+B), Notifications (cmd+shift+N), Settings (cmd+comma)
