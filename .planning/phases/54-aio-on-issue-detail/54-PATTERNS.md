# Phase 54: AIO on Issue Detail - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 6 (new/modified files)
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/services/aio/types.ts` | model | — | `taskflow/src/services/aio/types.ts` (self — additive) | exact |
| `taskflow/src/services/aio/issue-steps.ts` | service | request-response | `taskflow/src/services/aio/issue-runs.ts` | exact |
| `taskflow/src/services/aio/index.ts` | config | — | `taskflow/src/services/aio/index.ts` (self — additive) | exact |
| `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx` | component | request-response | `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` | role-match |
| `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSkeleton.tsx` | component | — | `taskflow/src/routes/dashboard/AioCycleDetailSkeleton.tsx` | exact |
| `taskflow/src/routes/dashboard/IssueDetailPage.tsx` | component | request-response | `taskflow/src/routes/dashboard/IssueDetailPage.tsx` (self — additive) | exact |

---

## Pattern Assignments

### `taskflow/src/services/aio/types.ts` (model — additive)

**Analog:** `taskflow/src/services/aio/types.ts` (existing file to extend)

The file uses JSDoc-annotated `export interface` blocks with inline field-level comments noting probe-confidence level. Add the three new interfaces at the bottom of the file, matching the existing doc style.

**Existing interface pattern** (lines 18–68 — the full style template):
```typescript
/**
 * A single AIO test management project.
 * Returned by GET /rest/aio-tcms/1.0/project (direct array, not paginated — D-16).
 * Field names derived from AIO REST API docs and D-16 probe findings.
 */
export interface AioProject {
  id: number;           // AIO internal project ID
  projectKey: string;   // Jira project key (e.g. "PROJ")
  name: string;         // Project display name
}
```

**New interfaces to add** (append after line 68):
```typescript
/**
 * A single AIO test case linked to a Jira issue.
 * Returned via AioPage<AioTestCase> from GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcase?issueKey={issueKey}
 * NOTE: Field names are ASSUMED pending live probe — executor must confirm (see RESEARCH.md A1, A3).
 */
export interface AioTestCase {
  id: number;            // AIO internal test case ID
  key: string;           // Test case key, e.g. "PROJ-TC-5"
  title: string;         // Test case display name [ASSUMED: may be 'name' — probe before finalizing]
  projectKey?: string;   // Owning project key
}

/**
 * A single step within a test run.
 * Returned inside the run detail response from GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/testrun/{runId}
 * NOTE: All field names ASSUMED pending live probe — executor must confirm (see RESEARCH.md A2, A3).
 */
export interface AioTestRunStep {
  id: number;                        // Step ID
  stepAction: string;                // Step description / action text [ASSUMED field name]
  expectedResult?: string;           // Expected result text [ASSUMED field name]
  actualResult?: string;             // Actual result text for executed steps [ASSUMED field name]
  status?: string;                   // Step status: "PASS" | "FAIL" | "BLOCKED" | "NOT_EXECUTED" [ASSUMED field name]
  attachments?: AioStepAttachment[];
}

/**
 * A file attachment on a test run step.
 * NOTE: Shape is ASSUMED pending live probe — executor must confirm (see RESEARCH.md A4).
 */
export interface AioStepAttachment {
  url?: string;       // Full URL to the attachment [ASSUMED field name]
  fileName?: string;  // Filename for alt text [ASSUMED field name]
}
```

---

### `taskflow/src/services/aio/issue-steps.ts` (service, request-response)

**Analog:** `taskflow/src/services/aio/issue-runs.ts`

This is the closest possible analog: same module family, same function signature shape `(baseUrl, token, projectKey, ...)`, same `aioFetch` + `ApiError` pattern, same `AioPage<T>` pagination loop, same 401/404 handling convention.

**Imports pattern** (from `issue-runs.ts` lines 12–14):
```typescript
import { ApiError } from '../../lib/api-error';
import { aioFetch } from './client';
import type { AioPage, AioTestCase, AioTestRunStep } from './types';
```

**File-level JSDoc pattern** (from `issue-runs.ts` lines 1–10):
```typescript
/**
 * AIO TCMS test case and step operations scoped to a Jira issue key.
 *
 * Two functions:
 *   fetchAioTestCasesForIssue — looks up AIO test cases linked to a Jira issue key.
 *   fetchAioTestRunSteps      — fetches step-level data for a single test run.
 *
 * NOTE: Query param name for issueKey and step field names require live probe before
 * finalizing — see RESEARCH.md pitfalls 1 and 2.
 */
