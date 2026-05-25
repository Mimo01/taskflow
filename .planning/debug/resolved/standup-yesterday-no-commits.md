---
name: standup-yesterday-no-commits
description: Standup Notes Yesterday column shows tasks/MRs but no GitLab commits, even when commits were made yesterday
status: resolved
trigger: "In standup notes page, in yesterday column I don't see any commits from yesterday. I definitely did make comits yesterday"
created: 2026-05-26
updated: 2026-05-26
---

## Resolution

- root_cause: `fetchUserCommits` filtered commits by the GitLab LOGIN username
  (`gitlabUsername`) against git `author_name`/`author_email`. The login (e.g. "mmozolak")
  matches neither the display name "Milan Mozolak" nor the email "milan.mozolak@isdd.sk",
  so every commit was dropped client-side. MRs survived because they filter by numeric
  `gitlabUserId`.
- secondary: commits since/until window was a fixed UTC day built from a LOCAL `date`,
  shifting the window for non-UTC users and dropping edge-of-day commits.
- fix:
  - Store GitLab display name as `gitlabName` (auth store) — set from `user.name` in
    TokenSection + GitLabStep; one-time self-heal backfill on StandupNotesPage for
    users who connected before the field existed.
  - `fetchUserCommits` now takes an optional `authorName` and matches commits against
    BOTH display name and login (name-equals or email-contains, empty identities skipped).
  - since/until now cover the user's LOCAL day converted to UTC.
  - EXPANSION (follow-up): also store `gitlabEmail` (from `user.email`) and match by
    email "name" — the local part before @, domain-ignored, trailing digits stripped
    (`emailLocalName`). So john.doe@example.com matches john.doe@company.com and
    john.doe1@example.com (both directions). All-digit/empty locals never match.
  - COVERAGE (follow-up): `fetchUserCommits` now (a) paginates the whole day window
    (per_page=100, stop on short page, 50-page guard) — the author filter is
    client-side so the user's commits could sit past page 1; and (b) passes `all=true`
    to include every branch/tag, not just the default branch (unmerged feature-branch
    work shows up), deduping commits reachable from multiple refs by id.
- verification: `npx vitest run src/services/gitlab.test.ts src/stores/auth.store.test.ts`
  → 59 passed (incl. new display-name-match and local-day-window tests). Standup suites
  140 passed. `tsc --noEmit` clean. No new biome findings.
- files_changed: src/services/gitlab.ts, src/stores/auth.store.ts,
  src/routes/standup-notes/StandupNotesPage.tsx, src/routes/settings/TokenSection.tsx,
  src/routes/onboarding/GitLabStep.tsx, src/services/gitlab.test.ts
- note: An unrelated pre-existing date-flaky test (WorklogsPage "computes totals row as
  sum per day") failed independently of this fix. Working tree showed concurrent external
  modifications to ConnectionsSection.tsx during the session — left untouched.

# Debug: standup-yesterday-no-commits

## Symptoms

- **Expected:** Yesterday column lists GitLab commits authored yesterday.
- **Actual:** Yesterday column shows other items (tasks/MRs) but the commits are missing/empty.
- **Scope (user-confirmed):** Other items show, no commits. Not a blank column.
- **Source (user-confirmed):** Unsure — investigation shows commits come from GitLab.
- **Timeline (user-confirmed):** Unsure whether it ever worked.
- **Verification:** `git log` confirms many commits authored 2026-05-25 by "Milan Mozolak" <…> — yesterday relative to today 2026-05-26.

## Current Focus

- hypothesis: The commit author filter in `fetchUserCommits` drops ALL commits because it compares the GitLab LOGIN username against the git `author_name`/`author_email`, which do not match.
- test: Determine the actual stored `gitlabUsername` value vs. the commit `author_name`/`author_email` for yesterday's commits.
- expecting: `gitlabUsername` (a login handle) is neither equal to `author_name` ("Milan Mozolak") nor a substring of `author_email` → filter returns empty.
- next_action: Confirm the username-vs-author mismatch and decide the correct identity-match strategy for commits.
- reasoning_checkpoint: MRs filter by numeric `gitlabUserId` (reliable) and DO show; commits filter by `gitlabUsername` string (unreliable) and do NOT — strongly localizes the bug to the commit author filter.

## Evidence

- timestamp: 2026-05-26
  observation: `taskflow/src/services/gitlab.ts:1160-1164` filters commits client-side:
  `c.author_name.toLowerCase() === authorUsername.toLowerCase() || c.author_email.toLowerCase().includes(authorUsername.toLowerCase())`.
  `authorUsername` is `gitlabUsername`.
- timestamp: 2026-05-26
  observation: `gitlabUsername` is set from `user.username` (the GitLab LOGIN handle) in
  `taskflow/src/routes/settings/TokenSection.tsx:251,265` and `taskflow/src/routes/onboarding/GitLabStep.tsx:42`.
  The git `author_name` is the display name ("Milan Mozolak"). A login like "milan.mozolak"/"mmozolak"
  will not equal "Milan Mozolak" and may not be a substring of the commit email → all commits filtered out.
- timestamp: 2026-05-26
  observation: MR events query (`StandupNotesPage.tsx:223-232`) is enabled/filtered by numeric
  `gitlabUserId` via `fetchUserMREvents` — independent of the username string. This is why MRs render but commits don't.
- timestamp: 2026-05-26
  observation: SECONDARY issue — `yesterdayDate` is a LOCAL date string (`standup-date.ts` toLocalDateString),
  but `fetchUserCommits` builds a UTC window `since=${date}T00:00:00.000Z`..`${date}T23:59:59.999Z`
  (gitlab.ts:1128-1130). For a UTC+2 user this shifts the window ~2h, dropping early-local-day commits.
  This would cause PARTIAL loss, not total — so it is not the primary cause of "no commits at all",
  but worth fixing alongside.

## Eliminated

- hypothesis: Query disabled because a required field is missing.
  reason: MRs (which share gitlabBaseUrl + token) render, so connection/token/project are present.
  Commits query additionally requires `gitlabUsername`; if that were null the query would be disabled
  (no error, just empty) — still consistent, but the author-filter mismatch is the more complete explanation
  since the user has a configured username. The session manager should confirm `gitlabUsername` is non-null.

## Candidate Fix Direction (for session manager to confirm with user)

- The reliable identity for commits is the GitLab user's display **name** and/or email, not the login.
  `validateGitLab` returns the full `GitLabUser` (has `name`). Options:
  1. Also store/compare the user's display `name` (matches git `author_name` "Milan Mozolak").
  2. Compare against author email more robustly (store user's committer email).
  3. Relax the filter (e.g. match on name OR email OR username).
- Also fix the UTC-window vs local-date mismatch in `fetchUserCommits` so the since/until window
  covers the user's LOCAL day (matching how `yesterdayDate` is computed).
