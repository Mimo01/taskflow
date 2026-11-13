# Quick 261113-cth: Issue detail redesign (sticky title header + sticky section headers) - Research

**Researched:** 2026-11-13
**Domain:** React 19 / Tailwind v4 layout refactor (position: sticky, IntersectionObserver, Base UI Menu)
**Confidence:** HIGH (everything below was read from the codebase; no new packages)

<user_constraints>
## User Constraints (from CONTEXT.md)

The decisions in 261113-cth-CONTEXT.md are LOCKED and summarised here. CONTEXT.md is the source of truth:
- Full page: one full-width header above the two-column split, outside both scrollers. The breadcrumb bar stays above it.
- Actions: Refresh, Pin and Edit become outline `icon-sm` buttons. Log work keeps its label. A ⋯ menu holds Clone and Copy Jira link. Open in Jira keeps its label (icon-only only at very narrow peek widths). All buttons are outline and h-7. Keep every existing aria-label and title.
- Shrink on scroll: the big title stays in the content (text-2xl on the page, text-xl in peek). The header height is FIXED. The compact `KEY  title…` fades in once the in-content title has scrolled out of view (IntersectionObserver rooted at the content scroller).
- Peek: the same header component replaces the 40px peek bar, with Open full page + Close at the far right. Keep the subtask parent link. Close must never be pushed off screen.
- Section headers: `sticky top-0` on SectionHeader inside its own section, opaque background, z-20.
- Discretion: component naming, type icon, the ⋯ menu (use components/ui/dropdown-menu), and the header loading state.
</user_constraints>

## Summary

The cleanest seam is to have **IssueDetailView render the header in every state** (loading, unavailable, loaded), add a `headerTrailing?: ReactNode` slot for the peek's Open full page and Close, and wrap the body in `flex flex-col` + header (`shrink-0`) + the existing scroller(s) (`flex-1 min-h-0`). IssueDetailView already owns the issue query, `handleRefresh`/`refreshing`, pin state, `onEdit`/`onClone`, and the scroller DOM. Doing it this way lets PeekPanel drop its own header and its duplicate `jira-issue-detail` useQuery.

Section headers stick with no top offset, because the title header sits *outside* the scroller. Every content-section SectionHeader is already a direct child of its own `<section>`, and no overflow element sits between it and the scroller. Two things need extra work. First, a sticky header inside a padded wrapper leaves 24px/16px side gutters where text scrolls past, so it needs to bleed out. Second, the peek's surface is `bg-card`, not `bg-background`, and in dark mode they differ (oklch 0.205 vs 0.145).

**Primary recommendation:** Build a new `issue-detail/IssueDetailHeader.tsx` (presentational, `@container`). Move the action-row logic into it (copy-link state, edit/clone value builders as pure helpers, LogWork success invalidation). Add a `sticky` behaviour to SectionHeader driven by CSS vars set on the scroller (`--detail-px`, `--detail-surface`). Add a small `useScrolledPast(rootEl, targetEl)` hook with a `typeof IntersectionObserver === 'undefined'` guard.

## Architectural Responsibility Map

| Capability | Owner | Notes |
|---|---|---|
| Header (key/title/actions) | `IssueDetailView` → new `IssueDetailHeader` | View has issue, refresh, pin, edit/clone callbacks |
| Peek chrome (Open full page, Close, Escape) | `PeekPanel` via `headerTrailing` | Escape hotkey stays in PeekPanel |
| Breadcrumb | `IssueDetailPage` (unchanged) | Sits above IssueDetailView |
| Compact-title trigger | hook in IssueDetailView (root = content scroller) | two-column: left column; single-column: whole scroller |
| Sticky sections | `SectionHeader` (prop) + scroller CSS vars | |

## Findings

### 1. Section header inventory (sticky containing block check)

