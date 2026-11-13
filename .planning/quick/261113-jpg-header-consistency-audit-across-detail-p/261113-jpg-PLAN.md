---
phase: quick-261113-jpg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/ui/detail-header.tsx
  - taskflow/src/components/ui/detail-header.test.tsx
  - taskflow/src/hooks/useCompactOnScroll.ts
  - taskflow/src/hooks/useCompactOnScroll.test.ts
  - taskflow/src/routes/dashboard/issue-detail/IssueDetailHeader.tsx
  - taskflow/src/routes/dashboard/IssueDetailView.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.compile.test.ts
  - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.test.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.test.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.test.tsx
  - taskflow/src/routes/dashboard/aio-cycle/CycleHeader.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx
  - taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
  - taskflow/src/routes/dashboard/MergeRequestDetailPage.test.tsx
  - taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx
  - taskflow/src/routes/dashboard/AioTestRunDetailPage.test.tsx
autonomous: false
requirements: [QUICK-261113-jpg]

must_haves:
  truths:
    - "Issue detail header looks and behaves exactly as approved in 261113-cth (IssueDetailHeader.test, IssueDetailPage.progressive.test, PeekPanel.test pass with no change in intent)"
    - "Release, MR, AIO cycle and AIO run detail pages show ONE header bar (no separate breadcrumb bar) matching the issue header: back + text-xs crumbs, identity (icon / mono key / status pill) in the meta row, quiet toolbar group, filled primary pair where a web URL exists, text-xl font-medium 2-line-clamped title below"
    - "On each of the four pages the header stays put above the scroller and condenses to one slim row (title inline, extra meta collapsed) when the page scrolls, using the 16px/4px hysteresis, without oscillating on short content"
    - "MR header spans the left column AND the sidebar; AIO run has a single header with prev/next (‹ n/m ›) as always-visible tools"
    - "Refresh and Pin are secondary toolbar tools (in ⋯ below 860px); 'Refreshed: …' time appears only in the Refresh tool's tooltip; Release Edit is a primary tool; visible labels read Edit / Pin / Unpin"
    - "Release has filled Open in Jira + Copy link; MR has filled Open in GitLab + Copy link; AIO cycle/run have toolbar only; MR and AIO run gain a Refresh tool; no Pin on MR or run"
  artifacts:
    - path: "taskflow/src/components/ui/detail-header.tsx"
      provides: "DetailHeader shell + HeaderTool / HeaderMenuItem / HeaderMenuSeparator + useDetailHeader context + DETAIL_HEADER_CLASSES + HeaderNav types"
      exports: ["DetailHeader", "HeaderTool", "HeaderMenuItem", "HeaderMenuSeparator", "useDetailHeader", "DETAIL_HEADER_CLASSES"]
    - path: "taskflow/src/hooks/useCompactOnScroll.ts"
      provides: "compact state + onScroll handler with 16/4 hysteresis, reset key, minOverflow guard"
      exports: ["useCompactOnScroll"]
    - path: "taskflow/src/routes/dashboard/MergeRequestDetailPage.test.tsx"
      provides: "first MR page test: header outside left scroller, !iid identity, Open in GitLab primary"
  key_links:
    - from: "taskflow/src/routes/dashboard/issue-detail/IssueDetailHeader.tsx"
      to: "taskflow/src/components/ui/detail-header.tsx"
      via: "composes DetailHeader"
      pattern: "<DetailHeader"
    - from: "taskflow/src/routes/dashboard/{ReleaseDetailPage,MergeRequestDetailPage,AioCycleDetailPage,AioTestRunDetailPage}.tsx"
      to: "taskflow/src/hooks/useCompactOnScroll.ts"
      via: "onScroll on the page scroller drives DetailHeader compact"
      pattern: "useCompactOnScroll\\("
    - from: "taskflow/src/routes/dashboard/ReleaseDetailPage.compile.test.ts"
      to: "detail-header.tsx + the four pages + IssueDetailHeader"
      via: "babel-plugin-react-compiler bailout guard"
      pattern: "detail-header"
---

