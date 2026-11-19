---
phase: quick-261119-vfy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/dev-tools/timeline-loads.ts
  - taskflow/src/lib/dev-tools/timeline-loads.test.ts
  - taskflow/src/routes/dev-tools/LogsTimeline.tsx
  - taskflow/src/routes/dev-tools/LogsTimeline.test.tsx
  - taskflow/src/routes/dev-tools/dev-tools-view.store.ts
  - taskflow/src/routes/dev-tools/LogsTab.tsx
  - taskflow/src/routes/dev-tools/DevToolsPage.tsx
  - taskflow/src/routes/dev-tools/DevToolsPage.test.tsx
  - taskflow/src/routes/dev-tools/utils.ts
  - taskflow/src/routes/dev-tools/TimelineConcurrencyStrip.tsx
  - taskflow/src/lib/dev-tools/timeline-layout.ts
  - taskflow/src/lib/dev-tools/timeline-layout.test.ts
  - taskflow/src/lib/dev-tools/time-scale.ts
  - taskflow/src/lib/dev-tools/time-scale.test.ts
  - taskflow/src/lib/dev-tools/query-activity.ts
  - taskflow/src/lib/dev-tools/query-activity.test.ts
  - taskflow/src/stores/query-activity.store.ts
  - taskflow/src/stores/query-activity.store.test.ts
  - taskflow/src/hooks/useQueryActivityCapture.ts
  - taskflow/src/hooks/useQueryActivityCapture.test.tsx
  - taskflow/src/stores/debug-log.store.ts
  - taskflow/src/main.tsx
autonomous: true
requirements: ["QUICK-261119-vfy"]

must_haves:
  truths:
    - "Timeline view shows page loads newest on top; each load header is one sticky line: chevron, page name, 'N requests · total time', tick labels (only when open), wall-clock start on the right"
    - "Only the newest load is open by default; clicking a header opens/closes it and that choice survives switching List/Timeline and Dev Tools tabs"
    - "A new load starts when the captured route differs from the previous request's route, or after more than 1.5 s with nothing in flight, using queuedAt ?? startedAt so a queued request never splits a load"
    - "Each request is one ~26px line: human label (operation, else a short readable path), status text only when not OK (amber 4xx, red 5xx/network error, muted 'loading'), a percent-positioned bar, and a duration ('412 ms', '1.2 s', '…' while pending)"
    - "Rows are sorted by start time with ties broken by id; queue wait shows as a faint same-hue lead-in; pending bars are faint with an outline and grow while now ticks"
    - "Hovering a row shows a 3-line tooltip: method + path; 'Took X after waiting Y ms for a Jira slot' (wait part only when queued); 'Started X after the page opened'"
    - "Clicking a row opens the existing LogInspector; ArrowUp/ArrowDown move selection in visual order, Escape clears; search, filters, Pause and Clear still apply"
    - "Burst picker, Live, Fit, zoom, brush, concurrency strip, limit line, cache lane, crosshair, peak/queued stats, hatching and the query-activity capture are gone with no dead code or tests left"
  artifacts:
    - path: "taskflow/src/lib/dev-tools/timeline-loads.ts"
      provides: "Pure load grouping, page names, row labels, status tone, bar geometry, ticks, tooltip lines, open-state helpers, formatMs"
      exports: ["groupLoads", "loadName", "requestLabel", "rowStatus", "loadSpan", "loadTicks", "barGeometry", "tooltipLines", "isLoadOpen", "visibleRequestIds", "formatMs", "LOAD_GAP_MS"]
    - path: "taskflow/src/lib/dev-tools/timeline-loads.test.ts"
      provides: "Unit tests for every export above"
    - path: "taskflow/src/routes/dev-tools/LogsTimeline.tsx"
      provides: "Load waterfall component (name | bar | duration grid)"
      min_lines: 120
    - path: "taskflow/src/routes/dev-tools/LogsTimeline.test.tsx"
      provides: "Component tests: grouping, open/close persistence, sort, status text, tooltip, selection/keyboard, pending growth, 1000 entries"
    - path: "taskflow/src/routes/dev-tools/dev-tools-view.store.ts"
      provides: "loadOpen record + setLoadOpen/resetLoadOpen replacing timeline window fields"
      contains: "loadOpen"
  key_links:
    - from: "taskflow/src/routes/dev-tools/LogsTab.tsx"
      to: "groupLoads"
      via: "useMemo over filtered entries, passed to LogsTimeline as loads"
      pattern: "groupLoads\\(filtered"
    - from: "taskflow/src/routes/dev-tools/LogsTab.tsx"
      to: "useListKeyboard"
      via: "visibleRequestIds(loads, loadOpen) as the timeline keyboard order"
      pattern: "visibleRequestIds"
    - from: "taskflow/src/routes/dev-tools/LogsTimeline.tsx"
      to: "useDevToolsViewStore loadOpen"
      via: "header click calls setLoadOpen; isLoadOpen decides rendering"
      pattern: "setLoadOpen"
    - from: "Clear buttons (LogsTab toolbar, DevToolsPage header)"
      to: "resetLoadOpen"
      via: "onClick handlers"
      pattern: "resetLoadOpen\\(\\)"
