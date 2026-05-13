---
phase: 54-aio-on-issue-detail
reviewed: 2026-05-14T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - taskflow/src/routes/dashboard/WikiRenderer.tsx
  - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx
findings:
  critical: 1
  warning: 7
  info: 5
  total: 13
status: issues_found
---

# Phase 54: Code Review Report

**Reviewed:** 2026-05-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 54-07 gap closure introduces three substantive changes:

1. **rehype-sanitize XSS mitigation** in `WikiRenderer.tsx` (T-54-07-01) — schema added after `rehype-raw`.
2. **Branch 3-A pre-merge heuristic** (`mergeOpenTableRows` + `flattenInlineCalloutsForTableRow`) so nested `{panel}` content renders inside Jira-wiki table cells.
3. **Cross-cycle fan-out cap** in `AioTestRunsSection.tsx` (T-54-07-02): `MAX_IMPACTED_EXECUTIONS=20`, `MAX_PARALLEL=6`, plus the new `ImpactedExecutionsList` no-runs surface and the `AioAttachmentsGrid` aggregating from both render paths.

Sanitization is sound on the happy path: the schema runs after `rehype-raw` and the test suite explicitly proves `<script>` and `on*=` are stripped. Two correctness defects worth fixing before ship: (a) the React-Query cache key omits `jiraIssueId`, so navigating between two issues that share an `issueKey` but differ on `jiraIssueId` will serve stale data; (b) the multi-line balance counter only tracks `{panel}` and ignores `{info}/{warning}/{note}`, so a row whose cell contains a multi-line `{info}` block can still be split. Several preprocessing regexes interpolate user-controlled wiki text directly into HTML attributes — defense-in-depth would escape these even though `rehype-sanitize` currently catches the resulting payload. Tests are thorough but contain a few loose assertions and a duplicate-mock ordering assumption.

## Critical Issues

### CR-01: React-Query cache key omits `jiraIssueId` — stale data across navigations

**File:** `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx:346`
**Issue:** The query key is `['aio', jiraBaseUrl, 'issue-steps', issueKey]` but the queryFn branches on `jiraIssueId` (lines 353, 366) and uses it as the actual identifier for the Branch A1 (numeric ID) traceability lookup. If two issues share the same `issueKey` but differ on `jiraIssueId` (or if `jiraIssueId` arrives later as a prop while `issueKey` is already stable), React Query will return cached results computed against the wrong numeric id. This produces a real correctness defect: the user sees test runs linked to a different Jira issue.

Practical trigger: a parent component renders `<AioTestRunsSection issueKey="PROJ-123" jiraIssueId={undefined} />` first (legacy path executes, caches `runs=[]/null`), then re-renders with `jiraIssueId="393120"` (the cached null/empty is returned — the Branch A1 fetch never fires). The user sees a hidden or empty section even though defect-linked runs exist.

**Fix:**
```ts
const stepsQuery = useQuery({
  queryKey: ['aio', jiraBaseUrl, 'issue-steps', issueKey, jiraIssueId ?? null],
  // ...
});
```
Also update the `invalidateQueries` call on line 583 to use the same key shape (or pass `exact: false` so the prefix match still works).

## Warnings

### WR-01: `{info}/{warning}/{note}` blocks are not counted by `panelOpenCount` — multi-line callouts inside table cells still split rows

**File:** `taskflow/src/routes/dashboard/WikiRenderer.tsx:85,129-134`
**Issue:** `PANEL_TAG_RE = /\{panel(?::[^}]*)?\}/g` only matches `{panel}` / `{panel:title=...}`. The balance check at line 134 (`panelOpenCount % 2 === 0`) is the only mechanism preventing the row-merger from closing on a `|` that happens to fall in the middle of a multi-line block. Embedded `{info}…{info}`, `{warning}…{warning}`, `{note}…{note}` callouts are ignored. A real test cell containing:

```
|cell {info}
multi-line
info{info}|next cell|
```

…will close the row on the first line that ends with `|`, leaving the `{info}` body orphaned in subsequent rows. The flatten-inline-callouts pass at line 144 still substitutes `{info}…{info}` correctly inside the joined body, but only if the row stayed open long enough to include the closing tag.