<objective>
Extract a shared DetailHeader primitive from the approved IssueDetailHeader (261113-cth), rebuild
IssueDetailHeader on it with zero visible/behavioural change, then migrate Release detail, AIO cycle detail,
Merge request detail and AIO test run detail onto it, deleting their four hand-rolled breadcrumb bars.

Purpose: one header design across every detail page (audit items 1-6 in CONTEXT.md).
Output: `components/ui/detail-header.tsx`, `hooks/useCompactOnScroll.ts`, four migrated pages, updated tests,
an MR page test, and an extended React Compiler guard.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261113-jpg-header-consistency-audit-across-detail-p/261113-jpg-CONTEXT.md
@.planning/quick/261113-jpg-header-consistency-audit-across-detail-p/261113-jpg-RESEARCH.md
Approved design history: `.planning/quick/261113-cth-issue-detail-redesign-sticky-title-heade/*SUMMARY.md` (read only if a DOM/behaviour detail is unclear).

Repo layout: `.planning` and git at the outer `taskflow/`; src, npm, vitest, biome run from the inner
`taskflow/taskflow/`. Paths in tasks below are relative to `taskflow/taskflow/src/` unless written in full.

Hard rules for every task:
- The pre-commit hook runs the full vitest suite + biome + tsc. Every commit must be green, so test updates go in
  the same commit as the code. Commit with `git commit -- <paths>` and check `git log -1 --stat` (a failed hook
  leaves files staged). Do not `git stash` to compare; do not run `biome --write` on all of src (only on touched files).
- The app builds with React Compiler; vitest does not. No try/finally without catch in components, no reading refs
  or module-level mutable state during render. Every new/migrated file is added to the compile guard.
- Biome baseline drifts: gate on "no NEW files flagged", never on an absolute count.
- Memory rules: `not-sr-only` needs `@[860px]:whitespace-nowrap`; italic truncate needs `pr-0.5`; sr-only inside an
  overflow-auto scroller needs a `relative` scroller; `@container` variants never style the container itself.
- Research section 2 (tests that break) and section 3 (scroll/sticky per page) are the authoritative per-file guide.
  Read the relevant rows before editing each page.
- test/setup.ts ResizeObserver mock reports width 600 (< 720 = tiny): primary tools and the primary pair are not
  rendered at that width. Any test querying Edit / Open in Jira / Open in GitLab / Copy link must stub a width
  >= 860 using the `stubWidth` pattern from `issue-detail/IssueDetailHeader.test.tsx:64-76`.
- A 1-entry nav trail renders twice in jsdom (wide + narrow crumb); use `getAllByRole(...)[0]`. The title text also
  appears twice (heading + aria-hidden inline copy); use `getByRole('heading', { name })`, never `getByText(title)`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: DetailHeader primitive + useCompactOnScroll, IssueDetailHeader rebuilt on it (zero change)</name>
  <files>components/ui/detail-header.tsx, components/ui/detail-header.test.tsx, hooks/useCompactOnScroll.ts, hooks/useCompactOnScroll.test.ts, routes/dashboard/issue-detail/IssueDetailHeader.tsx, routes/dashboard/IssueDetailView.tsx, routes/dashboard/ReleaseDetailPage.compile.test.ts</files>
  <read_first>routes/dashboard/issue-detail/IssueDetailHeader.tsx (whole file, once), routes/dashboard/issue-detail/IssueDetailHeader.test.tsx, routes/dashboard/IssueDetailView.tsx lines 90-115 and 730-770, test/setup.ts lines 50-65</read_first>
  <behavior>
    - detail-header: tier=primary HeaderTool renders null when tiny and shows a `@[860px]:not-sr-only` label otherwise; tier=secondary carries `hidden @[860px]:inline-flex`; tier=fixed renders at every width with no hidden class
    - detail-header: when tiny, the ⋯ menu starts with "Open in X" + "Copy X link" + separator before the host's menu content; the inline primary pair is not rendered
    - detail-header: `extra` content sits inside the same grid wrapper as the big title and gets `grid-rows-[0fr] opacity-0` when compact; `crumbTail` renders exactly once; no back/crumbs when `nav.trail` is empty
    - detail-header: `titleAs="h1"` renders a level-1 heading; default is h2; `titlePlaceholder` renders when `title` is undefined
    - useCompactOnScroll: scrollTop 17 → compact; then 5 → still compact; then 4 → expanded; reset key change → expanded; with `minOverflow: 200` and scrollHeight-clientHeight = 150, scrollTop 40 → stays expanded
  </behavior>
  <action>
