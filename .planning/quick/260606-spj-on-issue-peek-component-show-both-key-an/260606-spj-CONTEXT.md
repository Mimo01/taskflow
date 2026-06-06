# Quick Task 260606-spj: Issue peek header + Merge Requests reposition - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Task Boundary

On the issue **peek** component (the slide-over `PeekPanel`, single-column `IssueDetailView`
layout), make two changes:

1. **Header redesign** — the peek header bar currently shows only the issue key. Add the issue
   title alongside it. Redesign of the header bar is permitted.
2. **Move "Merge Requests" down** — the Merge Requests section currently renders in the top
   "sidebar" block of the single-column peek layout. Move it further down, below the description.

Scope is the peek panel ONLY. The full two-column issue page is out of scope.
</domain>

<decisions>
## Implementation Decisions

### Scope
- **Peek only.** Changes apply to the single-column peek layout (`PeekPanel` + `IssueDetailView`
  with `layout="single-column"`). The full two-column issue page header and sidebar must remain
  unchanged.
- IMPORTANT: `MergeRequestsSection` currently lives inside `IssueDetailSidebar`
  (`src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx`), which is shared by BOTH layouts via
  `sidebarNode` in `IssueDetailView.tsx`. To move it down in peek without affecting the full page,
  the MR section must be conditionally omitted from the sidebar in single-column mode and rendered
  separately at the bottom of the single-column content. The two-column path keeps it in the
  sidebar exactly as today.

### Merge Requests position (peek)
- Move to the **bottom of the panel, below the description/content** (after issue content, near/with
  the activity area — i.e. out of the top fields block entirely).

### Header content/design (peek)
- Show: **issue-type icon + key + title (truncated)**.
- Title truncates with ellipsis when long; keep the existing "Open full page" + Close controls on
  the right of the header bar.
- No status pill in the header (explicitly not chosen).

### Claude's Discretion
- Exact markup/spacing of the redesigned header, how the issue-type icon is sourced (reuse existing
  issue-type icon helper/component if one exists in the codebase), and the precise bottom placement
  of the MR section within the single-column content block (e.g. its own bordered block before the
  activity timeline). Watch the italic-truncate clip pitfall and avoid 0-width/overflow clipping on
  the title.
</decisions>

<specifics>
## Specific Ideas

Relevant files:
- `src/components/app/PeekPanel.tsx` — header bar (line ~74); receives only `issueKey`. Title comes
  from the loaded issue (`issue.fields.summary`) — currently the issue data is fetched inside
  `IssueDetailView`, not `PeekPanel`. The header redesign likely needs the title/type available at
  the header. Decide whether to surface it from `IssueDetailView`'s single-column layout (which
  already has the issue) rather than `PeekPanel`, or fetch in `PeekPanel`. Prefer reusing already-
  fetched data over a duplicate fetch.
- `src/routes/dashboard/IssueDetailView.tsx` — single-column layout at lines ~652-663
  (`sidebarNode` then content). The natural seam for both changes.
- `src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx` — renders FieldsSection →
  LinkedIssuesSection → MergeRequestsSection (lines ~127-152). MR data (`linkedMRs`, `mrsLoading`,
  `gitlabConnected`, `gitlabBaseUrl`) is computed INSIDE this component.
- `src/routes/dashboard/issue-detail/MergeRequestsSection.tsx` — presentational; props are
  `linkedMRs`, `mrsLoading`, `gitlabConnected`, `gitlabBaseUrl`. Returns null when GitLab not
  connected.

Note the dual-file gotcha: `src/routes/dashboard/IssueDetailSidebar.tsx` is a re-export barrel;
the real component is `issue-detail/IssueDetailSidebar.tsx`.
</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above. Phase 77
("universal-peek-slideover-and-issue-detail-refinements") is the origin of the peek component if
historical context is needed.
</canonical_refs>
