# Phase 58: Redesign Data Fetch of AIO Cycle Detail Executions List and Execution Detail — Research

**Researched:** 2026-05-15
**Domain:** React / TanStack Query / AIO TCMS REST API / TypeScript
**Confidence:** HIGH

---

## Summary

`AioCycleDetailPage.tsx` currently loads the executions list using `fetchAioTestRunsForCycle` — the old `aio-tcms-api/1.0` paginated endpoint that returns one `AioTestRun` per test case assignment, then resolves each run's `jiraDefectIDs[]` to string Jira keys via sequential `fetchJiraIssueByKey` calls. For a cycle with 261 tests and 3 defects, this means ~264 sequential HTTP round trips before the page is fully rendered. Phase 57 proved that the AIO `/rest/aio-tcms/1.0` endpoints (POST `/testcycle/paged`, GET `/testcycle/summary/paged`) can deliver the full cycle list in 2 requests instead of N. Phase 58 applies the same thinking to the cycle detail executions list and the run detail page.

The core opportunity: the AIO `/rest/aio-tcms/1.0/project/{id}/testcycle/paged` (POST) endpoint already returns every cycle's `detail` object including `isClosed`, `ownedByID`, key, and title in one batch call. Per Phase 57's UAT, the executions list for a cycle's `AioCycleDetailPage` still uses the legacy `aio-tcms-api/1.0` endpoint. The question is: **does the new `/rest/aio-tcms/1.0` surface expose an equivalent endpoint for per-cycle test run listing that avoids the old pagination + defect resolution loop?** That endpoint existence, URL, and shape must be probed against the live instance before any implementation can proceed — the researcher cannot verify it from training data alone.

**Primary recommendation:** Begin Phase 58 with a mandatory live-probe plan (autonomous: false) to discover what run-listing endpoint(s) exist under the `/rest/aio-tcms/1.0` base path. Depending on findings, implement a redesigned data fetch for `AioCycleDetailPage` that eliminates the N+1 defect resolution pattern. If no equivalent endpoint exists, the fallback is to batch-resolve defects in parallel (not sequentially) and cache the defect resolution queries through TanStack Query's key-based dedup.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Executions list display | Browser / Client | — | Data-fetching component; all rendering is client-side |
| Executions data source | API / Backend (AIO) | — | Fetched from AIO TCMS REST API per cycle |
| Defect key resolution | API / Backend (Jira) | — | Jira `GET /rest/api/2/issue/{id}` resolves numeric IDs to string keys |
| Run detail display | Browser / Client | — | `AioTestRunDetailPage` is a client-rendered full-page route |
| Run detail data source | API / Backend (AIO) | — | Single run fetch via `fetchAioTestRunDetail` (already uses `aio-tcms-api/1.0` single-run endpoint — acceptable) |
| Progress bar computation | Browser / Client | — | Derived in-component from run status counts |
| Status ID mapping | Browser / Client | — | `AIO_STATUS_MAP` / `buildStatusMap` from `/config` — already in `aioUtils.ts` |
| Filter chip state | Browser / Client | — | `useState<Set<string>>` — local, no persistence |

---

## Current Data Fetch Architecture (the problem)

### `AioCycleDetailPage.tsx` — two slow queries

```typescript
// Query 1: cycle metadata (single detail endpoint — fast)
queryKey: ['aio', jiraBaseUrl, 'cycle-detail', projectKey, cycleKey]
queryFn: () => fetchAioCycleDetail(jiraBaseUrl, token, projectKey, cycleKey)
// → GET /rest/aio-tcms-api/1.0/project/{key}/testcycle/{key}/detail

// Query 2: all test runs for the cycle (SLOW — pagination + N defect resolutions)
queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey]
queryFn: () => fetchAioTestRunsForCycle(jiraBaseUrl, token, projectKey, cycleKey)
// → GET /rest/aio-tcms-api/1.0/project/{key}/testcycle/{key}/testrun?startAt=N (paginated)
// → then resolves each run's jiraDefectIDs[] via fetchJiraIssueByKey (one call per defect ID)
```

### What makes `fetchAioTestRunsForCycle` slow

1. **Pagination loop** — cycles with >50 runs require multiple round-trips (one per page).
2. **Serial defect resolution** — `resolveDefectsForRuns` runs `Promise.all` across runs, but each run with defects calls `fetchJiraIssueByKey` per numeric ID. For a cycle with many defects, this can mean dozens of Jira HTTP calls stacked after the pagination loop completes.
3. **No query-level dedup** — defect Jira queries fired inside the service function bypass TanStack Query's cache; duplicate defect keys across runs each trigger a separate network call.

