---
phase: 90-per-mr-corrective-actions
reviewed: 2026-08-11T15:20:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - taskflow/src/services/gitlab.ts
  - taskflow/src/services/gitlab.test.ts
  - taskflow/src/routes/dashboard/release-detail/useMrFixMutation.ts
  - taskflow/src/routes/dashboard/release-detail/useMrFixMutation.test.tsx
  - taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx
  - taskflow/src/routes/dashboard/release-detail/MrDriftSection.test.tsx
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
findings:
  critical: 1
  warning: 9
  info: 3
  total: 13
status: issues_found
---

# Phase 90: Code Review Report

**Reviewed:** 2026-08-11T15:20:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Scope reviewed: the phase's own additions — `flattenGitLabError` + `updateMergeRequest`
(`gitlab.ts:1038-1145`), the new `useMrFixMutation` hook, `DriftActionCell`/`applyHeldOrder`
in `MrDriftSection.tsx`, the `fix` prop threading in `ReleaseDetailPage.tsx`, and the three
test files. Pre-existing code elsewhere in `gitlab.ts` / `ReleaseDetailPage.tsx` was not
treated as phase findings.

Verification performed during review: `npx tsc --noEmit` is clean; the three touched test
files pass (186 tests). Both explicit threat-model items were checked directly:

- **T-90-01 (Tampering) — PASSES.** `updateMergeRequest` builds its PUT body by explicit
  per-key assignment (`gitlab.ts:1109-1111`); there is no spread and no `JSON.stringify(fields)`.
  A runtime `state_event`/`assignee_id` key is dropped, and a test proves it.
- **T-90-02 (Info Disclosure) — PASSES at the transport layer.** The thrown messages
  compose only from `flattenGitLabError(body)` or fixed literals; `apiFetch` redacts
  `PRIVATE-TOKEN` before logging (`lib/apiFetch.ts:83-90`). One doc-vs-behavior contradiction
  remains (WR-04): the network-failure path *does* embed `baseUrl`, which the function's own
  doc comment claims never happens.
- **`flattenGitLabError` `[object Object]` claim — PARTIAL.** Holds for the three documented
  shapes; breaks for a nested-object field value (WR-02), and returns an empty string rather
  than `undefined` for `{ message: {} }` / `{ message: [] }`, defeating the status-code
  fallback (WR-01).
- **Optimistic multi-cache rollback — FAILS.** The rollback restores whole cached arrays from
  a pre-patch snapshot, so it demonstrably reverts a *different* in-flight cell's already
  successful optimistic patch. This is CR-01, reproduced with a throwaway test (deleted after
  verification): after MS succeeded and BR was then rejected, `milestone` in the cache went
  from `{id:55,title:'M'}` back to `null`. This is exactly the "must not leak state across
  (MR, action) pairs" property the plan claims.

## Critical Issues

### CR-01: Rollback restores whole cache arrays and silently reverts another cell's successful write

**File:** `taskflow/src/routes/dashboard/release-detail/useMrFixMutation.ts:72-100`, `178-186`
**Issue:** `patchMrInChannelCaches` snapshots the *entire* `GitLabMR[]` for every matching
query key, and `restoreMrChannelCaches` writes those whole arrays back on failure. Any write
that landed in the cache between snapshot time and rollback time is destroyed — including a
different action on the same MR (BR vs MS, which the design explicitly requires to be
independent, D-09/MRFIX-03) and any other MR's row.

Reproduced (scratch test, since removed): fire BR (retarget, kept pending), then fire MS
(assign-milestone, resolves), then reject BR. The `gitlab-all-project-mrs` cache entry showed
`milestone = {id:55,title:'M'}` after MS succeeded and `milestone = null` after BR's rollback —
the MS cell's green check reverts to an orange flag even though its PUT succeeded. The
`onSettled` invalidate only masks this after a full network round-trip (and the drift caches
carry `staleTime: 5 * 60_000`, so the user sees the wrong state for the duration of the
refetch, or indefinitely if the refetch fails).

The existing "independent" tests do not catch this because they never assert the *cache*
contents after a mixed success/failure pair — only the two hooks' `status` values.

**Fix:** roll back the single field this mutation owns, on the current cache, instead of
restoring whole snapshots:

```ts
// onMutate — capture only the field this action changes
const previous: Partial<GitLabMR> =
  action === 'retarget' ? { target_branch: mr.target_branch } : { milestone: mr.milestone };
patchMrInChannelCaches(queryClient, projectId, mr.id, patch);
return { previous };

// onError — re-apply the inverse patch; other cells' patches survive
onError: (err, _vars, context) => {
  if (context?.previous && projectId) {
    patchMrInChannelCaches(queryClient, projectId, mr.id, context.previous);
  }
  ...
}
```

Keep `restoreMrChannelCaches` only if some caller genuinely needs whole-array restore; if not,
delete it (and its test) rather than leaving a footgun exported.

## Warnings

