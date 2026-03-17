# Quick Task 260317-k7o: Rich comment rendering in My Tasks - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Task Boundary

Upgrade InlineComment component in My Tasks to render comments with rich text (WikiRenderer) matching IssueDetailPage, and add edit/delete capabilities for own comments.

</domain>

<decisions>
## Implementation Decisions

### Comment Card Design
- Exact match with IssueDetailPage CommentCard — same author/timestamp header, 3-dot menu, WikiRenderer body
- Reuse or extract CommentCard component from IssueDetailPage.tsx

### Composer Toolbar
- Add Bold/Italic/Code/List formatting toolbar to the inline comment input
- Match the CommentComposer toolbar from IssueDetailPage

### Edit/Delete Permissions
- Own comments only — 3-dot menu appears only on comments authored by the current user
- Matches IssueDetailPage behavior

### Claude's Discretion
- Component extraction strategy (inline reuse vs shared component file)
- Exact styling adjustments for inline context if needed

</decisions>

<specifics>
## Specific Ideas

- Reference implementation: CommentCard (IssueDetailPage.tsx lines 360-485), CommentThread (lines 237-358)
- WikiRenderer already exists at `taskflow/src/routes/dashboard/WikiRenderer.tsx`
- CommentComposer toolbar at `taskflow/src/routes/dashboard/CommentComposer.tsx`
- InlineComment component at `taskflow/src/routes/dashboard/InlineComment.tsx`
- Jira API edit/delete already implemented: `updateComment()` and `deleteComment()` in jira.ts

</specifics>
