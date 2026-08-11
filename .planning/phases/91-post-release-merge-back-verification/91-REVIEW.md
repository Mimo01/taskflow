---
phase: 91-post-release-merge-back-verification
reviewed: 2026-08-11T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - taskflow/src/services/gitlab.ts
  - taskflow/src/services/gitlab.test.ts
  - taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts
  - taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx
findings:
  critical: 4
  warning: 7
  info: 3
  total: 14
status: issues_found
---

# Phase 91: Code Review Report

**Reviewed:** 2026-08-11
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Scope: the merge-back verification additions only (`fetchSourceBranchMRs` /
`compareRefs` in `gitlab.ts`, the new `mergeBackVerification.ts` resolver, the
sidebar row, and the two new queries in `useReleaseDetail.ts`).

Baseline health is good: `tsc --noEmit` is clean, all 59 tests in the three
touched test files pass, no secrets, no injection surface (refs are
`encodeURIComponent`-ed, the token stays in a header and never appears in an
error message), and the resolver's precedence ladder is genuinely well
tested in isolation.

The defects are all at the seams the unit tests do not reach:

1. The tracking-MR channel never checks `target_branch`, so an MR merged from
   `release/X.Y.Z` into *any* branch is read as evidence of merge-back into the
   default branch — the exact false positive this feature exists to prevent, and
   the common case in a git-flow repo where the release branch is merged to
   `master` and to `develop` by two separate MRs.
2. `compareRefs` silently coerces an unexpected payload into `diffCount: 0`,
   which the resolver reads as the strongest positive verdict ("Merged"),
   directly contradicting the module's own documented D-04 invariant.
3. Two upstream inputs (`releaseBranchName`, `defaultBranch`) have no terminal
   state, so realistic configurations pin the row at `Loading...` forever —
   the identical failure `releaseBranch.ts` already documents and guards
   against for the branch row.
4. The tag lookup has no loading or failure signal, so an in-flight or failed
   `searchProjectTags` renders a confident "no tracking MR and no vX.Y.Z tag
   found" claim.

No structural pre-pass was supplied for this review.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A merged tracking MR into ANY branch is reported as "Merged into {defaultBranch}"

**File:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts:144-154`, `taskflow/src/services/gitlab.ts:1836-1893`
**Issue:**
`fetchSourceBranchMRs` queries `merge_requests?source_branch=<release branch>&state=all`
with no `target_branch` constraint, `TrackingMR` (line 35) does not even project
`target_branch`, and step 4 accepts *any* MR whose `state === 'merged'`:

```ts
const mergedMR = trackingMRs?.find((mr) => mr.state === 'merged');
if (mergedMR) return { kind: 'merged', via: 'tracking-mr', defaultBranch, ... };
```

In the standard git-flow shape this feature targets, `release/33.5.0` is merged
by *two* MRs — one into `master`/`production` and one back into `develop`. If
only the `master` MR merged (i.e. the release shipped but was never merged
back — the precise condition MERGE-01 exists to detect), this code renders the
green "Merged into develop" verdict with a `via !<iid>` tooltip citing the
`master` MR as evidence. The feature reports the healthy state for its own
target failure mode. A hotfix MR sourced from the same branch into any other
branch produces the same false positive.

Note `GitLabMR` already carries `target_branch` (`gitlab.ts:454`), so no extra
fetch is needed — the field is simply not projected or checked. The resolver's
`.find()` also picks an arbitrary MR when several are merged (see WR-02).

**Fix:** project `target_branch` and require it to equal the default branch
before treating the MR as merge-back evidence.

```ts
// mergeBackVerification.ts
export type TrackingMR = Pick<GitLabMR, 'iid' | 'state' | 'web_url' | 'target_branch'> & {
  merged_at?: string | null;
};

