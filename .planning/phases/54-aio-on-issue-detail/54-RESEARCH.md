# Phase 54: AIO on Issue Detail - Research

**Researched:** 2026-05-13
**Domain:** AIO TCMS REST API, React/TanStack Query, Tauri authenticated image fetch
**Confidence:** MEDIUM (service layer code is HIGH confidence; step endpoint field names are LOW — requires live probe)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Issue lookup strategy**
- D-01: Testcase-issueKey endpoint must be verified against live instance. Expected: `GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcase?issueKey=PROJ-123`. Researcher has found the endpoint exists in AIO docs as "Search Case" under `/project/{projectKey}/testcase` (D-17 already confirmed this path), but the `issueKey` query param name needs live confirmation.
- D-02: Lookup flow: issueKey → test case keys (via D-01) → latest active cycle → fetchAioTestRunsForCycle → filter runs by testCaseKey.
- D-03: Extract project key from issue key (e.g. `PROJ` from `PROJ-123`). No separate project-ID mapping.
- D-04: Two empty states — section hidden entirely if no test cases linked; "No test runs in active cycle" if cases exist but no runs.
- D-05: Query key: `['aio', jiraBaseUrl, 'issue-steps', issueKey]`.

**Cycle scope**
- D-06: Latest active cycle only — status `'Active'`, highest sequence number (string sort on cycle key). One section, not one per cycle.

**Step table structure**
- D-07: Four columns: Step | Expected | Actual | Status.
- D-08: Status chip per step — `Pass` (green), `Fail` (red), `Blocked` (orange), `Not Run` (gray). Reuse existing `aioRunStatusBadgeClass`.
- D-09: Actual column always shown; NOT_EXECUTED steps show `—`.
- D-10: Multiple test cases → collapsible run block per test case (header: test case name + run status badge). Single test case → flat step table.
- D-11: Step data from separate endpoint — researcher must confirm exact URL and field names.

**Step attachment UX**
- D-12: Inline thumbnails (~48px height) in or below the actual cell. Multiple images side by side.
- D-13: Thumbnail click opens `ImageLightbox` with `src` = attachment URL. `AuthImage` handles auth.
- D-14: Per-thumbnail independent `ImageLightbox`. No multi-image navigation.

**Section loading**
- D-15: Auto-loads in parallel with Jira data. Separate `useQuery`. `useDelayedLoading` with 200ms.
- D-16: Placement: below `ActivityTimeline` in `IssueDetailPage.tsx`.

### Claude's Discretion
- Latest active cycle: highest-sequence-number `Active` cycle via string sort on cycle key.
- Actual column default: `—` string for not-run steps.
- Multi-test-case grouping: `<details>`/collapsible consistent with `SubtasksSection` or simple accordion.
- Thumbnail size: ~48px height, preserving aspect ratio.
- Section heading: "AIO Test Runs" with `FlaskConical` icon.

### Deferred Ideas (OUT OF SCOPE)
- Showing runs from ALL cycles.
- Multi-image lightbox navigation for step attachments.
- Write actions (update run status from issue detail).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AIOI-01 | Issue detail page shows a lazy-loaded AIO test runs section (only when aioEnabled is true) | `useSettingsStore` aioEnabled gate confirmed; `useDelayedLoading` pattern confirmed in AioCycleDetailPage; separate `useQuery` pattern well-established |
| AIOI-02 | AIO test run section renders a step table (step / expected / actual columns, colored failure markers) | Step endpoint shape partially known (needs live probe for field names); `aioRunStatusBadgeClass` + chip pattern confirmed from Phase 53; table pattern confirmed from AioCycleDetailPage |
| AIOI-03 | AIO attachment images are fetched via authenticated HTTP client and open in the existing in-app lightbox | `ImageLightbox` (src/alt/open/onClose API confirmed); `AuthImage` (needsAuth on jiraBaseUrl prefix confirmed); pattern identical to `AttachmentThumbnail` + `AttachmentLightbox` in issue-detail/ |
</phase_requirements>

---

## Summary

