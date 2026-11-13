# Quick 261113-jpg: Shared DetailHeader across detail pages - Research

**Researched:** 2026-11-13
**Domain:** In-repo React refactor (header primitive extraction + 4 page migrations). No new packages.
**Confidence:** HIGH (everything below comes from reading the code in this session; file:line cited)

All paths are relative to `taskflow/src/` unless noted. Run npm, vitest and biome from the inner `taskflow/taskflow/`.

<user_constraints>
## User Constraints (from CONTEXT.md, verbatim summary of locked items)

### Locked Decisions
- Pages in scope: Release detail, Merge request detail, AIO cycle detail, AIO test run detail.
- Extract a shared, generic detail-header primitive from IssueDetailHeader (nav trail + back,
  identity slot (icon/key), toolbar group, filled primary pair, trailing slot, title with 2-line clamp,
  condense-on-scroll with the same animation, ⋯ collapse at 860/720). IssueDetailHeader is rebuilt on it
  WITHOUT any visible or behavioural change (its tests must keep passing unmodified in intent).
- The four pages compose the primitive. The four hand-rolled breadcrumb bars are deleted.
- Each page's header moves out of the scroller (sticky above it, spanning content + sidebar on MR),
  and condenses when its scroller scrolls (same hysteresis).
- Extra header content: Release (date/package meta line, description, property strip) and AIO cycle
  (owner/folder/dates/updated/custom fields/last run meta line) stay INSIDE the header, in an
  expanded-only slot that collapses with the big title (same grid-rows 1fr→0fr + fade).
- Primary pair: Release = filled "Open in Jira" + Copy link (jiraVersionUrl). MR = filled "Open in GitLab" +
  Copy link (mr.web_url). AIO cycle + run: no primary pair, toolbar only.
- "Refreshed: …" text removed from the row; time goes into the Refresh tool's tooltip/title.
- Refresh and Pin are secondary toolbar tools (⋯ below 860) everywhere; Edit (release) is a primary tool
  (icon below 860). Labels "Edit" / "Pin"/"Unpin".

### Claude's Discretion
- Status pill/badge sits in the meta row right after the key.
- Identity per page (planner picks icon); MR = merge icon + mono `!iid`; cycle = mono cycle key; run = mono test case key.
- AIO run prev/next (‹ 3/12 ›) moves into the header's right side as toolbar tools, never into ⋯.
- Breadcrumb current entry is NOT repeated.
- Trail/back only when the trail is non-empty, EXCEPT AIO run keeps its always-present "back to owning cycle" crumb.
- Preserve existing data-testids / aria-labels where sensible; update tests that assert on the removed bars.

### Deferred (OUT OF SCOPE)
- MR section labels → shared SectionHeader (audit item 7). Peek layout for the new pages.
</user_constraints>

## Summary

IssueDetailHeader (`routes/dashboard/issue-detail/IssueDetailHeader.tsx`, 613 lines) is already ~80% generic.
The issue-specific parts are: the parent crumb with "parent in trail" trimming (:162-171, :305-327), the
`IssueTypeIcon` + key identity (:329-330), the Log work popover (an anchored popover rather than a plain button,
:417-429, anchored to the ⋯ trigger in tiny mode via `moreTriggerEl` :159/:435), the `buildEdit/CloneInitialValues`
callbacks, the issue-detail invalidation after Log work (:204-208), and the peek `Open full page` button (:568-580).
Everything else (shell, crumbs, ⋯ menu, tiny ResizeObserver, copy-link flash, primary pair, title grid
collapse, inline compact title) moves into the primitive.

The tests pin DOM shape in several places, so the primitive has to reproduce the exact element nesting
(see "DOM invariants"). The biggest test hazard is the shared ResizeObserver mock: it reports 600px
(`test/setup.ts:53-61`), which is below `TINY_WIDTH = 720`. In tiny mode primary tools (Edit) and the primary
pair (Open in Jira / Copy) are **not rendered**, so every page test that clicks "Edit release" / "Open in Jira"
breaks unless it stubs a wide width the way IssueDetailHeader.test does (`stubWidth`, :64-76).