Per the locked Approach decision, create `components/ui/detail-header.tsx` following the API in RESEARCH section 1
(DetailHeaderProps: layout, compact, nav, crumbTail, identity, ready, title, titleAs, titleTestId, titlePlaceholder,
extra, toolbarLabel, tools, menu (node or `({tiny}) => node`), primary {href, openLabel, copyLabel, copiedLabel,
menuCopyLabel?}, trailing, data-testid). Move into it from IssueDetailHeader, verbatim in classes and nesting: the
`@container shrink-0 border-b` shell, TINY_WIDTH/860 constants, the callback-ref-state ResizeObserver → `tiny`, the
crumb trail (wide `@[1200px]:contents` every entry; narrow single entry or `…` "Show earlier pages" menu) with `/`
separators, the identity container (`-ml-1.5 … overflow-hidden pl-1.5`, back + crumbs + crumbTail + identity + inline
title as siblings), the inline compact title (aria-hidden, staged 250ms crossfade), the right group → `div[role=toolbar]`
(`bg-muted/60 rounded-lg p-0.5`), the ⋯ trigger via `DropdownMenuTrigger render={<Button ref=…/>}` exposing
`moreTriggerEl`, the copy-link flash + timer cleanup, the segmented filled primary pair with `LinkContextMenu` and
`openExternal`, the h-4 w-px divider before `trailing`, and the big-title grid (`-mt-1`, 1fr→0fr + fade) which now
also wraps `extra` below the title. Separator rule (generic): separator before crumbTail if crumbs exist; before
identity if crumbs or crumbTail exist. Provide `DetailHeaderContext` with `{tiny, moreTriggerEl}` via `useDetailHeader()`,
`HeaderTool` (tiers primary/secondary/fixed, props icon, spin, label, aria-label, title, onClick, disabled, iconClassName,
data-testid), `HeaderMenuItem`, `HeaderMenuSeparator`, and export `DETAIL_HEADER_CLASSES` {TOOL_CLASS, PRIMARY_TOOL_CLASS,
LABEL_CLASS (`sr-only @[860px]:not-sr-only @[860px]:whitespace-nowrap`)} plus the `HeaderNav`/`HeaderNavEntry` types.
Do NOT put any `@[…]` variant on the shell root itself.

Create `hooks/useCompactOnScroll.ts`: `useCompactOnScroll(resetKey, { minOverflow = 0 } = {})` returning
`[compact, onScroll]`, lifted from IssueDetailView.tsx:97-107 (enter at >16, leave at <=4), resetting on resetKey
(biome-ignore exhaustive-deps as today). Entering compact additionally requires
`scrollHeight - clientHeight > minOverflow` (RESEARCH pitfall 1; leaving compact is unaffected). Issue detail uses the
default 0 so its behaviour is unchanged.

Rebuild IssueDetailHeader as a thin composer: computes `crumbs` (parent-in-trail trimming) and passes
`nav={{...nav, trail: crumbs}}`, `crumbTail` = parent crumb button, `identity` = IssueTypeIcon + mono key,
`ready={!!issue}`, `titleAs` default h2, tools (Edit primary, Refresh + Pin secondary, Log work as a child component
reading `useDetailHeader()` and rendering LogWorkPopover with PRIMARY_TOOL_CLASS / LABEL_CLASS / `hideTrigger={tiny}` /
`anchor={tiny ? moreTriggerEl : undefined}`), `menu={({tiny}) => …}` reproducing today's exact order and labels
(tiny: [pair prepended by primitive] · Refresh, Pin, Log work · Edit, Clone; non-tiny: Refresh, Pin · Clone),
`primary` = Jira pair, `trailing` = peek "Open full page". Keep `logWorkOpen` state and invalidation in IssueDetailHeader.
Re-export HeaderNav types so `IssueDetailView.tsx:49` imports still resolve. Switch IssueDetailView to
`useCompactOnScroll(issueKey)`. Hold every DOM invariant listed in RESEARCH "DOM invariants".

