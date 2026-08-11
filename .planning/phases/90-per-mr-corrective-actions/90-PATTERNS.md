# Phase 90: Per-MR Corrective Actions - Pattern Map

**Mapped:** 2026-08-11
**Files analyzed:** 3 (all modified in place, no new files)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `taskflow/src/services/gitlab.ts` (+ `updateMergeRequest`, + `flattenGitLabError`) | service | request-response (write) | `createBranch` (L1106-1157) for error-shape widening; `updateMilestone` (L997-1036) for the PUT+URL shape | exact (role+flow), needs widening (error typing) |
| `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` (+ 2 mutations, + held-sort ref) | service/hook | CRUD (optimistic write) | `createBranchMutation` (L215-241) / `createMilestoneMutation` (L268-290) for invalidation shape; `useFieldMutation.ts` (whole file) for the true optimistic onMutate/rollback shape | role-match (mutation shape) + exact (optimistic pattern from a different file) |
| `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx` (`DriftMarkCell` → stateful per-row `DriftActionCell`) | component | event-driven (per-row interactive cell) | `DriftMarkCell` itself (L54-78, same file — being extended) for the glyph/testid shape; `PinnedTabStrip.tsx` `dragState`/`didDragRef` (L65-125) for the "component-local ref surviving re-renders, gates a class of interaction" idiom (closest analog for D-08's sticky-local-state requirement; no true analog for a per-row mutation-owning subcomponent exists yet) | role-match (cell), no exact analog for the mutation-per-row-subcomponent structure (confirmed by RESEARCH.md) |

## Pattern Assignments

### `taskflow/src/services/gitlab.ts` — `updateMergeRequest` + `flattenGitLabError` (service, request-response)

**Analogs:** `updateMilestone` (L997-1036) for URL/PUT shape; `createBranch` (L1106-1157) for the widened error-body handling this phase must extend further.

**PUT shape to copy** (`updateMilestone`, gitlab.ts:997-1023):
```typescript
export async function updateMilestone(
  baseUrl: string,
  token: string,
  projectId: number,
  milestoneId: number,
  fields: { title?: string; description?: string },
): Promise<GitLabMilestone> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/milestones/${milestoneId}`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        method: 'PUT',
        headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      },
      'Update Milestone',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  // ... see error handling below
}
```

**Error handling to copy, then widen** (`createBranch`, gitlab.ts:1135-1156 — this is the pattern to extend, NOT `updateMilestone`'s narrower `{ message?: string }` typing):
```typescript
if (!response.ok) {
  // Widened vs. updateMilestone's narrower typing (Pitfall 3): GitLab's
  // validation errors commonly arrive as message: string[] (e.g. duplicate
  // branch), which would render as [object Object] if left un-joined.
  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
  if (response.status === 401 || response.status === 403) {
    throw new ApiError(msg ?? 'Failed to create branch', response.status, 'gitlab');
  }
  throw new Error(`Failed to create branch: ${msg ?? `status ${response.status}`}`);
}
return (await response.json()) as { name: string; web_url: string };
```

**D-10 requires a THIRD shape** (`Record<string, string[]>`, field-keyed) that neither analog handles. This is genuinely new code, not a copy — write a shared `flattenGitLabError(body: unknown): string | undefined` (see RESEARCH.md Pattern 1 for the exact three-branch implementation: string → return as-is; array → `.join(', ')`; object → `Object.entries(...).map(([field, errs]) => \`${field} ${errs.join(', ')}\`).join('; ')`). Call this helper from `updateMergeRequest`'s error branch instead of inlining another ad-hoc widening (the RESEARCH.md "Don't Hand-Roll" table flags that `updateMilestone`/`createBranch`/`createMilestone` each independently reinvented a slightly-wider `message` type — do not add a fourth reinvention).

**No dual-file gotcha:** unlike the `jira.ts` legacy dual-file situation (`jira.ts` vs `jira/` modules, all imports still point at the flat file), `gitlab.ts` is a single flat file (2403 lines) with one corresponding `gitlab.test.ts`. There is no `gitlab/` directory. Point the planner only at `taskflow/src/services/gitlab.ts` — no ambiguity to resolve here.

