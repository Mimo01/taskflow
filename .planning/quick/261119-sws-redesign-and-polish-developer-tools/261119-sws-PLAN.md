---
phase: quick-261119-sws
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/stores/operation-profiler.store.ts
  - taskflow/src/lib/apiFetch.ts
  - taskflow/src/services/aio/client.ts
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/routes/settings/DebugModeSection.tsx
  - taskflow/src/routes/debug-logs/DebugLogs.tsx
  - taskflow/src/routes/debug-logs/index.tsx
  - taskflow/src/routes/dev-tools/DevToolsPage.tsx
  - taskflow/src/routes/dev-tools/DevToolsSettings.tsx
  - taskflow/src/routes/dev-tools/DevToolsSettingsPopover.tsx
  - taskflow/src/routes/dev-tools/OperationsTab.tsx
  - taskflow/src/routes/dev-tools/OperationCard.tsx
  - taskflow/src/routes/dev-tools/WaterfallTab.tsx
  - taskflow/src/routes/dev-tools/WaterfallBar.tsx
  - taskflow/src/routes/dev-tools/ListInspectorLayout.tsx
  - taskflow/src/routes/dev-tools/dev-tools-ui.tsx
  - taskflow/src/routes/dev-tools/dev-tools-view.store.ts
  - taskflow/src/routes/dev-tools/LogsTab.tsx
  - taskflow/src/routes/dev-tools/LogInspector.tsx
  - taskflow/src/routes/dev-tools/CacheTab.tsx
  - taskflow/src/routes/dev-tools/CacheInspector.tsx
  - taskflow/src/routes/dev-tools/useQueryCacheRows.ts
  - taskflow/src/routes/dev-tools/NotificationsTab.tsx
  - taskflow/src/routes/dev-tools/EditorTab.tsx
  - taskflow/src/routes/dev-tools/EditorTab.test.tsx
  - taskflow/src/routes/dev-tools/NotificationsTab.test.tsx
  - taskflow/src/routes/dev-tools/DevToolsPage.test.tsx
  - taskflow/src/lib/dev-tools/log-filters.ts
  - taskflow/src/lib/dev-tools/log-filters.test.ts
  - taskflow/src/lib/dev-tools/log-stats.ts
  - taskflow/src/lib/dev-tools/log-stats.test.ts
  - taskflow/src/lib/dev-tools/curl.ts
  - taskflow/src/lib/dev-tools/curl.test.ts
  - taskflow/src/lib/dev-tools/query-cache-snapshot.ts
  - taskflow/src/lib/dev-tools/query-cache-snapshot.test.ts
  - taskflow/src/lib/dev-tools/json-preview.ts
  - taskflow/src/lib/dev-tools/json-preview.test.ts
  - taskflow/src/lib/dev-tools/entry-filters.ts
  - taskflow/src/lib/dev-tools/entry-filters.test.ts
autonomous: true
requirements:
  - QUICK-261119-SWS
