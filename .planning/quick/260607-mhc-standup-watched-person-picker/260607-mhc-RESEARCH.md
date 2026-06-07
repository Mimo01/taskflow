# Quick Task 260607-mhc: Standup watched-person picker — Research

**Researched:** 2026-06-07
**Domain:** React identity threading + Jira user search + react-query cache keying (taskflow standup-notes)
**Confidence:** HIGH (all findings verified against current source)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Picker placement:** Standup page header, right side (`StandupPageHeader.tsx`), near Refresh / Copy. Affordance is a subtle ghost dropdown like `Showing: <name> ▼`, defaults to the logged-in user. Mirrors the date-picker affordance style.
- **Git/GitLab commit matching:** Best-effort by **display name**. Feed the watched person's Jira `displayName` in place of `gitlabName` to the *existing* `fetchUserCommits` fuzzy matcher. No match ⇒ empty sections (accepted, not an error). Do NOT add a new GitLab account-resolution step as the primary path.
- **Persistence:** Reset to me each load. Selection is transient in-memory/per-page React state only. No persisted auth/settings field.
- **GitLab-ID-dependent sections (MRs awaiting review, participated MRs):** Best-effort, empty if unmatched. **Critical guard:** when a watched person is selected, these MUST NOT silently fall back to the logged-in user's `gitlabUserId`.

### Claude's Discretion
- State-management shape: local React state in `StandupNotesPage` vs a small context — choose the least invasive thread.
- "Not matched" hint copy/styling — consistent with muted-text patterns.
- Whether the picker shows recent/assignable/searchable Jira users — use `services/jira/users.ts#fetchAssignableUsers`.

### Deferred Ideas (OUT OF SCOPE)
- New GitLab account-resolution lookup as primary path. No persisted watched-person setting.
</user_constraints>

## Summary

The standup page derives identity entirely from `useAuthStore()`, read in **two** places: `StandupNotesPage.tsx` (owns 4 yesterday queries + the schedule query) and `TodayColumn.tsx` (owns 3 today queries internally). The cleanest minimal change is to introduce an **"effective identity" object** in `StandupNotesPage` — defaulting to the auth-store fields, overridable by a picker — and thread the relevant subset into both the local queries and `TodayColumn` (currently `TodayColumn` reads the auth store itself; it must instead accept identity via props).

A watched `JiraAssignableUser` only carries `{ displayName, name, key?, avatarUrls? }`. That maps cleanly onto the name-driven queries (`jiraUsername`→`name`, `jiraUserKey`→`key`, displayName→sprint filter + commit matching). It does **not** carry `gitlabUserId` / `gitlabEmail` / `gitlabUsername` — so the MR-events / reviewer-MRs / participating-MRs queries (all keyed on `gitlabUserId`) must be **disabled** (rendered empty with a "not matched" hint) for any watched person ≠ me.

The picker is a solved problem: copy `MentionPopover.tsx`'s pattern (200 ms debounce → debounced term in the react-query key → `fetchAssignableUsers` does server-side `&username=` filtering). This sidesteps the recurring fetch-once/page-cap bug. `fetchAssignableUsers` needs a `projectKey`; the standup page already has `activeJiraProject` in the auth store (used by the sprint and jira-activity queries), so it's available.

**Primary recommendation:** Lift an `effectiveIdentity` object into `StandupNotesPage` local state (default = auth store, override = picker). Pass `gitlabUserId` as `null` when a watched person is selected so the MR queries' `enabled` guards turn them off — no fallback. Thread identity into `TodayColumn` via new props (it currently self-sources from the auth store).

## Architectural Responsibility Map

| Capability | Primary Tier | Rationale |
|------------|-------------|-----------|
| Watched-person selection state | Client (StandupNotesPage React state) | Transient, per-page, reset on load — locked decision |
| Jira user search | API (Jira `/user/assignable/search`) | Server-side `&username=` filtering via existing service |
| Identity → query keys | Client (react-query) | Cache must vary by watched identity to refetch on switch |
| Commit name matching | API + client filter (`fetchUserCommits`) | Existing fuzzy matcher; feed displayName as authorName |

