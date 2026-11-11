---
phase: quick-261111-e1w
plan: 01
subsystem: notifications
tags: [notifications, ui-polish, avatars, status-pill]
requires: [Phase 95 notification cards]
provides: [status pill min width, NotificationItem.personAvatars, PersonValue]
affects: [taskflow/src/routes/notifications/NotificationRow.tsx, taskflow/src/services/notifications.ts, taskflow/src/stores/notifications.store.ts]
tech-stack:
  added: []
  patterns: [React context for per-card avatar lookup, fetch-time avatar capture filtered to names in body]
key-files:
  created: []
  modified:
    - taskflow/src/routes/notifications/NotificationRow.tsx
    - taskflow/src/routes/notifications/NotificationRow.test.tsx
    - taskflow/src/stores/notifications.store.ts
    - taskflow/src/services/notifications.ts
    - taskflow/src/services/notifications.test.ts
decisions:
  - "Status pills: min-w-[5rem] justify-center text-center added only in StatusPill (CHIP_CLASS unchanged)"
  - "Person avatars captured at fetch time (personAvatars map, filtered to names in body); initials fallback otherwise; no /secure/useravatar"
  - "Person avatar wrapper is aria-hidden so screen readers don't hear the name twice"
metrics:
  completed: 2026-11-11
  tasks: 3
  files: 5
---

# Quick 261111-e1w: Notification polish (status pill width, person avatars) Summary

Notification status pills share a 5rem min width with centred text. Assignee, reporter and reviewer values now show a 16px CachedAvatar before each name. The avatar uses the real image when the URL was captured at fetch time (Jira issue fields and changelog authors, GitLab MR people and note author) and falls back to initials otherwise.

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | Status pills get a consistent minimum width (rule F) | b7198202 |
| 2 | Capture person avatar URLs at fetch time (`personAvatars`, `pickPersonAvatars`) | 46b98754 |
| 3 | PersonValue renders an avatar before person names (rule C, PersonAvatarsContext) | 134d5c1e |

## Deviations from Plan

1. **[Rule 3 - Blocking] GitLabMR has no `assignee` field.** The plan said `GitLabMR` declares `assignee | null`, but it only declares `author` and `reviewers`. `mrPeopleAvatars` reads `assignee` / `assignees` through a local type widening (`GitLabMR & { assignee?; assignees? }`), so the shared type stays the same. The GitLab list endpoint returns both fields. Commit 46b98754.
2. **[Rule 2 - a11y] Avatar wrapped in `aria-hidden` span.** CachedAvatar's fallback is `role="img" aria-label={name}`, so screen readers would read every name twice. PersonValue wraps the avatar in `<span aria-hidden="true" class="mr-1 inline-block align-middle">`. Commit 134d5c1e.
3. **TextValue also handles sign-stripped person text.** In single-change mode, `changesParts` strips the `−` sign, so line 2 receives `alice` and not `−alice`. TextValue now sends any person-field text other than `removed` / `edited` through PersonValue and renders the sign only when one is present.
4. **Test assertions.** Three existing assertions compared exact textContent, which now includes the avatar initials: the GitLab system-note cases, the multi-change rows and "assigned Ben Carter". They now use a `textOf()` helper that ignores `[data-person] [aria-hidden]`. Each assertion still checks the same thing.
5. **Jira avatar candidates include in-window history authors** collected before the self-author skip (the plan says "every in-window history.author"). This has no effect on what is shown, because the map only keeps names that appear in the body.

## Verification

- `npx vitest run src/routes/notifications src/services/notifications.test.ts`: 210 passed
- biome check on the 5 touched files: clean. `tsc --noEmit`: clean.
- The pre-commit full suite passed on every commit (4713 passed).

## Known Stubs

None.

## Self-Check: PASSED

- Commits b7198202, 46b98754, 134d5c1e are present on branch worktree-agent-a0daf32d2a1fdc2fc.
- All 5 modified files exist.
