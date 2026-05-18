---
quick_id: 260517-py2
slug: unify-the-style-of-all-pills-and-badges-
description: unify the style of all pills and badges across the app to have the same style
date: 2026-05-17
status: complete
commits:
  - 9425ed6
  - 7a60390
---

# Quick Task 260517-py2: Unify Pills and Badges Style

## Summary

Unified the visual language of all chip/pill/badge elements across the app into a consistent rounded-rectangle, muted-tint system.

## What Was Done

### Task 1 — Update Badge primitive + tone variant + tonePillClass helper
**Commit:** 9425ed6  
**Files:** `taskflow/src/components/ui/badge.tsx`, `taskflow/src/lib/statusStyles.ts`

- `badge.tsx`: Changed `rounded-4xl` → `rounded`, `px-2` → `px-1.5`. Added `tone` prop (7 values: `blue | green | red | orange | amber | purple | muted`) mapping to the muted-tint palette (`bg-{color}-500/15 text-{color}-600 dark:text-{color}-400`). All ~25 existing `<Badge>` callers automatically inherit the new shape.
- `statusStyles.ts`: Added `ChipTone` type, `CHIP_TONE_CLASS` map, and `tonePillClass()` helper — single source of truth imported by `badge.tsx`.

### Task 2 — Migrate all hand-rolled chips and color-override badges
**Commit:** 7a60390  
**Files:** 14 consumer files

State-like chips migrated to `<Badge tone="...">`:
- `SprintMoveMenuItems` — sprint Active badge
- `BacklogPage` — section header badges (green Active, blue closed)
- `BacklogFilterBar` — filter tag chips
- `StoryHeaderRow` / `BacklogRow` — epic pills (geometry only, identity color preserved via inline style)
- `EpicsPage` — epic name pills (geometry only)
- `MergeRequestListPage` / `MergeRequestDetailPage` / `MrRow` — MR state badge with icon, Stale chip, GitLab labels (geometry only)
- `ReleaseDetailPage` / `ReleasesTab` / `ReleasesWidget` — Released (green), Unreleased (amber/red overdue) badges
- `WikiRenderer` — mention badge (`@user`), rounded-rectangle primary-tint

Identity-color carriers (epic pills, GitLab MR labels) keep per-item `style={{ backgroundColor, color, borderColor }}` — only geometry unified to `rounded text-xs py-0.5`.

### Task 3 — Visual UAT
**Result:** Approved by user

Verified across sprint board, backlog, issue detail, epics, releases, merge requests, and wiki. Regression check passed: notification circles, status dots, and story-points chip unchanged.

## Scope Carve-outs

- Notification count circles (TopBar bell, NotificationPopover tabs) — circles by design
- Status dots, progress bars, toggle switches, kbd keycaps — not chips
- Story-points small inline chip (TaskCard) — font-mono numeric indicator
- UnifiedFilterBar interactive filter chips — distinct multi-element control language