**Primary recommendation:** add `components/ui/detail-header.tsx` (shell + `HeaderTool` / `HeaderMenuItem`
building blocks + a context exposing `tiny`/`moreTriggerEl`) and `hooks/useCompactOnScroll.ts`. Rebuild
IssueDetailHeader on it first and gate on its test file passing unchanged, then migrate the four pages one per task.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Header shell, crumbs, ⋯ collapse, title collapse | Browser (shared UI primitive) | — | Pure presentation, reused by 5 hosts |
| Compact-on-scroll state | Browser (host page hook) | — | Scroller belongs to the page, not the header |
| Tool actions (refresh/pin/edit) | Host page | stores / react-query | Pages own the queries and stores |
| Copy link / open external | Primitive | `lib/openExternal` | Same flash/timer logic on every page |

## Standard Stack

No new dependencies. Reuse: `@/components/ui/button`, `dropdown-menu` (Base UI), `link-context-menu`,
`lib/openExternal`, `lib/utils#cn`, lucide-react icons. Identity icons that match the sidebar
(`components/app/sidebar-items.ts:73,77,87`): Releases = `Rocket`, MRs = `GitMerge`, AIO = `FlaskConical`.

## Package Legitimacy Audit

Not applicable: this task installs no packages.

## 1. Primitive API (proposal)

**Location:** `src/components/ui/detail-header.tsx` (next to `page-header.tsx`, the main-page header primitive)
plus `src/hooks/useCompactOnScroll.ts`. Keep the `HeaderNav`/`HeaderNavEntry` types exported from the
primitive and re-export them from IssueDetailHeader so existing imports (`IssueDetailView.tsx:49`) keep working.

```ts
export interface DetailHeaderProps {
  layout?: 'page' | 'peek';            // px-6/py-3 vs px-4/py-2.5; title text-xl vs text-lg; inline title text-base vs text-sm
  compact?: boolean;
  nav?: HeaderNav;                     // { trail, onBack, onNavigate(index) }; ← + crumbs render iff trail.length > 0
  crumbTail?: ReactNode;               // rendered ONCE after the trail, before identity (issue: parent; AIO run: cycle NavLink)
  identity: ReactNode;                 // icon + mono key + status pill (pages); issue: IssueTypeIcon + key
  ready?: boolean;                     // false while loading: no toolbar, primary, title, inline title (issue: !!issue)
  title?: string;                      // big title (2-line clamp) + inline compact copy + tooltip
  titleAs?: 'h1' | 'h2';               // default 'h2' (issue tests pin level 2); see Tests
  titleTestId?: string;                // AIO run keeps 'aio-run-detail-title'
  extra?: ReactNode;                   // expanded-only slot under the title, same grid collapse (release/cycle meta)
  toolbarLabel?: string;               // role=toolbar aria-label ('Issue actions', 'Release actions', ...)
  tools?: ReactNode;                   // <HeaderTool> children, inline order
  menu?: ReactNode | ((ctx: { tiny: boolean }) => ReactNode); // ⋯ content (below 860 / tiny); omit → no ⋯
  primary?: { href: string; openLabel: string; copyLabel: string; copiedLabel: string; menuCopyLabel?: string };
  trailing?: ReactNode;                // never collapsed; preceded by the h-4 w-px divider when ready
  'data-testid'?: string;              // release keeps 'release-detail-header'
}

// Building blocks (read `tiny` from a DetailHeaderContext the shell provides):
<HeaderTool tier="primary" | "secondary" | "fixed" icon={Pencil} spin? label="Edit"
            aria-label="Edit issue" title="Edit issue" onClick disabled? iconClassName? />
//  primary   → PRIMARY_TOOL_CLASS + LABEL_CLASS span; returns null when tiny (issue :387 `onEdit && !tiny`)
//  secondary → SECONDARY_TOOL_CLASS ('hidden @[860px]:inline-flex'), plain-text label (issue :362-386)
//  fixed     → TOOL_CLASS, always inline at every width (AIO run ‹ n/m ›)
<HeaderMenuItem icon label onClick disabled? closeOnClick? />  // MENU_ITEM_CLASS
<HeaderMenuSeparator />
export const DETAIL_HEADER_CLASSES = { TOOL_CLASS, PRIMARY_TOOL_CLASS, LABEL_CLASS }; // for LogWorkPopover's trigger props
export function useDetailHeader(): { tiny: boolean; moreTriggerEl: HTMLButtonElement | null };
```

