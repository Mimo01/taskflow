---
phase: 46-avatar-caching
plan: "02"
subsystem: ui-components
tags: [avatar, caching, refactor, wave-2]
dependency_graph:
  requires: ["46-01"]
  provides: ["all-avatar-sites-use-CachedAvatar", "avatar-cache-initialized-on-startup"]
  affects: ["TaskCard", "BacklogRow", "EpicsPage", "IssueDetailContent", "MergeRequestListPage", "MergeRequestDetailPage", "ReleaseDetailPage", "MentionPopover", "WorklogEntry", "MergeRequestsSection", "NotificationRow", "main.tsx"]
tech_stack:
  added: []
  patterns: ["CachedAvatar drop-in replacement", "Promise.all for parallel startup init"]
key_files:
  created: []
  modified:
    - taskflow/src/main.tsx
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx
    - taskflow/src/routes/dashboard/EpicsPage.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/MergeRequestListPage.tsx
    - taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/routes/dashboard/MentionPopover.tsx
    - taskflow/src/routes/dashboard/issue-detail/WorklogEntry.tsx
    - taskflow/src/routes/dashboard/issue-detail/MergeRequestsSection.tsx
    - taskflow/src/routes/notifications/NotificationRow.tsx
    - taskflow/src/routes/notifications/NotificationRow.test.tsx
decisions:
  - "Updated NotificationRow test to use role='img' accessibility query instead of querySelector('img') — CachedAvatar renders div with role=img while blob URL loads in test environment"
  - "Used avatarUrls['48x48'] in MentionPopover (was using 24x24/16x16) — cache keyed on 48x48 to maximize hit rate with Jira popover data"
metrics:
  duration_seconds: 367
  completed_date: "2026-03-30"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 13
requirements-completed: [CACH-01, CACH-02]
---

# Phase 46 Plan 02: Avatar Integration Summary

Wire all 11 avatar usage sites to CachedAvatar and initialize the blob URL cache from disk before first React render — eliminating all inline `<img>` + `onError` DOM manipulation patterns.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Initialize avatar cache on app startup | 5ddbc2f | main.tsx |
| 2 | Replace all inline avatar patterns with CachedAvatar | 2059dcc | 11 route files + 1 test file |

## What Was Built

**Task 1 — main.tsx startup change:**
- Added `import { initAvatarCache } from './services/avatarCache'`
- Replaced `loadTheme().then(...)` with `Promise.all([loadTheme(), initAvatarCache().catch(() => {})])` so disk cache hydrates in parallel with theme loading
- `catch(() => {})` makes cache failure non-fatal — app launches and fetches avatars fresh on first use

**Task 2 — 11 avatar sites migrated:**

| File | Pattern replaced | Size |
|------|-----------------|------|
| TaskCard.tsx | `<img>` + `onError` + initials `<div>` + local `getInitials` | 20px |
| BacklogRow.tsx | `<img>` + `<span>?</span>` fallback | 24px |
| EpicsPage.tsx | `<img>` + `onError` + initials div + local `getInitials` | 24px |
| IssueDetailContent.tsx (2 sites) | `<img>` + `onError` + initials div + local `getInitials` | 20px |
| MergeRequestListPage.tsx | `<img>` plain | 20px |
| MergeRequestDetailPage.tsx | PersonDisplay `<img>` or muted div | 20px |
| ReleaseDetailPage.tsx (2 sites) | Jira assignee + GitLab author `<img>` | 20px |
| MentionPopover.tsx | `<img>` or `<span>` initials | 20px |
| WorklogEntry.tsx | `<img>` or `<span>` initials | 20px |
| MergeRequestsSection.tsx | `<img>` plain | 20px |
| NotificationRow.tsx | `<img>` + `onError` + `<span>` initials fallback | 32px |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated NotificationRow test for CachedAvatar behavior**
- **Found during:** Task 2 test run
- **Issue:** Test checked `container.querySelector('img')` to verify avatar rendering with `authorAvatarUrl`. CachedAvatar shows `role="img"` div with initials until blob URL resolves; `<img>` never renders in test environment (no Tauri fetch).
- **Fix:** Changed test assertion from `container.querySelector('img')` to `screen.getByRole('img', { name: 'Jane Smith' })` — the accessible div rendered by CachedAvatar's initials fallback.
- **Files modified:** `taskflow/src/routes/notifications/NotificationRow.test.tsx`
- **Commit:** 2059dcc

## Verification Results

- `npx tsc --noEmit`: exits 0 — no type errors
- `npm run test -- --run`: 830 passed, 0 failed
- `grep -rl 'CachedAvatar' src/routes/ src/main.tsx | wc -l`: 12 files
- `grep -rn 'onError.*currentTarget.*style.*display.*none' src/routes/ | grep -i avatar`: 0 matches
- `grep 'initAvatarCache' src/main.tsx`: present

## Known Stubs

None — all avatar sites wired to CachedAvatar; cache initialized before first render.

## Self-Check: PASSED