**Test pattern to extend** (`gitlab.test.ts:1991-2090`, `describe('createBranch', ...)` block) — copy this shape for a new `describe('updateMergeRequest', ...)` block: mock `mockFetch` to resolve `{ ok, status, json }`, assert on `calledOptions.method`/`JSON.parse(calledOptions.body)`, and add one `it` per error shape (string, array, and the new field-keyed object) asserting the flattened message text, plus the existing 401/403 → `ApiError` `toMatchObject({ status, source: 'gitlab' })` assertions.

---

### `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` — two new mutations + held-sort ref (service/hook, CRUD/optimistic)

**Analog for invalidation shape (NOT optimism):** `createBranchMutation` (L215-241) / `createMilestoneMutation` (L268-290).

**Imports pattern** (useReleaseDetail.ts:1-42) — path-alias-free relative imports for same-directory modules, `@/` alias for services/stores:
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  createBranch,
  createMilestone,
  // ... add: updateMergeRequest,
} from '@/services/gitlab';
```

**Existing mutation shape to copy the SKELETON of, but NOT the optimism** (useReleaseDetail.ts:215-241):
```typescript
const createBranchMutation = useMutation({
  mutationFn: () => {
    // WR-10: `?? 0` would POST to an unintended project — instead fail loudly.
    if (!activeGitlabProject || !gitlabBaseUrl || !gitlabToken) {
      throw new Error('GitLab project not configured');
    }
    if (!releaseBranchName || !defaultBranch) {
      throw new Error('Branch name or default branch unavailable');
    }
    return createBranch(gitlabBaseUrl, gitlabToken, activeGitlabProject, releaseBranchName, defaultBranch);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['gitlab-branch', activeGitlabProject, releaseBranchName] });
    queryClient.invalidateQueries({ queryKey: ['gitlab-release-branches', activeGitlabProject] });
  },
});
```
This mutation has **no `onMutate`/`onError`/rollback at all** (P88 chose no-optimism, no-notification per D-15) — it is only useful here for the `mutationFn` guard-clause idiom (WR-10: never `?? 0`/`?? -1` into a write URL) and the `onSuccess` invalidation call shape. Do **not** copy its lack of optimism forward — P90 D-06/MRFIX-01/02 require optimistic writes.

**Analog for the ACTUAL optimistic onMutate/rollback shape:** `useFieldMutation.ts` (whole file, 92 lines) — this is the one true `onMutate` → `setQueryData` → `onError` rollback → `onSettled` invalidate precedent in the codebase:
```typescript
// useFieldMutation.ts:20-49
return useMutation({
  mutationFn: async ({ fieldName, value }) => { /* ... */ },
  onMutate: async ({ fieldName, value }) => {
    await queryClient.cancelQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
    const previous = queryClient.getQueryData<JiraIssueDetail>(['jira-issue-detail', issueKey, jiraBaseUrl]);
    queryClient.setQueryData<JiraIssueDetail>(['jira-issue-detail', issueKey, jiraBaseUrl], (old) => {
      if (!old) return old;
      return { ...old, fields: { ...old.fields, [fieldName]: value } };
    });
    return { previous };
  },
  onError: (_err, _vars, context) => {
    if (context?.previous) {
      queryClient.setQueryData(['jira-issue-detail', issueKey, jiraBaseUrl], context.previous);
    }
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
    // ... prefix-family invalidations for downstream consumers
  },
});
```
**Deviation this phase must introduce (not present in this analog):** `useFieldMutation` snapshots/patches a SINGLE query via singular `setQueryData`/`getQueryData` on one exact key. P90 must instead use **plural** `queryClient.setQueriesData({ queryKey: [prefix, projectId] }, updater)` / `queryClient.getQueriesData({ queryKey: [prefix, projectId] })` across THREE prefix-scoped channel keys (`gitlab-all-project-mrs`, `gitlab-milestone-mrs`, `gitlab-branch-mrs`), because the exact windowed suffixes are not known at the mutation site (see CR-02 note below). This plural form is not yet used anywhere in the codebase — RESEARCH.md Pattern 3 has the full worked example; treat `useFieldMutation` as the onMutate/onError/onSettled *skeleton* and RESEARCH.md Pattern 3 as the *cache-API* to plug into that skeleton.

**The three channel query keys to invalidate/patch** (useReleaseDetail.ts:352, 367, 385 — copy these key literals exactly, project-granular, never the windowed form):
```typescript
// L352
queryKey: ['gitlab-all-project-mrs', activeGitlabProject, channelAUpdatedAfter],
// L367
queryKey: ['gitlab-milestone-mrs', activeGitlabProject, gitlabMatch.candidateName],
// L385
queryKey: ['gitlab-branch-mrs', activeGitlabProject, releaseBranchName],
```
D-13 invalidation/patch target is the **two-element prefix** `[name, activeGitlabProject]` for each, per the CR-02 lesson documented in-file at L258-267 (`createMilestoneMutation`'s comment block) — read that comment verbatim before writing the new invalidation calls; it is the canonical statement of "prefix, never windowed key" in this exact file.

**Held-sort-order (D-11) — no existing analog for the exact freeze pattern**, but the closest idiom in the codebase for "a ref that gates behavior across renders without a memo" is `PinnedTabStrip.tsx`'s `dragState`/`didDragRef` (component-local `useRef`, mutated imperatively, read at render/handler time, never relied on for React's own re-render decision). Use the RESEARCH.md Pitfall 3 shape:
```typescript
const orderRef = useRef<number[] | null>(null);
if (orderRef.current === null) orderRef.current = rows.map((r) => r.mr.id);
```
This must be a `useRef`/state snapshot, **not** a `useMemo`, per CONTEXT.md's React Compiler note (a memo is not a stability guarantee under the compiler).

**Test pattern to extend** (`useReleaseDetail.test.tsx`) — mirrors the existing "Test A/B" structure at L127-148 (`invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')`, assert `.mock.calls` filtered by `key[0] === 'gitlab-...'` and `key.length <= 2`). The file already mocks `@/services/gitlab` with `vi.mock(..., async (importOriginal) => ({...}))` (L24-38) — add `updateMergeRequest: vi.fn()` to that mock object for the two new mutation tests.