must_haves:
  truths:
    - "Developer Tools fills the viewport under a standard PageHeader (text-2xl 'Developer Tools', no subtitle); only the list and inspector panes scroll, never the page"
    - "Tab bar shows Logs, Cache, Notifications, Editor with live counts; Operations and Waterfall tabs and their settings toggles no longer exist anywhere (Dev Tools page and Settings > Advanced)"
    - "A header gear popover holds the master toggle, request logging, response body capture and retention limit; 'Clear all' in the header clears every log store"
    - "Logs shows one line per request with a resizable inspector (Headers / Request / Response / Timing), toolbar search + source/status/method/operation filters, Pause/Resume, Clear, a summary strip (total, errors, median, p95, slowest endpoint), Copy URL / Copy as cURL (tokens replaced by $JIRA_TOKEN/$GITLAB_TOKEN placeholders) / Copy response, and arrow-key/Esc navigation"
    - "Cache tab lists every TanStack Query cache entry live (key, status/fetchStatus, fresh/stale/invalidated, observers, updated-ago, error) with search + state filter and Refetch / Invalidate / Reset / Remove / Copy key / Copy data on the selected query; works even when Developer Tools capture is disabled"
    - "Notifications and Editor use the same list + inspector layout with outcome/level filter + search; Editor inspector still shows the diagnoseSave side-by-side diff and outline; Notifications inspector still shows the banner preview and raw items"
    - "No code still records operation-profiler data; settings v40 migration deletes operationProfiling and performanceWaterfall from persisted state"
  artifacts:
    - path: "taskflow/src/routes/dev-tools/ListInspectorLayout.tsx"
      provides: "Shared toolbar + scrolling list + resizable inspector layout used by all four tabs"
    - path: "taskflow/src/routes/dev-tools/DevToolsSettingsPopover.tsx"
      provides: "Gear popover replacing the dead inline DevToolsSettings panel"
    - path: "taskflow/src/routes/dev-tools/CacheTab.tsx"
      provides: "TanStack Query cache inspector tab"
    - path: "taskflow/src/routes/dev-tools/useQueryCacheRows.ts"
      provides: "Throttled useSyncExternalStore snapshot of the query cache as plain rows"
    - path: "taskflow/src/lib/dev-tools/curl.ts"
      provides: "buildCurl(entry) with header/URL redaction and env-var token placeholders"
      exports: ["buildCurl"]
    - path: "taskflow/src/lib/dev-tools/log-stats.ts"
      provides: "computeLogStats (total, errors, median, p95 nearest-rank, slowest endpoint)"
      exports: ["computeLogStats"]
    - path: "taskflow/src/lib/dev-tools/log-filters.ts"
      provides: "filterLogs + statusClass + facet option helpers"
      exports: ["filterLogs", "statusClass"]
    - path: "taskflow/src/lib/dev-tools/query-cache-snapshot.ts"
      provides: "formatQueryKey, toCacheRow, filterCacheRows"
      exports: ["formatQueryKey", "toCacheRow", "filterCacheRows"]
  key_links:
    - from: "taskflow/src/routes/dev-tools/useQueryCacheRows.ts"
      to: "queryClient.getQueryCache().subscribe"
      via: "useSyncExternalStore with 250ms coalesced rebuild + 1s tick"
      pattern: "getQueryCache\\(\\)\\.subscribe"
    - from: "taskflow/src/routes/dev-tools/LogInspector.tsx"
      to: "taskflow/src/lib/dev-tools/curl.ts"
      via: "Copy as cURL button"
      pattern: "buildCurl\\("
    - from: "taskflow/src/routes/dev-tools/LogsTab.tsx"
      to: "taskflow/src/lib/dev-tools/log-stats.ts"
      via: "summary strip computed from the filtered list"
      pattern: "computeLogStats\\("
    - from: "taskflow/src/routes/dev-tools/DevToolsPage.tsx"
      to: "taskflow/src/routes/dev-tools/DevToolsSettingsPopover.tsx"
      via: "PageHeader actions"
      pattern: "DevToolsSettingsPopover"
---

<objective>
Redesign the in-app Developer Tools page as a professional, full-height tool: standard PageHeader shell with a settings gear popover, tab counts and a header Clear all; a shared list + resizable inspector layout; a much richer Logs tab (filters, stats, cURL, pause); a new live TanStack Query Cache inspector tab replacing the deleted Operations + Waterfall tabs and the operation profiler; and Notifications + Editor moved onto the same pattern.

Purpose: The user finds Logs useful and Operations/Waterfall useless. The Cache tab directly targets the app's recurring cache bugs (stale keys, key churn, invalidation no-ops). Every CONTEXT.md decision is locked (the user said "you decide" to all of them). This plan implements all of them, with no deferrals.

Output: 3 tasks, each leaving the app compiling and tests green.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261119-sws-redesign-and-polish-developer-tools/261119-sws-CONTEXT.md
@.planning/quick/261119-sws-redesign-and-polish-developer-tools/261119-sws-RESEARCH.md

Repo layout: git and .planning are at the outer `taskflow/`. src, npm, vitest and biome live in the inner `taskflow/taskflow/`. Every verify command runs `cd taskflow` first, from the repo root `/Users/mimo/Documents/Projects/taskflow`.

RESEARCH.md is the authoritative inventory. Use its exact line references for the profiler removal (§1), the primitive imports (§3), the cache API and gotchas (§4), the layout recipe (§5), the test impacts (§6) and cURL redaction (§7). Read it before Task 1.

Key existing files:
@taskflow/src/routes/dev-tools/DevToolsPage.tsx
@taskflow/src/routes/dev-tools/LogsTab.tsx
@taskflow/src/routes/dev-tools/NotificationsTab.tsx
@taskflow/src/routes/dev-tools/EditorTab.tsx
@taskflow/src/routes/dev-tools/editor-log-view.ts
@taskflow/src/routes/dev-tools/utils.ts
@taskflow/src/routes/dev-tools/DevToolsSettings.tsx
@taskflow/src/stores/debug-log.store.ts
@taskflow/src/stores/settings.store.ts
@taskflow/src/lib/apiFetch.ts
@taskflow/src/components/ui/page-header.tsx
@taskflow/src/components/ui/empty-state.tsx
@taskflow/src/components/ui/table-filter-sort.tsx
@taskflow/src/hooks/useResizable.ts