## Standard Stack

No new packages. All primitives already in the codebase:

| Tool | Version | Role |
|------|---------|------|
| `@tanstack/react-query` | ^5.90.21 [VERIFIED: package.json] | Query keying / refetch on identity switch |
| `react` | ^19.1.0 [VERIFIED: package.json] | Local state for effective identity |
| `services/jira/users.ts#fetchAssignableUsers` | existing [VERIFIED: source] | Picker data source (server-side filtered) |
| `services/gitlab.ts#fetchUserCommits` | existing [VERIFIED: source] | Name/email fuzzy commit match — reused as-is |
| `components/ui/dropdown-menu` / popover + `CachedAvatar` | existing [VERIFIED: source] | Subtle picker UI; avatar rendering |

No external packages installed ⇒ Package Legitimacy Audit not applicable.

## Architecture Patterns

### Effective-identity flow
```
StandupNotesPage
  useAuthStore() ──► defaultIdentity  (me)
  picker selection ─► watchedUser: JiraAssignableUser | null   (local state, reset on mount)
        │
        ▼
  effectiveIdentity = watchedUser
      ? { jiraUsername: watchedUser.name,
          jiraUserKey:  watchedUser.key ?? null,
          jiraUserDisplayName: watchedUser.displayName,
          gitlabUserId:   null,   // ← guard: no fallback to me
          gitlabUsername: null,
          gitlabName:     watchedUser.displayName,  // feed displayName to commit matcher
          gitlabEmail:    null }
      : { ...authStore fields }      (me — unchanged behavior)
        │
        ├─► yesterday queries (StandupNotesPage): tempo, jira-activity, commits, mr-events
        └─► TodayColumn (NEW props): sprint filter name, gitlabUserId for reviewer/participating MRs
```

### Field-by-field mapping (the load-bearing table)

| Query (location) | Needs | From me | From watched `JiraAssignableUser` | When watched & unmatched |
|------------------|-------|---------|-----------------------------------|--------------------------|
| schedule (Page) | `jiraUserKey` | `jiraUserKey` | `key` (may be undefined) | tempo schedule may be empty — fine |
| tempo worklogs (Page) | `jiraUsername` | `jiraUsername` | `name` | resolves by name |
| jira-activity (Page) | `jiraUsername` | `jiraUsername` | `name` | resolves by name |
| commits (Page) | `gitlabUsername`, `gitlabName`, `gitlabEmail` | all three | only `gitlabName` = displayName; username/email `null` | best-effort name match; empty if no match |
| mr-events (Page) | **`gitlabUserId`** | `gitlabUserId` | **none → `null`** | query disabled → empty + hint |
| reviewer-MRs (TodayColumn) | **`gitlabUserId`** | `gitlabUserId` | **none → `null`** | query disabled → empty + hint |
| participating-MRs (TodayColumn) | **`gitlabUserId`** | `gitlabUserId` | **none → `null`** | query disabled → empty + hint |
| sprint filter (TodayColumn) | `jiraUserDisplayName` | `jiraUserDisplayName` | `displayName` | resolves by display name |

**Confirmed:** all three GitLab-ID sections already gate on `enabled: ... && !!gitlabUserId`. Passing `gitlabUserId = null` for a watched person turns them off automatically — the empty-render path already exists. The "not matched" hint is the only net-new UI.

### Picker component (reuse MentionPopover pattern)
- 200 ms debounce of the typed query → put `debouncedQuery` in the react-query key:
  `['standup', 'watched-user-search', jiraBaseUrl, activeJiraProject, debouncedQuery]`.
