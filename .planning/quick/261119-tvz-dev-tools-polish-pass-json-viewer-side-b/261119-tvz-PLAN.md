---
phase: quick-261119-tvz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/settings/DebugModeSection.tsx
  - taskflow/src/routes/settings/DebugModeSection.test.tsx
  - taskflow/src/routes/dev-tools/DevToolsSettingsPopover.tsx
  - taskflow/src/routes/dev-tools/DevToolsSettingsPopover.test.tsx
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/stores/settings.store.test.ts
  - taskflow/src/lib/concurrency.ts
  - taskflow/src/lib/concurrency.test.ts
  - taskflow/src/lib/apiFetch.ts
  - taskflow/src/stores/debug-log.store.ts
  - taskflow/src/stores/debug-log.store.test.ts
  - taskflow/src/lib/dev-tools/redact.ts
  - taskflow/src/lib/dev-tools/redact.test.ts
  - taskflow/src/lib/dev-tools/curl.ts
  - taskflow/src/lib/dev-tools/json-tree.ts
  - taskflow/src/lib/dev-tools/json-tree.test.ts
  - taskflow/src/lib/dev-tools/query-params.ts
  - taskflow/src/lib/dev-tools/query-params.test.ts
  - taskflow/src/lib/dev-tools/copy-format.ts
  - taskflow/src/lib/dev-tools/copy-format.test.ts
  - taskflow/src/lib/dev-tools/log-filters.ts
  - taskflow/src/lib/dev-tools/log-filters.test.ts
  - taskflow/src/lib/dev-tools/log-stats.ts
  - taskflow/src/lib/dev-tools/log-stats.test.ts
  - taskflow/src/lib/dev-tools/query-cache-snapshot.ts
  - taskflow/src/lib/dev-tools/query-cache-snapshot.test.ts
  - taskflow/src/lib/dev-tools/log-entry.ts
  - taskflow/src/lib/dev-tools/log-entry.test.ts
  - taskflow/src/lib/dev-tools/query-activity.ts
  - taskflow/src/lib/dev-tools/query-activity.test.ts
  - taskflow/src/lib/dev-tools/timeline-layout.ts
  - taskflow/src/lib/dev-tools/timeline-layout.test.ts
  - taskflow/src/lib/dev-tools/time-scale.ts
  - taskflow/src/lib/dev-tools/time-scale.test.ts
  - taskflow/src/lib/relative-time.ts
  - taskflow/src/stores/query-activity.store.ts
  - taskflow/src/stores/query-activity.store.test.ts
  - taskflow/src/hooks/useQueryActivityCapture.ts
  - taskflow/src/hooks/useQueryActivityCapture.test.tsx
  - taskflow/src/main.tsx
  - taskflow/src/routes/dev-tools/JsonTree.tsx
  - taskflow/src/routes/dev-tools/dev-tools-ui.tsx
  - taskflow/src/routes/dev-tools/dev-tools-view.store.ts
  - taskflow/src/routes/dev-tools/ListInspectorLayout.tsx
  - taskflow/src/routes/dev-tools/LogInspector.tsx
  - taskflow/src/routes/dev-tools/LogsTab.tsx
  - taskflow/src/routes/dev-tools/useNow.ts
  - taskflow/src/routes/dev-tools/LogsTimeline.tsx
  - taskflow/src/routes/dev-tools/TimelineConcurrencyStrip.tsx
  - taskflow/src/routes/dev-tools/LogsTimeline.test.tsx
  - taskflow/src/routes/dev-tools/DevToolsPage.tsx
  - taskflow/src/routes/dev-tools/DevToolsPage.test.tsx
  - taskflow/src/routes/dev-tools/CacheInspector.tsx
  - taskflow/src/routes/dev-tools/CacheTab.tsx
  - taskflow/src/routes/dev-tools/NotificationsTab.tsx
  - taskflow/src/routes/dev-tools/NotificationsTab.test.tsx
  - taskflow/src/routes/dev-tools/EditorTab.tsx
  - taskflow/src/routes/dev-tools/EditorTab.test.tsx
  - taskflow/src/routes/dev-tools/utils.ts
  - taskflow/src/lib/dev-tools/queue-handoff.ts
  - taskflow/src/lib/dev-tools/queue-handoff.test.ts
autonomous: true
requirements: [TVZ-SETTINGS-DEDUPE, TVZ-REMOVE-CONCURRENCY, TVZ-JSON-TREE, TVZ-LOG-INSPECTOR, TVZ-COPY-LOG, TVZ-POLISH, TVZ-INFLIGHT, TVZ-QUERY-ACTIVITY, TVZ-WATERFALL, TVZ-TIMELINE, TVZ-QUEUE-WAIT]

must_haves:
  truths:
    - "Settings → Advanced shows only the 'Enable Developer Tools' toggle under Developer Tools, plus the muted line 'Capture options live in Developer Tools → settings'. There is no Jira concurrency limit and no Network subsection (D-01, as superseded by D-05)"
    - "jiraConcurrencyLimit and setJiraConcurrencyLimit are gone from the settings store. The persist version is 41, and the v41 migration deletes the persisted jiraConcurrencyLimit key (D-05)"
    - "The Dev Tools gear popover shows Request logging, Response body capture and Retention limit, and no master toggle (D-01)"
    - "JSON bodies in Logs, Cache, Notifications and Editor render as a coloured, collapsible tree (default depth 2) with Expand all, Collapse all, a Raw toggle and a search that highlights matches and auto-expands them. Clicking a key copies its path, and hovering a value offers a copy button (D-02)"
    - "Arrays show 100 children, then a 'Show N more' row. Bodies over ~1 MB, and non-JSON text, fall back to a capped plain pre (D-02)"
    - "The log inspector has a summary header (method, status pill, full URL, meta line) and Overview, Body and Timing sections. Body shows Request and Response side by side when the inspector is at least ~720px wide and stacked when narrower; the response takes full width when there is no request body (D-03)"
    - "Response headers are captured with set-cookie and other secrets redacted, and are shown in Overview (D-03)"
    - "The inspector Copy menu offers Copy URL, Copy as cURL, Copy response, Copy request body, Copy log entry as JSON (redacted) and Copy as Markdown (response capped at ~4 KB). The Logs toolbar has Copy all and Export (saves to Downloads and reveals the file in Finder). Hovering a row reveals Copy URL without layout shift (D-03)"
    - "The Notifications, Editor and Cache inspectors use the same Copy menu pattern (D-03)"
    - "Rows have a fixed column grid, a visible focus-visible ring and aria-current on the selected row. The resize handle works with arrow keys, the inspector can be maximized, an EmptyState shows when nothing is selected, and Cache 'ago' times keep ticking (D-04, WR-02, WR-04, WR-06, IN-01)"
    - "A request appears in Logs as soon as it starts, with a muted 'pending' status and a live elapsed time, and is updated in place to done or error when it completes. The summary strip shows 'N in flight'. A paused snapshot shows pending entries frozen (D-06)"
    - "Pending entries are excluded from error counts and from median, p95 and slowest, and are never classified as network errors by the status filter (D-06)"
    - "Query-cache fetch, success, error, invalidated and removed events are recorded app-wide into query-activity.store while Developer Tools and Request logging are both on. When capture is off, nothing is recorded and no diffing work runs (D-07)"
    - "Logs has a List | Timeline toggle. Timeline shows a concurrency strip with a peak label and brush zoom; requests packed into lanes on a shared time axis; a burst picker with 'All' and Live follow; Fit and ctrl/⌘ + wheel zoom; a Cache marker lane where hovering a fetch or invalidated marker highlights requests started within 150 ms; ←/→ selection. Selecting a bar opens the same inspector (D-08)"
    - "Jira requests that waited for a limiter slot record queuedAt (best effort). The inspector Timing shows 'Queued N ms' and the network time separately. Timeline bars draw the queued part as a hatched, muted lead-in. The concurrency strip shows queued and in-flight series with a reference line at the limit (6). The tooltip folds the queue time into the duration row (D-06 amendment)"
    - "The page header button reads 'Clear logs' (formerly 'Clear all')"
    - "List rows show a fixed-width waterfall mini bar (start offset and duration within the burst, status colour only), hidden at narrow widths (D-09)"
  artifacts:
    - path: "taskflow/src/lib/dev-tools/json-tree.ts"
      provides: "Pure JSON tree model: parse with a size guard, path formatting, node summary, search matches with ancestor expansion, container path collection"
      exports: ["parseJsonBody", "formatJsonPath", "pathKey", "nodeSummary", "findJsonMatches", "collectContainerKeys", "ARRAY_PAGE", "DEFAULT_EXPAND_DEPTH", "MAX_TREE_BYTES"]
    - path: "taskflow/src/lib/dev-tools/copy-format.ts"
      provides: "Builders for redacted entry JSON, entries JSON and bug-report Markdown"
      exports: ["entryToJson", "entriesToJson", "entryToMarkdown"]
    - path: "taskflow/src/lib/dev-tools/redact.ts"
      provides: "Header and URL redaction shared by apiFetch, curl and the copy builders"
      exports: ["redactHeaders", "redactUrl"]
    - path: "taskflow/src/lib/dev-tools/query-params.ts"
      provides: "URL query string to ordered key/value rows"
      exports: ["parseQueryParams"]
    - path: "taskflow/src/routes/dev-tools/JsonTree.tsx"
      provides: "Shared theme-aware collapsible JSON viewer"
      min_lines: 150
    - path: "taskflow/src/routes/dev-tools/LogInspector.tsx"
      provides: "Summary header, Overview / Body / Timing, Copy menu"
    - path: "taskflow/src/lib/dev-tools/log-entry.ts"
      provides: "Back-compat accessors for entry state, start, end and route"
      exports: ["entryState", "entryStart", "entryEnd", "isPending", "currentRoute", "nowMs"]
    - path: "taskflow/src/lib/dev-tools/timeline-layout.ts"
      provides: "Lane packing, burst grouping, concurrency and queued series with peak, waterfall segment"
      exports: ["packLanes", "groupBursts", "concurrencySeries", "queuedSeries", "waterfallSegment", "BURST_GAP_MS"]
    - path: "taskflow/src/lib/dev-tools/time-scale.ts"
      provides: "Linear time scale, nice ticks with relative labels, and zoom / fit / brush window maths"
      exports: ["createTimeScale", "timeTicks", "formatOffset", "zoomWindow", "fitWindow", "brushWindow"]
    - path: "taskflow/src/lib/dev-tools/query-activity.ts"
      provides: "Per-query snapshot diffing into activity events, and marker-to-request correlation"
      exports: ["snapshotQuery", "diffQueryActivity", "correlatedRequestIds", "CORRELATION_WINDOW_MS"]
    - path: "taskflow/src/stores/query-activity.store.ts"
      provides: "Transient store of query-activity events that shares the retention limit"
      exports: ["useQueryActivityStore"]
    - path: "taskflow/src/hooks/useQueryActivityCapture.ts"
      provides: "App-level QueryCache subscriber that does nothing when capture is off"
    - path: "taskflow/src/lib/dev-tools/queue-handoff.ts"
      provides: "Synchronous queuedAt handoff from the Jira limiter wrapper to apiFetch, and queue/network time split"
      exports: ["runWithQueuedAt", "takeQueuedAt", "queueSplit"]
    - path: "taskflow/src/routes/dev-tools/LogsTimeline.tsx"
      provides: "Timeline view: lanes, axis, bursts, cache lane, zoom, keyboard"
      min_lines: 200
  key_links:
    - from: "taskflow/src/lib/apiFetch.ts"
      to: "taskflow/src/lib/dev-tools/redact.ts"
      via: "redactHeaders for request and response headers"
      pattern: "redactHeaders\\("
    - from: "taskflow/src/routes/dev-tools/LogInspector.tsx"
      to: "taskflow/src/routes/dev-tools/JsonTree.tsx"
      via: "request and response bodies"
      pattern: "<JsonTree"
    - from: "taskflow/src/routes/dev-tools/LogInspector.tsx"
      to: "taskflow/src/lib/dev-tools/copy-format.ts"
      via: "Copy menu items"
      pattern: "entryToMarkdown|entryToJson"
    - from: "taskflow/src/routes/dev-tools/LogsTab.tsx"
      to: "taskflow/src/lib/save-attachment.ts"
      via: "Export writes JSON to Downloads"
      pattern: "saveBytes\\("
    - from: "taskflow/src/routes/dev-tools/CacheInspector.tsx"
      to: "taskflow/src/routes/dev-tools/JsonTree.tsx"
      via: "cache data"
      pattern: "<JsonTree"
    - from: "taskflow/src/lib/apiFetch.ts"
      to: "taskflow/src/stores/debug-log.store.ts"
      via: "appends a pending entry at start and calls update(id, patch) on completion"
      pattern: "\\.update\\("
    - from: "taskflow/src/main.tsx"
      to: "taskflow/src/hooks/useQueryActivityCapture.ts"
      via: "mounted once in AppLayout next to useNotificationPolling"
      pattern: "useQueryActivityCapture\\(\\)"
    - from: "taskflow/src/routes/dev-tools/LogsTab.tsx"
      to: "taskflow/src/routes/dev-tools/LogsTimeline.tsx"
      via: "List | Timeline toggle sharing the filtered entries and selection"
      pattern: "<LogsTimeline"
    - from: "taskflow/src/lib/concurrency.ts"
      to: "taskflow/src/lib/dev-tools/queue-handoff.ts"
      via: "getJiraLimit wrapper records queuedAt at enqueue and runs fn via runWithQueuedAt"
      pattern: "runWithQueuedAt\\("
    - from: "taskflow/src/lib/apiFetch.ts"
      to: "taskflow/src/lib/dev-tools/queue-handoff.ts"
      via: "takeQueuedAt() read synchronously at apiFetch entry"
      pattern: "takeQueuedAt\\("
    - from: "taskflow/src/routes/dev-tools/LogsTimeline.tsx"
      to: "taskflow/src/stores/query-activity.store.ts"
      via: "cache lane markers"
      pattern: "useQueryActivityStore"