Interfaces executors rely on (already exist):
- `ApiLogEntry { id, timestamp (ISO), source: 'jira'|'gitlab'|'updater'|'aio'|'tempo', method, url, requestHeaders: Record<string,string>, requestBody?, status: number|null, durationMs, responseBody, error?, operation? }` from stores/debug-log.store.ts
- `NotificationDispatchLogEntry = OsDispatchLogEntry & { id, timestamp }` with `outcome: 'sent'|'denied'|'error'|'skipped'|'grouped'|'catch-up'` (lib/notification-dispatch-log.ts)
- `WikiEditorLogEntry { id, timestamp, session, event, level: 'info'|'warn'|'error', message, context?, details?, markup?, error?, diagnosis? }` (stores/wiki-editor-log.store.ts)
- `useResizable({ initialWidth, min, max, onCommit, direction })`. The reference handle markup is at AioTestRunDetailPage.tsx:161-172 and 419-426.
- `FilterPopover({ dimension, testId, options, selected: Set<string>, setSelected, formatOption? })`
- `SectionSegmented({ label, options, value, onChange })` from routes/dashboard/issue-detail/SectionHeader
- `EmptyState({ icon, title, subtitle?, action?, compact?, fill? })`
- `PageHeader({ title, subtitle?, titleAside?, actions?, ... })`, plus `headerActionLabel` and `headerActionButton`
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove profiler/Operations/Waterfall/legacy viewer, add settings v40 migration, build the new shell, settings popover and shared list+inspector primitives</name>
  <files>
    taskflow/src/stores/operation-profiler.store.ts (delete),
    taskflow/src/routes/dev-tools/OperationsTab.tsx (delete), OperationCard.tsx (delete), WaterfallTab.tsx (delete), WaterfallBar.tsx (delete), DevToolsSettings.tsx (delete),
    taskflow/src/routes/debug-logs/ (delete dir),
    taskflow/src/lib/apiFetch.ts, taskflow/src/services/aio/client.ts,
    taskflow/src/stores/settings.store.ts, taskflow/src/routes/settings/DebugModeSection.tsx,
    taskflow/src/routes/dev-tools/DevToolsPage.tsx,
    taskflow/src/routes/dev-tools/DevToolsSettingsPopover.tsx (new),
    taskflow/src/routes/dev-tools/ListInspectorLayout.tsx (new),
    taskflow/src/routes/dev-tools/dev-tools-ui.tsx (new),
    taskflow/src/routes/dev-tools/dev-tools-view.store.ts (new),
    taskflow/src/lib/dev-tools/json-preview.ts (new) + json-preview.test.ts (new),
    taskflow/src/routes/dev-tools/EditorTab.test.tsx
  </files>
  <action>
**Removal (per the CONTEXT decision "Operations + Waterfall → replaced by Cache"; follow RESEARCH §1 row by row):**
- Delete operation-profiler.store.ts, OperationsTab.tsx, OperationCard.tsx, WaterfallTab.tsx and WaterfallBar.tsx.
- Delete the dead DevToolsSettings.tsx. It has no importers; its retention Select markup moves into the popover below.
- Delete the whole unrouted `src/routes/debug-logs/` directory (RESEARCH §2).
- In apiFetch.ts:
  - remove the profiler imports, the `operationProfiling` destructure and both `if (operationProfiling)` blocks;
  - keep `operation` flowing into the log entry;
  - reword the doc comments to "operation label for the Logs filter".
- Reword the aio/client.ts:26 comment the same way.
- In settings.store.ts:
  - remove `operationProfiling` and `performanceWaterfall` from the defaults, the interface, the setters and the setter type declarations;
  - remove the two lines in the v8 migration that set them;
  - bump the persist `version` from 39 to 40;
  - add `if (version < 40) { delete s.operationProfiling; delete s.performanceWaterfall; }`, following the existing delete-key pattern.
- In DebugModeSection.tsx, remove both toggle labels and their store reads. Reword the help text so it no longer mentions profiling or performance data.
- After the edits, `grep -rn "operationProfiling\|performanceWaterfall\|operation-profiler" src` must hit only the v40 migration lines.

**Shared JSON helper (pure, tested):** create `lib/dev-tools/json-preview.ts`.
- Export `safeStringify(value, space = 2): string`:
  - use a replacer that turns Map into `Object.fromEntries`, Set into an array and BigInt into a string;
  - wrap everything in try/catch and fall back to `String(value)` on cycles.
- Export `capText(text, maxBytes = 200_000): { text, truncated, totalBytes }`.
- Export `byteSize(text)`.
- Unit-test Map/Set/BigInt/cycle/undefined handling and the truncation boundary.

**View-state store:** create `dev-tools-view.store.ts`, a transient zustand store with no persist.
- It holds per-tab UI state so filters and selection survive tab switches (Base UI unmounts inactive panels): `selectedId`, `search`, and facet Sets for logs, cache, notifications and editor.
- Add an `inspectorWidth` number shared by all tabs (default 440).
- Add a `paused` snapshot field for logs: `pausedEntries: ApiLogEntry[] | null`. Pause is UI-only and snapshots the entries (RESEARCH pitfall 4); the debug-log.store stays unchanged.

