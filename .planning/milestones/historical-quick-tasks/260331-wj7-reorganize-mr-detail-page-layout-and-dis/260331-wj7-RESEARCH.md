# Quick Task: Reorganize MR Detail Page Layout - Research

**Researched:** 2026-03-31
**Domain:** UI layout / component consistency
**Confidence:** HIGH

## Summary

The MR detail page (`MergeRequestDetailPage.tsx`) uses the same two-column layout as `IssueDetailPage.tsx` (flex-1 left column + w-[42%] right sidebar). The discussion threads component (`DiscussionThreads.tsx`) was added as a section at the bottom of the left column, after commits and linked Jira issues. The main issues making it feel "bolted on" are:

1. **Discussions buried below action buttons** -- they sit at the very bottom of the left column content, below commits, linked issues, AND after action buttons. On real GitLab, discussions are the primary content of the Overview tab.
2. **No visual separation between content sections** -- all sections (description, commits, linked issues, discussions) use the same `space-y-6` with small `h3` headers. There is no card/panel structure to group related content.
3. **Sidebar is disproportionately wide at 42%** -- this matches IssueDetailPage but for MR detail (which has less sidebar metadata than Jira issues), it wastes space. GitLab uses roughly 25-30% for the sidebar.
4. **Discussion threads use bordered cards but the rest of the page has no cards** -- creates visual inconsistency. The DiscussionThread component has `rounded-lg border p-4` while other sections are raw content.
5. **Missing tab structure** -- Real GitLab MR pages use tabs (Overview, Commits, Changes). The current page dumps everything linearly.

**Primary recommendation:** Restructure the page into a GitLab-inspired layout: move discussions to be the primary content area below description (before commits), wrap sections in consistent Card components, reduce sidebar width to ~280px fixed, and optionally add lightweight tab navigation for Overview/Commits separation.

## Architecture Patterns

### Current Layout Structure (MergeRequestDetailPage)
```
flex flex-col h-full
  |-- breadcrumb header (conditional)
  |-- flex flex-1 overflow-hidden
        |-- flex-1 overflow-auto (LEFT COLUMN)
        |     |-- p-6 space-y-6
        |           |-- Header (!iid + title)
        |           |-- Description section
        |           |-- Commits section
        |           |-- Linked Jira Issues section
        |           |-- Discussion Threads section  <-- buried here
        |           |-- Action buttons (Open in GitLab)
        |
        |-- w-[42%] border-l overflow-auto p-4 (RIGHT SIDEBAR)
              |-- MetaRow items (Status, Author, Assignee, etc.)
```

### IssueDetailPage Pattern (for consistency reference)
```
flex flex-col h-full
  |-- breadcrumb header
  |-- flex flex-1 overflow-hidden
        |-- flex-1 overflow-auto (LEFT)
        |     |-- p-6: IssueDetailContent (header, actions, description, subtasks, attachments)
        |     |-- px-6: ActivityTimeline + CommentComposer (sticky bottom)
        |
        |-- w-[42%] border-l overflow-auto p-4 (RIGHT)
              |-- IssueDetailSidebar (FieldsSection, LinkedIssues, MRs)
```

Key difference: IssueDetailPage puts its activity/comments as a **separate section below content** with its own scroll behavior and a sticky composer. The MR page should follow a similar pattern for discussions.

### Recommended New Layout
```
flex flex-col h-full
  |-- breadcrumb header
  |-- flex flex-1 overflow-hidden
        |-- flex-1 overflow-auto (LEFT)
        |     |-- p-6 space-y-6
        |     |     |-- Header (MR iid + title + state badge inline)
        |     |     |-- Action bar (Open in GitLab) -- moved up, compact
        |     |     |-- Description (in Card wrapper)
        |     |     |-- Commits (in collapsible Card, count in header)
        |     |     |-- Linked Jira Issues (if any, in Card)
        |     |
        |     |-- px-6 pb-6: Discussion Threads (full-width, own section)
        |           |-- section header with unresolved count
        |           |-- thread cards (already styled well)
        |
        |-- w-72 border-l overflow-auto p-4 shrink-0 (RIGHT SIDEBAR ~288px)
              |-- MetaRow items (same content, narrower)
```

### Specific Changes Needed

1. **Move "Open in GitLab" button** to header area (next to title, or as a compact icon button in the breadcrumb bar). Remove the bottom action section entirely.

2. **Reduce sidebar width** from `w-[42%]` to `w-72` (288px) or `w-80` (320px). The sidebar has short metadata rows; 42% is excessive. Use `max-w-xs` as a fallback. Truncate long branch names (already done with `max-w-[120px]`).

3. **Add Card wrappers** to left-column sections for visual grouping. Use the existing `@/components/ui/card` (Card, CardHeader, CardContent) from shadcn. This makes each section (Description, Commits, Linked Issues) visually distinct.

4. **Promote discussions** to be the last major section with more visual weight. Add a divider or section separator before discussions. Consider making the discussion header sticky within the scroll area.

