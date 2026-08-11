---
phase: 91-post-release-merge-back-verification
reviewed: 2026-08-12T00:05:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/release-detail/MetaRow.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
  - taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts
  - taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts
  - taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts
  - taskflow/src/routes/dashboard/release-detail/releaseBranch.ts
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
  - taskflow/src/services/gitlab.test.ts
  - taskflow/src/services/gitlab.ts
findings:
  critical: 1
  warning: 10
  info: 7
  total: 18
status: issues_found
---

# Phase 91: Code Review Report

**Reviewed:** 2026-08-12T00:05:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Narrative Findings (AI reviewer)

### Summary

Full re-review of the phase surface, now including plan 91-09 (`TagChannelHealth` on `BranchState`, the three-way `released` tooltip in `ReleaseDetailSidebar`, and the `tagChannel` derivation in `useReleaseDetail`). This report **replaces** the previous 91-REVIEW.md, which covered 91-01..91-08.

Verified locally, from the working tree: `npx tsc --noEmit` clean; `npx vitest run` on the four touched suites — 146 tests, all passing; `npx biome check` on all seven non-test source files — zero diagnostics.

**Prior CR-01 is closed.** `resolveBranchState` now emits `tagChannel` on the `released` variant, `useReleaseDetail` derives it from the already-in-scope `tagCheckFailed`/`tagLookupPending` pair with `failed` tested first (matching step 4.5's precedence), and the sidebar no longer prints "No matching tag found" while the channel is pending or failed. The pure-function and component tests for that path are correct and reasonably adversarial (they lock precedence — `tagChannel: 'pending'` does not displace `branchExists === undefined` → `loading`).

What 91-09 did **not** close:

1. The fix is applied at the leaf but the enforcement claim behind it is false. `releaseBranch.ts:120-123` states `tagChannel` is "REQUIRED — deliberate type-system enforcement … so no producer can silently omit it". The only producer of the `released` variant is `resolveBranchState`, whose own parameter is optional with `tagChannel = 'resolved'` (`:169, :178`). Omitting it at the sole call site that matters yields the exact pre-fix output. The type system enforces nothing here (WR-01).
2. The defect being fixed lived in `useReleaseDetail`'s wiring, and 91-09 added zero tests at that layer (WR-02). The three new `releaseBranch.test.ts` cases prove the resolver forwards a value it is handed; nothing proves the hook hands it the right one.
3. The corrective information is `title`-attribute-only. Visible row text is byte-identical ("Released") in all three tag-channel states, so a user who does not hover still cannot tell "checked, no tag" from "checking" from "check failed" (WR-03).

Beyond 91-09, the fail-closed discipline the phase advertises remains one-sided in several places carried forward from the previous round: unvalidated tag *elements* feed a render-phase `TypeError` that takes the whole app to `ChunkErrorBoundary`'s full-screen error (CR-01 — escalated from WARNING after confirming the boundary is app-level, `src/routes/routes.tsx`); `response.json()` sits outside the transport `try` and can embed HTML body text in a thrown message that the JSDoc promises never leaks it (WR-05); pagination caps truncate silently into a settled negative (WR-07); and every channel-health parameter on `resolveMergeBackVerdict` is optional-with-`false` while the module header declares the opposite invariant (WR-06).

Structural pre-pass: none supplied with this run, so no `## Structural Findings (fallow)` section. Unused-export scan performed manually: `isValidGitRefName`, `TrackingMR`, `MergeBackCompareInput` are exported but consumed only within their own module + tests; `MergeBackVerdict.mrUrl` is produced and never read anywhere (IN-06).

## Critical Issues

### CR-01: `searchProjectTags` validates the array wrapper but not its elements — `findReleaseTag` then throws in the render phase and blanks the app

**File:** `taskflow/src/services/gitlab.ts:398-403`; crash site `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts:138-142` reached via `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:226-229`

**Issue:** the 91-07 guard is `if (!Array.isArray(data)) throw …` followed immediately by `allTags.push(...(data as GitLabTag[]))`. An array whose elements are not tags — `["<html>…"]` from a proxy, `[{ message: 'Insufficient permissions' }]` from a GitLab error array, or a future API shape change — passes the guard untouched. `useReleaseDetail` then evaluates, in the render phase:

```ts
const mergeBackTagName = findReleaseTag((releaseTags ?? []).map((t) => t.name), matchedVersionNumber);
```

producing `(undefined)[]`, and `findReleaseTag` runs `t.toLowerCase()` on it → `TypeError: t.toLowerCase is not a function` / `of undefined`. This is not inside a query function, so React Query cannot convert it to `isError`; it propagates to `ChunkErrorBoundary`, which renders a full-screen "Something went wrong loading this page" over the entire app. The `as GitLabTag[]` cast is what hides this from `tsc`.

This directly contradicts the function's own stated contract (`gitlab.ts:341-361`): a malformed 200 "must never be read as zero tags" and must surface as a check failure. Today a malformed 200 is worse than being read as zero tags — it takes the app down.

**Fix:**

```ts
const data = (await response.json()) as unknown;
if (!Array.isArray(data) || data.some((t) => typeof (t as { name?: unknown })?.name !== 'string')) {
  throw new Error('Failed to load release tags: unexpected response shape');
}
```

Defence in depth at the consumer as well, since `findReleaseTag`'s signature lies about runtime guarantees:

```ts
// releaseBranch.ts
return tags.find((t) => typeof t === 'string' && t.toLowerCase().replace(/^v/, '') === target) ?? null;
```

## Warnings

### WR-01: `resolveBranchState`'s `tagChannel` is optional and defaults to `'resolved'` — the documented "type-system enforcement" does not exist

**File:** `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts:120-123` (claim), `:169` (optional param), `:178` (default), `:215` (emission)

**Issue:** the `released` variant's doc comment asserts `tagChannel` is "REQUIRED — deliberate type-system enforcement (91-REVIEW WR-04) so no producer can silently omit it and reproduce the pre-fix behaviour." The variant is only ever constructed at `:215`, inside `resolveBranchState`, and that function accepts `tagChannel?: TagChannelHealth` defaulting to `'resolved'`. Every caller of `resolveBranchState` — the real producer — can omit it and get a state that asserts a settled negative tag result the app never obtained. `releaseBranch.test.ts` even pins this in place ("defaults tagChannel to resolved when the param is omitted"). The requiredness on the emitted variant only constrains code that hand-builds a `BranchState`, which nothing does.

`ReleasesTab.tsx` already imports from this module (`deriveReleaseBranchName`, `RELEASE_BRANCH_PREFIX`); a future branch-state badge there is one omitted key away from reintroducing 91-VERIFICATION truth 6.

**Fix:** make the parameter required and update the two call sites plus the test `base` fixture:

```ts
export function resolveBranchState(params: {
  …
  tagChannel: TagChannelHealth;   // no `?`, no destructuring default
}): BranchState
```

If a default must be retained for ergonomics, make the unsafe value the explicit one (`tagChannel: 'pending'` as default) so an omission degrades to "not known yet" rather than to a false negative.

### WR-02: 91-09 added no test at the layer where the bug actually lived

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:238-252`; test files `useReleaseDetail.test.tsx` (unchanged by 91-09), `releaseBranch.test.ts:296-345`, `ReleaseDetailSidebar.test.tsx:147-196`

**Issue:** the pre-fix defect was an omitted argument in `useReleaseDetail`'s `resolveBranchState({…})` call. 91-09's three new suites cover (a) the resolver forwarding a value it is handed and (b) the sidebar rendering a state it is handed. Neither exercises the derivation `tagCheckFailed ? 'failed' : tagLookupPending ? 'pending' : 'resolved'` or its delivery into `branchState`. `useReleaseDetail.test.tsx` already has the fixtures needed (a deferred `searchProjectTagsImpl` at `:640-672`, a rejecting one at `:674-694`); adding the assertion is a three-line change. As it stands, deleting `tagChannel` from the call at `:251` leaves the full suite green.

**Fix:** in the existing deferred/rejecting tag tests, assert the branch row too:

```ts
await waitFor(() => expect(result.current.branchState.kind).toBe('released'));
expect(result.current.branchState).toMatchObject({ tagChannel: 'pending' });   // and 'failed' in the rejecting test
```

### WR-03: the tag-channel distinction exists only in a `title` attribute — invisible without a mouse and absent from the accessibility tree in a useful form

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx:257-274`

**Issue:** in all three tag-channel states the row renders the identical visible content — a `GitBranch` icon and the word `Released` — on a non-focusable `<span>`. The entire corrective payload of 91-09 lives in `title`, which requires hover with a pointer, never appears for keyboard users, and is announced inconsistently by screen readers. The user-facing symptom that 91-VERIFICATION truth 6 describes ("the row asserts an unverified negative") is only *half* fixed: the app stops lying on hover, but a non-hovering user sees the same output in all three cases and cannot tell that the tag conclusion is provisional.

**Fix:** make the state visible, e.g. append a muted marker to the row body and mirror it in an accessible name:

```tsx
<span aria-label={tooltipText} title={tooltipText}>
  <GitBranch className="size-3 shrink-0" />
  Released
  {branchState.tagName ? <span className="font-mono">{branchState.tagName}</span>
    : branchState.tagChannel === 'pending' ? <span className="italic">· checking tag…</span>
    : branchState.tagChannel === 'failed' ? <span className="italic">· tag check failed</span>
    : null}
</span>
```

### WR-04: `tagLookupPending`, `trackingMRsUnavailable` and the resolver's step 2 ignore the credential half of the `enabled` gate — a disabled query reads as "in flight"

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:221` and `:308`; resolver step 2 at `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts:155-160`

**Issue:** `tagLookupPending = needsTagLookup && releaseTags === undefined && !tagCheckFailed` models exactly one of two ways the query can be permanently disabled. The query's `enabled` (`:211`) additionally requires `gitlabBaseUrl && activeGitlabProject && gitlabToken`. `gitlabToken` arrives asynchronously (`:70-76`) and is set to `null` when `readSecret` rejects. With a token missing but milestone/project data present in cache, `needsTagLookup` is `true`, `releaseTags` stays `undefined` forever and `tagCheckFailed` stays `false` — the branch row pins at `tagChannel: 'pending'` ("Checking for a matching tag…") indefinitely and step 4.5 returns `{ kind: 'loading' }` forever. `trackingMRsUnavailable` (`:308`) has the same partial shape, and step 2's `defaultBranch === null && !defaultBranchCheckFailed → loading` likewise.

Reachability today is narrow (a disabled milestone query normally collapses to `hasMatchedMilestone === false`), which keeps this at WARNING — but this is the CR-03 defect class verbatim, and the guard is written as if it were general.

**Fix:** derive every pending/unavailable flag from the same predicate the `enabled` gates use:

```ts
const gitlabReady = !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken;
const tagLookupPending = gitlabReady && needsTagLookup && releaseTags === undefined && !tagCheckFailed;
const trackingMRsUnavailable = releasedVersion && (!gitlabReady || releaseBranchName === null);
```
and pass a `defaultBranchUnavailable: !gitlabReady` so step 2 terminates at `couldnt-verify` rather than `loading`.

### WR-05: `await response.json()` sits outside the transport `try` — a non-JSON 200 throws a message containing response-body text, violating the module's own no-leak contract

**File:** `taskflow/src/services/gitlab.ts:398` (`searchProjectTags`), same pattern at `:1903` (`fetchSourceBranchMRs`) and `:1965` (`compareRefs`)

**Issue:** the `try`/`catch` wraps only `apiFetch`. A 200 carrying HTML — the SSO/proxy interstitial the CR-02 and T-91-07-01 guards explicitly cite — makes `response.json()` reject with a raw `SyntaxError` whose message embeds a prefix of the body (`Unexpected token '<', "<html><head…" is not valid JSON` in V8/JSC). That escapes both the "unexpected response shape" normalisation three lines below it and the JSDoc promise at `:355-361` that the body is never interpolated into the thrown message. The escaping error is also not an `ApiError`, so type-based consumer branching mis-classifies it. The existing test only feeds a well-formed JSON object, so this path is uncovered.

**Fix:**

```ts
let data: unknown;
try {
  data = await response.json();
} catch {
  throw new Error('Failed to load release tags: unexpected response shape');
}
```
Apply the same wrapping in `compareRefs` and `fetchSourceBranchMRs`.

### WR-06: every channel-health parameter on `resolveMergeBackVerdict` is optional with a `false` default, contradicting the invariant in the same file's header

**File:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts:114-123` and `:129-138`

**Issue:** `defaultBranchCheckFailed?`, `trackingMRsUnavailable?`, `tagLookupPending?` and `tagCheckFailed?` all default to `false`, while the header (`:33-38`) states "EVERY evidence channel carries both an in-flight signal and a failure signal … adding a fifth channel without both signals is the defect this phase closed four times." The type system is the only place that invariant is checkable, and it currently permits precisely the omission the header forbids. The "default-compatibility lock" test (`mergeBackVerification.test.ts:436`) actively cements the unsafe defaults. Any second call site (a releases-list badge, a bulk report) silently emits `no-mr-no-tag` for genuine check failures. This is the same shape as WR-01 and should be fixed with it.

**Fix:** make all four required, update the single production call site (`useReleaseDetail.ts:310-324`, which already passes all four) and the test `makeParams` factory, and delete the destructuring defaults.

### WR-07: `maxPages = 20` truncation is silent — a partial walk becomes a settled negative

**File:** `taskflow/src/services/gitlab.ts:373` and `:404-407`; same shape in `fetchSourceBranchMRs` at `:1876` and `:1906`

**Issue:** the loop stops after page 20 and returns `allTags` with no indication the walk was cut short; the caller cannot distinguish "these are all matching tags" from "these are the first 2000". Additionally `if (data.length < perPage) break;` trusts the server to honour `per_page` — an instance capping at a smaller page size terminates the walk after page 1. Either way the result is `mergeBackTagName === null` presented as `tagChannel: 'resolved'` → the branch row's "No matching tag found" sentence and the verdict's `no-mr-no-tag` reason, both derived from an incomplete fetch. That is the category 91-07 set out to eliminate at the transport layer, reintroduced by the cap. The same reasoning applies to a truncated `fetchSourceBranchMRs`, which can drop the merged tracking MR and downgrade a `merged` verdict to `likely-not-merged`.

**Fix:** treat exhausting the cap as a failure, not a result:

```ts
if (page === maxPages && data.length === perPage) {
  throw new Error('Failed to load release tags: result set exceeds page limit');
}
```

### WR-08: `expectedTagName` hard-codes the `v` prefix although `findReleaseTag` also matches a bare version

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:321`; rendered at `ReleaseDetailSidebar.tsx:335-337`

**Issue:** `expectedTagName: matchedVersionNumber ? \`v${matchedVersionNumber}\` : null` yields the tooltip "no tracking MR and no **v33.5.0** tag found", but `findReleaseTag` (`releaseBranch.ts:138-142`) strips an optional leading `v` and would equally have matched a bare `33.5.0` tag. The message names a tag convention that is not the one searched, misdirecting a user whose project tags without the prefix into thinking the wrong pattern was looked for.

**Fix:** state the searched form honestly — `no tracking MR and no tag matching 33.5.0 (with or without a leading v)` — or derive `expectedTagName` from the same matcher used for lookup.

### WR-09: step 5 reports "no tracking MR" for a channel that was never queried

**File:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts:238-244`; rendered at `ReleaseDetailSidebar.tsx:332-338`

**Issue:** when `trackingMRsUnavailable` is `true` (the tracking-MR query is permanently disabled because no branch name is derivable), step 3 deliberately falls through and step 4 finds nothing, so step 5 selects `reason: trackingMRsCheckFailed ? 'check-failed' : 'no-mr-no-tag'` — `trackingMRsUnavailable` is not consulted. The tooltip then reads "no tracking MR and no release tag found", asserting a negative for a query that never executed. Step 10 (`:282-284`) explicitly refuses to make an evidence claim under exactly this flag, calling the guard "a contract, not dead code"; step 5 does not honour the same contract. The verdict *kind* is harmless (`couldnt-verify`), so this is copy-level, not classification-level — hence WARNING.

**Fix:**

```ts
reason: trackingMRsCheckFailed || trackingMRsUnavailable ? 'check-failed' : 'no-mr-no-tag',
```

### WR-10: the branch-row ternary chain's terminal `else` is the action-offering state — a future `BranchState` kind silently invites re-creating a shipped release's branch

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx:213-283`

**Issue:** the chain enumerates seven kinds and lets the final `else` stand for `missing`, which renders the `Create branch` action. TypeScript does not check exhaustiveness of a ternary chain, so adding an eighth `BranchState` kind compiles clean and lands in the "offer to create a branch" arm. In a feature whose entire premise is "never assert or invite an action on unverified state", the safe default should be inert copy, not the only mutating affordance in the row. The same shape exists in the verdict chain (`:289-344`), whose `else` assumes `couldnt-verify` and dereferences `.reason` — that one is at least type-narrowed today.

**Fix:** replace the chain with an extracted component using an exhaustive `switch (branchState.kind)` and a `default: { const _never: never = branchState; return null; }` arm, so an unhandled kind is a compile error rather than a Create-branch button.

## Info

### IN-01: five identical `couldnt-verify / check-failed` return literals

**File:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts:157, 229, 253, 259, 283`
**Issue:** `return { kind: 'couldnt-verify', reason: 'check-failed', expectedTagName };` is duplicated five times; adding a field to that variant means five edits.
**Fix:** `const checkFailed = (): MergeBackVerdict => ({ kind: 'couldnt-verify', reason: 'check-failed', expectedTagName });` declared after destructuring.

### IN-02: dead defensive branch in step 11

**File:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts:291`
**Issue:** `commitsNotInDefault: compareResult ? compareResult.commitCount : 0` — `compareResult === undefined` is fully consumed by steps 6 and 7, so the `: 0` arm is unreachable. A silent `0` would also render "has 0 commits not in develop", a self-contradicting sentence, if it ever were reached.
**Fix:** narrow above (`if (!compareResult) return checkFailed();`) and use `compareResult.commitCount` directly.

### IN-03: formatters invoked twice per render for the same input

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx:299-308`
**Issue:** `formatEvidenceDate` and `formatVerdictDate` are each called once as a truthiness test and again to interpolate — four calls where two values suffice, and two places to keep in sync.
**Fix:** hoist both into consts inside an extracted `MergeBackRowContent`.

### IN-04: nested-ternary chains (carried forward, deferred)

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx:213-283` and `:289-344`; the `released` tooltip at `:260-268` is now a three-level nested ternary inside a ternary arm
**Issue:** re-noted for continuity — accepted tech debt from prior rounds, made one level deeper by 91-09. Correctness risk is covered by WR-10.
**Fix:** (deferred) extract `BranchRowContent` / `MergeBackRowContent` with early-return switches.

### IN-05: `findReleaseTag` picks non-deterministically when both `33.5.0` and `v33.5.0` exist

**File:** `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts:138-142`
**Issue:** `tags.find(...)` returns whichever form GitLab happens to list first, so the displayed tag name can change between fetches. The resolver's WR-02 work went out of its way to make MR selection deterministic for exactly this reason; the tag matcher was not given the same treatment.
**Fix:** collect all matches and prefer the `v`-prefixed spelling (or sort lexicographically) before returning.

### IN-06: produced-but-never-consumed data and props

**File:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts:89, 208`; `ReleaseDetailSidebar.tsx:96`; `ReleaseDetailPage.tsx:326`
**Issue:** `MergeBackVerdict.mrUrl` is populated at `:208` and read nowhere in `src/` — D-12/D-13 forbid the link that would have used it, so it is dead payload. Separately, `ReleaseDetailSidebar` destructures `matchedMilestone: _matchedMilestone` and discards it while `ReleaseDetailPage` still passes it.
**Fix:** either drop `mrUrl` from the variant and the `matchedMilestone` prop from both sides, or add a comment recording that `mrUrl` is retained deliberately for a future non-sidebar consumer.

### IN-07: coverage gaps and a copy inconsistency around the tag channel

**File:** `taskflow/src/services/gitlab.test.ts:818-920`; `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx:640-745`; `ReleaseDetailSidebar.tsx:266`
**Issue:** untested paths where a partial/absent result can still be presented as settled: the `maxPages = 20` truncation (WR-07), a 200 array of malformed elements (CR-01), a non-JSON 200 body (WR-05), and the "GitLab configured but token unavailable" path (WR-04). Separately, the new pending tooltip uses a U+2026 ellipsis ("Checking for a matching tag…") while every other string in the file uses ASCII "Loading..." — inconsistent copy in adjacent rows.
**Fix:** one service test per uncovered transport path, one hook test that makes `readSecret` reject and asserts the row terminates rather than staying pending, and pick one ellipsis convention.

---

_Reviewed: 2026-08-12T00:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