**ListInspectorLayout.tsx:** props are `toolbar`, `summary?`, `list`, `inspector` (ReactNode, or null when nothing is selected), `emptyInspector?`, `onKeyDown?`.
- Layout follows RESEARCH §5:
  - root is `flex min-h-0 flex-1 flex-col`;
  - toolbar row is `shrink-0 border-b px-6 py-2 flex items-center gap-2`;
  - optional summary strip is `shrink-0 border-b px-6 py-1.5 text-xs text-muted-foreground`;
  - body is `flex min-h-0 flex-1`.
- The list scroller is `relative min-h-0 flex-1 overflow-auto`, focusable with tabIndex 0 and wired to `onKeyDown`.
- The inspector is `relative min-h-0 overflow-auto border-l`, with its width from `useResizable` (`direction: 'left'`, min 320, max = 60% of the layout width, `onCommit` writes `inspectorWidth` into the view store).
- Put a drag handle on the inspector's left edge, copying the AioTestRunDetailPage handle markup.
- No card panels or rounded borders around sections (memory: detail pages have no card panels).

**dev-tools-ui.tsx** holds small shared pieces:
- `ToolbarSearch`: an Input, h-7, w-56, with a placeholder.
- `CopyButton({ label, getText })`: Button variant outline, size xs. It calls `navigator.clipboard.writeText(getText())` synchronously in the click handler. It shows "Copied" for 1.5s, or "Copy failed" from `.catch` (RESEARCH A1). Local state only; no fixed overlays.
- `InspectorSection({ title, children })`: a quiet muted text-xs uppercase heading plus content, with px-4 py-3 and a border-b divider. No card.
- `KeyValueTable` for headers: two columns, mono text-xs.
- `JsonBlock({ text })`: uses capText. Render `pre.font-mono.text-xs.whitespace-pre.overflow-auto`. When truncated, show the note "Showing first N KB of M KB" and rely on the copy button for the full text.
- `ListRow({ selected, onSelect, children })`: one-line `flex items-center gap-3 px-6 h-7 text-xs`. Selected rows get `bg-accent`.
  - Use the overlay-button pattern: an absolute inset-0 button sibling under the content, not a nested interactive.
  - Give the row a `data-testid="devtools-row"`.

**DevToolsPage.tsx shell:**
- Replace `max-w-5xl mx-auto py-8` with `flex h-full min-h-0 flex-col`.
- Header: `PageHeader title="Developer Tools"` with no subtitle, so it renders text-2xl (memory: page header consistency). Actions:
  - `DevToolsSettingsPopover`;
  - a "Clear all" outline sm Button that clears the debug-log, notification-dispatch-log and wiki-editor-log stores and also clears the logs pause snapshot. It is disabled when all three are empty.
- Tabs: `Tabs` with `className="flex min-h-0 flex-1 flex-col"`. Use `TabsList variant="line"` in a `shrink-0 px-6` wrapper.
- Triggers are Logs, Notifications and Editor (Cache is added in Task 2). Each label is followed by a count in `<span aria-hidden="true" className="ml-1.5 tabular-nums text-muted-foreground">`, so accessible names stay "Logs", "Editor" and so on (RESEARCH pitfall 6).
- Each `TabsContent` uses `className="flex min-h-0 flex-1 flex-col"`.
- Disabled state: when `devToolsEnabled` is false, the Logs, Notifications and Editor tabs each render `EmptyState fill` with icon Bug, title "Developer Tools are disabled" (keep this exact string for the tests) and the subtitle "Enable them in the settings popover above."

**DevToolsSettingsPopover.tsx:**
- The trigger is an icon-sm ghost Button with the Settings2 icon and `aria-label="Developer Tools settings"`, matching the header action style.
- PopoverContent (Base UI portal), w-72, contains rows of label + description + `Switch` for: Developer Tools (master), Request logging, Response body capture.
- A Retention limit `Select` reuses the old option values from DevToolsSettings.tsx. Pass `items` on Root (memory: Base UI Select needs items).
- A one-line muted note: "Applies to new entries."
- The sub-toggles are disabled when the master toggle is off.

**Interim tab wiring:** to keep this task green, the existing LogsTab, NotificationsTab and EditorTab keep rendering inside the new shell for now. Wrap each in a `min-h-0 flex-1 overflow-auto relative` div. Tasks 2 and 3 convert them.

**Tests:**
- Update the EditorTab.test.tsx DevToolsPage block:
  - the button is now named 'Clear all';
  - the tab query stays `{ name: 'Editor' }`, which works because the count is aria-hidden.