### WR-01: `flattenGitLabError` returns `''` (not `undefined`) for an empty message, defeating the status-code fallback

**File:** `taskflow/src/services/gitlab.ts:1060-1065`, consumed at `1139` and `1141`
**Issue:** `{ message: [] }` → `[].join(', ')` → `''`; `{ message: {} }` → `Object.entries({})`
→ `''`. `''` is not nullish, so `msg ?? \`status ${response.status}\`` does **not** fall back:
the user gets `"Failed to update merge request: "` with nothing after the colon, and a 401/403
produces `new ApiError('', 401, 'gitlab')` — an error with an empty message that
`useMrFixMutation` then renders as the cell's tooltip/`aria-label`. The doc contract
("returns … `undefined` when no `message` key exists") is violated for a present-but-empty
message.
**Fix:**
```ts
const flat = /* ...existing branches... */;
return flat.length > 0 ? flat : undefined;
```

### WR-02: `flattenGitLabError` still yields `[object Object]` for a nested field value

**File:** `taskflow/src/services/gitlab.ts:1063`
**Issue:** `String(errs)` is used whenever a field's value is not an array. GitLab's
Rails-standard shape is `{field: string[]}`, but a nested object (`{message:{target_branch:{base:['x']}}}`)
falls into `String({})` → `"target_branch [object Object]"` — the exact failure mode the
helper's doc block says it exists to prevent. The `never returns [object Object]` test only
covers the four happy shapes.
**Fix:**
```ts
.map(([field, errs]) => {
  const detail = Array.isArray(errs)
    ? errs.join(', ')
    : typeof errs === 'string'
      ? errs
      : JSON.stringify(errs);
  return `${field} ${detail}`;
})
```
and add a nested-object case to the `[object Object]` test.

### WR-03: `onMutate`'s project guard does not do what its comment claims, and contains dead code

**File:** `taskflow/src/routes/dashboard/release-detail/useMrFixMutation.ts:168-173`
**Issue:** The comment says "Guard the patch on a non-null projectId so the optimistic path
cannot run against project 0 (WR-10)". `if (projectId === null || projectId === undefined)`
does **not** exclude `0` — a `projectId` of `0` passes and the caches under `['<prefix>', 0]`
get patched, while `mutationFn`'s `!projectId` check throws. `=== undefined` is also dead: the
declared prop type is `number | null`. The same file then uses the *other* convention two
functions down (`onSettled: if (projectId)` at line 194), so 0 patches but never invalidates —
the one combination that would strand an optimistic patch.
**Fix:** use one convention throughout: `if (!projectId) return undefined;` in `onMutate`, and
delete the stale comment.

### WR-04: `updateMergeRequest`'s security doc claims it never emits the request URL — the network path does

**File:** `taskflow/src/services/gitlab.ts:1085-1087` (claim) vs `1132` (behavior)
**Issue:** The T-90-02 doc block states error messages carry "never the token, `PRIVATE-TOKEN`
header, or request URL", but the unreachable-host branch throws
`` `Cannot reach ${baseUrl} — check the base URL` ``. `baseUrl` is a self-hosted GitLab host
name that this hook surfaces in a DOM `title`/`aria-label` attribute. The only test asserting
`not.toContain(BASE)` exercises the 403 path, so the contradiction is invisible to the suite.
**Fix:** either narrow the doc claim to "never the token or the full API path (the configured
base URL may appear in the reachability message)", or drop the interpolation
(`'Cannot reach GitLab — check the base URL'`) and add the assertion to the network-failure test.

### WR-05: Pending state destroys keyboard focus and failures are never announced

**File:** `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx:171-193`
**Issue:** Activating the cell with the keyboard replaces the `<button>` with a `<span>`
spinner, so focus falls to `document.body`; the user cannot tab back to the same cell without
re-traversing the row, and if the write fails the (new) error `<button>` never receives focus.
Nothing is announced either — the failure lives only in a `title`/`aria-label` on an element
the user is no longer focused on, and there is no `aria-live` region (a test explicitly
asserts `queryByRole('alert')` is null).
**Fix:** keep the element a `<button disabled aria-busy="true">` while pending so the focus
ring survives the state change, and add `role="status"`/`aria-live="polite"` text (visually
hidden) inside the cell for the error message.

### WR-06: Channel query-key literals are duplicated, so a rename silently disables every optimistic patch

**File:** `taskflow/src/routes/dashboard/release-detail/useMrFixMutation.ts:53-57` vs
`useReleaseDetail.ts:352,367,385`
**Issue:** `MR_CHANNEL_QUERY_PREFIXES` re-declares three string literals that are written
inline at the query sites. Nothing links them at the type level; if a key is renamed in
`useReleaseDetail.ts`, `getQueriesData`/`setQueriesData` match nothing, the optimistic patch
becomes a silent no-op, and no test fails — both test files hard-code the same literals
independently. This is the same class of hidden coupling the file's own header calls out as
"the CR-02 bug class".
**Fix:** export key factories from one module and use them in both places:
```ts
export const mrChannelKeys = {
  allProject: (p: number, w: string) => ['gitlab-all-project-mrs', p, w] as const,
  prefixes: (p: number) => MR_CHANNEL_QUERY_PREFIXES.map((k) => [k, p] as const),
};
```