Write the two new test files (behaviour above) first; the existing IssueDetailHeader.test.tsx,
IssueDetailPage.progressive.test.tsx and PeekPanel.test.tsx must pass without editing their assertions.
Generalise `ReleaseDetailPage.compile.test.ts` into an `it.each` over a file list and add
`components/ui/detail-header.tsx`, `hooks/useCompactOnScroll.ts` and `issue-detail/IssueDetailHeader.tsx`
(keep ReleaseDetailPage.tsx; do not add IssueDetailView.tsx, it has a pre-existing bailout).
One commit: `refactor(quick-261113-jpg): extract DetailHeader from IssueDetailHeader`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/components/ui/detail-header.test.tsx src/hooks/useCompactOnScroll.test.ts src/routes/dashboard/issue-detail/IssueDetailHeader.test.tsx src/routes/dashboard/IssueDetailPage.progressive.test.tsx src/components/app/PeekPanel.test.tsx src/routes/dashboard/ReleaseDetailPage.compile.test.ts && test -z "$(git -C .. status --porcelain -- taskflow/src/routes/dashboard/issue-detail/IssueDetailHeader.test.tsx taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx)"</automated>
  </verify>
  <done>Primitive and hook exist with passing tests; IssueDetailHeader composes DetailHeader; the issue test files are untouched and green; compile guard covers the new files; commit is in and the full pre-commit suite passed.</done>
</task>

<task type="auto">
  <name>Task 2: Release detail + AIO cycle detail on DetailHeader (extra-slot pages)</name>
  <files>routes/dashboard/release-detail/ReleaseHeader.tsx, routes/dashboard/release-detail/ReleaseHeader.test.tsx, routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx, routes/dashboard/release-detail/ReleaseDetailSkeleton.test.tsx, routes/dashboard/ReleaseDetailPage.tsx, routes/dashboard/ReleaseDetailPage.test.tsx, routes/dashboard/aio-cycle/CycleHeader.tsx, routes/dashboard/AioCycleDetailPage.tsx, routes/dashboard/AioCycleDetailPage.test.tsx, routes/dashboard/ReleaseDetailPage.compile.test.ts</files>
  <read_first>RESEARCH section 2 rows for ReleaseHeader.test / ReleaseDetailPage.test / ReleaseDetailSkeleton.test / AioCycleDetailPage.test, section 3 Release + AIO cycle rows, pitfalls 1, 2, 6, 7, 10, 11; then ReleaseHeader.tsx, CycleHeader.tsx, and the header/scroller regions of ReleaseDetailPage.tsx (~:230-480) and AioCycleDetailPage.tsx (~:80-230)</read_first>
  <action>
Release (per locked decisions Pages in scope, Approach, Extra header content, Primary action + refresh timestamp):
Delete `ReleaseBreadcrumbHeader`. Turn ReleaseHeader into a composer over DetailHeader (keep root
`data-testid="release-detail-header"`): identity = lucide `Rocket` icon + release status pill (pill only when ready;
no key, the version name is the title); `titleAs="h1"`, `title` = version name; `extra` = existing MetaLine,
ReleaseDescription and PropertyStrip unchanged, with the ReleaseDescription wrapper capped at `max-h-[40vh] overflow-y-auto`
(pitfall 2); tools: Edit = primary tier (label "Edit", aria-label "Edit release"), Refresh = secondary (aria-label
"Refresh release", `spin` while refreshing, `title` = `Refresh release · Refreshed {toLocaleTimeString of issuesUpdatedAt}`),
Pin = secondary (visible "Pin"/"Unpin", aria-label "Pin release"/"Unpin release"); `menu` mirrors the issue pattern
(tiny: Refresh, Pin · Edit; non-tiny: Refresh, Pin); `primary` = Open in Jira + Copy link from `jiraVersionUrl`, omitted
when null (pitfall 11); `toolbarLabel="Release actions"`. Remove the "Refreshed: …" text, the `@max-[896px]/page` and
`@max-[1024px]/page` classes. In ReleaseDetailPage move the header out of `release-detail-scroll` to be the first child of
the `flex h-full flex-col` root, rendered also while loading (`ready={!!version}`), and wire
`useCompactOnScroll(versionId, { minOverflow: 240 })` onScroll to `release-detail-scroll`. Keep `--release-sticky-top:0px`
and the scroller's `relative`/`@container/page`. Drop only the title+pill line from ReleaseDetailSkeleton (keep meta +
`skeleton-property-strip`). Nav trail/back only when the breadcrumb trail is non-empty; the current entry is not repeated.

