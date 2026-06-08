---
status: closed
trigger: "On standup notes page, When I set another person to look at it never matches git account for them"
created: 2026-06-08
updated: 2026-06-08
---

## Symptoms

- **Expected:** When selecting another person via the dropdown/picker on the standup notes page, their commits/work should appear
- **Actual:** Shows empty / no commits for the selected person
- **Errors:** No visible errors in UI or console
- **Timeline:** Unsure whether it ever worked
- **Reproduction:** Use the dropdown/picker on the standup notes page to select a team member — their data never loads

## Current Focus

```yaml
hypothesis: "For a watched person, commit matching uses only Jira displayName === git author_name (strict equality). No GitLab user lookup is performed to resolve their actual gitlabUsername, gitlabEmail, or gitlabUserId. The mismatch between Jira displayName and git author_name means commits never match."
test: "Trace fetchUserCommits call for watched person: authorUsername='' (filtered out), authorName=watchedUser.displayName, authorEmail=null. Only identity vector: exact case-insensitive author_name equality against Jira displayName."
expecting: "Fix: add fetchGitLabUsers search endpoint, then in StandupNotesPage resolve the watched person's full GitLab identity (id, username, name, email) via a react-query lookup keyed on the displayName, and pass it through effectiveIdentity — enabling all three match vectors + MR events."
next_action: "implement fix"
reasoning_checkpoint: "effectiveIdentity.ts deliberately nulls gitlabUserId/Username/Email for watched persons (Pitfall 3 guard). But it sets gitlabName=displayName for best-effort commit matching. The mismatch between Jira displayName and git config user.name is the systematic failure point. The fix is a GitLab user search query that resolves the watched person's full GitLab identity before running the commits/MR queries."
tdd_checkpoint: ""
```

## Evidence

- timestamp: 2026-06-08T00:00:00Z
  file: taskflow/src/routes/standup-notes/effectiveIdentity.ts
  finding: >
    For a watched person, resolveEffectiveIdentity sets gitlabName=watchedUser.displayName
    and forces gitlabUserId/gitlabUsername/gitlabEmail to null. This is the intentional
    Pitfall 3 guard — correct. But the only commit-matching vector is now displayName.

- timestamp: 2026-06-08T00:00:00Z
  file: taskflow/src/routes/standup-notes/StandupNotesPage.tsx (lines 296-329)
  finding: >
    commitsQuery calls fetchUserCommits(…, id.gitlabUsername ?? '', id.gitlabName, id.gitlabEmail).
    For a watched person: authorUsername='', authorName=displayName, authorEmail=null.
    enabled fires when id.gitlabName is truthy — the query does run.

- timestamp: 2026-06-08T00:00:00Z
  file: taskflow/src/services/gitlab.ts (lines 1258-1274)
  finding: >
    identities = [authorName, authorUsername].filter(!!v && v.trim().length>0).
    For watched person: identities = [displayName_lowercased] only.
    Match condition: name === id (strict equality). This fails whenever the person's
    git config user.name differs from their Jira displayName (extremely common).
    No email fallback exists since authorEmail is null.

- timestamp: 2026-06-08T00:00:00Z
  file: taskflow/src/services/gitlab.ts (exported functions)
  finding: >
    No fetchGitLabUsers / user-search function exists. GitLab exposes
    GET /api/v4/users?search=<query> which returns id, name, username, email.
    Adding this function and a react-query lookup in StandupNotesPage would resolve
    the watched person's full GitLab identity for robust commit + MR matching.

- timestamp: 2026-06-08T00:00:00Z
  file: taskflow/src/routes/standup-notes/StandupNotesPage.tsx (lines 332-343)
  finding: >
    mrEventsQuery is disabled for a watched person because id.gitlabUserId is null.
    This is correct per Pitfall 3 — but if a GitLab user lookup resolves their
    numeric id, MR events could also be enabled.

## Eliminated Hypotheses

- Query does not fire for watched person: ELIMINATED — enabled condition `!!id.gitlabName` fires when displayName is set.
- Empty string authorUsername causes all commits to match: ELIMINATED — empty string filtered out by `!!v && v.trim().length > 0`.
- Cache collision with logged-in user's data: ELIMINATED — queryKey includes `id.gitlabUsername ?? ''` and `id.gitlabName ?? ''` so watched-person key is distinct.

## Resolution

```yaml
root_cause: "Commit matching for a watched person uses only Jira displayName === git author_name (strict case-insensitive equality) because no GitLab user lookup exists to resolve their actual gitlabUsername, gitlabEmail, or gitlabUserId. The Jira displayName almost never matches git config user.name exactly, so commits never appear."
fix: >
  1. Add fetchGitLabUsers(baseUrl, token, searchQuery) to gitlab.ts using GET /api/v4/users?search= returning GitLabUser[].
  2. In StandupNotesPage, add a react-query lookup keyed on [gitlabBaseUrl, 'gitlab-user-search', id.jiraUserDisplayName] that fires only when isWatched=true and displayName is set.
  3. Resolve the first matching GitLab user (name similarity check) into watchedGitlabId/Username/Name/Email state.
  4. Update resolveEffectiveIdentity (or extend StandupNotesPage's id memo) to use the resolved GitLab identity for the watched person instead of null — while keeping the Pitfall 3 guard: never inherit auth.gitlabUserId when the lookup finds no match.
  5. Pass the resolved identity to fetchUserCommits (all three vectors) and enable mrEventsQuery when gitlabUserId is resolved.
verification: "Select a watched person — their commits and MR events should appear using their actual GitLab identity."
files_changed: "taskflow/src/services/gitlab.ts, taskflow/src/routes/standup-notes/StandupNotesPage.tsx, taskflow/src/routes/standup-notes/effectiveIdentity.ts (possibly)"
```