| Section | File:line | Wrapper | Sticky-ready? |
|---|---|---|---|
| Description | IssueDetailContent.tsx:261-262 | `<section>` | yes |
| Attachments | AttachmentsSection.tsx:133-140 | `<section>` (drop target) | yes. Tile action overlay is `absolute z-10` (AttachmentTile.tsx:208), so the header needs z-20 |
| Progress (epic) | EpicProgressSection.tsx:362-364 | `<section class="border-t border-b py-5 my-6 space-y-5">`, header `mb-0` | yes. Header sticks at the top while the charts scroll |
| Stories | IssueDetailContent.tsx:290-291 | `<section>` | yes |
| Subtasks | IssueDetailContent.tsx:323-327 | `<section>` | yes |
| Parent | IssueDetailContent.tsx:367-368 | `<section>` | yes (short section; it gets pushed out almost at once, which is fine) |
| Activity | ActivityTimeline.tsx:151-152 | `<section class="mt-6 ... pb-4">` inside `activitySectionNode` `div.px-6/px-4` | yes. The comment composer is a *sibling after* the section (IssueDetailView.tsx:646-656), so the sticky header releases before the composer area. The skeleton branch (ActivityTimeline.tsx:117-125) has no header |
| AIO Test Runs | AioTestRunsSection.tsx:715-719 | `<section>` with a **bespoke `div.text-sm.font-semibold` + FlaskConical**, not SectionHeader | **Convert to SectionHeader title="AIO test runs"** so it looks the same and sticks. Its tests assert only `data-testid="aio-test-runs-section"` and body text, never the heading text. Leave the inner `AioAttachmentsGrid` toggle (line 166-176) non-sticky |
| Linked issues / Merge requests (peek only) | LinkedIssuesSection.tsx:32-33, MergeRequestsSection.tsx:26-27 | `<section>` + uppercase `<p>` label, **not SectionHeader** | Not sticky today. They are shared with the two-column sidebar, so converting them changes the sidebar too. Recommend leaving them as is (CONTEXT says "where they use SectionHeader") and listing it as a follow-up |
| Sidebar sections (FieldsSection etc.) | IssueDetailSidebar | no SectionHeader | out of scope |

Ancestor chain check. Two-column: scroller `div.flex-1.overflow-auto` (IssueDetailView.tsx:700) > `div.p-6` > `div.space-y-6` > `section` > header, with no overflow ancestors. Single-column: scroller `div.flex.flex-col.h-full.overflow-auto` (:728) > `div.px-4.py-4.space-y-4` > content > section. PeekPanel's `flex-1 overflow-hidden` (:186) is *outside* the scroller, so it doesn't matter.

### 2. Layout restructure

- **Two-column today:** `IssueDetailPage` `flex-col h-full overflow-hidden` > [breadcrumb] > IssueDetailView root `flex flex-1 overflow-hidden` (row). **New:** the root becomes `flex flex-1 min-h-0 flex-col`, then `<IssueDetailHeader/>` (shrink-0, border-b), then a row `flex flex-1 min-h-0 overflow-hidden` holding the left scroller and the sidebar. `containerRef` (used by useResizable) should stay on the row.
- **Single-column today:** the root is itself the scroller. **New:** root `flex h-full flex-col`, then the header, then a scroller `relative flex-1 min-h-0 overflow-auto` (add `relative` per the sr-only over-scroll memory).
- **Early returns:** `IssueDetailSkeleton` and `IssueUnavailable` (IssueDetailView.tsx:681-693) return before any layout. They must be wrapped so the header (at least key + `headerTrailing`) renders during load. This is what keeps Close usable, which the PeekPanel comment requires. Show the issue actions only when `issue` is loaded, because Edit/Clone/LogWork need it and IssueUnavailable has its own Open in Jira/Copy.
- **Peek title position (OPEN):** in single-column the sidebar fields block renders *before* IssueDetailContent (:730), so the in-content title sits below the fields. CONTEXT wants the big title to be the first thing in the scroll content. Recommend extracting the title block (`<p key> + <h2>`, IssueDetailContent.tsx:254-257) into a small `IssueTitleBlock` that IssueDetailView renders at the top of the scroller in both layouts. IssueDetailContent then loses `titleClassName`, and its test at :170-186 moves to the new component.
- **Peek parent link:** move it from PeekPanel.tsx:144-161 into the header's left side (shown for subtasks; `issue.fields.parent` is available in the view). Keep `aria-label="Open parent issue KEY"`. Note that the Parent *section* row uses the same label (IssueDetailContent.tsx:376), and IssueDetailContent.test.tsx:214 does `getByLabelText('Open parent issue PROJ-0')`. That test renders only Content, so it is safe, but the `getBy` will fail on any View-level test that renders both. To avoid a clash, show the header parent link only while compact, or only in peek (as today: the page never had it).

### 3. Moving the action row (IssueDetailContent.tsx:384-506)