- `queryFn` calls `fetchAssignableUsers(jiraBaseUrl, token, activeJiraProject, debouncedQuery)`; token read via `readSecret('jira-pat')` inside the queryFn (T-62-06 rule: never in key).
- Render rows with `CachedAvatar` + displayName; selecting sets `watchedUser`; selecting "me"/clearing resets to `null`.
- Trigger styled subtle (`Showing: <name> ▼`) like the `DropdownMenu` date picker in `YesterdayColumn.tsx` (lines 627-645).

### Anti-patterns to avoid
- **Don't** fetch one page of users and filter client-side — see Pitfall 2.
- **Don't** put `gitlabUserId ?? authStore.gitlabUserId` anywhere — that is the exact silent-fallback the decision forbids. Use `null` and let `enabled` gate it off.
- **Don't** persist `watchedUser` to a store/localStorage — reset-on-load is locked.

## Don't Hand-Roll

| Problem | Use instead | Why |
|---------|-------------|-----|
| Jira user typeahead | `fetchAssignableUsers` + MentionPopover debounce pattern | Server-side `&username=` filtering avoids page-cap bug |
| Commit author matching for watched person | existing `fetchUserCommits(authorName=displayName)` | Already does name/email fuzzy match (gitlab.ts:1258-1274) |
| Avatar rendering | `CachedAvatar` (already used in MentionPopover) | Handles Jira avatar URL caching |

## Common Pitfalls

### Pitfall 1: queryKey must include the watched identity or switching person won't refetch
**What goes wrong:** react-query caches per key. If identity fields aren't in the key, selecting a different person serves the previous person's cached data.
**How to avoid:** The current keys already embed identity (`jiraUsername`, `gitlabUserId`, `gitlabName`/`gitlabEmail`, `jiraUserKey`). As long as the **effective** identity feeds those exact key positions, switching person changes the key and triggers a fresh fetch automatically. Verify `TodayColumn`'s three keys (`sprint-board-today-full` uses `activeJiraProject`+`storyPointsFieldKey` only — sprint filtering is client-side on `jiraUserDisplayName`, so the sprint *query* key need not change, but the filter input must; reviewer/participating keys already carry `gitlabUserId`).

### Pitfall 2: fetch-once page-cap (recurring taskflow bug class)
**What goes wrong:** Pickers that fetch a single capped page and filter client-side hide anyone past page 1. [VERIFIED: memory project_fetch_once_pagecap_pitfall]
**How to avoid:** Pass the typed term to `fetchAssignableUsers` as the `&username=` server filter (the MentionPopover pattern). Never `.filter()` the returned page client-side.

### Pitfall 3: silent fallback to my gitlabUserId
**What goes wrong:** `gitlabUserId ?? gitlabUserIdOfMe` would show MY merge requests under someone else's name — a correctness bug the decision explicitly guards against.
**How to avoid:** Set `gitlabUserId = null` for any watched person; rely on the existing `enabled: !!gitlabUserId` guards to render the sections empty. Add the subtle "not matched" hint.

### Pitfall 4: TodayColumn self-sources identity
**What goes wrong:** `TodayColumn` reads `useAuthStore()` directly (gitlabUserId, jiraUserDisplayName), so the picker in the page header wouldn't affect the Today column unless wired.
**How to avoid:** Add props to `TodayColumn` for the effective `gitlabUserId` and `jiraUserDisplayName`, passed down from `StandupNotesPage`. Keep auth store as the default value the page computes.

### Pitfall 5: Copy-markdown reads from cache by `todayQueryKeys`
**What goes wrong:** `handleCopyMarkdown` in StandupNotesPage rebuilds today's markdown by reading the cache via `todayQueryKeys.reviewerMrs(gitlabBaseUrl, gitlabUserId)` using the **auth-store** `gitlabUserId`. For a watched person those cache entries won't exist (queries disabled), so it correctly yields empty MR sections — but pass the **effective** `gitlabUserId` (null) to these key factories so the lookup is consistent, and feed the watched `jiraUserDisplayName` into `generateTodayMarkdown`.