AIO cycle: turn CycleHeader into a composer: identity = `FlaskConical` + mono cycle key + cycle status (meta row, after
key); `titleAs="h1"`, `title={cycle?.name ?? cycleKey}`, `ready` true from the start; `extra` = the existing
owner/folder/dates/updated/custom-fields/last-run meta line including its skeleton while `cycle` is undefined (keep
`cycle-meta*` testids); tools Refresh (aria-label "Refresh cycle", spin class on its svg, title carries
`Refreshed {time}`; change AioCycleDetailPage.tsx `lastRefreshed` (≈line 93) to produce the bare time string, no "Refreshed: " prefix, and build the tooltip text in CycleHeader) and Pin (visible Pin/Unpin,
aria-label `Pin cycle ${cycleKey}` / `Unpin cycle ${cycleKey}`), both secondary; no primary pair. Delete the separate
breadcrumb bar in AioCycleDetailPage, move the header above `aio-cycle-scroll`, wire
`useCompactOnScroll(cycleKey, { minOverflow: 120 })` to it, and keep the tab bar sticky top-0 and `--aio-sticky-top:2.75rem`.
Convert `handleRefresh` try/finally to a `.finally()` chain (pitfall 8, it bails the compiler today).

Update the tests per RESEARCH section 2 (stub width >= 860 before clicking Edit / Open in Jira; Refresh time asserted
via `title`; role-name queries keep matching aria-labels; `getByText('Sprint 2')` → `getByRole('heading', …)`; rewrite
geometry assertions to assert the clamp/identity/pill placement instead; move the "names the release once" intent into a
page test). Add ReleaseHeader.tsx, CycleHeader.tsx and AioCycleDetailPage.tsx to the compile guard list.
Commit: `feat(quick-261113-jpg): release + AIO cycle detail use DetailHeader`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail src/routes/dashboard/ReleaseDetailPage.test.tsx src/routes/dashboard/AioCycleDetailPage.test.tsx src/routes/dashboard/ReleaseDetailPage.compile.test.ts && ! grep -n "ReleaseBreadcrumbHeader\|Refreshed: " src/routes/dashboard/release-detail/ReleaseHeader.tsx src/routes/dashboard/ReleaseDetailPage.tsx src/routes/dashboard/AioCycleDetailPage.tsx src/routes/dashboard/aio-cycle/CycleHeader.tsx | grep -v '^\s*//'</automated>
  </verify>
  <done>Both pages render one DetailHeader above their scroller with extra meta collapsing on scroll; old breadcrumb bars and "Refreshed:" text are gone; Release has the Jira pair and primary Edit; cycle compiles clean under React Compiler; commit landed with the full suite green.</done>
</task>

<task type="auto">
  <name>Task 3: Merge request detail + AIO test run detail on DetailHeader (restructure / multi-scroller pages)</name>
  <files>routes/dashboard/MergeRequestDetailPage.tsx, routes/dashboard/MergeRequestDetailPage.test.tsx, routes/dashboard/AioTestRunDetailPage.tsx, routes/dashboard/AioTestRunDetailPage.test.tsx, routes/dashboard/ReleaseDetailPage.compile.test.ts</files>
  <read_first>RESEARCH section 2 rows for AioTestRunDetailPage.test + MR, section 3 MR + AIO run rows (including "Why two handlers on AIO run"), pitfalls 5, 6, 7; then MergeRequestDetailPage.tsx (~:80-300 and MRDetailSkeleton ~:555-570) and AioTestRunDetailPage.tsx (~:100-380)</read_first>
  <action>
