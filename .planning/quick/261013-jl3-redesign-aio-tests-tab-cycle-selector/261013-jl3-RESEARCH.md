# Quick 261013-jl3: Redesign AIO Cycles page - Research

**Researched:** 2026-10-13
**Domain:** React 19 / Tailwind v4 UI redesign over existing AIO internal REST endpoints
**Confidence:** HIGH for codebase patterns. MEDIUM for data shape. LOW for date and effort units (the captured payloads only contain nulls).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Selector (left panel)**
- Keep the left folder-tree panel, but polish it:
  - filter/search box for folders,
  - subtle selected state (NOT the solid `bg-primary` fill) consistent with other side panels / sidebar in the app,
  - folder icons,
  - aggregate counts (folder count includes descendants),
  - an "All cycles" root entry,
  - match visual language of the other side panels in the app.

**Cycle list columns (all from data the AIO API already returns)**
- Open/Closed status badge (`detail.isClosed`).
- Start–end dates; flag open cycles past their end date as overdue.
- Pass rate % next to the segmented progress bar; the bar gets a hover tooltip (≤4 rows) instead of the "3P 1F" letter legend.
- Effort: estimated vs actual (`summary.estimatedEffort` / `summary.actualEffort`).

**Closed cycles**
- Hidden by default; a "Show closed" toggle reveals them; the choice is remembered (persisted per user, e.g. in the existing aio-cycles-selection store).

**Row interaction**
- Whole row clickable (overlay-button pattern: absolute inset-0 button as a SIBLING of other interactive elements, per project memory); key text stays selectable/copyable.

### Claude's Discretion
- Exact layout, typography, column widths, header/toolbar design, empty/loading states, sort order, any count summary in the header.

### Must keep working
Folder selection persistence (`useAioCyclesSelectionStore`), the server-side folder filter including descendants, the Ungrouped (-1) bucket, `initializeAioStatusMap` init, the breadcrumb push on navigation to `/aio-cycle/:projectKey/:cycleKey`, the density variants, and the existing data-testids (update tests where behaviour intentionally changes).

### Project UI rules (memory)
- Colour means status only.
- Tooltips have at most 4 rows. No legends.
- One row is one line at every density. Drop columns instead of wrapping.
- Use div+flex rows: `flex-none` on fixed cells and `flex-1 min-w-0` on the one expanding cell.
- Full-row click uses a sibling overlay button.
- Hover affordances must not shift layout.
- Italic text inside `truncate` needs `pr-0.5`.
- `statusPillClass` needs a flex parent.
- Pre-commit runs biome, tsc and the full vitest suite, so RED and GREEN must land in one commit.
</user_constraints>

## Summary

All the data the locked columns need is already returned by the four calls the page makes. However, **every captured sample in API-EXAMPLES.md has `startDate`, `endDate`, `estimatedEffort`, `actualEffort` and `assignees` set to `null`**. Their real format and units have therefore never been seen. Build the date and effort cells to tolerate several formats, and **render a column only when at least one cycle in view has a non-null value**. A dead "—" column is worse than no column. Add one human-verify checkpoint that inspects a live `/testcycle/paged` and `/testcycle/summary/paged` response for a cycle known to have dates and effort.

The app already has every UI primitive needed:
- the Settings/Sidebar nav selected style
- the `Switch` component (this exact toggle was on this page until commit `99800f30`)
- `Tooltip` + `TooltipBody`/`TooltipRow`, as used by EpicProgressCell
- `aioCycleStatusPillClass` / `STATUS_PILL_LAYOUT_CLASS` + `tonePillClass`
- the EpicsPage flex-row anatomy
- the UnifiedTaskTable/IssueActivityGroup overlay-row pattern
- `formatDateRange` / `formatDateKey`
- the `@container` + `hidden @[Npx]:flex` column-drop pattern from MyTasksPage

Nothing new has to be installed.

