# Quick Task 261014-eym: Deployment package ↔ fix version sync - Context

**Gathered:** 2026-10-14
**Status:** Ready for planning

<domain>
## Task Boundary

Enhance the Jira "Deployment package" field (`customfield_15725`, already loaded; currently read-only row in `FieldsSection.tsx`, shape previously unconfirmed). Applies to **Stories only** (not Epics, not Subtasks).

The field holds a link/key to an issue in a separate **Release Management (RM)** Jira project: the RM issue representing the application's deployment in a given week. The story's **fix version** must correspond to that same week. Both should be set together; if only one is set/matched, show a warning with an easy fix. Also show deployment package on the Releases tab and allow syncing. The RM project is pickable in settings.

</domain>

<decisions>
## Implementation Decisions

### Field shape
- `customfield_15725` holds an **issue key / issue link** (issue-picker style) pointing at an RM issue. Planner/researcher must still confirm the actual JSON shape (probe real data / fixtures, tolerate string key, `{key}` object, array) and the write format for PUT.

### RM matching
- RM structure: a WEEK **parent** issue named like `WEEK43 (19.10.2026 - 25.10.2026) LETNA AKCIA` (in the configured RM project), with **child issues, one per application deployed**.
- The deployment package for an application = the **child** whose summary **contains the application's Jira project name, case-insensitive**.

### Match rule (fix version ↔ week)
- Fix version **matches** the week when its `releaseDate` falls **within the dd.MM.yyyy – dd.MM.yyyy range** parsed from the WEEK parent summary (inclusive). Parse range from the parent summary; ignore trailing text.
- "Matched" = story's package child's parent week range contains the fix version's release date. Warn when: only one of the two is set; or both set but week/date mismatch.

### Warning + fix UI
- **Issue detail sidebar** (FieldsSection): warning beneath Fix Versions / Deployment package rows, with one-click fixes.
- **Release detail page**: drift list of stories whose fix version and package disagree, with fix actions (extend existing `release-detail/driftDetection.ts`; respect memory: drift lives on detail only, not Releases list).
- One-click fix **offers both directions**: package only → "set fix version to match"; fix version only → "set deployment package to match" (derive child via week-from-date + project name); both set but mismatched → two buttons, user picks.
- Only for issue type Story.

### Releases tab
- Show the derived deployment package (RM child/week) per fix version row.
- **Both display and a bulk "sync" action** that writes Jira: sets deployment package on release's stories missing/mismatched (and/or fix versions) per above rules.

### Settings
- Claude's discretion: global (not per-project) **Release Management project** picker (Jira project select) in the most fitting existing settings section (likely `IntegrationsSection` or `WorkflowSection` — match existing patterns).

### Claude's Discretion
- Exact placement/styling of warning (follow existing sidebar conventions, no card panels per memory), caching/query keys, error handling when no RM project configured (feature silently disabled), how to find the week parent for a date (JQL on RM project, parent issues whose summary matches `WEEK\d+ \(dd.MM.yyyy - dd.MM.yyyy\)`; fetch server-side with query, not one capped page filtered client-side — see fetch-once page-cap pitfall memory).

</decisions>

<specifics>
## Specific Ideas

- Example WEEK parent summary: `WEEK43 (19.10.2026 - 25.10.2026) LETNA AKCIA`.
- Edit `src/services/jira.ts` (legacy dual-file gotcha), not only `jira/` modules.
- Direct field PUT may be rejected by edit-screen security (cf. flag/resolution gotchas) — researcher must verify `customfield_15725` is editable via PUT; fall back to alternatives if not.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
