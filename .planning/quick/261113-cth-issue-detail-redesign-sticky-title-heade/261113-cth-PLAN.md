---
phase: quick-261113-cth
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/issue-detail/SectionHeader.tsx
  - taskflow/src/routes/dashboard/issue-detail/SectionHeader.test.tsx
  - taskflow/src/hooks/useScrolledPast.ts
  - taskflow/src/hooks/useScrolledPast.test.ts
  - taskflow/src/routes/dashboard/issue-detail/issue-actions.ts
  - taskflow/src/routes/dashboard/issue-detail/issue-actions.test.ts
  - taskflow/src/routes/dashboard/issue-detail/IssueTitleBlock.tsx
  - taskflow/src/routes/dashboard/issue-detail/IssueDetailHeader.tsx
  - taskflow/src/routes/dashboard/issue-detail/IssueDetailHeader.test.tsx
  - taskflow/src/routes/dashboard/IssueDetailView.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.test.tsx
  - taskflow/src/routes/dashboard/IssueDetailSheet.tsx
  - taskflow/src/components/app/PeekPanel.tsx
  - taskflow/src/components/app/PeekPanel.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx
  - taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx
autonomous: false
requirements: [QUICK-261113-cth]

must_haves:
  truths:
    - "Full page /issue/:key shows ONE full-width header bar above the content column AND the sidebar (outside both scrollers), below the breadcrumb bar when a trail exists"
    - "The header holds the actions on the right: Refresh, Pin, Edit (outline icon-sm), Log work (labelled), Open in Jira (labelled), and a ⋯ menu with Clone + Copy Jira link; the old action row at the bottom of IssueDetailContent is gone"
    - "At scroll top the big title (text-2xl page / text-xl peek) with the key above it is the first thing in the scrolling content in BOTH layouts; once it scrolls out of view the header shows 'KEY  truncated title…' on one line with the full title as tooltip, and the header height never changes"
    - "The peek panel uses the same header (no separate 40px bar) with Open full page + Close at the far right; subtask parent link is preserved; Close is never pushed off screen at 360px"
    - "Description, Attachments, Progress, Stories, Subtasks, Parent, Activity and AIO test runs headers stick to the top of the scroller while their section is in view, opaque, no gutter bleed, above row overlays"
    - "The header shows key + trailing controls while the issue is loading or unavailable, so peek Close always works"
    - "Every existing aria-label/title that tests rely on is preserved (Refresh issue, Pin/Unpin issue KEY, Clone issue, Copy Jira link, Open full page, Close preview, Open parent issue KEY) and Edit gains aria-label 'Edit issue'"
  artifacts:
    - path: "taskflow/src/routes/dashboard/issue-detail/IssueDetailHeader.tsx"
      provides: "Shared sticky title/actions header for page + peek"
      exports: ["IssueDetailHeader"]
    - path: "taskflow/src/routes/dashboard/issue-detail/IssueTitleBlock.tsx"
      provides: "In-content key + big title block (observation target)"
      exports: ["IssueTitleBlock"]
    - path: "taskflow/src/hooks/useScrolledPast.ts"
      provides: "IntersectionObserver hook: true only when target is above the root viewport"
      exports: ["useScrolledPast"]
    - path: "taskflow/src/routes/dashboard/issue-detail/issue-actions.ts"
      provides: "Pure Edit/Clone initial-value builders moved out of IssueDetailContent"
      exports: ["buildEditInitialValues", "buildCloneInitialValues"]
    - path: "taskflow/src/routes/dashboard/issue-detail/SectionHeader.tsx"
      provides: "Sticky-by-default section heading using --detail-px / --detail-surface vars"
      contains: "sticky top-0 z-20"
  key_links:
    - from: "taskflow/src/routes/dashboard/IssueDetailView.tsx"
      to: "IssueDetailHeader"
      via: "rendered in loading, unavailable and loaded states for both layouts"
      pattern: "<IssueDetailHeader"
    - from: "taskflow/src/routes/dashboard/IssueDetailView.tsx"
      to: "useScrolledPast"
      via: "root = content scroller (state callback ref), target = IssueTitleBlock h2"
      pattern: "useScrolledPast\\("
    - from: "taskflow/src/components/app/PeekPanel.tsx"
      to: "IssueDetailView headerTrailing"
      via: "Open full page + Close passed as headerTrailing prop"
      pattern: "headerTrailing="
    - from: "taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx"
      to: "SectionHeader"
      via: "bespoke FlaskConical heading replaced by SectionHeader title='AIO test runs'"
      pattern: "SectionHeader"