### `AioTestRunDetailPage.tsx` — single query (acceptable)

```typescript
queryKey: ['aio', jiraBaseUrl, 'run-detail', projectKey, cycleKey, runId]
queryFn: () => fetchAioTestRunDetail(jiraBaseUrl, token, projectKey, cycleKey, runId)
// → GET /rest/aio-tcms-api/1.0/project/{key}/testcycle/{key}/testrun/{id}?assignSteps=true
```

This is a single targeted request. It is already optimal for its use case — no N+1 pattern. The only issue is that the progress bar in `AioCycleDetailPage` still depends on the full `runsQuery` result, which means the progress bar cannot render until all runs (and their defect resolutions) complete.

---

## Standard Stack

No new packages. This phase uses only already-installed libraries.

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `@tanstack/react-query` | ^5.x | Data fetching, caching, query key–based dedup | [ASSUMED] already installed |
| `react-router-dom` | ^6.x | `useParams`, `useNavigate`, `useLocation` | [ASSUMED] already installed |
| `vitest` + `@testing-library/react` | — | Unit + component tests | [ASSUMED] already installed |

No new npm installs required for this phase.

---

## Package Legitimacy Audit

Not applicable — no new packages are being installed in this phase.

---

## The Critical Unknown: New Run-List Endpoint

Phase 57 confirmed that the AIO `/rest/aio-tcms/1.0` surface (distinct from `/rest/aio-tcms-api/1.0`) exposes these endpoints:

| Endpoint | What it returns |
|----------|----------------|
| `GET /project/{id}/testcycle/folder` | Folder tree |
| `GET /project/{id}/testcycle/folder/count` | Per-folder cycle count |
| `POST /project/{id}/testcycle/paged` | Cycles with detail (key, title, ownedByID, isClosed) |
| `POST /project/{id}/testcycle/summary/paged` | Cycles with testRunDistribution |
| `GET /project/{id}/config` | testRunStatus entries for dynamic ID mapping |

**What is not yet known:** Whether the `/rest/aio-tcms/1.0` surface has an equivalent endpoint for per-cycle test runs (executions list). Candidates to probe:

1. `GET /project/{id}/testcycle/{cycleNumericId}/testrun` (numeric ID version of the existing API-1.0 path)
2. `POST /project/{id}/testcycle/{cycleNumericId}/testrun/paged` (POST-paged variant)
3. `GET /project/{id}/testcycle/{cycleNumericId}/testrun/summary/paged` (summary-by-run endpoint)
4. No equivalent exists — the old endpoint is the only run-list path

This determination drives the entire implementation. It MUST be answered by a live probe plan before any service code is written. [ASSUMED — not verified against live instance]

---

## Architecture Patterns

### Pattern 1: Probe-First Gate (mandatory for Phase 58)

Every prior AIO phase that touched a new endpoint started with a probe plan (autonomous: false) where the developer captures live network requests from the DevTools. Phase 58 must follow this pattern — wrong endpoint assumptions cause 404 or 405 errors discovered only at UAT.

The probe plan must answer:
- Does a `/rest/aio-tcms/1.0` run-list endpoint exist for cycle detail?
- If yes: is it GET or POST? Does it return run status, test case title, and executed date?
- If yes: does it return or require a numeric cycle ID (like `paged`) or the string cycle key (like `aio-tcms-api/1.0`)?
- What is the shape of a single run entry (fields for status, test case title, executed date)?
- Does the response include defect IDs, and in what form?

### Pattern 2: Decouple Progress Bar from Full Run List

The current `AioCycleDetailPage` gates the entire page (including progress bar) on `runsQuery` completing. The better pattern: use the cycle summary endpoint (already available — `fetchAioCycleSummaries` with this cycle's numeric ID) to drive the progress bar independently of the runs list. This allows the progress bar to render almost instantly from the summary endpoint while the runs list loads separately.

This is a clean win regardless of whether a new run endpoint is found, because:
- Summary endpoint is batch-confirmed and fast (1 request per cycle open)
- Run list can show skeleton while loading
- Progress bar no longer blocks on full run enumeration

```typescript
// Progress bar: driven by summary endpoint (fast path — 1 request)
queryKey: ['aio', jiraBaseUrl, 'cycle-summaries', projectKey, String(cycleNumericId)]
queryFn: () => fetchAioCycleSummaries(jiraBaseUrl!, token!, jiraProjectId!, [cycleNumericId!])
enabled: aioGate && !!cycleNumericId

// Runs list: driven by runs endpoint (slower path — can show skeleton independently)
queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey]
queryFn: () => fetchAioTestRunsForCycle(...) // or new endpoint if probe finds one
```

**Prerequisite:** The cycle detail page needs to know `cycleNumericId` (AIO's internal integer `ID` for the cycle, distinct from the string `cycleKey` like `PROJ-CY-42`). Currently the page only has `cycleKey` from the URL. Options:
- A) Fetch it from the `paged` endpoint with `folderID` omitted (already returns `allIDs`)
- B) The `/detail` endpoint for the cycle already has enough info — check if the response includes `ID`
- C) Resolve it via `fetchAioCyclesWithDetail` — but this is a POST with potentially large responses