Phase 54 adds a lazy-loaded "AIO Test Runs" section to `IssueDetailPage.tsx`. The section gates on `aioEnabled`, auto-loads a separate query in parallel with Jira data, and shows a step table for the latest active cycle's run(s) linked to the Jira issue key.

The service layer from Phases 51–53 is largely complete. Phase 54 needs two new service functions — one to find test cases by issue key and one to fetch step-level data — plus a new `AioTestRunsSection` component with its skeleton.

**The critical research gap is the step-level API endpoint (D-11).** The AIO REST API docs confirm a GET endpoint for individual test run detail (`/project/{projectKey}/testcycle/{cycleKey}/testrun/{testRunId}`) that returns step data, and the "Search Case" endpoint at `/project/{projectKey}/testcase` supports query parameters. However, the exact query parameter name for issue-key filtering, the step response field names (`action`, `expectedResult`, `actualResult`, step-level status), and the attachment object shape within a step all require live instance probe to confirm. These are flagged as LOW confidence and marked `[ASSUMED]` below.

**Primary recommendation:** Treat D-01 and D-11 as hard pre-work items. Before implementing `fetchAioTestCasesForIssue` and `fetchAioTestRunSteps`, the executor must probe the live AIO instance to confirm (a) query parameter name for testcase search by issue key, and (b) step field names from `GET /project/{projectKey}/testcycle/{cycleKey}/testrun/{testRunId}`. All other implementation decisions have HIGH confidence from existing codebase and Phase 51–53 probe findings.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AIO test case lookup by issue key | API / Backend (AIO TCMS) | Frontend (service module) | Data lives in AIO; service layer fetches and normalizes |
| Active cycle selection | Frontend (service/query) | — | Client-side filter on `fetchAioCycles` result; no AIO endpoint for "latest active" |
| Run-to-issue filtering | Frontend (service/query) | — | Client-side filter on `fetchAioTestRunsForCycle` result matching testCaseKey |
| Step data fetch | API / Backend (AIO TCMS) | Frontend (service module) | Step data lives in AIO per-run detail endpoint |
| Authenticated image render | Browser / Client | — | `AuthImage` fetches blob with Bearer PAT, creates object URL; no server involvement |
| Lightbox display | Browser / Client | — | Pure UI state, no data fetch |
| aioEnabled gate | Browser / Client | — | Zustand store read; prevents any AIO queries when disabled |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | already installed | `useQuery` for AIO section data | All async data fetching in this codebase uses TanStack Query |
| vitest | already installed | Unit tests for new service functions and section component | Project-standard test runner (`npm test` = `vitest run`) |
| @testing-library/react | already installed | Component tests for `AioTestRunsSection` | Project-standard component testing |

**Version verification:** All packages are already installed as project dependencies. No new npm installs required for Phase 54. [VERIFIED: existing package.json and node_modules]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | already installed | `FlaskConical` icon for section heading | Already in ICON_MAP (Phase 52) |
| @/lib/statusStyles | internal | `aioRunStatusBadgeClass` for step status chips | Reuse exactly — same status → CSS class mapping as Phase 53 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-thumbnail `ImageLightbox` state | Single shared lightbox with index | D-14 locks per-thumbnail independent lightbox — simpler, no adapter needed |
| Native `<details>` for collapsible | Headless UI Disclosure / Radix | `<details>` is sufficient, zero-dep, matches the spirit of SubtasksSection pattern |

## Architecture Patterns

### System Architecture Diagram