What moves with it:
- `copiedLink` state + timer + `handleCopyJiraLink` (:178-202).
- `handleLogWorkSuccess` invalidates `['jira-issue-detail', issueKey, jiraBaseUrlFromStore]` (:215-219). The worklogs key is invalidated inside LogWorkPopover.
- Edit builder (:416-433) and Clone builder (:440-455). Extract them as pure functions `buildEditInitialValues(issue, storyPointsFieldKey, epicLinkFieldKey)` / `buildCloneInitialValues(...)` so they can be unit-tested. Clone uses `crypto.randomUUID()`.
- `onRefresh`/`refreshing` already come from the View (IssueDetailView.tsx:315-322). Remove the `onRefresh`, `refreshing`, `isPinned`, `onTogglePin`, `onEdit`, `onClone` props from IssueDetailContent. `COMPACT_ACTION_CLASS`/`COMPACT_LABEL_CLASS` (:510-512) move too.

Labels to keep: Refresh `aria-label/title="Refresh issue"`; Pin `aria-label={isPinned ? 'Unpin issue KEY' : 'Pin issue KEY'}`, `title 'Pin to tabs'/'Unpin from tabs'`. For Edit, add `aria-label="Edit issue"`: today its accessible name is the text "Edit", and an icon-only button would lose it. Clone `aria-label/title "Clone issue"`, Copy `aria-label "Copy Jira link"`, Open in Jira wrapped in `LinkContextMenu`. LogWorkPopover trigger props (LogWorkPopover.tsx:27-54, 122-132): `triggerLabel` (default "Log Work"), `triggerClassName`, `triggerLabelClassName`. The trigger is `buttonVariants({variant:'outline', size:'sm'})` (h-7), title = label, Clock icon. So collapsing to an icon is just passing the container-query classes.

Tests to update:
- `src/routes/dashboard/IssueDetailContent.test.tsx`: refresh-button block :128-167 (Refresh/Pin order, spin/disable, absent without onRefresh) moves to a new `IssueDetailHeader.test.tsx`. The title test :170-186 moves if the title is extracted.
- `src/components/app/PeekPanel.test.tsx`: mocks IssueDetailView (:17-24) and react-query (:32). PEEK-04 `getByText('PROJ-1')` and PEEK-06/07 ("Open full page", "Close preview") currently hit PeekPanel's own header. After the move, the mock must render `headerTrailing` (and the key, or assert `data-issue-key`). Drop the react-query, stronghold and jira mocks if the duplicate query is removed.
- `src/routes/dashboard/IssueDetailPage.progressive.test.tsx`: :404/:407 `getByText('Test issue title')` and `getByText(ISSUE_KEY)` will throw "multiple elements" if the header *always* shows key/title. :547-554 already scopes "Edit" within the comment menu, so it is safe once header Edit is `aria-label="Edit issue"`.
- `IssueDetailSheet.test.tsx`, `EpicDetailSheet.test.tsx`: getByText on subtask/story keys and summaries, which don't duplicate. Re-run them anyway.
- `issue-detail/AioTestRunsSection.test.tsx`: only safe if the heading text isn't asserted (it isn't).

**Rule that avoids most breakage:** render the compact key+title in the header *conditionally* (mount only while scrolled past, or while `!issue` in the loading state). It should not always be in the DOM with opacity-0. jsdom has no IntersectionObserver, so tests never see the duplicate. Fade it in with `animate-in fade-in-0` (tw-animate-css is imported in index.css:3). The header height stays fixed because the bar is `h-11`/`h-12` either way.

### 4. Primitives

- `components/ui/dropdown-menu.tsx`: Base UI `Menu` (@base-ui/react installed 1.3.0) [VERIFIED: node_modules]. The trigger uses the `render` prop: `<DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="More actions" />}>` (pattern at release-detail/NotCoveredFixActions.tsx:63-76). Content is portaled with z-50, so it is safe inside `isolate` main. `DropdownMenuItem` = `Menu.Item`, which supports `closeOnClick` [VERIFIED: MenuItem.d.ts:43]. For "Copy Jira link", either keep `closeOnClick={false}` and swap the label to "Copied" for 2s, or close and flash a check on the ⋯ trigger. The first is simpler. Tests open the menu with `fireEvent.click(trigger)` and then `findAllByRole('menuitem')` (DeploymentPackageSection.test.tsx:318-319). Give the items `aria-label="Clone issue"` / `"Copy Jira link"`.
- `components/ui/tooltip.tsx`: `Tooltip/TooltipTrigger/TooltipContent` (Base UI, portaled z-50). The current buttons use native `title=`. Keep `title` for the icon buttons (it costs nothing and matches the existing tests). Use a `title` on the compact truncated title for the full text.
- Button sizes: `sm` = h-7, `icon-sm` = size-7, `icon` = size-8 (PeekPanel Close is `icon`, so switch it to `icon-sm` to match).

