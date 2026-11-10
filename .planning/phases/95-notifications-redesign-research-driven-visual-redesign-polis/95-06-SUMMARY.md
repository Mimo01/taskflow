---
phase: 95-notifications-redesign-research-driven-visual-redesign-polis
plan: 06
subsystem: notifications
tags: [visual-verification, uat, notification-cards, merge-rules, preview-harness]
requires: [95-05]
provides:
  - "Flat list of two-line notification cards (approved in human UAT after 13 rounds)"
  - "View-model merge of consecutive same-actor events (no grouping UI)"
  - "Per-action icon/colour map (ACTION_STYLE) incl. GitLab system notes as changes"
  - "Card-based unread count (countUnreadCards / useUnreadCardCount) for bell + tab chips"
affects: []
key-files:
  created:
    - taskflow/src/routes/notifications/NotificationAvatar.tsx
    - taskflow/src/routes/notifications/notification-colours.ts
    - taskflow/src/routes/notifications/useUnreadCardCount.ts
  modified:
    - taskflow/src/routes/notifications/NotificationRow.tsx
    - taskflow/src/routes/notifications/notification-view.ts
    - taskflow/src/routes/notifications/NotificationList.tsx
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/components/app/TopBar.tsx
    - (+ matching .test files)
  deleted:
    - taskflow/src/routes/notifications/NotificationGroupHeader.tsx (+ test)
key-decisions:
  - "Grouping UI removed entirely (user rejected every grouped variant). Supersedes UI-SPEC/95-03 group header and 95-04 Right/Left expand keys."
  - "Card = avatar (actor or system tile) + per-action badge; line 1 key · parent › title · time; line 2 Actor + coloured action + detail; optional list (changes / merged comments)."
  - "Colour is used for action type (mention violet, comment blue, assign teal, approve/merge green, fail red, due/status amber, …) — the dashboard 'colour = status only' rule does not apply to feeds (user-directed)."
  - "Merge rule (view-model only): same source + entity + actor + category (conversation | changes), chronologically consecutive on that entity, gaps <= 60 min, same time bucket. Assignment/approval/pipeline/due/MR state never merge. Card unread if any item unread; read/Done act on all ids."
  - "Single change grammar: 'changed field old → new'; one-sided -> 'added field X' / 'removed field X' (assigned/unassigned, requested/removed review from). Multi-change: 'updated N fields' + aligned grid list (icon | field | old | → | new), empty side = dashed 'none' chip."
  - "Lists show up to 10 rows; >10 -> 9 + '+N more' (never '+1 more'). Shared visibleCount/listRowCount drive cards and virtualizer estimate."
  - "No card hover tooltip (all info on card); dates shown for items >= 7 days; tray-button tooltips (label + shortcut) kept."
  - "GitLab system notes (id prefix gitlab-system-) render as changes, never 'commented' — view-layer fix, no persisted-data migration."
requirements-completed: [NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07, NOTIF-08, NOTIF-09, NOTIF-10]
completed: 2026-11-10
---

# Phase 95 Plan 06: Visual verification Summary

The plan's two tasks were (1) screenshot the redesign in a throwaway preview harness and (2) human
check. Task 1 surfaced one defect (tab label wrap). Task 2 turned into 13 UAT rounds in which the user
reshaped the popover. The final, approved design is a flat list of two-line "notification cards" with
system-side merging. It differs substantially from the 95-03/95-05 grouped one-line rows. All
changes landed as fix(95-06) commits with tests; the full suite passed on every commit (final:
4674 passed).

## UAT rounds (user feedback → change)
1. "Hard to see what is happening at a glance" → title-first rows, short verb tail (92370a36)
2. "Missing colour… I want avatars, icons" → actor avatar + coloured action badge + coloured verb (05894d36)
3. Groups looked different; subtasks lacked parents; "updated" said nothing → uniform rows, parent › title, parsed change details (d19dcc0e, 1531ef4b)
4. Hover overrode neighbour badge; columns; separation; groups → named group/row hover scope, aligned columns, dividers (42a0f616)
5. Keys wrapped; rows too small → nowrap keys, taller rows (a4351bf1, 1622ef8f)
6. More icons; MR comment content; no "events" pill → per-action icons, GitLab system notes as changes, comment text in detail (571cef45)
7. "Do not group at all… show more info" → flat two-line rows (7f51ab0a)
8. "More bubbly"; multi-change clarity; merge same-actor comments → cards, change list, merge rules (ea35f34f)
9. Egg avatars; list all comments; squashed pills; who is it?; no per-comment times → (4e3c9f34, 1ab2da5e)
10. "Visuals are inconsistent" → combination matrix (66 cards × themes × densities) + written style contract, alignment measured (7f0a89f9)
11. Truncation dots; tooltip overflow; none styling; aligned arrows; drop tooltip; spacing; "added/removed"; +1 rule; inline key; key not a link; pointer cursor (a2117bb0, 3064e0c1, 031e4e65, 72fd5b02, 1e78c5ad)
12. Up to 10 items per card (8dbdf678)
13. Improvements 4/5/7/8/10/11: card-based bell count, dates for older items, tray fade, dark avatar contrast, unified banners, focus ring verified (511ba506)

## Commits
36517cb6, 92370a36, 05894d36, d19dcc0e, 1531ef4b, 42a0f616, a4351bf1, 1622ef8f, 571cef45, 7f51ab0a, ea35f34f, 4e3c9f34, 1ab2da5e, 7f0a89f9, a2117bb0, 3064e0c1, 031e4e65, 72fd5b02, 1e78c5ad, 8dbdf678, 511ba506

## Deviations from plan
- Scope grew from "verify" to an iterative redesign driven by the user in UAT. Every change was user-requested or user-approved.
- Grouping (95-03 NotificationGroupHeader, 95-04 Right/Left expand) removed; markItemsUnread is used again for merged cards.
- Throwaway harness `taskflow/preview-95/` was never committed and has been deleted.

## Known follow-ups (filed as todos)
- Jira polls cap at maxResults=20 per query → notifications silently dropped on busy days (data bug).
- Status pill colours are keyword-guessed from status names; use real status categories.
- Due reminders lack the due date → no "overdue"/"in Nd".
- Highlight "@you" inside comment text.
- Real avatar images not verified in the harness (stubbed); check in the Tauri app.

## Self-Check: PASSED
