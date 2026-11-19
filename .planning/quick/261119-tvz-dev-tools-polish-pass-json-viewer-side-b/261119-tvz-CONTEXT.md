# Quick Task 261119-tvz: Developer Tools polish pass - Context

**Gathered:** 2026-11-19
**Status:** Ready for planning

<domain>
## Task Boundary

Follow-up to 261119-sws, which redesigned Developer Tools at `taskflow/src/routes/dev-tools/`; read
its SUMMARY and REVIEW in `.planning/quick/261119-sws-redesign-and-polish-developer-tools/`.
User feedback on that result: "looks better. but do more improvements like side by side, coloring
the jsons, expanding, making it more polished and organized. add copy log functionality. overall good
direction but more polish. You have added the same settings as there are in settings. i dont need
duplicates, decide what goes where".

</domain>

<decisions>
## Implementation Decisions (locked)

### 1. Settings dedupe: each setting lives in exactly one place
- **Settings → Advanced → Developer Tools** keeps ONLY the master "Enable Developer Tools" toggle.
  It gates the sidebar entry (Sidebar.tsx) and the native Debug menu (main.tsx), so it must be
  reachable when the page is hidden. Add one muted line under it: "Capture options live in Developer
  Tools → settings". Remove the request logging, response body capture and retention rows from
  DebugModeSection.
- **Jira concurrency limit** stays in Settings → Advanced but moves out of the Developer Tools
  subsection into its own "Network" subsection. It is app behaviour, not capture.
- **Dev Tools gear popover** keeps ONLY the capture options: Request logging, Response body capture,
  Retention limit. Remove the master toggle from the popover, since you can't be on the page with it
  off. Update tests that assert the removed controls.

### 2. JSON viewer: coloured, expandable tree
- New shared `JsonTree` component, replacing the plain `JsonBlock` pre where the content is JSON:
  log request/response bodies, Cache data, Notifications raw item, and Editor where structured.
  - Syntax colouring via theme-aware tokens (light + dark): keys, strings, numbers, booleans, null,
    punctuation muted. Monospace, tabular.
  - Collapsible objects and arrays with a chevron. A collapsed node shows a summary (`{…} 12 keys`,
    `[…] 50 items`).
  - Default expansion depth 2. Toolbar: Expand all, Collapse all, Raw/Tree toggle, and a search
    within the body that highlights matches and auto-expands their ancestors.
  - Clicking a key copies its JSON path (e.g. `fields.status.name`). Hovering a value offers a copy
    button for that value.
  - Large payloads must stay fast: lazy-render children only when expanded, cap array children at
    100 with a "Show N more" row, and fall back to Raw over ~1 MB.
  - Non-JSON text falls back to a plain pre (still capped).
- Pure logic (parse, path building, match search, node summary) lives in testable `.ts` under
  `lib/dev-tools/` with unit tests.

### 3. Log inspector: organized, request and response side by side
- Capture **response headers** in apiFetch (`responseHeaders` on ApiLogEntry), redacting set-cookie
  and other secrets.
- The inspector header becomes a summary block: method and status pill (colour = status only), full
  URL, then a compact meta line: duration · size · time · source · operation.
- Replace the four segmented sub-tabs with an organized layout:
  - **Overview**: General (URL, method, status, duration, size, started), Query parameters parsed into
    a key/value table, Request headers, Response headers. Use collapsible sections with the shared
    SectionHeader style.
  - **Body**: request and response **side by side** (two columns, each with its own JsonTree,
    labelled "Request" / "Response" with size) when the inspector is at least ~720px wide; stacked
    when narrower. If there is no request body, the response takes full width.
  - **Timing**: kept, made tidier. Add a small horizontal bar showing this request's duration against
    the median and p95 of the filtered set.
  - The inspector is resizable (already); allow a wider max, and give it a maximize toggle so it can
    take the whole pane for big bodies.
- **Copy log** functionality:
  - In the inspector, a "Copy" split button / menu: Copy URL, Copy as cURL, Copy response, Copy
    request body, **Copy log entry as JSON** (full entry, redacted), and **Copy as Markdown** (a
    bug-report-ready block: method, URL, status, duration, time, request body, response truncated to
    ~4 KB).
  - In the Logs toolbar: **Copy all** (filtered entries as JSON) and **Export** (download the filtered
    entries as a .json file through the existing Tauri save mechanism if one exists, else skip
    Export).
  - Row context: hovering a row reveals a copy icon (Copy URL). Must not cause layout shift: overlay
    it or reserve space, per the hover-affordance memory.
- Same copy menu pattern on Notifications (copy entry JSON), Editor (copy entry JSON, copy original
  and produced markup) and Cache (copy key, copy data).

### 4. General polish and organization
- List rows: consistent column grid (fixed widths for source / method / status / duration / time,
  flex path), tabular numbers, method colour-neutral, status coloured only, path showing the pathname
  with the host dimmed, and a duration micro-bar or right-aligned ms. Selected row clearly
  highlighted; visible focus-visible ring (review WR-06).
- Toolbar layout: search on the left, facets grouped, actions (Pause, Copy all, Export, Clear) on
  the right, separated by a hairline divider; one row at normal widths, wrapping cleanly when narrow.
- Empty inspector state: a compact EmptyState ("Select a request") rather than a blank pane.
- Summary strip: aligned stat chips (Requests · Errors · Median · p95 · Slowest), errors in red only
  when greater than 0.
