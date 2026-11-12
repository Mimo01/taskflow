# Quick Task 261112-eep: Subtask create buttons in story detail section header - Context

**Gathered:** 2026-11-12
**Status:** Ready for planning

<domain>
## Task Boundary

In story/task issue detail (IssueDetailContent.tsx, `!isEpic && !isSubtask` branch, ~L332-379), the two
subtask-creation buttons ("Add subtask", "Bulk Create Subtasks") currently render as full outline buttons
BELOW the subtask list, and the "Subtasks (N)" heading is only rendered when there are subtasks
(inside `subtaskListContent`). Make it nicer: the Subtasks section always exists with a heading, and the
create control sits on the right on the same line as the section title, consistent with app visuals.

</domain>

<decisions>
## Implementation Decisions

### Empty state
- Always render the "Subtasks" heading row (count suffix "(N)" only when N > 0).
- When the story has no subtasks, show a muted italic "No subtasks" line under the heading
  (same style as epic's "No stories in this epic": `text-sm text-muted-foreground italic`).
- Do NOT show "No subtasks" while subtasks exist but enrichment is loading (skeleton handles that).

### Create control (header right side)
- User selected: single **split control** — primary "Add subtask" (Plus icon) action + a chevron
  dropdown containing "Bulk create subtasks…" (LayoutList icon). Use existing components/ui/button.tsx
  + dropdown-menu.tsx (no new split-button primitive exists — build it inline or as a tiny local component).
- Style must match the issue-detail local button row: `variant="outline" size="sm"`, `text-xs`, `size-3.5` icons.
- User may still switch to two separate buttons after seeing it — keep the control isolated in one small
  component so swapping is a trivial change.
- Header row layout follows the Activity / Progress precedent:
  `<div className="flex items-center justify-between mb-2">` + `<h3 className="text-sm font-medium text-muted-foreground">`.
  Header row height must not jump between empty/non-empty states; the buttons must not inflate the
  heading's vertical spacing vs other sections.

### Claude's Discretion
- Exact split-button seam styling (joined outline buttons, shared border).
- Narrow-width behaviour (label may collapse to icon via @container like the action row's
  COMPACT_ACTION_CLASS / COMPACT_LABEL_CLASS, if needed).
- Keep BulkCreateSubtasksModal wiring and onAddSubtask callback behaviour unchanged.

</decisions>

<specifics>
## Specific Ideas

- Precedents: ActivityTimeline.tsx:151-156, EpicProgressSection.tsx:362-380 (heading + right-aligned controls).
- Action row button style + compact classes in IssueDetailContent.tsx (Refresh/Edit/Log work row).
- Memory: "Match the local button row" — new control takes its siblings' style (outline).
- Memory: "Detail pages: no card panels" — section stays h3 + content, no card.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