- Add a json-preview test.
- debug-log.store.test.ts and settings.store.test.ts must still pass unchanged.
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit && npx vitest run src/routes/dev-tools src/lib/dev-tools src/stores/debug-log.store.test.ts src/stores/settings.store.test.ts src/routes/settings src/lib/wiki/editor/bundle-guard.test.ts && test "$(grep -rln 'operationProfiling\|performanceWaterfall\|operation-profiler' src | grep -v settings.store.ts | wc -l)" -eq 0 && test ! -e src/routes/debug-logs && npx biome check src/lib/apiFetch.ts src/stores/settings.store.ts src/routes/settings/DebugModeSection.tsx src/routes/dev-tools src/lib/dev-tools</automated>
  </verify>
  <done>
- Profiler store, the 4 tab files, DevToolsSettings.tsx and routes/debug-logs are gone.
- Settings persist version is 40 and deletes the two keys; Settings → Advanced shows no profiling or waterfall toggles.
- The page is full-height with PageHeader, gear popover, Clear all and counted tabs.
- ListInspectorLayout and the dev-tools-ui primitives exist.
- tsc is clean, the targeted vitest runs pass, and biome flags no new files.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Logs tab redesign (filters, stats, cURL, inspector, pause, keyboard) + Cache inspector tab</name>
  <files>
    taskflow/src/lib/dev-tools/log-filters.ts + log-filters.test.ts (new),
    taskflow/src/lib/dev-tools/log-stats.ts + log-stats.test.ts (new),
    taskflow/src/lib/dev-tools/curl.ts + curl.test.ts (new),
    taskflow/src/lib/dev-tools/query-cache-snapshot.ts + query-cache-snapshot.test.ts (new),
    taskflow/src/routes/dev-tools/LogsTab.tsx, taskflow/src/routes/dev-tools/LogInspector.tsx (new),
    taskflow/src/routes/dev-tools/useQueryCacheRows.ts (new), taskflow/src/routes/dev-tools/CacheTab.tsx (new), taskflow/src/routes/dev-tools/CacheInspector.tsx (new),
    taskflow/src/routes/dev-tools/DevToolsPage.tsx, taskflow/src/routes/dev-tools/DevToolsPage.test.tsx (new), taskflow/src/routes/dev-tools/EditorTab.test.tsx
  </files>
  <behavior>
    - log-filters:
      - `statusClass(null)` returns 'error', `statusClass(204)` returns '2xx', `statusClass(404)` returns '4xx', `statusClass(503)` returns '5xx'.
      - `filterLogs(entries, { search, sources, statuses, methods, operations })`:
        - an empty Set means "all";
        - search matches url, requestBody and responseBody case-insensitively using `includes` (no regex);
        - the status facet 'errors' matches `status === null` or `status >= 400`;
        - the operation facet '(none)' matches an undefined operation.
      - `facetOptions(entries)` returns sorted unique sources, methods and operations, including '(none)' when any entry lacks an operation.
    - log-stats:
      - `computeLogStats([])` returns `{ total: 0, errors: 0, median: null, p95: null, slowest: null }`.
      - median and p95 use nearest-rank on durationMs (for durations [10..100] step 10, p95 is 100 and median is 50).
      - errors counts `status === null || status >= 400`.
      - slowest is `{ path, method, ms }` with the query string stripped from the URL path.
    - curl:
      - `buildCurl(entry)` single-quotes args and escapes `'` as `'\''`.
      - It emits `-X METHOD` for anything other than GET.
      - Authorization becomes `-H 'Authorization: Bearer $JIRA_TOKEN'` for the jira, aio and tempo sources. PRIVATE-TOKEN becomes `-H 'PRIVATE-TOKEN: $GITLAB_TOKEN'`.
      - cookie, set-cookie, x-api-key, x-auth-token and proxy-authorization are dropped. The header-name match is case-insensitive.
      - URL params private_token, access_token, token and api_key are replaced with REDACTED.
      - The body is emitted via `--data-raw`. A body ending in `[truncated]` is omitted and a `# request body truncated in log` comment line is prepended.
    - query-cache-snapshot:
      - `formatQueryKey(['issue', 'ABC-1', { expand: 'x' }])` returns `issue › ABC-1 › {"expand":"x"}`.
      - undefined renders as `undefined`, and labels longer than 160 chars are ellipsised.
      - `toCacheRow(fakeQuery, staleTimeMs, now)` returns a plain object with the fields from RESEARCH §4. Stale for 0-observer queries uses `isStaleByTime(staleTime)`.
      - `filterCacheRows(rows, { search, state })` supports the states all, fetching, stale, error, inactive and invalidated.
  </behavior>
  <action>
