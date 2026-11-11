---
phase: 95-notifications-redesign-research-driven-visual-redesign-polis
verified: 2026-11-11T09:30:00Z
status: human_needed
score: 10/10 requirements verified
overrides_applied: 0
human_verification:
  - test: "Open the Tauri app with real Jira/GitLab data and view the notification popover"
    expected: "Real actor avatar images render in NotificationAvatar (initials fallback only when no image); no egg/squashed avatars"
    why_human: "Avatar images were stubbed in the preview harness and never checked against the real app (noted in 95-06-SUMMARY follow-ups)"
---

# Phase 95: Notifications redesign Verification Report

**Goal:** Redesign notifications visually and polish UI/UX, using researched best practice that fits taskflow's design language.
**Status:** human_needed (all automated checks pass; one item was never human-verified)
**Re-verification:** No, initial.

Note: `.planning/REQUIREMENTS.md` does not exist (archived by milestone close). NOTIF-01..10 are defined in ROADMAP.md (Phase 95) and 95-RESEARCH.md / 95-CONTEXT.md ("adopt research's NOTIF-01..10, NOTIF-08 reworded per D-13"). All 10 IDs appear in plan frontmatter and in 95-06-SUMMARY `requirements-completed`; there are no orphaned IDs.

## Supersessions (user-directed at UAT, 95-06)
- Grouping UI (95-03 group header, 95-04 Right/Left expand) removed and replaced by view-model merging. Not a gap.
- Colour per action type, instead of status-only colour, and removal of the card hover tooltip are user-directed.
- Approved by the user on 2026-11-10 (95-06 checkpoint). Recorded as completed human verification.

## Requirements Coverage

| Req | Description (as adopted) | Status | Evidence |
|---|---|---|---|
| NOTIF-01 | Compact feed rows, no stacked chip/body/parent lines | SATISFIED (superseded form) | The original "one line" was replaced by a user-approved flat list of two-line cards (NotificationRow.tsx, header contract). Density variants are present (`density-compact:`/`density-comfortable:`). |
| NOTIF-02 | Same-entity events grouped | SATISFIED (merging form) | `buildEntries` in notification-view.ts merges consecutive same-source/entity/actor/category events within 60 min and the same bucket into one card (`items: group`). Time bucket headers are kept. The group header UI is intentionally gone. |
| NOTIF-03 | Unread = dot + weight | SATISFIED | NotificationRow.tsx:466-469 `bg-primary` dot (opacity-0 when read); line 500 semibold/foreground vs normal/muted. Colour is per action type (user-directed). |
| NOTIF-04 | Triage: read/unread toggle, Done, scoped Mark all read, Clear read | SATISFIED | Popover has Mark all read, Clear read, and the `markItemsRead`/`markItemsUnread`/`removeItems`/`clearRead(source?)` store actions; row tray has Mark as read/unread. |
| NOTIF-05 | Keyboard nav (j/k/arrows, u, e/Delete, modifier/input guard) | SATISFIED | NotificationList.tsx:52,102,112-135. Right/Left expand removed with grouping. |
| NOTIF-06 | Segmented Unread/All + source tabs with neutral counts | SATISFIED | NotificationPopover.tsx:284 `aria-pressed` segmented buttons; source tabs; card-based counts via `useUnreadCardCount` / `countUnreadCards`. |
| NOTIF-07 | Empty/error states use shared components | SATISFIED | `EmptyState` is used in NotificationPopover.tsx:187/198/208; popover tests pass. |
| NOTIF-08 | Row click = mark read + full-page navigation, no peek (D-13) | SATISFIED | NotificationPopover.tsx:100-106 calls `onIssueClick` / `onMRClick`. |
| NOTIF-09 | Data hygiene: readIds pruned, dismissed reminders stay dismissed | SATISFIED | `pruneReadIds` (store:101,149,159) with a 200-item cap; `dismissedIds` tombstones are persisted and used by the polling hook (useNotificationPolling.ts:206); due-date id embeds the date (`jira-duedate-PROJ-1-2026-11-12`, tested). |
| NOTIF-10 | Bell badge: count, 99+ cap, pulse only on increase | SATISFIED | TopBar.tsx:50-81,120. WR-04 (pulse sticking on launch) fixed per 95-REVIEW-FIX. |

## Observable truths
10 of 10 requirement-level truths are verified in their user-approved form. I checked the code directly and did not rely on SUMMARY claims. The plan-level truths for the group header, Right/Left expand and the hover tooltip are superseded and not counted.

## Spot-checks
- `npx vitest run src/routes/notifications src/stores/notifications.store.test.ts src/services/notifications.test.ts src/components/app` produced 21 files and 400 tests, all passing.
- The orchestrator reports the full suite at 4700 passing, tsc clean and phase files biome-clean.

## Anti-patterns
No TBD/FIXME/XXX markers in the phase's notifications files, store or service.

## Known follow-ups (not gaps; filed as todos)
WR-05/06, the Jira maxResults=20 poll cap, status-pill colour guessing, due reminders lacking the due date, and highlighting @you in comments. None is demanded by a NOTIF requirement.

## Human verification required
1. Real avatar images in the Tauri app (see frontmatter). The rest of the visual verification was approved at UAT on 2026-11-10.

## Gaps Summary
No gaps. Goal achieved, in the user-approved redesigned form.

_Verifier: Claude (gsd-verifier)_
