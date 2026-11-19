# Quick 261119-vfy: Logs Timeline redesign - Research

**Researched:** 2026-11-19
**Domain:** Developer-tool network/trace visualisation (React 19 + React Compiler, Tailwind v4, TanStack Query 5.91, TanStack Virtual 3.13, Tauri WKWebView)
**Confidence:** HIGH for the audit and stack facts (read from code and node_modules). MEDIUM for the design recommendation (based on documented reference tools plus the user's recorded preferences). MEDIUM-LOW for how many requests query attribution will link (not measured yet, needs a spike).

## Summary

The current timeline (`LogsTimeline.tsx`, 583 lines, plus `TimelineConcurrencyStrip.tsx`) plots requests like a Gantt chart packed into lanes. A bar has no fixed row and usually no label. The visible window comes from three overlapping state sources and can be changed in four different ways. Concurrency, queueing and cache activity each have their own visual encoding, and each one needs a legend the user does not want. The result is accurate but hard to read: to find anything you have to hover.

Every reference tool that people find easy to read uses **one row per item with a label column and a bar column on a shared axis**, sorted by start time. This covers Chrome Network, Firefox Network, Safari Network/Timelines, and the waterfalls in Jaeger, Honeycomb, Datadog and Sentry. Packed lanes appear only in profilers (Perfetto, flame charts), where a lane has a fixed meaning (a thread or a call depth). Here a lane means nothing. In these tools concurrency reads as vertical overlap of labelled rows ("staircase"), and causality reads as nesting (parent span, then child spans).

**Primary recommendation:** Rebuild the view as a **Load waterfall** (Direction A). Each "load" (today's burst, renamed) is a calm, collapsible section: a one-line header with the route, request count, duration and peak, and a sticky axis that starts at 0 ms for that load. Inside it there is **one virtualized row per request**, sorted by start time: a label column (operation or short path, status text) and a bar column scaled to that load. The queue wait is a light lead-in on the row. Hovering the bar area shows a time crosshair that reads "+412 ms · 5 in flight · 2 queued". Cut the burst picker, Live, Fit, ⌘-wheel zoom, the separate strip, the cache lane and lane packing. In a second step, behind a measured spike, add **query parent rows** (Direction B-lite, one level of nesting). The reliable hook for this is TanStack Query's `persister` option, plus a sync-slot handoff through the Jira limiter. The details are below.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Request timing capture (start/end/queuedAt/route/operation) | Client capture (`lib/apiFetch.ts`, `lib/concurrency.ts`) | — | Already exists; unchanged in Direction A |
| Query-run capture (queryFn start/end + hash) for attribution | Client capture (QueryClient `defaultOptions.queries.persister` in `main.tsx`) | `stores/query-activity.store.ts` | Only place every queryFn execution passes through (verified in query-core) |
| Load grouping, row model, scales, tick maths | Pure TS (`lib/dev-tools/*`) | — | Testable without DOM; matches existing convention |
| Rendering, virtualization, hover crosshair, selection | Browser UI (`routes/dev-tools/`) | — | View only; reads stores |
| Inspector | Existing `LogInspector` | — | Unchanged; selection id stays `tabs.logs.selectedId` |

## Project Constraints (from CLAUDE.md and memory)

There is no `./CLAUDE.md` in the working dir; the constraints come from the user's memory notes, which carry the same authority:
- **Colour = status only.** No legends. Tooltips have at most 4 rows plus at most one short note. Everything hoverable, list items clickable, keyboard reachable (`feedback_dashboard_ui_preferences.md`).
- **One row = one line** at every width. Drop columns instead of stacking (`feedback_one_row_one_line.md`).
- **Calm lists:** quiet subheads, an aligned grid, one affordance per row, no chevron clutter or badges (`feedback_calm_history_lists.md`). Note: that note rejects *collapsible group rows that look weaker than their children*. Group headers must be quiet but clearly a tier above the rows.
- **In-row mini charts without an axis confused the user and were removed** (`feedback_dev_tools_means_in_app_page.md`, commit 807822f3). Every bar must sit under a visible axis.
- **No settings on the dev-tools page.** All settings live in Settings → Advanced. Persisted pane widths go in `settings.store` with a migration.
- **Flex rows, not `<table>`, in virtualized lists** (`project_virtualized_table_zero_width_col.md`, `feedback_table_vs_flex_rows.md`).
- **The scroller needs `relative`** when it holds abspos/sr-only content (`project_sr_only_scroller_needs_relative.md`).
- **React Compiler:** never derive render values from module-level mutable state (`project_react_compiler_module_read.md`).
- **Screenshot before handing off.** Render before restyling (`feedback_screenshot_before_restyling.md`).
- Repo layout: `.planning` and git sit at the outer `taskflow/`. npm, vitest and biome run in the inner `taskflow/taskflow/`.

## 1. Audit of the current timeline

### What it renders (all in `taskflow/src/routes/dev-tools/LogsTimeline.tsx` unless noted)

| Element | Where | Notes |
|---|---|---|
| Burst picker (Select: "All" + 20 bursts as "route · N requests · ms") | 246-265, 330-341 | Bursts = 1.5 s idle gap (`lib/dev-tools/timeline-layout.ts:7`, `groupBursts` 49-76) |
| Live toggle | 269-278, 342-351 | Clears burst + window when turned on; freezes window when turned off |
| Fit button | 266-268, 352 | Behaves differently with Live on (`null`) vs off (`baseWindow`) |
| "⌘ + scroll to zoom" hint + native wheel listener | 226-244, 355 | Zoom clamps to `allBounds`; turns Live off |
| Concurrency strip (40 px SVG) | `TimelineConcurrencyStrip.tsx:82-153` | Filled in-flight area, dashed stacked queued outline, dashed "limit 6" line, "peak N" text, drag-to-brush |
| Axis row (ticks relative to window start) | 381-391; `time-scale.ts:28-44` | Labels re-zero on every zoom/brush |
| Gridlines + burst separators + burst label row | 392-424 | Separator row only appears when >1 burst is visible |
| Cache lane (8 px glyphs: circle = fetch, diamond = invalidated, red dot = error) | 70-81, 426-452 | Hover dims all requests not starting within 150 ms (`query-activity.ts:65-79`) |
| Request lanes (greedy packing) | 187-193, 454-513; `timeline-layout.ts:22-36` | One bar per request, lane = first free lane |
| Bar label (method + last 2 path segments) only if bar ≥ 60 px | 49, 84-87, 504-508 | |
| Queued lead-in (hatched) | 74-75, 466-486 | Second hatch pattern, next to the pending hatch at 53-54 |
| Tooltip (4 rows: path, status, duration+queued, "starts +X") | 535-583 | "starts +X" is relative to the *window*, not the load |
| Keyboard ←/→ by start time, Esc | 97-123 | Focus jumps between lanes |

### Why it is hard to orient in (grounded)

1. **Rows have no identity.** `packLanes` assigns the lowest free lane (`timeline-layout.ts:26`), and it reruns on just the in-window spans (`LogsTimeline.tsx:190-191`). So a request's vertical position depends on whatever else is in the window. It **moves when you zoom, brush or pick a burst**, and one lane holds unrelated requests side by side. You cannot follow a request from one view to the next, and "lane 3" means nothing.
2. **Bars are mostly unlabelled.** A label only appears at ≥ 60 px wide (`:49`, `:504`). On a 1-3 s load with 20-200 ms requests most bars are narrower than that. Even when it shows, the label is `shortPath` (the last two path segments, `:84-87`), e.g. `2/search` for every Jira search. The meaningful `operation` label (e.g. "Search Issues") is never shown on the timeline. Identifying anything takes a hover.
3. **The window model is confusing.** Three pieces of store state (`timelineBurstId`, `timelineWindow`, `timelineLive`; `dev-tools-view.store.ts:45-50`) combine in `baseWindow`/`win` (`:177-182`). Four separate inputs change the window: picker, brush, ⌘-wheel and Fit. Live, Fit and the picker each reset different subsets of that state (`:255-278`). The axis re-zeroes to the window start on every change (`time-scale.ts:39-41`), and so does the tooltip's "starts +X" (`:579`). "0 ms" never means "the load started".
4. **Bursts are a hidden concept.** The 1.5 s gap rule is invisible. The only representations are a Select of text strings and, when more than one burst is visible, a truncated 10 px label row plus faint separator lines (`:400-424`). By default only the latest burst shows, so older activity only appears if you open the picker.
5. **Four encodings need a legend:** the strip (area vs dashed stacked outline vs dashed limit line), the cache glyph shapes, the two hatch patterns (pending vs queued, `:53-54` vs `:74-75`), and dimming on marker hover. That breaks the "no legends, colour = status only" rule in spirit: the meaning is carried by shapes and patterns.
6. **Causality is guessed and only shown on hover.** Cache-marker correlation is a "starts within 150 ms" heuristic (`query-activity.ts:65`). It is only visible while you hover an 8 px glyph, and the glyph sits in a different lane from the requests it explains. With 6+ concurrent queries a 150 ms window catches unrelated requests.
7. **Keyboard focus jumps around.** ←/→ follow start order, but because rows are packed, focus hops between lanes unpredictably (`:97-123`).

The capture layer is solid and should be kept: high-res `startedAt`/`endedAt`, `queuedAt` via `queue-handoff.ts`, `route`, `operation`, pending entries patched in place, and the query-activity store.

## 2. How the reference tools stay readable

| Tool | Layout | What makes it easy to read |
|---|---|---|
| **Chrome Network** | One row per request, Name column + Waterfall column, sorted by start time by default (can sort by end, duration, latency). An Overview track sits on top. | Labels on every row. Dragging on the Overview "show[s] only requests active in that timeframe" (filters the list rather than zooming a canvas). Hover over a bar previews the timing breakdown. Queueing/Stalled are separate light phases. Shift+hover colours initiators green and dependencies red. [CITED: developer.chrome.com/docs/devtools/network/reference] |
| **Firefox Network** | Same row-per-request list with a timeline column. The Timings tab gives HAR-spec phases. | "Blocked" is described as waiting for a connection slot (default 6 per server), which is exactly our Jira-limiter wait. [CITED: firefox-source-docs.mozilla.org/devtools-user/network_monitor/request_details/] |
| **Safari Web Inspector** | Network table with a Waterfall column. The Timelines tab has an overview graph, and clicking a record in the overview selects the row. A recording starts on navigation. | The overview and the rows are linked by selection, and recordings are scoped per navigation. [CITED: webkit.org/web-inspector/timelines-tab/, webkit.org/web-inspector/network-tab/] |
| **Perfetto** | Tracks (swim lanes), each with a fixed meaning (process/thread). Slices on tracks. WASD zoom/pan, pinned tracks, flow arrows between related slices. | Lanes work there because each lane *is* something. Area selection gives aggregates. [CITED: perfetto.dev/docs/visualization/perfetto-ui] |
| **Jaeger** | Span waterfall, one row per span, nested under its parent, collapsible subtrees, minimap. | "Large gaps between a parent span's start and its child's start reveal queueing." Collapsed by default for big traces. [CITED: github.com/jaegertracing/jaeger-ui/issues/4418; oneuptime.com blog on reading trace waterfalls] |
| **Honeycomb** | Waterfall with a dependent-count box on parents. ↑/↓ moves between spans, ← collapses. A collapsible trace summary on top. A "Highlight errors" toggle colours error spans red. | Keyboard tree navigation, plus errors as the only colour emphasis. [CITED: docs.honeycomb.io/investigate/analyze/explore-traces, docs.honeycomb.io/reference/honeycomb-ui/query/trace-waterfall] |
| **Datadog APM** | Flame graph (default), span list, waterfall (one row per span: bar, ms, service/resource, HTTP status), and a map. Chevron per row plus Expand/Collapse all. Focusing a span rescales to its subtree. | Absolute ms is printed on each row, so bar length is never the only cue. [CITED: docs.datadoghq.com/tracing/trace_explorer/trace_view/] |
| **Sentry trace view** | Waterfall "organized chronologically and through ancestry". Search with ↑/↓ through matches. Orphans linked with a dashed line. | Honest about broken links: unparented items are shown as such, not guessed. [CITED: docs.sentry.io/concepts/key-terms/tracing/trace-view/] |
| **TanStack Query Devtools** | A query list with status, data explorer and observers. No documented timeline (one third-party claim, unverified). | We are filling a gap the official tool doesn't cover. [CITED: deepwiki.com/TanStack/query/4-developer-tools; timeline claim LOW] |

**Principles extracted (apply all of these):**
1. **One row per request, stable for its lifetime.** Its position follows from its start-time order, not from packing.
2. **A label column on every row.** The bar never has to carry the name. Print the duration as text too.
3. **Sort by start time.** Concurrency then reads as vertical overlap and sequence as a staircase. Both are visible without any extra chart.
4. **Group by a meaningful unit** (navigation, trace, frame) with a collapsible header and a summary. Only the newest or active group is open by default.
5. **Scope the axis to the group** (0 = group start) so every group fills the width and "+412 ms" means "412 ms into this load".
6. **Show causality by nesting (parent → child), never by time proximity on hover.** Show unlinked items as unlinked (Sentry's orphans).
7. **Queue/blocked time is a lighter lead-in on the same row** (Chrome Queueing, Firefox Blocked), not a separate chart.
8. **Zoom is optional.** Chrome's overview *filters* rows rather than zooming a canvas. Datadog's "focus" rescales to a subtree. For loads of a few seconds, fit-to-group plus row labels is enough.

## 3. Fit to this app's data: can requests be linked to queries?

What exists: `ApiLogEntry` has `startedAt`, `endedAt`, `queuedAt?`, `route`, `operation?` (Jira, AIO and some GitLab calls), `source`, `method`, `url`, `status` and `state` (`stores/debug-log.store.ts:12-33`). Query events carry `at`, `kind`, `queryHash` and `keyLabel` (`stores/query-activity.store.ts:10-16`). The app has about 168 `queryFn:` sites and about 152 `apiFetch(` call sites. **No queryFn passes `signal` through**, so signal-based linking is out. [VERIFIED: grep]

### Mechanisms assessed

| Mechanism | Verdict |
|---|---|
| **TC39 AsyncContext** (true async propagation) | Not available. Still at Stage 2, with no shipping browser; WebKit is waiting on the spec. [CITED: github.com/WebKit/standards-positions/issues/569, github.com/tc39/proposal-async-context/issues/152] |
| Zone.js-style Promise patching | Doesn't see native `async/await`, and it's too invasive. Reject. |
| Time-window match (today's 150 ms) | Ambiguous exactly when it matters, i.e. many concurrent queries. Use only as a labelled fallback. |
| Thread a context param through all 152 call sites | Correct but too big a change for a dev tool. Reject. |
| **`persister` option as a queryFn wrapper** plus a **sync-slot handoff** (same pattern as `queue-handoff.ts`) | **Recommended.** Details below. |

### Recommended mechanism (verified in installed `@tanstack/query-core` 5.91.2)

- `Query.fetch` calls `this.options.persister(queryFn, queryFnContext, this)` whenever a persister is set (`node_modules/@tanstack/query-core/build/modern/query.js:226-233`). Infinite queries do the same (`infiniteQueryBehavior.js:76-89`). The retryer calls `fetchFn` once per attempt, so retries are wrapped too. Setting `persister` in `new QueryClient({ defaultOptions: { queries: { persister } } })` (`src/main.tsx:66`) therefore wraps **every** queryFn execution, including `fetchQuery` and `prefetchQuery`. [VERIFIED: node_modules source]
- The wrapper does three things:
  1. It records a **query run** `{ runId, queryHash, keyLabel, start, end, outcome }` with exact queryFn start and end. This is more precise than the cache `fetch`/`success` events.
  2. It publishes `runId` in a module-level slot for the synchronous part of `queryFn(ctx)` (`runWithQueryRun`, a twin of `runWithQueuedAt`).
  3. It passes straight through when capture is off.
- `apiFetch` reads the slot as its first statement, next to `takeQueuedAt()` (`apiFetch.ts:54`), and stores `queryRunId` on the entry.
- **The Jira limiter breaks sync context**, because p-limit 7 runs the task later. So `getJiraLimit()` (`lib/concurrency.ts:25-30`) must capture the slot at enqueue time (synchronously, where it already captures `queuedAt`) and re-publish it inside `runWithQueuedAt`. This is the same trick that already works for `queuedAt`.
- **Coverage limit:** a request fired *after an `await`* inside a queryFn gets no slot. Examples: page 2+ of `fetchAllSearchPages` (`services/jira/client.ts:66-99`), anything after `await readSecret()` (`main.tsx` custom-field discovery), and chunked `Promise.all` after a first fetch. For these, apply a **conservative inference at completion time**. Candidate runs are those that were running over the whole request (`run.start ≤ req.start && req.end ≤ run.end`); a queryFn awaits its own requests, so it cannot finish before them. Prefer the run that already owns a linked request that ended before this one started (pagination chain). Link only when exactly one candidate remains, and mark it `linkedBy: 'inferred'`. Otherwise leave it unlinked. Never guess between two candidates.
- Mutations: `MutationCache` events give mutation start and end. Usually only one mutation is in flight, so the same containment inference covers POST/PUT requests. This is optional.

**Pitfalls of this mechanism:**
- **Setting `persister` flips the default `networkMode` to `'offlineFirst'`** (`queryClient.js:278-280`: `if (!networkMode && persister) networkMode = "offlineFirst"`). That silently changes app behaviour offline. **You must also set `networkMode: 'online'` in the same defaults.** [VERIFIED: node_modules source]
- The wrapper must call `queryFn(context)` and return its promise untouched, and must never throw. Wrap the bookkeeping in try/catch like `useQueryActivityCapture`.
- Don't put the persister in only when dev tools are on, because the QueryClient is created once. Check `useSettingsStore.getState()` per call instead.
- A per-query `persister` option would override the default. None exist today. [VERIFIED: grep]
- Linkage rate is unknown. Run a **spike** first: build the capture, browse Dashboard, Backlog, Sprint and Release detail, and show "linked N of M" in Dev Tools. Proceed to nesting only if ≥ ~80% of requests in a typical load are linked (scope or a unique inference). [ASSUMED threshold]

## 4. Design directions

### Direction A: Load waterfall (recommended base)

```
 Requests 214 · 3 in flight · Errors 1 · Median 182 ms ...           (existing summary chips)
 ───────────────────────────────────────────────────────────────────────────────────────────
 ▾ /backlog · 23 requests · 1.84 s · peak 6 · 4 queued                         14:02:11
   ┌ label (min 220px)          │0        500 ms       1 s        1.5 s    ← sticky axis, faint in-flight area behind ticks
   │ Search Issues        200   │▓▓▓▓▓▓▓▓░░                           412 ms
   │ Board Config         200   │ ▓▓▓▓                                 88 ms
   │ Sprint Issues        200   │  ░░░▓▓▓▓▓▓▓▓▓▓▓                      640 ms  (░ = queued lead-in)
   │ issue/ABC-1          404   │        ▓▓▓  (amber)                  61 ms
   │ GET merge_requests  pending│            ▒▒▒▒▒▒▒▒▒▒▒▒→             1.2 s
   │                            │              ┊ +612 ms · 5 in flight · 2 queued   ← hover crosshair
 ▸ /dashboard · 41 requests · 3.10 s · peak 6                                  14:01:52
 ▸ /my-tasks · 7 requests · 640 ms                                             14:01:20
```

- **Best at:** answering "what loaded, in what order, what overlapped, what waited" at a glance. Every row is named, overlap is vertical, sequence is the staircase.
- **Complexity:** medium. Mostly deletion. A flat row model (headers + rows), TanStack Virtual with sticky headers, percent-positioned bars, a crosshair.
- **Cut:** lane packing, burst picker Select, Live button, Fit button, ⌘-wheel zoom and its hint, the 40 px strip (its information moves into the header text, the faint axis area and the crosshair), the cache lane and marker correlation, the separate burst label row, the second hatch pattern.

### Direction B: Trace tree, load → query → request (B-lite: one level of nesting)

```
 ▾ /backlog · 23 requests · 1.84 s · peak 6
   │0          500 ms         1 s          1.5 s
   ▾ sprint-issues › 42          │▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔        1.31 s   (query run: thin neutral bracket)
       Search Issues p1    200  │ ▓▓▓▓▓▓▓
       Search Issues p2    200  │        ▓▓▓▓▓▓       (inferred link: dotted connector)
       Changelog           200  │              ░░▓▓▓▓▓▓▓▓
   ▸ board-config › 12  (cached, no request)  │▏                         0 ms
     Other requests (3)                        ← unlinked, never guessed
```

- **Best at:** "what triggered what". Shows which query is slow because of a chain (pagination) versus because it waited in the queue, and which queries were served from cache.
- **Complexity:** high. Persister wrapper, limiter handoff, completion-time inference, query-run store, tree expand state, plus the spike risk.
- **Cut:** same as A. It replaces the cache lane entirely: fetch→success becomes the query row.

### Direction C: Slot tracks (Perfetto style, limiter-focused)

```
 Jira slot 1 │▓▓Search▓▓│▓Sprint▓▓▓▓▓│▓issue▓│
 Jira slot 2 │ ▓Board▓ │▓▓▓Changelog▓▓▓▓▓│
 ...  slot 6 │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
 Queue       │      ░░░ ░░░░░░ ░░
 GitLab      │ ▓▓mr▓▓  ▓▓pipelines▓▓
```

- **Best at:** limiter saturation. Six full tracks plus a non-empty queue row = saturated. Lanes have meaning here, which is what makes Perfetto work.
- **Weak at:** identifying requests, since it has the same unlabelled-bar problem in narrow tracks. Slot assignment is reconstructed (p-limit is FIFO, so packing at max 6 approximates it [ASSUMED]).
- **Use:** not as the main view. If saturation turns out to need its own view later, it could become a third segment.

### Recommendation

**Build A now, designed so B-lite slots in.** A addresses the user's stated goal ("observe concurrent loads, how things load one after another") through properties that all reference tools share, and it fits their taste: calm, labelled, one line per row, colour only for status, no legends. B adds real causality, but it depends on an unmeasured linkage rate. Make the row model carry an optional `parentId` and depth from day one. Then run the capture spike (persister + limiter handoff + "linked N of M" readout) as a separate plan. Turn on query rows only if the spike passes. C stays parked.

## 5. Interaction details for Direction A

**Loads (grouping).** Keep `groupBursts` with the 1.5 s gap (`timeline-layout.ts:49`), renamed to *load* in the UI. Use `queuedAt ?? start` as today, so a queued request never splits a load. Header, one line: `route · N requests · duration · peak P` plus `· Q queued` when there was queueing, and the wall-clock start time (right, muted, `toLocaleTimeString`). Use the SectionHeader-style quiet label at `text-xs font-medium`. It should be a visible tier above the rows, with no badges.

**Order.** Loads newest first, matching the List view. Rows inside a load are sorted by start time ascending (staircase), with ties broken by id. This order also drives ↑/↓.

**Default open state and live traffic.** The newest load is open. The rest are collapsed, and expand state lives in `dev-tools-view.store` keyed by load id (first request id, which is already stable: `burst-${id}`). When a new load starts, it appears on top and opens. The previously auto-opened load collapses **unless** the user toggled it or it holds the selected row. While a load has pending requests its axis domain end is `now` (the existing `useNow(250)`), so bars grow and the scale slowly compresses (Chrome does the same). The existing toolbar **Pause** already freezes everything, so no Live button is needed. Scroll position: if the user has scrolled down, do not jump to the new load. Show a quiet "1 new load ↑" link in its place (scroll anchoring).

**Axis and scale.** Each open load has a sticky axis row: ticks from `timeTicks([0, span])` with labels relative to the load start (already what `timeTicks` does when given the load window). Bar geometry uses **percentages of the load span** (`left = (start-g0)/span*100%`), so no px scale and no ResizeObserver are needed for bars. Tick count needs the bar-column width: measure once with a ResizeObserver on the list, or derive it from `@container` breakpoints. The axis row draws a faint `fill-muted-foreground/15` in-flight step area (the existing `concurrencySeries`) behind the ticks, with no labels.

**Zoom.** None in v1. Fit-to-load is the zoom. If UAT asks for more, add drag-select on the axis row to zoom *that load* and double-click to reset (Chrome-overview style), with no wheel and no global window state. This deletes `timelineBurstId`, `timelineWindow` and `timelineLive` from the store.

**Rows.**
- Label column (fixed `minmax(14rem, 32%)`, truncate): `operation ?? shortPath(url)` in foreground, then the method in muted mono. On the right of the label column, the status as text (`statusText()` colour; `pending` muted).
- Bar column: neutral `bg-foreground/30` for ok, amber 4xx, red 5xx/error (existing `timelineBarClass`), pending muted with a soft pulse (pick **one** treatment; drop the hatch). The queued lead-in uses the same hue at low opacity, with no hatch. The duration as text sits just right of the bar (or left-aligned inside the remaining space when the bar ends near the edge).
- Row height 24 px (`h-6`), one line always. At narrow widths drop the method, then shrink the label to 10rem, and never stack.

**Concurrency and queue without a strip.**
1. Overlap is visible through the staircase.
2. Header text gives `peak P · Q queued`.
3. The faint in-flight area sits behind the axis ticks.
4. A **hover crosshair**: pointer over any bar column draws a 1 px vertical line across the open load and a small readout at the axis: `+612 ms · 5 in flight · 2 queued`, computed with the existing `concurrencySeries`/`queuedSeries` at t. Rows not in flight at t stay full and the rest drop to ~60% opacity, which reads concurrency directly.
5. Saturation is shown as a header word only: when Jira in-flight hit `JIRA_CONCURRENCY`, the header shows `peak 6 (limit)`.
No limit line, no stacked outline, no legend.

**Tooltip** (bar hover, at most 4 rows): full path · status · `412 ms (queued 38 ms)` · `+120 ms → +532 ms`. Same component as today, with the start offset relative to the load.

**Selection and keyboard.** Click a row (anywhere, label or bar) to set `tabs.logs.selectedId` and open the existing inspector (unchanged). Keys: ↑/↓ for prev/next row in visual order, ←/→ to collapse/expand the focused load header (Honeycomb pattern), Esc to clear. Use roving tabindex as `ListRow` does, and `virtualizer.scrollToIndex` on keyboard moves. Replace `timelineKeyDown` (`LogsTimeline.tsx:97-123`). Its ←/→ meaning changes, so update `LogsTimeline.test.tsx:146`.

**Performance with 1000 rows.** Retention max is 1000 (`routes/settings/DebugModeSection.tsx:39`). Use `@tanstack/react-virtual` 3.13.23 (already installed; used in `routes/notifications/NotificationList.tsx:123-140`, `BacklogPage.tsx`, `AioCycleList.tsx`, `SprintBoardTab.tsx`). Flatten to `Row[] = header | axis | request` with a fixed `estimateSize` (24/28 px, no measuring) and `getItemKey` = entry id / `load-${id}`. Make the open load's header and axis sticky with the official `rangeExtractor` sticky pattern: keep the active sticky index in the range and render it `position: sticky`, the others `absolute` [VERIFIED: raw.githubusercontent.com/TanStack/virtual/main/examples/react/sticky/src/main.tsx]. Memoize groups and rows on `entries` and keep `now` out of grouping. Only pending rows and the active load's span depend on `now`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Row windowing + sticky headers | Custom scroll maths | `@tanstack/react-virtual` `useVirtualizer` + `rangeExtractor` | Already in repo, handles overscan, scrollToIndex |
| Wrapping every queryFn | Editing 168 queryFn sites or monkey-patching `Query.prototype` | `defaultOptions.queries.persister` | Official extension point, covers infinite and prefetch |
| Async context propagation | Zone.js / Promise patching | Sync slot + limiter re-publish + conservative inference | AsyncContext not shipped; patching misses native await |
| Step series / ticks / gaps | New maths | Existing `concurrencySeries`, `queuedSeries`, `timeTicks`, `groupBursts` | Tested already (`lib/dev-tools/*.test.ts`) |
| Tooltip / Select / segmented | New primitives | Existing tooltip div pattern, `SectionSegmented`, `EmptyState` | Consistency |

## Common Pitfalls

1. **Persister flips networkMode.** See section 3. Add `networkMode: 'online'` and a unit test asserting `queryClient.getDefaultOptions()` / `defaultQueryOptions()` keeps `'online'`.
2. **Virtualized absolute rows + table layout in WKWebView** collapse narrow columns to 0. Use flex/grid rows with explicit widths (`project_virtualized_table_zero_width_col.md`).
3. **Container query on self** never applies. Put `@container` on the list wrapper and the responsive classes on row children (`project_container_query_not_on_self.md`).
4. **Abspos content in the scroller** extends document height in WKWebView unless the scroller is `relative`. `devtools-list` already has `relative` (`ListInspectorLayout.tsx:88`). If the timeline gets its own inner scroller, give it `relative` too.
5. **Nested scrollers:** the timeline lives inside `devtools-list` (`overflow-auto`). Either pass the virtualizer that element (expose a ref from `ListInspectorLayout`) or make the timeline `h-full` with its own scroller. Do not do both, or sticky headers stick to the wrong box.
6. **React Compiler staleness:** the attribution map and query runs must live in Zustand stores read via selectors, never in module-level maps read during render. Run a compile check if anything renders stale only in the app (`project_react_compiler_module_read.md`).
7. **The `now` tick re-rendering 1000 rows:** keep `now` out of memo keys for closed loads. Pass it only to the active load's rows.
8. **Expand-state churn:** keying loads by the first request id is stable, but a load can *merge* when a new request bridges the gap. Accept that the merged load takes the older id (`groupBursts` already yields `burst-${firstId}`).
9. **Tooltips near the right edge:** clamp inside the pane. Never portal an overhanging element (`project_overhang_scroll_flicker.md`).
10. **Query keys in labels:** `formatQueryKey` truncates. No tokens appear in keys today [VERIFIED: grep], but redact any key part that looks like a URL with credentials.

## Code Examples

```ts
// main.tsx — capture hook (Direction B spike). Source: query-core 5.91.2 query.js:226, queryClient.js:278
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: Infinity,
      retry: 1,
      networkMode: 'online', // REQUIRED: a persister otherwise defaults this to 'offlineFirst'
      persister: devToolsQueryPersister, // passthrough when capture is off
    },
  },
});

// lib/dev-tools/query-run.ts
export const devToolsQueryPersister = (queryFn, ctx, query) => {
  if (!captureOn()) return queryFn(ctx);
  const run = beginRun(query.queryHash, formatQueryKey(query.queryKey)); // store append, try/catch
  const p = runWithQueryRun(run.id, () => queryFn(ctx)); // sync slot, like runWithQueuedAt
  return Promise.resolve(p).then(
    (d) => (endRun(run.id, 'success'), d),
    (e) => { endRun(run.id, 'error'); throw e; },
  );
};
```

```ts
// lib/concurrency.ts — carry both slots across p-limit's async hop
return <T>(fn: () => Promise<T> | T) => {
  const queuedAt = nowMs();
  const runId = peekQueryRun(); // read without clearing, synchronously at enqueue
  return Limit(() => runWithQueryRun(runId, () => runWithQueuedAt(queuedAt, fn)));
};
```

```ts
// lib/dev-tools/timeline-rows.ts (Direction A) — pure, tested
type Row =
  | { kind: 'load'; id: string; load: Load; open: boolean }
  | { kind: 'axis'; id: string; load: Load }
  | { kind: 'request'; id: string; entry: ApiLogEntry; load: Load; depth: 0 | 1; parentId?: string };
export function buildRows(loads: Load[], open: Set<string>): Row[];
export function inFlightAt(entries: ApiLogEntry[], t: number, now: number): { inFlight: number; queued: number };
```

## State of the Art

| Old Approach (current) | Current Approach | Impact |
|---|---|---|
| Greedy lane packing (Gantt) | Row per request sorted by start (Chrome/Firefox/Safari, all trace UIs) | Stable identity, labels possible |
| Global zoom window + brush + wheel | Group-scoped fit; optional overview filter | No zoom state to get lost in |
| Separate concurrency chart | Staircase + crosshair readout + header text | One place to look |
| Time-proximity correlation on hover | Parent/child nesting; orphans shown as unlinked (Sentry) | Honest causality |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | ≥80% of requests in a typical load can be linked to a query run (scope or unique inference) | 3, Recommendation | Direction B shows a large "Other requests" bucket; stay on A |
| A2 | p-limit FIFO makes reconstructed slot packing match real slots | Direction C | C would mislabel slots (C is parked anyway) |
| A3 | Fit-to-load is enough zoom for typical loads (≤ ~5 s, ≤ ~200 rows) | 5 | Add axis drag-zoom per load |
| A4 | Newest-first loads with oldest-first rows inside won't confuse the user | 5 | Flip to all-ascending with auto-scroll to bottom (Chrome) |
| A5 | TanStack Query Devtools has no official timeline | 2 | None for the design; only the "gap" claim |

## Open Questions

1. **Should loads also split on route change** (navigation as a boundary even inside 1.5 s)? Recommendation: yes, split when `route` differs from the previous request's route *and* a gap of more than 150 ms exists. This needs a small `groupBursts` change and a test.
2. **Show cached query hits (query run with no request)?** Only in B. In A they're invisible, as they are today in the request list.
3. **Should List and Timeline share row order?** List is newest-first globally. A timeline load is ascending inside. Confirm with the user at UAT using a screenshot.

## Environment Availability

Step 2.6: SKIPPED. No new external tools. `@tanstack/react-virtual` 3.13.23, `@tanstack/react-query` 5.91.2 and `p-limit` 7.3.0 are already installed [VERIFIED: node_modules package.json].

## Package Legitimacy Audit

No new packages are installed by this phase. Everything uses existing dependencies. slopcheck was not needed.

## Validation Architecture

| Property | Value |
|---|---|
| Framework | Vitest (inner `taskflow/`; no React Compiler in tests) |
| Quick run | `cd taskflow && npx vitest run src/lib/dev-tools src/routes/dev-tools/LogsTimeline.test.tsx` |
| Full suite | `cd taskflow && npm test` + `npx biome check src/routes/dev-tools src/lib/dev-tools` + `npx tsc --noEmit` |

| Behaviour | Test type | File |
|---|---|---|
| Loads: grouping, route split, newest-first, stable ids | unit | `lib/dev-tools/timeline-layout.test.ts` (extend) |
| `buildRows`: open/closed, sticky axis rows, start-ascending, tie by id | unit | `lib/dev-tools/timeline-rows.test.ts` (new) |
| `inFlightAt` / crosshair counts incl. queued | unit | same |
| Row labels: operation preferred, shortPath fallback; status text colour | component | `LogsTimeline.test.tsx` (rewrite) |
| New load auto-opens, previous collapses unless toggled/selected | component | same |
| ↑/↓ visual order, ←/→ collapse, Esc; click opens inspector | component | same |
| Tooltip ≤ 4 rows | component | same (keep existing test at :278) |
| 1000 entries render < N DOM rows (virtualized) | component | same (replace :289) |
| (B spike) persister passthrough when off; `networkMode` stays `'online'`; slot survives limiter; inference links only unique candidates | unit | `lib/dev-tools/query-run.test.ts`, `lib/concurrency.test.ts` |

Wave 0: the tests that assert removed behaviour (bursts picker, Live/Fit, wheel zoom, strip brush, cache lane: `LogsTimeline.test.tsx:163-275, 295-420`) are deleted deliberately and replaced. `TimelineConcurrencyStrip.tsx` and `brushWindow`/`zoomWindow` become dead code. Remove them with their tests. Note jsdom has no layout, so virtualizer tests need `initialRect` (see the `NotificationList.tsx:134` pattern). Take a manual screenshot in the real app before handoff.

## Security Domain

Dev-only view of already-redacted data (`lib/dev-tools/redact.ts`). V5 (output): labels come from `operation`, URL paths and query keys, all rendered as text (React escapes). No new storage. The new query-run store is transient like the others, shares the retention limit, and is cleared by the Logs **Clear** button (`LogsTab.tsx:247-253`; add the new store there).

## Sources

**Primary (HIGH)**
- Codebase: `routes/dev-tools/LogsTimeline.tsx`, `TimelineConcurrencyStrip.tsx`, `LogsTab.tsx`, `ListInspectorLayout.tsx`, `dev-tools-view.store.ts`, `utils.ts`; `lib/dev-tools/timeline-layout.ts`, `time-scale.ts`, `query-activity.ts`, `queue-handoff.ts`; `lib/apiFetch.ts`; `lib/concurrency.ts`; `hooks/useQueryActivityCapture.ts`; `main.tsx`
- `node_modules/@tanstack/query-core/build/modern/query.js:213-233`, `infiniteQueryBehavior.js:76-89`, `queryClient.js:278-280` (v5.91.2)
- TanStack Virtual sticky example: https://raw.githubusercontent.com/TanStack/virtual/main/examples/react/sticky/src/main.tsx

**Secondary (MEDIUM, official docs)**
- Chrome Network reference: https://developer.chrome.com/docs/devtools/network/reference
- Firefox request details: https://firefox-source-docs.mozilla.org/devtools-user/network_monitor/request_details/index.html ; toolbar: https://firefox-source-docs.mozilla.org/devtools-user/network_monitor/toolbar/index.html
- Safari: https://webkit.org/web-inspector/timelines-tab/ , https://webkit.org/web-inspector/network-tab/
- Perfetto UI: https://perfetto.dev/docs/visualization/perfetto-ui
- Honeycomb: https://docs.honeycomb.io/investigate/analyze/explore-traces , https://docs.honeycomb.io/reference/honeycomb-ui/query/trace-waterfall
- Datadog trace view: https://docs.datadoghq.com/tracing/trace_explorer/trace_view/
- Sentry trace view: https://docs.sentry.io/concepts/key-terms/tracing/trace-view/
- AsyncContext status: https://github.com/WebKit/standards-positions/issues/569 , https://github.com/tc39/proposal-async-context/issues/152

**Tertiary (LOW)**
- Jaeger behaviour summaries: https://oneuptime.com/blog/post/2026-02-06-read-interpret-opentelemetry-trace-waterfalls/view , https://github.com/jaegertracing/jaeger-ui/issues/4418
- TanStack Query Devtools feature lists: https://deepwiki.com/TanStack/query/4-developer-tools (timeline claim from pkgpulse unverified)

## Metadata

- Standard stack: HIGH (all installed, versions read from node_modules)
- Architecture: MEDIUM (reference-tool convergence is strong; user taste confirmed only through memory notes)
- Attribution mechanism: HIGH that the hook exists and how it behaves; MEDIUM-LOW on coverage until the spike
- Valid until: 2026-12-19