---

<objective>
Rebuild Developer Tools → Logs → Timeline as a simple load waterfall (name | bar | duration rows
grouped by page load) matching `timeline-mockup.html`, and delete the complex timeline machinery
(lanes, burst picker, Live/Fit, zoom/brush, concurrency strip, cache lane, query-activity capture).

Purpose: the 261119-tvz timeline was "extremely complicated and hard to orient in". The locked
decisions in 261119-vfy-CONTEXT.md define the replacement; they win over RESEARCH.md section 5.
Output: one pure model module with tests, a rewritten LogsTimeline + tests, a simplified view
store, and a codebase with the old timeline code fully removed.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261119-vfy-timeline-redesign-research-led-rebuild-o/261119-vfy-CONTEXT.md
@.planning/quick/261119-vfy-timeline-redesign-research-led-rebuild-o/timeline-mockup.html
@.planning/quick/261119-vfy-timeline-redesign-research-led-rebuild-o/261119-vfy-RESEARCH.md
@taskflow/src/routes/dev-tools/LogsTimeline.tsx
@taskflow/src/routes/dev-tools/LogsTab.tsx
@taskflow/src/routes/dev-tools/dev-tools-view.store.ts
@taskflow/src/routes/dev-tools/dev-tools-ui.tsx
@taskflow/src/lib/dev-tools/log-entry.ts
@taskflow/src/lib/dev-tools/queue-handoff.ts
@taskflow/src/components/app/sidebar-items.ts
@taskflow/src/routes/routes.tsx

Repo layout: git and `.planning` live at the outer `/Users/mimo/Documents/Projects/taskflow`; npm,
vitest, biome and tsc run in the inner `taskflow/` (always `cd taskflow` first). Source paths below
are relative to the outer root.

## Interfaces the executor works against (already exist)

