# Quick Task 260606-rgc: Make the epics page match more backlog view - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Task Boundary

Make the epics page (`taskflow/src/routes/dashboard/EpicsPage.tsx`) match the backlog
view more closely:
- Remove the table header (`<thead>`).
- Make the assignee rendering match the backlog (`BacklogRow`).
- Make the status pill match the canonical status component used in the rest of the app.

</domain>

<decisions>
## Implementation Decisions

### Table header
- Remove the `<thead>` block from the epics table entirely, matching the backlog
  table which renders no column header row.

### Status component
- **Keep the static status pill** (do NOT switch to the interactive `StatusPopover`).
- Render it via the shared `statusPillClass(epic.status.statusCategory?.key)` helper
  from `@/lib/statusStyles` so it is **visually identical** to the status pill used
  elsewhere in the app (StoryHeaderRow, TaskCard, issue detail).
- EpicsPage already calls `statusPillClass`; the goal is to confirm/align the markup
  so there is no visual drift from the canonical pill (same helper, same wrapping span,
  no extra geometry classes per the statusStyles contract).

### Assignee
- **Always render `CachedAvatar`**, matching `BacklogRow` exactly:
  `<CachedAvatar url={epic.assignee?.avatarUrls?.['48x48'] || null} name={epic.assignee?.displayName || 'Unassigned'} size={24} />`.
- This replaces the current conditional (`epic.assignee ? <CachedAvatar/> : null`) so
  unassigned epics show the distinct unassigned-avatar treatment, like the backlog.

### Layout scope
- **Targeted changes only.** Remove the header, fix assignee, align status.
- Keep the epic-specific cells (color bar, epic-name colored badge, key column).
- Do NOT import the full BacklogRow anatomy (issue-type icon, priority icon, story
  points) — epics are a different entity.

### Claude's Discretion
- Whether to keep the `<table>`/`<tbody>` structure or restructure — keep the table
  structure; only the `<thead>` is removed.
- Exact cell padding tweaks to better echo backlog row density, if trivially aligned.

</decisions>

<specifics>
## Specific Ideas

Reference files:
- `taskflow/src/routes/dashboard/EpicsPage.tsx` (target — current `EpicRow` + `<thead>`)
- `taskflow/src/routes/dashboard/BacklogRow.tsx` (assignee pattern, line ~196-203)
- `taskflow/src/lib/statusStyles.ts` (`statusPillClass`, canonical pill)

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