```

**Raw type + normalize pattern** (from `issue-runs.ts` lines 27–70 — the exact structure to mirror):
```typescript
// Raw type mirrors API response shape before normalization
type RawTestCase = {
  id?: number;
  key?: string;
  title?: string;
  name?: string;
  projectKey?: string;
};

function normalizeTestCase(raw: RawTestCase): AioTestCase {
  return {
    id: raw.id ?? 0,
    key: raw.key ?? '',
    title: raw.title ?? raw.name ?? '',  // defensive: same pattern as normalizeTestRun uses raw.testCase?.title ?? raw.testCase?.name
    projectKey: raw.projectKey,
  };
}
```

**Paginated fetch function pattern** (from `issue-runs.ts` lines 86–124 — copy this structure verbatim for `fetchAioTestCasesForIssue`):
```typescript
export async function fetchAioTestCasesForIssue(
  baseUrl: string,
  token: string,
  projectKey: string,
  issueKey: string,
): Promise<AioTestCase[]> {
  const basePath = `/project/${encodeURIComponent(projectKey)}/testcase`;
  const allCases: AioTestCase[] = [];
  let startAt = 0;

  for (;;) {
    // NOTE: query param name 'issueKey' is ASSUMED — probe before finalizing (RESEARCH.md Pitfall 2)
    const path = `${basePath}?issueKey=${encodeURIComponent(issueKey)}&startAt=${startAt}`;
    let response: Response;
    try {
      response = await aioFetch(baseUrl, token, path);
    } catch {
      throw new Error(`Cannot reach AIO at ${baseUrl}`);
    }
    if (response.ok) {
      const data = (await response.json()) as AioPage<RawTestCase> | RawTestCase[];
      // Guard: same array-vs-page guard as issue-runs.ts line 108
      if (Array.isArray(data)) {
        return data.map(normalizeTestCase);
      }
      allCases.push(...(data.items ?? []).map(normalizeTestCase));
      if (data.isLast) return allCases;
      startAt += data.maxResults;
      continue;
    }
    if (response.status === 401) {
      throw new ApiError('Invalid token or token has expired', 401, 'jira');
    }
    if (response.status === 404) {
      return []; // project not found or no test cases linked
    }
    throw new Error(`AIO request failed with status ${response.status}`);
  }
}
```

**Non-paginated fetch pattern** (for `fetchAioTestRunSteps` — derive from `fetchAioCycleDetail` in `cycles.ts` lines 89–112, which is the single-item non-paginated pattern):
```typescript
export async function fetchAioTestRunSteps(
  baseUrl: string,
  token: string,
  projectKey: string,
  cycleKey: string,
  runId: string,
): Promise<AioTestRunStep[]> {
  // NOTE: Step data endpoint shape (embedded vs. sub-path) needs live probe — RESEARCH.md Pitfall 1 / A2
  const path = `/project/${encodeURIComponent(projectKey)}/testcycle/${encodeURIComponent(cycleKey)}/testrun/${encodeURIComponent(runId)}`;
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path);
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    const data = (await response.json()) as { steps?: RawStep[] } | RawStep[];
    // Guard: step data may be embedded in run detail or a direct array
    if (Array.isArray(data)) return data.map(normalizeStep);
    return (data.steps ?? []).map(normalizeStep);
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    return []; // run not found
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}
```

---

### `taskflow/src/services/aio/index.ts` (config — additive)

**Analog:** `taskflow/src/services/aio/index.ts` (self)

**Current barrel** (lines 1–12 — full file):
```typescript
/**
 * AIO TCMS service submodules barrel export.
 *
 * client.ts is intentionally NOT exported — it is internal to aio/.
 * Domain modules (projects, issue-runs) import aioFetch directly from './client'.
 */

