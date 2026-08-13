# Phase 88: Release Branch & Milestone Creation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 88-Release Branch & Milestone Creation
**Areas discussed:** Branch name when no milestone, Duplicate & milestone list scope, Invalid branch name handling, Warning & action placement

---

## Branch name when no milestone

### Behavior when no milestone matches

| Option | Description | Selected |
|--------|-------------|----------|
| Milestone is a prerequisite | No matched milestone → no resolvable branch name; branch UI disabled with "create the milestone first" | ✓ |
| Fall back to fix version name | Use the Jira fix version name as the branch name | |
| User types the branch name | Prefill when available, otherwise free-text with validation | |

**User's choice:** Milestone is a prerequisite
**Notes:** Keeps a single source of truth for the branch name. Became more important once D-09 established that the name is parsed out of the milestone title.

### Branch existence check

| Option | Description | Selected |
|--------|-------------|----------|
| GET the single branch, 404 = missing | One cheap request, exact answer, needs a 404-is-not-an-error path | ✓ (Claude) |
| Search the branch list | `?search=` and match exactly; needs paging | |
| You decide | Defer to researcher/planner | ✓ (user) |

**User's choice:** You decide
**Notes:** Claude's call recorded as D-13. Partly superseded in practice by D-18's shared branch-set fetch for the list view.

### Default branch source

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch the project, use default_branch | New `fetchProject`, extend `GitLabProject`; also serves Phase 91 | ✓ |
| Hardcode 'main' with an override | No new call, silently wrong on master/develop repos | |
| Add it to settings | Explicit but user-maintained per project | |

**User's choice:** Fetch the project, use default_branch

### Post-create behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Invalidate and re-fetch, inline success | Real server state, no toast, matches existing mutation style | ✓ |
| Optimistic flip + rollback | Snappier, but optimistic writes are Phase 90's territory | |
| You decide | | |

**User's choice:** Invalidate and re-fetch, inline success

### Creation failure surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Error inside the dialog, stay open | Surface GitLab's message body, allow retry | ✓ (Claude) |
| Close and show a page-level alert | | |
| You decide | | ✓ (user) |

**User's choice:** You decide → recorded as D-16.

---

## Duplicate & milestone list scope

### Milestone data scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full project list, separate query | Dialog-only query, sees every milestone regardless of date | |
| Reuse the windowed list | No new query; misses duplicates dated outside the window | ✓ |
| You decide | | |

**User's choice:** Reuse the windowed list
**Notes:** Claude flagged that a duplicate outside the window would slip past the client check and be rejected server-side. User accepted the trade (see next entry).

### Ancestor (group) milestones

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude ancestors for the dup check | A group milestone with the same title is not a project-level conflict | ✓ |
| Include ancestors, warn not block | | |
| You decide | | |

**User's choice:** Exclude ancestors

### How to distinguish project vs. group milestones

| Option | Description | Selected |
|--------|-------------|----------|
| Add project_id/group_id to the type | Filter locally, no new request, query key untouched | ✓ (Claude) |
| Second fetch with include_ancestors=false | Unambiguous but re-opens the "which list" question | |
| You decide | | ✓ (user) |

**User's choice:** You decide → recorded as D-07.
**Notes:** Claude raised that the two prior answers interact — `GitLabMilestone` carries no field today identifying the owner scope.

### Accepting the out-of-window duplicate miss

| Option | Description | Selected |
|--------|-------------|----------|
| Accept it, surface GitLab's rejection | Client check is best-effort, GitLab is authority | ✓ (Claude) |
| Widen the window for the check only | | |
| You decide | | ✓ (user) |

**User's choice:** You decide → recorded as D-08.

### Create dialog prefill and format strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Prefill from fix version, soft format hint | Never block on format, only on duplicates | |
| Prefill and hard-enforce X.Y.Z | Consistent titles, blocks one-offs | |
| Empty field, no format rule | | |
| **Other (user)** | **Titles are `33.5.0 (21.07.2026)`. Prefill the date from the Jira fix version, show latest milestone names for reference, enforce format.** | ✓ |

**User's choice:** Free-text correction — none of the offered options.
**Notes:** **This is the pivotal moment of the discussion.** REQUIREMENTS.md RELMS-03 documents the format as `1.1.0`, which is wrong. The real format `X.Y.Z (DD.MM.YYYY)` contains spaces and parentheses, making RELBR-01's literal `release/<milestone title>` an invalid git ref. Recorded as D-01 and the cause of D-09.