```
IssueDetailPage mount
        │
        ├── useQuery (Jira issue data) ─────────────────► Jira REST API
        │
        └── <AioTestRunsSection issueKey jiraBaseUrl />
                │
                ├─ if (!aioEnabled) → return null
                │
                └── useQuery ['aio', jiraBaseUrl, 'issue-steps', issueKey]
                        │
                        queryFn:
                        ├── 1. readSecret('jira-pat')
                        ├── 2. fetchAioTestCasesForIssue(baseUrl, token, projectKey, issueKey)
                        │       └── GET /project/{projectKey}/testcase?issueKey={issueKey}
                        │           returns AioPage<AioTestCase> → AioTestCase[]
                        │
                        ├── 3. if testCases.length === 0 → return [] (section hidden)
                        │
                        ├── 4. fetchAioCycles(baseUrl, token, projectKey)
                        │       └── GET /project/{projectKey}/testcycle (paginated)
                        │
                        ├── 5. pick latest active cycle
                        │       └── filter status === 'Active', sort by key descending
                        │
                        ├── 6. fetchAioTestRunsForCycle(baseUrl, token, projectKey, cycleKey)
                        │       └── GET /project/{projectKey}/testcycle/{cycleKey}/testrun (paginated)
                        │
                        ├── 7. filter runs where testCaseKey in testCaseKeys
                        │
                        └── 8. for each matched run → fetchAioTestRunSteps(baseUrl, token, projectKey, cycleKey, runId)
                                └── GET /project/{projectKey}/testcycle/{cycleKey}/testrun/{runId}
                                    returns step array inside run detail

                        ▼ data: AioIssueRunData[]
                        │
                        useDelayedLoading(isLoading, 200)
                        │
                        ├── skeleton → <AioTestRunsSkeleton />
                        ├── error   → (silent — section simply hidden)
                        ├── hidden  → no test cases (return null)
                        ├── empty   → test cases exist but no runs → EmptyState "No test runs in active cycle"
                        └── data    → single testCase: flat <StepTable />
                                      multiple testCases: collapsible blocks → each with <StepTable />
                                              │
                                              steps with attachments → inline thumbnails
                                              thumbnail click → <ImageLightbox src={attachmentUrl} />
                                                                      └── <AuthImage needsAuth={true} />
```

### Recommended Project Structure

```
taskflow/src/
├── services/aio/
│   ├── types.ts                    # Add AioTestCase, AioTestRunStep interfaces
│   ├── issue-steps.ts              # New: fetchAioTestCasesForIssue, fetchAioTestRunSteps
│   └── index.ts                    # Add issue-steps exports
│
└── routes/dashboard/
    └── issue-detail/
        ├── AioTestRunsSection.tsx  # New: main section component
        └── AioTestRunsSkeleton.tsx # New: skeleton component
```

### Pattern 1: useQuery with parallel loading (AIOI-01)

The AIO section query fires independently of the Jira issue query, same as all existing section queries. The section gates on `aioEnabled` before rendering (returns null) and before fetching (disabled condition).

```typescript
// Source: AioCycleDetailPage.tsx (existing pattern, adapted)
const aioQuery = useQuery({
  queryKey: ['aio', jiraBaseUrl, 'issue-steps', issueKey],
  queryFn: async () => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token || !jiraBaseUrl || !issueKey) return null;
    const projectKey = issueKey.split('-')[0];
    // ... fetch chain: test cases → active cycle → runs → steps
  },
  enabled: !!aioEnabled && !!issueKey && !!jiraBaseUrl,
  staleTime: 30_000,
});
const showSkeleton = useDelayedLoading(aioQuery.isLoading);
```

### Pattern 2: Latest active cycle selection (D-06)

```typescript
// Source: [ASSUMED] — derived from AioCycle type and D-06 decision
// AioCycle.key format confirmed by D-17 probe: "PROJ-CY-N"
function pickLatestActiveCycle(cycles: AioCycle[]): AioCycle | undefined {
  return cycles
    .filter((c) => c.status === 'Active')
    .sort((a, b) => b.key.localeCompare(a.key))  // string sort descending on key
    .at(0);
}
```

### Pattern 3: Status chip (AIOI-02)

Reuse `aioRunStatusBadgeClass` from `lib/statusStyles.ts` — already covers all four statuses. Same Tailwind class string as Phase 53.

```typescript
// Source: taskflow/src/lib/statusStyles.ts [VERIFIED: codebase read]
// AIO_RUN_BADGE_STYLES covers PASS / FAIL / BLOCKED / NOT_EXECUTED
<span className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioRunStatusBadgeClass(step.status)}`}>
  {normalizeStatusLabel(step.status)}