### WR-07: `patchMrInChannelCaches` accepts `Partial<GitLabMR>` and will write `undefined` over required fields

**File:** `taskflow/src/routes/dashboard/release-detail/useMrFixMutation.ts:76`, `83`
**Issue:** `{ ...m, ...patch }` copies keys that are *present with an `undefined` value*, so a
caller passing `{ target_branch: undefined }` erases a non-optional field of `GitLabMR` in the
cache; downstream `evaluateBranchDrift` then compares `undefined !== releaseBranchName` and
flags every row. This is not hypothetical — `useReleaseDetail.test.tsx` already calls the
helper with `target_branch: releaseBranchName ?? undefined`; it only survives because the
value happens to be non-null in that test.
**Fix:** narrow the parameter to the two fields this feature owns and reject undefined:
```ts
type MrFixPatch = { target_branch: string } | { milestone: GitLabMR['milestone'] };
```
or strip undefined entries before spreading.

### WR-08: The error cell offers a retry that cannot succeed, and overrides an already-correct cell

**File:** `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx:179-193`
**Issue:** The `status === 'error'` branch is evaluated before both `actionable` and
`mark === 'ok'`. Consequences: (a) if the prerequisite disappeared (release branch deleted,
GitLab token cleared), the red cell is still a live button whose retry is guaranteed to throw
`'GitLab project not configured'` / `'Release branch unavailable'` — the inert-cell
explanation at line 212-222 is unreachable once an error has occurred; (b) if a background
refetch shows the field is now correct (fixed in GitLab directly, or by the other user), the
cell keeps rendering a red "click to retry" affordance over a row that is already `ok`, and
the only way out is to fire another write.
**Fix:** gate the error branch on `actionable` for the button form (fall back to a
non-interactive red glyph with the error as `title` when not actionable), and clear `status`
when `mark` transitions to `'ok'`.

### WR-09: The D-11 held row order is not reset per release and leaks across navigations

**File:** `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx:261-265`,
`ReleaseDetailPage.tsx:251-267`
**Issue:** `orderRef` is captured on the first non-empty render and only re-created on
unmount. The route is `/release/:versionId` (`routes.tsx:46`) with no `key`, so navigating to a
*cached* release (breadcrumb/back, where `version` is already in the query cache and the
skeleton branch at `ReleaseDetailPage.tsx:213` is skipped) reuses the same `MrDriftSection`
instance. The held ids then belong to the previous release: shared MRs jump to the top, all
other rows fall into the `rest` bucket, and the freeze the requirement asks for is silently
inoperative for the new release.
**Fix:** thread the release identity in and reset on change — `<MrDriftSection key={versionId} …>`
at the call site, or `if (heldForVersion.current !== versionId) { orderRef.current = null; }`.

## Info

### IN-01: The authoritative MR returned by `updateMergeRequest` is discarded

**File:** `taskflow/src/routes/dashboard/release-detail/useMrFixMutation.ts:187-192`
**Issue:** `mutationFn` resolves with the server's updated `GitLabMR`, but `onSuccess` ignores
it, leaving the caches holding the locally-guessed patch until the invalidate-driven refetch
lands.
**Fix:** `onSuccess: (updated) => { patchMrInChannelCaches(queryClient, projectId, mr.id, updated); setStatus('idle'); }`
(with CR-01's field-scoped patch), which also shortens the window in which the optimistic guess
can disagree with GitLab.

### IN-02: Inert MS cell gives no explanation while the inert BR cell does

**File:** `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx:213-216`
**Issue:** `inertTitle` is only computed for `action === 'retarget'`; a flagged MS cell with no
matched milestone renders a bare orange glyph with no tooltip, so the user cannot tell why it
is not clickable (the degraded banner explains the global case only).
**Fix:** add the milestone counterpart, e.g. `'No GitLab milestone matched this release — assign one above'`.

### IN-03: Test gaps around the phase's own risk claims

**File:** `taskflow/src/routes/dashboard/release-detail/useMrFixMutation.test.tsx:451-501`,
`MrDriftSection.test.tsx` (success case), `gitlab.test.ts` (flatten cases)
**Issue:** The "independent" test asserts only the two hooks' statuses, never the cache after a
mixed success/failure pair — which is why CR-01 shipped green. The `success` UI test resolves
with `{} as GitLabMR`, so nothing verifies the resolved value is handled. No case covers
`{ message: {} }` / `{ message: [] }` (WR-01) or a nested field value (WR-02).
**Fix:** add (a) a cache assertion to the concurrent test, (b) the two empty-message flatten
cases, (c) a nested-object flatten case.

---

_Reviewed: 2026-08-11T15:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
