# Quick Task 261113-jpg: Match the issue-detail header across detail pages - Context

**Gathered:** 2026-11-13
**Status:** Ready for planning

<domain>
## Task Boundary

The issue detail header was redesigned and approved in quick 261113-cth
(`taskflow/src/routes/dashboard/issue-detail/IssueDetailHeader.tsx`, see
`.planning/quick/261113-cth-issue-detail-redesign-sticky-title-heade/*SUMMARY.md` for the 12 UAT
rounds that shaped it). Apply the same visual to every other detail page: Release detail,
Merge request detail, AIO cycle detail, AIO test run detail.

</domain>

<audit>
## Audit findings (orchestrator, 2026-11-13)

Reference (issue detail): one `border-b` bar, `px-6 py-3` (peek px-4 py-2.5), outside the scroller
(stays put, spans content + sidebar); meta row `h-7`: ← back + trail as text-xs muted crumbs
(`/` separators, `…` menu below 1200px) → type icon + mono text-xs key; right: quiet toolbar group
(`bg-muted/60 rounded-lg p-0.5`, h-6 ghost tools, text-xs) + ONE filled primary pair
(Open in Jira + Copy link, segmented); title `<h2>` text-xl font-medium line-clamp-2 below (-mt-1);
condenses on scroll (hysteresis 16px/4px) to one row with the title inline (250ms staged crossfade);
⋯ menu holds secondary tools below 860px header width, everything below 720px (ResizeObserver).

Inconsistencies found:
1. All four pages render a separate, hand-copied breadcrumb bar (`px-6 py-3 border-b text-sm`,
   `h-7 w-7 rounded` back, aria-label "Back" vs "Go back", truncation only on release) — ~53px extra.
   Files: `release-detail/ReleaseHeader.tsx` (ReleaseBreadcrumbHeader), `MergeRequestDetailPage.tsx:172-200`,
   `AioCycleDetailPage.tsx:138-171`, `AioTestRunDetailPage.tsx:182-227`.
2. Titles are `text-2xl font-semibold` single-line truncate (issue: text-xl font-medium, 2-line clamp).
3. Key comes after the title (cycle, run) or above it (MR `!iid`); issue puts key before title in meta row.
4. Actions: bare 12px Refresh icon + loose outline buttons, no toolbar group, no filled primary, no
   Copy link, no ⋯ collapse; "Refreshed: …" text shown (issue has none). Release hides labels at 896px
   via `/page` container; labels "Edit release"/"Pin release" vs issue's "Edit"/"Pin".
5. Release + AIO cycle headers live INSIDE the scroller and scroll away (no sticky, no condense).
   MR header lives inside the LEFT column only (doesn't span the sidebar) and scrolls away.
6. AIO test run: breadcrumb bar + a second title bar (two stacked border-b bars), prev/next run nav.
7. (Not header — deferred) MR section labels are plain h3 ("Commits (12)", "Discussions") rather than
   the shared sticky `SectionHeader`.

</audit>

<decisions>
## Implementation Decisions

### Pages in scope
- All four: Release detail, Merge request detail, AIO cycle detail, AIO test run detail.

### Approach
- Extract a shared, generic detail-header primitive from IssueDetailHeader (nav trail + back,
  identity slot (icon/key), toolbar group, filled primary pair, trailing slot, title with 2-line clamp,
  condense-on-scroll with the same animation, ⋯ collapse at 860/720). IssueDetailHeader is rebuilt on it
  WITHOUT any visible or behavioural change (its tests must keep passing unmodified in intent).
- The four pages compose the primitive. The four hand-rolled breadcrumb bars are deleted.
- Each page's header moves out of the scroller (sticky above it, spanning content + sidebar on MR),
  and condenses when its scroller scrolls (same hysteresis).

### Extra header content (release + AIO cycle)
- User chose: keep it INSIDE the header. Release: date/package meta line, description, property strip;
  AIO cycle: owner/folder/dates/updated/custom fields/last run meta line. Rendered below the title in
  an expanded-only slot that collapses together with the big title on condense (same grid-rows
  1fr→0fr + fade), so the condensed header is still one slim row.

### Primary action + refresh timestamp
- Release: filled "Open in Jira" + Copy link pair (jiraVersionUrl). MR: filled "Open in GitLab" +
  Copy link (mr.web_url). AIO cycle + AIO run: no web URL exists in code → no primary pair, toolbar only.
- "Refreshed: …" text is removed from the row; the time goes into the Refresh tool's tooltip/title.
- Refresh and Pin become toolbar tools (secondary, ⋯ below 860) everywhere; Edit (release) is a primary
  tool (icon below 860) like issue Edit. Labels "Edit" / "Pin"/"Unpin" (match issue wording).

### Claude's Discretion
- Status pill/badge (release pill, MR state badge + draft, cycle status, run status) sits in the meta
  row right after the key (it is identity, not a big-title decoration).
- Identity per page: release = Package-ish icon? — planner picks a small lucide icon + version name is
  the title (no key); MR = GitLab/merge icon + mono `!iid`; cycle = mono cycle key; run = mono test case key.
- AIO run prev/next (‹ 3/12 ›) moves into the header's right side as toolbar tools, never into ⋯.
- Breadcrumb current entry is NOT repeated (the key/identity is the current entry), as in issue detail.
- Trail/back appear only when the breadcrumb trail is non-empty, EXCEPT AIO run keeps its always-present
  "back to owning cycle" crumb (trail may not end at the cycle on direct links/pinned tabs).
- Preserve every existing data-testid / aria-label that tests rely on where sensible; update tests that
  assert on the removed separate breadcrumb bars.

</decisions>

<specifics>
## Specific Ideas

- Follow memory rules: `not-sr-only` needs `whitespace-nowrap`; italic/overhang truncate needs `pr-0.5`;
  sr-only inside overflow-auto scroller needs a `relative` ancestor (release scroller already is);
  container queries never style the container itself.
- Sticky table headers inside release (`--release-sticky-top`) and AIO cycle (`--aio-sticky-top`) are
  offsets within the scroller — moving the header out of the scroller should keep them at the scroller top.
- Peek layout is issue-only; the new pages only need the 'page' layout.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/261113-cth-issue-detail-redesign-sticky-title-heade/` SUMMARY (approved design + UAT history)
- `taskflow/src/routes/dashboard/issue-detail/IssueDetailHeader.tsx` (reference implementation)
- `taskflow/src/routes/dashboard/IssueDetailView.tsx` (scroll → compact wiring, header outside scroller)

</canonical_refs>
