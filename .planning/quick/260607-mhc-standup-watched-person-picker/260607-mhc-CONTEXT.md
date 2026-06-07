# Quick Task 260607-mhc: Switch watched person on standup notes page - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Task Boundary

On the standup notes page, allow switching the "watched person" (currently hardcoded to the logged-in user). Add a subtle Jira person picker. The standup data for the selected person should be derived identically to how it works for "me" today — including best-effort git/GitLab usage matching. Unlike "me", a watched person's git/GitLab account won't always resolve, and that is acceptable (graceful empty).

</domain>

<decisions>
## Implementation Decisions

### Picker Placement
- Subtle picker lives in the **standup page header, right side** (`StandupPageHeader.tsx`), near the existing Refresh / Copy markdown buttons.
- Affordance: a small ghost dropdown like `Showing: <name> ▼`. Defaults to the logged-in user. Mirrors the established header/date-picker affordance style (low-key, hover-revealed chevron acceptable).

### Git / GitLab Commit Matching for a Watched Person
- **Best-effort by display name.** For a watched Jira person we have `displayName` / `name` / avatar but NOT their GitLab numeric ID or email.
- Reuse the *existing* fuzzy git matching logic (`fetchUserCommits` name/email matching in `services/gitlab.ts`) feeding the watched person's Jira display name in place of `gitlabName`. If nothing matches, the commit sections render empty — "git user not found" is an accepted outcome, not an error.
- Do NOT add a new GitLab account-resolution lookup step as the primary path.

### Persistence
- **Reset to me each load.** The watched-person selection is transient (in-memory / per-page state only). Reopening the app always starts on the logged-in user. This keeps it a lightweight "peek at someone" rather than a sticky mode. No new persisted auth/settings field.

### GitLab-ID-dependent sections (MRs awaiting review, participated MRs)
- **Best-effort, empty if unmatched.** These sections need a GitLab numeric ID. Attempt to derive/resolve the watched person's GitLab user where cheaply possible; if found, behavior is identical to "me". If not found, the MR sections render empty with a subtle "not matched" hint rather than erroring or showing the logged-in user's data.
- Critical correctness guard: when a watched person is selected, these sections must NOT silently fall back to the logged-in user's `gitlabUserId` — that would show the wrong person's MRs.

### Claude's Discretion
- Exact state-management shape (local React state in `StandupNotesPage` vs a small context) — planner/executor to choose the least invasive approach that threads the watched identity into the existing queries.
- Exact "not matched" hint copy and styling, consistent with existing muted-text patterns.
- Whether the picker shows recent/assignable Jira users, project members, or a searchable list — use the existing Jira user search service (`services/jira/users.ts` `fetchAssignableUsers`) as the source.

</decisions>

<specifics>
## Specific Ideas

- Identity is currently sourced entirely from `useAuthStore()` in `StandupNotesPage.tsx` (fields: `jiraUsername`, `jiraUserKey`, `jiraUserDisplayName`, `gitlabUserId`, `gitlabUsername`, `gitlabName`, `gitlabEmail`). The watched-person feature introduces an "effective identity" that defaults to these auth values but can be overridden by the picker.
- Reuse existing UI primitives: `FilterDropdown`/popover pattern (`components/UnifiedFilterBar.tsx`) or the date-picker dropdown pattern already in `YesterdayColumn.tsx` for the subtle affordance.
- Jira user object shape: `JiraAssignableUser { displayName, name, key?, avatarUrls? }` from `services/jira/types.ts`; search via `fetchAssignableUsers` in `services/jira/users.ts`.
- Git matching internals: `fetchUserCommits()` + `emailLocalName()` in `services/gitlab.ts` (~lines 1198-1287) — match by author_name vs display name and email local-part.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above. Source of truth is the existing standup-notes implementation under `taskflow/src/routes/standup-notes/`.

</canonical_refs>
