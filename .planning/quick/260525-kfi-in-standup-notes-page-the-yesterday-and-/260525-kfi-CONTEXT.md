# Quick Task 260525-kfi: Unify Yesterday/Today views in Standup Notes page - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Task Boundary

Unify the visual design of the Yesterday and Today columns in the Standup Notes page. The Today view is preferred — Yesterday should be restyled to match it without changing data model or structure.

Key files:
- `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` — main target
- `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx` — sub-component to restyle
- `taskflow/src/routes/standup-notes/TodayColumn.tsx` — reference for Today's visual style
- `taskflow/src/routes/standup-notes/TodayInProgressSection.tsx` — reference for item row style

</domain>

<decisions>
## Implementation Decisions

### Section headers
- No section labels added to Yesterday — keep the flat joined list. Just restyle item rows to match Today's visual treatment.

### Sub-item layout
- Sub-items in `IssueActivityGroup` should be converted to indented rows using `pl-6 border-l border-border ml-2` — the same pattern Today uses for nested subtasks and MRs.

### Stat line
- Keep the stat line ("Xh logged · Y commits · Z MR events"). It provides useful density info. Restyle it to match Today's subtle `text-xs text-muted-foreground` typography if not already matching.

### Claude's Discretion
- IssueActivityGroup header row should be restyled to match Today's IssueRow: clickable row with `hover:bg-muted/50`, issue type icon, monospace key, truncated summary, time chip right-aligned.
- The `StandaloneMrGroup` and `OtherCommitsGroup` components should also be visually aligned with Today's MR row style (GitBranch icon, monospace iid, truncated title).
- Compact empty notices and loading skeletons in Yesterday can keep their current placement (bottom) as long as they visually match Today's treatment.

</decisions>

<specifics>
## Specific Ideas

- IssueRow in Today (`TodayInProgressSection.tsx`) uses: `flex items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring`
- Nested rows use: `pl-6 border-l border-border ml-2`
- Time chip style: `rounded bg-muted px-2 py-1 text-xs text-muted-foreground`
- Section dividers: `divide-y divide-border` on the container

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.
</canonical_refs>