### 5. Scrolled-past detection

- No IntersectionObserver polyfill or mock exists anywhere in `src/` or `src/test/setup.ts` (that file mocks only ResizeObserver, plugin-store, crypto and scrollIntoView). Guard in the hook: `if (typeof IntersectionObserver === 'undefined' || !root || !target) return;`. Unit-test the hook with `vi.stubGlobal('IntersectionObserver', FakeIO)`. Do not add a global mock in setup.ts, because that would change every existing test.
- Logic: `scrolledPast = !e.isIntersecting && e.boundingClientRect.bottom <= (e.rootBounds?.top ?? 0)`. This shows the compact title only when the title is *above* the viewport, not when it is below the fold. Use `threshold: 0`, and observe the `<h2>` (or a sentinel just after it).
- Pass root and target as **state-backed callback refs** (`useState<HTMLElement|null>` + `ref={setEl}`) so the effect re-runs when the scroller remounts (loading → loaded, issueKey swap in peek). Reset to `false` on issueKey change. React Compiler is active in the app but not in vitest, so keep everything in hooks/state with no module-level mutable reads.

### 6. z-index / stacking

- SectionHeader sticky: `sticky top-0 z-20` + opaque surface. Positioned elements later in the DOM (CachedAvatar `relative` in rows, AttachmentTile `z-10` overlay) would otherwise paint over it. RelatedIssueRow itself has no z-10 today. The release-table precedent is z-20.
- Comment card menu `fixed z-50` and WorklogEntry menu `absolute z-50` sit above z-20, which is fine. The sticky-bottom composer has no z-index and is lower in the DOM. Add `z-20` to it too so stuck headers and the composer never interleave oddly.
- The sidebar resize handle (`z-20`, :716) lives in the sidebar scroller. The new header is outside both scrollers, so they don't conflict.
- Peek's own drag handle is `absolute z-10` on the PeekPanel root (:130). The header is a flow child, so the handle still overlays the left 4px. That is fine.

### 7. Sticky pitfalls specific to this layout

1. **Gutter bleed.** The stuck header is only content-box wide (inside `p-6`/`px-4`), so text shows in the side gutters. Set `[--detail-px:1.5rem]` on the two-column left scroller and `[--detail-px:1rem]` on the single-column scroller. Sticky SectionHeader: `mx-[calc(var(--detail-px)*-1)] px-(--detail-px)`. `px-(--var)` syntax is already used in card.tsx:28. Use calc for the negative margin rather than relying on `-mx-(--var)` [ASSUMED unsupported]. Fallback to 0 outside the detail view (e.g. `var(--detail-px,0px)`), since the SectionHeader prop is opt-in.
2. **Surface colour.** Peek root is `bg-card` (PeekPanel.tsx:126). Dark `--card` 0.205 ≠ `--background` 0.145 (index.css:227-229). Use `bg-(--detail-surface)`, with `[--detail-surface:var(--background)]` on the page and `var(--card)` in peek. The same applies to the IssueDetailHeader bg. Note that the existing composer `bg-background` is already mismatched in dark peek, so fix it with the same variable.
3. **space-y / density.** Tailwind v4 `space-y-*` puts `margin-block-end` on non-last children via `:where()`. It never targets the header's own `mb-2`, and margins don't affect sticky. The density variants (index.css:10) change only spacing, and SectionHeader is a fixed `h-7`, so the stuck height is the same at every density. EpicProgressSection's `space-y-5` + header `mb-0` is fine.
4. **Sticky only within its section.** Short sections (Parent, empty Subtasks) stick briefly and get pushed out. That is expected. Don't wrap SectionHeader in an extra div, because that makes the div the containing block and the header stops sticking.
5. **Container-query collapse** in the header: reuse the `w-7 px-0 @[Npx]:w-auto` + `sr-only @[Npx]:not-sr-only` pattern, and add `@[Npx]:whitespace-nowrap`, because `not-sr-only` resets white-space (memory: not-sr-only undoes truncate). Peek min width is 360px (PeekPanel.tsx:63). Fully labelled actions + "Open full page" + Close need about 440px, so in peek collapse Log work, Jira and Open full page to icons below about 520px. Keep `aria-label="Open full page"` so `getByRole('button', {name:/open full page/i})` still passes. Put the right cluster in `shrink-0` and the left cluster in `min-w-0 flex-1` with `truncate pr-0.5` on the title (italic clip memory).

