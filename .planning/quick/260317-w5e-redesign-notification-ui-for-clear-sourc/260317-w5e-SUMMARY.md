---
phase: quick
plan: 260317-w5e
subsystem: notifications-ui
tags: [ui, notifications, ux, redesign]
dependency_graph:
  requires: [notifications.store]
  provides: [redesigned-notification-row, source-grouped-popover]
  affects: [NotificationPopover, NotificationRow, TopBar]
tech_stack:
  added: []
  patterns: [source-badge-pill, sticky-section-headers, metadata-line-consolidation]
key_files:
  created: []
  modified:
    - taskflow/src/routes/notifications/NotificationRow.tsx
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/routes/notifications/NotificationRow.test.tsx
decisions:
  - Source badge uses colored pill (orange-500 Jira, purple-600 GitLab) as primary identifier; left border kept as secondary
  - Unread blue dot positioned on source badge rather than avatar to draw eye to source first
  - Metadata line consolidates source + type + timestamp on single row to reduce vertical waste
  - Section headers only rendered when both sources have items (skip when unambiguous)
  - labelMap and colorMap extracted to module-level constants for cleaner component body
metrics:
  duration: 2m 10s
  completed: "2026-03-17T22:15:27Z"
---

# Quick Task 260317-w5e: Notification UI Redesign Summary

Redesigned notification rows with prominent colored source badges (Jira/GitLab pills), consolidated metadata line (source + type + timestamp), author attribution, and source-grouped section headers in the popover.

## Changes Made

### Task 1: NotificationRow Redesign
- **Source badge**: Added prominent pill badges -- `bg-orange-500 text-white` for Jira, `bg-purple-600 text-white` for GitLab -- using `text-[10px] font-semibold px-1.5 py-0.5 rounded-full`
- **Metadata line**: Consolidated source badge + type badge + relative timestamp onto a single flex row with timestamp right-aligned via `ml-auto`
- **Author line**: Added `by {author}` in `text-xs text-muted-foreground` below metadata
- **Unread indicator**: Moved blue dot from avatar to source badge with `ring-1 ring-white` for visibility
- **Hover states**: Changed from `hover:bg-muted` to `hover:bg-accent/60` with `transition-colors duration-150`
- **Code cleanup**: Extracted `labelMap` and `colorMap` to module-level constants

### Task 2: NotificationPopover Source Grouping + Tests
- **Source grouping**: When both Jira and GitLab items exist, renders sticky section headers (`JIRA` / `GITLAB`) with `text-xs font-semibold uppercase tracking-wider`
- **Single-source behavior**: Skips headers when only one source has items
- **Header polish**: Added `bg-muted/30` background to popover header
- **Test fixes**: Updated `comment-mention` assertion from "Comment mention" to "Mentioned" (matching actual labelMap)
- **New tests**: Source badge text rendering, relative timestamp in metadata line, author name rendering

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 96a8736 | Redesign NotificationRow with prominent source badges and improved layout |
| 2 | 4b0d968 | Add source section headers to NotificationPopover and update tests |

## Self-Check: PASSED