// step 4 — only an MR merged INTO the default branch is merge-back evidence
const mergedMR = trackingMRs?.find(
  (mr) => mr.state === 'merged' && mr.target_branch === defaultBranch,
);
```

Add a matching resolver test (merged MR with `target_branch: 'master'`,
`defaultBranch: 'develop'`, `diffCount: 3` → `likely-not-merged`, not `merged`)
and a `gitlab.test.ts` fixture whose MRs target something other than `develop`.

### CR-02: `compareRefs` turns a malformed/unexpected payload into a positive "Merged" verdict

**File:** `taskflow/src/services/gitlab.ts:1930-1938`
**Issue:**

```ts
const data = (await response.json()) as { diffs: unknown[]; commits: unknown[]; compare_timeout: boolean };
return {
  diffCount: Array.isArray(data.diffs) ? data.diffs.length : 0,
  commitCount: Array.isArray(data.commits) ? data.commits.length : 0,
  timedOut: data.compare_timeout === true,
};
```

Any 200 response whose body is not the expected shape — a proxy/SSO HTML or
JSON interstitial, an API-version change, a `{"message": ...}` body, a null
`diffs` — yields `diffCount: 0`, which `resolveMergeBackVerdict` step 9 reads as
`{ kind: 'merged', via: 'content-compare' }`. The unknown case resolves to the
*strongest positive claim*, which is exactly what the module header forbids:
"an incomplete diff must never be read as 'no diff'" (D-04). The absent-field
default should fail toward `couldnt-verify`, never toward `merged`. `timedOut`
has the same asymmetry: a missing `compare_timeout` field silently means "did
not time out".

**Fix:** treat a non-array `diffs`/`commits` as an unverifiable comparison
rather than an empty one.

```ts
if (!Array.isArray(data.diffs) || !Array.isArray(data.commits)) {
  throw new Error('Failed to compare refs: unexpected response shape');
}
return {
  diffCount: data.diffs.length,
  commitCount: data.commits.length,
  timedOut: data.compare_timeout !== false, // absent/unknown => not verifiable
};
```

(The throw surfaces as `isError` → `compareCheckFailed` → `couldnt-verify`,
which is the honest verdict.) Add a `gitlab.test.ts` case for a 200 with
`{ message: '...' }` asserting it does not produce `diffCount: 0`.

### CR-03: A matched milestone with an unparseable title pins the row at "Loading..." forever

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:232-248`, `mergeBackVerification.ts:138-140`
**Issue:** `releaseBranchName = deriveReleaseBranchName(matchedMilestone?.title)`
returns `null` for any matched milestone whose title has no leading `X.Y.Z`
token — `releaseBranch.ts` D-11 documents this as an expected, supported state
(`BranchState.kind === 'unresolvable'`). In that state:

- `hasMatchedMilestone` is `true` and `releasedVersion` is `true` → not `hidden`
- `defaultBranch` is non-null → not step 2 `loading`
- the tracking-MR query is **disabled** (`releaseBranchName !== null` gate), so
  `trackingMRs` stays `undefined` and `trackingMRsCheckFailed` stays `false`
- step 3 (`trackingMRs === undefined && !trackingMRsCheckFailed`) returns
  `{ kind: 'loading' }` — permanently.

The row shows a spinner-equivalent that never resolves, with no retry and no
explanation. This is the same defect `releaseBranch.ts:131-134` explicitly calls
out ("pins the UI at 'Loading…' forever") but the guard was not carried over: a
*disabled* query is indistinguishable from an *in-flight* one when the only
signals are `data === undefined` and `isError === false`.

**Fix:** pass an explicit "cannot be attempted" signal and resolve it to a
terminal verdict rather than `loading`.

```ts
// useReleaseDetail.ts
mergeBackVerdict = resolveMergeBackVerdict({
  ...,
  trackingMRsEnabled: releaseBranchName !== null,
});

// mergeBackVerification.ts — before step 3
if (!trackingMRsEnabled) {
  // no derivable release branch: the MR channel can never answer
  return tagName === null
    ? { kind: 'couldnt-verify', reason: 'no-mr-no-tag', expectedTagName }
    : /* fall through to the compare channel */ ...;
}
```

Alternatively hide the row (`kind: 'hidden'`) when `releaseBranchName === null`,
matching D-11's "cannot be attempted" rule — but it must not be `loading`.

### CR-04: A failed `gitlab-project` query also pins the row at "Loading..." forever

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:151-157`, `mergeBackVerification.ts:133-135`
**Issue:** `defaultBranch` comes from `project?.default_branch ?? null` and the
`gitlab-project` query's `isError` is never captured. Step 2 maps
`defaultBranch === null` to `loading` unconditionally, so a 500/timeout/revoked
scope on `fetchProject` (or a project whose payload omits `default_branch`)
leaves the row at `Loading...` permanently — same class as CR-03, different
input. Every other channel in this hook (`branchCheckFailed`,
`trackingMRsCheckFailed`, `compareCheckFailed`) does capture `isError`; the
project query is the one omission.

**Fix:**

```ts
const { data: project, isError: projectCheckFailed } = useQuery({ /* gitlab-project */ });
...
resolveMergeBackVerdict({ ..., defaultBranchCheckFailed: projectCheckFailed });

// mergeBackVerification.ts step 2
if (defaultBranch === null) {
  return defaultBranchCheckFailed
    ? { kind: 'couldnt-verify', reason: 'check-failed', expectedTagName }
    : { kind: 'loading' };
}
```

## Warnings

### WR-01: An in-flight or failed tag lookup renders as a confident "no vX.Y.Z tag found"

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:197-216`, `mergeBackVerification.ts:158-164`
**Issue:** `mergeBackTagName` is derived from `releaseTags ?? []`, so
`undefined` (query in flight) and `[]` (query finished, genuinely no tag)
collapse to the same `null`. With no merged tracking MR, step 5 immediately
returns `couldnt-verify / no-mr-no-tag`, and the sidebar renders the tooltip
"no tracking MR and no v33.7.0 tag found" — a factual claim about the repo —
while the tags request is still in flight. It then flips to `merged` when the
tag arrives.

