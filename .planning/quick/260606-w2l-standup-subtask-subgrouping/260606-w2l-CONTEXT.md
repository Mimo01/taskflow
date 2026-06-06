# Quick Task 260606-w2l: Standup notes — sub-group activity to sub-task level - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Task Boundary

On the Standup Notes page, activity is grouped under parent **stories** (good, keep it).
Add a second level of grouping: within a story group, activity that belongs to a
specific **sub-task** should nest under that sub-task, while story-level activity
stays directly under the story. Applies "where it can be" — only when activity is
attributable to a sub-task.

Primary target: **Yesterday "Worked On" column** (`YesterdayColumn.tsx` → `buildGroups`),
where sub-task worklogs/commits/MR-activity currently roll up FLAT to the parent
story and lose sub-task attribution (only worklogs keep a clickable subtask key today).
The Today "In Progress" section already nests sub-tasks under stories.

</domain>

<decisions>
## Implementation Decisions

### Scope
- **Everywhere applicable**: (1) Yesterday "Worked On" column rendering, (2) the
  Copy-markdown export (`generateMarkdown`) must mirror the nested structure,
  (3) audit the Today column for any remaining flat spots (it already nests, so
  likely no change — verify and note).

### Nesting style
- **Sub-task header + indented activity**: inside a story group, render a sub-task
  sub-header (issue-type icon + key + summary, same row treatment as the existing
  group/issue rows) with that sub-task's activity items indented one level beneath it.
- Reuse the existing visual language (`IssueActivityGroup` header row + `pl-6 ml-2`
  indent for sub-items). Sub-task header is clickable (peek on body, full-page on key)
  consistent with the story header.

### Story-level items (Claude's Discretion — "clean, understandable view")
- Activity NOT attributable to a sub-task (commits/MRs keyed directly to the story,
  story-level worklogs, story transitions/comments) renders flat **directly under the
  story header, above the sub-task groups**.
- Only create a sub-task sub-group when that sub-task actually has activity — never
  render an empty sub-task header.
- A story with no sub-task activity looks exactly as it does today (no regression).

### Markdown export
- Mirror the hierarchy with indentation: story heading → story-level bullets →
  indented sub-task line + further-indented sub-task bullets. Keep it readable when
  pasted into Slack/Jira (2-space nested indent).

</decisions>

<specifics>
## Specific Ideas

Key implementation note: `buildGroups` currently calls `resolveRollup(key)` and
immediately collapses every sub-item onto the parent story key, discarding the
originating sub-task key for commits and MR events (worklogs are the exception —
they already carry `issueKey`). To sub-group, the join must **preserve the origin
issue key** on each sub-item and bucket sub-items by (storyKey → subtaskKey | story-level).

Sub-task display metadata (icon/summary) comes from `issueMeta[subtaskKey]`
(`StandupIssueMeta`: `type`, `summary`, `isSubtask`, `parentKey`, `parentSummary`).
Where a sub-task key has no meta entry (commit/MR-only source), fall back to the bare
key as summary and a generic/sub-task icon — degrade gracefully, never crash.

Existing nesting reference to match: `TodayInProgressSection.tsx` (`IssueRow` with
`indented` prop, `pl-6 ml-2`).

</specifics>

<canonical_refs>
## Canonical References

- `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` — `buildGroups`, `IssueGroup`, rendering, `generateMarkdown`
- `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx` — group header + sub-item rows (`SubItem`)
- `taskflow/src/routes/standup-notes/TodayInProgressSection.tsx` — existing parent→subtask nesting pattern
- `taskflow/src/services/jira.ts` — `StandupIssueMeta`, `fetchIssueMeta`
- Tests to keep green/extend: `YesterdayColumn.test.ts`, `TodayColumn.markdown.test.ts`

</canonical_refs>