**Primary recommendation:** Replace the `<table>` with EpicsPage-style flex rows under a sticky slim header. Restyle the folder tree with the Settings-nav selected classes and a sibling chevron button. Add `showClosed` to the existing persisted store. Fix `fetchAioCyclesWithDetail` to paginate, because "All cycles" will exceed the 500 cap.

**History warning:** Phase 57 UAT shipped a "Show closed" Switch and the user removed it (`99800f30`, "user requested removal"). The user has now explicitly asked for it again, with hidden-by-default. The difference that should make it stick: when closed cycles are hidden and a folder would be empty, the empty state must say so and offer a one-click reveal. Folders like "2023 - DONE" are probably all closed.

## 1. DATA — what each call actually gives us

| Call (service fn, `src/services/aio/cycles.ts`) | Fields usable for the UI | Evidence |
|---|---|---|
| `fetchAioFolderTree` (l.163) `GET /project/{id}/testcycle/folder` | `ID, name, parentID, rankOrder(null), description(null), children[]` — fully nested in one response | API-EXAMPLES `folder` [VERIFIED: API-EXAMPLES.md] |
| `fetchAioFolderCycleCounts` (l.195) `GET …/testcycle/folder/count?archive=false` | `Record<folderIdStr, count>`; `"-1"` = ungrouped | API-EXAMPLES `count` [VERIFIED] |
| `fetchAioCyclesWithDetail` (l.238) `POST …/testcycle/paged` | `detail.key, title, ownedByID, isClosed, startDate, endDate` (typed). The payload also has untyped fields: `objective, createdDate, updatedDate, closeDate, closedByID, jiraReleaseID[], jiraComponentID[], tags, archived`. `detail.folder` is always null. Envelope: `allIDs, startAt, maxResults, total, isLast` | API-EXAMPLES `paged` [VERIFIED]; values were null in all 3 samples |
| `fetchAioCycleSummaries` (l.287) `POST …/testcycle/summary/paged` body = ID array | `totalTests, testRunDistribution{statusId: count}`, plus `estimatedEffort, actualEffort, assignees, totalRuns, totalTestsWithDS` | API-EXAMPLES `paged2` [VERIFIED]; **effort/assignees null in all 7 samples** |
| `fetchAioProjectConfig` (l.437) | `testRunStatus[]: {ID, name, statusType, color}`. Live IDs are 51 Not Run, 52 In Progress, 53 Passed, 54 Failed, 55 Blocked, 901 N/A (statusType PASSED) | 57-UAT fix #5, test fixture [VERIFIED] |

### Answers to the specific questions

- **startDate / endDate format: UNKNOWN [LOW].**
  - API-EXAMPLES prose says "ISO date strings or null", but no non-null sample exists.
  - The sibling AIO internal endpoint `testcasewithrun/paged` returns `updatedDate` as an **epoch-ms number** (`cycles.ts:328,403`). `issue-steps.ts:224` already has `normalizeRunDate(string|number)` for exactly this ambiguity.
  - Write a tolerant `toDateKey(raw: unknown): string | null`:
    - a number becomes `toLocalDateString(new Date(n))`
    - a string matching `^\d{4}-\d{2}-\d{2}` becomes its first 10 chars
    - anything else becomes null
  - Then format with `formatDateRange` / `formatDateKey` (`src/lib/epic-progress.ts:79,1928`).
  - Widen the type to `startDate: string | number | null` [ASSUMED].
- **The `columns` request field may gate which detail fields get populated [ASSUMED].**
  - The request sends `PAGED_COLUMNS = ['key','title','ownedByID','caseProgress','jiraComponentID']` (`cycles.ts:226`).
  - `isClosed` comes back without being listed, so gating is not proven.
  - Adding `'startDate','endDate'` is harmless. Do it, and verify live.
- **estimatedEffort / actualEffort units: UNKNOWN [LOW].**
  - AIO docs say Cycle Summary returns "estimated and actual effort". The run-create sample posts `effort: 120`, which looks like seconds. The AIO UI displays "4hr 8min".
  - Assume **seconds** and format as `Xh Ym` / `Ym`.
  - Hide the column when all values in view are null.
  - The live checkpoint must confirm the unit. Compare against the AIO web UI value for the same cycle.
