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

## UAT round 7 (2026-11-13)

- Feedback: the compaction jumps; it should animate nicely.
- Fix: both title copies stay mounted. The big title collapses (grid rows 1fr → 0fr plus a fade) while the inline title fades and slides up into the key row, and the padding eases in step (300ms ease-out). The big <h2> stays the only accessible heading, and the inline copy is a decorative aria-hidden span (commit `32c253a9`). IssueDetailPage.progressive tests now query the title by heading role.

## UAT round 8 (2026-11-13): rendered design study

- Feedback: the compact title is maybe too bold, and the full version looks a bit janky. Don't guess: try designs and evaluate them with a subagent.
- Study: a subagent rendered the real component in Playwright WebKit (r2370, the closest to WKWebView) plus Chromium. It covered 6 expanded variants and 4 compact weights, page and peek widths, light and dark, and animation frames. The contact sheets are in the session scratchpad under header-study/.
- Measured causes of the jank:
  - The toolbar group was 32px while every other control was 28px.
  - There was a 2px gap from the toolbar to the title.
  - Top and bottom padding were unbalanced (8 vs 12px).
  - The animation was front-loaded: 85% done by 100ms, with both titles visible at 50ms.
  - Peek 480 subtask: the own key was fully clipped.
- Applied V4 (`7854ef81`):
  - h-6 tools, so the inset group is 28px.
  - py-3 on the page and py-2.5 in the peek, with a 6px title gap.
  - font-medium for the big and compact titles.
  - A staged 250ms crossfade.
  - The parent key can shrink, and the ↳ subtask icon replaces the chevron.
- Open constraint conflict: at a 480px peek, the compact inline title has almost no room (about 17px) while "Open full page" keeps its text. It is fine from about 560px.
- Verification render of the real component at `7854ef81`: 0 differing pixels against the V4 mockup across 24 shots. Controls are 28px with one shared centre, padding is 12/12 on the page and 10/10 in the peek, and the subtask's own key is visible at peek 480. Follow-up `a9410356` shortens the expand fade-in delay from 60ms to 30ms; the faintest expand frame was at an opacity sum of 0.39.

## UAT round 9 (2026-11-13): spacing, breadcrumbs, subtask parent

- Feedback: the full version's spacing is off, with a huge gap between the key and the title. Breadcrumbs add a lot of height. Subtasks show the parent key but not its title. Try alternatives and optimise for different screen sizes.
- Study 2 (WebKit/Chromium renders; contact sheets in the session scratchpad under header-study-2/):
  - Baseline: 21.5px between the key and the title. The separate trail bar was 53px, so with a trail the total was 168/140px.
  - Variants tried: A float stack (title squeezed to 531px), B key prefix (the compact subtask title gets 0px), C merged nav, D = C + tucked title + width tiers (winner), E parent subline (it disappears when compact).
- Applied D (`a08f63b5`):
  - The breadcrumb trail and back button moved into the header's meta row, and IssueDetailPage's separate bar is gone. New `nav` prop (HeaderNav).
  - Key → title gap is 11.5px, and the page header is 105/77px with a trail.
  - Subtask parent: shows its key and its clickable title (from 760px, up to 192px wide, or 320px at 1200px+). If the trail ends at the parent, the parent appears once and clicking it walks the trail back.
  - Trail: shown in full at 1200px+. Narrower, longer trails collapse to a "…" menu.
- Open questions:
  - Should "Open full page" go icon-only in a narrow, compact peek?
  - Should the ⋯ breakpoint move to 1200px so the compact title at page 1100 gets more room?
  - At peek ≤480, the parent shows as its icon only.

## UAT round 10 (2026-11-13): nits

- Feedback: the back button's hover shows as a half circle. The parent key and title should be one link. At the smallest size, only ⋯ should remain so the title gets the room.
- Fix `8e530eec`:
  - The left area widens its clip box (-ml-1.5 pl-1.5).
  - The parent is a single button: icon + key + title.
  - Below a 560px header content width (measured with a ResizeObserver), only ⋯ and Close remain. The menu lists Open in Jira, Copy link, Open full page, Edit, Log work, Refresh, Pin and Clone, and Log work opens anchored to ⋯.
  - Open full page became a header prop (`onOpenFullPage`). LogWorkPopover gained controlled open, anchor and hideTrigger.
- Verified in WebKit renders:
  - The back hover is fully visible (button flush with its clip box at x=18).
  - The parent is one button with an underline across the key and title.
  - At 400–560px only ⋯ and Close show, and the Log work popover is anchored under ⋯.
  - Known cliff: just above the threshold (panel 600–640px), the compact subtask title gets only 41–81px.

## UAT round 11 (2026-11-13)

- Feedback: keep Open full page visible at the smallest peek widths. Open in Jira must never be icon-only, because the icon alone is too hard to read.
- Fix: Open full page is a labelled button at every width and is no longer in ⋯. Open in Jira always shows its label; at the smallest width it lives in ⋯ as a text item.