- `ApiLogEntry` (`stores/debug-log.store.ts`): `id, timestamp, source, method, url, status: number | null, durationMs, state?, startedAt?, endedAt?, route?, queuedAt?, operation?`.
- `lib/dev-tools/log-entry.ts`: `isPending(e)`, `entryStart(e)`, `entryEnd(e, now)`, `nowMs()`.
- `lib/dev-tools/queue-handoff.ts`: `queueSplit(e) → { queuedMs: number | null; networkMs: number }`.
- `lib/dev-tools/log-stats.ts`: `urlPath(url)` (pathname, query stripped).
- `routes/dev-tools/LogsTab.tsx`: `displayPath(url)` (decoded path + query).
- `routes/dev-tools/dev-tools-ui.tsx`: `useListKeyboard(ids, selectedId, setSelectedId)` (ArrowUp/Down/Escape; focuses the n-th `[data-testid="devtools-row"]` inside the keydown target), `isTabStop(ids, selectedId, id)`, `ListRow` (overlay-button pattern: sibling `<button data-testid="devtools-row" aria-current tabIndex>` with `absolute inset-0 z-0 ... focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring`, content in a `pointer-events-none relative z-10` layer, selected = `bg-accent shadow-[inset_2px_0_0_var(--primary)]`).
- `components/app/sidebar-items.ts`: `SIDEBAR_NAV_ITEMS: { label, path }[]` (skip `#aio-dynamic`).
- App routes (`routes/routes.tsx`): `/`, `/dashboard`, `/settings`, `/sprint-board`, `/backlog`, `/epics`, `/releases`, `/worklogs`, `/standup-notes`, `/my-tasks`, `/release/:versionId`, `/dev-tools`, `/issue/:key`, `/merge-requests`, `/mr/:projectId/:iid`, `/aio-project/:projectKey`, `/aio-cycle/:projectKey/:cycleKey`, `/aio-cycle/:projectKey/:cycleKey/run/:runId`.
- `useNow(250, hasPending, pausedAt)` in LogsTab already supplies `now` (ticks only while something is pending, frozen when paused).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure load model (timeline-loads.ts) with unit tests</name>
  <files>taskflow/src/lib/dev-tools/timeline-loads.ts, taskflow/src/lib/dev-tools/timeline-loads.test.ts</files>
  <behavior>
    - groupLoads: sorts by (queuedAt ?? entryStart) then id; splits on route change between consecutive requests (only when both routes are defined) and on a gap > 1500 ms after the last completed end when nothing in the current load is pending; returns loads newest first; load id = `load-${firstEntryId}` and stays stable when later requests join.
    - groupLoads: a queued request whose startedAt is > 1.5 s after the previous end but whose queuedAt is within 1.5 s stays in the same load; a pending request keeps the load open regardless of the gap; route undefined never forces a split.
    - groupLoads: entries inside a load are sorted by entryStart ascending, ties by id (string compare); load.start = min(queuedAt ?? start); load.doneEnd = max end of non-pending entries; load.hasPending flag.
    - loadSpan(load, now): max(doneEnd, now when hasPending) - start, never below 1.
    - loadName: '/backlog' → 'Backlog', '/my-tasks' → 'My Tasks' (sidebar labels), '/issue/PROJ-12' → 'Issue PROJ-12', '/mr/17/42' → 'Merge request !42', '/release/1001' → 'Release 1001', '/aio-project/PRJ' → 'AIO project PRJ', '/aio-cycle/PRJ/CY-3' → 'AIO cycle CY-3', '/aio-cycle/PRJ/CY-3/run/9' → 'AIO test run 9', '/dev-tools' → 'Developer Tools', '/settings' → 'Settings', '/' → 'Home', '/some-new-page/x' → 'Some New Page', undefined or '' → 'Unknown page'.
    - requestLabel: trimmed operation when non-empty; else the last two decoded path segments ('https://x/rest/api/2/issue/PROJ-1/remotelink' → 'PROJ-1/remotelink'), '/' for an empty path, raw text on decode failure.
    - rowStatus: pending → { text: 'loading', tone: 'pending' }; status null → { text: 'error', tone: 'error' }; 5xx → { text: '500', tone: 'error' }; 4xx → { text: '404', tone: 'warn' }; 2xx/3xx → null.
    - formatMs: 0 → '0 ms', 412.4 → '412 ms', 1234 → '1.2 s', 12000 → '12 s'.
    - loadTicks(spanMs): step = first of [100, 250, 500, 1000, 2000, 5000, 10000, 20000, 30000, 60000] with spanMs / step ≤ 4 (else ceil to a whole minute multiple); ticks at step, 2·step, … strictly below spanMs, each { t, pct, label } with pct = t / (spanMs · 1.02) · 100 and label = formatMs(t). 1960 → steps of 500 ms (500, 1000, 1500).
    - barGeometry(entry, load, spanMs, now): left = (entryStart - load.start) / domain · 100, width = max(0.4, (entryEnd(e, now) - entryStart) / domain · 100) where domain = spanMs · 1.02; wait = { left, width } from queuedAt to entryStart only when queuedAt < entryStart, else null; tone from rowStatus (null → 'ok').
    - tooltipLines(entry, load, now): exactly 3 strings: `${method} ${displayPath(url)}`; done → `Took ${formatMs(networkMs)}` + (` after waiting ${formatMs(queuedMs)} for a Jira slot` only when queuedMs > 0); pending → `Still loading (${formatMs(now - start)} so far)` with the same optional wait suffix; `Started ${formatMs(entryStart - load.start)} after the page opened`.
    - isLoadOpen(loadOpen, id, index): explicit loadOpen[id] wins, else index === 0. visibleRequestIds(loads, loadOpen): entry ids of open loads in render order (loads newest first, rows start-ascending).
  </behavior>
  <action>
