# Quick Task 260316-wbp: Make comment section on issue detail more intuitive - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Task Boundary

Redesign the comment section in the issue detail sheet to be more intuitive: fix comment box placement, add visual separation between comments, and add edit/delete capabilities.

</domain>

<decisions>
## Implementation Decisions

### Comment Box Placement
- Sticky at bottom: comment composer fixed to the sheet bottom, comment thread scrolls independently above it
- Comments displayed chronologically (oldest first), user naturally scrolls to see latest and composer is always accessible

### Comment Separation Style
- Cards with border: each comment in a subtle bordered card with rounded corners
- Gap between cards for clear visual separation
- Author avatar/icon + name + relative timestamp in card header

### Edit/Delete Behavior
- Own comments only: show 3-dot menu (⋮) only on comments authored by the current user
- Menu contains Edit and Delete options
- Edit: inline editing within the card (replace body with textarea, save/cancel)
- Delete: confirmation dialog before deletion
- Requires Jira API: PUT and DELETE on `/rest/api/2/issue/{issueKey}/comment/{commentId}`
- Need to identify current user to match against comment author

</decisions>

<specifics>
## Specific Ideas

- Reactions explicitly mentioned by user but not discussed — defer to Claude's discretion (see below)
- The InlineComment component (TaskRow) already uses bordered cards — align IssueDetailContent styling with that pattern

</specifics>

### Claude's Discretion
- Reactions: Skip for this task — edit/delete + layout changes are already substantial. Can be a follow-up quick task.
- Delete confirmation: Use a simple confirm dialog, not a modal
- Edit mode: Inline edit with the same formatting toolbar as the composer
- Empty state: Keep existing "No comments yet" text
