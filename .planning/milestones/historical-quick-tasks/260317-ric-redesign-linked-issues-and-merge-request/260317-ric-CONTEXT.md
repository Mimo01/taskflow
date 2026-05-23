# Quick Task 260317-ric: Redesign linked issues and merge requests on issue detail - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Task Boundary

Redesign the linked issues and merge requests sections in IssueDetailSidebar.tsx. Both sections currently render as plain text lists and need a visual upgrade to compact cards with richer metadata.

</domain>

<decisions>
## Implementation Decisions

### Visual Layout
- **Compact cards**: Each linked item rendered as a small card with border/background — cleaner than raw text, not as heavy as full cards
- Cards grouped by link type for linked issues (blocks, is blocked by, relates to)

### Information Density
- **Linked Issues**: Add issue type icon (bug/story/task), status color dot, priority icon, assignee avatar
- **Merge Requests**: Add author avatar, source branch name, approval/review status (approved, changes requested, etc.), state color coding (green=open, purple=merged)
- Beyond what's currently shown (key, title, status badge)

### Section Placement
- **Keep in sidebar** — same position but with better visual treatment
- Consistent with current layout, no structural changes to the two-column split

### MR Metadata
- Full review status: branch name, author avatar, AND approval/review status
- Requires fetching additional MR data (approvals endpoint or reviewer status from existing data)

</decisions>

<specifics>
## Specific Ideas

- Status badges should use color coding (not just outline variant) — green for done/merged, blue for in progress/open, etc.
- Issue type icons to differentiate bugs, stories, tasks at a glance
- Compact card should have subtle border and slight background to visually separate from MetaRow fields above
- Link type label (blocks, is blocked by) shown as small muted text above the issue key

</specifics>