- Fix the open review items that touch the same code:
  - WR-02: Cache inspector "ago" times freeze. Pass `now` from the tick.
  - WR-04: memoize body formatting per entry id, and don't lowercase whole bodies on every keystroke
    (precompute a lowercase search haystack once per entry, cached in a WeakMap).
  - WR-06: focus ring, `aria-current` instead of `aria-pressed`, keyboard support on the resize handle.
  - IN-01: title tooltips not blocked by pointer-events-none.

### Claude's Discretion
- Exact component structure, colour tokens (follow existing theme variables, light + dark), icons
  (lucide).
- Follow user UI memory: colour = status only, calm lists, one row = one line, no card panels around
  sections, match local button styles, render before restyling.

</decisions>

<specifics>
## Specific Ideas
- References: Chrome DevTools Network panel (Headers / Payload / Response / Timing), Firefox JSON
  viewer (coloured collapsible tree with Raw toggle and filter), TanStack Query Devtools data
  explorer.
- Keep all existing dev-tools tests passing or update them deliberately. Add tests for JsonTree logic,
  query-param parsing, markdown/JSON copy builders (with redaction), and the settings dedupe (popover
  has no master toggle; DebugModeSection has no capture toggles).
</specifics>

<decisions_addendum>
## Addendum (2026-11-19, user follow-up): concurrency and load-order observability — FOLDED INTO THIS TASK

User: "some things are hard to track. we currently have no way to observe concurrent logs, how different
things load after another". The user chose to fold this into the current pass and wants all four parts
("you decide but keep usability and usefulness in mind").

### 5. Remove the dead Jira concurrency limit (supersedes decision 1's "Network subsection")
- `jiraConcurrencyLimit` is never read by any code; the setting does nothing. Remove the setting, its
  setter and its UI. Add settings persist migration v41, which deletes the key. Do not create a
  Network subsection.

### 6. In-flight capture (apiFetch + debug-log.store)
- Append the entry when the request STARTS, with `state: 'pending'`, and patch it on completion
  (`state: 'done' | 'error'`, status, duration, bodies, response headers). The store gains
  `update(id, patch)`.
- High-resolution times: `startedAt` / `endedAt` as epoch ms with fractions
  (`performance.timeOrigin + performance.now()`). Keep `timestamp` as the ISO start time, for
  display and back-compat. List order stays newest-first by START time.
- Capture `route` (the current app route path at request start), used for burst labels.
- Pending rows in the list show a muted "pending" status and a live elapsed time. The pending-tab
  count is visible in the summary strip ("3 in flight").
- Pause must still behave sensibly: a paused snapshot can show pending entries frozen.

### 7. Query-cache activity capture (new store)
- A new transient store `query-activity.store` records TanStack Query cache events, when
  devToolsEnabled && requestLogging is on: `fetch` (fetchStatus idle→fetching), `success`,
  `error`, `invalidated` (state.isInvalidated false→true) and `removed`. Each record carries the
  formatted key, queryHash and a high-res timestamp. It shares the retention limit.
- Subscribe once at app level (where the QueryClient lives, e.g. a small hook mounted in
  AppLayout/main.tsx), not only while the Dev Tools page is open. Diff against the previous
  per-query state to derive events. Make it cheap: skip all work when capture is off.

### 8. Timeline view in Logs
- The Logs toolbar gets a List | Timeline segmented toggle. The same filters, search, pause and
  inspector apply to both views. Selecting a bar opens the same request inspector on the right.
- **Concurrency strip** on top: a step-area chart of requests in flight over time, with the peak
  labelled ("peak 9"). Drag across it (brush) to zoom the main timeline to that range.
- **Main timeline:** a shared time axis with readable ticks (ms or s, relative to the window start).
  One bar per request, packed into lanes greedily so overlapping requests stack and sequential ones
  share a lane.
  - Bar label: method + short path, inside the bar when it fits, otherwise omitted.
  - Colour = status only: neutral ok, amber 4xx, red 5xx/network error, muted striped for pending.
    Pending bars grow live.
  - Hover tooltip of at most 4 rows: path, status, duration, start offset.
- **Bursts:** requests separated by more than 1.5 s idle form a burst. Each burst has a header
  row/label "route · N requests · total ms". A burst picker (the last 20 bursts, newest first)
  plus "All" sets the window. The default window is the latest burst, and it auto-follows while
  requests are pending ("Live" toggle; turning it off freezes the window). Zoom: brush, ctrl/⌘ +
  wheel, and a "Fit" button.
- **Cache lane:** a thin "Cache" lane above the request lanes shows query-activity markers as small
  glyphs (fetch, invalidated, error; shape plus muted colour, red for error). Hovering a marker shows
  the key. Hovering a fetch or invalidated marker also highlights the requests that started within
  150 ms after it (likely caused by it); everything else dims.
- Keyboard: ←/→ moves selection to the previous/next request by start time. Esc clears.
- Performance: absolute-positioned divs or one SVG, memoized layout. Must stay smooth with 1000
  entries.

### 9. Waterfall column in the List view
- Each list row gets a narrow mini bar (fixed-width column, e.g. 120px, hidden at narrow widths)
  showing the request's start offset and duration within its burst, like Chrome's Network waterfall.
  Colour = status only.

### Pure logic (testable `.ts` in lib/dev-tools/ with unit tests)
- Lane packing, burst grouping (idle gap), concurrency step series and peak, time scale and tick
  generation, marker → request correlation window, query-activity event diffing.
</decisions_addendum>