export * from './types';
export * from './projects';
export * from './issue-runs';
export * from './cycles';
```

**Addition pattern** — append one line after the last `export * from` line:
```typescript
export * from './issue-steps';
```

---

### `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx` (component, request-response)

**Analog:** `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx`

This is the primary structural analog for the entire section component. Key patterns extracted below.

**Imports pattern** (from `AioCycleDetailPage.tsx` lines 1–16 — adapt for section scope):
```typescript
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { aioRunStatusBadgeClass } from '@/lib/statusStyles';
import { fetchAioCycles, fetchAioTestCasesForIssue, fetchAioTestRunSteps, fetchAioTestRunsForCycle } from '@/services/aio';
import type { AioTestCase, AioTestRun, AioTestRunStep } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { AuthImage } from '../AuthImage';
import { ImageLightbox } from '../ImageLightbox';
import { AioTestRunsSkeleton } from './AioTestRunsSkeleton';
```

**aioEnabled gate** — top of component, before any hooks (from CONTEXT.md D-04, confirmed by settings store line 116):
```typescript
const aioEnabled = useSettingsStore((s) => s.aioEnabled);
if (!aioEnabled) return null;
```

**useQuery pattern** (from `AioCycleDetailPage.tsx` lines 66–78 — adapt query key and queryFn):
```typescript
const stepsQuery = useQuery({
  queryKey: ['aio', jiraBaseUrl, 'issue-steps', issueKey],
  queryFn: async (): Promise<AioIssueRunData[]> => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token || !jiraBaseUrl || !issueKey) return [];
    const projectKey = issueKey.split('-')[0];
    // Step 1: find test cases linked to this issue
    const testCases = await fetchAioTestCasesForIssue(jiraBaseUrl, token, projectKey, issueKey);
    if (testCases.length === 0) return [];
    // Step 2: find latest active cycle
    const cycles = await fetchAioCycles(jiraBaseUrl, token, projectKey);
    const activeCycle = pickLatestActiveCycle(cycles);
    if (!activeCycle) return [];
    // Step 3: fetch runs for that cycle
    const allRuns = await fetchAioTestRunsForCycle(jiraBaseUrl, token, projectKey, activeCycle.key);
    const testCaseKeys = new Set(testCases.map((tc) => tc.key));
    const matchedRuns = allRuns.filter((r) => testCaseKeys.has(r.testCaseKey));
    if (matchedRuns.length === 0) return [];
    // Step 4: fetch steps for each matched run
    return Promise.all(
      matchedRuns.map(async (run) => ({
        run,
        testCase: testCases.find((tc) => tc.key === run.testCaseKey),
        steps: await fetchAioTestRunSteps(jiraBaseUrl, token, projectKey, activeCycle.key, run.id),
      })),
    );
  },
  enabled: !!jiraBaseUrl && !!issueKey,
  staleTime: 30_000,
});
const showSkeleton = useDelayedLoading(stepsQuery.isLoading);
```

**Latest active cycle picker** (from RESEARCH.md Pitfall 3 — use numeric suffix extraction):
```typescript
function pickLatestActiveCycle(cycles: AioCycle[]) {
  const cycleNum = (key: string) => {
    const m = key.match(/CY-(\d+)$/);
    return m ? parseInt(m[1], 10) : -1;
  };
  return cycles
    .filter((c) => c.status === 'Active')
    .sort((a, b) => cycleNum(b.key) - cycleNum(a.key))
    .at(0);
}
```

**normalizeStatusLabel** (copy verbatim from `AioCycleDetailPage.tsx` lines 31–44):
```typescript
function normalizeStatusLabel(raw: string | undefined): string {
  switch ((raw ?? '').toUpperCase()) {
    case 'PASS':         return 'Pass';
    case 'FAIL':         return 'Fail';
    case 'BLOCKED':      return 'Blocked';
    case 'NOT_EXECUTED': return 'Not Run';
    default:             return raw ?? 'Not Run';
  }
}
```

**Status chip pattern** (from `AioCycleDetailPage.tsx` lines 308–313 — reuse exactly):
```typescript
<span
  className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioRunStatusBadgeClass(step.status ?? 'NOT_EXECUTED')}`}
>
  {normalizeStatusLabel(step.status)}
</span>
```

