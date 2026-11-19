# Quick Task 261119-sws: Redesign and polish Developer Tools - Context

**Gathered:** 2026-11-19
**Status:** Ready for planning

<domain>
## Task Boundary

Redesign and polish the in-app Developer Tools page (`taskflow/src/routes/dev-tools/`). User's words:
"The Logs tab is the most useful, I like it — polish it, add more functionality, make it nicer.
Operations and Waterfall feel useless — do something else with them or remove them. Notifications
are fine but a little unpolished. Also Editor. Think about new designs, functionally make it more
useful. Mainly for development, not regular app usage, but it needs to feel professional."

User answered "You decide" on every gray area — all decisions below are Claude's discretion,
chosen as the most useful option. They are locked for planning.

</domain>

<decisions>
## Implementation Decisions

### Operations + Waterfall → replaced by a "Cache" tab
- Remove the Operations and Waterfall tabs (OperationsTab, OperationCard, WaterfallTab, WaterfallBar)
  and their settings toggles (operationProfiling, performanceWaterfall) from the UI.
- Decide (research) whether operation-profiler.store can be deleted entirely or whether apiFetch /
  other callers still need the `operation` label. Keep the `operation` label on log entries if it
  exists — it becomes a filter facet in Logs. Do not leave dead code paths that still record data
  nobody can see.
- New **Cache** tab: live TanStack Query cache inspector (queryClient.getQueryCache()), subscribed
  to cache events so it updates reactively. Per query: key (readable), status/fetchStatus,
  stale vs fresh, observer count, dataUpdatedAt (relative), error, data size/preview. Search by key,
  filter by state (fetching / stale / error / inactive). Actions on the selected query: Refetch,
  Invalidate, Reset/Remove, copy key, copy data JSON. Read-only data view (JSON tree or pretty JSON).
  This directly serves the app's recurring cache bugs (stale keys, key churn, invalidation no-ops).

### Logs tab (keep, polish, extend)
- Split-pane layout like a browser Network panel: dense one-line-per-request list on the left
  (source, method, status, path, operation, duration, time), detail inspector on the right with
  sub-tabs: Headers / Request / Response / Timing (or similar). Selected row highlighted.
- Toolbar: text search (URL/body), source filter, status filter (2xx/3xx/4xx/5xx/errors), method
  filter, operation filter if present, Pause/Resume capture, Clear.
- Actions: Copy URL, Copy as cURL (redact Authorization/token headers by default), Copy response.
- Small summary strip: total requests, errors, median / p95 duration, slowest endpoint (from the
  currently filtered set). This is what the old Waterfall should have offered.
- Response body: pretty-printed JSON with monospace + horizontal scroll; large bodies handled.
- Keyboard: ↑/↓ moves selection in list, Esc clears selection (nice-to-have).

### Page shell
- Full-width tool layout using the shared PageHeader primitive (see memory: page header
  consistency, text-2xl title without subtitle unless subtitle line). Fills viewport height; the
  list panes scroll internally, not the page.
- Tab bar shows live counts per tab.
- Replace the inline collapsible DevToolsSettings panel with a header gear popover (or compact
  popover) containing the master toggle, request logging, response body capture, retention limit.
- Global "Clear all" stays in the header; per-tab clear in each toolbar.
- Disabled-state / empty-state use the shared EmptyState (`fill` for full pane).

### Notifications + Editor tabs
- Adopt the same list + inspector pattern as Logs for consistency: filterable dense list
  (Notifications: outcome filter + search; Editor: level filter + search), detail inspector on the
  right. Editor inspector keeps the existing diagnoseSave/explainSave side-by-side diff and outline
  views (editor-log-view.ts) — move, don't rewrite, that logic.
- Notifications inspector keeps the banner-style preview and raw item.

### Claude's Discretion
- Everything above (user said "you decide" to all). Exact component split, shared primitives
  (e.g. a reusable DevToolsListPane/Inspector/Toolbar/FacetFilter), JSON viewer approach, and
  colours are up to the planner — follow existing app primitives and memory preferences:
  colour = status only, calm lists (no badges everywhere), one row = one line, no card panels
  around sections, match local button row styles.

</decisions>

<specifics>
## Specific Ideas

- Inspiration: Chrome DevTools Network panel, TanStack Query Devtools — but restyled to the app's
  own design tokens (bg-background, muted-foreground, border-border, shadcn/Base UI primitives).
- Keep existing tests passing or updated (EditorTab.test.tsx, NotificationsTab.test.tsx,
  editor-log-view.test.ts, debug-log.store.test.ts). Add tests for new pure logic (filters, cURL
  builder with redaction, stats percentile, query-key formatting).
- `routes/debug-logs/DebugLogs.tsx` is a legacy viewer — check whether it is still routed; if dead,
  remove it.

</specifics>

<canonical_refs>
## Canonical References

- Memory notes: dev tools = in-app page (routes/dev-tools tabs, devToolsEnabled store);
  PageHeader primitive; page header consistency; calm history lists; one row = one line;
  React Compiler vs module reads; repo root vs app dir (src/npm/vitest/biome in inner taskflow/).

</canonical_refs>