- **`assignees`: not usable.** It is always null and its type is `unknown`. Drop it.
- **`isClosed`: reliable as a boolean [MEDIUM].** It is always present (non-null) in the samples. `closeDate`/`closedByID` also exist and could feed a tooltip. No contradicting evidence was found.
- **Do folder counts include descendants? Probably not (direct counts only) [ASSUMED, MEDIUM].**
  - The page already sends the **subtree** ID list as `folderID IN [...]` (`collectSubtreeIDs`, page l.76/330). UAT fix #6 needed that to make a parent show its children's cycles, which suggests the server associates each cycle with one folder.
  - Aggregate client-side: `agg(node) = (count[node.ID] ?? 0) + Σ agg(child)`. The "All cycles" total is `Σ agg(roots) + count['-1']`.
  - Verify in the checkpoint: for a parent with non-empty children, the aggregate badge should equal the number of rows loaded with Show closed on.
  - Caveat: counts use `archive=false` while `/paged` sends no archive filter, so archived cycles could make the list exceed the badge.
- **"All cycles": cheap and supported.** Omitting `folderID` returns all project cycles (probe A5; code l.252 already skips `folderID` when `folderIds` is empty).
  - Use sentinel `0` in local state and the store. `-1` is Ungrouped and `null` is "nothing selected".
- **Pagination: BUG (the fetch-once page-cap pitfall).**
  - `fetchAioCyclesWithDetail` sends `startAt: 0, maxResults: 500` once and never loops.
  - The sample project's count map sums to roughly 1,300 cycles, so "All cycles" **will truncate**.
  - Fix:
    - Loop while `!isLast && items.length > 0`, advancing `startAt += page.items.length`. The server may cap below 500, so do not advance by the requested size; same lesson as `jira.ts:403`.
    - Concatenate `items` and keep the first page's `allIDs`.
  - The summaries call already posts all `allIDs` in one body, so it is fine.
  - Add a cycles.test.ts case for 2 pages.
- **Open/closed filter: client-side only.** No `isClosed`/status filter exists in any captured request body or in the probe findings. A filter key cannot be guessed. Filter `items` in a `useMemo`.
  - Side effect: folder counts include closed cycles. Keep showing the server totals (honest "N cycles in folder"), and in the list toolbar show `{open} open · {closed} closed`.

## 2. CONSISTENCY — patterns to reuse (file:line, exact classes)