**Fix:** Extend the balance regex to include all four callout kinds, e.g.:
```ts
const CALLOUT_TAG_RE = /\{(?:panel(?::[^}]*)?|info|warning|note)\}/g;
// ...
let openCount = (line.match(CALLOUT_TAG_RE) ?? []).length;
// ...
openCount += (next.match(CALLOUT_TAG_RE) ?? []).length;
if (next.endsWith('|') && openCount % 2 === 0) { ... }
```
Add a regression test mirroring the panel test but with `{info}` (and one with mixed `{info}` + `{panel}` inside the same cell).

### WR-02: Unescaped user-controlled interpolation into HTML attributes (defense-in-depth)

**File:** `taskflow/src/routes/dashboard/WikiRenderer.tsx:91, 208, 213, 219`
**Issue:** Multiple preprocess substitutions inject capture-group text verbatim into HTML attribute values:
- Line 91: `data-title="${title}"` where `title` is `[^}]+` from `{panel:title=…}` — `"`, `<`, `>` not escaped.
- Line 208: `<mention data-id="${id}">${name}</mention>` — both `id` and `name` unescaped; `id` is `[^\]]+`, `name` comes from `users?.[id]` (caller-provided, but still untrusted to this layer).
- Line 213: same shape for `[~username]`.
- Line 219: `<div data-callout="panel" data-title="$1">$2</div>` — `$1` is `[^}]+`, can contain `"`.

Today, `rehype-sanitize` runs after parsing the resulting HTML so an injected `<script>` is stripped. The XSS guard tests prove this. However, defense-in-depth principle is being violated: a single regression in the sanitize schema (e.g. someone adds `script` to `tagNames` for a new feature, or upgrades the package and the default schema changes) silently re-opens the hole because the preprocessor itself is happy to emit attacker-controlled markup. The current Plan 54-07 sanitize schema even *extends* defaultSchema; a future maintainer adding more tags is plausible.

**Fix:** Add a small attribute-escape helper and apply it to every interpolation that lands in an HTML attribute:
```ts
function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// in flattenInlineCalloutsForTableRow:
`<span data-callout="panel" data-title="${escAttr(title)}">${inner.replace(/\n/g, '<br/>').trim()}</span>`
// and apply to the panel-with-title replace, mention data-id, etc.
```
Note that `inner`/`children` text is also injected raw; that's by design (it needs to be re-parsed as HTML/markdown). The escape only applies to attribute slots.

### WR-03: `Promise.all` over per-ref fetches fails the whole section on a single ref error

**File:** `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx:428-439, 451-462, 526-538`
**Issue:** All three fan-out paths (in-cycle direct lookup, cross-cycle chunked, legacy `fetchAioTestRunSteps`) use `Promise.all`. If a single `fetchAioTestRunDetail` rejects (transient 503, stale runId, AIO server hiccup), the entire `queryFn` rejects and the user sees an ErrorState in place of the section — even if 19 out of 20 runs would have resolved successfully. The Plan 54-07 SUMMARY emphasizes graceful degradation on partial failures; the current code does not deliver that.

**Fix:** Switch to `Promise.allSettled` and synthesize a `NOT_EXECUTED` placeholder (or skip) on rejected refs:
```ts
const settled = await Promise.allSettled(
  inCycleRefs.map(async ({ testCase, runRef }) => {
    const detail = await fetchAioTestRunDetail(...);
    return { testCase, runRef, detail };
  }),
);
const inCycleResults = settled.flatMap((s) =>
  s.status === 'fulfilled' ? [s.value] : []
);
// Optionally: log rejected ones for telemetry
```
Apply the same treatment to the chunked cross-cycle loop and the legacy `Promise.all` at line 526.

### WR-04: T-54-07-02 cap test asserts `<=` instead of exact bound

**File:** `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx:767-772`
**Issue:** The cap test checks `expect(mockFetchRunDetail.mock.calls.length).toBeLessThanOrEqual(22)` and `crossCalls.length <= 20`. If a future refactor accidentally caps cross-cycle at 5 (regression — under-fetching), the test still passes. The cap is a contract — the test should assert it's *exactly* met when more refs are available.