</span>
```

### Pattern 4: Authenticated thumbnail + ImageLightbox (AIOI-03)

```typescript
// Source: AttachmentThumbnail.tsx + ImageLightbox.tsx [VERIFIED: codebase read]
// Per D-14: one ImageLightbox state per thumbnail (independent)
const [lightboxOpen, setLightboxOpen] = useState(false);
// thumbnail:
<div role="button" tabIndex={0} className="h-12 w-auto ... cursor-pointer" onClick={() => setLightboxOpen(true)}>
  <AuthImage src={attachmentUrl} alt="step attachment" className="h-full w-auto object-contain" />
</div>
// lightbox:
<ImageLightbox src={attachmentUrl} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
```

`AuthImage` triggers `needsAuth` automatically when the URL starts with `jiraBaseUrl` — no modification needed. [VERIFIED: AuthImage.tsx line 23]

### Pattern 5: Collapsible run block (D-10, multiple test cases)

```typescript
// Source: [ASSUMED] — native <details> consistent with SubtasksSection spirit
// Per D-10: collapsed by default for PASS runs, expanded for FAIL/BLOCKED
<details open={run.status !== 'PASS'}>
  <summary className="flex items-center gap-2 cursor-pointer py-2">
    <FlaskConical className="size-4 text-muted-foreground" />
    <span>{run.testCase?.title ?? run.testCaseKey}</span>
    <span className={`... ${aioRunStatusBadgeClass(run.status)}`}>
      {normalizeStatusLabel(run.status)}
    </span>
  </summary>
  <StepTable steps={run.steps} />