| Need | Reuse | Exact classes / API |
|---|---|---|
| Side-panel container | `routes/settings/Settings.tsx:73-75` | `w-52 shrink-0 border-r border-border flex flex-col gap-0.5 px-2 py-6 overflow-y-auto`. Use `w-64`, keep `border-r border-border`, drop `bg-muted/10` |
| Selected / unselected nav item | `Settings.tsx:83-88`, `components/app/Sidebar.tsx:65-70` | base `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full text-left`; selected `bg-accent text-accent-foreground font-semibold`; idle `text-muted-foreground hover:bg-accent hover:text-accent-foreground`; plus `aria-current="page"`. Add density: `py-2 density-compact:py-1 density-comfortable:py-3` (Sidebar l.66) |
| Search input | `routes/dashboard/MergeRequestListPage.tsx:146-154` | wrapper `relative`; icon `absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground`; input `w-full pl-8 pr-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring`. Clear-X pattern: `UnifiedFilterBar.tsx:104-112` |
| Toggle | `components/ui/switch.tsx` (`checked`, `onCheckedChange`, `role="switch"`) | Exact prior usage: `git show 99800f30`, i.e. `<Switch id="show-closed" …/><label htmlFor="show-closed" className="text-sm">Show closed</label>` in a `flex items-center gap-2`. Use `text-xs text-muted-foreground` in the toolbar |
| Status pill | `lib/statusStyles.ts:84,99,126,143` | `aioCycleStatusPillClass('Active'|'Closed')` (blue / muted). Overdue: `` `${STATUS_PILL_LAYOUT_CLASS} ${tonePillClass('red')}` ``. **Wrap in `<div className="flex">`** (EpicsPage.tsx:86-92). Pill `min-w-[5.5rem]` needs a cell of at least `w-28` with `px-2` |
| Segmented bar + tooltip | `routes/dashboard/EpicProgressCells.tsx:76-120` | `<Tooltip><TooltipTrigger delay={0} render={<div/>} role="img" aria-label=… className="w-16 py-1 -my-1">` → bar `flex h-1.5 w-full overflow-hidden rounded-full bg-muted`; `<TooltipContent><TooltipBody title=…><TooltipRow color=… label=… value=…/>` (`components/ui/tooltip-body.tsx`). The label beside it: `text-xs text-muted-foreground tabular-nums whitespace-nowrap` |
| Status colours | current page l.243-255 and `AioCycleDetailPage.tsx:904-927` | pass `bg-green-500`, fail `bg-red-500`, blocked `bg-orange-400`, in-progress `bg-blue-500` (detail page; the list uses `blue-400`, so unify to 500), not-run = track `bg-muted`. Tooltip colours: `var(--color-green-500)` etc., the same literal-var style as `STATUS_CATEGORY_COLOR` (statusStyles.ts:26) |
| Flex row anatomy | `routes/dashboard/EpicsPage.tsx:35,51-113` | `CELL_PADDING = 'py-2 density-compact:py-1 density-comfortable:py-3'`; row `flex w-full items-center border-b border-border hover:bg-muted/30 transition-colors`; key cell `flex-none w-24 pl-4 pr-2 whitespace-nowrap` + `font-mono text-xs text-muted-foreground`; one `flex-1 min-w-0 px-2 overflow-hidden` cell |
| Overlay full-row click | `routes/standup-notes/IssueActivityGroup.tsx:220-239`, `release-detail/UnifiedTaskTable.tsx:854-887` | row `relative …`; first child `<button type="button" aria-label="Open {key} {title}" className="absolute inset-0 rounded cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"/>`; inert cells `pointer-events-none relative`; interactive cells `relative z-10` |
| Page header | `EpicsPage.tsx:254-255`, `AioCycleDetailPage.tsx:839-845` | `flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0` + `h1.text-xl.font-semibold`; pill next to title uses `flex items-center gap-3` |
| Subtitle / count line | `my-tasks/MyTasksPage.tsx:755-760` | `text-xs text-muted-foreground tabular-nums truncate`, `·` separators with `mx-1` |
| Responsive column drop | `MyTasksPage.tsx:750,797` | parent `@container`; cell `hidden @[Npx]:flex`. This queries the container, so it also reacts to sidebar collapse |
| Avatar + name | `components/ui/cached-avatar.tsx` (EpicsPage l.107) | `<CachedAvatar url={user?.avatarUrls?.['48x48'] ?? null} name=… size={20}/>`. `fetchJiraUserByUsername` returns `JiraAssignableUser` with `avatarUrls` (`services/jira/users.ts:85`) |
| Dates | `lib/epic-progress.ts:79` `formatDateKey` ("Oct 9"), `:1928` `formatDateRange(a,b,today)` ("Oct 9 – 28"); `lib/local-date.ts` `toLocalDateString` | Never `toLocaleDateString` (`standup-date.ts:7`) |
| Empty / error | `components/ui/empty-state.tsx` (`icon,title,subtitle,action`), `error-state.tsx` | Already used on the page |
| Icons (lucide 0.577.0, verified in node_modules) | `Folder`, `FolderOpen`, `Layers` (All cycles), `Inbox` (Ungrouped), `Search`, `ChevronRight`, `FlaskConical` | — |

`src/routes/dashboard/AioCyclesSkeleton.tsx` is **unused** (no imports found). Either delete it or ignore it. Do not update it thinking it is live.

## 3. PERSISTENCE

`src/stores/aio-cycles-selection.store.ts` uses zustand `persist` with `createTauriStorage('aio-cycles-selection.json')`, `version: 0`, and an identity `migrate`. The default `persist` merge is shallow (`{...initial, ...persisted}`), so a new key with a default value hydrates correctly for existing users. **No version bump is needed.**