---

### `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx` — `DriftMarkCell` → `DriftActionCell` (component, event-driven)

**Analog:** the existing `DriftMarkCell` in this same file (L54-78) — extend in place, do not rewrite the file's structure around it.

**Current glyph-only cell to extend** (MrDriftSection.tsx:54-78):
```typescript
function DriftMarkCell({
  mark,
  testId,
  title,
}: {
  mark: DriftMark;
  testId: string;
  title?: string;
}) {
  return (
    <span
      data-testid={testId}
      title={title}
      className="flex-none w-[28px] flex items-center justify-center"
    >
      {mark === 'ok' ? (
        <Check className="size-3.5 text-green-600 dark:text-green-400" />
      ) : mark === 'flag' ? (
        <AlertTriangle className="size-3.5 text-orange-600 dark:text-orange-400" />
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      )}
    </span>
  );
}
```
Preserve: the `data-testid` values (`drift-br`/`drift-ms`/`drift-task` are asserted by `MrDriftSection.test.tsx`), the `flex-none w-[28px] flex items-center justify-center` sizing (P89 D-20 — narrow flex cells collapse to 0 in this app's WebKit/Tauri webview; do not let the swap to a `<button>` drop the explicit px width), and the glyph color classes (`text-green-600 dark:text-green-400` for success, `text-orange-600 dark:text-orange-400` for the flagged/inert state).

**Row-hover / cell-hover / focus-visible reveal (D-02/D-04)** — no existing analog in this file; the row `<div>` already exists at L163-167 (`className="flex items-center gap-2 text-sm py-1 border-b border-border/50"`) and is the element to add a `group` class to, with the action icon using `opacity-0 group-hover:opacity-100 focus-visible:opacity-100` (Tailwind `group`/`group-hover` — check `Card primitive gotchas` memory and existing `group`/`group-hover` usage elsewhere in the app, e.g. hover-reveal affordances noted in project memory "Hover affordance, no layout shift" — the icon must be laid out inside the 28px cell already, not added beside it, so it never shifts width).

**No true analog for a per-row mutation-owning subcomponent** — confirmed by RESEARCH.md's own Anti-Patterns section: every existing `useMutation` call in this codebase (`createBranchMutation`, `createMilestoneMutation`, `useFieldMutation`) is a single shared instance, adequate for one dialog but wrong here because up to N rows' BR/MS cells must be independently, concurrently pending (D-09). This is new architecture, not a copy job. Structure: extract a `DriftActionCell` function component (rendered inside the `.map()` in place of the current inline `<DriftMarkCell mark={row.br} testId="drift-br" />` calls at L238-240), owning:
- its own `useMutation` instance (calling `updateMergeRequest` via a prop-passed `mutate` closure or a hook imported from `useReleaseDetail.ts` — the planner should decide whether the mutation is created inside `DriftActionCell` itself (needs `queryClient`, `gitlabBaseUrl`, `gitlabToken`, `activeGitlabProject` all passed down as props since `MrDriftSection` is presentational/props-driven per P87 D-08) or exposed as a factory from the hook)
- local `useState<'idle' | 'pending' | 'error'>` + `useState<string | null>` for D-08's sticky failure state (see RESEARCH.md Pattern 3 in full for the exact `onMutate`/`onError`/`onSuccess` wiring against this local state — it is the definitive worked example, more complete than anything extractable from the existing codebase)

**Test pattern to extend** (`MrDriftSection.test.tsx`, full file read — 200 lines): the existing `makeMR`/`makeRow`/`renderSection` helpers (L15-61) are the fixture builders to reuse unchanged for all new test cases. The file already tests glyph state via `screen.getByTestId('drift-br').querySelector('svg')` (L82-83) and text content via `toHaveTextContent('—')` (L90) — new pending/success/failure/unavailable-state tests should follow this exact `getByTestId('drift-br')` + `querySelector`/`toHaveTextContent`/`toHaveAttribute('title', ...)` idiom. `vi.mock('@tauri-apps/plugin-opener', ...)` (L11-13) is already in place and unaffected. For independent-concurrency (MRFIX-03) and sticky-failure-survives-refetch (D-08) tests, this file will need a `QueryClientProvider` wrapper it does not currently have (it currently renders `MrDriftSection` with no query context at all, since it's presentational) — if `DriftActionCell`'s mutation lives inside `MrDriftSection`, borrow the `QueryClientProvider`/`makeWrapper` pattern from `useReleaseDetail.test.tsx:69-73` rather than inventing a new harness.

## Shared Patterns

### GitLab write + error handling
**Source:** `taskflow/src/services/gitlab.ts` — `createBranch` (L1106-1157), `createMilestone` (L1171+), `updateMilestone` (L997-1036)
**Apply to:** `updateMergeRequest` (new)
```typescript
// Universal shape: apiFetch('gitlab', url, { method, headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' }, body }, '<Action Label>')
// wrapped in try/catch -> `Cannot reach ${baseUrl} — check the base URL` on network failure;
// !response.ok -> flatten body.message (string | string[] | Record<string,string[]> for this phase) ->
// 401/403 -> ApiError(msg, status, 'gitlab'); else -> Error(`Failed to <verb>: ${msg ?? status}`)
```
All GitLab calls go through `apiFetch('gitlab', …)` — 15s timeout, disconnect-marking on 401, redacted devtools instrumentation (`PRIVATE-TOKEN` → `[REDACTED]`). Raw `fetch` is a defect; `updateMergeRequest` must not bypass this.

### Optimistic mutation (onMutate/onError-rollback/onSettled-invalidate)
**Source:** `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts` (full file)
**Apply to:** both new mutations in `useReleaseDetail.ts`
```typescript
onMutate: async (vars) => {
  await queryClient.cancelQueries({ queryKey: [...] });
  const previous = queryClient.getQueryData([...]);   // or getQueriesData for prefix form
  queryClient.setQueryData([...], (old) => ({ ...old, /* patched field */ }));
  return { previous };
},
onError: (_err, _vars, context) => {
  if (context?.previous) queryClient.setQueryData([...], context.previous);
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: [...] });
},
```
**Deviation required this phase:** use plural `setQueriesData`/`getQueriesData` with a two-element prefix (`[name, projectId]`) instead of the singular exact-key form shown above, because three separately-windowed caches must all be patched and the mutation site does not know their exact suffixes. See RESEARCH.md Pattern 3 for the full three-cache worked example.

### Project-granular invalidation (CR-02 lesson)
**Source:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:258-267` (comment on `createMilestoneMutation`)
**Apply to:** `onSettled` of both new mutations — invalidate `['gitlab-all-project-mrs', activeGitlabProject]`, `['gitlab-milestone-mrs', activeGitlabProject]`, `['gitlab-branch-mrs', activeGitlabProject]` (two-element prefix only, never appending `channelAUpdatedAfter`/`gitlabMatch.candidateName`/`releaseBranchName`).

### Never `?? 0` / `?? -1` a write target (WR-10)
**Source:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:217-224` (`createBranchMutation`'s guard clauses)
**Apply to:** both new `mutationFn`s — throw a plain `Error` before calling `updateMergeRequest` if `activeGitlabProject`, `gitlabBaseUrl`, `gitlabToken`, `mr.iid`, `releaseBranchName` (BR action), or `matchedMilestone` (MS action) is falsy. Never substitute `0`/`-1` into the URL.

### 28px fixed-width interactive cell (P89 D-20)
**Source:** `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx:64-68` (`DriftMarkCell`'s `className`)
**Apply to:** `DriftActionCell`'s root element — keep `flex-none w-[28px] flex items-center justify-center` verbatim; only the child content and `onClick`/`tabIndex` behavior change, per the memory-recorded "Virtualized table 0-width column" gotcha (narrow columns collapse to 0 in this codebase's WebKit/Tauri webview without explicit px sizing).

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Per-row `useMutation` instance keyed by `(mr.id, action)` | component (mutation-owning subcomponent) | event-driven, concurrent | Every existing `useMutation` in this codebase (`createBranchMutation`, `createMilestoneMutation`, `useFieldMutation`) is a single shared instance adequate for one dialog/one issue at a time — none handle N independent concurrent list-row mutations. RESEARCH.md's own Anti-Patterns section confirms this gap explicitly and provides the full worked pattern (Pattern 3) as the closest thing to ground truth; treat that RESEARCH.md section as authoritative since no codebase precedent exists. |
| `setQueriesData`/`getQueriesData` (plural, prefix-match cache patch) | service/hook | CRUD (multi-cache optimistic patch) | Not used anywhere in the codebase yet (confirmed via RESEARCH.md's "State of the Art" table) — every existing optimistic write uses singular `setQueryData`/`getQueryData` against one exact key. RESEARCH.md Pattern 3 is the reference implementation. |

## Metadata

**Analog search scope:** `taskflow/src/services/gitlab.ts`, `taskflow/src/services/gitlab.test.ts`, `taskflow/src/routes/dashboard/release-detail/*.ts(x)`, `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts`, `taskflow/src/routes/dashboard/StatusPopover.tsx` (checked, not used — no mutation of its own, delegates to a field-mutation hook elsewhere), `taskflow/src/components/app/PinnedTabStrip.tsx` (checked for ref-gate idiom)
**Files scanned:** 9 read/grepped directly; ~2403+479+256+92+200+345 lines of primary source read across targeted ranges
**Pattern extraction date:** 2026-08-11