Worse, it is not only transient: `searchProjectTags` swallows every error and
returns a partial/empty array (`gitlab.ts:374, 380-382`), so a 500 or a network
failure on the tags endpoint is *permanently* reported as "no tag found" with
`reason: 'no-mr-no-tag'` instead of `'check-failed'`. The resolver went to
deliberate lengths to add loading/failure gates for the other two channels;
the tag channel got neither.

**Fix:** thread the tag query's state through instead of only its value —
`const { data: releaseTags, isFetched: tagsFetched } = useQuery(...)`, pass
`tagsSettled: !needsTagLookup || tagsFetched`, and return `{ kind: 'loading' }`
from step 5 when `tagName === null && !tagsSettled`. Separately, have
`searchProjectTags` signal failure (or add a `tagCheckFailed` flag) so the
reason can be `'check-failed'`.

### WR-02: `.find()` attributes the verdict to an arbitrary merged MR

**File:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts:144`
**Issue:** When several MRs are sourced from the release branch and more than
one is merged (routine: one to `master`, one to `develop`, plus reverted or
re-opened attempts), `.find()` returns whichever GitLab listed first — the API
default sort is `created_at desc`, not "most relevant". The tooltip then cites
`!<iid>` and a `merged` date belonging to an MR that may not be the merge-back
at all. Fixing CR-01 (filter on `target_branch`) narrows this but does not
close it; pick deterministically.

**Fix:** after filtering by target branch, select the latest merge:

```ts
const mergedMRs = (trackingMRs ?? []).filter(
  (mr) => mr.state === 'merged' && mr.target_branch === defaultBranch,
);
const mergedMR = mergedMRs.reduce<TrackingMR | undefined>(
  (best, mr) =>
    !best || (mr.merged_at ?? '') > (best.merged_at ?? '') ? mr : best,
  undefined,
);
```

### WR-03: The hook tests cannot fail — no test asserts a terminal verdict

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx:508-516`
**Issue:**

```ts
it('exposes mergeBackVerdict with a kind property', async () => {
  await waitFor(() => expect(result.current.mergeBackVerdict).toHaveProperty('kind'));
});
```

`MergeBackVerdict` is a discriminated union — `kind` is guaranteed by the type
system, so this assertion cannot fail for any input and is pure ceremony. It
passes while the verdict is `loading`, which is precisely the CR-03/CR-04 bug
state. No test in the file asserts the hook ever produces `merged`,
`likely-not-merged`, or `couldnt-verify`; the single near-miss
(line ~490, `expect(...).not.toBe('loading')`) is on the happy path only. The
whole wiring layer — where all four blockers live — is effectively untested.

**Fix:** replace the tautology with terminal-outcome assertions, and add the
regression cases:

```ts
await waitFor(() =>
  expect(result.current.mergeBackVerdict).toMatchObject({ kind: 'merged', via: 'content-compare' }),
);
// milestone title without X.Y.Z  -> must NOT be 'loading' (CR-03)
// fetchProject rejects           -> must NOT be 'loading' (CR-04)
// merged MR targeting 'master'   -> must NOT be 'merged'  (CR-01)
```

### WR-04: Dead `?? 0` fallback would render "has 0 commits not in develop"

**File:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts:201`
**Issue:** `commitsNotInDefault: compareResult ? compareResult.commitCount : 0`.
Steps 6-7 already guarantee `compareResult` is defined at step 11, so the
false branch is unreachable — but it is written as a silent default that, if
it ever *were* reached (or if `commits` is missing, see CR-02), renders the
self-contradicting warning "v33.7.0 has 0 commits not in develop" next to
"Likely not merged". A defensive default that produces nonsense copy is worse
than a narrowed access.

**Fix:** narrow explicitly instead of defaulting:

```ts
if (!compareResult) {
  return { kind: 'couldnt-verify', reason: 'check-failed', expectedTagName };
}
return { kind: 'likely-not-merged', defaultBranch, tagName, commitsNotInDefault: compareResult.commitCount };
```

### WR-05: Sidebar test asserts "no buttons" through a Tailwind class selector

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx:250-256`
**Issue:**

```ts
const row = el.closest('.flex.items-start.gap-2');
expect(row).not.toBeNull();
if (row) { expect(within(row as HTMLElement).queryAllByRole('button')).toHaveLength(0); }
```