```ts
showClosed: boolean;                       // default false
setShowClosed: (v: boolean) => void;       // set({ showClosed: v })
```

Make the setting global, not per-project ("remembered per user"). Selecting "All cycles" stores `0` through the existing `setSelectedFolder(projectKey, 0)`. The restore validation (page l.383-390) must accept `stored === 0` as valid.

Update:
- `aio-cycles-selection.store.test.ts`: add a showClosed round-trip test.
- **The page test's store mock (`AioProjectOverviewPage.test.tsx:21-30`)**: add `showClosed` and `setShowClosed` to the state object. If you don't, the selector returns `undefined`.

## 4. PITFALLS

1. **Tests assert the old selected class.** `AioProjectOverviewPage.test.tsx:312,316,351` check `className` for `'bg-primary'`. Switch them to `getAttribute('aria-current') === 'page'`.
   - Keep the `data-testid`s `folder-node-{ID}`, `folder-node-ungrouped`, `cycle-row-{ID}`, `progress-bar` and `owner-cell`. The test at l.395 clicks `folder-node-101` to select, so put the testid on the **select** button, not the chevron.
   - Add `folder-node-all`.
2. **`getByText('3')` (test l.173) breaks easily.** It matches the folder count. Aggregate counts, the toolbar count line or the pass % could add another "3". Scope it with `within(getByTestId('folder-node-101'))`.
3. **Click semantics.** The current row both toggles and selects (l.139-142), so clicking a selected expanded folder collapses it. `toggleFolder` also *clears* the selection when you collapse an ancestor (l.432-440).
   - Make the chevron a **sibling** button (`relative z-10`) and keep the overlay/select button separate.
   - Selecting expands but never collapses.
   - Drop the clear-on-collapse behaviour. The list is still valid.
   - No nested `<button>`s (memory: overlay sibling).
4. **The Ungrouped sentinel is `-1` and All is `0`.** `activeFolderIds` (l.330) must map `0` to `[]` and `-1` to `[-1]`. The cycles query key already includes `selectedFolderID`.
5. **Page cap.** See §1. Without the loop, "All cycles" silently shows 500 of roughly 1,300.
6. **All-closed folder looks empty.** This is what probably got the toggle removed last time. When `items.length > 0 && visible.length === 0`, show an EmptyState with title "All {n} cycles in this folder are closed" and `action={<Button variant="outline" size="sm" onClick={() => setShowClosed(true)}>Show closed</Button>}`.
7. **Table vs flex: use flex rows.**
   - Per-row truncation and dropping columns at narrow widths both need it (memory: table-vs-flex, one-row-one-line).
   - Every variable cell is `flex-none` with explicit width, so the WebKit 0-width-column issue does not apply. That issue was specific to virtualized absolute rows, and this list is short and not virtualized.
   - Render the header row with the **same** cell class constants so columns line up.
8. **statusPill needs a flex parent.** Use `<div className="flex">` around the pill span.
9. **The tooltip trigger sits over the overlay.** The progress-bar trigger needs `relative z-10` to receive hover. That makes clicking exactly on the bar not open the row, which is acceptable; UnifiedTaskTable does the same for actionable cells. Every other cell is `pointer-events-none relative`.
10. **Key selectable.** Key cell: `relative z-10 select-text cursor-text` (a span, not a button). Text is selectable and a click there does not navigate. The `title` cell stays `pointer-events-none` so the row opens.
11. **Hover with no layout shift.** No hover-only icons in rows. If a chevron "open" affordance is wanted, give it a fixed `w-4` slot with `opacity-0 group-hover/row:opacity-100`.
12. **Italic.** If "No dates" / "Ungrouped" are styled italic inside `truncate`, add `pr-0.5`.
13. **`initializeAioStatusMap` stays in its effect** (l.310). Do not move or remove it. The detail page depends on it (memory: module-map mount order).
14. **Breadcrumb push** (l.609-612) must move into the overlay button's `onClick` unchanged: `useBreadcrumbStore.getState().push({ label: 'AIO Cycles', path: location.pathname })` then `navigate(...)`.

