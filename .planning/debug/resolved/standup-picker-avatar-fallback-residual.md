---
slug: standup-picker-avatar-fallback-residual
status: resolved
trigger: "On standup notes page, in the new person picker, for my avatar I don't get my jira avatar but the fallback letters. Everywhere else in the app it shows correctly. Last debug session didnt fix it"
created: 2026-06-07
updated: 2026-06-07
---

# Debug: standup-picker-avatar-fallback-residual

Follow-up to resolved/standup-picker-avatar-fallback.md — that fix added all the
avatarUrl plumbing but the symptom persists for existing sessions.

## Symptoms

- **Expected:** Current user's Jira avatar image renders in the "Me" row of the standup watched-person picker.
- **Actual:** Still shows initials fallback for the current user.
- **Timeline:** Persists after the prior fix (avatarUrls plumbing through auth store → StandupNotesPage → StandupPageHeader → WatchedPersonPicker).
- **Scope:** Only the current user's own avatar in this picker. Other people's avatars (search results) render fine; the current user's own avatar is shown nowhere else in the app.

## Current Focus

- hypothesis: CONFIRMED — the prior fix only populates `jiraUserAvatarUrl` on a *fresh* login/connect. For an already-authenticated session the identity-backfill effect in useNotificationPolling.ts short-circuits, so the new avatar field is never backfilled and stays null → "Me" row gets url={null}.
- next_action: apply guard fix
- reasoning_checkpoint: setJiraUser(avatar) is called from 3 sites — TokenSection (connect), JiraStep (onboarding), and the bootstrap effect in useNotificationPolling. The first two only fire on fresh auth. The bootstrap effect (line 103-111) is the only path that runs for an existing logged-in user on app start, BUT its guard `if (jiraUsername && jiraUserDisplayName && jiraUserKey) return` is satisfied for existing users (those 3 were persisted before the avatar field existed), so it returns early and never calls setJiraUser. Result: jiraUserAvatarUrl persists as null.

## Evidence

- timestamp: 2026-06-07T15:30:00Z
  file: taskflow/src/hooks/useNotificationPolling.ts:104
  finding: guard `if (!jiraBaseUrl || (jiraUsername && jiraUserDisplayName && jiraUserKey)) return` does NOT include jiraUserAvatarUrl — so existing sessions (with the 3 identity fields already present) skip the backfill that would set the avatar
- timestamp: 2026-06-07T15:30:00Z
  file: taskflow/src/hooks/useNotificationPolling.ts:111
  finding: dependency array omits jiraUserAvatarUrl, so the effect won't re-run when only the avatar is missing
- timestamp: 2026-06-07T15:30:00Z
  file: taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx:109
  finding: "Me" row renders CachedAvatar url={meAvatarUrl}; meAvatarUrl traces back to auth store jiraUserAvatarUrl which is null at runtime for existing sessions
- timestamp: 2026-06-07T15:30:00Z
  file: taskflow/src/ (grep)
  finding: the current user's own avatar from auth store is rendered ONLY in this picker — confirming why "everywhere else" looks fine (those are other users' API-sourced avatars)

## Eliminated

- CachedAvatar / useAvatarCache bug: search-result avatars in the same picker render fine via identical code path
- Missing plumbing: prior fix correctly threaded meAvatarUrl all the way through; the value is simply null

## Resolution

- root_cause: The identity backfill effect in useNotificationPolling only re-fetches /myself when one of displayName/username/key is missing. Existing users already have those persisted, so after the prior fix added jiraUserAvatarUrl the backfill never runs for them and the avatar URL is never populated — only a full disconnect/reconnect would set it.
- fix: Added jiraUserAvatarUrl to the bootstrap-effect guard condition and dependency array (and destructured it from the auth store) in useNotificationPolling.ts. The effect now re-fetches /myself and calls setJiraUser when the avatar is missing, backfilling existing sessions that authenticated before the avatar field existed — no re-login required.
- verification: `npm run check` (biome + tsc) GREEN. On next app start the effect runs once (avatarUrl null → guard fails → validateJira → setJiraUser stores avatar), populating jiraUserAvatarUrl so the "Me" row renders the image.
- files_changed:
  - taskflow/src/hooks/useNotificationPolling.ts
