# Phase 91: Post-Release Merge-Back Verification - Pattern Map

**Mapped:** 2026-08-11
**Files analyzed:** 8 (2 new, 6 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts` (NEW) | utility (pure resolver module) | transform (discriminated-union resolution) | `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts` | exact |
| `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts` (NEW) | test | transform | `taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts` | exact |
| `taskflow/src/services/gitlab.ts` — `compareRefs` (MODIFY, new fn) | service | request-response (404/error-as-data) | `fetchBranch` (L1192) | exact |
| `taskflow/src/services/gitlab.ts` — `fetchSourceBranchMRs` (MODIFY, new fn) | service | CRUD (fully-paginated list read) | `fetchBranchTargetedMRs` (L1696) | exact (inverse param) |
| `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` (MODIFY) | hook | request-response (React Query orchestration) | same file — `gitlab-release-tags` query (L186-197) + `branchState` call site (L199-209) | exact |
| `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` (MODIFY) | component | request-response (presentational) | same file — `branchState.kind === 'released'` block (L253-266) | exact |
| `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` (MODIFY) | test | request-response | same file, existing `branch-status-released` assertions | exact |
| `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` (MODIFY) | test | request-response | same file, existing query-gating assertions | exact |
| `taskflow/src/services/gitlab.test.ts` (MODIFY) | test | request-response / CRUD | `fetchBranchTargetedMRs` describe block (L457+), `fetchBranch (D-13 404-as-missing)` describe block (L1914+) | exact |

## Pattern Assignments

### `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts` (NEW — utility, transform)

**Analog:** `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts` (React-free pure module)

**Module-header pattern** (lines 1-26) — copy the doc-comment convention that states the module is React-free and load-bearing rules are numbered against CONTEXT.md decisions:
```typescript
/**
 * Release branch derivation — pure version extraction, branch-name derivation,
 * git-ref validation, and branch-state resolution for the release detail page.
 *
 * React-free: every function here takes explicit parameters and returns plain
 * data — no closures over component state, no hooks, no store reads, no
 * service imports. This module exists so `useReleaseDetail.ts` and its
 * section components can call these as ordinary functions and so they are
 * unit-testable in isolation (see `releaseBranch.test.ts`).
 */
```
For `mergeBackVerification.ts`, restate this with references to 91-CONTEXT.md's D-01/D-02/D-04/D-09/D-11 instead of 88-CONTEXT's D-09/D-10/D-11.

**Discriminated-union + precedence pattern** (`BranchState` L92-104, `resolveBranchState` L137-192) — this is the direct template for `MergeBackVerdict` / `resolveMergeBackVerdict`:
```typescript
export type BranchState =
  | { kind: 'blocked-no-milestone' }
  | { kind: 'unresolvable' }
  | { kind: 'invalid-ref'; branchName: string }
  | { kind: 'check-failed'; branchName: string }
  | { kind: 'loading'; branchName: string }
  | { kind: 'exists'; branchName: string }
  | { kind: 'released'; branchName: string; tagName: string | null }
  | { kind: 'missing'; branchName: string };

export function resolveBranchState(params: {
  hasMatchedMilestone: boolean;
  milestoneTitle: string | null | undefined;
  branchExists: boolean | undefined;
  branchCheckFailed?: boolean;
  versionReleased?: boolean;
  releaseTagName?: string | null;
}): BranchState {
  const { hasMatchedMilestone, milestoneTitle, branchExists, branchCheckFailed, versionReleased, releaseTagName } = params;

  if (!hasMatchedMilestone) {
    return { kind: 'blocked-no-milestone' };
  }
  const branchName = deriveReleaseBranchName(milestoneTitle);
  if (!branchName) {
    return { kind: 'unresolvable' };
  }
  if (!isValidGitRefName(branchName)) {
    return { kind: 'invalid-ref', branchName };
  }
  // CR-03: must stay above the undefined -> loading fallback, because an
  // errored query also leaves `branchExists` undefined.
  if (branchCheckFailed) {
    return { kind: 'check-failed', branchName };
  }
  if (branchExists === undefined) {
    return { kind: 'loading', branchName };
  }
  if (branchExists) {
    return { kind: 'exists', branchName };
  }
  if (versionReleased) {
    return { kind: 'released', branchName, tagName: releaseTagName ?? null };
  }
  return { kind: 'missing', branchName };
}
```

**Apply this shape to `resolveMergeBackVerdict`** with the precedence order fixed by D-01/D-02/D-09/D-11 plus RESEARCH's Open Question #2 (add a `loading` kind — the UI-SPEC explicitly requires a loading treatment matching `branchState.kind === 'loading'`, so `MergeBackVerdict` needs 6 kinds, not 4: `hidden`, `loading`, `couldnt-verify`, `merged`, `likely-not-merged`, and — per RESEARCH Open Question #1 — consider whether `merged` needs a `via: 'tracking-mr' | 'content-compare'` discriminant so the tooltip text can differ):
1. `!releasedVersion || !hasMatchedMilestone` → `hidden` (D-11)
2. still loading (either query in flight, no merged MR ruled out and no compare result yet) → `loading`
3. `mergedMR` found (`state === 'merged'`, D-02: the ONLY positive MR signal) → `merged` (via tracking-mr)
4. `tagName === null` (no tag to fall back to, D-01) → `couldnt-verify` (reason: no-mr-no-tag)
5. either channel's check failed → `couldnt-verify` (reason: check-failed)
6. `compareResult.timedOut` (D-04: an incomplete diff must never read as "no diff") → `couldnt-verify`
7. `compareResult.diffCount === 0` → `merged` (via content-compare)
8. else → `likely-not-merged`

**`findReleaseTag` reuse** (L117-121) — do not reimplement tag matching; import directly from `releaseBranch.ts`:
```typescript
export function findReleaseTag(tags: readonly string[], version: string | null): string | null {
  if (!version) return null;
  const target = version.toLowerCase();
  return tags.find((t) => t.toLowerCase().replace(/^v/, '') === target) ?? null;
}
```

---

### `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts` (NEW — test)

**Analog:** `taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts`

**Harness pattern** (lines 1-41) — plain Vitest `describe`/`it`, one `describe` block per exported function, table-style assertions with a comment tying each case to a decision ID:
```typescript
import { describe, expect, it } from 'vitest';
import type { BranchState } from './releaseBranch';
import {
  deriveReleaseBranchName,
  extractVersionFromMilestoneTitle,
  isValidGitRefName,
  findReleaseTag,
  resolveBranchState,
} from './releaseBranch';

describe('extractVersionFromMilestoneTitle', () => {
  it('extracts the version component from a real-format title', () => {
    expect(extractVersionFromMilestoneTitle('33.5.0 (21.07.2026)')).toBe('33.5.0');
  });
  // ... one it() per behavior, referencing D-xx in the description where relevant
});
```
Mirror this exactly for `resolveMergeBackVerdict`: one `describe('resolveMergeBackVerdict', ...)` block, with `it()` titles naming the CONTEXT.md decision each case pins down (per RESEARCH's Phase Requirements → Test Map: MERGE-02's precedence table maps 1:1 to `it()` cases — merged-MR-precedence, closed-MR-falls-through/D-02, no-MR-no-tag/D-01, empty-diff/D-04, non-empty-diff, compare_timeout/D-04, hidden/D-11).

---

### `taskflow/src/services/gitlab.ts` — `compareRefs` (MODIFY, new function)

**Analog:** `fetchBranch` (L1192-1229) — the 404-as-data / non-2xx-as-data template

```typescript
export async function fetchBranch(
  baseUrl: string,
  token: string,
  projectId: number,
  branchName: string,
): Promise<{ exists: boolean }> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/api/v4/projects/${projectId}/repository/branches/${encodeURIComponent(branchName)}`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
      'Load Release Branch',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  // D-13: 404 means the branch doesn't exist yet — not an error condition.
  if (response.status === 404) return { exists: false };

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to check release branch', response.status, 'gitlab');
    }
    throw new Error(`Failed to check release branch: status ${response.status}`);
  }

  return { exists: true };
}
```

**Apply to `compareRefs`:** same try/catch-unreachable, same 401/403 → `ApiError`, but per RESEARCH Pattern 2 the undocumented-ref-not-found behavior should be handled by treating **any** non-2xx as data the caller can react to (`compareCheckFailed: true`), not a hard 404 special-case like `fetchBranch` — because A1 in the Assumptions Log is unverified. Follow `fetchProject`'s `GitLabProject` interface style (L33-39) for the new `GitLabCompareResult` interface, and the `diffs.length === 0` / `compare_timeout` mapping locked by RESEARCH Pattern 1/D-04 (never `compare_same_ref`).

**Reference — `fetchProject`** (L235-270) for the plain single-request GET pattern (no pagination) that `compareRefs` also follows structurally:
```typescript
export async function fetchProject(
  baseUrl: string,
  token: string,
  projectId: number,
): Promise<GitLabProject> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/api/v4/projects/${projectId}`;
  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
      'Load Project',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  if (response.status === 401 || response.status === 403) {
    throw new ApiError('Failed to fetch project', response.status, 'gitlab');
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch project: status ${response.status}`);
  }
  const data = await response.json();
  return data as GitLabProject;
}
```

---

### `taskflow/src/services/gitlab.ts` — `fetchSourceBranchMRs` (MODIFY, new function)

**Analog:** `fetchBranchTargetedMRs` (L1696-1792) — the FULLY-PAGINATED list-fetch template. **This is the load-bearing pagination pattern the task description flags** — copy the `while (true)` loop verbatim, swap `target_branch=` for `source_branch=`, and DROP the label-enrichment block (RESEARCH: "the verdict row never renders MR labels... would be dead code and an unnecessary extra `/labels` API call"):

```typescript
export async function fetchBranchTargetedMRs(
  baseUrl: string,
  token: string,
  projectId: number,
  targetBranch: string,
): Promise<GitLabMR[]> {
  const base = baseUrl.replace(/\/$/, '');
  const perPage = 100;
  let page = 1;
  const allMRs: GitLabMR[] = [];

  while (true) {
    const url = `${base}/api/v4/projects/${projectId}/merge_requests?target_branch=${encodeURIComponent(targetBranch)}&state=all&per_page=${perPage}&page=${page}`;

    let response: Response;
    try {
      response = await apiFetch(
        'gitlab',
        url,
        { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
        'Load Branch-Targeted MRs',
      );
    } catch {
      throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ApiError('Failed to fetch branch-targeted MRs', response.status, 'gitlab');
      }
      throw new Error(`Failed to fetch branch-targeted MRs: status ${response.status}`);
    }

    const data = (await response.json()) as GitLabMR[];
    allMRs.push(...data);

    if (data.length < perPage) break;
    page++;
  }

  // (fetchBranchTargetedMRs enriches labels here — DO NOT copy this block
  //  into fetchSourceBranchMRs; the merge-back row never renders labels.)

  return allMRs;
}
```

**No page cap** — unlike `searchProjectTags`'s bounded `maxPages = 20` (L360-362) or the Channel A fetcher's `MR_MAX_PAGES = 500` (L1812), `fetchBranchTargetedMRs` (and thus `fetchSourceBranchMRs`) has NO cap; a release branch has at most a handful of tracking MRs so this is safe, and RESEARCH Assumption A3 confirms full pagination is correct regardless of volume — this is the exact "fetch-once page-cap trap" the task description calls out, and the fix is: **do not add a page cap or a client-side filter over a single page**.

---

### `taskflow/src/services/gitlab.ts` — supporting types

**`GitLabMR` interface** (L425-451) — reused as-is for `fetchSourceBranchMRs`'s return type; the merge-back resolver reads `state`, `iid`, `web_url` off it (per RESEARCH's `mergedMR` lookup: `trackingMRs?.find((mr) => mr.state === 'merged')`). `merged_at` is NOT on `GitLabMR` (only on `GitLabMRDetail`, L459-471) — flag for the planner: D-10's tooltip needs a merge date, so either fetch `GitLabMRDetail` for the matched MR or use the tag's `commit.created_at` (`GitLabTag`, L419-423) as the date source; do not assume `merged_at` exists on the list-endpoint MR object.

**`flattenGitLabError`** (L1056-1089) — this phase's new functions are read-only GET calls, so error-body flattening is lower-priority than in P90's write-path callers, but if `compareRefs`/`fetchSourceBranchMRs` need to surface a structured GitLab error message anywhere (vs. the generic `status ${response.status}` fallback already used by every sibling fetcher above), reuse this helper rather than re-deriving message-shape handling:
```typescript
export function flattenGitLabError(body: unknown): string | undefined {
  if (body === null || typeof body !== 'object') return undefined;
  const message = (body as { message?: unknown }).message;
  if (message === undefined || message === null) return undefined;
  let flat: string | undefined;
  if (typeof message === 'string') {
    flat = message;
  } else if (Array.isArray(message)) {
    flat = message.join(', ');
  } else if (typeof message === 'object') {
    flat = Object.entries(message as Record<string, unknown>)
      .map(([field, errs]) => {
        const detail = Array.isArray(errs) ? errs.join(', ') : typeof errs === 'string' ? errs : JSON.stringify(errs);
        return `${field} ${detail}`;
      })
      .join('; ');
  }
  return flat !== undefined && flat.length > 0 ? flat : undefined;
}
```

---

### `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` (MODIFY)

**Analog (existing gated tag query):** `gitlab-release-tags` query (L186-197):
```typescript
const { data: releaseTags } = useQuery({
  queryKey: ['gitlab-release-tags', activeGitlabProject, matchedVersionNumber],
  queryFn: () =>
    searchProjectTags(
      gitlabBaseUrl ?? '',
      gitlabToken ?? '',
      activeGitlabProject ?? 0,
      matchedVersionNumber ?? '',
    ),
  enabled: !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && needsTagLookup,
  staleTime: 5 * 60_000,
});
```
Use this exact shape for the two new queries (`gitlab-mrs-source` / `fetchSourceBranchMRs`, `gitlab-compare` / `compareRefs`) — same header comment convention explaining WHY the `enabled` gate is what it is (see L174-185's comment block on `needsTagLookup`/CR-03), same `staleTime: 5 * 60_000`, same `gitlabBaseUrl ?? ''` / `gitlabToken ?? ''` / `activeGitlabProject ?? 0` argument-fallback convention (never `?? 0` into a URL without the `enabled` guard covering it — WR-10).

**Widen `needsTagLookup`** (currently L183-184):
```typescript
const needsTagLookup =
  releasedVersion && branchResult?.exists === false && !!matchedVersionNumber;
```
Per RESEARCH Pitfall 4, drop the `branchResult?.exists === false` clause: `releasedVersion && !!matchedVersionNumber` — D-01's fallback needs the tag whenever a version is released, independent of branch-existence state.

**Call-site pattern (resolver invocation):** `resolveBranchState` call (L199-209):
```typescript
const branchState = resolveBranchState({
  hasMatchedMilestone: matchedMilestone !== null,
  milestoneTitle: matchedMilestone?.title ?? null,
  branchExists: branchResult?.exists,
  branchCheckFailed,
  versionReleased: releasedVersion,
  releaseTagName: findReleaseTag(
    (releaseTags ?? []).map((t) => t.name),
    matchedVersionNumber,
  ),
});
```
Mirror this for `resolveMergeBackVerdict(...)` — explicit named params built from already-resolved hook state, never live query objects passed through.

**CR-03 error-vs-loading distinction** (comment at L174-179) — apply the same reasoning to the two new queries' `isError` flags:
```typescript
// CR-03: `fetchBranch` throws on 401/403/500/timeout, so without this signal a
// failed check is indistinguishable from in-flight (`branchExists === undefined`
// covers both) and pins the UI at 'Loading…' forever with no retry.
```

**Imports block** (L1-46) — add `compareRefs`, `fetchSourceBranchMRs` to the `@/services/gitlab` import list (alphabetized, matching the existing style), and `mergeBackVerification`'s exports to a new import line alongside the `./releaseBranch` import (L30-35).

---

### `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` (MODIFY)

**Analog — the `released` branch-row block to soften (D-08), lines 253-266:**
```tsx
) : branchState.kind === 'released' ? (
  <span
    className="inline-flex items-center gap-1 text-muted-foreground text-xs"
    title={
      branchState.tagName
        ? `${branchState.branchName} was merged and deleted; tagged ${branchState.tagName}`
        : `${branchState.branchName} was merged and deleted. No matching tag found — tags are an incomplete record, so this is not evidence the release did not ship.`
    }
    data-testid="branch-status-released"
  >
    <Check className="size-3 shrink-0" />
    Released
    {branchState.tagName && <span className="font-mono">{branchState.tagName}</span>}
  </span>
) : (
```
**Required change (D-08):** remove the word "merged" and the `Check` (green-implying) affirmative framing from this block's title text — it must state only "branch absent" + "tag exists/doesn't", per UI-SPEC's locked replacement suggestion: `{branch} deleted · tagged {tag}` (or equivalent). Keep `data-testid="branch-status-released"` unchanged (tests key off it).

**Analog for the new "Merged back" row — the sibling `check-failed` block (L229-242) for the icon+text+title inline-element shape, and the `exists` block (L245-252) for icon+colored-text-only shape:**
```tsx
) : branchState.kind === 'check-failed' ? (
  <span className="inline-flex items-center gap-2">
    <span
      className="inline-flex items-center gap-1 text-orange-600 text-xs dark:text-orange-400"
      title={`Couldn't check ${branchState.branchName}`}
      data-testid="branch-status-check-failed"
    >
      <AlertTriangle className="size-3 shrink-0" />
      Couldn't check
    </span>
    <RowAction icon={RefreshCw} onClick={onRetryBranchCheck}>
      Retry
    </RowAction>
  </span>
) : branchState.kind === 'loading' ? (
  <span className="text-muted-foreground text-xs">Loading...</span>
) : branchState.kind === 'exists' ? (
  <span
    className="inline-flex items-center gap-1 text-green-600 dark:text-green-400"
    data-testid="branch-status-exists"
  >
    <GitBranch className="size-3 shrink-0" />
    <span className="font-mono text-xs">{branchState.branchName}</span>
  </span>
```
**Apply this exact icon+text+`title`-tooltip shape to the new row** (per UI-SPEC): `Check`/green for `merged`, `AlertTriangle`/orange for `likely-not-merged`, no icon-color emphasis (`text-muted-foreground`) for `couldnt-verify`, and the bare `Loading...` span (no icon) for `loading` — UI-SPEC explicitly names this loading pattern to copy. All icons `size-3` (12px), matching every row in this file. **No `RowAction` on the new row** — UI-SPEC/D-12/D-13 forbid any button/interactive control next to it (unlike `check-failed`'s `Retry` button, which must NOT be copied here).

**`MetaRow` placement** — insert a new `<MetaRow label="Merged back">...</MetaRow>` immediately after the closing `</MetaRow>` of "Release Branch" (currently ends L276) and before "MR Labels" (L278), per D-07/UI-SPEC. Conditionally render the whole `MetaRow` (or return nothing) when the verdict is `hidden` — matching the existing conditional-render convention already used for the "MRs"/"Issues"/"Story points" rows (L325, L349, L373), which wrap the entire `MetaRow` in a JSX `&&` guard rather than rendering a dead `—`:
```tsx
{gitlabMatch.type !== 'none' && milestoneMRsLoaded && hasMrs && (
  <MetaRow label="MRs">
    ...
  </MetaRow>
)}
```

**Props threading** — new props (`mergeBackVerdict: MergeBackVerdict`) go into `ReleaseDetailSidebarProps` (L58-82) alongside the existing `branchState: BranchState; defaultBranch: string | null;` props (L69), following the same "props-driven, no internal state" pattern (P87 D-08).

---

## Shared Patterns

### `apiFetch('gitlab', …)` convention
**Source:** every fetcher in `services/gitlab.ts` (e.g. `fetchProject` L245-255, `fetchBranch` L1203-1213, `fetchBranchTargetedMRs` L1712-1719)
**Apply to:** `compareRefs`, `fetchSourceBranchMRs`
```typescript
let response: Response;
try {
  response = await apiFetch(
    'gitlab',
    url,
    { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
    'Load Release Branch', // <- distinct, human-readable operation label per call site
  );
} catch {
  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}
```
Every new call needs its own distinct label string (e.g. `'Compare Release Tag'`, `'Load Tracking MR'`) — this label is what redacted devtools instrumentation displays (P87 D-12a), never reuse another function's label.

### Error contract: 401/403 → `ApiError`, other non-2xx → generic `Error`
**Source:** `fetchBranch` L1221-1226, `fetchBranchTargetedMRs` L1724-1729, `fetchProject` L260-266 — identical shape in every fetcher:
```typescript
if (!response.ok) {
  if (response.status === 401 || response.status === 403) {
    throw new ApiError('Failed to <verb noun>', response.status, 'gitlab');
  }
  throw new Error(`Failed to <verb noun>: status ${response.status}`);
}
```
Apply verbatim to both new functions, substituting the operation description.

### Fully-paginated list fetch (the pattern this phase must get right)
**Source:** `fetchBranchTargetedMRs` (L1696-1792), `fetchProjectBranches` (L284-331) — unbounded `while(true)` loop, `per_page=100`, break when `data.length < perPage`, NEVER a single capped page + client filter. This is the exact fix for the "fetch-once page-cap pitfall" recorded in project memory (recurring bug class). `fetchSourceBranchMRs` MUST follow this, not `searchProjectTags`'s bounded-`maxPages` variant (that bound exists because tag search has no natural cardinality limit tied to a single branch; a source-branch MR list does).

### `?? 0` / `?? ''` project-id guard (WR-10)
**Source:** every query in `useReleaseDetail.ts` (e.g. L162-172, L189-197) — the fallback literal is only safe because `enabled` independently gates on `!!activeGitlabProject`/`!!gitlabToken`/`!!gitlabBaseUrl`; the fallback itself must never be trusted as a real value. Apply the same pairing (fallback + independent `enabled` guard) to the two new queries, never a bare `?? 0` without the matching `enabled` check.

### React Compiler — no manual memoization
**Source:** whole `release-detail/` folder; the sole exception is `useReleaseDetail.ts:317` (a deliberate query-key-stability `useMemo`, not a precedent). Do not add `useMemo`/`useCallback`/`React.memo` anywhere in `mergeBackVerification.ts`, `useReleaseDetail.ts`'s new code, or `ReleaseDetailSidebar.tsx`'s new row.

## No Analog Found

None — every file in this phase's scope has a strong (exact) in-repo analog; this is a narrow phase extending an already-established four-layer pattern (service fetcher → pure resolver → hook query → presentational row) with three prior phases (88/89/90) as precedent.

## Metadata

**Analog search scope:** `taskflow/src/routes/dashboard/release-detail/`, `taskflow/src/services/gitlab.ts`, corresponding `*.test.ts(x)` files
**Files scanned:** `releaseBranch.ts`, `releaseBranch.test.ts`, `MetaRow.tsx`, `useReleaseDetail.ts` (L1-260 read directly; remainder covered by CONTEXT.md's line-numbered references), `ReleaseDetailSidebar.tsx` (full file), `gitlab.ts` (targeted reads: L1-40, L235-420, L425-490, L1040-1120, L1192-1260, L1696-1815), `gitlab.test.ts` (targeted: describe-block index + `fetchBranchTargetedMRs` fixture at L457-506)
**Pattern extraction date:** 2026-08-11
