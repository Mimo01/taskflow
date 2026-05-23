---
phase: quick-260329-mxv
plan: 01
subsystem: update-ui
tags: [ui, changelog, dialogs, settings]
dependency_graph:
  requires: []
  provides: [wider-update-dialogs, polished-changelog-rendering]
  affects: [UpdateDialog, WhatsNewDialog, UpdatesSection]
tech_stack:
  added: []
  patterns: [tailwind-arbitrary-selectors, prose-typography]
key_files:
  created: []
  modified:
    - taskflow/src/components/update/UpdateDialog.tsx
    - taskflow/src/components/update/WhatsNewDialog.tsx
    - taskflow/src/routes/settings/UpdatesSection.tsx
decisions:
  - "Used Tailwind arbitrary selectors ([&>h2]:text-sm etc.) to tighten prose heading/list spacing without a separate CSS file"
  - "max-w-none on prose containers overrides Tailwind Typography plugin default max-width so markdown uses full dialog width"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-29T14:35:00Z"
  tasks_completed: 2
  files_modified: 3
---

# Quick 260329-mxv: Make Changelogs Look Nicer — Update Dialogs and Settings

**One-liner:** Widened update dialogs to 512px (sm:max-w-lg), expanded changelog scroll areas 50%, added tightened prose spacing selectors, release date on UpdateDialog, subtitle on WhatsNewDialog, and polished settings release history with left border, hover states, scroll containment, and pre-release badges.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Widen update dialogs and expand changelog areas | 78267ab | UpdateDialog.tsx, WhatsNewDialog.tsx |
| 2 | Polish settings release history changelog rendering | b4a5562 | UpdatesSection.tsx |

## Changes Summary

### Task 1: Update Dialogs (UpdateDialog.tsx, WhatsNewDialog.tsx)

Both dialogs now use `sm:max-w-lg` (512px) instead of the default `sm:max-w-sm` (384px).

**UpdateDialog:**
- Changelog area: `max-h-48` → `max-h-72` (288px, 50% taller)
- Prose: added `max-w-none` for full-width markdown
- Added release date display below version arrow (`text-xs text-muted-foreground`)
- Tightened heading/list spacing via: `[&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1 [&>ul]:my-1 [&>ul]:pl-4`

**WhatsNewDialog:**
- Changelog area: `max-h-64` → `max-h-80` (320px)
- Prose: added `max-w-none` for full-width markdown
- Added `DialogDescription` import and subtitle: "Here's what changed in this update"
- Same tightened heading/list spacing selectors

### Task 2: Settings Release History (UpdatesSection.tsx)

- Expanded changelog container: added `border-l-2 border-muted pl-4 max-h-64 overflow-y-auto` plus tightened prose spacing selectors (consistent with dialogs)
- Release rows: added `hover:bg-muted/50 px-2 -mx-2 rounded-md transition-colors` for subtle hover state
- Pre-release items: added `<Badge variant="outline">pre-release</Badge>` next to tag name

## Test Results

All existing tests pass:
- `UpdateDialog.test.tsx`: 11/11 passed
- `WhatsNewDialog.test.tsx`: 5/5 passed (included in update run)
- `UpdatesSection.test.tsx`: 13/13 passed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- taskflow/src/components/update/UpdateDialog.tsx: FOUND
- taskflow/src/components/update/WhatsNewDialog.tsx: FOUND
- taskflow/src/routes/settings/UpdatesSection.tsx: FOUND
- Commit 78267ab: FOUND
- Commit b4a5562: FOUND