Create `taskflow/src/lib/dev-tools/timeline-loads.ts`: a pure module (no React, no DOM, no module-level mutable state; React Compiler safety) that implements every behavior above. It replaces `groupBursts` (adapted to loads per CONTEXT "Grouping rule") and moves the `formatOffset` formatting into `formatMs` so `time-scale.ts` can be deleted in Task 3. Export `LOAD_GAP_MS = 1500`, a `Load` interface (`id, route?: string, name: string, start: number, doneEnd: number, hasPending: boolean, entries: ApiLogEntry[]`), `RowTone = 'ok' | 'warn' | 'error' | 'pending'`, and the functions `groupLoads(entries, gapMs = LOAD_GAP_MS)`, `loadName(route)`, `requestLabel(entry)`, `rowStatus(entry)`, `formatMs(ms)`, `loadSpan(load, now)`, `loadTicks(spanMs)`, `barGeometry(entry, load, spanMs, now)`, `tooltipLines(entry, load, now)`, `isLoadOpen(loadOpen, id, index)`, `visibleRequestIds(loads, loadOpen)` where `loadOpen: Record<string, boolean>`. Implement the "nothing in flight" rule without `now`: a load with any pending entry never ends on a gap, so grouping is memoizable on entries alone (CONTEXT Performance). Route split compares the route of the current request with the route of the immediately previous request in sort order (CONTEXT Grouping rule); `name` = `loadName(route of the first request)`. Use `entryStart`/`entryEnd`/`isPending` from log-entry, `queueSplit` from queue-handoff, `urlPath` from log-stats; build the path-based page names from `SIDEBAR_NAV_ITEMS` (match `'/' + firstSegment` to `item.path`) plus the explicit detail-route rules in the behavior list. Do not import `displayPath` from `routes/dev-tools/LogsTab.tsx` into lib (layering); add a local helper that decodes `pathname + search` with the same try/catch semantics.

Write `timeline-loads.test.ts` covering every behavior bullet (use a local `mk(id, startOffset, ms, over)` entry factory like the one in the existing `LogsTimeline.test.tsx`). Write tests and implementation together and commit only when green (the pre-commit hook blocks RED commits).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/dev-tools/timeline-loads.test.ts && npx tsc --noEmit && npx biome check src/lib/dev-tools/timeline-loads.ts src/lib/dev-tools/timeline-loads.test.ts</automated>
  </verify>
  <done>timeline-loads.ts exports all listed functions/types; every behavior bullet has a passing test; tsc clean; biome reports no diagnostics on the two new files; nothing else changed yet so the app still compiles and the old timeline still works.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: New LogsTimeline waterfall, store simplification, LogsTab wiring, component tests</name>
  <files>taskflow/src/routes/dev-tools/LogsTimeline.tsx, taskflow/src/routes/dev-tools/LogsTimeline.test.tsx, taskflow/src/routes/dev-tools/dev-tools-view.store.ts, taskflow/src/routes/dev-tools/LogsTab.tsx, taskflow/src/routes/dev-tools/DevToolsPage.tsx, taskflow/src/routes/dev-tools/DevToolsPage.test.tsx</files>
  <behavior>
    - Three entries on '/backlog' then two on '/issue/PROJ-1' render two load headers, 'Issue PROJ-1' first; only it shows rows; its header shows '2 requests · …' and tick labels; the closed header shows no tick labels.
    - Clicking the closed header shows its rows (aria-expanded true); clicking the open one hides them; switching to List and back to Timeline (and to the Cache tab and back) keeps both choices; Clear resets to newest-open.
    - Rows inside a load render in start order with id tie-break regardless of input order.
    - A 200 row shows no status text; 404 shows amber '404'; 500 shows red '500'; status null shows 'error'; pending shows muted 'loading' and duration '…'.
    - Hovering a row shows role=tooltip with exactly 3 lines; a queued entry includes 'after waiting' and 'for a Jira slot'; a non-queued one does not; the third line starts with 'Started'.
    - Clicking a row opens the LogInspector (data-testid log-inspector); ArrowDown/ArrowUp move selection across visible rows of all open loads in visual order (skipping closed loads); Escape clears.
    - A pending entry's bar width (style width %) is larger after re-rendering with a later now; its queued lead-in renders when queuedAt < startedAt.
    - Search filter and Pause still apply in Timeline view (page-level test via DevToolsPage).
    - 1000 entries in one load render 1000 devtools-row buttons and re-render with a new now without error.
  </behavior>
  <action>
Store (`dev-tools-view.store.ts`, per CONTEXT "Removed" store bullet): delete `timelineBurstId`, `timelineWindow`, `timelineLive`, `setTimelineBurstId`, `setTimelineWindow`, `setTimelineLive`, `resetTimeline`; add `loadOpen: Record<string, boolean>` (explicit user choices only; absent = default newest-open via `isLoadOpen`), `setLoadOpen(id, open)` and `resetLoadOpen()`. This is the simple open-state map the CONTEXT asks for; a record instead of a set so an explicit close of the newest load is representable.

