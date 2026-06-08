---
quick_id: 260608-dhp
description: On standup notes page, add new watched thing to 'yesterday' column - created issues
gathered: 2026-06-08
status: Ready for planning
---

# Quick Task 260608-dhp: Add Created Issues to Yesterday Column - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Task Boundary

Add "created issues" as a new tracked data source in the standup notes "yesterday" column. When a user (or watched teammate) created Jira issues yesterday, those issues should appear in the Yesterday column under a "Created" sub-item row.

</domain>

<decisions>
## Implementation Decisions

### Where created issues appear
- **Merged into existing issue groups** — if a created issue also had other activity (worklogs, transitions, comments), the "Created" sub-item appears inside that existing group. Issues that were only created (no other activity) get their own group containing just the Created sub-item.

### Display format
- **Simple 'Created' label** — a single sub-item row with just the label "Created". Same compact style as existing 'transition' sub-item rows. No issue type prefix or summary snippet needed.

### Watched-person scope
- **Watched users included** — created issues should appear for both the logged-in user and any watched teammate, using the same `effectiveIdentity` resolution already in place for other data sources.

### Claude's Discretion
- JQL query exact form for fetching created issues
- Ordering of the "Created" sub-item within a group (probably first, before worklogs/transitions)
- Whether to deduplicate if the same issue key appears in both created and worked-on lists

</decisions>

<specifics>
## Specific Ideas

- New `SubItemKind` value: `'issue-created'`
- The Created sub-item should appear **first** within an issue group (it happened at creation time, before any subsequent activity)
- The existing `buildGroups()` function in `YesterdayColumn.tsx` should gain a new data source pass that fetches created issues and merges them into the group map

</specifics>

<canonical_refs>
## Canonical References

- `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` — main data join logic (`buildGroups()`)
- `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx` — SubItemKind union and sub-item rendering
- `taskflow/src/services/jira.ts` — Jira fetch functions (add new fetch for created issues here)
- `taskflow/src/routes/standup-notes/effectiveIdentity.ts` — identity resolution for watched user

</canonical_refs>