This lookup strategy must be confirmed in the probe plan.

### Pattern 3: Move Defect Resolution into TanStack Query (not inside service function)

The current `resolveDefectsForRuns` runs inside the service function, bypassing the TanStack Query cache. The redesigned approach moves defect key resolution into the component as per-key `useQuery` hooks (same pattern as `DefectRow` in `AioCycleDetailPage` — already implemented correctly):

```typescript
// DefectRow already does this correctly — one useQuery per defect key
const issueQuery = useQuery<JiraIssue | null>({
  queryKey: ['jira', jiraBaseUrl, 'issue-lightweight', defectKey],
  queryFn: () => fetchJiraIssueByKey(jiraBaseUrl!, token!, defectKey),
  enabled: !!jiraBaseUrl && !!token && !tokenLoading,
});
```

The problem is that the defect *keys* themselves are derived from `jiraDefectIDs[]` (numeric) → resolved to string keys inside the service, before TanStack Query can see them. Moving resolution into component-level `useQuery` hooks requires either:
- Passing raw `jiraDefectIDs[]` numbers through to the component and resolving there (changes `AioTestRun` data model in query cache)
- Keeping service resolution but running it as a separate `useQuery` chain rather than inside the runs query function

The planner should pick the approach consistent with the current `DefectRow` pattern (component-level per-key queries), since that already correctly deduplicates and benefits from cache.

### Pattern 4: Credential Gate (mandatory — no first-load 401 flash)

All AIO `useQuery` calls must gate on `!!jiraBaseUrl && !!token && !tokenLoading`. This pattern is established in `useAioCredentials()` and has been applied to every AIO page since Phase 56. Phase 58 must not regress this. [VERIFIED: existing codebase]

### Pattern 5: Query Key Alignment with AioProjectOverviewPage

The runs query in `AioCycleDetailPage` uses:
```
['aio', jiraBaseUrl, 'runs', projectKey, cycleKey]
```
This key was originally designed to be shared with `AioProjectOverviewPage`'s per-cycle stats queries. After Phase 57, the overview page no longer uses this key (it uses `cycle-summaries` instead). The Phase 58 planner is free to keep or rename this key, but must update all callers if renamed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP dedup of concurrent identical requests | Custom dedup layer | TanStack Query key-based dedup | Already provided; identical query keys automatically coalesce |
| Defect display with loading skeletons | Custom async table cell logic | `useQuery` per defect key in `DefectRow` | Already implemented and working in current `AioCycleDetailPage` |
| Pagination loop | Custom cursor/offset logic | Existing `fetchAioTestRunsForCycle` pagination loop | Already handles `isLast` guard; only replace if new endpoint is found |
| Status label normalization | New switch statement | `normalizeStatus`, `normalizeStatusLabel`, `normalizeStatusById` from `aioUtils.ts` | Single source of truth — already handles all status strings and numeric IDs |
| Progress bar computation | Reinvent counting logic | Existing `counts`/`pct` pattern in `AioCycleDetailPage` | Already correct and tested |

---

## Common Pitfalls

### Pitfall 1: Using String cycleKey Where Numeric cycleID Is Required
**What goes wrong:** The `/rest/aio-tcms/1.0` endpoints (folder tree, summary, paged) use the numeric AIO internal ID (e.g., `10134`), not the string key (`PROJ-CY-42`). Passing the string key to these endpoints returns 404.
**Why it happens:** The URL params look similar but are different types. The Phase 57 UAT found this and fixed it by adding `fetchJiraProjectNumericId`.
**How to avoid:** Clearly distinguish `cycleKey` (string, from URL) from `cycleId` (number, from AIO internal). If the new run endpoint requires a numeric ID, add a resolution step — or probe whether it accepts the string key.
**Warning signs:** 404 responses from the new endpoint in DevTools.