**Pure modules first (RED then GREEN):** write the four tests from `<behavior>`, run them so they fail, then implement.
- curl redaction follows RESEARCH §7. Capture already redacts, so placeholders are what make a pasted command work after `export`.
- `toCacheRow` takes a structural `Query` subset (`queryHash`, `queryKey`, `state`, `getObserversCount`, `isActive`, `isDisabled`, `isStaleByTime`) so tests can pass a fake.

**LogsTab.tsx rewrite** on ListInspectorLayout (CONTEXT "Logs tab (keep, polish, extend)"):
- Toolbar:
  - ToolbarSearch ("Search URL or body");
  - FilterPopover facets for Source, Status (2xx/3xx/4xx/5xx/errors), Method and Operation (shown only when `facetOptions` returns operations);
  - a Pause/Resume outline xs Button (Pause/Play icon). It writes and clears `pausedEntries` in the view store. While paused, show the muted text "Paused · N new" with N = live count minus snapshot count, clamped at 0;
  - a Clear outline xs Button that clears only the debug-log store.
- Summary strip: from `computeLogStats(filtered)`, render `N requests · E errors · median X ms · p95 Y ms · slowest METHOD /path (Z ms)`. Errors are red only when > 0 (colour = status only).
- Rows are one line via ListRow, in this column order:
  - source using the existing `sourceBadgeClass`;
  - method, mono, w-12, flex-none;
  - status, mono, w-10, flex-none, coloured with the existing `statusColor` text only (no pill background, which keeps the list calm);
  - path, mono, `flex-1 min-w-0 truncate`, decoded with the host stripped;
  - operation, muted, max-w-48 truncate, flex-none;
  - duration, tabular-nums, right-aligned, w-16;
  - time via `toLocaleTimeString`, w-20.
- Keyboard: ArrowUp/ArrowDown move `selectedId` within the filtered list and scroll the row into view with `scrollIntoView({ block: 'nearest' })`. Escape clears the selection.
- Empty states:
  - nothing captured: `EmptyState fill`, "No requests logged yet", with the subtitle "Turn on Request logging in the settings popover." when requestLogging is off;
  - filters match nothing: compact EmptyState "No requests match the filters".

**LogInspector.tsx:**
- Header block (px-4 py-3 border-b): the method and full decoded URL (mono, break-all), the status, and an action row with CopyButtons "Copy URL", "Copy as cURL" (`buildCurl`) and "Copy response".
- `SectionSegmented` sub-tabs Headers / Request / Response / Timing, held in local state:
  - Headers: KeyValueTable of requestHeaders, values already redacted at capture.
  - Request: JsonBlock of `formatBody(requestBody)`, or a muted "No request body".
  - Response: JsonBlock of `formatBody(responseBody)` with the size shown, plus the network error in red if present; when responseBody is empty, show a muted "Response body capture is off".
  - Timing: started (ISO plus local time), duration, operation, and the position of the request relative to the slowest and median of the current filtered set.

**useQueryCacheRows.ts** (RESEARCH §4 and pitfalls 2-3):
- `useQueryCacheRows(client)` uses `useSyncExternalStore`.
- Build the subscribe and getSnapshot functions once per client with useMemo, holding the closure state there rather than at module level. Subscribe starts `cache.subscribe`, which schedules a coalesced 250ms rebuild, plus a 1000ms interval rebuild, and tears both down on unsubscribe.
- getSnapshot returns a cached array of fresh plain `CacheRow` objects, the same reference until rebuilt.
- Default staleTime comes from `client.getDefaultOptions().queries?.staleTime` (a number, default 0).
- Also export `useQueryCacheCount(client)`, which subscribes the same way but returns `getAll().length` (a primitive, so it is stable).

**CacheTab.tsx** uses `useQueryClient()`. It is not gated by `devToolsEnabled` (RESEARCH pitfall 8).
- Toolbar: ToolbarSearch ("Search keys"), and a `SectionSegmented` state filter: All / Fetching / Stale / Error / Inactive / Invalidated.
- Summary strip: `N queries · F fetching · S stale · E errors · O observed`.
- Rows (one line):
  - a status dot: fetching uses primary with animate-pulse, error red, stale amber, fresh green, inactive muted;
  - key label, mono, flex-1 truncate;
  - observers count, w-8;
  - updated-ago via `relativeTime(new Date(ms).toISOString())`, showing "never" for 0;
  - fetchStatus text when not idle.
- Rows are sorted by dataUpdatedAt descending.
- Empty: `EmptyState fill` "Query cache is empty".

**CacheInspector.tsx:**
- Look the selected Query up by hash via `client.getQueryCache().get(hash)`.
- Header: the full key as pretty JSON, plus an action row of outline xs Buttons, each scoped `{ queryKey, exact: true }`:
  - Refetch (`refetchQueries`);
  - Invalidate (`invalidateQueries`);
  - Reset (`resetQueries`);
  - Remove (`removeQueries`), disabled when observers > 0 with the title "Mounted observers would keep the orphaned query";
  - CopyButton "Copy key";
  - CopyButton "Copy data", using full `safeStringify`.