---

<objective>
Developer Tools polish and observability pass on top of 261119-sws. It implements every locked decision in 261119-tvz-CONTEXT.md, including the decisions addendum:

- D-01: settings dedupe (CONTEXT section 1). The Jira concurrency part is superseded by D-05.
- D-02: a coloured, expandable JSON tree (section 2).
- D-03: an organized log inspector with request and response side by side, response headers, and copy-log actions (section 3).
- D-04: list, toolbar and focus polish, plus review items WR-02, WR-04, WR-06 and IN-01 (section 4).
- D-05: remove the dead Jira concurrency setting, with settings migration v41.
- D-06: in-flight request capture.
- D-07: query-cache activity capture.
- D-08: the Logs Timeline view.
- D-09: a waterfall column in the List view.

Purpose: the user liked the redesign's direction but asked for side-by-side bodies, coloured and expandable JSON, copy functionality, more polish and no duplicated settings. A follow-up added that concurrent requests and load order are currently impossible to observe.

Output:
- New pure modules with tests: redact, json-tree, query-params, copy-format, log-entry, timeline-layout, time-scale, query-activity.
- A shared JsonTree component.
- A reorganized LogInspector and LogsTab.
- Updated Cache, Notifications and Editor inspectors.
- A deduped Settings section and gear popover.
- In-flight capture, an app-level query-activity store and subscriber, a waterfall column, and the Timeline view.

Execution split: three sequential executor runs. Run 1 = Tasks 1-4, run 2 = Tasks 5-6, run 3 = Tasks 7-8. The last task of each run (4, 6, 8) must end green on its own, and its verify covers every suite touched in that run. The full `npm test` gate runs at the end of Task 8.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261119-tvz-dev-tools-polish-pass-json-viewer-side-b/261119-tvz-CONTEXT.md
@.planning/quick/261119-sws-redesign-and-polish-developer-tools/261119-sws-SUMMARY.md
@.planning/quick/261119-sws-redesign-and-polish-developer-tools/261119-sws-REVIEW.md

Paths: the repo root (git, .planning) is /Users/mimo/Documents/Projects/taskflow. The app is the inner `taskflow/` directory. Run every npm / vitest / tsc / biome command from `/Users/mimo/Documents/Projects/taskflow/taskflow`.

Facts gathered during planning (do not re-derive):

Existing pieces to reuse:
- `dev-tools-ui.tsx`: ToolbarSearch, CopyButton, InspectorSection, KeyValueTable, JsonBlock, ListRow, useListKeyboard.
- `ListInspectorLayout.tsx`: toolbar / summary / list / resizable inspector. Uses `useResizable` with `direction: 'left'`; the max is currently 0.6 of the layout width.
- `dev-tools-view.store.ts`: transient UI store holding tabs, facets, inspectorWidth and pausedEntries.
- `lib/dev-tools/json-preview.ts`: safeStringify, byteSize, capText.
- `lib/dev-tools/curl.ts`: buildCurl, SECRET_URL_PARAMS, DROPPED_HEADERS.
- `lib/dev-tools/log-stats.ts`: computeLogStats (median, p95, slowest) and urlPath.
- `lib/dev-tools/log-filters.ts`: filterLogs, which lowercases the URL and bodies of every entry on every keystroke.
- `routes/dev-tools/utils.ts`: formatBody, statusColor, formatBytes, sourceBadgeClass.

