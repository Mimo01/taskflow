---
phase: quick-261119-tvz
reviewed: 2026-11-19T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - taskflow/src/lib/apiFetch.ts
  - taskflow/src/lib/concurrency.ts
  - taskflow/src/lib/dev-tools/queue-handoff.ts
  - taskflow/src/lib/dev-tools/query-activity.ts
  - taskflow/src/lib/dev-tools/redact.ts
  - taskflow/src/lib/dev-tools/copy-format.ts
  - taskflow/src/lib/dev-tools/curl.ts
  - taskflow/src/lib/dev-tools/timeline-layout.ts
  - taskflow/src/lib/dev-tools/time-scale.ts
  - taskflow/src/hooks/useQueryActivityCapture.ts
  - taskflow/src/stores/debug-log.store.ts
  - taskflow/src/stores/query-activity.store.ts
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/routes/dev-tools/LogsTimeline.tsx
  - taskflow/src/routes/dev-tools/TimelineConcurrencyStrip.tsx
  - taskflow/src/routes/dev-tools/LogsTab.tsx
  - taskflow/src/routes/dev-tools/log-copy-items.ts
  - taskflow/src/routes/dev-tools/useNow.ts
  - taskflow/src/routes/dev-tools/dev-tools-view.store.ts
  - taskflow/src/routes/dev-tools/JsonTree.tsx
  - taskflow/src/routes/dev-tools/dev-tools-ui.tsx
  - taskflow/src/main.tsx
findings:
  critical: 0
  warning: 7
  info: 5
  total: 12
status: issues_found
---

# Quick 261119-tvz: Code Review Report

No BLOCKER found. The capture path is mostly sound: queuedAt cannot leak, every apiFetch completion path patches the entry, and a late update after eviction is a no-op. The main gaps are secret redaction in the copy paths and a few robustness and perf issues in the timeline.

## Warnings

### WR-01: Copy actions bypass redaction for URL, response body and request body
**File:** `taskflow/src/routes/dev-tools/log-copy-items.ts:11-21`
**Issue:** "Copy URL", "Copy response" and "Copy request body" return `entry.url`, `entry.responseBody` and `entry.requestBody` raw. apiFetch also stores the raw URL (`apiFetch.ts:110`, no `redactUrl`). Scenario: a request to `...?private_token=glpat-xxx` or a body with a password/token is copied and pasted into a bug report. The JSON, Markdown and cURL builders redact the URL, so the menu is inconsistent. The comment in `copy-format.ts` ("everything here redacts again") is only true for URLs and headers.
**Fix:** Use `redactUrl(entry.url)` in "Copy URL". Decide on a body policy (a key-based redactor for `password|token|secret|authorization` JSON fields) and apply it to the single-body copies. Optionally redact the URL at capture.

### WR-02: Markdown and JSON exports include bodies verbatim
**File:** `taskflow/src/lib/dev-tools/copy-format.ts:27-28, 71-73, 79-85`
**Issue:** `redactedEntry` passes `requestBody`/`responseBody` through `bodyValue()` with no redaction. `entryToMarkdown` fences them as-is. The log export (`LogsTab.tsx:176`, `entriesToJson(filtered)`) writes every response body of the session to a file on disk and reveals it in Finder. Responses from `/myself`, token or OAuth endpoints, or GitLab project variables can carry secrets. `entry.error` is also not redacted (network error text can echo a URL with a token param).
**Fix:** Add `redactBody()` in `redact.ts` (a recursive key-name scrub on parsed JSON). Run `entry.error` through `redactUrl`. Say in the export UI that bodies are included.

### WR-03: redactUrl misses common secret param names
**File:** `taskflow/src/lib/dev-tools/redact.ts:21-22`
**Issue:** The regex needs the whole param name to be one of a fixed set. `client_secret`, `refresh_token` (matches only as `token` suffix, so no), `apikey`, `key`, `jwt`, `sig`, `X-Amz-Signature` and `private-token` are not scrubbed. The header side uses a substring pattern, so the two are inconsistent.
**Fix:** `/([?&])([^=&#]*(?:token|secret|password|passwd|api[_-]?key|signature|sig|jwt)[^=&#]*)=[^&#]*/gi` replaced with `'$1$2=REDACTED'`.