**Step table structure** (4-column; modeled on `AioCycleDetailPage.tsx` lines 286–325 run table, extended with Step/Expected/Actual columns per D-07):
```typescript
<table className="w-full text-sm">
  <thead className="border-b bg-muted/10">
    <tr>
      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Step</th>
      <th className="w-48 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Expected</th>
      <th className="w-48 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Actual</th>
      <th className="w-24 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Status</th>
    </tr>
  </thead>
  <tbody>
    {steps.map((step) => (
      <tr key={step.id} className="border-b border-border hover:bg-muted/30 transition-colors">
        <td className="px-4 py-3">{step.stepAction}</td>
        <td className="px-3 py-3">{step.expectedResult ?? '—'}</td>
        <td className="px-3 py-3">
          <div>{(step.status === 'NOT_EXECUTED' || !step.actualResult) ? '—' : step.actualResult}</div>
          {/* Thumbnails below actual text — D-12 */}
          {(step.attachments ?? []).length > 0 && (
            <div className="flex flex-row gap-1 mt-1 flex-wrap">
              {(step.attachments ?? []).map((att, idx) => (
                <StepThumbnail key={idx} url={att.url ?? ''} fileName={att.fileName ?? ''} />
              ))}
            </div>
          )}
        </td>
        <td className="px-3 py-3">
          {/* status chip */}
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**Step thumbnail + lightbox pattern** (from `AttachmentThumbnail.tsx` lines 9–31 + `ImageLightbox.tsx` — per D-14, one independent `useState` per thumbnail via a wrapper component):
```typescript
function StepThumbnail({ url, fileName }: { url: string; fileName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${fileName} - click to view full size`}
        className="h-12 w-auto rounded-md overflow-hidden bg-muted relative cursor-pointer"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
        }}
      >
        <AuthImage src={url} alt={fileName} className="h-full w-auto object-contain" />
      </div>
      <ImageLightbox src={url} alt={fileName} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
```

**Collapsible run block** (from `AttachmentsSection.tsx` lines 104–127 — chevron toggle pattern; adapted for multi-test-case grouping per D-10):
```typescript
function CollapsibleRunBlock({ run, testCase, steps }: AioIssueRunData) {
  const defaultOpen = run.status !== 'PASS';   // D-10: collapsed for PASS, expanded for FAIL/BLOCKED
  const [isExpanded, setIsExpanded] = useState(defaultOpen);
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={isExpanded
          ? `Collapse test run for ${testCase?.title ?? run.testCaseKey}`
          : `Expand test run for ${testCase?.title ?? run.testCaseKey}`}
        className="flex items-center gap-2 cursor-pointer min-h-[44px] px-4 py-2 hover:bg-muted/30 w-full text-left"
      >
        <ChevronIcon className="size-4" />
        <FlaskConical className="size-3.5 text-muted-foreground" />
        <span className="text-sm">{testCase?.title ?? run.testCaseKey}</span>
        {/* overall run status badge */}
        <span className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioRunStatusBadgeClass(run.status)}`}>
          {normalizeStatusLabel(run.status)}
        </span>
      </button>
      {isExpanded && <StepTable steps={steps} />}
    </div>
  );
}
```

**Section heading pattern** (from `AttachmentsSection.tsx` lines 113–127):
```typescript
<section aria-label="AIO Test Runs">
  <div className="flex items-center gap-1.5 text-sm font-semibold mb-2">
    <FlaskConical className="size-3.5 text-muted-foreground" />
    AIO Test Runs
  </div>
  {/* content */}
