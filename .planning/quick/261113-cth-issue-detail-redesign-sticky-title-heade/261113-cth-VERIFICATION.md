---
phase: quick-261113-cth
verified: 2026-11-13T09:45:00Z
status: human_needed
score: 7/7 must-haves verified in code (visual behaviour awaits UAT)
human_verification:
  - test: "Page /issue/KEY scroll behaviour: header spans content + sidebar, compact 'KEY title' fades in with no height jump, section headers stick opaque edge-to-edge, composer still sticks at bottom"
    expected: "As described in plan Task 3 steps 1-3"
    why_human: "Sticky/IntersectionObserver/z-order/gutter bleed are rendered behaviour; jsdom has no IO or layout"
  - test: "Peek at 360 / ~480 / ~720px, light and dark"
    expected: "Close always visible; Log work / Open in Jira / Open full page collapse to icons below 520px; header and stuck section headers match the card surface"
    why_human: "Container-query collapse and colour matching are visual"
  - test: "Epic Progress header and AIO test runs header stick; Clone / Copy link / Edit / Log work / Refresh / Pin work in the real app; Close works while the peek is loading"
    expected: "Plan Task 3 steps 4, 5, 8"
    why_human: "Needs the running app"
  - test: "Linked issues / Merge requests labels in peek"
    expected: "Not sticky (locked out of scope); user to confirm acceptable"
    why_human: "Design decision flagged at UAT"
---

# Quick 261113-cth: Issue detail sticky header - Verification

**Goal:** Sticky title header (key + title) with main actions on the right in page and peek, and sticky section headers.
**Status:** human_needed (code checks pass; Task 3 UAT visual items pending)

## Must-have truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | One full-width header above content and sidebar, outside both scrollers | VERIFIED | `IssueDetailView.tsx` two-column: root flex-col, `{headerNode}` then a row containing the left scroller and sidebar |
| 2 | Actions on right (Refresh, Pin, Edit, Log work, Open in Jira, a more-actions menu with Clone + Copy Jira link); old bottom row gone | VERIFIED | `IssueDetailHeader.tsx` has all of them, in that order; `grep -c "Refresh issue\|Copy Jira link\|Clone issue" IssueDetailContent.tsx` returns 0 |
| 3 | Big title first in scroll content in both layouts; compact "KEY title" in header once scrolled past; fixed height | VERIFIED (code) | `IssueTitleBlock` is the first child of both scrollers; `useScrolledPast(scrollEl, titleEl, issueKey)` drives `compact`; header is `h-12`, the compact group is mounted into the same row, with `title={summary}` |
| 4 | Peek uses the same header, Open full page + Close at far right, parent link kept, Close not pushed off | VERIFIED (code) | `PeekPanel.tsx` passes `headerTrailing` (Open full page + Close preview); header renders the parent link with `aria-label="Open parent issue KEY"`; `shrink-0` right cluster and 520px container-query collapse. Old 40px bar removed |
| 5 | Section headers (Description, Attachments, Progress, Stories, Subtasks, Parent, Activity, AIO test runs) stick, opaque, no gutter bleed, above overlays | VERIFIED (code) | `SectionHeader` default has `sticky top-0 z-20 bg-(--detail-surface,...)` plus negative margin and padding from `--detail-px`. Every call site is a direct child of its `<section>`. Scrollers set `--detail-px`, and the root sets `--detail-surface`. `AioTestRunsSection` now uses `SectionHeader` |
| 6 | Header shows key + trailing controls while loading or unavailable | VERIFIED | `IssueDetailView` `!issue` branch renders `{headerNode}`; the header shows the key and `headerTrailing` when there is no issue |
| 7 | aria-labels preserved; Edit gains "Edit issue" | VERIFIED | All labels present in `IssueDetailHeader.tsx` and `PeekPanel.tsx` |

## Behavioural checks

- `npx vitest run` on issue-detail/, PeekPanel, IssueDetailContent, IssueDetailPage.progressive and useScrolledPast: 32 files, 463 passed, 2 skipped.
- `npx tsc --noEmit`: clean.

## Anti-patterns

No TODO, FIXME or XXX markers in the touched files. The composer correctly uses `bg-(--detail-surface)` and `z-20`.

## Notes and warnings (non-blocking)

- Locked out of scope: LinkedIssuesSection and MergeRequestsSection in peek are not sticky.
- `PeekPanel` hands the header's `@container` the width of the whole header bar; collapse thresholds are untested outside jsdom.
- Task 3 (the human UAT checkpoint) has not been approved. SUMMARY.md is still untracked in git.

## Gaps

None found in code. All remaining items are visual and need the running app.