MR (per locked decisions + orchestrator decisions: Refresh added, no Pin, titleAs h1): delete the breadcrumb bar
(:172-200) and the in-column header block. Restructure the root to `flex h-full flex-col overflow-hidden` →
`<DetailHeader/>` → `<div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">` holding the unchanged left
column + resizable sidebar, so the header spans both. Add `relative min-h-0` to the left scroller and wire
`useCompactOnScroll(\`${projectId}/${iid}\`)` onScroll to it only (sidebar does not condense). Header renders during
loading: identity = `GitMerge` + mono `!{iid}` from URL params + state badge and Draft marker after the key once loaded;
`ready={!!mr}`, `titleAs="h1"`, `title={mr?.title}`; Refresh = secondary tool (aria-label "Refresh merge request",
spin while fetching, title `Refresh merge request · Refreshed {time from mr query dataUpdatedAt}`) invalidating every
`['gitlab-mr-*', projectId, iid]` query the page uses (grep the exact keys in the file); `menu` holds Refresh;
`primary` = "Open in GitLab" + "Copy link" from `mr.web_url` (only when ready); `toolbarLabel="Merge request actions"`.
Remove the first two lines (key + title placeholders) from MRDetailSkeleton. MR section h3 headers stay as they are
(out of scope). Create `MergeRequestDetailPage.test.tsx` (model the query/route mocking on an existing page test such as
AioTestRunDetailPage.test.tsx): with width stubbed >= 860 assert one `h1` with the MR title, `!{iid}` in the meta row, an
"Open in GitLab" button outside the toolbar, the header is not inside the left scroller, and clicking "Refresh merge
request" invalidates the MR queries.

AIO run (per locked decisions + discretion on prev/next): delete both stacked bars (:182-227 breadcrumb and :228-280
title bar); one DetailHeader replaces them, root `data-testid="aio-run-detail-breadcrumb"`. `crumbTail` = the
always-present cycle NavLink (aria-label `Back to cycle ${cycleKey}`), NOT fed through `nav.trail`; nav trail/back only
when the trail is non-empty. identity = `FlaskConical` + mono key `tcKey || \`Run ${runId}\`` (`data-testid="aio-run-detail-key"`)
+ run status after it; `titleAs="h1"`, `titleTestId="aio-run-detail-title"`, title keeps the existing fallback chain; while
runs are pending pass `title` undefined and a Skeleton via `titlePlaceholder` (no div inside a heading). Tools: prev/next
(‹ n/m ›) as `fixed` tier with existing labels "Previous run"/"Next run", `aio-run-detail-position` testid and `idx >= 0`
gate (never in ⋯); Refresh secondary (aria-label "Refresh run", title with `detailQuery.dataUpdatedAt` time) invalidating
the run-detail and testcase-detail queries (grep exact keys); no Pin; no primary pair. Wire one
`useCompactOnScroll(runId)` handler to BOTH the outer scroller and `aio-run-main-scroll` (not the sidebar); add `relative`
to both scrollers. Update AioTestRunDetailPage.test per RESEARCH section 2 (breadcrumb-current → `aio-run-detail-key`,
1-entry-trail and "Cycle" role queries → `getAllByRole(...)[0]`, key now always present).
Add MergeRequestDetailPage.tsx and AioTestRunDetailPage.tsx to the compile guard list.
Commit: `feat(quick-261113-jpg): MR + AIO run detail use DetailHeader`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/MergeRequestDetailPage.test.tsx src/routes/dashboard/AioTestRunDetailPage.test.tsx src/routes/dashboard/ReleaseDetailPage.compile.test.ts && npm test -- --run && npx tsc --noEmit</automated>
  </verify>
  <done>MR header spans content + sidebar and condenses with the left column; AIO run has one header with fixed prev/next, cycle crumb and Refresh; both gain Refresh, neither has Pin; new MR test passes; full suite, tsc and the compile guard are green; commit landed.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: UAT in the running app</name>
  <what-built>Shared DetailHeader used by Issue, Release, Merge request, AIO cycle and AIO test run detail pages; the four old breadcrumb bars are gone.</what-built>
  <how-to-verify>
