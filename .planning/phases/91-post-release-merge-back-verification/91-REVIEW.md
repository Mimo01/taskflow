---
phase: 91-post-release-merge-back-verification
reviewed: 2026-08-11T23:10:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/release-detail/MetaRow.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
  - taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts
  - taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
  - taskflow/src/services/gitlab.test.ts
  - taskflow/src/services/gitlab.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 91: Code Review Report

**Reviewed:** 2026-08-11T23:10:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Narrative Findings (AI reviewer)

### Summary

This round focused on the newest changes (91-07 fail-closed `searchProjectTags`, 91-08 `tagLookupPending`/`tagCheckFailed` threading through `resolveMergeBackVerdict` and `useReleaseDetail`), with the rest of the phase surface re-read in context. This report replaces the previous gap-closure-round review.

Verified locally: `vitest` passes for all four touched test files (87 + 157 tests), `tsc --noEmit` is clean, `biome check` reports no diagnostics across the release-detail directory and `gitlab.ts`. Step 4.5's placement (below step 4, above step 5) is correct and locked by tests; the `merged_at`/`iid` deterministic reduce is sound including the `Date.parse('')` → `NaN` → `-Infinity` path; `compareRefs`'s `from=defaultBranch,to=tag` direction is correct under GitLab's default three-dot (merge-base) comparison, so a diverged default branch does not produce a false `likely-not-merged`.

The defect that survives is the one the phase's own invariant names: "EVERY evidence channel carries both an in-flight signal and a failure signal." That invariant was enforced for the *Merged back* row only. The **Release Branch** row consumes the same tag channel through `resolveBranchState`, which was never given the two new signals, so it still states a negative tag result as settled fact while the tag lookup is pending or has failed (CR-01). Beyond that, several fail-closed guards remain one-sided: the new `tagLookupPending` derivation models the "query will never run because there is no version number" case but not the "query is disabled because credentials are missing" case (WR-01); `searchProjectTags` now fails closed on transport/status/non-array bodies but still casts array *elements* unvalidated into `GitLabTag[]`, feeding a render-phase `undefined.toLowerCase()` crash path (WR-02); and the resolver's new channel-health parameters are optional with `false` defaults, so the next caller silently reproduces the pre-fix behaviour (WR-04).

## Critical Issues

### CR-01: The Release Branch row still asserts "No matching tag found" while the tag channel is pending or failed

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:225-237`, rendered at `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx:257-270`

**Issue:** 91-07/91-08 gave the tag channel an in-flight signal (`tagLookupPending`, L220) and a failure signal (`tagCheckFailed`, L201) and threaded both into `resolveMergeBackVerdict` (L303-305). Neither is threaded into `resolveBranchState` (L230-237), which receives only the collapsed `releaseTagName: mergeBackTagName`. `mergeBackTagName` is `null` in three structurally different situations: (a) the tag query is still in flight, (b) the tag query rejected — now genuinely possible, since `searchProjectTags` no longer swallows errors, (c) the fetch succeeded and no tag matched.

`resolveBranchState` cannot distinguish them (`releaseBranch.ts`'s `BranchState.released` carries only `tagName: string | null`), so the sidebar renders the (c) tooltip in all three cases:

> `release/33.5.0 deleted. No matching tag found — tags are an incomplete record, so this is not evidence the release did not ship.`

For every released version with a deleted branch this false claim is shown on *every* page load for the duration of the tag fetch, and shown *permanently* when the tag fetch fails (500/401/proxy interstitial). The comment added at `useReleaseDetail.ts:193-198` asserts "the branch row above is unaffected because it reads only the resolved `mergeBackTagName`" — true for *error escalation*, but not for *truthfulness*: the row states a negative tag result the app never obtained. This is precisely the CR-03/CR-04/truth-5 defect class the phase closed four times for sibling channels, left open on the one consumer that was not re-read.

**Fix:** thread the two existing signals into the branch row and stop asserting the negative when the channel is unhealthy:

```ts
// releaseBranch.ts
| { kind: 'released'; branchName: string; tagName: string | null; tagChannel: 'resolved' | 'pending' | 'failed' }

// useReleaseDetail.ts
const branchState = resolveBranchState({
  ...,
  releaseTagName: mergeBackTagName,
  tagChannel: tagCheckFailed ? 'failed' : tagLookupPending ? 'pending' : 'resolved',
});
```

```tsx
// ReleaseDetailSidebar.tsx — released state title
title={
  branchState.tagName
    ? `${branchState.branchName} deleted · tagged ${branchState.tagName}`
    : branchState.tagChannel === 'resolved'
      ? `${branchState.branchName} deleted. No matching tag found — tags are an incomplete record, so this is not evidence the release did not ship.`
      : `${branchState.branchName} deleted. Tag lookup ${branchState.tagChannel === 'pending' ? 'still running' : 'could not be completed'} — no tag conclusion available.`
}
```

If widening `BranchState` is judged too invasive, the narrow equivalent is to pass a single `tagConclusive: boolean` and drop the "No matching tag found" sentence when it is `false`.

## Warnings

### WR-01: `tagLookupPending` (and the sibling loading guards) ignore the credential/`enabled` gate — a disabled query pins the row at "Loading..."

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:220` (also L293, and resolver step 2 at `mergeBackVerification.ts:155-160`)