Rewrite `LogsTimeline.tsx` from scratch to match `timeline-mockup.html` (CONTEXT "Layout"). Props: `{ loads: Load[]; selectedId: string | null; onSelect: (id: string) => void; now: number }`. Root: `div data-testid="logs-timeline" className="relative"` with no own scroller (it lives inside the existing `devtools-list` overflow-auto scroller, which already has `relative`), all headers and rows as flat siblings so CSS `sticky top-0` headers stack like the mockup. One shared grid constant `grid grid-cols-[minmax(11rem,30%)_1fr_4.5rem] items-center` for headers and rows. Header per load: a real `<button type="button" data-testid="timeline-load" aria-expanded>` with `sticky top-0 z-20 h-8 border-t first:border-t-0 bg-background hover:bg-accent/50 text-xs` (z-20 so it paints over rows' z-10 content layer); name cell = lucide `ChevronRight` size-3 muted with `rotate-90` when open, `font-medium` page name, then muted `· N requests · formatMs(span)` ('1 request' singular); bar cell = relative box with '0' at left and `loadTicks` labels absolutely positioned at `pct%` with `-translate-x-1/2`, text-[11px] muted, only when open; right cell = `new Date(load.start).toLocaleTimeString()` muted, right-aligned, tabular-nums. Clicking toggles `setLoadOpen(load.id, !open)`. Rows (only for open loads): a `TimelineRow` that follows the ListRow overlay-button convention: wrapper `group relative h-[26px] text-xs hover:bg-accent/50` (selected adds `bg-accent shadow-[inset_2px_0_0_var(--primary)]`) with `data-timeline-row data-id`; sibling `<button type="button" data-testid="devtools-row" aria-label={`${method} ${urlPath(url)}`} aria-current tabIndex={isTabStop(visibleIds, selectedId, id) ? 0 : -1} onClick={() => onSelect(id)}>` with the ListRow focus-ring classes; content layer `pointer-events-none relative z-10 h-full` plus the shared grid classes (the grid lives on this layer, not on the wrapper, so the absolute overlay button never takes a grid cell), with three cells: name cell `truncate pl-7 pr-2.5` with `requestLabel` plus, only when `rowStatus` is non-null, a `ml-1.5` span coloured amber (`text-amber-700 dark:text-amber-400`), red (`text-red-600 dark:text-red-400`) or muted (`text-muted-foreground/70`); track cell `relative h-full` holding faint gridlines (`absolute inset-y-0 w-px bg-border/70`) at each tick pct, an optional wait segment and the bar (`absolute top-2 h-2.5 rounded-sm`, left/width as `%` from `barGeometry`); duration cell right-aligned muted tabular-nums `pr-4` showing `formatMs(networkMs)` or '…' when pending. Tones: ok `bg-foreground/30`, warn `bg-amber-500/55`, error `bg-red-500/60`, pending `bg-foreground/10 ring-1 ring-inset ring-foreground/30 motion-safe:animate-pulse`; wait segment uses the same hue at low opacity (`bg-foreground/10`, `bg-amber-500/15`, `bg-red-500/15`) with `rounded-l-sm`, no hatching (CONTEXT). Mark wait `data-testid="timeline-queued"` and bar `data-testid="timeline-bar"`. Only loads with `hasPending` read `now` for span/geometry; for other loads pass `load.doneEnd` as the effective now so their rows do not change between ticks (CONTEXT Performance). No virtualization: closed loads render only a header, bars are percent-positioned so there is no ResizeObserver or measuring, and the 1000-entry test guards the worst case; record this choice in the SUMMARY (CONTEXT Claude's Discretion). Tooltip: delegate `onPointerOver`/`onPointerMove` on the root via `closest('[data-timeline-row]')` and `onPointerLeave` to clear; render `role="tooltip" data-testid="timeline-tooltip"` absolutely inside the root (never portaled), 3 divs from `tooltipLines` (first in `font-mono`, the fixed words muted via simple splitting is optional; plain text is acceptable), positioned at pointer + (12, 14) and clamped to the root's clientWidth minus a fixed 320px width. No crosshair, no strip, no picker, no Live/Fit, no wheel listener, no cache lane, no query-activity store read, no `timelineKeyDown` export.