The shell owns: ResizeObserver → `tiny` (:146-156), the ⋯ trigger (`ref` → `moreTriggerEl`, `@[860px]:hidden`,
:431-446), the copy-link flash + timer cleanup (:174-199), the primary pair with `LinkContextMenu` (:533-561),
prepending "Open in X / Copy X link + separator" to the menu when tiny (:451-474), the trail rendering
(wide `@[1200px]:contents` every entry; narrow: single entry, or the `…` "Show earlier pages" menu, :239-304),
separators, the inline compact title (:331-350) and the big-title grid (:590-610).

**Stays issue-specific (IssueDetailHeader becomes a thin composer):**
- Parent crumb + `parentInTrail` trimming: compute `crumbs` in IssueDetailHeader and pass
  `nav={{...nav, trail: crumbs}}` + `crumbTail={<parent button/>}`. Indices stay valid because `crumbs` is a
  prefix of `trail`. The separator logic at :307 and :328 becomes generic: separator before `crumbTail` if
  crumbs exist; separator before identity if crumbs or crumbTail exist.
- Log work: rendered inside `tools` as the `LogWorkPopover` with `triggerClassName={PRIMARY_TOOL_CLASS}`,
  `triggerLabelClassName={LABEL_CLASS}`, `hideTrigger={tiny}`, `anchor={tiny ? moreTriggerEl : undefined}`
  read from `useDetailHeader()` (so it must be a child component, not inline in the IssueDetailHeader body).
  The `logWorkOpen` state and `handleLogWorkSuccess` invalidation stay in IssueDetailHeader.
- Menu contents and order (user-chosen, pinned by test :419-447): tiny = Jira pair · Refresh, Pin, Log work ·
  Edit, Clone; non-tiny = Refresh, Pin · Clone. Pass `menu={({tiny}) => …}` so the issue reproduces its exact
  conditionals (:475-527). The primitive only prepends the primary pair group when tiny.
- Menu label wording differs from the inline label ("Pin to tabs" vs "Pin"), so `HeaderMenuItem` takes its own label.
- Peek `Open full page` button (:568-580) → passed as part of `trailing` by IssueDetailHeader.

### DOM invariants the primitive must keep (pinned by IssueDetailHeader.test)
- `toolbar.parentElement.parentElement` is the meta row with `relative z-10 h-7` (test :284-290): row → right group (`flex shrink-0 items-center gap-2`) → `div[role=toolbar]`.
- `h2.parentElement.parentElement` is the grid with `-mt-1` / `grid-rows-[1fr]` / `grid-rows-[0fr] opacity-0` (:191-198, :287).
- The inline title span's `parentElement` contains the key text (:202-203): inline title must be a sibling of the identity key inside the left flex, not wrapped.
- `back.parentElement` contains the key (progressive.test :678-680): back button, crumbs and identity share one container (the `-ml-1.5 … overflow-hidden pl-1.5` div, :227).
- Toolbar holds Edit + Log work but not Open in Jira / Copy (:206-213).
- Edit label span carries `@[860px]:not-sr-only` (:151); secondary tools carry `hidden @[860px]:inline-flex`, ⋯ carries `@[860px]:hidden` (:145-149).
- Refresh precedes Pin in DOM (:83-90).