### WR-04: Query-activity diff emits spurious events when capture is switched on mid-session
**File:** `taskflow/src/lib/dev-tools/query-activity.ts:50-55`, `taskflow/src/hooks/useQueryActivityCapture.ts:21-27`
**Issue:** `prev` is empty when capture turns on (or after `prev.clear()` while it is off). The first `updated` event for an existing query diffs against `INITIAL` (dataUpdatedAt 0, status 'pending'). Any update to a query that already has data, such as an observer attach or a setQueryData, therefore emits a false `success`, and `fetch` too if it is fetching. The Cache lane shows markers for events that did not happen. Error queries get a false `error` marker the same way.
**Fix:** On the first sight of a hash while no prior snapshot exists, only record the snapshot, except for `type === 'added'`:
```ts
const known = prev.has(hash);
kinds = event.type === 'added' || known ? diffQueryActivity(prev.get(hash), next) : [];
```

### WR-05: LogsTimeline writes a ref during render (React Compiler)
**File:** `taskflow/src/routes/dev-tools/LogsTimeline.tsx:227-228`
**Issue:** `wheelCtx.current = { win, scale, allBounds }` is a ref write during render. The React Compiler bails out on the whole component (or the lint rule fires), so none of the useMemo layout work is compiled. Under concurrent rendering it can also publish values from a render that never commits. This is the exact "hidden module read goes stale only in the app" class of problem.
**Fix:** Update the ref in an effect (`useEffect(() => { wheelCtx.current = {...} })`) or `useLayoutEffect`.

### WR-06: Timeline recomputes all layout on every 250 ms tick and re-renders all bars on every pointer move
**File:** `taskflow/src/routes/dev-tools/LogsTimeline.tsx:162-174, 285-299, 372-373`; `TimelineConcurrencyStrip.tsx:36-47`
**Issue:**
- `spans` depends on `now`, so while any request is pending, all of these re-run every 250 ms for all entries (1000): `spans`, `groupBursts`, `baseWindow`, `allBounds`, `packLanes`, the strip series and `visibleEntries`. `entryEnd` ignores `now` for non-pending entries, but the array identity changes, so every downstream memo is invalidated. `LogsTab.tsx:111` does the same `groupBursts` again for the waterfall.
- `sumSteps` is O(T x P): `valueAt` rescans the series from the start for each time point. With about 2000 points that is millions of operations per tick.
- `showTooltip` calls `setTooltip({...new object})` on every `pointermove`. This re-renders the whole timeline, and with burst "All" that is up to 1000 `<button>` bars. There is no memoized bar component.
- A request that never settles keeps the tick (and all of this) running forever.
Perf is formally out of v1 scope, but this is the specific 1000-entry scenario you asked about.
**Fix:** Compute `spans` from entries only, using `end: pending ? NaN : end`, and keep the pending end overlay separate. Do a linear merge in `sumSteps`. Extract a `React.memo` `TimelineBar`. Bail out of `setTooltip` when the id is unchanged and coordinates move by less than about 2 px (or position the tooltip via a ref).

### WR-07: Strip brush gets stuck on non-primary pointer buttons
**File:** `taskflow/src/routes/dev-tools/TimelineConcurrencyStrip.tsx:89-103`
**Issue:** `onPointerDown` starts a drag and captures the pointer for any button. A right-click or ctrl-click on macOS opens the context menu and no `pointerup` is delivered. `drag` stays set and the selection rect then follows plain mouse movement until the next click. Capture is also never released explicitly, and `lostpointercapture` is not handled.
**Fix:** `if (e.button !== 0 || !e.isPrimary) return;` in `onPointerDown`, and add `onLostPointerCapture={() => setDrag(null)}`.

## Info

