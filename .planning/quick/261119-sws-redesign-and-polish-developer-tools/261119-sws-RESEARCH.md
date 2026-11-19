# Quick 261119-sws: Redesign and polish Developer Tools - Research

**Researched:** 2026-11-19
**Domain:** In-app dev tools UI (React 19 + React Compiler, Zustand 5, TanStack Query 5.91.2, Base UI, Tailwind v4)
**Confidence:** HIGH (all findings verified by reading the codebase and the installed `@tanstack/query-core` source)

Paths are relative to the app dir `taskflow/` (inner) unless they start with `.planning/`.

<user_constraints>
## User Constraints (from CONTEXT.md)

All decisions are locked (the user said "you decide" to everything). Summary; the full text is in `261119-sws-CONTEXT.md`:
- Remove Operations and Waterfall tabs (OperationsTab, OperationCard, WaterfallTab, WaterfallBar) plus the `operationProfiling`/`performanceWaterfall` toggles. Keep the `operation` label on log entries as a Logs filter facet. No dead recording paths.
- New **Cache** tab: a live TanStack Query cache inspector (key, status/fetchStatus, stale/fresh, observers, dataUpdatedAt relative, error, data size and preview). Search plus state filter (fetching/stale/error/inactive). Actions: Refetch, Invalidate, Reset/Remove, copy key, copy data JSON.
- **Logs**: split-pane (dense list + inspector with Headers/Request/Response/Timing), toolbar (search, source/status/method/operation filters, Pause/Resume, Clear), Copy URL / cURL (redacted) / response, a summary strip (total, errors, median, p95, slowest), pretty JSON, keyboard ↑/↓/Esc.
- **Shell**: full-width PageHeader, fills viewport, panes scroll internally, live tab counts, a gear popover for settings, global Clear all in the header, EmptyState `fill`.
- **Notifications/Editor**: same list + inspector pattern. Move (don't rewrite) the editor-log-view.ts diff/outline logic.
- Discretion: component split, shared primitives, JSON viewer approach, colours. Follow the memory prefs: colour only for status, calm lists, one row = one line, no card panels, match the local button row.
- Deferred: none listed.
</user_constraints>

## Summary

The profiler store can be **deleted entirely**. Its only writer is `apiFetch.ts`, and the `operation` label is already stored separately on `ApiLogEntry.operation` (debug-log.store.ts:23, set at apiFetch.ts:140,181). No new packages are needed. Every building block already exists in the repo: PageHeader, EmptyState(fill), Tabs, Popover, FilterPopover, SectionSegmented, Switch, Button, useResizable, relativeTime. `@tanstack/react-query-devtools` is **not installed**, which fits the locked decision to build a custom Cache tab in the app's own styling.

Main risks:
1. The DevToolsPage integration test renders without a `QueryClientProvider`. A Cache tab that calls `useQueryClient()` will throw.
2. `Query` objects are mutated in place. Under React Compiler, any memo keyed on them goes stale, so the snapshot must be built as fresh plain rows.
3. `gcTime: Infinity` (main.tsx:69) means the cache keeps every query ever made in the session, so the list can hold hundreds of entries. Throttle notifications and never stringify all data at once.
4. Settings persistence has no `partialize`, so a v40 migration should delete the two dropped keys.

**Primary recommendation:** Delete the operation-profiler store, its 4 tab files, and DebugLogs.tsx. Add a v40 settings migration that deletes the two keys. Build one shared `ListInspectorLayout` (toolbar + list + resizable inspector) and use it for all four tabs. Put pure logic (filters, stats, curl, cache rows) in `.ts` modules with unit tests.

## 1. Profiler removal inventory

| Location | What | Action |
|---|---|---|
| `src/stores/operation-profiler.store.ts` (whole file) | the store | **delete** |
| `src/lib/apiFetch.ts:19-20` | imports `FetchRecord`, `useOperationProfilerStore` | remove |
| `src/lib/apiFetch.ts:58-59` | destructures `operationProfiling` | drop it from the destructure |
| `src/lib/apiFetch.ts:145-158, 186-208` | two `if (operationProfiling)` blocks | delete. `operation` keeps flowing into the log entry at :140 and :181 |
| `src/lib/apiFetch.ts:6,40` | doc comments mention the profiler | reword: "operation label for the Logs filter" |
| `src/routes/dev-tools/{OperationsTab,OperationCard,WaterfallTab,WaterfallBar}.tsx` | UI | **delete** |
| `src/routes/dev-tools/DevToolsSettings.tsx` | **already dead**: no importer anywhere in src | delete, or rewrite as the gear popover |
| `src/routes/dev-tools/DevToolsPage.tsx:11,21-22,28,48-50` | profiler reads and clear | remove |
| `src/routes/settings/DebugModeSection.tsx:49-52, 150-170` | Settings → Advanced still has both toggles | remove both `<label>` blocks. Reword :113 "profile operations, and record performance data" |
| `src/stores/settings.store.ts:41-42` (defaults), `:123-126` (interface), `:338-339` (setters), plus the setter type decls | fields | remove |
| `src/stores/settings.store.ts:432-433` | v8 migration *sets* the two fields | remove those two lines (otherwise very old installs re-create them) |
| `src/services/aio/client.ts:26` | comment "grouped in the dev-tools Operations tab" | reword to "Logs operation filter" |

**`operation` label usage:** 18 jira.ts call sites pass a 4th arg (e.g. jira.ts:339 `'Load Issue Detail'`), and every AIO call passes one (aio/client.ts:40 makes it required). GitLab/Tempo/updater calls pass none, so the facet must handle `undefined` with a "(none)" option. [VERIFIED: grep]

**Settings persistence (safe drop):** `persist(..., { name: 'settings-store', version: 39, migrate })` at settings.store.ts:395. There is **no `partialize`**, so the whole state is persisted, and Zustand's default merge spreads persisted keys back into state. Stale keys would survive as untyped junk. Do this:
```ts
// settings.store.ts — bump version: 39 → 40
if (version < 40) {
  delete s.operationProfiling;
  delete s.performanceWaterfall;
}
```
`settings.store.test.ts:216-234` only asserts `version >= 19` plus migration guards in the source, so a bump is safe. The existing pattern of deleting keys in a migration is at :437 (`delete …debugMode`) and :490-491. [VERIFIED: codebase]

## 2. DebugLogs.tsx: dead

`src/routes/routes.tsx` has no `/debug-logs` route; only `/dev-tools` (routes.tsx:6,47) is routed. `routes/debug-logs/DebugLogs.tsx` is imported only by its own `index.tsx`. **Delete the whole `src/routes/debug-logs/` dir.** [VERIFIED: grep]

## 3. Reusable primitives (exact imports)

| Need | Import | Shape |
|---|---|---|
| Header | `import { PageHeader, headerActionLabel, headerActionButton } from '@/components/ui/page-header'` | `{ title, subtitle?, titleAside?, actions?, titleSize?, className?, 'data-testid'? }`. Without a subtitle it renders text-2xl (the memory pref). It is `shrink-0 border-b` with `px-6 py-4`. Use `headerActionLabel` + `headerActionButton` on a `<Button size="sm">` for icon-collapse |
| Empty/disabled | `import { EmptyState } from '@/components/ui/empty-state'` | `{ icon: LucideIcon, title, subtitle?, action?, compact?, fill?, className? }`. `fill` adds `h-full min-h-fit flex-1` |
| Tabs | `import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'` | Base UI. `TabsList variant="default" \| "line"`. `line` gives an underline style that suits a tool bar |
| Facet filter | `import { FilterPopover } from '@/components/ui/table-filter-sort'` | `{ dimension, testId, options: string[], selected: Set<string>, setSelected: Dispatch<SetStateAction<Set<string>>>, formatOption? }`. It is an h-7 outline/default Button + Popover checklist, which already matches "toolbar" density |
| Segmented | `import { SectionSegmented } from '@/routes/dashboard/issue-detail/SectionHeader'` | `{ label, options: readonly {value,label}[], value: T \| null, onChange, className?, 'data-testid'? }`. h-6 track. Good for inspector sub-tabs (Headers/Request/Response/Timing) and the status filter |
| Popover | `import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'` | Base UI: `<PopoverTrigger render={<Button …/>}>` (see table-filter-sort.tsx:76-85) |
| Switch | `import { Switch } from '@/components/ui/switch'` | `{ checked?, onCheckedChange?(b) }` plus button attrs. Use in the gear popover instead of raw checkboxes |
| Select | `import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'` | Retention limit. See memory: Base UI Select needs `items` on Root or the trigger shows the raw value (fine here, since the values are the labels) |
| Button | `import { Button } from '@/components/ui/button'` | variants `default/outline/secondary/ghost/destructive/link`. Sizes `default/xs/sm/lg/icon/icon-xs/icon-sm/icon-lg` (icon-sm = size-7) |
| Resizable split | `import { useResizable } from '@/hooks/useResizable'` | `({ initialWidth, min, max: number \| () => number, onCommit, direction?: 'right' \| 'left', getStartWidth? }) → { width, isDragging, handleMouseDown, handleKeyDown }`. Reference handle markup: AioTestRunDetailPage.tsx:161-172, 419-426 (`direction:'left'`, `max: () => layoutRef.current.offsetWidth * 0.5`). Persisting the width needs a new settings field. Use local state (`onCommit: setW`) or a persisted field with a migration; local state is recommended |
| Relative time | `import { relativeTime } from '@/lib/relative-time'` | takes an **ISO string**. For `dataUpdatedAt` (epoch ms), call `relativeTime(new Date(ms).toISOString())` and guard `0` ("never") |
| Search input | `import { Input } from '@/components/ui/input'` / `input-group.tsx` | |

**No JSON viewer exists** (grep for JsonView/JsonTree found nothing). Use `<pre className="font-mono text-xs whitespace-pre overflow-auto">` with `formatBody` (dev-tools/utils.ts:5) and a size cap (see Pitfalls). A collapsible tree is optional. If built, make it a lazy recursive `<details>` component that renders only expanded children. Do not add a package.

`utils.ts` `sourceBadgeClass` / `statusColor` are reused by Logs and Notifications. Keep them.

## 4. TanStack Query cache inspector

**Version:** `@tanstack/react-query` / `query-core` **5.91.2** installed (package.json:35 `^5.90.21`). QueryClient is created at main.tsx:65 with `staleTime 5min, gcTime Infinity, retry 1`, and `QueryClientProvider` sits at main.tsx:815. Get the client with `useQueryClient()`. [VERIFIED: node_modules]

**Events:** `queryCache.subscribe(listener)` returns an unsubscribe function. The event `type` is one of `added | removed | updated | observerAdded | observerRemoved | observerResultsUpdated | observerOptionsUpdated` (query-core d.ts:1317). Notifications are batched through `notifyManager`, but `observerResultsUpdated` still fires very often during page loads.

**Query API (verified in query-core/build/modern/query.js):** `queryKey`, `queryHash` (use as a stable row id), `state.{status, fetchStatus, data, error, dataUpdatedAt, errorUpdatedAt, dataUpdateCount, errorUpdateCount, fetchFailureCount, isInvalidated}`, `options.gcTime`, `getObserversCount()`, `isActive()`, `isDisabled()`, `isStale()`, `isStaleByTime(ms)`.
- **Gotcha:** `isStale()` (query.js:111-118) with **0 observers** returns only `data === undefined || isInvalidated`. It ignores elapsed time. For inactive queries, show stale as `query.isStaleByTime(client.getDefaultOptions().queries?.staleTime)` or label them simply "inactive". Time-based staleness changes **without any cache event**, so a 1s tick is also needed (it also refreshes the relative times).
- `isDisabled()` with 0 observers is true when the query was never fetched or uses `skipToken`.

**Reactive subscription under React Compiler (recommended):**
```ts
// lib/dev-tools/query-cache-snapshot.ts (pure, testable)
export interface CacheRow { hash: string; key: unknown; keyLabel: string; status: string;
  fetchStatus: string; stale: boolean; observers: number; active: boolean;
  dataUpdatedAt: number; error: string | null; invalidated: boolean }
export function toRow(q: Query, defaultStale: number): CacheRow { /* plain object copy */ }

// hook: throttled external store; snapshot = fresh array of POJOs, cached between notifies
function useCacheRows(client: QueryClient): CacheRow[] {
  // subscribe: cache.subscribe(() => schedule()) where schedule() coalesces via setTimeout(250)
  //            and also setInterval(1000) for stale/relative-time; rebuild rows, then notify React
  // getSnapshot: return the cached array (same ref until rebuilt)  ← required by useSyncExternalStore
}
```
Why plain rows: `Query` instances are mutated in place. The React Compiler memoizes on reference identity, so `cache.getAll()` objects would look unchanged and render stale state. Memory note *React Compiler vs module reads* describes this exact failure (it only shows in the app, not in vitest). Build the subscribe/getSnapshot functions with stable identity (module-level, or `useMemo` on `client`).

**Data preview:** Never stringify all queries. Compute size and preview **only for the selected query**, inside a `useMemo` on `[hash, dataUpdatedAt]`. Cap pretty output (e.g. 200 KB, then show `…truncated, N KB total` plus a "Copy full JSON" button). `JSON.stringify` can throw on cycles or BigInt; wrap it in try/catch and fall back to `String(data)`. Some app queries hold Maps/Sets: use a replacer that turns `Map → Object.fromEntries`, `Set → [...]`.

**Key label:** `JSON.stringify(queryKey)` without outer brackets, or a `key[0]` + rest join. Unit-test a `formatQueryKey()` that handles objects, undefined and long keys.

**Action semantics** (all scoped with `{ queryKey: q.queryKey, exact: true }`):
| Action | Call | Effect |
|---|---|---|
| Refetch | `client.refetchQueries(f)` | fetches now. For an inactive query it still fetches if a queryFn is cached |
| Invalidate | `client.invalidateQueries(f)` | marks `isInvalidated`, refetches **active** only. Inactive ones stay stale until the next mount. That is the "invalidation no-op" pattern from memory, and showing `invalidated` in the inspector makes it visible |
| Reset | `client.resetQueries(f)` | restores initial state (data → initialData/undefined) and refetches active |
| Remove | `client.removeQueries(f)` | drops it from the cache. **Pitfall:** mounted observers keep pointing at the orphan until remount. Disable Remove (or confirm) when `observers > 0` |

Do **not** call `client.clear()`. Settings already offers that, and it wipes credentials-dependent state (memory: credential-save cache reset).

## 5. Layout: full-height split pane inside `<main>`

`<main data-find-scope="main" className="relative isolate flex-1 overflow-auto min-w-0">` (main.tsx:716) sits inside a `flex flex-row flex-1 overflow-hidden min-h-0` row. Pages that pin chrome use `flex h-full flex-col` (SprintBoardTab.tsx:1650, AioTestRunDetailPage `flex h-full flex-col`). Recipe:
```
<div className="flex h-full min-h-0 flex-col">          // page root (replace max-w-5xl mx-auto py-8)
  <PageHeader … />                                        // shrink-0
  <Tabs className="flex min-h-0 flex-1 flex-col">         // TabsList shrink-0 px-6
    <TabsContent className="min-h-0 flex-1 flex">         // each tab
      <div className="relative min-h-0 flex-1 overflow-auto">list</div>   // own scroller
      <div className="relative min-h-0 overflow-auto border-l" style={{width}}>inspector</div>
```
- Every flex ancestor between `<main>` and the scroller needs `min-h-0`, or the page scrolls instead of the pane.
- Give each `overflow-auto` scroller `relative` (memory: *sr-only escapes scroller*; abspos sr-only text inside a non-positioned scroller over-scrolls into blank space).
- Overlays (copied toasts, menus) must use Base UI portals. A custom `fixed` overlay inside `isolate <main>` sits under the sidebar (memory: *main isolate → portal overlays*).
- Base UI `TabsContent` unmounts inactive panels by default. That is fine, but per-tab filter/selection state is lost on tab switch unless lifted into the page or a small zustand store. Recommend lifting it, since dev tools users flip between tabs.
- List rows: one line, `truncate` on path/title, `flex-none` on fixed cells and `flex-1 min-w-0` on the expander (memory: *table vs flex rows*). The list can reach 1000 entries (retention max). Plain rendering is acceptable at that size, but `@tanstack/react-virtual` 3.13 is already installed if needed. Mind the memory note on 0-width columns in abspos virtual rows; prefer plain rendering.

## 6. Existing tests to update

| Test | Asserts | Impact |
|---|---|---|
| `src/routes/dev-tools/EditorTab.test.tsx:16-26` | "Developer Tools are disabled" text; "No editor events yet" | keep these strings in the EmptyState title/subtitle, or update them |
| `EditorTab.test.tsx:29-80` | clicks `getByRole('button')` (**single** button) to expand. Then asserts 'Details', 'gap lost', 'h1. hello', 'The edit (expected)', 'heading level=1', 'Produced markup (failing block outlined)', and the reason text | the list+inspector adds toolbar buttons, so the single-`button` query will break. Change it to click the row by name or test id. Keep the inspector section titles |
| `EditorTab.test.tsx:89-108` | renders `<DevToolsPage/>`, `getByRole('tab',{name:'Editor'})` (**exact name**), `getByRole('button',{name:'Clear Logs'})` | (a) tab counts change the accessible name ("Editor 1"), so use regex `/Editor/` or put the count in `aria-hidden`. (b) The button is renamed "Clear all". (c) **Wrap in `QueryClientProvider`**, because the Cache tab or its count will call `useQueryClient()` |
| `NotificationsTab.test.tsx` | 'Developer Tools are disabled', 'No desktop notifications yet', outcome labels 'Error'/'Sent'/'Grouped', 'summary', `getByRole('button')` single click, the preview `role="img"` name, the raw JSON text, 'Raw items', the grouped note text | same single-button issue. Keep `OsNotificationPreview` (aria-label) and the notes verbatim |
| `editor-log-view.test.ts` | pure functions | unaffected if the file is moved together with its test |
| `src/stores/debug-log.store.test.ts` | append/prepend/FIFO 200/clear/updater source | unaffected unless the store changes. Pause can be a UI-only flag (freeze the displayed list) or a store `paused` flag checked in `append`. A store flag needs new tests |
| `src/lib/wiki/editor/bundle-guard.test.ts:136-152` | `routes/dev-tools/index.tsx` and `DevToolsPage.tsx` are **eager entries** that must not statically reach tiptap/prosemirror/`lib/wiki/editor` | any new shared dev-tools module must not import the wiki editor engine. editor-log-view.ts is currently clean; keep it that way |
| `src/routes/settings/DebugModeSection.test.tsx`, `Settings.test.tsx` | reset wizard / clear notifications; settings mocks include `setDevToolsEnabled` | no profiler assertions found. Removing the toggles is safe |

New pure modules to unit-test (Wave 0): `log-filters.ts` (search/source/status class/method/operation), `log-stats.ts` (median, p95 using nearest-rank, slowest by path without query string), `curl.ts` (quoting + redaction), `query-cache-snapshot.ts` (`formatQueryKey`, `toRow`, state filter).

**Commands** (run from `taskflow/`): `npx vitest run src/routes/dev-tools src/stores/debug-log.store.test.ts src/stores/settings.store.test.ts src/lib/wiki/editor/bundle-guard.test.ts src/routes/settings`; full `npm test`; lint `npx biome check <changed files>` (never `--write` on all of src; the baseline drifts, so gate on "no new files flagged").

## 7. cURL builder: redaction

- Headers that carry secrets: `Authorization: Bearer <PAT>` (Jira, AIO, Tempo: 122 sites) and `PRIVATE-TOKEN` (GitLab: 41 sites). Others seen are `X-Atlassian-Token` (a CSRF no-check constant, not a secret). [VERIFIED: grep services/]
- Capture-time redaction already exists: apiFetch.ts:81-90 replaces `authorization` and `private-token` values with `[REDACTED]`. The stored entry therefore never holds the secret, and the cURL builder **cannot** emit a working token. Emit placeholders instead: `-H 'Authorization: Bearer $JIRA_TOKEN'` / `-H 'PRIVATE-TOKEN: $GITLAB_TOKEN'` keyed by `entry.source` (jira/aio/tempo → `$JIRA_TOKEN`, gitlab → `$GITLAB_TOKEN`), so the pasted command works after an `export`.
- Defense in depth in `curl.ts`: case-insensitive redact set `authorization, proxy-authorization, private-token, cookie, set-cookie, x-api-key, x-auth-token`. Also scrub URL query params `private_token, access_token, token, api_key` (none found in services today, but cheap).
- apiFetch casts `init.headers` to `Record<string,string>` (:81). A `Headers` instance would log as `{}`. No caller does that today, so leave it alone.
- Quoting: single-quote every arg, escape `'` as `'\''`. For the body, use `--data-raw`. Note that stored `requestBody` is pretty-printed and truncated at 5000 chars with a `[truncated]` suffix (apiFetch.ts:98-100). The cURL builder should warn or omit when it ends with `[truncated]`.
- Response body is stored **in full** (apiFetch.ts:118, no cap). Large Jira search responses can be MBs, so the inspector must cap rendering (e.g. first 200 KB plus "show all"/copy).

## 8. Tauri / WKWebView notes

- **Clipboard:** the app uses `navigator.clipboard.writeText(...)` directly (IssueUnavailable.tsx:39, link-context-menu.tsx:49). No clipboard plugin is installed. It works in the Tauri webview on a user gesture, so call it synchronously in the click handler (not after an await chain).
- **Highlight:** don't use the CSS Custom Highlight API (`::highlight`) for search-match marking in rows. WKWebView doesn't paint it on flex/grid direct text or inside `<button>` (memory). Use `<mark>` spans if highlighting is wanted.
- Rows as `<button>` with nested copy buttons: use the overlay-button pattern (memory: *overlay button for nested interactive*): an absolute inset-0 row button as a sibling of the inner action buttons.
- Italic text plus `truncate` clips; add `pr-0.5` (memory).

## Common Pitfalls

1. **Missing QueryClientProvider in tests.** `useQueryClient()` throws "No QueryClient set". Wrap `render(<DevToolsPage/>)` in `<QueryClientProvider client={new QueryClient()}>`. Also keep the tab count for Cache cheap: `client.getQueryCache().getAll().length` from the same throttled store.
2. **Re-render storm.** Subscribing without throttling re-renders on every `observerResultsUpdated` during app loads. Coalesce to about 250ms, and stop the interval when the Cache tab is unmounted. The header count can use the same store.
3. **Stale memo under React Compiler.** Mutated `Query` refs → no re-render. Snapshot to POJOs (see §4).
4. **Pause semantics.** If Pause just freezes the view, new entries still evict old ones via FIFO in the store, so the frozen list can reference ids no longer present. Simplest: on pause, snapshot `entries` into local state. On resume, drop the snapshot.
5. **Retention change does not trim.** `retentionLimit` only applies on the next `append` (debug-log.store.ts:44-46). Expected; mention it in the popover help or trim on change.
6. **Tab count in the accessible name** breaks the `getByRole('tab', {name:'Editor'})` test. Decide one way and update the test.
7. **Bundle guard.** DevToolsPage is an eager entry. Don't `lazy()`-wrap or import anything under `lib/wiki/editor` or `@tiptap/*` from shared dev-tools modules.
8. **Disabled state.** `devToolsEnabled` false means nothing is captured, but the Cache tab still works (it reads the live cache and does not depend on capture). Don't gate Cache behind the master toggle. The sidebar link only shows when enabled (Sidebar.tsx:365), and the `menu-dev-tools` menu event (main.tsx:356) navigates there regardless.

## Environment Availability

SKIPPED: no external dependencies. No packages are installed, so there is no Package Legitimacy Audit.

## Security Domain

| ASVS | Applies | Control |
|---|---|---|
| V7/V8 Logging & data protection | yes | Tokens are redacted at capture (apiFetch.ts:85). The cURL builder uses env-var placeholders plus a redaction set. Copy-response may contain customer data, so it is clipboard-only and nothing is persisted (stores are transient) |
| V5 Input validation | low | Search input is only used in `includes()`. No regex built from user input (or escape it) |

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | `navigator.clipboard.writeText` works in the Tauri webview on a user gesture (inferred from existing app usage, not re-tested) | Copy buttons fail silently. Add a `.catch` with a visible failure state |
| A2 | Rendering up to 1000 one-line rows without virtualization is smooth enough | Laggy Logs list. Fall back to react-virtual (already installed) |

## Sources
- Codebase (grep/read): apiFetch.ts, debug-log/operation-profiler/settings stores, routes.tsx, main.tsx:65-73,716, dev-tools/*, settings/DebugModeSection.tsx, components/ui/*, hooks/useResizable.ts, bundle-guard.test.ts
- Installed `@tanstack/query-core@5.91.2` build/modern/query.js (isStale/isActive/isDisabled) and the d.ts (QueryCacheNotifyEvent)
- Memory notes: React Compiler module reads, sr-only scroller, main isolate portals, WKWebView ::highlight gaps, page header consistency, overlay button

**Valid until:** 2026-12-19 (stable codebase facts)