- Never call `client.clear()`.
- Sections:
  - State: status, fetchStatus, fresh/stale, invalidated, observers, active/disabled, dataUpdateCount, fetchFailureCount, gcTime, updated and errored timestamps;
  - Error: the message, in red, when present;
  - Data: a JsonBlock of `safeStringify(state.data)`, memoised on `[hash, dataUpdatedAt]` so only the selected query is stringified, with its byte size.

**DevToolsPage:**
- Add a Cache tab after Logs, with its count from `useQueryCacheCount`.
- Swap in the new LogsTab and remove its interim wrapper.

**Tests:**
- New `DevToolsPage.test.tsx`, rendered inside `QueryClientProvider` with a fresh QueryClient. It asserts:
  - the Logs, Cache, Notifications and Editor tabs exist;
  - there is no Operations or Waterfall tab;
  - the Cache tab lists a query seeded via `client.setQueryData(['issue','ABC-1'], {...})` with the label "issue › ABC-1";
  - a seeded log entry with an Authorization header produces a cURL containing `$JIRA_TOKEN`. Assert this via a mocked `navigator.clipboard.writeText` after selecting the row and clicking "Copy as cURL".
- Wrap the existing EditorTab.test.tsx DevToolsPage render in QueryClientProvider (RESEARCH pitfall 1).
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit && npx vitest run src/lib/dev-tools src/routes/dev-tools src/stores/debug-log.store.test.ts src/lib/wiki/editor/bundle-guard.test.ts && npx biome check src/lib/dev-tools src/routes/dev-tools</automated>
  </verify>
  <done>
- The Logs tab is a split pane with toolbar facets, pause, clear, summary stats, the 4-section inspector, the three copy actions (cURL uses token placeholders) and keyboard navigation.
- The Cache tab updates live with throttling, filters by state and search, and runs Refetch/Invalidate/Reset/Remove/Copy on the selected query.
- The pure modules are fully unit-tested.
- tsc, vitest and biome on the touched paths are clean, with no new files flagged.
  </done>
</task>

<task type="auto">
  <name>Task 3: Notifications and Editor tabs onto the list + inspector pattern</name>
  <files>
    taskflow/src/lib/dev-tools/entry-filters.ts + entry-filters.test.ts (new),
    taskflow/src/routes/dev-tools/NotificationsTab.tsx, taskflow/src/routes/dev-tools/NotificationsTab.test.tsx,
    taskflow/src/routes/dev-tools/EditorTab.tsx, taskflow/src/routes/dev-tools/EditorTab.test.tsx,
    taskflow/src/routes/dev-tools/DevToolsPage.tsx
  </files>
  <action>
This task implements the CONTEXT decision "Notifications + Editor tabs: same list + inspector pattern". It moves existing rendering into inspectors and does not rewrite it.

**entry-filters.ts (pure, tested):**
- `filterNotificationEntries(entries, { search, outcomes })` searches the title, body and issue key fields present on OsDispatchLogEntry. Read lib/notification-dispatch-log.ts for the exact field names.
- `filterEditorEntries(entries, { search, levels, events })` searches message, event, context.label and context.issueKey.
- An empty Set means all.
- Unit-test both functions.

**NotificationsTab.tsx** on ListInspectorLayout:
- Toolbar:
  - ToolbarSearch;
  - FilterPopover "Outcome" over the six outcomes, using the existing outcome labels ('Sent', 'Error', 'Grouped', etc.; keep the strings the tests assert);
  - a Clear outline xs Button for the dispatch-log store only.
- Rows (one line): the outcome label as status-coloured text only, the title truncated flex-1, the 'summary' marker when it applies (keep the existing text), and the time.
- Inspector: move the existing expanded-card content as-is. That covers the `OsNotificationPreview` banner (`role="img"` and its aria-label unchanged), the grouped/catch-up notes verbatim, and the "Raw items" section with raw JSON, now rendered through JsonBlock in InspectorSection blocks rather than a card.
- Empty: `EmptyState fill` "No desktop notifications yet" (keep the string).
- Disabled state per Task 1.

**EditorTab.tsx** on ListInspectorLayout:
- Toolbar:
  - ToolbarSearch;
  - FilterPopover "Level" (info/warn/error) and "Event" (from the entries);
  - a Clear button for the wiki-editor-log store.