### Pitfall 2: Re-Running Defect Resolution on Every Stale Refetch
**What goes wrong:** `resolveDefectsForRuns` is called inside `queryFn`. Every time TanStack Query refetches the runs (e.g., window re-focus), it re-fetches AND re-resolves all defects — even if the defect data is already in the Jira query cache.
**Why it happens:** Service-level resolution bypasses TanStack Query's cache layer.
**How to avoid:** Move defect resolution to component-level `useQuery` calls (pattern already established in `DefectRow`). The `DefectRow` component already correctly caches per-key.
**Warning signs:** Network tab shows repeated `GET /rest/api/2/issue/{numericId}` calls after window re-focus.

### Pitfall 3: Blocking Progress Bar on Full Run Load
**What goes wrong:** The progress bar and "No runs recorded" message only appear after `runsQuery` completes. For large cycles (261 tests), this means the page shows skeleton for several seconds before any progress information is visible.
**Why it happens:** Progress bar data (`counts`) is derived from `runsQuery.data` in the current code.
**How to avoid:** Use `fetchAioCycleSummaries` (already available, fast) to drive the progress bar independently. The runs list can continue loading in the background.
**Warning signs:** UAT shows spinner/skeleton persisting far longer than the cycle header renders.

### Pitfall 4: POST Body Shape for `fetchAioCycleSummaries`
**What goes wrong:** `fetchAioCycleSummaries` sends `POST body = JSON.stringify(cycleIds)` (raw array). Passing it an object `{ ids: [...] }` instead causes the server to return 0 or all results.
**Why it happens:** Confirmed in Phase 57 UAT fix 3. The body is a raw JSON array, not a keyed object.
**How to avoid:** Use `JSON.stringify([cycleNumericId])` — an array of one ID.

### Pitfall 5: `AIO_STATUS_MAP` Keys Are Numbers, Not Strings
**What goes wrong:** `testRunDistribution` keys from the API are JSON strings (`"53"`, `"901"`). Doing `AIO_STATUS_MAP["53"]` returns `undefined` because the map is keyed by `number`.
**Why it happens:** TypeScript allows number keys but JSON object keys are always strings.
**How to avoid:** Always call `Number(key)` before lookup: `AIO_STATUS_MAP[Number(idStr)]`. This pitfall is already documented in `aioUtils.ts` but it is easy to miss in new code.

### Pitfall 6: Credential Gate Missing `!tokenLoading`
**What goes wrong:** Without `!tokenLoading` in `enabled`, the query fires once with `token: null` → 401 → error flash before the token resolves.
**Why it happens:** `useAioCredentials()` initializes with `isLoading: true` + `token: null`. The `!tokenLoading` guard prevents this first-fire.
**How to avoid:** Every `enabled` clause: `!!jiraBaseUrl && !!token && !tokenLoading && ...`. Never remove `!tokenLoading`. [VERIFIED: all Phase 56-57 pages use this pattern]

---

## Key Files

### Files under edit (Phase 58)

| File | Role | Edit scope |
|------|------|------------|
| `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` | Primary target | Replace `runsQuery` / progress bar data source; possibly add `jiraProjectId` resolution |
| `taskflow/src/services/aio/cycles.ts` | Service layer | May add new fetch function if probe finds endpoint; no changes if old endpoint retained |
| `taskflow/src/services/aio/issue-runs.ts` | Service layer | `resolveDefectsForRuns` may be removed or moved depending on design choice |
| `taskflow/src/services/aio/types.ts` | Types | Possibly extend `AioTestRun` if new endpoint returns different fields |
| `taskflow/src/lib/aioUtils.ts` | Utilities | No changes expected — `normalizeStatusById` and `AIO_STATUS_MAP` already correct |

### Files read-only (do not change)

| File | Why read-only |
|------|--------------|
| `taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx` | Already uses single optimal request; no redesign needed unless probe finds improvement |
| `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx` | Separate concern (issue-level); has its own data fetch path; out of scope |
| `taskflow/src/services/aio/client.ts` | Base path constants already correct; no changes needed |
| `taskflow/src/hooks/useAioCredentials.ts` | Already correct; reuse as-is |

---

## Code Examples

### Decoupled progress bar using summary endpoint [ASSUMED — probe must confirm numeric cycleId availability]