## Runtime State Inventory

Not a rename/migration phase — no stored data, service config, OS state, secrets, or build artifacts to migrate. Watched-person state is transient React state only (locked decision). **None — verified by task scope.**

## Environment Availability

No new external dependencies — purely in-app React/react-query/existing-service changes. Jira `/rest/api/2/user/assignable/search` is already in production use (MentionPopover, WorklogsPage). SKIPPED (no new external dependencies).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (config under taskflow/, `.vite/vitest` cache present) |
| Quick run command | `cd taskflow && npx vitest run <path>` |
| Lint/type gate | `cd taskflow && npm run check` (biome + tsc — baseline GREEN per project memory) |

### Requirements → Test Map
| Behavior | Test type | Note |
|----------|-----------|------|
| effectiveIdentity maps watched user → query fields, gitlabUserId=null | unit | pure mapping fn — extract to testable helper |
| Switching person changes query keys (refetch) | unit/integration | assert key includes watched name/key |
| MR sections disabled + hint when watched & no gitlabUserId | component | render guard |
| Picker uses server-side `&username=` (no client page-cap filter) | code review + unit on queryFn | guard against Pitfall 2 |

### Wave 0 Gaps
- Extract the identity-mapping logic into a pure function so it is unit-testable (recommended — avoids testing through react-query).

## Security Domain

No new auth/crypto/storage surface. Reuses existing token handling (`readSecret('jira-pat')`/`'gitlab-pat'`) — tokens stay inside queryFn closures, never in query keys (T-62-06 standing rule). V5 input validation: the typed search term is passed through `encodeURIComponent` inside `fetchAssignableUsers` already [VERIFIED: users.ts:26]. No elevated risk.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `activeJiraProject` is reliably populated on the standup page (used as `projectKey` for user search) | Picker | If null, user search returns [] — picker shows no results. Mitigate: gate picker `enabled` on `activeJiraProject`, same as sprint query. Low risk — sprint/jira-activity queries already depend on it. |
| A2 | A watched person's `JiraAssignableUser.key` may be undefined; the tempo *schedule* query (keyed on jiraUserKey) then yields empty | Field mapping | Schedule drives yesterdayDate holiday-skip; empty schedule just falls back to plain yesterday — acceptable for a peek. |

## Sources

### Primary (HIGH confidence — current source)
- `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` — query ownership, keys, copy-markdown
- `taskflow/src/routes/standup-notes/TodayColumn.tsx` — self-sourced identity, 3 internal queries, `todayQueryKeys`
- `taskflow/src/routes/standup-notes/StandupPageHeader.tsx` — header layout for picker placement
- `taskflow/src/services/jira/users.ts` — `fetchAssignableUsers` (server-side `&username=`)
- `taskflow/src/services/jira/types.ts` — `JiraAssignableUser { displayName, name, key?, avatarUrls? }`
- `taskflow/src/services/gitlab.ts:1198-1287` — `fetchUserCommits` name/email matching + `emailLocalName`
- `taskflow/src/routes/dashboard/MentionPopover.tsx` — debounce → key → server-filter picker pattern
- `taskflow/src/components/jira/BoardPicker.tsx`, `YesterdayColumn.tsx:627-645` — subtle dropdown affordances
- `taskflow/src/stores/auth.store.ts` — identity field set

### Secondary (memory)
- `project_fetch_once_pagecap_pitfall.md` — recurring page-cap bug class

## Metadata
- Standard stack: HIGH (no new packages; all verified in source)
- Architecture: HIGH (query ownership and key shapes read directly)
- Pitfalls: HIGH (fetch-once verified against memory + source; fallback guard verified against `enabled` clauses)
- Research date: 2026-06-07 · Valid until: ~2026-07-07 (stable in-repo patterns)