---

<objective>
Redesign the issue detail view (full page two-column + peek single-column) per 261113-cth-CONTEXT.md:
a shared fixed-height header with key/compact title on the left and the main actions on the right
(shrink-on-scroll title via IntersectionObserver), and sticky section headers.

Purpose: actions are always reachable without scrolling to the bottom, and the user always knows which
issue and section they are in. One header component, same in page and peek.
Output: IssueDetailHeader, IssueTitleBlock, useScrolledPast, issue-actions helpers, sticky SectionHeader,
restructured IssueDetailView/PeekPanel, updated tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/STATE.md
@/Users/mimo/Documents/Projects/taskflow/.planning/quick/261113-cth-issue-detail-redesign-sticky-title-heade/261113-cth-CONTEXT.md
@/Users/mimo/Documents/Projects/taskflow/.planning/quick/261113-cth-issue-detail-redesign-sticky-title-heade/261113-cth-RESEARCH.md

Source (read once each, extract everything in one pass):
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/IssueDetailContent.tsx  (title :254-257, copy-link :178-202, logwork success :215-219, action row :384-506, COMPACT_* :510-512)
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/IssueDetailView.tsx  (handleRefresh :316, content node :522, activity node :558-657, early returns :679-693, layouts :697-752)
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/components/app/PeekPanel.tsx  (header :133-182, duplicate issue query, peekParent)
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/issue-detail/SectionHeader.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx  (triggerLabel/triggerClassName/triggerLabelClassName)
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/components/ui/dropdown-menu.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/release-detail/NotCoveredFixActions.tsx  (DropdownMenuTrigger render-prop pattern :63-76)

Repo layout: run npm/vitest/biome/tsc from /Users/mimo/Documents/Projects/taskflow/taskflow; git + .planning at /Users/mimo/Documents/Projects/taskflow.
Pre-commit runs full vitest + biome + tsc: put tests and implementation in ONE commit per task; commit with explicit `-- paths` and check `git log -1 --stat` afterwards (staged-after-failed-hook memory). Do NOT run `biome --write` over all of src; format only the touched files.

Orchestrator-locked resolutions:
1. Extract `IssueTitleBlock` and render it at the TOP of the scroller in BOTH layouts (in peek above the sidebar fields block) so shrink-on-scroll works in peek too.
2. LinkedIssuesSection / MergeRequestsSection keep their current uppercase `<p>` labels (not converted, not sticky) — flag at UAT.