Run `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npm run tauri dev`, then:
1. Issue detail (full page and peek): identical to the approved 261113-cth header (crumbs, toolbar, Jira pair, condense, ⋯ at 860/720, Log work popover anchors to ⋯ when narrow).
2. Release detail: one bar; Rocket + status pill in the meta row; big h1 title clamps to 2 lines; meta, description, property strip under it; scroll the task table → header condenses to one row and stays put; table header still sticks at the scroller top. Edit / Pin / Refresh labels; hovering Refresh shows the refreshed time; Open in Jira + Copy link work.
3. Release with no fix-version issues (short content): scrolling does not make the header flicker between states. Expand a long description: it scrolls inside its 40vh cap, page still usable.
4. AIO cycle: one bar, key + status in meta row, meta line under the title collapses on scroll; tab bar and list column headers still stick correctly; Refresh spins; Pin/Unpin works.
5. MR detail: header spans left column and sidebar; GitMerge + !iid + state/draft in meta row; condenses when the left column scrolls (not the sidebar); Open in GitLab + Copy link; Refresh reloads.
6. AIO test run: single bar; cycle crumb always present (also from a pinned tab / direct link); ‹ n/m › always visible at every width; Refresh reloads; condenses when scrolling the main column (wide) and the whole page (narrow, below 900px).
7. Narrow each page below 860px and below 720px: secondary tools move into ⋯, primary pair moves into ⋯ below 720, labels never wrap.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues per page</resume-signal>
  <files>none (verification only)</files>
  <action>Start the app and present the checklist above to the user; record their verdict per page in the SUMMARY. Fix nothing before the user responds.</action>
  <verify>User replies "approved" or lists issues</verify>
  <done>User has approved all seven checks, or the reported issues are recorded for follow-up.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| API data → UI | MR `web_url`, release/cycle names and descriptions from Jira/GitLab/AIO render in the header |
| UI → OS | Open in Jira/GitLab hands a URL to `openExternal`; Copy link writes to the clipboard |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-jpg-01 | Tampering | DetailHeader primary pair (`openExternal(href)`) | accept | Same URLs (`jiraVersionUrl` from configured base, `mr.web_url` from GitLab API) and same `openExternal` path as today; no new URL construction |
| T-jpg-02 | Information disclosure | Header title/extra rendering | accept | Rendered as React text nodes (no dangerouslySetInnerHTML added); ReleaseDescription renderer unchanged |
| T-jpg-SC | Tampering | package installs | accept | No packages installed in this plan |
</threat_model>

<verification>
- `npm test -- --run`, `npx tsc --noEmit` and biome on touched files pass (pre-commit enforces on each commit).
- IssueDetailHeader.test.tsx and IssueDetailPage.progressive.test.tsx are unchanged since before Task 1.
- `grep -rn "Go back\|aria-label=\"Back\"" src/routes/dashboard/{ReleaseDetailPage,MergeRequestDetailPage,AioCycleDetailPage,AioTestRunDetailPage}.tsx src/routes/dashboard/release-detail/ReleaseHeader.tsx` finds no hand-rolled back buttons (back comes from DetailHeader only).
- Compile guard lists detail-header.tsx, useCompactOnScroll.ts, IssueDetailHeader.tsx, ReleaseHeader.tsx, CycleHeader.tsx and the four pages, all without bailouts.
</verification>

<success_criteria>
- One header primitive drives all five detail pages; no separate breadcrumb bars remain.
- Issue detail unchanged; the four pages match it (meta row identity, toolbar group, primary pair where a URL exists, 2-line title, sticky + condense on scroll).
- User approves the UAT checklist.
</success_criteria>

<output>
Create `.planning/quick/261113-jpg-header-consistency-audit-across-detail-p/261113-jpg-SUMMARY.md` when done
</output>
