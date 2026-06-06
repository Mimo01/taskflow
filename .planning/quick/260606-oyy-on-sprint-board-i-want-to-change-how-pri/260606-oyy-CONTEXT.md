# Quick Task 260606-oyy: Sprint board priority icon + issue-type border - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Task Boundary

On the sprint board, change how priority is displayed:
1. Remove the priority-colored **left border** on cards.
2. Show a **priority icon** on each card instead.
3. Add the **priority icon** on the story swimlane header.
4. Repurpose the card's **left border** to show **issue type** (story, defect, subtask, ...) via color.

</domain>

<decisions>
## Implementation Decisions

### Priority icon style
- Render the **actual Jira priority iconUrl image** (`issue.fields.priority.iconUrl`).
- Rationale: severity is already encoded in the Jira icon; matches Jira exactly and avoids maintaining a separate severity→glyph color mapping. Aligns with the existing icon-severity resolution already used by `priorityStripeClass()`.
- Handle null/missing priority gracefully (no icon, no broken image).

### Priority icon placement (card)
- Place the priority icon in the **footer/metadata row** of the card alongside assignee / story points / existing badges.
- Keeps the top line clean and groups meta together.

### Card left border = issue type
- Left border color is driven by **issue type** (Bug/defect=red, Story=green, Subtask=blue, Epic=purple, default/Task=blue), reusing the color palette already established in `IssueTypeIcon` (`src/components/ui/issue-type-icon.tsx`).
- Add a helper (mirroring `priorityStripeClass()`) e.g. `issueTypeStripeClass()` in `issueDisplayUtils.ts` returning a full Tailwind class string with light + dark variants.

### Subtask treatment
- **Uniform with all types.** Subtasks get their issue-type color (blue) on the left border like every other card. Drop the special `border-l-2 border-l-muted` subtask border treatment so all cards share one border width/behavior driven by type.

### Swimlane header priority icon
- Add the Jira priority iconUrl image to the **story swimlane header** (`StoryHeaderRow.tsx`), showing the story's own priority.
- Placement: inline in the header row near the key/summary (Claude's discretion within the existing horizontal flex). Header does NOT need an issue-type left border (user only requested the priority icon there).

### Claude's Discretion
- Exact icon size (match existing small icon sizing, ~14px / `w-3.5 h-3.5`).
- Whether to add a tooltip/alt text with the priority name (recommended for accessibility).
- Exact ordering within the footer meta row.

</decisions>

<specifics>
## Specific Ideas

- Reuse existing patterns: `priorityStripeClass()` in `issueDisplayUtils.ts` as the template for a new `issueTypeStripeClass()`; reuse `IssueTypeIcon` color palette for border colors.
- A small reusable `PriorityIcon` component (renders `priority.iconUrl` with alt/title = priority name) would be cleaner than inlining `<img>` in both TaskCard and StoryHeaderRow.

</specifics>

<canonical_refs>
## Canonical References

- `src/routes/dashboard/TaskCard.tsx` (lines ~339-351) — current priority left border.
- `src/lib/issueDisplayUtils.ts` (lines ~80-141) — `priorityStripeClass()` + ICON_SEVERITY_STRIPE.
- `src/components/ui/issue-type-icon.tsx` — issue-type → color/icon mapping.
- `src/routes/dashboard/StoryHeaderRow.tsx` — swimlane header structure.
- Memory: custom 9-level Jira priority scheme; P76 stripes colored by icon severity (Medium intentionally below WCAG).

</canonical_refs>