Discretion choices made by the planner (document in SUMMARY):
- Sticky is the DEFAULT on SectionHeader (CONTEXT allows "opt-in prop or default"); `sticky={false}` opts out. Only issue-detail code imports this SectionHeader (standup uses its own StandupSectionHeader), so no other screen changes.
- Header left side when loaded and at scroll top: empty except the peek-only parent link (no duplicate key — avoids `getByText(KEY)` collisions with IssueTitleBlock). While loading/unavailable: key in mono. When scrolled past: IssueTypeIcon (subtle, size of the key text) + mono key + truncated title.
- Header bar height `h-12` both layouts, `border-b`, `bg-(--detail-surface)`, `px-6` page / `px-4` peek, `@container` on the bar.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Building blocks — sticky SectionHeader, useScrolledPast, issue-actions helpers, IssueTitleBlock, IssueDetailHeader (+ tests)</name>
  <files>taskflow/src/routes/dashboard/issue-detail/SectionHeader.tsx, taskflow/src/routes/dashboard/issue-detail/SectionHeader.test.tsx, taskflow/src/hooks/useScrolledPast.ts, taskflow/src/hooks/useScrolledPast.test.ts, taskflow/src/routes/dashboard/issue-detail/issue-actions.ts, taskflow/src/routes/dashboard/issue-detail/issue-actions.test.ts, taskflow/src/routes/dashboard/issue-detail/IssueTitleBlock.tsx, taskflow/src/routes/dashboard/issue-detail/IssueDetailHeader.tsx, taskflow/src/routes/dashboard/issue-detail/IssueDetailHeader.test.tsx</files>
  <behavior>
    - SectionHeader default renders root with classes `sticky top-0 z-20`, `bg-(--detail-surface,var(--background))` and the gutter-bleed classes; `sticky={false}` renders none of them; existing SectionHeader tests still pass.
    - useScrolledPast (vi.stubGlobal FakeIO): entry not intersecting with boundingClientRect.bottom <= rootBounds.top → true; not intersecting but below the fold (top >= rootBounds.bottom) → false; intersecting → false; IntersectionObserver undefined → false and no throw; null root/target → false; observer disconnected on unmount; resets to false when `resetKey` changes.
    - buildEditInitialValues / buildCloneInitialValues return the same shapes the current IssueDetailContent builders produce for a fixture issue (copy the exact field mapping from :416-455; clone summary/uuid behaviour unchanged — stub crypto.randomUUID).
    - IssueDetailHeader: Refresh renders before Pin; Refresh spins+disables while `refreshing`; Refresh absent without `onRefresh`; Pin label 'Pin issue KEY' / 'Unpin issue KEY' with titles 'Pin to tabs'/'Unpin from tabs'; Edit button aria-label 'Edit issue' calls onEdit with buildEditInitialValues output; ⋯ trigger (aria-label 'More actions') opens menu with menuitems 'Clone issue' and 'Copy Jira link'; Clone calls onClone; `headerTrailing` content is rendered; compact title NOT in the DOM when `compact` is false; with `compact` true the summary is rendered with `title` = full summary; with no `issue` only the key + headerTrailing render (no issue actions).
  </behavior>
  <action>
Write tests first (they go in the same commit as the implementation — pre-commit blocks RED commits).

SectionHeader.tsx: add `sticky?: boolean` (default true). When true add `sticky top-0 z-20 bg-(--detail-surface,var(--background)) mx-[calc(var(--detail-px,0px)*-1)] px-(--detail-px,0px)` (z-20 beats AttachmentTile `absolute z-10` overlays and row `relative` cells — sticky-header-vs-row-z10 memory; vars come from the scroller set in Task 2; fallbacks keep it harmless elsewhere). Keep `h-7` and `mb-2`. Do not wrap in any extra element (the section must stay the containing block). Update the JSDoc to say headers stick inside their own `<section>`.

hooks/useScrolledPast.ts: `useScrolledPast(root: HTMLElement | null, target: HTMLElement | null, resetKey?: unknown): boolean`. useState(false); effect deps [root, target, resetKey]: set false, then guard `typeof IntersectionObserver === 'undefined' || !root || !target` → return; create IO with `{ root, threshold: 0 }`, callback sets `!e.isIntersecting && e.boundingClientRect.bottom <= (e.rootBounds?.top ?? 0)`; disconnect on cleanup. No module-level mutable state (React Compiler memory). Do NOT add a global IO mock to src/test/setup.ts.

issue-actions.ts: move the Edit and Clone initial-value builders out of IssueDetailContent.tsx :416-455 verbatim as pure `buildEditInitialValues(issue, storyPointsFieldKey, epicLinkFieldKey)` and `buildCloneInitialValues(issue, storyPointsFieldKey, epicLinkFieldKey)` (check the real signature needs while reading; keep EditInitialValues type from CreateEditIssueModal). Task 2 deletes the originals.