</section>
```

**EmptyState pattern** (from `AioCycleDetailPage.tsx` lines 277–280):
```typescript
<EmptyState
  icon={FlaskConical}
  title="No test runs in active cycle"
  subtitle="Test cases are linked but no runs have been recorded for the active cycle."
/>
```

**ErrorState pattern** (from `AioCycleDetailPage.tsx` lines 150–165):
```typescript
{stepsQuery.isError && (
  <div className="p-4">
    <ErrorState
      error={stepsQuery.error}
      onRetry={() => void queryClient.invalidateQueries({ queryKey: ['aio', jiraBaseUrl, 'issue-steps', issueKey] })}
      viewName="AIO test runs"
    />
  </div>
)}
```

**Render state waterfall** (from `AioCycleDetailPage.tsx` lines 149–346 — distilled for section use):
```typescript
if (!aioEnabled) return null;
// ...
if (showSkeleton || stepsQuery.isLoading) return <AioTestRunsSkeleton />;
if (stepsQuery.isError) return <ErrorState ... />;
const data = stepsQuery.data ?? [];
if (data.length === 0 && !stepsQuery.isLoading) {
  // distinguish: query returned [] due to no test cases → hide section entirely
  // (the queryFn already returns [] for both no-test-cases and no-runs cases;
  // planner decides whether to use a sentinel or separate query state to distinguish D-04 cases)
  return null;
}
// data render
```

---

### `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSkeleton.tsx` (component)

**Analog:** `taskflow/src/routes/dashboard/AioCycleDetailSkeleton.tsx`

Copy this file's structure almost verbatim — adapt to omit the progress bar row and filter chip row (those are cycle-detail-specific), keeping only the table skeleton rows suitable for a step table.

**Full analog** (`AioCycleDetailSkeleton.tsx` lines 1–18):
```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function AioCycleDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-2 w-full" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-6 w-16 rounded-full" />
        ))}
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
```

**Adapted skeleton for AioTestRunsSkeleton** (per UI-SPEC skeleton contract):
```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function AioTestRunsSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <Skeleton className="h-6 w-48" />       {/* section heading placeholder */}
      <Skeleton className="h-8 w-full" />      {/* table header row */}
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />  {/* step rows */}
      ))}
    </div>
  );
}
```

---

### `taskflow/src/routes/dashboard/IssueDetailPage.tsx` (component — additive)

**Analog:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx` (self — two-line addition)

**Integration point** (lines 424–431 — insert `<AioTestRunsSection>` between `</ActivityTimeline>` and the sticky comment composer `<div>`):

Current code at lines 424–431:
```typescript
              />

              {(timelineFilter === 'comment' || timelineFilter === 'all') && (
                <div className="sticky bottom-0 border-t py-3 -mx-6 px-6 bg-background">
                  <CommentComposer issueKey={issueKey} jiraBaseUrl={jiraBaseUrl!} />
                </div>
              )}
```

**Insertion** — add `<AioTestRunsSection>` immediately after the closing `/>` of `<ActivityTimeline>` and before the sticky comment div:
```typescript
              {/* AIO Test Runs section — lazy-loads in parallel; gated by aioEnabled inside component */}
              <AioTestRunsSection issueKey={issueKey} jiraBaseUrl={jiraBaseUrl!} />
```