**Issue:** `tagLookupPending = needsTagLookup && releaseTags === undefined && !tagCheckFailed` models only one of the two ways the query can be permanently disabled. The query's `enabled` (L210) *also* requires `gitlabBaseUrl && activeGitlabProject && gitlabToken`. When the token is absent (e.g. `readSecret('gitlab-pat')` rejects at L69-75 while `gitlabBaseUrl` is still configured) but milestone/project data is present in the session cache (`gcTime: Infinity`, key shared with `ReleasesTab`), `needsTagLookup` is true, `releaseTags` stays `undefined` forever and `tagCheckFailed` stays `false` — step 4.5 then returns `{ kind: 'loading' }` permanently. `trackingMRsUnavailable` (L293) has the same shape (it models only `releaseBranchName === null`), and step 2's `defaultBranch === null && !defaultBranchCheckFailed` → `loading` likewise.

Reachability today is narrow (a disabled milestone query normally yields `hasMatchedMilestone === false` → `hidden`), which is why this is a WARNING rather than a blocker — but the guard is written as a general invariant and is one cache hit away from the exact "Loading… forever" symptom CR-03 was raised for.

**Fix:** derive the pending/unavailable flags from the same predicate the query's `enabled` uses, so "disabled" can never read as "in flight":

```ts
const gitlabReady = !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken;
const tagQueryEnabled = gitlabReady && needsTagLookup;
const tagLookupPending = tagQueryEnabled && releaseTags === undefined && !tagCheckFailed;
const trackingMRsUnavailable = releasedVersion && (!gitlabReady || releaseBranchName === null);
```
and pass `defaultBranchUnavailable: !gitlabReady` into the resolver so step 2 terminates at `couldnt-verify` instead of `loading`.

### WR-02: `searchProjectTags` validates only the array wrapper, not its elements — `findReleaseTag` then throws during render

**File:** `taskflow/src/services/gitlab.ts:398-403`; crash site `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts:117-120` via `useReleaseDetail.ts:225-228`

**Issue:** the new guard is `if (!Array.isArray(data)) throw ...` followed by `allTags.push(...(data as GitLabTag[]))`. An array whose elements lack `name` (API version change, a proxy returning `[{ "message": "..." }]`, a GitLab error array) passes the guard. `useReleaseDetail` then runs `(releaseTags ?? []).map((t) => t.name)` producing `(undefined)[]`, and `findReleaseTag` calls `t.toLowerCase()` on it — a `TypeError` thrown in the render phase of `ReleaseDetailPage`, i.e. a blank page / error boundary rather than a `couldnt-verify` verdict. TypeScript hides this because the `as GitLabTag[]` cast declares `name: string`. The stated point of 91-07 is that a malformed 200 must degrade to `check-failed`, not be trusted.

**Fix:**

```ts
if (!Array.isArray(data) || data.some((t) => typeof (t as { name?: unknown })?.name !== 'string')) {
  throw new Error('Failed to load release tags: unexpected response shape');
}
```

### WR-03: `response.json()` rejections bypass the module's error vocabulary and can leak response-body text into the message

**File:** `taskflow/src/services/gitlab.ts:398` (same pattern at `:1965` `compareRefs`, `:1903` `fetchSourceBranchMRs`)

**Issue:** the `try`/`catch` wraps only `apiFetch`; `await response.json()` sits outside it. A 200 carrying non-JSON (HTML SSO interstitial — the exact scenario the CR-02/T-91-07-01 guards cite) rejects with a raw `SyntaxError`, and V8/JSC embed a prefix of the offending body in that message (`Unexpected token '<', "<html><head..." is not valid JSON`). That contradicts the JSDoc contract at `:355-361` ("Never interpolates the response body, URL, search term or token into the thrown message") and bypasses the "unexpected response shape" normalisation immediately below it. The escaping error is also not an `ApiError`, so any consumer branching on error type mis-classifies it.

**Fix:**

```ts
let data: unknown;
try {
  data = await response.json();
} catch {
  throw new Error('Failed to load release tags: unexpected response shape');
}
```

### WR-04: the new channel-health parameters are optional and default to `false`, silently reproducing the pre-fix behaviour for any new caller