5. **Inline the MR state badge in the header** next to the title (like GitLab does) rather than only in the sidebar. This gives immediate status visibility.

6. **Collapse commits by default** if there are many (>5). Show first 3 + "Show N more" toggle. Commits are secondary content on an MR overview.

### Shared Components Available
| Component | Path | Use For |
|-----------|------|---------|
| Card/CardHeader/CardContent | `@/components/ui/card` | Section wrappers |
| Badge | `@/components/ui/badge` | Status/label tags |
| CachedAvatar | `@/components/ui/cached-avatar` | User avatars |
| Skeleton | `@/components/ui/skeleton` | Loading states |
| Button | `@/components/ui/button` | Actions |
| WikiRenderer | `./WikiRenderer` | Markdown/wiki content |

### Anti-Patterns to Avoid
- **Don't add tabs** unless there is a clear second tab worth navigating to. Tabs with only "Overview" and nothing else look odd. If commits are moved to a tab, the overview becomes too sparse.
- **Don't change the DiscussionThreads component internals** -- it is well-structured. The problem is placement and surrounding context, not the component itself.
- **Don't change the IssueDetailPage layout** in this task. Keep changes scoped to MergeRequestDetailPage only.

## Common Pitfalls

### Pitfall 1: Breaking the Shared MetaRow Component
The `MetaRow` component is defined locally in MergeRequestDetailPage (not shared). It can be freely modified without affecting other pages. However, keep the same visual pattern as IssueDetailSidebar's field rows for cross-page consistency.

### Pitfall 2: Sidebar Width and Branch Name Overflow
Reducing sidebar width means branch names need aggressive truncation. Already using `max-w-[120px]` with truncate -- this may need to decrease to `max-w-[100px]` at narrower sidebar widths. Test with long feature branch names.

### Pitfall 3: Discussion Threads Empty State
When `discussions` is empty or undefined, the page should still look good. The current code only renders the section when `discussions.length > 0`, which is fine -- but ensure the page doesn't feel empty without discussions.

## Code Examples

### Card-Wrapped Section Pattern
```tsx
// Source: shadcn/ui Card + existing project patterns
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Description section
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-sm font-medium text-muted-foreground">Description</CardTitle>
  </CardHeader>
  <CardContent>
    {mr.description ? (
      <WikiRenderer wikiText={mr.description} attachments={{}} users={{}} />
    ) : (
      <p className="text-sm text-muted-foreground italic">No description</p>
    )}
  </CardContent>
</Card>
```

### Inline Status Badge in Header
```tsx
// Title area with inline state badge
<div>
  <div className="flex items-center gap-2 mb-1">
    <p className="text-xs font-mono text-muted-foreground">!{mr.iid}</p>
    <MRStateBadge state={mr.state} draft={mr.draft} />
  </div>
  <div className="flex items-center gap-3">
    <h2 className="text-xl font-semibold leading-snug flex-1">{mr.title}</h2>
    <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0"
      onClick={() => openUrl(mr.web_url)}>
      <ExternalLink className="size-3.5" />
      Open in GitLab
    </Button>
  </div>
</div>
```

### Collapsible Commits Section
```tsx
const [showAllCommits, setShowAllCommits] = useState(false);
const COMMIT_PREVIEW_COUNT = 5;
const visibleCommits = showAllCommits ? commits : commits.slice(0, COMMIT_PREVIEW_COUNT);

<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-sm font-medium text-muted-foreground">
      Commits ({commits.length})
    </CardTitle>
  </CardHeader>
  <CardContent className="pt-0">
    <ul className="space-y-1">
      {visibleCommits.map((c) => <CommitRow key={c.id} commit={c} />)}
    </ul>
    {commits.length > COMMIT_PREVIEW_COUNT && (
      <button type="button" onClick={() => setShowAllCommits(v => !v)}
        className="text-xs text-muted-foreground hover:text-foreground mt-2">
        {showAllCommits ? 'Show less' : `Show ${commits.length - COMMIT_PREVIEW_COUNT} more`}
      </button>
    )}
  </CardContent>
</Card>
```

## Sources

### Primary (HIGH confidence)
- Direct code reading: `MergeRequestDetailPage.tsx` (536 lines), `DiscussionThreads.tsx` (241 lines), `IssueDetailPage.tsx`, `IssueDetailSidebar.tsx`, `IssueDetailContent.tsx`
- [GitLab MR Widgets docs](https://docs.gitlab.com/user/project/merge_requests/widgets/) -- overview tab layout reference
- [GitLab MR Reviews docs](https://docs.gitlab.com/user/project/merge_requests/reviews/) -- discussion thread patterns

## Metadata

**Confidence breakdown:**
- Layout issues identified: HIGH -- direct code analysis
- Recommended changes: HIGH -- follows existing project patterns (IssueDetailPage) and GitLab conventions
- Component reuse: HIGH -- verified Card, Badge, etc. exist in project

**Research date:** 2026-03-31
**Valid until:** 2026-04-14
