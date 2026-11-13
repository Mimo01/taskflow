# Quick Task 261113-cth: Issue detail redesign — sticky title header with actions, sticky section headers - Context

**Gathered:** 2026-11-13
**Status:** Ready for planning

<domain>
## Task Boundary

Redesign the issue detail view (all issue types: epics, stories, tasks, subtasks, ...) in BOTH the
full page (`/issue/:key`, `IssueDetailPage` → `IssueDetailView layout="two-column"`) and the peek panel
(`PeekPanel` → `IssueDetailView layout="single-column"`):

1. A sticky header showing the issue key + title, with the main actions (Refresh, Pin, Log work,
   Edit, Clone, Open in Jira, Copy Jira link) moved into it on the right. Today those actions sit in
   a row at the BOTTOM of `IssueDetailContent` (after the sections) — that row goes away.
2. Section headers (Description, Attachments, Progress, Stories, Subtasks, Parent, Activity, AIO test
   runs, sidebar-in-peek sections like Linked issues / Merge requests where they use SectionHeader)
   stick to the top of the scroll container (under the sticky title header) while their section is
   in view.
3. Clean, nice, consistent.

</domain>

<decisions>
## Implementation Decisions

### Header span (full page)
- Full width: one header across BOTH the content column and the right sidebar, above the two-column
  split (outside both scrollers). Sidebar and content scroll beneath it independently as today.
- The existing breadcrumb/back bar in `IssueDetailPage` (shown only when there's a trail) stays above it.

### Actions in the header
- Refresh and Pin → square outline icon buttons (size icon-sm) with tooltips/aria-labels.
- Log work → keeps its text label (LogWorkPopover trigger).
- Edit → square icon button.
- ⋯ overflow menu → Clone, Copy Jira link.
- Open in Jira → keeps its label ("Jira" / "Open in Jira" — keep full label if it fits, may collapse to
  icon only at very narrow widths in peek).
- All buttons outline style (matches the existing local button row convention), consistent h-7 sizing.
- Preserve every existing aria-label / title that tests rely on (e.g. "Refresh issue", "Pin issue KEY",
  "Unpin issue KEY", "Clone issue", "Copy Jira link", "Edit issue").

### Title behaviour — "shrink on scroll"
- At scroll top: the full title is shown large (text-2xl full page, text-xl peek), wrapping, as the first
  thing in the scrolling content (with the key above it, as today).
- After scrolling past the in-content title: the sticky header shows `KEY  truncated title…` on one line
  (full title as tooltip).
- Header height is FIXED (no layout shift / no scroll jitter): the compact key+title in the header fades
  in when the in-content title leaves the viewport (IntersectionObserver sentinel on the in-content title,
  rooted at the content scroller). At top the header still shows the actions (and may show just the key or
  nothing on the left) — planner/executor decide, but no height change.

### Peek panel
- Merge headers: the peek panel's current 40px bar (key + title + parent link for subtasks, Open full page,
  Close) is replaced by the same sticky header component with the actions, plus Open full page + Close at the
  far right. Subtask parent link in the peek header must be preserved (or moved somewhere equivalent).
- Peek section headers stick too.
- Narrow width: action buttons must not overflow — Log work may collapse to icon; never push Close off-screen.

### Sticky section headers
- Use `position: sticky; top: 0` on the SectionHeader within its section (section = containing block, so each
  header is pushed out by the end of its own section). Opaque `bg-background`, z-index above row overlays
  (rows use relative z-10 overlay buttons → sticky header z-20, see release table precedent).
- A subtle bottom divider/shadow only while stuck is nice-to-have; not required. Keep it calm.
- Two-column sidebar: its sections may also stick if they use SectionHeader; not required.

### Claude's Discretion
- Exact component naming/structure (e.g. new `IssueDetailHeader` component shared by page + peek).
- Whether the header shows issue type icon next to the key.
- Overflow menu implementation (use the existing Base UI / shadcn DropdownMenu primitive in components/ui).
- Skeleton/loading state for the header (key + actions available before issue loads, as peek does today).

</decisions>

<specifics>
## Specific Ideas / Known Constraints (from project memory)

- Follow shipped patterns: shared `SectionHeader` (routes/dashboard/issue-detail/SectionHeader.tsx) is THE
  section heading — make it sticky there (opt-in prop or default) rather than per-call.
- Match the local button row: outline buttons, not bare ghost header icons.
- Page header consistency: subpage titles text-2xl; no title icons for page headers (type icon in a compact
  issue header is acceptable but keep it subtle).
- `sticky` needs an opaque background and must beat `relative z-10` row overlays (z-20).
- Non-positioned overflow-auto scrollers + abspos sr-only elements over-scroll — scrollers should be `relative`.
- Custom fixed overlays inside the `isolate` main must portal to body (menus via the existing primitive are fine).
- Activity section already has a sticky BOTTOM comment composer — must keep working.
- The Activity feed is rendered by IssueDetailView outside IssueDetailContent; its SectionHeader must stick too.
- Detail pages: no card panels; keep IssueDetailContent h3/rows style.
- Repo layout: .planning + git at outer taskflow/; src, npm, vitest, biome in inner taskflow/taskflow/.
- Pre-commit hook runs the full vitest suite + biome + tsc; RED/GREEN in one commit.

</specifics>

<canonical_refs>
## Canonical References

- taskflow/src/routes/dashboard/IssueDetailPage.tsx (full-page shell + breadcrumb bar)
- taskflow/src/routes/dashboard/IssueDetailView.tsx (two-column / single-column layouts, activity section)
- taskflow/src/routes/dashboard/IssueDetailContent.tsx (title block + bottom action row to remove)
- taskflow/src/routes/dashboard/issue-detail/SectionHeader.tsx
- taskflow/src/components/app/PeekPanel.tsx (current peek header)
- taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx
</canonical_refs>