LogsTab wiring: compute `const loads = useMemo(() => (logView === 'timeline' ? groupLoads(filtered) : []), [logView, filtered])`, read `loadOpen` from the store, `const timelineIds = useMemo(() => visibleRequestIds(loads, loadOpen), [loads, loadOpen])`, `const timelineKeys = useListKeyboard(timelineIds, selectedId, (id) => setSelected('logs', id))` (visual order = DOM order of `devtools-row` buttons because closed loads render no rows), and delete `startOrderedIds` and the `timelineKeyDown` import. Pass `loads` to `LogsTimeline`. Add `useDevToolsViewStore.getState().resetLoadOpen()` to the Logs toolbar Clear handler, and to `handleClear` in `DevToolsPage.tsx`. In `DevToolsPage.test.tsx` replace the `resetTimeline()` call with `resetLoadOpen()`. Leave the query-activity clear lines for Task 3.

Rewrite `LogsTimeline.test.tsx` covering every behavior bullet: unit-render via `<LogsTimeline loads={groupLoads(entries)} … />` and page-level via `DevToolsPage` inside `QueryClientProvider` with seeded `useDebugLogStore` (keep the existing `mk`, `seed`, `renderPage`, save-attachment and plugin-opener mocks; `beforeEach` calls `resetLoadOpen()` and `setLogView('timeline')`). Delete every test for lanes, burst picker, Live/Fit, wheel zoom, strip/brush, limit line and cache lane (CONTEXT "Removed"). Commit only green.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dev-tools src/lib/dev-tools && npx tsc --noEmit && npx biome check src/routes/dev-tools/LogsTimeline.tsx src/routes/dev-tools/LogsTimeline.test.tsx src/routes/dev-tools/dev-tools-view.store.ts src/routes/dev-tools/LogsTab.tsx src/routes/dev-tools/DevToolsPage.tsx src/routes/dev-tools/DevToolsPage.test.tsx</automated>
  </verify>
  <done>Timeline renders the mockup layout from `loads`; open state lives in `loadOpen` and survives view/tab switches and resets on Clear; all behavior bullets pass; the dev-tools and lib/dev-tools suites are green; tsc clean; biome reports no new diagnostics on the touched files. TimelineConcurrencyStrip and the old helpers still exist but are no longer imported by LogsTimeline (removed in Task 3).</done>
</task>

<task type="auto">
  <name>Task 3: Delete the old timeline machinery and query-activity capture, then full suite</name>
  <files>taskflow/src/routes/dev-tools/TimelineConcurrencyStrip.tsx, taskflow/src/lib/dev-tools/timeline-layout.ts, taskflow/src/lib/dev-tools/timeline-layout.test.ts, taskflow/src/lib/dev-tools/time-scale.ts, taskflow/src/lib/dev-tools/time-scale.test.ts, taskflow/src/lib/dev-tools/query-activity.ts, taskflow/src/lib/dev-tools/query-activity.test.ts, taskflow/src/stores/query-activity.store.ts, taskflow/src/stores/query-activity.store.test.ts, taskflow/src/hooks/useQueryActivityCapture.ts, taskflow/src/hooks/useQueryActivityCapture.test.tsx, taskflow/src/main.tsx, taskflow/src/routes/dev-tools/LogsTab.tsx, taskflow/src/routes/dev-tools/DevToolsPage.tsx, taskflow/src/routes/dev-tools/DevToolsPage.test.tsx, taskflow/src/routes/dev-tools/utils.ts, taskflow/src/stores/debug-log.store.ts</files>
  <action>
Per CONTEXT "Removed". First prove each removal with grep from `taskflow/` (record the outputs in the SUMMARY): `grep -rnE "TimelineConcurrencyStrip|timeline-layout|time-scale|timelineBarClass" src` must list only the files being deleted/edited here; `grep -rnE "query-activity|QueryActivity" src` must list only main.tsx, LogsTab.tsx, DevToolsPage.tsx, DevToolsPage.test.tsx and the query-activity files themselves. If any other consumer appears, stop deleting that item and report it instead.