**Fix:**
```ts
// With 30 cross-cycle cases + sentinel pair (2 in-cycle):
expect(mockFetchRunDetail).toHaveBeenCalledTimes(22); // 2 in-cycle + 20 capped cross-cycle
const crossCalls = mockFetchRunDetail.mock.calls.filter((c) => c[3] !== PRIMARY_CYCLE_KEY);
expect(crossCalls).toHaveLength(20);
```

### WR-05: `MAX_LOOKAHEAD = 50` silently drops table rows on long open rows

**File:** `taskflow/src/routes/dashboard/WikiRenderer.tsx:120, 130-139`
**Issue:** When a row stays "open" longer than 50 lines (no closing `|` with balanced panel count), the inner while loop exits without closing. Then `i = j` advances past all 50 lines, joining them into a single row regardless of structure. Subsequent legitimate rows that appeared inside those 50 lines are lost — they become part of the over-extended row's body. No warning is logged and no fallback to per-line emission is attempted.

This is a robustness concern for malformed wiki content (mismatched `{panel}` tags from a bad copy-paste). With panels currently being the only balanced delimiter, a single missing `{panel}` close in a long step description breaks the whole step table downstream of the offending row.

**Fix:** When the lookahead exits without finding a close, fall back to emitting `lines[i]` unchanged and resuming scan at `i + 1`:
```ts
let closed = false;
while (j < lines.length && j - i <= MAX_LOOKAHEAD) {
  // ...
  if (next.endsWith('|') && panelOpenCount % 2 === 0) {
    closed = true;
    j++;
    break;
  }
  j++;
}
if (!closed) {
  // Defensive: don't gobble 50 lines into one mangled row.
  out.push(line);
  i++;
  continue;
}
// existing flatten + push
```

### WR-06: Image-extension link detection fails when children are nested React nodes

**File:** `taskflow/src/routes/dashboard/WikiRenderer.tsx:327-333`
**Issue:** `childText` extraction only handles `string` and `Array<string>` shapes. If the markdown produces something like `[*VAS.png*|url]` → `<a><em>VAS.png</em></a>`, `children` becomes `[<em>VAS.png</em>]` and `childText` falls back to `''`. The image-extension test fails → the link is routed through `openUrl` (OS browser) instead of the in-app lightbox. This is a regression from the 54-06 UAT follow-up that explicitly mandated lightbox-on-click for image attachment links.

**Fix:** Walk the React children recursively or check `href` extension as a fallback:
```ts
const hrefIsImage = /\.(png|jpe?g|gif|webp|svg|bmp)(?:\?|$)/i.test(href);
if (hrefIsImage || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(childText)) {
  // ... lightbox path
}
```
The href check is reliable for the Jira attachment URL shape and removes the dependency on children shape.

### WR-07: `runs` field synthesised in `useMemo` is missing required `AioTestRun` properties

**File:** `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx:558-567`
**Issue:** The synthesised `run` object in the impacted-execution adapter only sets `id`, `status`, `testCaseKey`, `cycleKey`. If `AioTestRun` (in `@/services/aio`) requires additional fields (e.g. `name`, `executedAt`, `assignee`, `testCase`), this object is incomplete. The cast is implicit through the `AioIssueRunData` interface. The compiler accepts it only if every other `AioTestRun` field is optional. If a future API change makes any field required, this code silently produces a runtime-shaped object that fails type contracts for any downstream consumer that touches `data.runs`. The only consumer here is `collectAioImageAttachments`, which uses only `steps`, so the bug is latent — but it's brittle.

**Fix:** Refactor `collectAioImageAttachments` to accept `Array<{ steps: AioTestRunStep[] }>` directly so the adapter is unnecessary:
```ts
function collectAioImageAttachments(
  sources: Array<{ steps: AioTestRunStep[] }>,
): Array<{ filename: string; url: string }> { /* ... */ }
// call site:
return collectAioImageAttachments([...data.runs, ...data.impactedExecutions]);
```
This removes the synthetic-run anti-pattern entirely.

## Info

### IN-01: Duplicate entries in `tagNames` and `attributes.a`