### Format enforcement strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Block submit unless it matches exactly | Regex-gated create button | ✓ |
| Split fields: version + date picker | Format unbreakable by construction | |
| Warn but allow override | | |

**User's choice:** Block submit unless it matches exactly

### Milestone fields on create

| Option | Description | Selected |
|--------|-------------|----------|
| Title + due_date from the fix version | Date matcher links it immediately | ✓ |
| Title only | Would be created and still show as unmatched | |
| Title + due_date + description | | |

**User's choice:** Title + due_date from the fix version

---

## Invalid branch name handling

### Actual branch name for a `33.5.0 (21.07.2026)` milestone

| Option | Description | Selected |
|--------|-------------|----------|
| `release/33.5.0` — version part only | Strip the ` (date)` suffix; always a valid ref | ✓ |
| `release/33.5.0-21.07.2026` sanitized | Preserves the date in the branch name | |
| Something else | | |

**User's choice:** Version part only
**Notes:** Recorded as D-09; supersedes the literal reading of RELBR-01.

### Unparseable milestone titles

| Option | Description | Selected |
|--------|-------------|----------|
| Show unresolvable, disable create | Never guesses, never creates a junk branch | ✓ |
| Fall back to sanitizing the whole title | | |
| Let the user type the branch name | | |

**User's choice:** Show unresolvable, disable create

### Where validation logic lives

| Option | Description | Selected |
|--------|-------------|----------|
| Pure module in release-detail/ | React-free with unit tests, matches Phase 87 D-09 | ✓ (Claude) |
| Inside services/gitlab.ts | No caller can bypass it | |
| You decide | | ✓ (user) |

**User's choice:** You decide → recorded as D-12.

---

## Warning & action placement

### Detail-view placement

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar Details block | Release metadata alongside other release metadata | ✓ (Claude) |
| Release-level banner above content | Loudest, pushes content down on every unprepared release | |
| Extend the existing IssuesSection alert | Reuses what's there but buries release-level state | |
| You decide | | ✓ (user) |

**User's choice:** You decide → recorded as D-20.

### Releases list indication

| Option | Description | Selected |
|--------|-------------|----------|
| No — detail view only | Keeps Phase 88 scoped; Phase 89's drift count is the list signal | |
| Yes — small indicator on the row | Drift visible without opening each release | ✓ |
| You decide | | |

**User's choice:** Yes — small indicator on the row
**Notes:** The one place the user overrode a scope-conservative recommendation. Raised the fetch-cost question, answered below.

### List fetch strategy

| Option | Description | Selected |
|--------|-------------|----------|
| One paginated `release/` branch list, matched locally | One request regardless of row count, shared cache | ✓ (Claude) |
| Per-row branch query | N requests per tab open | |
| Full branch list, no search filter | Potentially thousands of branches | |
| You decide | | ✓ (user) |

**User's choice:** You decide → recorded as D-18, with an explicit no-page-cap requirement.

### Indicator form

| Option | Description | Selected |
|--------|-------------|----------|
| Icon only, tooltip explains | Quiet, no layout weight on dense rows | ✓ (Claude) |
| Short text badge | More scannable, more weight | |
| You decide | | ✓ (user) |

**User's choice:** You decide → recorded as D-19.

---

## Claude's Discretion

The user delegated 8 of 14 decisions: D-07 (ancestor discrimination), D-08 (out-of-window duplicate miss), D-12 (validation module location), D-13 (branch existence check), D-16 (failure surfacing), D-18 (list fetch strategy), D-19 (indicator form), D-20 (detail-view placement).

Hard user decisions: D-01 (title format correction), D-02 (enforce format), D-04 (due_date on create), D-09 (version-only branch name), D-10 (milestone as prerequisite), D-17 (list row indicator).

## Deferred Ideas

- Correcting RELMS-03's wrong `1.1.0` format in `REQUIREMENTS.md` (doc fix, not code)
- Syncing milestone description from the Jira fix version on create
- A configurable release-branch prefix (currently hardcoded `release/`)
- Designing the D-19 icon so Phase 89's aggregate drift count can sit beside it

### Todos
No pending todos matched Phase 88 (`todo.match-phase` returned 0).