**File:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts:114-123, 129-138`

**Issue:** `defaultBranchCheckFailed?`, `trackingMRsUnavailable?`, `tagLookupPending?` and `tagCheckFailed?` are optional with `= false` defaults, while the module header (L33-38) states the invariant "EVERY evidence channel carries both an in-flight signal and a failure signal … adding a fifth channel without both signals is the defect this phase closed four times." The type system is the only place that invariant can be enforced, and it currently permits exactly the omission the header forbids — the "default-compatibility lock" test (`mergeBackVerification.test.ts`, *omitting both tag-channel params entirely…*) actively pins the unsafe default in place. A second call site added later (a releases-list badge, a bulk report) would silently emit `no-mr-no-tag` for genuine check failures.

**Fix:** make all four required (`tagLookupPending: boolean; tagCheckFailed: boolean; …`), update the production call site and the test `makeParams` factory, and delete the destructuring defaults.

### WR-05: silent truncation at `maxPages = 20` turns an incomplete tag walk into a false "no tag found"

**File:** `taskflow/src/services/gitlab.ts:373, 404-407` (same shape in `fetchSourceBranchMRs`, `:1876, 1906`)

**Issue:** the loop stops at page 20 and returns `allTags` with no signal that the walk was cut short — the caller cannot distinguish "these are all the matching tags" from "these are the first 2000". Additionally `if (data.length < perPage) break;` trusts the server to honour `per_page`; a server that caps at 20/page terminates the walk after one page. Either way the result is `mergeBackTagName === null` → a settled negative (`no-mr-no-tag`, or the CR-01 branch-row claim) derived from a partial fetch — the category 91-07 set out to eliminate at the transport layer. Rare for a `search=`-scoped tag query, hence WARNING.

**Fix:** treat exhausting the cap as a failure rather than a result:

```ts
if (page === maxPages && data.length === perPage) {
  throw new Error('Failed to load release tags: result set exceeds page limit');
}
```

### WR-06: `expectedTagName` hard-codes the `v` prefix although `findReleaseTag` also accepts a bare version

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:306`; consumed at `ReleaseDetailSidebar.tsx:331-333`

**Issue:** `expectedTagName: matchedVersionNumber ? \`v${matchedVersionNumber}\` : null` produces the tooltip "no tracking MR and no **v33.5.0** tag found", but `findReleaseTag` (`releaseBranch.ts:117-120`) strips an optional leading `v` and would have matched a bare `33.5.0` tag too. The message names a tag convention that is not the one actually searched, misdirecting a user who tags without the prefix.

**Fix:** state the searched form honestly (`no tracking MR and no tag matching 33.5.0 (with or without a leading v) found`), or derive `expectedTagName` from the same matcher used for lookup.

## Info

### IN-01: five identical `couldnt-verify / check-failed` literals in the resolver

**File:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts:157, 229, 253, 259, 283`
**Issue:** `return { kind: 'couldnt-verify', reason: 'check-failed', expectedTagName };` is duplicated five times; a future field on that variant must be edited in five places.
**Fix:** `const checkFailed = (): MergeBackVerdict => ({ kind: 'couldnt-verify', reason: 'check-failed', expectedTagName });` declared after destructuring, returned at each site.

### IN-02: `formatEvidenceDate`/`formatVerdictDate` each invoked twice per render for the same input

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx:296-304`
**Issue:** each formatter is called once as a truthiness test and again to interpolate — four calls where two values suffice, and two places to keep consistent.
**Fix:** hoist `const evidenceDate = formatEvidenceDate(mergeBackVerdict.mergedAt)` / `const verdictDate = formatVerdictDate(...)` into an extracted row component.

### IN-03: nested-ternary verdict chain (previously WR-04, deliberately deferred)

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx:287-338` (and the branch-state chain at `:213-279`)
**Issue:** re-noted for continuity only — accepted tech debt from the previous round. The chain is exhaustive and type-narrowed today; the standing risk is that the terminal `else` silently absorbs any future verdict kind.
**Fix:** (deferred) extract a `MergeBackRowContent` component with an early-return switch on `kind`.

### IN-04: coverage gaps around the newly fail-closed tag channel

**File:** `taskflow/src/services/gitlab.test.ts:818-920`, `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx:640-745`
**Issue:** the new suites cover 200/500/401/non-array/transport and the pending/failed verdict paths well, but nothing covers (a) the `maxPages = 20` truncation behaviour (WR-05), (b) a 200 array of malformed elements (WR-02), or (c) the "GitLab configured but token unavailable" path (WR-01) — the three remaining paths where a partial or absent result can be presented as a settled negative.
**Fix:** add one service test per (a)/(b) and one hook test that makes `readSecret` reject and asserts the verdict terminates rather than staying `loading`.

---

_Reviewed: 2026-08-11T23:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
