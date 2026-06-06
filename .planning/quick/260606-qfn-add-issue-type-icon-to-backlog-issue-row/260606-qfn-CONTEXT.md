---
gathered: 2026-06-06
status: Ready for planning
---

# Quick Task 260606-qfn: Add issue type icon to backlog issue row and sprint board story swimlane header - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Task Boundary

Add an issue type icon (Story/Bug/Task/Epic/Subtask) to:
1. The backlog issue row (`BacklogRow.tsx`)
2. The sprint board story swimlane header (`StoryHeaderRow.tsx`)

Reuse the existing `IssueTypeIcon` component (`src/components/ui/issue-type-icon.tsx`, lucide-based, takes `typeName: string`).
</domain>

<decisions>
## Implementation Decisions

### Backlog row placement
- The issue type icon gets its **own dedicated column, positioned BEFORE the key column**.
- Resulting column order: **type → key → priority → summary → epic → points → assignee**.
- Follow the existing PriorityIcon column pattern: explicit ~18px-width wrapper cell so the narrow column does not collapse to 0 in the virtualized/absolute-row Backlog table (WebKit/Tauri pitfall).

### Swimlane header placement
- The issue type icon goes **before the key button** in the story key/summary section.
- Resulting order in the header: **type → key → priority → summary**.

### Consistency (explicit user requirement)
- Make the two placements **as consistent as possible**: icon-first ordering (type before key) in BOTH the backlog row and the swimlane header. Same component, same size, same color treatment.

### Claude's Discretion
- Exact icon size/className (match existing usage, e.g. `w-3.5 h-3.5 shrink-0`).
- Null/missing issuetype handling — render nothing when `issue.fields.issuetype?.name` is absent.
- Access via `issue.fields.issuetype?.name` (do not break when `issuetype` undefined in legacy fixtures).
</decisions>

<specifics>
## Specific Ideas

- Reuse `IssueTypeIcon` from `src/components/ui/issue-type-icon.tsx` (props: `typeName`, optional `className`).
- Backlog precedent: PriorityIcon column added in commit `f686edd7` to `BacklogRow.tsx` — copy the explicit-px-width wrapper approach.
- Swimlane precedent: PriorityIcon already rendered in `StoryHeaderRow.tsx` after the key button — insert IssueTypeIcon before the key button.
- Issue type field: `issue.fields.issuetype.name` (id optional; `subtask: boolean` authoritative for subtask detection but IssueTypeIcon already handles name mapping including "Sub-task").
</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.
</canonical_refs>