```typescript
// Source: established pattern from AioProjectOverviewPage.tsx (Phase 57)
// In AioCycleDetailPage — use summary for fast progress, runs for the table
const summaryQuery = useQuery<AioCycleSummaryItem[]>({
  queryKey: ['aio', jiraBaseUrl, 'cycle-summaries', projectKey, String(cycleNumericId)],
  queryFn: () => fetchAioCycleSummaries(jiraBaseUrl!, token!, jiraProjectId!, [cycleNumericId!]),
  enabled: aioGate && !!cycleNumericId,
});

// Progress bar derives from summaryQuery.data[0].summary, not from runsQuery
const summary = summaryQuery.data?.[0]?.summary;
```

### Component-level defect resolution (already correct in DefectRow) [VERIFIED: existing codebase]

```typescript
// Source: AioCycleDetailPage.tsx DefectRow component (current code — already correct pattern)
function DefectRow({ defectKey, jiraBaseUrl, token, tokenLoading, triggeredBy }) {
  const issueQuery = useQuery<JiraIssue | null>({
    queryKey: ['jira', jiraBaseUrl, 'issue-lightweight', defectKey],
    queryFn: () => fetchJiraIssueByKey(jiraBaseUrl!, token!, defectKey),
    enabled: !!jiraBaseUrl && !!token && !tokenLoading,
  });
  // ...
}
```

The DefectRow component already uses component-level queries correctly. The problem is upstream: defect keys reach this component only after `resolveDefectsForRuns` inside the service has already resolved them — a double-resolution pattern. The redesign should pass raw `jiraDefectIDs[]` through to the component and let DefectRow resolve them directly against the TanStack cache.

### Credential gate pattern [VERIFIED: existing codebase]

```typescript
// Source: AioProjectOverviewPage.tsx (Phase 57)
const { token, isLoading: tokenLoading } = useAioCredentials();
const credGate = !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey;
const aioGate = credGate && !!jiraProjectId;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N per-cycle run fetches for progress bar | Batch summary endpoint (`paged2`) | Phase 56-57 | AioProjectOverviewPage now loads in 2 requests instead of N |
| Flat accordion for cycle list | Two-panel folder tree + cycle table | Phase 57 | Layout matches real AIO product |
| Hardcoded status ID map | Dynamic map from `/config` endpoint | Phase 57 UAT | Correct colors for all status types |
| `?username=` for Jira user lookup | `?key=` for JIRAUSER* accounts | Phase 57 UAT | Owner display names resolve correctly |

**Still old in Phase 58 scope:**
- `AioCycleDetailPage` executions list: still uses `aio-tcms-api/1.0` N+1 pattern — target of this phase
- Progress bar: still gates on `runsQuery` (full run enumeration) — target of this phase

---

## Probe Findings Required Before Implementation

The Wave 0 probe plan must record answers to these questions in a `58-PROBE-FINDINGS.md` file before any service code or component changes are written:

| Question | Why It Matters |
|----------|----------------|
| Does `/rest/aio-tcms/1.0/project/{id}/testcycle/{cycleId}/testrun` exist? | Determines whether a new fast endpoint is available |
| Is the cycleId in the path a numeric ID or string key? | Drives whether we need a cycleId resolution step |
| What HTTP method is required (GET or POST)? | AIO paged endpoints switched from GET to POST (Phase 57 UAT fix 2) |
| What fields does a single run entry contain? (status, testCaseKey, testCase.title, executedDate, jiraDefectIDs) | Determines whether normalizeTestRun logic needs updating |
| Does the cycle detail endpoint (`/detail` path) return `ID` (numeric)? | Enables direct use of the numeric ID for summary fetch without an extra lookup |
| What is the live response for `GET /testcycle/{cycleKey}/detail` — does it include `ID: number`? | Needed to decide if a jiraProjectId lookup is required for the summary query |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm test -- --reporter=verbose AioCycleDetailPage` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|--------------|
| Progress bar renders from summary data (not run list) | unit/component | `npm test -- AioCycleDetailPage` | Partial — existing tests cover progress bar from runs; need update |
| Run table renders while progress bar already visible | component | `npm test -- AioCycleDetailPage` | Wave 0 gap |
| Defect resolution uses TanStack cache (no double-resolution) | unit | `npm test -- issue-runs` | Wave 0 gap |
| Credential gate prevents first-load 401 flash | component | `npm test -- AioCycleDetailPage` | Partial |
| New fetch function (if any) handles 401, 404, network error | unit | `npm test -- cycles` | Wave 0 gap |