### IN-01: Verified OK, for the record
**File:** `taskflow/src/lib/apiFetch.ts`, `queue-handoff.ts`, `debug-log.store.ts`
**Issue:** No defect, checked in detail.
- `takeQueuedAt()` is the first statement, before any await. `runWithQueuedAt` clears the slot in `finally`, including on a sync throw. p-limit invokes `fn` synchronously inside `run`, so no cross-request leak. A fn that awaits first gets `undefined` rather than a wrong value.
- Completion is patched on success, HTTP error (state 'done' with status), network or timeout error, and caller abort (state 'error'). The `requestLogging` flag is captured once, so toggling it mid-flight cannot strand an entry as pending. `update()` is a no-op for an evicted id and for `clear()`.
- With dev tools off the added cost is one slot read and one `nowMs()` per limited call.
- Subscriber with capture off: one `getState()` and an early return; `prev` is cleared.
**Fix:** none.

### IN-02: Capture not fully guarded despite the "never throws" claim
**File:** `taskflow/src/lib/apiFetch.ts:87, 101`
**Issue:** `redactHeaders(init?.headers)` and `crypto.randomUUID()` run outside any try. They are very unlikely to throw. `response.clone()` inside the main try (`:146`) would be reported as a network error and rethrown, so a capture failure can fail a successful request (pre-existing).
**Fix:** Wrap the clone and body read in their own try and fall back to `responseBody = ''`.

### IN-03: Every limited Jira request gets a queuedAt, even with no wait
**File:** `taskflow/src/lib/concurrency.ts:27-29`
**Issue:** `queuedAt` is set for all calls. Free-slot requests show "Queued 0 ms" in Markdown and zero-width lead-ins, and `hasQueued` is always true for Jira traffic, so the strip's dashed series is always drawn.
**Fix:** In `apiFetch`, only keep `queuedAt` when `startedAt - queuedAt` is above about 2 ms.

### IN-04: Wheel zoom ignores delta magnitude
**File:** `taskflow/src/routes/dev-tools/LogsTimeline.tsx:239`
**Issue:** A trackpad pinch emits many small ctrl-wheel events, each zooming by a fixed 20%. The result is extremely fast zoom. `preventDefault` is correct (the listener is non-passive and only prevents when ctrl/meta is held).
**Fix:** `factor = Math.exp(e.deltaY * 0.002)` clamped.

### IN-05: Copy timers can be armed after unmount
**File:** `taskflow/src/routes/dev-tools/JsonTree.tsx:339-343`, `dev-tools-ui.tsx:60-63`
**Issue:** The clipboard promise can resolve after the cleanup ran, and `settle` then arms a new timeout that is never cleared. This is harmless (a no-op setState) but is a small leak.
**Fix:** Keep an `unmounted` ref and skip `settle`.

## Settings v41 migration
Correct. `jiraConcurrencyLimit` is deleted when `version < 41`, and the v13 default is now a no-op. No remaining reader (`grep` clean outside tests). No test-only or consumer reference remains. `getJiraLimit()` now returns a plain function, not the p-limit instance. The only callers (`services/jira.ts:1021`, `services/jira/client.ts:68`) just invoke it, so this is safe.

---

_Reviewed: 2026-11-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Orchestrator follow-up (0c69b9d2)

Each item below was checked against the code, and each fix has a test that failed before the fix.

- WR-07 brush: **Fixed.** Ignores non-primary buttons; `onLostPointerCapture` drops the drag.
- WR-04 false markers: **Fixed.** Existing queries are baselined when capture turns on (settings subscription).
- IN-03 "Queued 0 ms": **Fixed.** Handoffs under 2 ms are treated as scheduling noise (`meaningfulQueuedAt`).
- WR-03 URL params: **Fixed.** Param names are matched by pattern. WR-01: Copy URL now redacts. (The row-hover Copy URL still copies the raw URL. The app sends auth in headers, not in URLs.)
- Verifier info (success/removed markers highlight): **No change needed.** Only fetch, invalidated and error markers render.
- Open: WR-02 (bodies are not redacted in copy/export: this is intentional for a dev tool, and responses carry no PATs), WR-05 (ref write during render), WR-06 (layout recomputes on every live tick while requests are pending), IN-02, IN-04 (trackpad zoom speed), IN-05.