IssueTitleBlock.tsx: `IssueTitleBlock({ issueKey, summary, size: 'page' | 'peek', titleRef })` renders the same markup as IssueDetailContent :254-257 (mono key `<p>` + `<h2>` with `text-2xl` for page, `text-xl` for peek, `font-semibold leading-snug`, wrapping). `titleRef` is a callback ref attached to the `<h2>` (observation target). Move the IssueDetailContent title test (:170-186) into IssueDetailHeader.test.tsx or a small IssueTitleBlock case there.

IssueDetailHeader.tsx (per CONTEXT "Actions in the header" + "Title behaviour"): props `{ issueKey, issue?: JiraIssue, jiraBaseUrl, layout: 'page' | 'peek', compact: boolean, parent?: { key, summary, typeName } (peek only), onOpenIssue?, onRefresh?, refreshing?, isPinned, onTogglePin, onEdit?, onClone?, storyPointsFieldKey, epicLinkFieldKey, headerTrailing?: ReactNode }`. Root: `@container flex h-12 shrink-0 items-center gap-3 border-b bg-(--detail-surface,var(--background))` + `px-6` (page) / `px-4` (peek). Left cluster `flex min-w-0 flex-1 items-center gap-2`: peek parent button (move markup from PeekPanel.tsx :144-160 incl. `aria-label="Open parent issue KEY"`, title, IssueTypeIcon, ChevronRight); if `!issue` show mono key; if `issue && compact` render (mounted conditionally, NOT opacity-0 — avoids duplicate-text test collisions) `animate-in fade-in-0` group: IssueTypeIcon + `shrink-0 font-mono text-xs text-muted-foreground` key + `truncate pr-0.5 text-sm font-medium` summary with `title={summary}` (italic-truncate memory). Right cluster `flex shrink-0 items-center gap-1.5`, only when `issue`: Refresh (outline icon-sm, aria-label/title 'Refresh issue', RefreshCw `animate-spin` while refreshing, disabled while refreshing); Pin (outline icon-sm, labels as listed in behavior, Pin icon `fill-current text-primary` when pinned); Edit (outline icon-sm, Pencil, aria-label/title 'Edit issue', calls onEdit(buildEditInitialValues(...)), only when onEdit); LogWorkPopover with `triggerLabel="Log work"` and, for peek, container-query collapse classes (`w-7 px-0 @[520px]:w-auto @[520px]:px-2.5` on trigger, `sr-only @[520px]:not-sr-only @[520px]:whitespace-nowrap` on label — not-sr-only-undoes-truncate memory); its onSuccess invalidates `['jira-issue-detail', issueKey, jiraBaseUrlFromStore]` exactly as IssueDetailContent :215-219 (useQueryClient + store read inside the header); Open in Jira wrapped in the existing LinkContextMenu exactly as in the current action row, outline sm, label 'Open in Jira' with the same collapse classes in peek (aria-label kept); ⋯ DropdownMenu using the NotCoveredFixActions render-prop trigger `<Button variant="outline" size="icon-sm" aria-label="More actions" title="More actions">` with MoreHorizontal, items: 'Clone' (aria-label 'Clone issue', only when onClone, calls onClone(buildCloneInitialValues(...))) and 'Copy Jira link' (aria-label 'Copy Jira link', `closeOnClick={false}`, moves the copiedLink state + 2s timer + handleCopyJiraLink from IssueDetailContent :178-202, label swaps to 'Copied' with Check icon). Then `headerTrailing` (rendered regardless of `issue`) after a `h-4 w-px bg-border` divider when present. All buttons outline, h-7 (CONTEXT "All buttons outline style… consistent h-7"). Preserve every aria-label/title listed in must_haves.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail/SectionHeader.test.tsx src/hooks/useScrolledPast.test.ts src/routes/dashboard/issue-detail/issue-actions.test.ts src/routes/dashboard/issue-detail/IssueDetailHeader.test.tsx && npx tsc --noEmit && npx biome check src/routes/dashboard/issue-detail/SectionHeader.tsx src/hooks/useScrolledPast.ts src/routes/dashboard/issue-detail/issue-actions.ts src/routes/dashboard/issue-detail/IssueTitleBlock.tsx src/routes/dashboard/issue-detail/IssueDetailHeader.tsx</automated>
  </verify>
  <done>All four test files pass with the listed behaviours; tsc clean; biome clean on touched files; committed as one commit (feat(261113-cth): issue detail header building blocks).</done>