Layout and component APIs:
- `useResizable` already returns `handleKeyDown` (ArrowLeft/Right, Shift for 64px steps, reversed for direction 'left'). ListInspectorLayout doesn't use it yet. The handle div is `aria-hidden` and has no tabIndex.
- `SectionHeader` and `SectionSegmented` live in `routes/dashboard/issue-detail/SectionHeader.tsx`. SectionHeader props: title, count, expanded, onToggle, actions, className, sticky (default true; pass `sticky={false}` inside the inspector).
- `components/ui/dropdown-menu.tsx` wraps Base UI Menu (DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, ...). For the test pattern that opens a menu and clicks `getByRole('menuitem')`, see `src/components/wiki-editor/toolbar/menus.test.tsx`.
- `components/ui/empty-state.tsx`: EmptyState props include `icon`, `title`, `subtitle`, `compact` and `fill`. The Base UI Select needs the Root `items` prop or its trigger shows the raw value (see DevToolsSettingsPopover's RETENTION_ITEMS).

Export:
- An export mechanism already exists. `src/lib/save-attachment.ts` exports `saveBytes(bytes, filename): Promise<string>`, which runs the Rust `save_attachment` command, writes to Downloads and returns the path.
- There is no save-dialog plugin. Use `saveBytes` followed by `revealItemInDir` from `@tauri-apps/plugin-opener`; the capability `opener:allow-open-path` already allows `$DOWNLOAD/**`.
- Do NOT add `@tauri-apps/plugin-dialog`.

Cache tab times:
- `relativeTime(iso)` in `lib/relative-time.ts` reads `Date.now()` internally.
- `toCacheRow(query, staleTimeMs, _now)` ignores `now` today.
- `useQueryCacheRows` rebuilds a fresh row array on every 1 s tick.

Settings and the Jira concurrency limit (D-05):
- DebugModeSection currently holds Request logging, Response body capture, Retention limit and Jira concurrency limit (`CONCURRENCY_OPTIONS`) inside a disabled block.
- In `stores/settings.store.ts`, `jiraConcurrencyLimit` appears at: the default (line ~42), the type (~124), the setter type (~210), and the setter at ~331, which calls `setConcurrencyRuntime` imported from `../lib/concurrency` at line 11. There is also a migration line `if (version < 13) { if (s.jiraConcurrencyLimit === undefined) s.jiraConcurrencyLimit = 6; }`.
- The persist version is 40; the last migration block is `if (version < 40)`.
- `settings.store.test.ts` sets `jiraConcurrencyLimit: 12` in a reset fixture (~line 306), has the test `resetSettings("all") restores jiraConcurrencyLimit to 6` (~343), and has the regex test `persist version is 40 ...` (~501) that matches `/version: 40,/`. Its migration tests call `migrate(persisted, fromVersion)` (~545).
- What the limiter actually does: `lib/concurrency.ts` keeps a live p-limit semaphore (`getJiraLimit()`, used by `services/jira.ts` and `services/jira/client.ts`), fixed at 6.
  - The persisted setting only reached it via the store setter during the current session.
  - Nothing re-applies the setting on startup, so after any restart the effective limit was always 6.
  - Per D-05, keep `getJiraLimit()` at a fixed 6, and delete the now-unused `setJiraConcurrencyLimit` export from lib/concurrency.ts along with its two tests in `lib/concurrency.test.ts`.

Jira limiter call sites (queue-wait amendment):
- `services/jira/client.ts:68` uses `await getJiraLimit()(() => apiFetch('jira', url, { headers }, 'Search Issues'))`. fn calls apiFetch synchronously.
- `services/jira.ts:1021-1050` has `const limit = getJiraLimit(); limit(async () => { …sync filtering/mapping… await apiFetch(…comments…) })`. The async fn runs synchronously up to its first `await`, which IS the apiFetch call, so a synchronous handoff reaches it too.
- These are the only two call sites. A future fn that awaits something else before calling apiFetch would simply not get a queuedAt (best effort, documented). It can never get a wrong one, because the handoff is cleared as soon as fn returns its promise.
- p-limit is `pLimit(6)`. The limit value 6 is exported as `JIRA_CONCURRENCY = 6` for the timeline reference line.

Header Clear button:
- `DevToolsPage.tsx:69` renders the header button "Clear all", which clears every Developer Tools store. Its header comment (line 4) mentions "Clear all".
- The test that asserts the label is `EditorTab.test.tsx:128` and `:147` (`getByRole('button', { name: 'Clear all' })`). DevToolsPage.test.tsx has no assertion on it today.

Stale strings and test assertions:
- Three tabs (Logs, Notifications, Editor) show a disabled EmptyState with the subtitle "Enable them in the settings popover above.", which stops being true after D-01.
- `DevToolsPage.test.tsx` clicks `getByRole('button', { name: 'Copy as cURL' })` and asserts that the `logs-summary` textContent contains '2 requests' / '1 requests' / '1 errors'.
- `NotificationsTab.test.tsx:78` asserts the text 'Raw items'.
- No test asserts `aria-pressed`, the popover master toggle, or the DebugModeSection capture toggles.

ApiLogEntry consumers (D-06 back-compat). New fields MUST be optional:
- `hooks/useUpdatePolling.ts` and `routes/settings/UpdatesSection.tsx` call `useDebugLogStore.append` with already-completed updater entries that carry no state, startedAt or route.
- Other consumers: `lib/dev-tools/{curl,log-filters,log-stats,copy-format}.ts`, `routes/dev-tools/{DevToolsPage,LogsTab,LogInspector,dev-tools-view.store}.tsx/ts`, and `stores/debug-log.store.test.ts`.
- These places treat `status === null` as a network error: `log-filters.ts` statusClass and matchesStatus, `log-stats.ts` errors, `LogsTab.tsx` statusText, and `utils.ts` statusColor. A pending entry also has a null status, so every one of these must check pending first.

App wiring:
- The router is `createHashRouter` (main.tsx:798), so the current app route is `window.location.hash` with the leading '#' and any query removed.
- AppLayout in main.tsx mounts app-level hooks inside QueryClientProvider: `useNotificationPolling(); useUpdatePolling(); ...` near line 661. The QueryClient is created at main.tsx:65.
- DevToolsPage.tsx `handleClear` clears the debug-log, notification and editor stores, so the query-activity store must be cleared there too.

Pitfalls from the previous pass still apply:
- Wrap any render that uses `useQueryClient` in a `QueryClientProvider`.
- Never import `lib/wiki/editor` or `@tiptap/*` from dev-tools modules (the bundle guard test enforces this).
- The React Compiler memoizes reads of mutable objects (the root cause of WR-02), so derive display values from snapshot props, not the mutable `Query`.

Memory rules to honour:
- Tailwind `@container` variants never style the container itself. Put the `@container` class on a wrapper and the grid on an inner element.
- WKWebView does not reliably paint `::highlight`, so search highlights must be real `<mark>` elements.
- A hover-revealed icon must not shift layout: use an absolute overlay or a trailing reserved slot.
- For a full-row click with an inner button, the row click target must be an absolute overlay button that is a SIBLING of the other interactive elements.
- Italic text inside `truncate` needs `pr-0.5`.
- Colour = status only for list rows and timeline bars. The JSON syntax colours are the user-requested exception.
- One row = one line; no card panels around sections; match the local outline `size="xs"` button style.
- Tooltips have at most 4 rows.
- React's onWheel listener is passive, so ctrl/⌘ + wheel zoom needs a native `addEventListener('wheel', fn, { passive: false })` in an effect.

Commits and checks:
- The pre-commit hook runs related tests and blocks RED commits, so write tests and implementation in the same commit.
- Never run `biome --write` across `src`; run `npx biome check <touched files>` only.
</context>

<interfaces>
New pure modules. Tasks 2, 5 and 6 create them; later tasks consume them. The signatures are the contract.

lib/dev-tools/redact.ts (Task 2)
- `redactHeaders(input: HeadersInit | Headers | Record<string, string> | undefined | null): Record<string, string>`
  - Accepts a Headers instance, an array of tuples or a plain object (closes WR-01).
  - Values of secret headers become `'[REDACTED]'`. Secret headers are authorization, private-token, proxy-authorization, cookie, set-cookie, x-api-key, x-auth-token and x-csrf-token, plus any header whose name matches /token|secret|session|password/i.
  - Plain objects keep their original header-name casing; Headers instances yield lower-case names.
- `redactUrl(url: string): string` replaces the values of the private_token, access_token, token, api_key, password and secret params with `REDACTED`. Move the regex out of curl.ts; curl.ts imports it from here.

lib/dev-tools/json-tree.ts (Task 2)
- Constants: `MAX_TREE_BYTES = 1_000_000`, `ARRAY_PAGE = 100`, `DEFAULT_EXPAND_DEPTH = 2`.
- `type JsonPath = readonly (string | number)[]`.
- `parseJsonBody(text: string): { kind: 'json'; value: unknown } | { kind: 'text'; reason: 'invalid' | 'too-large' | 'empty' }`
  - Returns too-large when `byteSize(text) > MAX_TREE_BYTES`.
  - Returns empty for an empty or whitespace-only string.
- `formatJsonPath(path)` produces `fields.status.name`, `issues[3].key`, `[0].id`, and `["weird key"]` for keys that are not JS identifiers. The root (empty path) gives `$`.
- `pathKey(path)` returns a stable id: JSON.stringify of the array.
- `nodeSummary(value)` returns:
  - `{…} 12 keys` / `{…} 1 key` / `{} empty` for objects;
  - `[…] 50 items` / `[…] 1 item` / `[] empty` for arrays.
- `findJsonMatches(value, needle, limit = 500): { matches: Set<string>; expand: Set<string>; count: number; capped: boolean }`
  - Case-insensitive substring match on object keys and stringified primitives.
  - `matches` holds the pathKeys of matching nodes; a key match marks the node at that key.
  - `expand` holds the pathKeys of every ancestor container of every match, root included.
  - An empty needle returns empty sets.
- `collectContainerKeys(value, maxNodes = 5000): Set<string>` returns the pathKeys of every object and array, capped at maxNodes, and descends only into the first ARRAY_PAGE children of an array.

lib/dev-tools/query-params.ts (Task 2)
- `parseQueryParams(url: string): [string, string][]`
  - Keeps order and duplicates.
  - Decodes percent-encoding and `+` as a space.
  - Tolerates invalid URLs by falling back to the text after the first `?` and before any `#`.
  - Returns [] when there is no query.

lib/dev-tools/copy-format.ts (Task 2)
- `entryToJson(entry)`: pretty JSON (2 spaces) of the full entry.
  - `url` goes through redactUrl; `requestHeaders` and `responseHeaders` go through redactHeaders again (defence in depth).
  - Bodies are included as JSON values when they parse, otherwise as strings.
- `entriesToJson(entries)`: a pretty JSON array of the same redacted shape.
- `entryToMarkdown(entry, maxResponseBytes = 4096)`: a bug-report block containing:
  - the heading `### {METHOD} {path} → {status|ERR}`;
  - bullet lines for URL (redacted), Status, Duration `N ms`, Time (ISO), Source, Operation (when set) and Error (when set);
  - `**Request body**` and a fenced `json` block, when there is a request body;
  - `**Response**` and a fenced block capped at maxResponseBytes with a trailing `… truncated (X KB total)` line, or `_Response body not captured_` when the body is empty.
  - Every fence must be longer than any backtick run inside its content.
  - Task 5 extends both builders for pending and queued entries.

Other additions in Task 2:
- ApiLogEntry gains `responseHeaders?: Record<string, string>`.
- log-filters.ts gains `searchHaystack(entry)`: a lowercase `${url}\n${requestBody}\n${responseBody}`, cached in a module-level `WeakMap<ApiLogEntry, string>`. Task 5 must keep the cache correct for patched entries; see Task 5.
- log-stats.ts gains `timingScale(durationMs, median, p95): { max; durationPct; medianPct | null; p95Pct | null }`. `max` is 1.1 × the largest non-null value (at least 1). Percentages run 0-100, rounded to 1 decimal.

Additions in Task 4:
- CacheRow gains `errorUpdatedAt: number` and `snapshotAt: number` (the `now` passed to toCacheRow).
- `relativeTime(iso, now = Date.now())` keeps its old behaviour when `now` is omitted.

UI in dev-tools-ui.tsx (Task 3):
- `useCopyFeedback()` returns `{ state: 'idle'|'copied'|'failed'; copy(text) }`. `copy` calls `navigator.clipboard.writeText` synchronously inside the event handler, and the state resets after 1.5 s. CopyButton is refactored onto this hook.
- `CopyMenu({ items: { label; getText; disabled? }[]; label? })`:
  - The trigger is an outline `size="xs"` button reading "Copy" with a ChevronDown. It shows "Copied" or "Copy failed" as feedback.
  - Each DropdownMenuItem calls `copy(getText())` in its onClick.
- `ListRow` changes:
  - adds `title?` on the overlay button (IN-01);
  - adds `actions?`, rendered absolutely at the right edge (z-20, `opacity-0 group-hover:opacity-100 focus-within:opacity-100`) on a row-coloured background so it never shifts layout;
  - uses `aria-current` instead of aria-pressed;
  - uses a roving `tabIndex`: 0 on the selected row, or on the first row when nothing is selected, and -1 on the rest;
  - adds a `focus-visible:ring-2 ring-inset ring-ring` focus ring (WR-06).

lib/dev-tools/log-entry.ts (Task 5)
- `type EntryState = 'pending' | 'done' | 'error'`.
- `entryState(e)` returns `e.state` when set. Otherwise it returns `'error'` when `e.status === null`, and `'done'` for any other status.
- `isPending(e)` returns `entryState(e) === 'pending'`.
- `entryStart(e)` returns `e.startedAt ?? Date.parse(e.timestamp)`.
- `entryEnd(e, now)` returns `e.endedAt` when set, `now` while the entry is pending, and `entryStart(e) + e.durationMs` otherwise.
- `nowMs()` returns `performance.timeOrigin + performance.now()`.
- `currentRoute()` returns `window.location.hash` with the leading '#' and any '?query' removed. An empty hash gives '/'. It returns '' when `window` is undefined.

ApiLogEntry additions (Task 5), all optional:
- `state?: EntryState`
- `startedAt?: number` (epoch ms with fractions)
- `endedAt?: number`
- `route?: string`

lib/dev-tools/queue-handoff.ts (Task 5)
- A module-level `let handoff: number | null = null`.
- `runWithQueuedAt<T>(queuedAt: number, fn: () => T): T` sets `handoff = queuedAt`, calls `fn()` and in `finally` sets `handoff = null`. The value is cleared once fn's synchronous part has returned its promise.
- `takeQueuedAt(): number | undefined` returns the current handoff and clears it, so only the first apiFetch in a slot consumes it.
- `queueSplit(e: { queuedAt?: number; startedAt?: number; durationMs: number }): { queuedMs: number | null; networkMs: number }` returns `queuedMs = Math.max(0, Math.round(startedAt - queuedAt))` when both are set, otherwise null. `networkMs = durationMs`. Queue time is never folded into durationMs.

ApiLogEntry gains `queuedAt?: number` (epoch ms with fractions, recorded when the call was enqueued on the Jira limiter).

debug-log.store additions (Task 5):
- `update(id: string, patch: Partial<ApiLogEntry>)` replaces that entry with `{ ...old, ...patch }` (a NEW object, so the WeakMap haystack and React memo see the change). It is a no-op when the id was evicted.

lib/dev-tools/timeline-layout.ts (Task 6)
- `BURST_GAP_MS = 1500`.
- `interface Span { id: string; start: number; end: number }`.
- `packLanes(spans): { lane: Map<string, number>; laneCount: number }`
  - Greedy, sorted by start, ties broken by id.
  - A span goes into the lowest lane whose last end is at or before its start; otherwise it opens a new lane.
- `interface Burst { id: string; start: number; end: number; ids: string[]; route: string; count: number; totalMs: number }`
- `groupBursts(items: { id; start; end; route? }[], gapMs = BURST_GAP_MS): Burst[]`
  - Sort by start. A new burst begins when `start - maxEndSoFar > gapMs`.
  - The burst id is `burst-${first id}`, and route is the first item's route or '(unknown)'.
  - `totalMs = end - start`. Results are newest first.
- `concurrencySeries(spans, window: [number, number]): { points: [number, number][]; peak: number; peakAt: number | null }`
  - A step series of in-flight counts clipped to the window. An end at the same instant as a start is processed before the start.
- `queuedSeries(spans: { start: number; queuedAt?: number }[], window)` returns `{ points, peak }`: a step series of requests waiting for a slot (from queuedAt to start), using the same ordering rules as concurrencySeries. It is used by the strip's second series.
- `waterfallSegment(start, end, burst): { leftPct; widthPct }`
  - Clamped to 0-100. widthPct is at least 0.5 so very short requests stay visible.

lib/dev-tools/time-scale.ts (Task 6)
- `createTimeScale([t0, t1], widthPx): { x(t): number; invert(px): number }`. Linear; a zero-length domain is treated as 1 ms.
- `timeTicks([t0, t1], targetCount = 6): { t: number; label: string }[]`
  - Steps are 1/2/5 × 10^k ms, relative to t0, labelled with formatOffset.
- `formatOffset(ms)` gives `0 ms`, `250 ms`, `1.5 s`, `12 s` (below 1000 → integer ms; below 10 s → one decimal s; otherwise integer s).
- `zoomWindow([t0, t1], anchorT, factor, bounds?)` scales around the anchor (factor < 1 zooms in), never below 5 ms span, and clamps to bounds.
- `fitWindow(spans, padRatio = 0.03)` returns [min start, max end] padded; null when there are no spans.
- `brushWindow(px0, px1, scale)` returns the sorted window from two pixel positions; null when |px1 - px0| < 4.

lib/dev-tools/query-activity.ts (Task 6)
- `type QueryActivityKind = 'fetch' | 'success' | 'error' | 'invalidated' | 'removed'`.
- `interface QuerySnap { fetchStatus: string; status: string; isInvalidated: boolean; dataUpdatedAt: number; errorUpdatedAt: number }`.
- `snapshotQuery(query): QuerySnap` reads from `query.state`.
- `diffQueryActivity(prev: QuerySnap | undefined, next: QuerySnap | null): QueryActivityKind[]`
  - `next === null` gives `['removed']`.
  - fetchStatus moving from not-'fetching' to 'fetching' gives 'fetch'.
  - dataUpdatedAt increasing with status 'success' gives 'success'.
  - errorUpdatedAt increasing, or status moving to 'error', gives 'error' (one event, not two).
  - isInvalidated moving from false to true gives 'invalidated'.
  - When prev is undefined, it compares against an idle, pending, not-invalidated, zero-time snapshot.
- `CORRELATION_WINDOW_MS = 150`.
- `correlatedRequestIds(markerAt, entries, windowMs = CORRELATION_WINDOW_MS): Set<string>` returns the ids whose entryStart is in [markerAt, markerAt + windowMs].

stores/query-activity.store.ts (Task 6)
- `interface QueryActivityEvent { id: string; at: number; kind: QueryActivityKind; queryHash: string; keyLabel: string }`
- `useQueryActivityStore` holds `{ events: QueryActivityEvent[]; append(e); clear() }`.
  - Events are newest first, with FIFO eviction at the settings `retentionLimit` (the same lookup pattern as debug-log.store).
  - Transient: no persist middleware.
</interfaces>

<tasks>

<!-- Executor run 1 = Tasks 1-4. Executor run 2 = Tasks 5-6. Executor run 3 = Tasks 7-8. The last task of each run must end green on its own. -->

<task type="auto" tdd="true">
  <name>Task 1: Settings dedupe, concurrency setting removal with migration v41, disabled-state subtitles</name>
  <files>taskflow/src/routes/settings/DebugModeSection.tsx, taskflow/src/routes/settings/DebugModeSection.test.tsx, taskflow/src/routes/dev-tools/DevToolsSettingsPopover.tsx, taskflow/src/routes/dev-tools/DevToolsSettingsPopover.test.tsx, taskflow/src/stores/settings.store.ts, taskflow/src/stores/settings.store.test.ts, taskflow/src/lib/concurrency.ts, taskflow/src/lib/concurrency.test.ts, taskflow/src/routes/dev-tools/LogsTab.tsx, taskflow/src/routes/dev-tools/NotificationsTab.tsx, taskflow/src/routes/dev-tools/EditorTab.tsx</files>
  <behavior>
    - Settings dedupe (D-01) and concurrency removal (D-05):
      - DebugModeSection renders the 'Enable Developer Tools' checkbox and the muted capture-options line.
      - It has no 'Request logging', 'Response body capture', 'Retention limit' or 'Jira concurrency limit' controls, and no 'Network' heading.
      - DevToolsSettingsPopover, once opened, has the Request logging and Response body capture switches and the Retention limit select, and no 'Developer Tools' master switch.
    - Migration v41: `migrate({ jiraConcurrencyLimit: 12, theme: 'dark' }, 40)` returns an object without jiraConcurrencyLimit that keeps theme. The persist version regex test expects `version: 41,`. The store state has no jiraConcurrencyLimit key.
    - lib/concurrency: getJiraLimit() still limits to 6 concurrent calls; the remaining existing limiter tests pass.
  </behavior>
  <action>
Write the new tests first and confirm they fail, then implement. Commit tests and implementation together, because the pre-commit hook rejects RED commits.

**Settings dedupe (D-01, CONTEXT section 1)**
- In DebugModeSection.tsx, keep only the master "Enable Developer Tools" checkbox in the "Developer Tools" subsection.
- Add one muted line under it, `text-xs text-muted-foreground`, reading exactly "Capture options live in Developer Tools → settings".
- Delete these rows:
  - Request logging
  - Response body capture
  - Retention limit
  - Jira concurrency limit (D-05: do NOT create a Network subsection)
- Delete the now-unused store selectors, RETENTION_OPTIONS, CONCURRENCY_OPTIONS and imports.
- Update the file header comment.

**Gear popover**
- In DevToolsSettingsPopover.tsx, remove the master "Developer Tools" ToggleRow and the `disabled={!devToolsEnabled}` props.
- Keep Request logging, Response body capture, Retention limit and the "Applies to new entries." line.
- Update the header comment.

**Remove the Jira concurrency setting (D-05)**
- In settings.store.ts, delete the `jiraConcurrencyLimit` default, the type field, the `setJiraConcurrencyLimit` type and implementation, and the `setConcurrencyRuntime` import.
- Replace the body of the v13 migration line with a comment ("v13 added jiraConcurrencyLimit; removed in v41"), so the type no longer references the field.
- Bump `version: 40` to `version: 41`.
- Add `if (version < 41) { delete (s as Record<string, unknown>).jiraConcurrencyLimit; }` with a one-line comment: the setting was removed because it never took effect after a restart.
- Make sure resetSettings and any partialize or defaults list no longer mention the key.
- In settings.store.test.ts:
  - drop `jiraConcurrencyLimit: 12` from the reset fixture;
  - delete the 'restores jiraConcurrencyLimit to 6' test;
  - update the version regex test (title and `/version: 41,/`);
  - add the v41 migration test from behavior.
- In lib/concurrency.ts, delete the `setJiraConcurrencyLimit` export and the mutable `Current` variable, keep `getJiraLimit()` returning a fixed pLimit(6), and update the header comment ("Default concurrency: 6" with no reference to the dev tools toggle). Delete the two `setJiraConcurrencyLimit` tests in concurrency.test.ts and keep the rest. (Task 5 later wraps getJiraLimit for queue-wait capture.)
- Finally, grep `jiraConcurrencyLimit|setJiraConcurrencyLimit|Jira concurrency` under src. The only allowed hits are the v13 comment and the v41 migration line and comment.

**Disabled-state subtitles**
- In LogsTab.tsx, NotificationsTab.tsx and EditorTab.tsx, change only the disabled EmptyState subtitle from "Enable them in the settings popover above." to "Enable them in Settings → Advanced."
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit && npx vitest run src/routes/settings src/routes/dev-tools src/stores/settings.store.test.ts src/lib/concurrency.test.ts && npx biome check src/routes/settings/DebugModeSection.tsx src/routes/settings/DebugModeSection.test.tsx src/routes/dev-tools/DevToolsSettingsPopover.tsx src/routes/dev-tools/DevToolsSettingsPopover.test.tsx src/stores/settings.store.ts src/stores/settings.store.test.ts src/lib/concurrency.ts src/lib/concurrency.test.ts src/routes/dev-tools/LogsTab.tsx src/routes/dev-tools/NotificationsTab.tsx src/routes/dev-tools/EditorTab.tsx</automated>
  </verify>
  <done>
- DebugModeSection shows only the master toggle and the capture-options line.
- jiraConcurrencyLimit is removed, and persist v41 deletes the key.
- The popover has no master toggle.
- The disabled EmptyStates point to Settings → Advanced.
- tsc is clean, the targeted tests pass, and biome is clean on the touched files.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Pure modules (redact, json-tree, query-params, copy-format, searchHaystack, timingScale), response-header capture, JsonTree component</name>
  <files>taskflow/src/lib/apiFetch.ts, taskflow/src/stores/debug-log.store.ts, taskflow/src/lib/dev-tools/redact.ts, taskflow/src/lib/dev-tools/redact.test.ts, taskflow/src/lib/dev-tools/curl.ts, taskflow/src/lib/dev-tools/json-tree.ts, taskflow/src/lib/dev-tools/json-tree.test.ts, taskflow/src/lib/dev-tools/query-params.ts, taskflow/src/lib/dev-tools/query-params.test.ts, taskflow/src/lib/dev-tools/copy-format.ts, taskflow/src/lib/dev-tools/copy-format.test.ts, taskflow/src/lib/dev-tools/log-filters.ts, taskflow/src/lib/dev-tools/log-filters.test.ts, taskflow/src/lib/dev-tools/log-stats.ts, taskflow/src/lib/dev-tools/log-stats.test.ts, taskflow/src/routes/dev-tools/JsonTree.tsx</files>
  <behavior>
    - redactHeaders:
      - The plain object {Authorization:'Bearer x', Accept:'a'} gives Authorization '[REDACTED]' and keeps Accept.
      - A Headers instance with set-cookie gives set-cookie '[REDACTED]'.
      - Tuple arrays work.
      - X-Session-Id is redacted by the name pattern.
      - undefined gives {}.
    - redactUrl: `?private_token=abc&x=1` gives `?private_token=REDACTED&x=1`. A URL without secrets is unchanged. The existing curl tests still pass.
    - parseJsonBody: '{"a":1}' gives json; 'not json' gives text/invalid; '' gives text/empty; a string over MAX_TREE_BYTES gives text/too-large without calling JSON.parse.
    - formatJsonPath: ['fields','status','name'] gives 'fields.status.name'; ['issues',3,'key'] gives 'issues[3].key'; [0,'id'] gives '[0].id'; ['a b'] gives '["a b"]'; [] gives '$'.
    - nodeSummary: 12 keys gives '{…} 12 keys'; 1 key gives '{…} 1 key'; {} gives '{} empty'; 50 items gives '[…] 50 items'; [] gives '[] empty'.
    - findJsonMatches:
      - 'done' matches fields.status.name, and expand contains the root, fields and fields.status.
      - A key match is case-insensitive.
      - An empty needle gives empty sets.
      - limit caps the count and sets capped.
    - collectContainerKeys returns the root and the nested containers, respects maxNodes, and doesn't descend past ARRAY_PAGE array children.
    - parseQueryParams:
      - 'https://h/p?jql=a%20b&x=1&x=2' gives [['jql','a b'],['x','1'],['x','2']].
      - '+' decodes to a space.
      - A URL with no query gives [].
      - A malformed percent sequence keeps the raw text.
    - entryToJson: the output parses; Authorization is '[REDACTED]'; an injected 'Bearer secret' is redacted; private_token is redacted; a JSON response body becomes an object.
    - entryToMarkdown:
      - Includes '### GET /rest/api/2/issue/ABC-1 → 200', '42 ms' and a fenced response.
      - A 10 KB response is capped with the truncated line.
      - A body containing ``` gets a longer fence.
      - An empty response gives '_Response body not captured_'.
      - The output contains no token.
    - searchHaystack returns lowercase text and the same string on repeat calls. The existing filterLogs tests stay green.
    - timingScale(100, 50, 200) gives max 220 and durationPct ≈ 45.5. Null median or p95 gives null percentages. All zeros give max 1.
  </behavior>
  <action>
Write the tests for each pure module first and confirm they fail, then implement. Commit tests and implementation together.

**Response headers (D-03)**
- Add `responseHeaders?: Record<string, string>` to ApiLogEntry.
- In apiFetch.ts, replace the inline header-sanitising loop with `redactHeaders(init?.headers)` (this also handles Headers and tuple inits, closing WR-01).
- On the success path, set `responseHeaders: redactHeaders(response.headers)`.
- Update the file header comment.
- The behaviour when Developer Tools are off is unchanged.

**Pure modules**
- Create redact.ts, json-tree.ts, query-params.ts and copy-format.ts exactly as the interfaces block specifies. curl.ts imports redactUrl.
- Add searchHaystack to log-filters.ts and timingScale to log-stats.ts, with tests appended to the existing test files.
- json-tree.ts reuses byteSize from json-preview.ts.
- Never build a regex from user input.

**JsonTree component (D-02)**
New file routes/dev-tools/JsonTree.tsx, default export. Props: `{ text?: string; value?: unknown; label?: string; maxHeightClass?: string }`.
- Input:
  - With `text`, parse via parseJsonBody inside a useMemo keyed on text.
  - With `value`, skip parsing. Compute the raw text `safeStringify(value)` lazily, only when Raw mode or a copy needs it.
- Toolbar (one compact row of ghost `size="xs"` buttons):
  - an optional label and size;
  - a search input (h-6 text-xs, aria-label "Search in body") with a match count;
  - Expand all and Collapse all;
  - a Raw / Tree SectionSegmented.
  - Hide the tree-only controls for non-JSON bodies, and show "Large body: raw view" for too-large bodies.
- Tree:
  - monospace text-xs, leading-5, tabular-nums;
  - a recursive Node that renders children ONLY when expanded.
- Expansion:
  - a Map of pathKey to boolean overrides on top of the default `depth < DEFAULT_EXPAND_DEPTH`;
  - Expand all uses collectContainerKeys;
  - Collapse all clears the overrides and sets a collapseAll flag;
  - a non-empty search forces every pathKey in `expand` open.
- A chevron button (aria-expanded, aria-label "Toggle {path}") precedes each object and array. A collapsed node shows its nodeSummary, muted.
- Arrays render ARRAY_PAGE children, then a "Show N more" button that raises that path's visible count by ARRAY_PAGE.
- Keys are buttons. A click copies formatJsonPath(path) synchronously and shows "Copied path" in the toolbar status.
- Each primitive line is a `relative group` row. A copy button (lucide Copy, size-3, aria-label "Copy value") sits absolutely at the right edge with opacity-0, group-hover:opacity-100, focus-visible:opacity-100 and a bg-background backing, so it never shifts layout.
- Define the token classes once, in a TOKEN_CLASS map:

  | Token | Classes |
  |-------|---------|
  | key | text-sky-700 dark:text-sky-300 |
  | string | text-emerald-700 dark:text-emerald-300 |
  | number | text-violet-700 dark:text-violet-300 |
  | boolean | text-amber-700 dark:text-amber-300 |
  | null | text-muted-foreground |
  | punctuation | text-muted-foreground |

- Search matches are wrapped in real `<mark className="rounded-sm bg-yellow-300/60 text-inherit dark:bg-yellow-500/40">` elements.
- Raw mode and the non-JSON fallback reuse JsonBlock.
- Never import from lib/wiki/editor or @tiptap. Do not wire JsonTree into the tabs in this task (Tasks 3-4 do that).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit && npx vitest run src/lib/dev-tools src/routes/dev-tools && npx biome check src/lib/apiFetch.ts src/stores/debug-log.store.ts src/lib/dev-tools/redact.ts src/lib/dev-tools/redact.test.ts src/lib/dev-tools/curl.ts src/lib/dev-tools/json-tree.ts src/lib/dev-tools/json-tree.test.ts src/lib/dev-tools/query-params.ts src/lib/dev-tools/query-params.test.ts src/lib/dev-tools/copy-format.ts src/lib/dev-tools/copy-format.test.ts src/lib/dev-tools/log-filters.ts src/lib/dev-tools/log-filters.test.ts src/lib/dev-tools/log-stats.ts src/lib/dev-tools/log-stats.test.ts src/routes/dev-tools/JsonTree.tsx</automated>
  </verify>
  <done>
- All the new pure-module tests pass, and so do the existing curl, log-filters and log-stats tests.
- apiFetch logs redacted responseHeaders.
- JsonTree.tsx compiles and is ready to use.
- tsc and biome are clean on the touched files.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Log inspector reorganization, copy menu, Logs list/toolbar polish, layout focus/resize/maximize, header 'Clear logs'</name>
  <files>taskflow/src/routes/dev-tools/dev-tools-ui.tsx, taskflow/src/routes/dev-tools/dev-tools-view.store.ts, taskflow/src/routes/dev-tools/ListInspectorLayout.tsx, taskflow/src/routes/dev-tools/LogInspector.tsx, taskflow/src/routes/dev-tools/LogsTab.tsx, taskflow/src/routes/dev-tools/utils.ts, taskflow/src/routes/dev-tools/DevToolsPage.tsx, taskflow/src/routes/dev-tools/DevToolsPage.test.tsx, taskflow/src/routes/dev-tools/EditorTab.test.tsx</files>
  <behavior>
    - Selecting a row shows the summary header with the method, status pill and full URL. The meta line contains 'ms' and the source.
    - The Copy menu lists Copy URL, Copy as cURL, Copy response, Copy request body, Copy log entry as JSON and Copy as Markdown.
      - Copy as cURL still writes `$JIRA_TOKEN` and never '[REDACTED]'.
      - Copy log entry as JSON writes parseable JSON with Authorization '[REDACTED]'.
      - Copy as Markdown starts with '### GET'.
    - Overview lists the parsed query params for `?jql=a%20b` ('jql', 'a b') and the entry's response headers.
    - Body renders the 'Request' and 'Response' labels, and the response renders as a JsonTree (the key 'key' is visible).
    - Toolbar 'Copy all' writes a JSON array of the filtered entries. Export calls saveBytes (mocked) with a `.json` filename.
    - The selected row has aria-current='true'. The resize handle is focusable (role separator), and ArrowLeft changes the inspector width.
    - With nothing selected, the inspector shows 'Select a request'. The maximize toggle hides the list pane and restores it.
    - The summary strip shows the chips Requests, Errors, Median, p95 and Slowest. The existing filter test is updated to the chip text.
    - The page header has a 'Clear logs' button, and no 'Clear all' button. Clicking it empties the log store.
  </behavior>
  <action>
Implements D-03 (CONTEXT section 3) and D-04 (section 4) for the Logs tab, plus WR-04 and WR-06.

**dev-tools-ui.tsx**
- Add useCopyFeedback and CopyMenu, refactor CopyButton onto useCopyFeedback, and extend ListRow, all exactly as the interfaces block specifies.
- ListRow keeps `data-testid="devtools-row"` on the overlay button and adds `group` to the row wrapper.
- Selected rows get `bg-accent` plus `shadow-[inset_2px_0_0_var(--primary)]`.
- useListKeyboard moves DOM focus to the newly selected row's overlay button: `rows[next].focus()`, plus scrollIntoView with block 'nearest'.

**dev-tools-view.store.ts**
- Add `inspectorMaximized: boolean` (default false) and `setInspectorMaximized`. Keep it transient.

**ListInspectorLayout.tsx**
- Toolbar container: `flex flex-wrap items-center gap-x-2 gap-y-1.5`.
- Raise the inspector max to 0.85 of the layout width.
- Resize handle (WR-06):
  - remove aria-hidden;
  - add role="separator", aria-orientation="vertical", aria-label "Resize inspector", aria-valuenow={Math.round(width)} and tabIndex={0};
  - wire onKeyDown to `handleKeyDown` from useResizable;
  - show a ring-coloured border on focus-visible.
- Remove the scroller's tabIndex and its noNoninteractiveTabindex biome-ignore. Keep onKeyDown on the scroller.
- When `inspectorMaximized` is on and an inspector exists, hide the list pane, let the inspector take `flex-1`, and hide the resize handle.
- The default empty inspector becomes a compact EmptyState (MousePointerClick icon) with a title from a new `emptyTitle` prop, default "Select a row".
- Export `InspectorMaximizeButton`: ghost icon-sm, Maximize2 / Minimize2 icons, aria-label "Maximize inspector" / "Restore inspector", aria-pressed.

**LogInspector.tsx**
- Summary header:
  - Line 1: the method in mono semibold (colour-neutral), the status pill (statusPillClass), then the InspectorMaximizeButton and the CopyMenu on the right.
  - Line 2: the full decoded URL, mono text-xs break-all.
  - Line 3: a muted meta line joined by ' · ': `{durationMs} ms`, the size (formatBytes(byteSize(responseBody)), memoized on entry.id), local time, source, and the operation when set.
- Three collapsible sections, each a SectionHeader with `sticky={false}`, expanded by default:
  - **Overview**:
    - a General KeyValueTable: URL, Method, Status, Duration, Size, and Started (ISO plus local);
    - Query parameters, with a count (from parseQueryParams), omitted when empty;
    - Request headers, with a count;
    - Response headers, with a count, or "Not captured";
    - the network error line in red when there is one.
  - **Body**:
    - Wrap it in an element with the `@container` class. The inner element is `grid gap-4 @[720px]:grid-cols-2`.
    - Each column has a "Request" / "Response" label plus a muted size, then `<JsonTree text>`.
    - With no request body, render only Response, full width.
    - With an empty response, show "Response body capture is off", or the error.
  - **Timing**:
    - a KeyValueTable: Started, Duration, Operation, Source, Median, p95, and Relative ("N.Nx the median");
    - a timingScale bar: an `h-2 rounded bg-muted` track with a `bg-primary/70` fill, and thin ticks for the median and p95, labelled underneath in muted text-[11px]. Neutral colour only.
- CopyMenu items:
  - Copy URL
  - Copy as cURL (buildCurl)
  - Copy response (disabled when empty)
  - Copy request body (disabled when there is none)
  - Copy log entry as JSON (entryToJson)
  - Copy as Markdown (entryToMarkdown)

**LogsTab.tsx**
- Toolbar order:
  1. ToolbarSearch.
  2. The facet FilterPopovers.
  3. An `ml-auto border-l pl-2 ml-1` action group holding: the Paused label, Pause/Resume, "Copy all" (CopyButton with entriesToJson(filtered), disabled when filtered is empty), "Export", and Clear last.
- Export:
  - Build `entriesToJson(filtered)` and call `saveBytes(new TextEncoder().encode(json), \`taskflow-api-log-${timestamp}.json\`)`.
  - Then call `revealItemInDir(path)` from @tauri-apps/plugin-opener.
  - Show "Exported" or "Export failed" for 1.5 s.
- Summary stat chips (keep `data-testid="logs-summary"`):
  - each chip is a muted label plus a `tabular-nums text-foreground` value, with gap-4 between chips;
  - Requests; Errors (red only when > 0); Median; p95; Slowest (with a title of method + path).
- LogRow uses fixed flex-none columns:

  | Column | Sizing and style |
  |--------|------------------|
  | Source | w-14 |
  | Method | w-12, colour-neutral |
  | Status | w-10, status colour only |
  | Path | flex-1 min-w-0 truncate |
  | Operation | max-w-40 truncate |
  | Duration | w-16, right-aligned, tabular-nums |
  | Time | w-20, right-aligned, tabular-nums |

  - The path shows the origin dimmed (text-muted-foreground/60) followed by displayPath, falling back to the raw text when the URL doesn't parse.
- ListRow `title` = the full decoded URL (IN-01). The `actions` slot holds a ghost icon button (Copy, aria-label "Copy URL").
- Pass `emptyTitle="Select a request"` to the layout.
- WR-04: wrap filtered, stats and ids in a useMemo keyed on the entries and the filter values.

**utils.ts**
- Add `statusPillClass(status)`: statusColor plus `rounded px-1.5 py-0.5 font-mono text-xs font-semibold`, with a bg tint for 2xx and 3xx as well.

**Header Clear button**
- In DevToolsPage.tsx, rename the header button label from "Clear all" to "Clear logs" and update the file header comment. Behaviour is unchanged: it still clears every Developer Tools store.
- In EditorTab.test.tsx, update the test title and the `getByRole('button', { name: 'Clear all' })` assertion to 'Clear logs'.
- In DevToolsPage.test.tsx, add a test that 'Clear logs' exists, that no 'Clear all' button exists, and that clicking it empties the debug-log store.

**DevToolsPage.test.tsx**
- The cURL test opens the "Copy" menu and clicks the menuitem (follow the menus.test.tsx pattern).
- The summary assertions use the chip text (e.g. /Requests\s*2/).
- Add the behavior tests above.
- `vi.mock` `../../lib/save-attachment` and `@tauri-apps/plugin-opener`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit && npx vitest run src/routes/dev-tools src/lib/dev-tools && npx biome check src/routes/dev-tools/dev-tools-ui.tsx src/routes/dev-tools/dev-tools-view.store.ts src/routes/dev-tools/ListInspectorLayout.tsx src/routes/dev-tools/LogInspector.tsx src/routes/dev-tools/LogsTab.tsx src/routes/dev-tools/utils.ts src/routes/dev-tools/DevToolsPage.tsx src/routes/dev-tools/DevToolsPage.test.tsx src/routes/dev-tools/EditorTab.test.tsx</automated>
  </verify>
  <done>
- The Logs inspector has the summary header and the Overview, Body and Timing sections, with side-by-side bodies at a container width of 720px or more.
- The Copy menu has all six items. Copy all and Export work. The header button reads "Clear logs".
- Rows use the fixed grid with a dimmed host, aria-current, the focus ring and the hover Copy URL overlay.
- The resize handle is keyboard-operable, maximize works, and the empty inspector shows the EmptyState.
- The dev-tools tests are green, and tsc and biome are clean.
  </done>
</task>

<task type="auto">
  <name>Task 4: JsonTree and copy menus on Cache, Notifications and Editor; WR-02 live times; IN-01 row titles; end of executor run 1 green</name>
  <files>taskflow/src/lib/dev-tools/query-cache-snapshot.ts, taskflow/src/lib/dev-tools/query-cache-snapshot.test.ts, taskflow/src/lib/relative-time.ts, taskflow/src/routes/dev-tools/CacheInspector.tsx, taskflow/src/routes/dev-tools/CacheTab.tsx, taskflow/src/routes/dev-tools/NotificationsTab.tsx, taskflow/src/routes/dev-tools/NotificationsTab.test.tsx, taskflow/src/routes/dev-tools/EditorTab.tsx, taskflow/src/routes/dev-tools/EditorTab.test.tsx</files>
  <action>
Implements the D-03 copy-menu pattern and the D-02 JsonTree rollout on the other tabs, plus D-04 review items WR-02 and IN-01.

**WR-02 (Cache times freeze)**
- toCacheRow stores `snapshotAt: now` and `errorUpdatedAt: state.errorUpdatedAt`. Rename `_now` to `now`, and add test assertions for both fields.
- relativeTime gets the optional `now` parameter.
- CacheTab `updatedAgo` and CacheInspector `ts()` take `now` from `row.snapshotAt` and the times from `row.dataUpdatedAt` / `row.errorUpdatedAt`, never from the mutable `query.state`.

**CacheInspector.tsx**
- The header keeps the key pre and the scoped action buttons (unchanged, `exact: true`).
- Then a CopyMenu (Copy key, Copy data) replaces the two CopyButtons, followed by the InspectorMaximizeButton.
- The Data section renders `<JsonTree value={query.state.data} />`, with the size label from the memoized dataText (still keyed on hash + dataUpdatedAt).

**CacheTab.tsx**
- Remove the dead `title="Observers"` from the cell (IN-01). Pass `title={r.keyLabel}` to ListRow, and put "observers" into the row's aria label instead.
- Pass `emptyTitle="Select a query"`.

**NotificationsTab.tsx**
- Add an inspector header row with the InspectorMaximizeButton and a CopyMenu: Copy entry as JSON (safeStringify(entry)), and Copy title and body.
- Replace the Raw item(s) JsonBlock with `<JsonTree value={entry.kind === 'summary' ? entry.items : entry.item} />`, keeping the 'Raw items' / 'Raw item' titles.
- Add row titles and `emptyTitle="Select a notification"`.

**EditorTab.tsx**
- Add the InspectorMaximizeButton and a CopyMenu to the meta row: Copy entry as JSON, Copy original markup (disabled when absent), Copy produced markup (disabled when absent).
- Detail values that are objects or arrays render with JsonTree.
- Add a final "Raw entry" SectionHeader (sticky false), collapsed by default, that shows `<JsonTree value={entry} />` when expanded.
- Do not touch DiffPair, Diagnosis or outlineShape. Import nothing from lib/wiki/editor.
- Add row titles and `emptyTitle="Select an event"`.

**Tests**
- NotificationsTab.test.tsx: "Copy entry as JSON" writes parseable JSON.
- EditorTab.test.tsx: "Copy produced markup" is disabled without markup, and copies the produced text when markup exists.
- Keep the existing assertions. Update only the ones that deliberately change, and list them in the SUMMARY.

**End-of-run checks**
This task ends executor run 1, so it must be green on its own. Run the verify command below, which covers every suite touched by Tasks 1-4. Then grep for leftovers:
- no `aria-pressed` in ListRow;
- no "settings popover above" text;
- no `JsonBlock` usages outside dev-tools-ui.tsx and JsonTree.tsx.

The full `npm test` gate runs at the end of Task 8.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit && npx vitest run src/routes/dev-tools src/lib/dev-tools src/routes/settings src/stores/settings.store.test.ts src/stores/debug-log.store.test.ts src/lib/concurrency.test.ts src/lib/relative-time && npx biome check src/lib/dev-tools/query-cache-snapshot.ts src/lib/dev-tools/query-cache-snapshot.test.ts src/lib/relative-time.ts src/routes/dev-tools/CacheInspector.tsx src/routes/dev-tools/CacheTab.tsx src/routes/dev-tools/NotificationsTab.tsx src/routes/dev-tools/NotificationsTab.test.tsx src/routes/dev-tools/EditorTab.tsx src/routes/dev-tools/EditorTab.test.tsx && test "$(grep -rn 'settings popover above' src/routes/dev-tools | wc -l | tr -d ' ')" = "0" && test "$(grep -rln 'JsonBlock' src/routes/dev-tools | grep -v -e dev-tools-ui.tsx -e JsonTree.tsx | wc -l | tr -d ' ')" = "0"</automated>
  </verify>
  <done>
- The Cache, Notifications and Editor inspectors use JsonTree for structured data, have the shared Copy menu, and have a maximize toggle.
- Cache "ago" times advance.
- Row tooltips work.
- Every suite touched in Tasks 1-4 passes (dev-tools, lib/dev-tools, settings, settings.store, debug-log.store, concurrency, relative-time); tsc and biome are clean; the leftover greps return zero.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: In-flight capture, pending audit across consumers, queue-wait handoff, useNow and pause</name>
  <files>taskflow/src/lib/apiFetch.ts, taskflow/src/stores/debug-log.store.ts, taskflow/src/stores/debug-log.store.test.ts, taskflow/src/lib/dev-tools/log-entry.ts, taskflow/src/lib/dev-tools/log-entry.test.ts, taskflow/src/lib/dev-tools/queue-handoff.ts, taskflow/src/lib/dev-tools/queue-handoff.test.ts, taskflow/src/lib/concurrency.ts, taskflow/src/lib/concurrency.test.ts, taskflow/src/lib/dev-tools/log-filters.ts, taskflow/src/lib/dev-tools/log-filters.test.ts, taskflow/src/lib/dev-tools/log-stats.ts, taskflow/src/lib/dev-tools/log-stats.test.ts, taskflow/src/lib/dev-tools/copy-format.ts, taskflow/src/lib/dev-tools/copy-format.test.ts, taskflow/src/routes/dev-tools/utils.ts, taskflow/src/routes/dev-tools/useNow.ts, taskflow/src/routes/dev-tools/dev-tools-view.store.ts, taskflow/src/routes/dev-tools/LogsTab.tsx, taskflow/src/routes/dev-tools/LogInspector.tsx, taskflow/src/routes/dev-tools/DevToolsPage.test.tsx</files>
  <behavior>
    - log-entry:
      - entryState returns the explicit state when set; for legacy entries, status null gives 'error' and 200 gives 'done'.
      - entryStart falls back to Date.parse(timestamp).
      - entryEnd uses endedAt, then `now` while pending, then start + durationMs.
      - currentRoute strips '#' and the query ('#/dashboard?x=1' gives '/dashboard'); an empty hash gives '/'.
    - debug-log.store:
      - update(id, patch) merges into a new object at the same index.
      - Updating an evicted id is a no-op.
      - The existing append, FIFO and clear tests still pass.
    - queue-handoff:
      - `runWithQueuedAt(100, () => takeQueuedAt())` returns 100.
      - A second takeQueuedAt inside the same fn returns undefined.
      - After runWithQueuedAt returns, takeQueuedAt() is undefined, including when fn throws.
      - An async fn whose first statement is an `await Promise.resolve()` followed by takeQueuedAt() gets undefined (documents the best-effort limit).
      - queueSplit({queuedAt: 1000, startedAt: 1120.4, durationMs: 192}) gives queuedMs 120 and networkMs 192. Without queuedAt, queuedMs is null.
    - concurrency.ts:
      - With 7 calls through getJiraLimit() where each fn calls a stub that reads takeQueuedAt(), all 7 get a number.
      - The 7th call's value is earlier than the moment its fn starts, because it waited for a slot.
      - The existing limiter tests still pass.
    - Pending entries:
      - filterLogs with statuses {'errors'} excludes a pending entry; the 'pending' facet selects only pending entries.
      - computeLogStats excludes pending entries from errors, median, p95 and slowest, and exposes `inFlight` (the count of pending entries).
      - entryToMarkdown on a pending entry shows 'pending' instead of a status and no duration; with queuedAt it adds 'Queued 120 ms'.
    - useNow returns frozenAt when given and does not tick.
    - UI:
      - Appending a pending entry renders a row whose status reads 'pending'.
      - The summary contains '1 in flight'.
      - Patching the entry via update to status 200 replaces it with '200' and removes the in-flight chip.
      - Pausing while an entry is pending keeps its elapsed text unchanged after advancing fake timers.
      - The inspector Timing for an entry with queuedAt shows 'Queued' and 'Network' rows.
  </behavior>
  <action>
Implements D-06 (in-flight capture) and the queue-wait amendment. This is the first task of executor run 2, so it starts from a green tree.

**log-entry.ts and ApiLogEntry**
- Create log-entry.ts exactly as the interfaces block specifies.
- Add the optional fields to ApiLogEntry: `state`, `startedAt`, `endedAt`, `route`, `queuedAt`, each with a one-line comment. `timestamp` stays the ISO start time.

**debug-log.store**
- Add `update(id, patch)`. Use `map` to swap in `{ ...old, ...patch }` and keep the array order, so newest-first by start is preserved.
- Update the store header comment.

**apiFetch.ts (D-06)**
- Read `const queuedAt = takeQueuedAt()` as the FIRST statement, before any await. Always consume it, so it can't leak to an unrelated call even when dev tools are off.

When Developer Tools and requestLogging are both on:
- Before `fetch`, append an entry with:
  - `state: 'pending'`, `status: null`, `durationMs: 0`, `responseBody: ''`;
  - `startedAt: nowMs()`, `timestamp: new Date().toISOString()`;
  - `route: currentRoute()`, plus the request headers, request body and operation;
  - `queuedAt`, only when it is defined.
- On success, call `update(id, { state: 'done', status, durationMs, endedAt: nowMs(), responseBody, responseHeaders })`.
- On a network error, call `update(id, { state: 'error', status: null, durationMs, endedAt, error })`.

Additional rules:
- Compute durationMs from the high-resolution start: `Math.round(endedAt - startedAt)`. This is network time; queue time is never folded in.
- When requestLogging is off, nothing is appended, exactly as before.
- Remove the two old `append` calls at completion.
- The disabled pass-through path is unchanged apart from consuming the handoff.
- Updater entries appended elsewhere stay valid through the log-entry fallbacks.

**Queue wait capture (best effort)**
- Create lib/dev-tools/queue-handoff.ts exactly as the interfaces block specifies, with tests.
- In lib/concurrency.ts:
  - export `JIRA_CONCURRENCY = 6`;
  - keep the internal `pLimit(JIRA_CONCURRENCY)`;
  - make `getJiraLimit()` return a wrapper `<T>(fn: () => Promise<T> | T) => Promise<T>` that records `const queuedAt = nowMs()` at call (enqueue) time, then calls `limit(() => runWithQueuedAt(queuedAt, fn))`.
  - Keep the call-site API identical. No changes are needed in services/jira.ts or services/jira/client.ts; verify both still type-check.
  - If p-limit's `activeCount` / `pendingCount` are used anywhere, expose them on the wrapper too. Grep first; if nothing uses them, skip.
- Write a doc comment in queue-handoff.ts explaining the mechanism: a synchronous module-level handoff that works because both current call sites call apiFetch in the synchronous part of fn. A fn that awaits before apiFetch gets no queuedAt rather than a wrong one. If a future call site needs that, pass `queuedAt` explicitly via a new optional apiFetch option.

**Every ApiLogEntry consumer: pending must not read as an error**
- log-filters.ts:
  - statusClass and matchesStatus use `entryState`;
  - pending is never 'error' or 'errors', and matches only when no status facet is selected or 'pending' is selected;
  - add 'pending' to STATUS_FACETS so it can be filtered;
  - the searchHaystack WeakMap stays correct because `update` creates a new object.
- log-stats.ts:
  - computeLogStats ignores pending entries for errors, median, p95 and slowest;
  - it adds `inFlight: number` to LogStats;
  - total still counts every entry. Update the existing tests where the shape changed.
- copy-format.ts:
  - for a pending entry, Markdown shows `Status: pending` and omits Duration;
  - Markdown adds a "Queued N ms" bullet when queueSplit gives a number;
  - JSON includes `state` and `queuedAt` naturally.
- curl.ts needs no change. Confirm this, and note it in the SUMMARY.
- utils.ts statusColor and statusPillClass, and LogsTab statusText, take the entry state (or a `pending` flag) first. Pending renders `text-muted-foreground` with no tint, and the text 'pending'.
- LogInspector:
  - for a pending entry, the header pill reads 'pending', the meta line shows the live elapsed time (`useNow`) instead of the duration, and the Body/Timing sections show "Waiting for response…". The Timing bar is hidden while pending;
  - the Timing KeyValueTable shows "Queued" (`N ms`, or "–" when not queued) and "Network" (`durationMs ms`) as separate rows, and the Timing bar draws the queued part as a hatched muted lead-in before the network fill;
  - the Overview General table adds Queued when present.
- Filters, stats and cURL ignore queuedAt.

**useNow.ts**
- `useNow(intervalMs: number, enabled: boolean, frozenAt?: number | null): number`.
- Returns `frozenAt` when given; otherwise it ticks `nowMs()` every intervalMs while enabled.
- The interval is cleared when disabled or unmounted.

**Pause**
- dev-tools-view.store gains `pausedAt: number | null`, set to nowMs() on Pause and to null on Resume (setPausedEntries sets both).
- LogsTab computes `now = useNow(250, hasPending, pausedAt)`, so a paused snapshot shows pending rows frozen at their elapsed time when paused.

**Summary strip and rows**
- When `stats.inFlight > 0`, add an "N in flight" chip with `text-muted-foreground` and a small pulsing dot (neutral colour).
- A pending row shows the status cell text 'pending' (muted) and the duration cell `{elapsed} ms` from now - entryStart.

**DevToolsPage.test.tsx**
- Add the UI tests from behavior, driving `useDebugLogStore.getState().append` and then `update`. Use `vi.useFakeTimers()` for the pause test.
- Ensure the earlier tests still pass. The fixtures have no state, so they go through the legacy fallbacks.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit && npx vitest run src/lib/dev-tools src/routes/dev-tools src/stores/debug-log.store.test.ts src/lib/concurrency.test.ts src/hooks/useUpdatePolling.test.ts && npx biome check src/lib/apiFetch.ts src/stores/debug-log.store.ts src/stores/debug-log.store.test.ts src/lib/dev-tools/log-entry.ts src/lib/dev-tools/log-entry.test.ts src/lib/dev-tools/queue-handoff.ts src/lib/dev-tools/queue-handoff.test.ts src/lib/concurrency.ts src/lib/concurrency.test.ts src/lib/dev-tools/log-filters.ts src/lib/dev-tools/log-filters.test.ts src/lib/dev-tools/log-stats.ts src/lib/dev-tools/log-stats.test.ts src/lib/dev-tools/copy-format.ts src/lib/dev-tools/copy-format.test.ts src/routes/dev-tools/utils.ts src/routes/dev-tools/useNow.ts src/routes/dev-tools/dev-tools-view.store.ts src/routes/dev-tools/LogsTab.tsx src/routes/dev-tools/LogInspector.tsx src/routes/dev-tools/DevToolsPage.test.tsx</automated>
  </verify>
  <done>
- Requests appear as pending at start and are patched in place on completion.
- Stats and filters ignore pending entries, and "N in flight" shows.
- Pause freezes the elapsed time.
- Jira requests that waited for a slot carry queuedAt, and the inspector shows Queued and Network separately.
- The targeted tests pass, and tsc and biome are clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: Query-activity capture (diff, store, app-level hook), timeline pure modules, waterfall column; end of executor run 2 green</name>
  <files>taskflow/src/lib/dev-tools/query-activity.ts, taskflow/src/lib/dev-tools/query-activity.test.ts, taskflow/src/stores/query-activity.store.ts, taskflow/src/stores/query-activity.store.test.ts, taskflow/src/hooks/useQueryActivityCapture.ts, taskflow/src/hooks/useQueryActivityCapture.test.tsx, taskflow/src/main.tsx, taskflow/src/lib/dev-tools/timeline-layout.ts, taskflow/src/lib/dev-tools/timeline-layout.test.ts, taskflow/src/lib/dev-tools/time-scale.ts, taskflow/src/lib/dev-tools/time-scale.test.ts, taskflow/src/routes/dev-tools/utils.ts, taskflow/src/routes/dev-tools/LogsTab.tsx, taskflow/src/routes/dev-tools/DevToolsPage.tsx, taskflow/src/routes/dev-tools/DevToolsPage.test.tsx</files>
  <behavior>
    - diffQueryActivity:
      - Moving from idle to fetching gives ['fetch'].
      - Moving from fetching to idle with dataUpdatedAt increased gives ['success'].
      - An error gives ['error'] once.
      - isInvalidated going from false to true gives ['invalidated'].
      - null gives ['removed'].
      - An unchanged snapshot gives [].
      - Undefined prev with a fetching snapshot gives ['fetch'].
    - correlatedRequestIds returns entries starting within [t, t+150] and excludes one at t+151 and one before t.
    - query-activity.store: append prepends, evicts at the retention limit, and clear empties.
    - useQueryActivityCapture:
      - With devToolsEnabled and requestLogging on, fetching a query on a test QueryClient records 'fetch' then 'success' with keyLabel and queryHash.
      - With either setting off, nothing is recorded.
    - packLanes:
      - [0-10], [5-15], [10-20] gives lanes 0, 1, 0 and laneCount 2 (an end equal to a start reuses the lane).
      - Identical starts are ordered deterministically by id.
    - groupBursts:
      - Items at 0-100, 200-300 and 2000-2100 give 2 bursts, newest first.
      - The first burst has count 1, start 2000 and totalMs 100; the second has count 2 and totalMs 300.
      - Its route is the first item's route, or '(unknown)'.
      - An item that starts within 1.5 s of the max end so far joins the current burst even when it is long.
    - concurrencySeries:
      - Three overlapping spans give peak 3 at the right time.
      - An end and a start at the same instant don't double count.
      - Clipping to the window works.
    - queuedSeries: two spans queued 0-50 and 10-50 give peak 2; spans without queuedAt contribute nothing.
    - waterfallSegment: a request from 50 to 150 in a burst from 0 to 200 gives left 25, width 50. A zero-length request gets width 0.5.
    - time-scale:
      - x and invert are inverses.
      - timeTicks over [0, 1000] gives 0 / 200 / 400… or 0 / 250… style labels, each step 1/2/5 × 10^k, labels via formatOffset ('0 ms', '1.5 s', '12 s').
      - zoomWindow (the maths behind ctrl/⌘ + wheel): factor 0.8 around anchor 500 on [0, 1000] gives [100, 900]; factor 1.25 zooms out and is clamped to bounds; the span never drops below 5 ms.
      - fitWindow pads and returns null when empty.
      - brushWindow (the maths behind brush zoom): px 100→300 on a 0-1000 ms / 1000 px scale gives [100, 300]; a reversed drag 300→100 gives the same; under 4 px gives null.
    - UI:
      - The Clear buttons also empty the query-activity store.
      - A list row shows a waterfall bar element (data-testid="waterfall-bar").
  </behavior>
  <action>
Implements D-07 (query-activity capture) and D-09 (waterfall column), plus the pure logic D-08 needs. This task ends executor run 2.

**query-activity.ts (D-07)**
- Create it exactly as the interfaces block specifies, with tests. Pure TypeScript, no React.

**query-activity.store.ts (D-07)**
- Create it as the interfaces block specifies, reusing debug-log.store's retention-limit lookup.

**useQueryActivityCapture.ts (D-07)**
- Read `useQueryClient()` and subscribe once in a useEffect to `client.getQueryCache().subscribe(event => …)`.
- At the top of the callback, read `useSettingsStore.getState()`. If `!devToolsEnabled || !requestLogging`, clear the module-local `prev: Map<string, QuerySnap>` when it is non-empty, and return immediately. No snapshotting or formatting happens when capture is off.
- Otherwise:
  - for `event.type === 'removed'`, diff with null;
  - for 'added' and 'updated', diff `prev.get(hash)` against `snapshotQuery(event.query)`;
  - store the new snap;
  - for each derived kind, append `{ id: crypto.randomUUID(), at: nowMs(), kind, queryHash, keyLabel: formatQueryKey(event.query.queryKey) }`.
- Unsubscribe on unmount.
- Mount `useQueryActivityCapture()` in AppLayout in main.tsx, next to `useNotificationPolling()`.
- Test it with renderHook inside a QueryClientProvider. Use a test QueryClient and `client.fetchQuery` with a resolved queryFn.

**Clear buttons**
- DevToolsPage.tsx `handleClear` and the LogsTab Clear button also call `useQueryActivityStore.getState().clear()`.

**timeline-layout.ts and time-scale.ts**
- Create them exactly as the interfaces block specifies (including queuedSeries), with the tests from behavior. They are pure TypeScript with no React or DOM.

**Waterfall column (D-09)**
- In LogsTab, compute `bursts = groupBursts(filtered spans)` inside a useMemo, with spans from entryStart and entryEnd(now) and the route.
- Build a Map from entry id to burst.
- Add a fixed `w-[120px] flex-none` cell before the duration column. Hide it via a container query on an inner wrapper (`@max-[720px]:hidden`; the list pane wrapper gets the `@container` class, per the container-query memory).
- The cell holds a `relative h-2 rounded-sm bg-muted/50` track containing an absolute bar with `data-testid="waterfall-bar"`, positioned by waterfallSegment.
- Bar colour by status only:

  | State | Classes |
  |-------|---------|
  | ok | bg-foreground/30 |
  | 4xx | bg-amber-500/70 |
  | 5xx or error | bg-red-500/70 |
  | pending | bg-muted-foreground/40 animate-pulse |

- Put the colour mapping in a shared `timelineBarClass(entry)` in utils.ts, so Task 7 reuses it.

**End-of-run checks**
This task ends executor run 2, so its verify covers every suite touched in Tasks 5-6.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit && npx vitest run src/lib/dev-tools src/routes/dev-tools src/stores/debug-log.store.test.ts src/stores/query-activity.store.test.ts src/hooks/useQueryActivityCapture.test.tsx src/hooks/useUpdatePolling.test.ts src/lib/concurrency.test.ts && npx biome check src/lib/dev-tools/query-activity.ts src/lib/dev-tools/query-activity.test.ts src/stores/query-activity.store.ts src/stores/query-activity.store.test.ts src/hooks/useQueryActivityCapture.ts src/hooks/useQueryActivityCapture.test.tsx src/main.tsx src/lib/dev-tools/timeline-layout.ts src/lib/dev-tools/timeline-layout.test.ts src/lib/dev-tools/time-scale.ts src/lib/dev-tools/time-scale.test.ts src/routes/dev-tools/utils.ts src/routes/dev-tools/LogsTab.tsx src/routes/dev-tools/DevToolsPage.tsx src/routes/dev-tools/DevToolsPage.test.tsx</automated>
  </verify>
  <done>
- Query-cache events are captured app-wide only while capture is on, and Clear empties them.
- All the timeline pure modules are tested, including the zoom and brush maths.
- List rows show the waterfall mini bar, coloured by status only.
- Every suite touched in Tasks 5-6 passes, and tsc and biome are clean on the touched files.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 7: Timeline core (toggle, lanes, bars, axis, bursts + picker + Live follow, Fit and wheel zoom, tooltip, keyboard)</name>
  <files>taskflow/src/routes/dev-tools/LogsTimeline.tsx, taskflow/src/routes/dev-tools/LogsTimeline.test.tsx, taskflow/src/routes/dev-tools/LogsTab.tsx, taskflow/src/routes/dev-tools/dev-tools-view.store.ts</files>
  <behavior>
    - The Logs toolbar has a List | Timeline segmented control. Choosing Timeline renders data-testid="logs-timeline", and the filters still apply (a filtered-out entry has no bar).
    - Each visible request renders a bar (data-testid="timeline-bar", aria-label "{METHOD} {path}"). Two overlapping requests render in different lanes (different `top`), and two sequential ones share a lane.
    - Clicking a bar selects that entry, and the same LogInspector renders on the right.
    - With a bar selected, ArrowRight / ArrowLeft move selection to the next / previous request by start time, and Escape clears it.
    - The burst picker lists "All" plus the bursts, newest first. The label format is "route · N requests · total ms".
      - The default window is the latest burst.
      - Choosing "All" shows bars from both bursts.
      - Choosing a burst turns Live off.
    - Live follow: with Live on and a pending entry in the latest burst, advancing fake timers moves the window end (the pending bar's width grows); appending a request that starts a new burst switches the window to it. With Live off, neither happens.
    - Ctrl/⌘ + wheel: dispatching a `wheel` event with ctrlKey (or metaKey) and deltaY < 0 on the plot narrows the window (fewer ticks span, or a known bar gets wider) and turns Live off; a wheel without the modifier does nothing.
    - Fit resets the window to the burst (or to all entries).
    - The hover tooltip has at most 4 rows: path, status, duration, and start offset.
    - Rendering 1000 entries completes (no timing assertion).
  </behavior>
  <action>
Implements the D-08 timeline core (CONTEXT addendum section 8). It uses the Task 5-6 modules: timeline-layout, time-scale, log-entry, queue-handoff, useNow and timelineBarClass.

**dev-tools-view.store.ts**
Add the following transient fields:
- `logView: 'list' | 'timeline'` (default 'list');
- `timelineBurstId: string | 'all' | null` (null = follow latest);
- `timelineWindow: [number, number] | null` (a zoom override);
- `timelineLive: boolean` (default true).

Each gets a setter. Selecting a burst, brushing or zooming sets `timelineLive` false. Fit clears `timelineWindow`.

**LogsTab.tsx**
- Add a `SectionSegmented` labelled "Logs view", with the options List and Timeline, right after the search box.
- In Timeline mode:
  - pass `<LogsTimeline entries={filtered} selectedId onSelect now />` as the layout's `list`;
  - pass a timeline keyboard handler as the layout's `onKeyDown`;
  - keep the same summary strip and inspector.
- Pause applies to both views, because both read the same `entries`.

**LogsTimeline.tsx (main, default export)**

Data:
- `spans` from `queuedAt ?? entryStart` (for lane packing) and entryEnd(now), filtered entries only. All derived values below are memoized on entries, now and the window.
- `bursts` = groupBursts(spans).
- The active window:
  - `timelineWindow` when set;
  - else, for 'all', fitWindow(all spans);
  - else the chosen burst's [start, end];
  - else the latest burst. While `timelineLive` is on, the window's end follows `now` whenever a request in it is pending, and a new latest burst replaces the window.
- `visible` = spans intersecting the window, culled before render.
- `packLanes(visible)`. Packing uses `queuedAt ?? start` as the span start, so Task 8's queued lead-ins never overlap other bars.
- Width comes from a ResizeObserver on the plot element, feeding `createTimeScale(window, width)`. Accept an optional `width` prop for tests.

Header row (one line, wraps when narrow):
- the burst picker: a Base UI Select with `items`, "All" first, then the last 20 bursts, newest first;
- the label of the current burst, in muted text: "route · N requests · total ms";
- a "Live" toggle button (aria-pressed; outline xs, matching the local style);
- a "Fit" button;
- a muted zoom hint: "⌘ + scroll to zoom".

Then a slot for the concurrency strip (Task 8 fills it; render nothing here yet), the time axis (ticks from timeTicks, labels at absolute x, with hairline gridlines running through the plot), a slot for the Cache lane (Task 8), and the request lanes.

Request lanes:
- 18px rows. Each bar is an absolutely positioned `button` (data-testid="timeline-bar"):
  - left = x(start), width = max(2, x(end) - x(start)), top = lane × 20;
  - class from timelineBarClass (status colour only); pending bars get a striped `bg-[repeating-linear-gradient(...)]` muted variant and grow live via `now`;
  - the selected bar gets `ring-2 ring-primary`;
  - accept `data-highlighted` / `data-dimmed` attributes from a `highlight: Set<string> | null` state (Task 8 sets it).
- Labels (method + short path, from urlPath's last 2 segments) render inside the bar, in text-[11px] truncate, only when the bar width is at least 60px.
- Burst boundaries (in 'all' or a zoomed window spanning several bursts) get a thin vertical hairline and the burst label at the top.

Tooltip:
- one absolutely positioned div inside the timeline container, clamped to its bounds;
- at most 4 rows: path; status (or 'pending'); duration, with the queue folded in as `"{networkMs} ms (queued {queuedMs})"` when queueSplit gives a number; and start offset (formatOffset(start - window[0]));
- no per-bar Tooltip components, for performance.

Interactions:
- Clicking a bar calls onSelect(id).
- Zoom: ctrl/⌘ + wheel uses a native non-passive listener, `addEventListener('wheel', h, { passive: false })` in a useEffect, then `preventDefault` and zoomWindow around `scale.invert(e.offsetX)` with factor 0.8 (deltaY < 0) or 1.25; sets Live off.
- Keyboard (exported as `timelineKeyDown(orderedIds, selectedId, setSelected)`):
  - ArrowRight / ArrowLeft move to the next / previous id in start order and scroll the bar into view;
  - Escape clears the selection.
- Empty window: a compact EmptyState, "No requests in this window".

Performance:
- absolutely positioned divs with layout memoized via useMemo;
- render only visible spans;
- avoid per-render allocation in the bar map;
- must stay smooth with 1000 entries.

**LogsTimeline.test.tsx**
- Cover every behavior bullet. Seed `useDebugLogStore` with explicit `startedAt` and `endedAt`.
- Stub ResizeObserver and pass a fixed `width`.
- Wrap renders in a QueryClientProvider when you render through DevToolsPage.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit && npx vitest run src/routes/dev-tools src/lib/dev-tools && npx biome check src/routes/dev-tools/LogsTimeline.tsx src/routes/dev-tools/LogsTimeline.test.tsx src/routes/dev-tools/LogsTab.tsx src/routes/dev-tools/dev-tools-view.store.ts</automated>
  </verify>
  <done>
- Logs has the List | Timeline toggle.
- Timeline shows lane-packed bars on a shared axis, coloured by status, with a burst picker, All, Live follow, Fit and ⌘ + wheel zoom, ←/→/Esc keyboard control and a tooltip of at most 4 rows.
- Selecting a bar opens the shared inspector.
- The dev-tools tests pass, and tsc and biome are clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 8: Concurrency strip (brush, queued series, limit line), cache lane with correlation, queued lead-ins; full-suite gate</name>
  <files>taskflow/src/routes/dev-tools/TimelineConcurrencyStrip.tsx, taskflow/src/routes/dev-tools/LogsTimeline.tsx, taskflow/src/routes/dev-tools/LogsTimeline.test.tsx</files>
  <behavior>
    - The concurrency strip shows "peak N" for the window, a queued series (data-testid="queued-series") when any visible entry has queuedAt, and a limit reference line labelled "limit 6" (data-testid="limit-line").
    - Brush zoom: pointerdown at x=100, pointermove to x=300 and pointerup on the strip (width 1000) set the window to the matching time range (bars outside it disappear) and turn Live off; a drag under 4 px changes nothing.
    - A bar for an entry with queuedAt renders a lead-in segment (data-testid="timeline-queued") whose width equals x(startedAt) - x(queuedAt). The tooltip duration row reads e.g. "192 ms (queued 120)", and the tooltip still has at most 4 rows.
    - Hovering a cache 'fetch' marker (data-testid="cache-marker") gives correlated bars `data-highlighted="true"` and the others `data-dimmed="true"`. Leaving clears both. Hovering an 'error' marker shows its key and does not highlight.
  </behavior>
  <action>
Implements the rest of D-08 and the timeline part of the queue-wait amendment, then runs the full gate. This task ends executor run 3.

**TimelineConcurrencyStrip.tsx**
- One inline SVG, 40px tall and width-matched. It draws a step-area path from concurrencySeries(spans, window) in `fill-muted-foreground/25 stroke-muted-foreground/60`.
- A "peak N" label is placed at peakAt.
- A second series from `queuedSeries` is stacked above in-flight, drawn as an outline only (`fill-none stroke-muted-foreground stroke-dasharray-[3_2]`, data-testid="queued-series"). It renders only when any visible entry has queuedAt.
- A horizontal dashed reference line at y = `JIRA_CONCURRENCY` (imported from lib/concurrency.ts) is labelled "limit 6" (data-testid="limit-line"). The y-scale max is max(peak + queued peak, JIRA_CONCURRENCY + 1), so saturation (in-flight flat at 6 with queued above it) is obvious.
- The strip is a status-free neutral; there is no red at saturation.
- Brush:
  - pointerdown, pointermove and pointerup draw a translucent selection rect;
  - on release, `brushWindow(px0, px1, scale)` gives the new window; when it is non-null, call setTimelineWindow and set Live off.
- Mount it in LogsTimeline's strip slot.

**Cache lane (in LogsTimeline.tsx)**
- a 16px "Cache" lane labelled at the left in muted text-[11px];
- markers come from `useQueryActivityStore` events inside the window, kinds fetch, invalidated and error only;
- each marker is an absolute 8px glyph button (data-testid="cache-marker", aria-label "{kind} {keyLabel}"):
  - fetch: a hollow circle, `border border-muted-foreground`;
  - invalidated: a rotated square, `bg-muted-foreground/60`;
  - error: a filled circle, `bg-red-500`.
- Hovering shows the key in the tooltip. For fetch and invalidated markers, hovering also sets `highlight = correlatedRequestIds(event.at, visibleEntries)`. While highlight is set, bars in it get `data-highlighted="true"` and full opacity, and the others get `data-dimmed="true" opacity-30`.

**Queued lead-ins (in LogsTimeline.tsx)**
- When an entry has queuedAt, its bar is preceded by an absolutely positioned lead-in (data-testid="timeline-queued") from x(queuedAt) to x(start): a hatched, muted `bg-[repeating-linear-gradient(135deg,…)]` with `opacity-60` and no status colour. The solid network segment starts at x(start).

**LogsTimeline.test.tsx**
- Add the behavior tests above. Seed `useQueryActivityStore` with explicit `at` values, and give the strip a fixed width.

**Full gate**
- Run the full `npm test`, and fix anything this plan broke without bending production code to satisfy test mocks.
- Grep for `aria-pressed` on ListRow and `settings popover above` (both 0).
- Confirm no new npm dependencies: `git diff --quiet HEAD -- package.json`, or diff against the pre-run base.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit && npx biome check src/routes/dev-tools/TimelineConcurrencyStrip.tsx src/routes/dev-tools/LogsTimeline.tsx src/routes/dev-tools/LogsTimeline.test.tsx src/routes/dev-tools/LogsTab.tsx src/routes/dev-tools/dev-tools-view.store.ts && npm test && test "$(grep -rn 'settings popover above' src/routes/dev-tools | wc -l | tr -d ' ')" = "0"</automated>
  </verify>
  <done>
- The concurrency strip shows the peak, queued series, limit line and brush zoom.
- The Cache lane highlights the correlated requests.
- Queued lead-ins render before the network segments.
- The full `npm test` suite passes. tsc and biome are clean. No new dependencies were added.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| apiFetch → debug-log store | Live request and response data (tokens, cookies, customer data) enter an in-memory store, now from the moment a request starts |
| QueryCache → query-activity store | Query keys (which may contain issue keys or JQL) are recorded app-wide |
| dev tools → clipboard / Downloads | Copy and Export move captured data out of the app |
| captured body → DOM | Untrusted API response text is rendered in the JSON tree |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-tvz-01 | Information disclosure | apiFetch request and response headers | mitigate | redactHeaders at capture (both the pending append and the completion patch); unit tested in redact.test.ts |
| T-tvz-02 | Information disclosure | Copy as JSON, Markdown, Copy all, Export | mitigate | copy-format re-applies redactHeaders and redactUrl; tests assert no token in the output; cURL keeps env-var placeholders |
| T-tvz-03 | Tampering / XSS | JsonTree and timeline labels and tooltips | mitigate | React text nodes only; no dangerouslySetInnerHTML; search uses includes() and `<mark>` splitting, never a regex built from user input |
| T-tvz-04 | Denial of service | JsonTree, the timeline with 1000 entries, the app-wide cache subscriber | mitigate | MAX_TREE_BYTES raw fallback, lazy children, ARRAY_PAGE, match and container caps; timeline culling and memoized layout; the subscriber returns immediately when capture is off; retention limit on both stores |
| T-tvz-05 | Information disclosure | Export file in ~/Downloads | accept | user-initiated, and holds the same data the user already sees |
| T-tvz-06 | Elevation of privilege | Settings dedupe and concurrency removal | accept | the master toggle stays in Settings, so the sidebar and Debug menu gating are unchanged; the Jira limiter stays at its effective value of 6 |
| T-tvz-08 | Tampering | queue-handoff module state | mitigate | runWithQueuedAt clears in finally; takeQueuedAt is consume-once; apiFetch always consumes at entry, so a stale value can't attach to an unrelated request; unit tested |
| T-tvz-07 | Information disclosure | query-activity store | accept | transient memory only; recorded only while the user has opted into capture; cleared by Clear |
</threat_model>

<verification>
- `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit` is clean after every task.
- Run 1 (Tasks 1-4) ends with the Task 4 verify green.
- Run 2 (Tasks 5-6) ends with the Task 6 verify green.
- Run 3 (Tasks 7-8) ends with the full `npm test` green.
- `npx biome check` on the touched paths is clean. Never run `--write` across src.
- No new npm dependencies.
- The bundle guard test still passes: nothing in dev-tools imports lib/wiki/editor or @tiptap.
- `services/jira.ts` and `services/jira/client.ts` are unchanged (the queue capture lives in the getJiraLimit wrapper).
- `grep -rn "jiraConcurrencyLimit" src` hits only the settings.store.ts migration comment and the v41 delete.
</verification>

<success_criteria>
- Each setting lives in exactly one place: the master toggle in Settings → Advanced, and the capture options in the Dev Tools gear. The dead Jira concurrency setting is gone, and the v41 migration deletes it.
- JSON throughout Developer Tools is a coloured, collapsible, searchable tree with path and value copy, and it stays fast on large payloads.
- The log inspector is organized, shows bodies side by side when wide, includes response headers, and offers the six copy actions. The Logs toolbar has Copy all and Export.
- The list, toolbar, focus and empty-state polish is done, and WR-02, WR-04, WR-06 and IN-01 are resolved.
- Requests are visible while in flight. Query-cache activity is recorded. The List view has a waterfall column, and the Timeline view makes concurrency and load order observable (lanes, bursts, concurrency peak, cache-to-request correlation).
</success_criteria>

<output>
Create `.planning/quick/261119-tvz-dev-tools-polish-pass-json-viewer-side-b/261119-tvz-SUMMARY.md` when done
</output>