The D-12 "no interactive control in this row" lock is enforced through
`MetaRow`'s current utility classes. A styling change to `MetaRow` (e.g.
`gap-2` → `gap-1.5`) makes `closest()` return `null`; the `if (row)` guard then
skips the only meaningful assertion and the test still passes green. The lock
silently stops being enforced.

**Fix:** give `MetaRow` a stable hook and assert unconditionally:
`const row = el.closest('[data-testid="meta-row"]')` (or
`screen.getByTestId('merge-back-row')`), then drop the `if (row)` guard —
`expect(row).not.toBeNull()` already failed the test if it is missing, so use
a non-null assertion or `getByTestId`.

### WR-06: Unbounded `while (true)` pagination with no page ceiling

**File:** `taskflow/src/services/gitlab.ts:1847`
**Issue:** `fetchSourceBranchMRs` loops until a short page is returned, with no
maximum. A misbehaving proxy/gateway that ignores `page` (returning the same
full page repeatedly) makes this spin forever, growing `allMRs` without bound
inside a React Query `queryFn` — the UI never settles and memory climbs. The
codebase already has the correct precedent two hundred lines up:
`searchProjectTags` (`gitlab.ts:360-366`) bounds itself with
`maxPages = 20` and comments the exact rationale ("a paginating server that
never shrinks a page cannot spin forever"). D-17's "no page cap" rule is about
not *truncating results*, which a generous ceiling does not violate.

**Fix:** convert to a bounded loop, matching `searchProjectTags`:

```ts
const maxPages = 50; // 5000 MRs from one source branch is already absurd
for (let page = 1; page <= maxPages; page++) { ... }
```

(The pre-existing `fetchBranchTargetedMRs` at line 1732 shares this shape; fixing
both together is cheap.)

### WR-07: Five-branch nested ternary in JSX, with duplicated date formatting

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx:283-337`
**Issue:** The "Merged back" cell is a five-level nested ternary
(`loading` → `merged/tracking-mr` → `merged/content-compare` →
`likely-not-merged` → implicit `couldnt-verify` else). The final verdict kind is
matched *implicitly by exhaustion*, so adding a sixth `MergeBackVerdict` kind
routes it into the "Couldn't verify" branch — silently mislabelling it, with a
type error only if the new kind lacks a `reason` field. `formatEvidenceDate(...)`
is also called twice and `formatVerdictDate(...)` twice in the same expression.

**Fix:** extract a `MergeBackRow({ verdict })` component with an explicit
`switch (verdict.kind)` plus a `default: { const _x: never = verdict; return null; }`
exhaustiveness guard, and hoist the two formatted dates into locals.

## Info

### IN-01: New MR query key inlined instead of routed through `mrChannelKeys`

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:233`
**Issue:** `queryKey: ['gitlab-mr-source-branch', activeGitlabProject, releaseBranchName]`
is a fourth MR-list cache written as an inline literal, three lines below a
comment stating "the three channel query keys are declared once, in
mrChannelKeys.ts ... inline literals here would let a rename silently disable
every optimistic patch". This key is not patched by `useMrFixMutation` today
(retargeting changes `target_branch`, not `source_branch`), so nothing is broken
— but the exception is undocumented and invites the next MR-cache addition to
skip the module too.
**Fix:** add `mrChannelKeys.sourceBranch(projectId, branchName)` (or a one-line
comment stating why this cache is deliberately outside the patched channel set).

### IN-02: `catch {}` relabels every transport-layer failure as "check the base URL"

**File:** `taskflow/src/services/gitlab.ts:1852-1862, 1912-1922`
**Issue:** Both new functions wrap `apiFetch` in a bare `catch {}` that discards
the original error and throws `Cannot reach ${baseUrl} — check the base URL`. A
TLS failure, an aborted request, or an `ApiError` already raised inside
`apiFetch` all become misleading "check the base URL" guidance. This matches the
existing convention in the file, so it is consistency-preserving rather than new.
**Fix:** `catch (err) { throw err instanceof ApiError ? err : new Error(\`Cannot reach ${baseUrl} — check the base URL\`); }`

### IN-03: `fetchSourceBranchMRs` duplicates `fetchBranchTargetedMRs` almost line for line

**File:** `taskflow/src/services/gitlab.ts:1836-1893` vs `1721-1780`
**Issue:** The two functions differ only in the query parameter name
(`source_branch` vs `target_branch`), the `apiFetch` label, and the error
strings — roughly 45 duplicated lines including the pagination loop, the
401/403 branch, and the catch. Any pagination or error-handling fix (see WR-06)
must now be applied twice.
**Fix:** extract `fetchMRsByBranch(baseUrl, token, projectId, { param: 'source_branch' | 'target_branch', branch, label })`
and have both exported functions delegate to it.

---

_Reviewed: 2026-08-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