</task>

<task type="auto">
  <name>Task 2: Wire the header into IssueDetailView (page + peek), remove the bottom action row, sticky sections, update tests</name>
  <files>taskflow/src/routes/dashboard/IssueDetailView.tsx, taskflow/src/routes/dashboard/IssueDetailContent.tsx, taskflow/src/routes/dashboard/IssueDetailContent.test.tsx, taskflow/src/routes/dashboard/IssueDetailSheet.tsx, taskflow/src/components/app/PeekPanel.tsx, taskflow/src/components/app/PeekPanel.test.tsx, taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx, taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx</files>
  <action>
IssueDetailView.tsx:
- Add prop `headerTrailing?: ReactNode`. Hold scroller + title elements in state-backed callback refs (`const [scrollEl, setScrollEl] = useState<HTMLElement|null>(null)`, same for `titleEl`), and `const compact = useScrolledPast(scrollEl, titleEl, issueKey)`.
- Build one `headerNode = <IssueDetailHeader …/>` passing issueKey, issue, jiraBaseUrl, layout ('page' for two-column, 'peek' for single-column), compact, parent (single-column only, from `issue.fields.parent` key/summary/issuetype name), onOpenIssue, onRefresh=handleRefresh, refreshing, isPinned, onTogglePin, onEdit, onClone, storyPointsFieldKey, epicLinkFieldKey, headerTrailing.
- Early returns (:679-693): wrap IssueDetailSkeleton and IssueUnavailable in `<div className="flex h-full min-h-0 flex-1 flex-col">{headerNode}<div className="min-h-0 flex-1 overflow-auto">…</div></div>` so key + headerTrailing (peek Close) render during load/unavailable (header hides issue actions when `!issue`).
- Two-column (per CONTEXT "Header span: full width"): root `flex min-h-0 flex-1 flex-col` → headerNode → row `<div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">` (containerRef stays on the row for useResizable) → left scroller `ref={setScrollEl} className="relative min-w-0 flex-1 overflow-auto [--detail-px:1.5rem] [--detail-surface:var(--background)]"` containing `<div className="p-6"><IssueTitleBlock size="page" titleRef={setTitleEl} …/>{issueDetailContentNode}</div>{activitySectionNode}`; sidebar unchanged.
- Single-column: root `flex h-full flex-col [--detail-surface:var(--card)]` → headerNode → scroller `ref={setScrollEl} className="relative min-h-0 flex-1 overflow-auto [--detail-px:1rem]"` (relative per sr-only-escapes-scroller memory) containing `<div className="px-4 pt-4"><IssueTitleBlock size="peek" titleRef={setTitleEl} …/></div>` FIRST (locked resolution 1), then the sidebar fields block, content block, activity — otherwise unchanged. The two-column root sets `[--detail-surface:var(--background)]` on the root so the header picks it up too (put the var on the root in both layouts, not just the scroller).
- Composer wrapper (:647-649): replace `bg-background` with `bg-(--detail-surface,var(--background))` and add `z-20` (fixes the dark-peek mismatch; never interleaves with stuck headers).
- Stop passing onRefresh/refreshing/isPinned/onTogglePin/onEdit/onClone/titleClassName to IssueDetailContent.

IssueDetailContent.tsx: delete the title block (:254-257), the whole action row (:384-506), copy-link state/handler (:178-202), handleLogWorkSuccess (:215-219), the inline Edit/Clone builders and COMPACT_* constants; remove the now-unused props (onRefresh, refreshing, isPinned, onTogglePin, onEdit, onClone, titleClassName) and their imports. Keep onAddSubtask/onAddEpicStory etc. Leave every section's SectionHeader call as is (sticky is now default). IssueDetailContent.test.tsx: delete the refresh-button block (:128-167) and title test (:170-186) (now covered in IssueDetailHeader.test.tsx); fix any other test that clicked the removed row buttons by moving it to IssueDetailHeader.test.tsx, not by deleting coverage.