### Compact hook
```ts
// hooks/useCompactOnScroll.ts — lifted from IssueDetailView.tsx:97-107
export function useCompactOnScroll(resetKey: unknown) {
  const [compact, setCompact] = useState(false);
  const onScroll = (e: UIEvent<HTMLElement>) => {
    const top = e.currentTarget.scrollTop;
    setCompact((c) => (c ? top > 4 : top > 16));
  };
  useEffect(() => { setCompact(false); }, [resetKey]); // biome-ignore exhaustive-deps, as in IssueDetailView
  return [compact, onScroll] as const;
}
```
Reset keys: issue `issueKey`; release `versionId`; MR `${projectId}/${iid}`; cycle `cycleKey`; run `runId` (prev/next
navigates with `replace` on the same route element, `AioTestRunDetailPage.tsx:107-111`, so the component does not remount).

## 2. Tests that break (and what to do)

| File | Assertion (line) | Breaks because | Action |
|---|---|---|---|
| `release-detail/ReleaseHeader.test.tsx` | `describe('ReleaseBreadcrumbHeader')` 3 tests (:16-54) | component deleted | Delete; move "names the release once" intent to a page test |
| same | h1 `text-2xl font-semibold` (:81-82), `not.toHaveClass('border-b')` (:87), `pt-3 pb-2` + row `justify-between gap-3` + buttons `flex-none` + `Refreshed` `@max-[1024px]/page:hidden` (:90-104) | geometry is now the primitive's | Rewrite to assert title clamp/identity/pill placement |
| same | `getByText('Refreshed: 10:11:12')` (:152); `Pin release` text content (:165, :170-171); `@max-[896px]/page:sr-only` on "Edit release" (:183) | timestamp moves to tooltip; label "Pin"/"Edit" | Assert Refresh `title` contains the time; keep `aria-label` "Refresh release"/"Pin release"/"Unpin release"/"Edit release" so role queries still match |
| same | meta/description/property-strip tests (:106-146) | none if `extra` renders the same MetaLine/ReleaseDescription/PropertyStrip | keep |
| `ReleaseDetailPage.test.tsx` | DOM order header → done bar (:157-179) | fine if header root keeps `data-testid="release-detail-header"` and sits before the scroller | keep |
| same | "header: labels collapse under 896, title row never wraps" (:629-634) uses h1 parent chain + `/page` class | gone | Rewrite (e.g. Edit label has `@[860px]:not-sr-only`) |
| same | `fireEvent.click(getByText('Edit release'))` (:666-670) | label is "Edit"; AND at 600px tiny the Edit tool is not rendered | stub ResizeObserver ≥ 860 (`stubWidth` pattern) and click by role name "Edit release" |
| same | `getByLabelText('Refresh release')` (:676) | Secondary tool still renders in tiny (only CSS-hidden; jsdom has no CSS), so it passes if aria-label is kept | keep aria-label |
| same | `getByText(/^Refreshed: /)` (:688-691) | text removed | Assert Refresh `title` = `Refresh release · Refreshed 10:…` (or similar) |
| same | ResizeObserver stubs at :441-461, :467+, :636-649 | those stubs also hit the header's observer (1500/900 → not tiny); harmless | keep; note 900 is ≥860 (wide labels) |
| `release-detail/ReleaseDetailSkeleton.test.tsx` | `skeleton-property-strip` (:64), `@container/page` on root (:54) | only if the planner removes the skeleton header block | Keep the meta + strip placeholder lines in the skeleton; drop only the title+pill line (header now renders during loading) |
| `AioCycleDetailPage.test.tsx` | `/Pin cycle/`, `/Unpin cycle/` role names (:1380-1415); `'Refresh cycle'` + `animate-spin` on its svg (:2147-2170) | pass if aria-labels kept (`Pin cycle ${key}` like issue's `Pin issue ${key}`) and spin class stays on the tool's svg | keep labels |
| same | `cycle-meta*` testids (:813-845), `getByText('Sprint 2')` (:205, :504) | the name now appears in BOTH the h1/h2 and the aria-hidden inline copy → `getByText` finds two elements and throws | Render the inline copy only when `compact`? No: it must stay mounted for the crossfade. Use `getByRole('heading', {name})` in those tests, or `getAllByText(...)[0]` |
| `AioTestRunDetailPage.test.tsx` | `aio-run-detail-breadcrumb`, `…-breadcrumb-current` (:244-270) | bar deleted | Put `data-testid="aio-run-detail-breadcrumb"` on the header root (or drop); `breadcrumb-current` → assert `aio-run-detail-key` |
| same | `getByRole('button', { name: 'QAT-1234' })` (:254), `findByRole('button', { name: 'Cycle' })` (:278, :520) | a 1-entry trail renders twice in jsdom (wide `@[1200px]:contents` + narrow single crumb, IssueDetailHeader :241-271), so `getByRole` throws "multiple elements". The progressive test already works around it with `getAllByRole(...)[0]` (:686-688) | switch to `getAllByRole(...)[0]` |
| same | `getByRole('link', { name: /Back to cycle/ })` (:270, :508) | fine if the cycle crumb goes in `crumbTail` (rendered once). Do NOT feed it through `nav.trail` (it would duplicate) | keep aria-label `Back to cycle ${cycleKey}` |
| same | `aio-run-detail-key` only when title present (:200, :218, :495); `aio-run-detail-title` text fallbacks (:197, :216, :229 'Run run-2') | identity now always shows a key (`tcKey` or `Run ${runId}`) | Keep `aio-run-detail-key` on the identity key; keep title fallback chain from :171-174/:236-238 |
| same | `aio-run-detail-position`, "Previous run"/"Next run" (:305-356) | pass if `fixed` tools keep the labels/testid and the `idx >= 0` gate | keep |
| `issue-detail/IssueDetailHeader.test.tsx` | whole file | must pass unchanged (locked) | Gate task 1 on it |
| `IssueDetailPage.progressive.test.tsx` | Go back + key share parent (:660-690), no Go back without trail (:692-698), heading level 2 | pass if invariants above hold | keep |
| `components/app/PeekPanel.test.tsx` | "Open full page" labelled button (:88-103) | pass if `trailing` renders it at every width | keep |
| MR | no `MergeRequestDetailPage` test exists (`find` found none) | — | Add a small test: header outside the left scroller, `Open in GitLab` primary (wide stub), `!iid` identity |

**ResizeObserver gotcha (load-bearing):** `test/setup.ts:53-61` delivers `{width: 600}` synchronously on
`observe()` to every observer, including the header's. 600 < 720 → `tiny = true` → primary tools and the
primary pair are not rendered. IssueDetailHeader.test documents this (:64-65) and stubs 1100 per suite. Any new
page test that queries Edit / Open in Jira / Open in GitLab / Copy link must stub ≥ 860 (labels inline) or open
the ⋯ menu. Secondary tools (Refresh, Pin) render in both modes, so they are queryable at 600. Note the release
page also measures its scroller with a ResizeObserver for the graph band (`ReleaseDetailPage.tsx:290-303`):
a global stub changes both, which is fine at ≥ 1180 (band) or 860-1179 (2x2).

**React Compiler guard:** extend `ReleaseDetailPage.compile.test.ts` (or add siblings) to compile
`components/ui/detail-header.tsx` and the four pages. Checked in this session with the same babel setup:
`AioCycleDetailPage.tsx` **already bails out today** with "Handle TryStatement without a catch clause"
(`handleRefresh` try/finally, :82-90). Convert it to `.finally()` as release did (`ReleaseDetailPage.tsx:243-256`)
while touching that file. ReleaseDetailPage, MergeRequestDetailPage, AioTestRunDetailPage, IssueDetailHeader,
ReleaseHeader and CycleHeader compile clean. IssueDetailView bails on "Cannot access refs during render" (pre-existing,
not caused by this task; leave it alone).

## 3. Scroll / sticky per page

General rule: the header becomes the first child of the page's `flex h-full flex-col` root, a sibling **before**
the scroller (exactly like `IssueDetailView.tsx:757-767`). The root class `shrink-0` is already on the shell (:214).
Nothing inside any scroller uses a sticky offset that includes the header, so no offsets change.

| Page | Scroller(s) today | Sticky inside | After the move | onScroll goes on |
|---|---|---|---|---|
| Release | `release-detail-scroll` (`ReleaseDetailPage.tsx:399-404`): `@container/page relative … overflow-auto [--release-sticky-top:0px]`; header is its first child (:406) | `UnifiedTaskTable.tsx:697` `sticky top-(--release-sticky-top,0px) z-20` | Header leaves the scroller → table header still sticks at scroller top 0. Keep the var at 0px. The header's old `@max-[896px]/page` / `@max-[1024px]/page` classes (ReleaseHeader.tsx:89, :179) no longer resolve (the `/page` container is the scroller) — they are replaced by the primitive's own `@container`, so delete them, don't port them | `release-detail-scroll` |
| MR | Left column `flex-1 overflow-auto` (`MergeRequestDetailPage.tsx:209`); sidebar `relative border-l overflow-auto` (:285-288); header is inside the left column's padding block (:211-232) | none | Restructure: root `flex flex-col h-full overflow-hidden` (:171) → `<DetailHeader/>` → `<div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">` (left + sidebar unchanged). The header then spans both columns. `containerRef` for `useResizable` max stays on the row, unaffected. Add `min-h-0` (missing today) and `relative` to the left scroller | left column only (sidebar does not condense, matching issue detail) |
| AIO cycle | `aio-cycle-scroll` (`AioCycleDetailPage.tsx:175-178`): `relative … overflow-auto [--aio-sticky-top:2.75rem]`; CycleHeader is its first child (:179) | Tab bar `sticky top-0 z-20 h-11 bg-background` (:226); list column headers `sticky top-(--aio-sticky-top)` (`ExecutionsList.tsx:385`, `DefectsList.tsx:413`) | All offsets are scroller-relative, unchanged. Tab bar keeps sticking at 0, columns at 2.75rem | `aio-cycle-scroll` |
| AIO run | Outer `min-h-0 flex-1 overflow-auto` (`AioTestRunDetailPage.tsx:282`); at `@[900px]` the outer stops scrolling (child `h-full`) and `aio-run-main-scroll` (:310-313) + sidebar (:368-372) scroll independently | none | Delete both bars (:182-227 and :228-280); the header replaces them | BOTH the outer scroller and `aio-run-main-scroll` (same handler). Not the sidebar |

**Why two handlers on AIO run:** React's `onScroll` does not bubble (React 17 changed it to match the browser) [CITED: legacy.reactjs.org/blog/2020/08/10/react-v17-rc.html — "onScroll no longer bubbles"], so a handler on the outer element never sees the inner column's scroll. Only one of them scrolls at any width, so they never fight. Do not use `onScrollCapture` on a wrapper: it would also catch the sidebar.

## 4. Pitfalls specific to this repo

1. **Hysteresis vs a tall expanded slot (new risk).** Issue detail collapses ~30px of title. Release (meta + description + property strip) and cycle (meta line) collapse much more. When the content overflows by less than the collapsed height, entering compact grows the scroller, the browser clamps `scrollTop` to below 4, the header expands again, and it loops. Mitigation in `useCompactOnScroll`: enter compact only when `el.scrollHeight - el.clientHeight > 16 + collapseDelta`, or simply require `scrollHeight - clientHeight > 160`. Verify by hand on an empty-fix-version release (`release-no-issues` notice, `ReleaseDetailPage.tsx:467-480`) and a 1-run cycle. [ASSUMED: the loop happens; reasoned, not reproduced]
2. **Expanded release description inside a non-scrolling header.** `ReleaseDescription` has a "more" toggle that removes `line-clamp-2` (`ReleaseDescription.tsx:65-122`). Once the header is outside the scroller, a long expanded description can push the scroller to zero height. Cap the `extra` slot (e.g. `max-h-[40vh] overflow-y-auto`), or keep the clamp and open the full text in a popover. Planner decides; flag at UAT.
3. **Container query on self.** The shell root is `@container` (:214); `@[860px]`/`@[720px]` only style descendants. Do not put `@[…]` variants on the root. Content moved into `extra` (MetaLine, PropertyStrip, ReleaseDescription, CycleHeader meta, UserChip) has no unnamed `@` variants (grep found none), so it won't accidentally start matching the header's container.
4. **`not-sr-only` resets white-space.** Keep `LABEL_CLASS = 'sr-only @[860px]:not-sr-only @[860px]:whitespace-nowrap'` (:47) as the single source of truth.
5. **sr-only escaping scrollers.** The release and cycle scrollers are already `relative` (pinned by `ReleaseDetailPage.test.tsx:196-202`). The AIO run scrollers (:282, :310) and the MR left column (:209) are not. `RunDefectsSection` has 3 `sr-only` uses. Add `relative` to those while restructuring. `<main>` is relative too (`main.tsx:741`).
6. **Header must render during loading.** Issue renders the header with only the key while `!issue` (`IssueDetailView.tsx:734-754`, `ready=false`). Do the same:
   - Release: header outside the `isLoading || !version` branch (:397) with `ready={!!version}` and identity = `Rocket` icon. There is no key, so the identity is just the icon + pill (pill only when ready). Remove the title+pill line from `ReleaseDetailSkeleton` (:49-53), keep its meta + `skeleton-property-strip` lines.
   - MR: header outside the `isLoading || !mr` branch (:204); identity = `GitMerge` + `!{iid}` from the URL params, so it shows during loading. Remove the first two skeleton lines (`h-4 w-16` key, `h-8 w-3/4` title, :561-562) from `MRDetailSkeleton`.
   - Cycle: CycleHeader already renders while `cycle` is undefined and shows a meta skeleton (`CycleHeader.tsx:162`). Keep that as `extra`; `ready` can be true from the start (Refresh/Pin work without data) with `title={cycle?.name ?? cycleKey}`.
   - Run: identity key = `tcKey || \`Run ${runId}\``. The title is pending while runs load (`runsPending`, :172); the old code put a `Skeleton` inside the `h1` (:236-238). A `<div>` inside a heading is invalid nesting, so pass `title` undefined and render the skeleton through `extra`, or give the primitive a `titlePlaceholder` slot.
7. **Refresh "last refreshed" sources** (they move into the Refresh tool's `title`):
   - Release: `issuesUpdatedAt` = fix-version issues query `dataUpdatedAt` (`useReleaseDetail.ts:483`, formatted at `ReleaseDetailPage.tsx:258`).
   - Cycle: `runsQuery.dataUpdatedAt` (`AioCycleDetailPage.tsx:91-93`; the string already carries the "Refreshed: " prefix, so strip it).
   - MR: there is no Refresh today. `mr` query `dataUpdatedAt` is available (`MergeRequestDetailPage.tsx:87`). See Open Questions.
   - Run: there is no Refresh today; `detailQuery.dataUpdatedAt` is available.
   Format: `toLocaleTimeString()`, as today.
8. **React Compiler.** No `try/finally` without catch in handlers (it bails the whole component silently). Read `tiny`/`moreTriggerEl` through context or state, never from a module-level variable or a ref during render (memory: React Compiler module reads). The primitive's ResizeObserver uses a callback-ref state (`useState<HTMLDivElement|null>`), which compiles clean (verified).
9. **Base UI `DropdownMenuTrigger render={<Button ref=…/>}`** is how `moreTriggerEl` gets set (:432-443). Keep that exact pattern; the LogWorkPopover anchor depends on it.
10. **Pin aria-labels.** Issue: `Pin issue KEY` / `Unpin issue KEY`, title "Pin to tabs"/"Unpin from tabs", menu "Pin to tabs". Cycle tests use the regex `/Pin cycle/`, so `Pin cycle ${cycleKey}` matches. Release tests use the exact "Pin release"/"Unpin release". Keep those aria-labels; only the visible text becomes "Pin"/"Unpin".
11. **Release primary pair when `jiraVersionUrl` is null** (`ReleaseDetailPage.tsx:231-234`): today the button renders and does nothing. With the primitive, omit `primary` when the URL is null.
12. **Two copies of the title in the DOM.** The aria-hidden inline copy (:335-349) duplicates the title text. `getByText(<title>)` queries in page tests (cycle `'Sprint 2'` :205, :504) will throw. Prefer `getByRole('heading', { name })`.

## Validation Architecture

| Property | Value |
|---|---|
| Framework | vitest (jsdom), `src/test/setup.ts` |
| Quick run | `npx vitest run src/routes/dashboard/issue-detail/IssueDetailHeader.test.tsx src/components/app/PeekPanel.test.tsx src/routes/dashboard/IssueDetailPage.progressive.test.tsx` |
| Per page | `npx vitest run src/routes/dashboard/release-detail src/routes/dashboard/ReleaseDetailPage.test.tsx src/routes/dashboard/AioCycleDetailPage.test.tsx src/routes/dashboard/AioTestRunDetailPage.test.tsx` |
| Full | `npm test` (the pre-commit hook runs the full suite, so RED/GREEN go in one commit) + `npm run check` |

Wave 0 / new tests:
- `components/ui/detail-header.test.tsx`: tiers (primary null when tiny, secondary hidden class, fixed always), menu prepends the primary pair when tiny, `extra` collapses with the title, `crumbTail` rendered once.
- `hooks/useCompactOnScroll.test.ts`: 16/4 hysteresis, reset on key change, no compact when overflow < reserve (pitfall 1).
- Compiler guard covering `detail-header.tsx` + the four pages.
- An MR page test (none exists).

## Security Domain

No new inputs or endpoints. The only external-surface code is `openExternal(href)` / clipboard for URLs built from
configured base URLs (`jiraVersionUrl`) or API data (`mr.web_url`), and that is unchanged from today. ASVS V5: n/a beyond existing.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Compact/expand oscillation with a tall `extra` slot on short content | Pitfall 1 | Low: the reserve check is cheap either way |
| A2 | MR / AIO run should gain a Refresh tool | Open Q1 | Scope creep if the user did not want it |

## Open Questions

1. **Refresh on MR and AIO run.** CONTEXT says "Refresh and Pin become toolbar tools everywhere", but neither page has a Refresh today, and MR has no pin-store support (`pinned-tabs.store.ts` only has cycle/release meta). Recommendation: add Refresh only (MR: invalidate the 5 `['gitlab-mr-*', projectId, iid]` keys at :87-140; run: `run-detail` + `testcase-detail` keys). No Pin for MR/run. Confirm at plan time, or keep it as a one-line UAT item.
2. **Heading level.** Issue uses `h2` (tests pin level 2); the pages use `h1` (release tests query level 1). Recommendation: `titleAs` prop, with the pages passing `'h1'`, so heading semantics on those pages don't change.

## Sources

- Codebase reads (this session): IssueDetailHeader.tsx, IssueDetailView.tsx, ReleaseHeader.tsx, ReleaseDetailPage.tsx, ReleaseDetailSkeleton.tsx, ReleaseDescription.tsx, MergeRequestDetailPage.tsx, AioCycleDetailPage.tsx, CycleHeader.tsx, AioCycleDetailSkeleton.tsx, AioTestRunDetailPage.tsx, UnifiedTaskTable.tsx:697, ExecutionsList.tsx:385, DefectsList.tsx:413, test/setup.ts, and all test files listed in section 2.
- React Compiler bailout check: ran babel-plugin-react-compiler (the same config as `ReleaseDetailPage.compile.test.ts`) over the target files.
- React 17 onScroll non-bubbling: legacy.reactjs.org/blog/2020/08/10/react-v17-rc.html [CITED, from memory of the official post; not re-fetched].

**Valid until:** until IssueDetailHeader changes again (in-repo facts).