</details>
```

### Pattern 6: Section structure in IssueDetailPage (D-16)

The section is placed inside the left-column scrollable `div`, below the `<ActivityTimeline>` block and above the sticky comment composer. Because the AIO section is self-contained with its own query, it is imported as `<AioTestRunsSection issueKey={issueKey} jiraBaseUrl={jiraBaseUrl!} />` — no props drilling from the page's Jira data needed.

### Anti-Patterns to Avoid

- **Blocking the Jira query on AIO data:** The AIO section uses its own `useQuery`. Never add AIO fetching inside the main issue `queryFn`.
- **Calling AIO when `aioEnabled = false`:** Always gate with `if (!aioEnabled) return null` at component top AND `enabled: !!aioEnabled` in the query config.
- **Fetching all cycles inline in the section queryFn without reusing `fetchAioCycles`:** `fetchAioCycles` already handles pagination. Call it directly; don't re-implement the pagination loop.
- **Using `AioPage<T>` without a guard for direct array responses:** `issue-runs.ts` shows both response shapes can occur. The step detail endpoint likely returns a flat structure (not paginated), but the testcase search endpoint likely uses `AioPage<AioTestCase>`.
- **Using the `source: 'aio'` apiFetch param:** `aioFetch` in `client.ts` already uses `apiFetch('aio', ...)`. Do not change this — it was set up this way intentionally (different from D-09 original plan).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authenticated image fetch | Custom fetch + headers in component | `AuthImage` (existing) | Handles blob URL lifecycle, cancellation, error state, redirect following |
| Lightbox overlay | Custom modal | `ImageLightbox` (existing) | Has keyboard (Escape), backdrop click, aria-modal |
| Status chip styling | Local color lookup | `aioRunStatusBadgeClass` from `lib/statusStyles` | Ensures visual consistency with Phase 53 cycle detail page |
| Pagination loop | Custom while loop | Pattern from `fetchAioCycles` / `fetchAioTestRunsForCycle` | Already handles `isLast`, `startAt`, array guard |
| Skeleton | `<div className="animate-pulse">` | `<Skeleton>` component + `AioCycleDetailSkeleton` pattern | Consistent with entire codebase skeleton pattern |
| Loading delay | Immediate skeleton on mount | `useDelayedLoading(isLoading, 200)` | 200ms threshold prevents flash on fast connections |

**Key insight:** Every UX sub-problem in Phase 54 already has a solution elsewhere in the codebase. Phase 54 is primarily a composition task, not a new-pattern task.

## Common Pitfalls

### Pitfall 1: Step endpoint shape unknown until live probe

**What goes wrong:** Executor assumes step fields are `action`, `expectedResult`, `actualResult` and writes a type with those names. The actual API returns different field names (e.g., `stepAction`, `expectedResult`, `actualResult`, `testRunStatus.name`).

**Why it happens:** The AIO REST API docs are not fully accessible via web fetch; exact step response schema is not publicly indexed.

**How to avoid:** Execute the live probe first: `curl -H "Authorization: Bearer $PAT" "$JIRA_URL/rest/aio-tcms-api/1.0/project/PROJ/testcycle/PROJ-CY-N/testrun/$RUN_ID" | jq .` — inspect the actual response before writing `AioTestRunStep` interface.

**Warning signs:** TypeScript errors on step field access, all step cells showing `—` or `undefined`.

### Pitfall 2: testcase?issueKey query param name wrong

**What goes wrong:** The endpoint `GET /project/{projectKey}/testcase` exists (D-17 confirmed), but the query parameter for filtering by Jira issue key might be `jiraIssueKey`, `linkedIssue`, or `issueId` rather than `issueKey`.

**Why it happens:** Different AIO versions use different param names. The endpoint was confirmed in D-17 as existing, but the exact filtering param was not probed.

**How to avoid:** Probe before implementing: `curl "$URL/project/PROJ/testcase?issueKey=PROJ-123"` and `curl "$URL/project/PROJ/testcase?jiraIssueKey=PROJ-123"` — check which returns non-empty results when the issue is linked.

**Warning signs:** `fetchAioTestCasesForIssue` always returns empty array for known-linked issues.

### Pitfall 3: Active cycle sort picking wrong cycle

**What goes wrong:** Multiple `Active` cycles exist. String sort on key picks `PROJ-CY-Adhoc` over `PROJ-CY-9` because `A` < `9` in ASCII, or picks `PROJ-CY-9` over `PROJ-CY-10` because `9` > `1`.

**Why it happens:** Simple `localeCompare` is not numeric-aware.

**How to avoid:** Extract the numeric suffix from the cycle key for comparison:
```typescript
// [ASSUMED] numeric suffix extraction
const cycleNum = (key: string) => {
  const m = key.match(/CY-(\d+)$/);
  return m ? parseInt(m[1], 10) : -1;   // Adhoc → -1 (lowest priority)
};
cycles.filter(c => c.status === 'Active').sort((a, b) => cycleNum(b.key) - cycleNum(a.key)).at(0);
```

**Warning signs:** Section shows runs from an older cycle when a newer one exists.

### Pitfall 4: Step attachment URLs not on jiraBaseUrl host

**What goes wrong:** Attachment URLs in step responses are not on the same Jira host (e.g., they point to a CDN or an internal AIO host). `AuthImage` `needsAuth` check (line 23: `src.startsWith(jiraBaseUrl)`) returns `false`, so images render without auth and fail.

**Why it happens:** AIO is a Jira plugin but may store attachments at a different sub-path or in Jira's attachment store.

**How to avoid:** During live probe of the step detail endpoint, inspect the attachment URL format. If it starts with `jiraBaseUrl`, `AuthImage` works as-is. If not, the attachment thumbnail will need a different approach.

**Warning signs:** Thumbnails show `[image not available]` error state.

### Pitfall 5: IssueDetailPage left column placement conflict

**What goes wrong:** The AIO section is placed inside the left column `<div>` (the scrollable `flex-1 overflow-auto` div) but the comment composer is `sticky bottom-0`. Adding the AIO section after `ActivityTimeline` but before the sticky composer works; adding it after the sticky div breaks layout.

**Why it happens:** The sticky composer is in the same scroll container. Placement must be within `px-6` wrapper.

**How to avoid:** Read `IssueDetailPage.tsx` lines 388–430. The AIO section goes between `</ActivityTimeline>` (line 424) and the `{(timelineFilter === ... && <div className="sticky...">` block.

## Code Examples

### New service function signatures (confirmed pattern from existing modules)

```typescript
// Source: taskflow/src/services/aio/issue-runs.ts + cycles.ts [VERIFIED: codebase read]
// New module: aio/issue-steps.ts

export async function fetchAioTestCasesForIssue(
  baseUrl: string,
  token: string,
  projectKey: string,
  issueKey: string,     // e.g. "PROJ-123"
): Promise<AioTestCase[]>
// Uses: GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcase?issueKey={issueKey}
// Returns: AioPage<AioTestCase> → AioTestCase[]
// NOTE: Query param name needs live probe confirmation [ASSUMED: 'issueKey']

export async function fetchAioTestRunSteps(
  baseUrl: string,
  token: string,
  projectKey: string,
  cycleKey: string,
  runId: string,        // Numeric string ID from AioTestRun.id
): Promise<AioTestRunStep[]>
// Uses: GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/testrun/{runId}
// Returns: step array embedded in run detail object — NOT paginated [ASSUMED]
// NOTE: Field names need live probe confirmation [ASSUMED]
```

### New types to add to types.ts

```typescript
// Source: [ASSUMED] — field names need live probe confirmation

export interface AioTestCase {
  id: number;             // AIO internal test case ID
  key: string;            // Test case key, e.g. "PROJ-TC-5"
  title: string;          // Test case display name
  projectKey?: string;    // Owning project key
}

export interface AioTestRunStep {
  id: number;                     // Step ID
  stepAction: string;             // Step description / action text [ASSUMED field name]
  expectedResult?: string;        // Expected result text [ASSUMED field name]
  actualResult?: string;          // Actual result text (for executed steps) [ASSUMED field name]
  status?: string;                // Step status: "PASS" | "FAIL" | "BLOCKED" | "NOT_EXECUTED" [ASSUMED field name]
  attachments?: AioStepAttachment[];
}

export interface AioStepAttachment {
  url?: string;           // Full URL to the attachment [ASSUMED field name]
  fileName?: string;      // Filename for alt text [ASSUMED field name]
}
```

### Query key convention (confirmed from CONTEXT.md)

```typescript
// Source: 54-CONTEXT.md D-05 [CITED]
queryKey: ['aio', jiraBaseUrl, 'issue-steps', issueKey]
```

### aioFetch source clarification

The existing `client.ts` calls `apiFetch('aio', ...)` — note this differs from D-09 in 51-CONTEXT which said `source: 'jira'`. The executed code uses `'aio'`. [VERIFIED: taskflow/src/services/aio/client.ts line 37]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GET /testrun?issueKey= (D-11 original) | Fetch by cycle, filter client-side | Phase 51 probe | Must fetch all runs for the active cycle, then filter by testCaseKey |
| Single AIO_API_PATH | Dual paths: AIO_PROJECTS_API_PATH + AIO_API_PATH | Phase 51 probe | testcase endpoint is under AIO_API_PATH (/rest/aio-tcms-api/1.0) |

**Deprecated/outdated:**
- `GET /testrun?issueKey=` — does NOT exist on this AIO instance (D-15, hard confirmed)
- Single AIO base path assumption — wrong, two paths required (D-13, hard confirmed)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `GET /project/{projectKey}/testcase?issueKey={issueKey}` — query param is named `issueKey` | Standard Stack, Code Examples | fetchAioTestCasesForIssue always returns [] for linked issues; executor must try alternative param names |
| A2 | Step data is embedded in run detail endpoint `GET /testrun/{runId}` (not a separate `/step` sub-path) | Architecture Patterns | Wrong URL → 404 on every step fetch |
| A3 | Step response fields are named `stepAction`, `expectedResult`, `actualResult`, `status` (or similar) | Code Examples, Types | TypeScript compilation errors; all step cells show undefined |
| A4 | Attachment objects in step response have a `url` field pointing to `jiraBaseUrl` host | Common Pitfalls | Thumbnails fail with `[image not available]`; may need different fetch strategy |
| A5 | String sort descending on cycle key (with numeric suffix extraction) correctly identifies "latest" active cycle | Architecture Patterns | Wrong cycle shown; runs for older cycle displayed |
| A6 | `testcase` search endpoint returns `AioPage<AioTestCase>` (paginated wrapper) | Code Examples | Without pagination loop, misses test cases beyond first page |

## Open Questions

1. **Step endpoint exact URL and field names (D-11)**
   - What we know: AIO docs confirm GET individual testrun detail exists at `/project/{projectKey}/testcycle/{cycleKey}/testrun/{testRunId}`. The web search confirmed this endpoint returns step-level data (including `comments` and `attachments` not available in bulk endpoints).
   - What's unclear: Whether steps are at `response.steps[]` or `response.testCase.steps[]`; exact field names for action/expected/actual/status within each step object.
   - Recommendation: Executor probes with `curl "$URL/testrun/$RUN_ID" | jq .` before writing `AioTestRunStep` interface. Plan must include this as a Wave 0 task.

2. **testcase?issueKey query parameter name (D-01)**
   - What we know: `GET /project/{projectKey}/testcase` endpoint is confirmed (D-17). The "Search Case" description in AIO docs confirms it supports filtering parameters.
   - What's unclear: Exact query parameter name — could be `issueKey`, `jiraIssueKey`, `linkedIssue`, or `issueId`.
   - Recommendation: Executor probes both `?issueKey=` and `?jiraIssueKey=` against a known-linked issue before implementing `fetchAioTestCasesForIssue`. Plan must include this as a Wave 0 task.

3. **AioTestCase field names (D-17)**
   - What we know: D-17 confirms `AioPage<AioTestCase>` wrapper. `types.ts` does NOT yet define `AioTestCase` (not written in Phase 51/52/53).
   - What's unclear: Whether the test case title field is `title`, `name`, or `summary`; whether `key` matches the PROJ-TC-N format from D-17.
   - Recommendation: Probe the testcase endpoint and inspect a response object. The `normalizeTestRun` function in `issue-runs.ts` already handles `raw.testCase?.title ?? raw.testCase?.name` — apply same defensive pattern.

## Environment Availability

Step 2.6: SKIPPED — Phase 54 is a pure code addition phase. No new external dependencies, runtimes, or CLI tools required beyond what is already installed. All AIO API calls use the existing `aioFetch` / `apiFetch` infrastructure. Node, npm, vitest, and the Tauri/Jira connection are already verified operational.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x + @testing-library/react |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm test -- --reporter=dot` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AIOI-01 | Section returns null when aioEnabled=false | unit | `npm test -- issue-steps` | Wave 0 |
| AIOI-01 | Section renders skeleton then data when aioEnabled=true | integration | `npm test -- AioTestRunsSection` | Wave 0 |
| AIOI-01 | Section hidden entirely when no AIO test cases linked | integration | `npm test -- AioTestRunsSection` | Wave 0 |
| AIOI-01 | Empty state shown when test cases linked but no cycle runs | integration | `npm test -- AioTestRunsSection` | Wave 0 |
| AIOI-02 | Step table renders Step/Expected/Actual/Status columns | integration | `npm test -- AioTestRunsSection` | Wave 0 |
| AIOI-02 | Status chip shows correct color class per status | unit | `npm test -- issue-steps` | Wave 0 |
| AIOI-02 | NOT_EXECUTED steps show `—` in Actual column | integration | `npm test -- AioTestRunsSection` | Wave 0 |
| AIOI-02 | Multiple test cases render collapsible blocks | integration | `npm test -- AioTestRunsSection` | Wave 0 |
| AIOI-03 | Thumbnail renders AuthImage with attachment URL | integration | `npm test -- AioTestRunsSection` | Wave 0 |
| AIOI-03 | Thumbnail click opens ImageLightbox with correct src | integration | `npm test -- AioTestRunsSection` | Wave 0 |

### Service unit tests (new module: issue-steps.ts)

| Test | Behavior |
|------|----------|
| fetchAioTestCasesForIssue — 200 | Returns AioTestCase[] from paginated response |
| fetchAioTestCasesForIssue — 200 empty | Returns [] |
| fetchAioTestCasesForIssue — 401 | Throws ApiError |
| fetchAioTestCasesForIssue — 404 | Returns [] |
| fetchAioTestRunSteps — 200 | Returns AioTestRunStep[] |
| fetchAioTestRunSteps — 404 | Returns [] |

### Sampling Rate

- **Per task commit:** `cd taskflow && npm test -- --reporter=dot`
- **Per wave merge:** `cd taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `taskflow/src/services/aio/issue-steps.test.ts` — covers fetchAioTestCasesForIssue and fetchAioTestRunSteps (REQ AIOI-01, AIOI-02)
- [ ] `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx` — covers section render, gating, empty states, step table, lightbox trigger (REQ AIOI-01, AIOI-02, AIOI-03)
- [ ] Live probe results for step field names and testcase issueKey param — must be documented as KEY DECISIONS before Wave 1

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Section reads existing token from Stronghold; no new auth flows |
| V3 Session Management | no | No new session state |
| V4 Access Control | no | aioEnabled gate is a feature flag, not an authorization boundary |
| V5 Input Validation | yes | issueKey from route params — already validated by Jira service; used as URL query param in AIO requests (URL-encode via template literal in fetch URL) |
| V6 Cryptography | no | PAT token handled by existing Stronghold / apiFetch infrastructure |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open blob URLs accumulating | Denial of Service | `AuthImage` already revokes blob URL on cleanup effect (line 63–66) — no change needed |
| AIO attachment URL pointing to attacker-controlled host | Spoofing | `AuthImage` sends Bearer token only when URL starts with jiraBaseUrl — external URLs render without auth headers |
| issueKey parameter injection into AIO URL | Tampering | issueKey comes from React Router params (controlled input); encode with `encodeURIComponent` in fetch URL construction |

## Sources

### Primary (HIGH confidence)

- Codebase: `taskflow/src/services/aio/` — all five modules read directly, types confirmed
- Codebase: `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` — chip pattern, query pattern, skeleton pattern confirmed
- Codebase: `taskflow/src/routes/dashboard/ImageLightbox.tsx` — props API (src, alt, open, onClose) confirmed
- Codebase: `taskflow/src/routes/dashboard/AuthImage.tsx` — needsAuth trigger (jiraBaseUrl prefix) confirmed
- Codebase: `taskflow/src/routes/dashboard/issue-detail/AttachmentThumbnail.tsx` — thumbnail pattern confirmed
- Codebase: `taskflow/src/lib/statusStyles.ts` — aioRunStatusBadgeClass covering all four status values confirmed
- Codebase: `taskflow/src/hooks/useDelayedLoading.ts` — 200ms threshold confirmed
- `.planning/phases/51-aio-service-layer/51-CONTEXT.md` — D-13–D-17 probe findings (dual base paths, auth, AioPage<T>, confirmed endpoints)
- `.planning/phases/54-aio-on-issue-detail/54-CONTEXT.md` — D-01 through D-16, all implementation decisions

### Secondary (MEDIUM confidence)

- [AIO Tests REST API Knowledge Base](https://aiosupport.atlassian.net/wiki/spaces/AioTests/pages/2025619567) — confirms GET individual testrun endpoint returns step data (comments/attachments); confirms "Search Case" filtering endpoint exists; web fetch returned truncated content, summary extracted via web search snippets
- [AIO Tests REST API forum post](https://tcms.aiojiraapps.com/forums/d/45-get-test-cycle-execution-api-missed-comments-attachments) — confirms bulk endpoints do NOT return attachments; step data is only in individual run detail endpoint

### Tertiary (LOW confidence)

- Step field names (`stepAction`, `expectedResult`, `actualResult`) — training knowledge + naming convention inference; NOT verified against live instance or current docs. All marked `[ASSUMED]`.
- testcase issueKey query parameter name — `issueKey` is the most likely name based on D-01 wording in CONTEXT.md, but not verified against live instance. Marked `[ASSUMED]`.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages already installed, confirmed from codebase
- Architecture/Lookup Flow: HIGH — confirmed from Phase 51 probe (D-15, D-17) and existing service modules
- Step endpoint URL: MEDIUM — endpoint pattern confirmed from AIO docs, but exact path segment (`.../testrun/{runId}` vs `.../testrun/{runId}/step`) needs live confirmation
- Step field names: LOW — no public docs accessible with exact field names; training knowledge only
- testcase issueKey param name: LOW — inferred from CONTEXT.md D-01 wording, not confirmed against live API

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (AIO API shape is stable; step field names once confirmed via probe become HIGH confidence)