Then: delete `routes/dev-tools/TimelineConcurrencyStrip.tsx`; delete `lib/dev-tools/timeline-layout.ts` and its test (packLanes, groupBursts, concurrency/queued series; grouping now lives in timeline-loads.ts); delete `lib/dev-tools/time-scale.ts` and its test (createTimeScale, timeTicks, zoomWindow, fitWindow, brushWindow, formatOffset are all superseded by timeline-loads.ts); delete `lib/dev-tools/query-activity.ts`, `stores/query-activity.store.ts`, `hooks/useQueryActivityCapture.ts` and their three test files; remove the `useQueryActivityCapture` import and its call from `main.tsx` (around lines 37 and 663); remove the `useQueryActivityStore` import and `.clear()` call from `LogsTab.tsx` and from `DevToolsPage.tsx` `handleClear`; in `DevToolsPage.test.tsx` remove the `useQueryActivityStore` import and delete the two "Clear … also empties the query-activity store" tests (lines ~351-369) and any `activity` fixture they alone use; remove `timelineBarClass` from `routes/dev-tools/utils.ts` (plus the `isPending`/`ApiLogEntry` imports there if they become unused). Update the `route` field comment in `stores/debug-log.store.ts` from "used for burst labels" to "used for timeline load grouping". Grep `src/routes/dev-tools` and `src/lib/dev-tools` for leftover "burst", "lane", "Live", "zoom", "brush", "cache lane" wording in comments and fix any that describe removed behaviour. Do not touch `lib/epic-progress.ts` (its unrelated `timeTicks` stays). Keep in-flight capture, `queuedAt` handoff, LogInspector, the List view, Pause and filters unchanged (CONTEXT "Kept").

Finally run the full suite and the deletion grep below; never run `biome --write` across src (memory: scoped edits).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit && npm test && ! grep -rnE "packLanes|groupBursts|concurrencySeries|queuedSeries|zoomWindow|fitWindow|brushWindow|createTimeScale|formatOffset|MIN_WINDOW_MS|BURST_GAP_MS|TimelineConcurrencyStrip|useQueryActivityCapture|useQueryActivityStore|diffQueryActivity|correlatedRequestIds|snapshotQuery|timelineBurstId|timelineWindow|timelineLive|resetTimeline|setTimelineLive|timelineBarClass|timelineKeyDown|timeline-layout|time-scale|query-activity" src && npx biome check src/main.tsx src/routes/dev-tools src/lib/dev-tools src/stores/debug-log.store.ts</automated>
  </verify>
  <done>All listed files are deleted or cleaned; the deletion grep finds nothing; `npm test` passes in full; tsc clean; biome reports no new diagnostics in the touched directories (compare against the known baseline, do not require an absolute zero for untouched files); the app's Timeline shows the load waterfall and nothing else from the old design.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Captured API log → Dev Tools render | URLs, operation labels and routes from captured requests are rendered as text in a dev-only view |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-vfy-01 | Information disclosure | Timeline tooltip/labels | accept | Shows only already-redacted entry fields (lib/dev-tools/redact.ts runs at capture); dev tools gated on devToolsEnabled; no new storage |
| T-vfy-02 | Tampering (XSS) | requestLabel / loadName / tooltipLines | mitigate | Render as React text children only; no dangerouslySetInnerHTML; decodeURIComponent wrapped in try/catch |
| T-vfy-03 | Denial of service | 1000-entry render | mitigate | Grouping memoized on entries; closed loads render headers only; non-pending loads ignore now; 1000-row component test |
| T-vfy-SC | Tampering | npm installs | accept | No new dependencies |
</threat_model>

<verification>
- `cd taskflow && npx tsc --noEmit` clean.
- `cd taskflow && npm test` green after Task 3.
- Deletion grep (Task 3 verify) returns no matches.
- Biome check on touched files only; no `--write` across src.
- Before UAT handoff, render the Timeline in the app (or a throwaway preview) and compare against `timeline-mockup.html` (memory: screenshot before handing off).
</verification>

<success_criteria>
- Timeline = page-load groups (newest on top, newest open, sticky one-line headers) of one-line request rows on the name | bar | duration grid, matching the mockup.
- Grouping follows route change or a >1.5 s idle gap using queuedAt ?? startedAt.
- Status text and bar colour only when not OK; queue wait lead-in; pending bars grow.
- 3-line tooltip, click-to-inspect, ArrowUp/ArrowDown/Escape in visual order.
- Old timeline code, store fields, query-activity capture and their tests are gone; full suite green.
</success_criteria>

<output>
Create `.planning/quick/261119-vfy-timeline-redesign-research-led-rebuild-o/261119-vfy-SUMMARY.md` when done
</output>