**File:** `taskflow/src/routes/dashboard/WikiRenderer.tsx:28, 39`
**Issue:** `defaultSchema.tagNames` already includes `br` and `span`; `defaultSchema.attributes.a` already includes `href`. The spreads on lines 28 and 39 duplicate them. Harmless (hast doesn't care about duplicates) but misleading to readers who infer "these were missing from default".

**Fix:** Drop the redundant entries; add a comment explaining the schema only adds `mention` (new tag) and the `data-*` whitelist for callouts.

### IN-02: `node` prop is destructured but ignored in `div`/`span` overrides

**File:** `taskflow/src/routes/dashboard/WikiRenderer.tsx:264, 284`
**Issue:** Both `div` and `span` markdown components destructure `{ node, children, ...rest }` and never use `node`. The intent is to strip the `node` prop from the props forwarded to the underlying DOM element (react-markdown passes the hast node down). Comment that.

**Fix:** Add a `// strip non-DOM node prop` comment or use `// eslint-disable-next-line @typescript-eslint/no-unused-vars` if the lint complains. The current code is functionally correct.

### IN-03: Test relies on undocumented `mockResolvedValueOnce` ordering for two-call traceability

**File:** `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx:595-602, 635-641`
**Issue:** Tests use `mockFetchTraceability.mockResolvedValueOnce([...]); mockFetchTraceability.mockResolvedValueOnce([]);`. This assumes the queryFn calls `fetchAioTraceabilityTestCases` twice in a specific order (defect first, requirement second). The contract holds today (lines 373-382) but is implicit. If the order is reversed (or one call is dropped) the test would still pass on the first arrangement but mis-assert.

**Fix:** Use `mockImplementation` keyed on the `linkType` argument:
```ts
mockFetchTraceability.mockImplementation(async (_b, _t, _pid, _iid, linkType) => {
  if (linkType === 'defect') return [SENTINEL_CASE, SENTINEL_CASE_2, makeImpactedCase('1', '263794')];
  return [];
});
```
Tests then survive parallel/reordered fetches.

### IN-04: `aioRunStatusBadgeClass(row.status)` may misclassify when `status` is the user-facing label

**File:** `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx:684`
**Issue:** `aioRunStatusBadgeClass` (per its only other call sites) appears to consume the raw uppercase enum (`PASS`, `FAIL`, `BLOCKED`, `NOT_EXECUTED`). The impacted-execution row stores `status` as exactly that (line 494: `r.detail?.run.status ?? 'NOT_EXECUTED'`), and `normalizeStatusLabel(row.status)` produces the title-cased label. So the chip gets `PASS` (raw) for the class and `Pass` (label) for the text. Consistent with the in-cycle path (line 326 uses `run.status` raw). No bug — flagged only because the local variable name `status` plus the `normalizeStatusLabel` call invite confusion; explicit naming would help future readers.

**Fix:** Rename the impacted-execution field to `rawStatus` and derive `displayStatus = normalizeStatusLabel(rawStatus)`:
```ts
interface AioImpactedExecution {
  testCase: AioTestCaseWithRuns;
  runRef: AioTraceabilityRunRef;
  rawStatus: string;
  steps: AioTestRunStep[];
}
```

### IN-05: `MAX_PARALLEL` chunking does not start the next chunk until the slowest call in the current chunk finishes

**File:** `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx:449-464`
**Issue:** The chunk loop awaits each `Promise.all` before launching the next chunk. Worst case: with MAX_IMPACTED_EXECUTIONS=20 and MAX_PARALLEL=6, you get 4 chunks; if every chunk has one slow call, the slow tail dominates each chunk's latency. A windowed/semaphore approach (e.g. p-limit pattern) would keep 6 in flight continuously. Out of scope per the v1 perf exclusion, but worth a TODO comment so the next iteration knows the existing structure is intentional.

**Fix:** Add a comment noting the trade-off:
```ts
// NOTE: chunked-await intentionally simple (no p-limit dep). Tail latency
// of each chunk gates the next chunk; acceptable for max 4 chunks at 20/6.
```

---

_Reviewed: 2026-05-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