IssueDetailSheet.tsx (legacy, test-only): drop the removed props; render `<IssueTitleBlock size="page" …/>` above IssueDetailContent so its tests still find the summary; keep onEdit unused-safe (remove the param from destructuring only if tsc/biome flags it — do not change its public props type otherwise).

AioTestRunsSection.tsx (:715-719): replace the bespoke `div.text-sm.font-semibold` + FlaskConical heading with `<SectionHeader title="AIO test runs" />` as a direct child of the `<section>` (keep any count/actions it had via SectionHeader props). Leave the inner AioAttachmentsGrid toggle untouched.

PeekPanel.tsx (per CONTEXT "Peek panel: merge headers"): delete the 40px header bar (:133-182) and the duplicate `jira-issue-detail` useQuery / peekParent derivation + now-unused imports. Pass `headerTrailing` to IssueDetailView: `<Button variant="outline" size="sm" aria-label="Open full page" title="Open full page" onClick={() => onNavigateFull(issueKey)} className="w-7 px-0 @[520px]:w-auto @[520px]:px-2.5 gap-1"><ExternalLink className="size-3.5"/><span className="sr-only @[520px]:not-sr-only @[520px]:whitespace-nowrap">Open full page</span></Button>` and `<Button variant="ghost" size="icon-sm" aria-label="Close preview" onClick={onClose}><X className="size-4"/></Button>` (Close stays ghost — window-chrome control; the container is the header's `@container`). Body wrapper becomes `flex min-h-0 flex-1 flex-col overflow-hidden`. Keep drag handle, Escape hotkey, root classes.
PeekPanel.test.tsx: update the IssueDetailView mock to render `props.issueKey` and `props.headerTrailing` so PEEK-04/06/07 keep passing; drop react-query/stronghold/jira mocks that only served the removed query (only if nothing else uses them).

IssueDetailPage.progressive.test.tsx: run it; `getByText(ISSUE_KEY)` / `getByText('Test issue title')` should still be unique because the header shows no key/title when loaded and not compact (jsdom has no IO). If any assertion breaks, scope it with `within(...)` — do not weaken it.

Then run the full related suite, tsc, and biome on touched files only. Grep that nothing still passes the removed props: `grep -rn "titleClassName\|onTogglePin=" src/routes/dashboard/IssueDetailView.tsx src/routes/dashboard/IssueDetailSheet.tsx` should only show the header/view-internal usages.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail/ src/components/app/PeekPanel.test.tsx src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/IssueDetailPage.progressive.test.tsx src/routes/dashboard/IssueDetailSheet.test.tsx src/routes/dashboard/EpicDetailSheet.test.tsx && npx tsc --noEmit && npx biome check src/routes/dashboard/IssueDetailView.tsx src/routes/dashboard/IssueDetailContent.tsx src/routes/dashboard/IssueDetailSheet.tsx src/components/app/PeekPanel.tsx src/routes/dashboard/issue-detail/AioTestRunsSection.tsx && test "$(grep -c 'Open full page' src/components/app/PeekPanel.tsx)" -ge 1 && ! grep -n "h-10 px-4 border-b" src/components/app/PeekPanel.tsx</automated>
  </verify>
  <done>Header renders in loading/unavailable/loaded states for both layouts; bottom action row and old peek bar removed; IssueTitleBlock first in both scrollers; AIO section uses SectionHeader; composer uses the surface var + z-20; all listed tests, tsc and touched-file biome pass; full vitest passes via the pre-commit hook; one commit (feat(261113-cth): sticky issue detail header + sticky sections).</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: UAT in the real app</name>
  <files>(none — verification only)</files>
  <action>Start the app with `npm run tauri dev` from /Users/mimo/Documents/Projects/taskflow/taskflow, then stop and present the how-to-verify steps to the user. Change no code in this task. Fix anything the user reports in a follow-up commit, then return to this checkpoint.</action>
  <verify><human-check>User walks through how-to-verify steps 1-8 in the running app</human-check></verify>
  <done>User replies "approved"</done>
  <what-built>Shared sticky issue header (key/compact title left, actions right) on the full page and in the peek; big in-content title that collapses into the header on scroll; sticky section headers; peek header merged with Open full page + Close.</what-built>
  <how-to-verify>
    Executor first: `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npm run tauri dev` (or confirm it is already running). Do NOT mark visual quality done yourself.
    1. Open a story with description, attachments, subtasks and activity at /issue/KEY. Header spans content + sidebar, under the breadcrumb bar if present. At top: big text-2xl title in content, header left empty, actions right (Refresh, Pin, Edit, Log work, Open in Jira, ⋯).
    2. Scroll the content column: once the title leaves view, `KEY  title…` fades into the header; header height does not jump; hover shows full title.
    3. Keep scrolling: Description / Attachments / Subtasks / Activity headers stick under the header, opaque edge-to-edge (no text in side gutters), attachment tile overlays and row avatars pass beneath them; each header is pushed out by the end of its section; the comment composer still sticks at the bottom.
    4. ⋯ menu: Clone opens the clone modal; Copy Jira link shows "Copied". Edit opens edit modal; Log work works; Refresh spins; Pin toggles.
    5. Open an epic: Progress header sticks over the charts. Open an issue with AIO test runs: "AIO test runs" header matches the others and sticks.
    6. Peek a subtask from a list: one header with parent link, actions, Open full page, Close. Big text-xl title is the first thing in the peek; scroll → compact title appears. Resize the peek to 360px, ~480px and ~720px: nothing overflows, Close always visible, Log work / Jira / Open full page collapse to icons below ~520px.
    7. Check light and dark mode in the peek: header and stuck section headers match the peek surface (no colour band).
    8. While an issue is loading in the peek, Close still works.
    Known, intentionally out of scope (locked): Linked issues / Merge requests labels in peek do not stick.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues (with widths/screens)</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app → Jira browser URL | Open in Jira / Copy Jira link build `${jiraBaseUrl}/browse/${key}` — existing, unchanged logic moved to the header |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261113-01 | Tampering | IssueDetailHeader Open in Jira / Copy link | accept | Same openExternal + LinkContextMenu code moved verbatim; issue key comes from the app's own route/query, no new input |
| T-261113-02 | Information disclosure | Compact title tooltip | accept | Shows the same summary already rendered on screen |
| T-261113-SC | Tampering | package installs | accept | No new packages (RESEARCH Package Legitimacy Audit: none) |
</threat_model>

<verification>
- `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run` passes (pre-commit also enforces it).
- `npx tsc --noEmit` clean; biome clean on every touched file (gate on no NEW files flagged, never a hardcoded count).
- No action buttons remain in IssueDetailContent: `grep -c "Refresh issue\|Copy Jira link\|Clone issue" src/routes/dashboard/IssueDetailContent.tsx` returns 0.
- UAT checkpoint approved.
</verification>

<success_criteria>
- One shared IssueDetailHeader used by both layouts, fixed height, actions right, compact title on scroll.
- Big title first in the scroll content in page and peek.
- All SectionHeader-based section headers (plus converted AIO test runs) stick within their section, opaque, no gutter bleed, z-20.
- Peek: single header with parent link, Open full page, Close; no overflow at 360px.
- All preserved aria-labels intact; tests updated not weakened; user approves at UAT.
</success_criteria>

<output>
Create `/Users/mimo/Documents/Projects/taskflow/.planning/quick/261113-cth-issue-detail-redesign-sticky-title-heade/261113-cth-SUMMARY.md` when done (commit it — worktree untracked-SUMMARY memory).
</output>