- Rows (one line): level as status-coloured text (error red, warn amber, info muted), event (mono), message truncated flex-1, context label or issue key (muted), and the time.
- Inspector: move the existing detail rendering unchanged in substance:
  - the 'Details' key/values;
  - the diagnosis reason;
  - the side-by-side diff via `sideBySide` and `lineRangeOf` from editor-log-view.ts, with the 'The edit (expected)' and 'Produced markup (failing block outlined)' headings;
  - the outline via `outlineShape`, which shows 'heading level=1';
  - the error stack.
- editor-log-view.ts and its test stay in place untouched.
- No imports from lib/wiki/editor or @tiptap (bundle guard).
- Empty: `EmptyState fill` "No editor events yet" (keep the string).
- Keyboard: ArrowUp/ArrowDown/Escape work the same as in Logs for both tabs. Factor a tiny `useListKeyboard(ids, selectedId, setSelectedId)` helper into dev-tools-ui.tsx if it is not already shared from Task 2. Both tabs keep selection and filters in dev-tools-view.store.

**Tests:**
- In NotificationsTab.test.tsx and EditorTab.test.tsx, replace the single `getByRole('button')` expand clicks with clicks on the row: `getAllByTestId('devtools-row')[0]`, or the row's overlay button by its accessible name.
- Keep every other asserted string; only the interaction changes.
- Add a filter test per tab: typing into search, or selecting the Error outcome or level, hides the non-matching row.

**DevToolsPage:** remove the remaining interim wrappers. Every tab now owns its scrolling via ListInspectorLayout.
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit && npx vitest run src/routes/dev-tools src/lib/dev-tools src/stores src/routes/settings src/lib/wiki/editor/bundle-guard.test.ts && npx biome check src/lib/dev-tools src/routes/dev-tools && npm test 2>&1 | tail -15</automated>
  </verify>
  <done>
- Notifications and Editor render as filterable one-line lists with inspectors that hold the moved preview, raw, diff and outline content.
- The existing assertions still pass with only the interaction updated, and the new filter tests pass.
- The full `npm test` passes, tsc is clean, and biome flags no new files.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| captured log → clipboard | Captured request headers, URLs and bodies leave the app through the Copy actions |
| dev tools UI → live QueryClient | Inspector actions mutate shared app cache state |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-sws-01 | Information disclosure | lib/dev-tools/curl.ts | mitigate | Capture-time redaction stays as it is (apiFetch.ts). buildCurl also drops a case-insensitive secret header set, replaces Authorization and PRIVATE-TOKEN with `$JIRA_TOKEN`/`$GITLAB_TOKEN` placeholders and scrubs token URL params. Unit-tested |
| T-sws-02 | Information disclosure | Copy response / Copy data | accept | Clipboard only, on explicit user click. Stores stay transient with no persistence, and the page is a developer-only tool behind the devToolsEnabled sidebar link |
| T-sws-03 | Denial of service | CacheTab / JsonBlock | mitigate | Rebuilds coalesced to 250ms plus a 1s tick, with intervals torn down on unmount. Only the selected query is stringified, and rendering is capped at 200 KB by capText |
| T-sws-04 | Tampering | CacheInspector actions | mitigate | All actions scoped `{ queryKey, exact: true }`. Remove is disabled while observers > 0. `client.clear()` is never called |
| T-sws-05 | Tampering | search inputs | accept | Search uses `includes()` only; no regex is built from input |
</threat_model>

<verification>
Run from `/Users/mimo/Documents/Projects/taskflow/taskflow`:
- `npx tsc --noEmit` is clean.
- `npx vitest run src/routes/dev-tools src/lib/dev-tools src/stores src/routes/settings src/lib/wiki/editor/bundle-guard.test.ts` passes.
- The full `npm test` passes.
- `npx biome check src/lib/dev-tools src/routes/dev-tools src/lib/apiFetch.ts src/stores/settings.store.ts src/routes/settings/DebugModeSection.tsx` flags no new files compared with the baseline. Never use `--write` on all of src.
- `grep -rn "operationProfiling\|performanceWaterfall\|operation-profiler" src` hits only the v40 migration in settings.store.ts.
</verification>

<success_criteria>
- The page has 4 tabs (Logs, Cache, Notifications, Editor) with live counts, a full-height shell, a settings gear popover and Clear all.
- Operations, Waterfall, the profiler store, the inline settings panel and the legacy debug-logs viewer are removed, and the settings v40 migration drops the dead keys.
- The Logs, Cache, Notifications and Editor tabs share ListInspectorLayout: one-line rows, a resizable inspector, toolbar filters and keyboard navigation.
- The pure logic (filters, stats, cURL redaction, cache key/rows, JSON preview) is unit-tested.
- UI prefs are respected: colour only for status, no card panels, standard PageHeader, and EmptyState `fill` for full-pane states.
</success_criteria>

<output>
Create `.planning/quick/261119-sws-redesign-and-polish-developer-tools/261119-sws-SUMMARY.md` when done.
</output>