## 5. Recommended layout spec

**Header** (`px-6 py-4 border-b border-border flex-shrink-0`):
- `<h1 class="text-xl font-semibold">Test cycles</h1>`
- next to it, the project key as `text-sm text-muted-foreground font-mono`
- right side: nothing (keep it clean)

**Left panel** (`w-64 shrink-0 border-r border-border flex flex-col min-h-0`):
- Search: `px-2 pt-3 pb-2` holding the MR-list search input at `py-1` / `text-xs` size, placeholder "Filter folders…".
  - While a query is set, show only matching nodes plus their ancestors, all expanded.
  - "No folders match" in `px-3 py-2 text-xs text-muted-foreground`.
- Scroll list: `flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5`.
  1. **All cycles** (`Layers`), count = total.
  2. A divider: `my-1 border-t border-border/50`.
  3. Tree nodes.
  4. **Ungrouped** (`Inbox`) at the bottom if `count['-1'] > 0`.
- Node row: `relative flex items-center gap-1.5 rounded-lg pr-2 text-sm` + density py + selected/idle classes from §2. `paddingLeft = 8 + depth*14`.
  - `[chevron button size-4 relative z-10 | spacer size-4]`
  - `Folder`/`FolderOpen` icon `size-4 shrink-0` (open when expanded)
  - name `flex-1 min-w-0 truncate`, with `title` = full name
  - count `ml-auto text-xs tabular-nums text-muted-foreground` (plain number, not a Badge; aggregate; hidden when 0)
  - The overlay select button carries `data-testid` and `aria-current`.

**Right panel** (`flex-1 min-w-0 flex flex-col @container`):
- Toolbar `flex items-center gap-3 px-4 py-2 border-b border-border`:
  - selected folder path `text-sm font-medium truncate` (e.g. `Revamp 2023`, with the full path in `title`)
  - count `text-xs text-muted-foreground tabular-nums`: `12 open · 30 closed`
  - `ml-auto`: Switch + "Show closed" label
- Column header (sticky `top-0 bg-background border-b border-border text-xs font-medium text-muted-foreground`), using the same cell classes as the rows.
- Rows (sorted: open first, then key number descending so the newest is first; parse the `-CY-(\d+)` suffix numerically):

| Cell | Classes | Content | Drops below |
|---|---|---|---|
| Key | `flex-none w-28 pl-4 pr-2 relative z-10 select-text` | `font-mono text-xs text-muted-foreground` | never |
| Name | `flex-1 min-w-0 px-2 pointer-events-none relative` | `truncate text-sm` + `title` | never |
| Status | `flex-none w-28 px-2` + inner `div.flex` | pill: Open (blue), Overdue (red: open AND endDate < today), Closed (muted) | never |
| Progress | `flex-none w-36 px-2 flex items-center gap-2` | bar `w-20` (tooltip trigger, `data-testid="progress-bar"`) + pass % `w-9 text-right text-xs tabular-nums`. No summary means "—"; summary loading means skeleton `h-1.5 w-20` | never |
| Dates | `flex-none w-32 px-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap hidden @[720px]:flex` | `formatDateRange`; one side only: `From Oct 9` / `Until Oct 28`; none: "—". Overdue end date gets `text-red-600 dark:text-red-400` (a status colour). **The whole column is omitted when no visible cycle has a date** | 720px |
| Owner | `flex-none w-36 px-2 hidden @[880px]:flex items-center gap-1.5` | CachedAvatar 20 + name `truncate text-xs`; testid `owner-cell` kept | 880px |
| Effort | `flex-none w-28 pl-2 pr-4 text-right text-xs tabular-nums hidden @[1040px]:flex justify-end` | `{actual} / {estimated}` in `Xh Ym`; missing side shows "—". **Omitted when all values in view are null** | 1040px |

