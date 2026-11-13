---
phase: quick-261113-cth
plan: 01
status: checkpoint-pending
tags: [issue-detail, sticky-header, peek]
key-files:
  created:
    - taskflow/src/routes/dashboard/issue-detail/IssueDetailHeader.tsx
    - taskflow/src/routes/dashboard/issue-detail/IssueTitleBlock.tsx
    - taskflow/src/routes/dashboard/issue-detail/issue-actions.ts
    - taskflow/src/hooks/useScrolledPast.ts
  modified:
    - taskflow/src/routes/dashboard/issue-detail/SectionHeader.tsx
    - taskflow/src/routes/dashboard/IssueDetailView.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/IssueDetailSheet.tsx
    - taskflow/src/components/app/PeekPanel.tsx
    - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx
commits:
  - f03a271c feat(261113-cth): issue detail header building blocks
  - 6e5e2507 feat(261113-cth): sticky issue detail header + sticky sections
---

# Quick 261113-cth: Issue detail redesign (sticky header + sticky sections) Summary

Shared fixed-height `IssueDetailHeader` (key / compact title left, actions right) for the full page and the peek, big title as first scroll content with IntersectionObserver shrink-on-scroll, and sticky-by-default section headers. Tasks 1-2 done and committed; Task 3 (UAT in the real app) is pending the user.

## What was built

- `SectionHeader`: sticky by default (`sticky top-0 z-20`, `--detail-surface` / `--detail-px` gutter bleed), `sticky={false}` opts out.
- `useScrolledPast(root, target, resetKey)`: true only when the target is above the root top; starts false and resets on root/target/resetKey change, so a title mounting after the skeleton cannot flash compact state. False without IntersectionObserver.
- `issue-actions.ts`: Edit/Clone initial-value builders moved out of IssueDetailContent.
- `IssueTitleBlock`: key + big title (text-2xl page, text-xl peek), observed by the hook.
- `IssueDetailHeader`: h-12, `@container`; Refresh, Pin, Edit, Log work, Open in Jira, a more-actions menu (Clone, Copy Jira link), plus `headerTrailing`. Peek collapses Log work / Open in Jira / Open full page to icons below 520px.
- `IssueDetailView`: header above content and sidebar (outside both scrollers) in loading, unavailable and loaded states; title block first in both scrollers; composer uses the surface var and z-20.
- `IssueDetailContent`: title block, bottom action row, copy-link state and unused props removed.
- `PeekPanel`: old header bar and duplicate issue query removed; Open full page + Close passed as `headerTrailing`.
- `AioTestRunsSection`: heading is now a `SectionHeader` ("AIO test runs").

## Checker warnings

1. Task 2 kept to the plan; no opportunistic refactors.
2. Verified by grep/read that every sticky `SectionHeader` (Description, Stories, Subtasks, Parent in IssueDetailContent; Progress in EpicProgressSection; Attachments; Activity; AIO test runs) is the direct first child of its own `<section>`. None share a wrapper.
3. useScrolledPast initialises false, resets to false whenever root/target/key change, and decides only from observer entries.

## Deviations

- Tests relocated, not dropped: refresh-button and title tests moved from IssueDetailContent.test to IssueDetailHeader.test; the ISSUE-09 Open in Jira deep-link test moved from IssueDetailSheet.test to IssueDetailHeader.test (the sheet no longer renders actions). PeekPanel.test: the IssueDetailView mock now renders `issueKey` and `headerTrailing`, and the react-query/store mocks that only served the removed query were dropped. No production code was bent for mocks.
- `IssueDetailSheet` (legacy, test-only): destructuring of `onEdit` / `isPinned` / `onTogglePin` dropped (props type unchanged), and it renders `IssueTitleBlock` above the content.
- Open in Jira is now a standalone outline button (the old joined segmented control with the copy icon is gone; copy lives in the menu), as the plan specified.

## Decisions (planner discretion, as in plan)

Sticky is the default on SectionHeader; header left is empty at scroll top except the peek parent link; LinkedIssues / MergeRequests labels in peek stay non-sticky (flag at UAT).

## Verification

Full vitest suite (5221 tests) passes via the pre-commit hook on both commits; tsc clean; biome clean on touched files (one pre-existing info in IssueDetailContent.tsx).

## Pending: Task 3 UAT (checkpoint:human-verify)

Run `npm run tauri dev` from the taskflow app dir, then check:

1. Story with description, attachments, subtasks, activity at /issue/KEY: header spans content + sidebar under the breadcrumb bar; at top the big text-2xl title is in content, header left empty, actions right (Refresh, Pin, Edit, Log work, Open in Jira, menu).
2. Scroll: once the title leaves view, `KEY  title...` fades into the header; header height does not jump; hover shows the full title.
3. Keep scrolling: Description / Attachments / Subtasks / Activity headers stick under the header, opaque edge-to-edge, tile overlays and avatars pass beneath them, each pushed out at the end of its section; the comment composer still sticks at the bottom.
4. Menu: Clone opens the clone modal; Copy Jira link shows "Copied". Edit opens the edit modal; Log work works; Refresh spins; Pin toggles.
5. Epic: Progress header sticks over the charts. Issue with AIO test runs: "AIO test runs" header matches and sticks.
6. Peek a subtask: one header with parent link, actions, Open full page, Close; big text-xl title first; scroll shows compact title. Resize 360 / ~480 / ~720px: no overflow, Close always visible, Log work / Jira / Open full page collapse to icons below ~520px.
7. Light and dark mode in the peek: header and stuck headers match the peek surface.
8. While an issue loads in the peek, Close still works.

Known and intentional: Linked issues / Merge requests labels in peek do not stick.

## UAT round 1 (2026-11-13)

- Feedback: on smaller screens every button should collapse to an icon; Open in Jira keeps Copy link beside it; remove the ⋯ menu and list every button.
- Fix `fdb80566`: Refresh, Pin, Edit, Log work, Clone and Open in Jira are labelled outline buttons. Below an 860px header they collapse to square icons, with an sr-only label and a tooltip. Copy Jira link is joined to Open in Jira as a segmented control. The overflow menu is removed. Peek's Open full page uses the same 860px breakpoint.

## UAT round 2 (2026-11-13)

- Feedback: on smaller screens, move the less useful buttons into a ⋯ menu. The peek's Open full page should always show its text. The header shouldn't be empty before scrolling.
- Fix `4ceaf66c`:
  - The header always shows the type icon and the key. Subtasks get a parent breadcrumb on both the page and the peek. The title joins the key once you scroll past it. The key moved out of IssueTitleBlock, which keeps an optional `issueKey` for the header-less IssueDetailSheet.
  - Below an 860px header, Refresh, Pin and Clone move into a ⋯ menu. Edit, Log work and Open in Jira + Copy link stay as icon buttons. Above 860px, every action is inline and labelled.
  - The peek's Open full page button always shows its label.

## UAT round 3 (2026-11-13)

- Feedback: make the buttons nicer. The header shouldn't be empty before scrolling; it should look the same at every scroll position.
- Decisions, picked from option previews: the title is clamped to 2 lines in the header, and the actions use a quiet toolbar.
- Fix `0fdd73f5`:
  - The header has a meta row (parent › type icon + key, then the actions) over the title (2-line clamp, with the full summary as tooltip). It looks the same at every scroll position.
  - The big in-content title is removed from the page and the peek, and `useScrolledPast` is deleted. IssueTitleBlock stays for the header-less IssueDetailSheet.
  - Toolbar: Refresh, Pin, Edit, Clone | Open in Jira + Copy link are ghost buttons in one rounded `bg-muted/60` group. Log work is the single filled accent. Below 860px: Edit, Jira and Copy show as icons, Refresh, Pin and Clone move into ⋯, and Log work becomes an icon.
  - LogWorkPopover gains a `triggerVariant` prop.

## UAT round 4 (2026-11-13)

- Feedback: make Open in Jira + Copy link the primary action instead of Log work. Make the title larger, as it was before. Tighten the spacing.
- Fix:
  - Open in Jira + Copy link is now the filled accent pair. Log work is a ghost tool in the toolbar.
  - The title is back to text-2xl on the page and text-xl in the peek.
  - Spacing: h-7 meta row, mt-1.5 title, pt-3/pb-4 on the page, pt-2.5/pb-3 in the peek.

## UAT round 5 (2026-11-13)

- Feedback: the header is too large. It may shrink on scroll.
- Fix `9f7a909d`: the title is now text-xl on the page and text-lg in the peek, with less padding.
- Fix (this commit): the header condenses on scroll but keeps the same content. The title drops to one line at text-base on the page and text-sm in the peek, and the padding tightens. Hysteresis: it condenses past 16px of scroll and expands again at 4px or less. It resets when the peek swaps issues.

## UAT round 6 (2026-11-13)

- Feedback: polish more, and compact further on scroll.
- Fix: when scrolled, the title moves inline next to the key (truncated, text-base on the page and text-sm in the peek, with a fade and slide-in). The header becomes a single py-1.5 row of about 40px. At the top, the title still sits below the key row on up to 2 lines.