**Import to add** at top of file (after existing imports, alongside other issue-detail section imports at lines 35–36):
```typescript
import { AioTestRunsSection } from './issue-detail/AioTestRunsSection';
```

---

## Shared Patterns

### Authentication / credential loading
**Source:** `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` lines 58–61 (token via readSecret) and `taskflow/src/routes/dashboard/IssueDetailPage.tsx` lines 77–80 (inline in queryFn)
**Apply to:** `AioTestRunsSection.tsx` queryFn

The section follows the `IssueDetailPage.tsx` pattern — `readSecret` called inline inside the `queryFn` (not in a `useEffect`), so the token is acquired fresh per query execution:
```typescript
queryFn: async () => {
  const token = await readSecret('jira-pat').catch(() => null);
  if (!token || !jiraBaseUrl) return [];
  // ...
},
```

### Error handling (ApiError + 404 → empty array)
**Source:** `taskflow/src/services/aio/issue-runs.ts` lines 99–123 and `taskflow/src/services/aio/cycles.ts` lines 50–71
**Apply to:** All functions in `issue-steps.ts`

The pattern is: `try { response = await aioFetch(...) } catch { throw new Error('Cannot reach AIO at ...') }`. Then `if (response.ok)` → process; `if (response.status === 401)` → throw `ApiError(..., 401, 'jira')`; `if (response.status === 404)` → return `[]`; else → throw generic Error.

### aioFetch usage
**Source:** `taskflow/src/services/aio/client.ts` lines 30–43
**Apply to:** `issue-steps.ts`

Import `aioFetch` directly from `'./client'` (not from the barrel). `aioFetch` defaults to `AIO_API_PATH` — correct for all testcase and testrun endpoints. Do NOT pass an explicit `apiPath` for these endpoints:
```typescript
import { aioFetch } from './client';
// usage:
response = await aioFetch(baseUrl, token, path);  // no 4th arg needed
```

### AioPage guard (paginated vs. direct array)
**Source:** `taskflow/src/services/aio/issue-runs.ts` lines 105–114
**Apply to:** `fetchAioTestCasesForIssue` in `issue-steps.ts`
```typescript
const data = (await response.json()) as AioPage<RawTestCase> | RawTestCase[];
if (Array.isArray(data)) {
  return data.map(normalizeTestCase);
}
allCases.push(...(data.items ?? []).map(normalizeTestCase));
if (data.isLast) return allCases;
startAt += data.maxResults;
```

### Status chip rendering
**Source:** `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` lines 308–313 + `taskflow/src/lib/statusStyles.ts` lines 42–51
**Apply to:** `AioTestRunsSection.tsx` step status cells and collapsible block headers

The `aioRunStatusBadgeClass()` function covers all four values (`PASS`, `FAIL`, `BLOCKED`, `NOT_EXECUTED`). The wrapping element is always:
```typescript
<span className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioRunStatusBadgeClass(status)}`}>
  {normalizeStatusLabel(status)}
</span>
```

### useDelayedLoading
**Source:** `taskflow/src/hooks/useDelayedLoading.ts` lines 11–28
**Apply to:** `AioTestRunsSection.tsx`
```typescript
const showSkeleton = useDelayedLoading(stepsQuery.isLoading);  // default 200ms threshold
```

### encodeURIComponent for URL path segments
**Source:** `taskflow/src/services/aio/cycles.ts` line 40 + `issue-runs.ts` line 92
**Apply to:** `issue-steps.ts` all path constructions

Always wrap dynamic path segments in `encodeURIComponent`:
```typescript
const path = `/project/${encodeURIComponent(projectKey)}/testcase?issueKey=${encodeURIComponent(issueKey)}&startAt=${startAt}`;
```

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `taskflow/src/services/aio/`, `taskflow/src/routes/dashboard/`, `taskflow/src/routes/dashboard/issue-detail/`, `taskflow/src/hooks/`, `taskflow/src/lib/`, `taskflow/src/stores/`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-05-13