- **Pass %** = `pass / totalTests` (same as the green segment width; 901 N/A counts as pass via statusType PASSED). Show "—" when `totalTests === 0`.
- **Tooltip** (`TooltipBody title="{totalTests} tests"`):
  - non-zero rows only, in the order Passed, Failed, Blocked, In progress, Not run, each `TooltipRow color=var(--color-…) value={n} sub={pct%}`
  - if all 5 are non-zero, merge In progress + Not run into one "Remaining" row so there are never more than 4 rows
  - no note
- **States:**
  - folder skeleton: rounded-lg bars `h-7` in the same `px-2 gap-0.5`
  - row skeleton: 6 rows with identical cell widths (no wrapper padding, per EpicsPage l.299 comment)
  - empty folder: FlaskConical "No cycles in this folder"
  - all closed: see Pitfall 6
  - errors: keep ErrorState and its retry keys
  - `selectedFolderID === null` is now only a transient pre-hydration state, so show the skeleton instead of "Select a folder"

## Validation Architecture

| Property | Value |
|---|---|
| Framework | vitest + @testing-library/react (jsdom) |
| Quick run | `cd taskflow && npx vitest run src/routes/dashboard/AioProjectOverviewPage.test.tsx src/stores/aio-cycles-selection.store.test.ts src/services/aio/cycles.test.ts` |
| Full suite | `cd taskflow && npm run test` (also runs in pre-commit with `biome check --staged` + `tsc --noEmit`) |

| Behaviour | Test |
|---|---|
| Pagination concatenates pages until isLast | cycles.test.ts (new): 2 mocked pages, items.length = sum |
| showClosed persists / default false | store test (new) |
| Closed hidden by default; Switch reveals; all-closed empty state button reveals | page test (restore the deleted test from `99800f30`, adapted) |
| Selected folder uses aria-current, not bg-primary | update tests at l.312/316/351 |
| Aggregate count (parent = own + children) | page test: tree 101→{103}, counts {101:1,103:2}, badge "3" via `within` |
| All cycles calls fetch with `[]` folderIds | page test: click `folder-node-all`, assert last call arg 4 is `[]` |
| Overdue pill when open + endDate past | page test with a fixture endDate in the past (string and epoch-ms variants) |
| Effort/Dates columns omitted when all null | page test: `queryByText('Effort')` is null with the current fixtures |
| Row overlay navigates + pushes breadcrumb | page test: click `Open PROJ-CY-1 …` button |

Manual: one human-verify checkpoint against the live AIO instance to confirm (a) the date format, (b) the effort unit, (c) that aggregate counts equal loaded rows, and (d) that "All cycles" loads past 500.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | start/endDate are ISO string or epoch-ms | The tolerant parser covers both; another format shows "—" |
| A2 | Effort is in seconds | Values off by 60× or 1000×. Must confirm live before shipping the column |
| A3 | Folder counts are direct, not cumulative | Aggregation double-counts parents. Verify live; if cumulative, use the raw count |
| A4 | Adding startDate/endDate to `columns` is harmless or helpful | Low. The server ignores unknown columns; at worst no change |
| A5 | `/paged` honours `startAt` for subsequent pages | If it ignores it, the loop would repeat page 1. Guard: stop when a page adds no new IDs |
| A6 | No server-side isClosed filter exists | Only a perf matter; client filter is correct either way |

## Sources
- Codebase: files and lines cited inline (verified by reading in this session)
- `.planning/milestones/v1.8-phases/57-*/API-EXAMPLES.md`, `57-PROBE-FINDINGS.md`, `57-UAT.md`; commit `99800f30`
- [AIO Tests REST APIs (KB)](https://aiosupport.atlassian.net/wiki/spaces/AioTests/pages/2025619567): Cycle Summary returns estimated/actual effort; units not stated
- [AIO Python code sample](https://aiosupport.atlassian.net/wiki/spaces/AioTests/pages/2025652401): `effort: 120` on run create (unit implied, not stated)

**Valid until:** 2026-11-12 (stable internal codebase; AIO internal API is undocumented and could change).