### Sampling Rate
- **Per task commit:** `cd taskflow && npm test -- --reporter=verbose AioCycleDetailPage`
- **Per wave merge:** `cd taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Update `AioCycleDetailPage.test.tsx` to cover decoupled progress bar behavior
- [ ] Add `cycles.test.ts` coverage for any new fetch function discovered by probe
- [ ] Add service test verifying defects are NOT double-resolved (service returns raw IDs, component resolves)

*(If no new fetch function is found by probe, Wave 0 gaps reduce to test updates only.)*

---

## Open Questions

1. **Does the AIO `/rest/aio-tcms/1.0` surface have a test-run listing endpoint?**
   - What we know: The `aio-tcms/1.0` surface was confirmed in Phase 57 with folder, count, paged, summary, and config endpoints. None of these return per-run data.
   - What's unclear: Whether a run-list endpoint exists under this base path (or a different base path like `/rest/aio-tcms/2.0`).
   - Recommendation: Probe plan required. If no endpoint found, fall back to Option B (decouple progress bar from summary endpoint; retain old run list with parallel defect resolution via TanStack Query).

2. **Does the cycle `/detail` response include the numeric `ID` field?**
   - What we know: `AioCycleDetailItem` (from paged) has `ID: number` at the root. The old `/detail` endpoint returns a `RawCycle` object — its types do not include `ID`.
   - What's unclear: Whether the live `/detail` response actually includes `ID` in the JSON (it may but TypeScript types don't model it).
   - Recommendation: Probe plan must capture a live `/detail` response body and check for `ID` field. If present, it eliminates the need for a separate ID lookup query.

3. **What is the design intent of Phase 58?**
   - What we know: Phase description says "Redesign data fetch of AIO cycle detail executions list and execution detail" — clearly targeting `AioCycleDetailPage` and `AioTestRunDetailPage`.
   - What's unclear: Whether "execution detail" means `AioTestRunDetailPage` needs changes, or just refers to the run-detail section within `AioCycleDetailPage`.
   - Recommendation: Treat `AioTestRunDetailPage` as read-only unless the probe reveals a specific fetch problem there (it already uses a single `fetchAioTestRunDetail` call — which is already optimal).

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — this phase uses only already-installed libraries and the existing live AIO/Jira instance).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A `/rest/aio-tcms/1.0` run-listing endpoint may exist for the cycle detail | Open Questions | If no endpoint exists, implementation falls back to defect-decoupling only |
| A2 | The cycle `/detail` response includes `ID: number` in the live JSON | Open Questions | If absent, a separate ID resolution query is needed to use the summary endpoint |
| A3 | `fetchAioCycleSummaries` can be called with a single-element `[cycleNumericId]` array to get summary for just one cycle | Code Examples | If the endpoint requires all IDs, using it for single-cycle summary may be slow |
| A4 | Decoupling progress bar from the full run enumeration is the primary goal of Phase 58 | Summary | If user intent is different (e.g., add filtering UI), plan scope changes |

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` — current implementation, read directly
- `taskflow/src/services/aio/issue-runs.ts` — `fetchAioTestRunsForCycle` + `resolveDefectsForRuns`, read directly
- `taskflow/src/services/aio/cycles.ts` — `fetchAioCycleSummaries`, `fetchAioFolderTree`, `fetchAioCyclesWithDetail`, read directly
- `taskflow/src/lib/aioUtils.ts` — `AIO_STATUS_MAP`, `normalizeStatusById`, read directly
- `.planning/phases/57-redesign-the-aio-cycles-page-it-should-be-more-like-the-real/57-PROBE-FINDINGS.md` — confirmed endpoint URLs and shapes
- `.planning/phases/57-redesign-the-aio-cycles-page-it-should-be-more-like-the-real/57-UAT.md` — confirmed 7 inline fixes; all checks pass
- `.planning/phases/57-redesign-the-aio-cycles-page-it-should-be-more-like-the-real/API-EXAMPLES.md` — live response shapes for paged, paged2, folder, count endpoints

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — project history, phase ordering, accumulated decisions
- `.planning/ROADMAP.md` — Phase 58 description, dependencies on Phase 57

---

## Metadata

**Confidence breakdown:**
- Current codebase state: HIGH — read directly from source
- AIO endpoint surface: MEDIUM — `/rest/aio-tcms/1.0` run-list endpoint existence unconfirmed
- Decoupling strategy: HIGH — pattern established and proven in Phase 57
- Implementation approach: MEDIUM — depends on probe findings

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (stable protocol — endpoint shapes don't change frequently)
