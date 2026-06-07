---
slug: standup-picker-avatar-fallback
status: resolved
trigger: "On standup notes page, in the new person picker, for my avatar I don't get my jira avatar but the fallback letters. Everywhere else in the app it shows correctly"
created: 2026-06-07
updated: 2026-06-07
---

# Debug: standup-picker-avatar-fallback

## Symptoms

- **Expected:** The user's own Jira avatar image renders in the new (watched-)person picker on the standup notes page.
- **Actual:** The avatar falls back to initials/letters for the current user.
- **Error messages:** none reported
- **Timeline:** Appeared with the recently-added standup watched-person picker (commits d62dc4e4, ae20b96e, 93d54f5c).
- **Reproduction:** Open standup notes page → open the new person picker → observe the current user's own avatar shows fallback letters instead of the Jira avatar image.
- **Scope:** Avatars render correctly everywhere else in the app (only this picker is affected, and specifically the current user's avatar).

## Current Focus

- hypothesis: CONFIRMED — "Me" row in WatchedPersonPicker passed url={null} hardcoded; the current user's avatar URL was never stored in the auth store.
- next_action: DONE — fix applied
- reasoning_checkpoint: Two-layer gap: (1) WatchedPersonPicker.tsx line 106 hardcodes url={null} for the "Me" row. (2) The auth store's JiraUser type (both jira.ts and jira/types.ts) omitted avatarUrls, so even if it had been passed it would not have been stored at login time. All other avatars come from Jira API search results which always include avatarUrls — only the current user's own entry in this picker was sourced from the auth store, which lacked the field.
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-07T14:51:00Z
  file: taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx:106
  finding: "Me" row CachedAvatar called with `url={null}` — hardcoded, no meAvatarUrl prop existed
- timestamp: 2026-06-07T14:51:00Z
  file: taskflow/src/stores/auth.store.ts
  finding: JiraUser / auth store had no avatarUrls field; setJiraUser stored only displayName, username, key
- timestamp: 2026-06-07T14:51:00Z
  file: taskflow/src/services/jira.ts + jira/projects.ts
  finding: validateJira (both files) discarded data.avatarUrls in the return value

## Eliminated

- CachedAvatar bug: all other avatars (search results) render fine — CachedAvatar works correctly when given a valid URL
- Jira CORS/network issue: the myself endpoint is only called at login; the avatar data is simply not persisted

## Resolution

- root_cause: WatchedPersonPicker.tsx "Me" row called CachedAvatar with url={null}. The current user's Jira avatar URL was never fetched-and-stored: the JiraUser type (in both jira.ts and jira/types.ts) omitted avatarUrls, and the auth store's setJiraUser signature did not accept or persist it. All search-result user rows passed avatarUrls from the Jira assignable-users API, but the "Me" row had no equivalent source.
- fix: Added avatarUrls field to JiraUser in both jira.ts and jira/types.ts; updated validateJira in both files to include avatarUrls in the return value; added jiraUserAvatarUrl to the auth store with setJiraUser accepting an optional 4th parameter; updated all three setJiraUser call sites (useNotificationPolling, TokenSection, JiraStep) to pass user.avatarUrls?.['48x48']; added meAvatarUrl prop to WatchedPersonPicker and threaded it through StandupPageHeader and StandupNotesPage.
- files_changed:
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira/types.ts
  - taskflow/src/services/jira/projects.ts
  - taskflow/src/stores/auth.store.ts
  - taskflow/src/hooks/useNotificationPolling.ts
  - taskflow/src/routes/settings/TokenSection.tsx
  - taskflow/src/routes/onboarding/JiraStep.tsx
  - taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx
  - taskflow/src/routes/standup-notes/StandupPageHeader.tsx
  - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
