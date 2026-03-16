---
phase: quick-260316-s5u
plan: 01
subsystem: notifications
tags: [jira, gitlab, notifications, polling, settings, zustand]

requires:
  - phase: 18-app-icon-multi-page-settings
    provides: settings store with persist/migrate pattern, NotificationSettingsSection
provides:
  - 6 new notification types (gitlab-mention, jira-comment, mr-approval, pipeline-failure, issue-assignment, due-date-reminder)
  - NotificationType union type (9 types total)
  - Per-type notification toggles in settings store (v3 migration)
  - Grouped settings UI (Jira / GitLab / Desktop sections)
  - Color-coded notification badges per type
  - gitlabUsername field in auth store
affects: [notifications, settings, auth]

tech-stack:
  added: []
  patterns: [per-type notification filtering via enabled map, Promise.allSettled for parallel fetcher isolation]

key-files:
  created: []
  modified:
    - taskflow/src/services/notifications.ts
    - taskflow/src/stores/notifications.store.ts
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/stores/auth.store.ts
    - taskflow/src/hooks/useNotificationPolling.ts
    - taskflow/src/routes/notifications/NotificationRow.tsx
    - taskflow/src/routes/settings/NotificationSettingsSection.tsx
    - taskflow/src/routes/settings/TokenSection.tsx
    - taskflow/src/routes/onboarding/GitLabStep.tsx
    - taskflow/src/services/notifications.test.ts

key-decisions:
  - "NotificationType defined as named union type in notifications.store.ts, imported elsewhere for DRY"
  - "Per-type toggles are additive to existing source-level OS notification toggles (both must pass)"
  - "Cursor advances on allItems even when filtered items are empty, preventing refetch loops"
  - "gitlabUsername stored in auth store and wired through onboarding + settings connection flows"

requirements-completed: [QUICK-S5U]

duration: 9min
completed: 2026-03-16
---

# Quick Task 260316-s5u: Add Comment Mentions and Expand Notifications Summary

**6 new notification types with per-type filtering, color-coded badges, and grouped settings UI for Jira and GitLab notifications**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-16T19:26:46Z
- **Completed:** 2026-03-16T19:36:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Added 6 new notification types: GitLab @mentions, Jira all-comments, MR approvals, pipeline failures, issue assignments, due date reminders
- Per-type notification toggles replace coarse source-level filtering with granular control
- Settings UI groups 9 per-type toggles by source (Jira / GitLab / Desktop)
- Color-coded notification badges: red for pipeline failures, green for approvals, amber for due dates, blue for assignments
- All new fetchers use Promise.allSettled for failure isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand notification types, add new fetchers** - `f423319` (feat)
2. **Task 2: Per-type settings toggles and polling hook integration** - `063392a` (feat)
3. **Task 3: Update NotificationRow labels and verify full build** - `c66ce09` (feat)

## Files Created/Modified
- `taskflow/src/services/notifications.ts` - 6 new fetchers (all-comments, due-date, approvals, pipelines, assignment detection, @mention detection)
- `taskflow/src/stores/notifications.store.ts` - NotificationType union type with 9 variants
- `taskflow/src/stores/settings.store.ts` - 9 per-type boolean toggles with v2-to-v3 migration
- `taskflow/src/stores/auth.store.ts` - gitlabUsername field and setter
- `taskflow/src/hooks/useNotificationPolling.ts` - Per-type filtering via enabled map, gitlabUsername wiring
- `taskflow/src/routes/notifications/NotificationRow.tsx` - Lookup-based label map with color-coded badges
- `taskflow/src/routes/settings/NotificationSettingsSection.tsx` - Full rebuild with grouped per-type toggles
- `taskflow/src/routes/settings/TokenSection.tsx` - Wire setGitlabUsername in GitLab connection mutations
- `taskflow/src/routes/onboarding/GitLabStep.tsx` - Wire setGitlabUsername in onboarding flow
- `taskflow/src/services/notifications.test.ts` - Updated mocks for new query count, added gitlabUsername param

## Decisions Made
- NotificationType defined as named union in notifications.store.ts and imported elsewhere (DRY)
- Per-type toggles are additive: both source-level OS toggle AND per-type toggle must be enabled for OS dispatch
- Cursor advances even when all fetched items are filtered out, preventing refetch loops
- gitlabUsername stored in auth store (persisted) alongside gitlabUserId

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated test mocks for expanded query count**
- **Found during:** Task 1
- **Issue:** Tests only mocked 2 Jira fetch calls but new all-comments and due-date queries add 2 more
- **Fix:** Added empty response mocks for Query C (all-comments) and Query D (due-date) in all Jira test cases
- **Files modified:** taskflow/src/services/notifications.test.ts
- **Committed in:** f423319

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary to keep existing tests passing. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

---
*Quick task: 260316-s5u*
*Completed: 2026-03-16*