## Don't Hand-Roll

| Problem | Use |
|---|---|
| Overflow menu | `components/ui/dropdown-menu.tsx` (Base UI Menu, portaled) |
| Tooltips | native `title` (existing convention) or `components/ui/tooltip.tsx` |
| Scroll position tracking | IntersectionObserver, not `onScroll` + getBoundingClientRect |
| Open in Jira context menu | existing `LinkContextMenu` wrapper |

## Package Legitimacy Audit

No new packages. The phase uses only installed dependencies (@base-ui/react 1.3.0, tw-animate-css, lucide-react).

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | Tailwind v4 negative `-mx-(--var)` is not reliable, so use `mx-[calc(var(--detail-px)*-1)]` | None. calc works either way |
| A2 | About 440px is needed for fully labelled peek actions (estimated from button widths, not measured) | Breakpoint tuning; verify with a screenshot |

## Open Questions

1. **Peek title order.** Should the big title move above the sidebar fields block in peek? Recommendation: yes, via an extracted `IssueTitleBlock`. Otherwise the title is below the fold, the compact title shows immediately, and the "large at top" behaviour never appears in peek.
2. **Linked issues / Merge requests in peek** use an uppercase `<p>` label, not SectionHeader, so they won't stick. Converting them changes the two-column sidebar look as well. Recommendation: leave them for now and mention it at UAT.

## Validation Architecture

| Property | Value |
|---|---|
| Framework | vitest 4 + jsdom + Testing Library (`taskflow/taskflow/vitest.config.ts`, setup `src/test/setup.ts`) |
| Quick run | `cd taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail/IssueDetailHeader.test.tsx src/components/app/PeekPanel.test.tsx src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/IssueDetailPage.progressive.test.tsx src/routes/dashboard/IssueDetailSheet.test.tsx src/routes/dashboard/EpicDetailSheet.test.tsx src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx` |
| Full suite | `npx vitest run` (also run by pre-commit with biome + tsc, so RED and GREEN go in one commit) |

New tests needed:
- `IssueDetailHeader.test.tsx`: Refresh before Pin + spin/disable, Pin/Unpin labels, Edit calls `onEdit` with built values, ⋯ menu → Clone/Copy menuitems, `headerTrailing` rendered, compact title absent by default.
- `useScrolledPast` test with a stubbed IO: above → true, below the fold → false, no IO → false.
- Pure `buildEditInitialValues`/`buildCloneInitialValues`.
- `SectionHeader` with `sticky` gets the `sticky top-0 z-20` classes.

Manual check (jsdom has no layout): screenshot the page and the peek at 360/480/720px, scrolled to the top and mid-Subtasks/Activity, in light and dark mode. Confirm no gutter bleed, no colour band in peek, Close visible, and no header height jump.

## Security Domain

No new trust boundaries. The only existing external action is `openExternal` of the Jira browse URL, which is unchanged. N/A beyond that.

## Sources

- Codebase (HIGH): IssueDetailView.tsx, IssueDetailContent.tsx, IssueDetailPage.tsx, PeekPanel.tsx, SectionHeader.tsx, AttachmentsSection.tsx, EpicProgressSection.tsx, ActivityTimeline.tsx, AioTestRunsSection.tsx, LinkedIssuesSection.tsx, MergeRequestsSection.tsx, LogWorkPopover.tsx, components/ui/{dropdown-menu,tooltip,button,popover}.tsx, src/test/setup.ts, index.css, the listed test files.
- node_modules/@base-ui/react 1.3.0 `menu/item/MenuItem.d.ts` (closeOnClick).
- Project memory: sr-only scroller needs relative, not-sr-only undoes truncate, italic truncate clip, sticky header vs row z-10, match the local button row, React Compiler module reads.

**Valid until:** 2026-12-13
