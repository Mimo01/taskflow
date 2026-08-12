---
phase: 91-post-release-merge-back-verification
fixed_at: 2026-08-12T07:20:00Z
review_path: .planning/phases/91-post-release-merge-back-verification/91-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 91: Code Review Fix Report

**Fixed at:** 2026-08-12T07:20:00Z
**Source review:** `.planning/phases/91-post-release-merge-back-verification/91-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (1 Critical + 10 Warning; Info deferred per `fix_scope: critical_warning`)
- Fixed: 11
- Skipped: 0

**Verification (run against the full working tree after the last commit):**
- `npx tsc --noEmit` — clean, exit 0
- `npx vitest run` on the affected suites (`gitlab.test.ts` + all of `release-detail/`) — 13 files, **472 tests, all passing**
- Full suite (via the repo's pre-commit hook, on every one of the 10 commits) — **2479 passed, 2 skipped, 13 todo**
- `npx biome check` on the 5 changed non-test source files — zero diagnostics, exit 0

## Fixed Issues

### CR-01: `searchProjectTags` validated the array wrapper but not its elements

**Files modified:** `taskflow/src/services/gitlab.ts`, `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts`, `taskflow/src/services/gitlab.test.ts`, `taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts`
**Commit:** `b1564fee`
**Applied fix:** element-level validation in the transport guard (`data.some((tag) => typeof tag?.name !== 'string')`), so `["<html>…"]` and `[{ message: … }]` now reject as "unexpected response shape" instead of reaching the render phase. Added the reviewer's defence-in-depth `typeof t === 'string'` predicate in `findReleaseTag`. Three new tests: a 200 array of error objects, a 200 array of strings, and a `findReleaseTag` call with mixed malformed elements asserting it does not throw.

### WR-01: `resolveBranchState`'s `tagChannel` was optional with a `'resolved'` default

**Files modified:** `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts`, `taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts`
**Commit:** `6810d76d`
**Applied fix:** made the param required, removed the destructuring default, and corrected both doc comments (the variant's claim of "type-system enforcement" was false while the sole producer defaulted the value). Updated 11 test call sites plus the `base` fixture. Replaced the test that pinned the unsafe default ("defaults tagChannel to resolved when the param is omitted") with a `@ts-expect-error` test asserting an omission no longer compiles.

### WR-02: no test at the layer where the bug actually lived

**Files modified:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx`
**Commit:** `251cf723`
**Applied fix:** added `branchState` assertions to the existing deferred and rejecting tag-query tests, covering all three derivation outcomes (`pending`, `failed`, and `resolved` only after the channel settles). Confirmed adversarial: deleting `tagChannel` from the hook's `resolveBranchState` call now fails 2 tests (it previously left the suite green).

### WR-03: the tag-channel distinction existed only in a `title` attribute

**Files modified:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx`, `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx`
**Commit:** `15e53a06` (committed with WR-10 — both restructure the same row)
**Applied fix:** the row now renders a visible muted marker (`· checking tag...` / `· tag check failed`) so the three states differ in visible text, not just on hover. New test asserts all three produce distinct `textContent`.

**Deviation from the suggested fix:** the review proposed `aria-label={tooltipText}` on the row span. `aria-label` is not supported on a role-less `<span>` — assistive tech drops it and biome flags it (`lint/a11y/useAriaPropsSupportedByRole`), which would have introduced a new diagnostic into a previously clean file. Used a visually-hidden sibling (`className="sr-only"`, an established pattern in this codebase) carrying the full explanatory sentence instead. Kept outside the `data-testid` span so the visible-text assertions stay honest.

### WR-04: pending/unavailable flags ignored the credential half of the `enabled` gate

**Files modified:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts`, `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts`, `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx`, `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts`
**Commit:** `3ebc8ddb`
**Applied fix:** introduced the single `gitlabReady` predicate and rewrote every `enabled` gate and derived flag from it. Added `defaultBranchUnavailable` as a resolver param (mirroring the existing `trackingMRsUnavailable`) so step 2 terminates at `couldnt-verify` rather than `loading`.

**One addition beyond the suggested fix:** the review's `tagLookupPending` change alone would have made a credential-less tag channel fall through to `tagChannel: 'resolved'` — i.e. swapped "pinned at Loading" for the worse "checked, and there is no tag". Added `tagLookupUnavailable`, folded into a `tagChannelFailed` signal, so an unqueryable channel terminates as a *failure* (consistent with `trackingMRsUnavailable`) rather than as a settled negative.

New hook test seeds milestone data into the query cache and rejects `readSecret('gitlab-pat')` — confirmed adversarial (it times out at `loading` without the resolver fix).

### WR-05: `await response.json()` sat outside the transport `try`

**Files modified:** `taskflow/src/services/gitlab.ts`, `taskflow/src/services/gitlab.test.ts`
**Commit:** `92f22096`
**Applied fix:** wrapped parsing in its own `try` in all three cited functions (`searchProjectTags`, `fetchSourceBranchMRs`, `compareRefs`), plus an `Array.isArray` shape guard in `fetchSourceBranchMRs` which had none. Three new tests feed a `json()` that throws a realistic V8-shaped `SyntaxError` containing HTML and assert the thrown message is exactly the normalised string and contains neither `<html` nor the body text.

### WR-06: every channel-health param was optional with a `false` default

**Files modified:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts`, `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts`
**Commit:** `0ce3fc54`
**Applied fix:** made `defaultBranchCheckFailed`, `trackingMRsUnavailable`, `tagLookupPending` and `tagCheckFailed` required, deleted all four destructuring defaults, and moved the healthy baseline into the test `makeParams` factory. Replaced the "default-compatibility lock" test (which actively cemented the unsafe defaults) with a `@ts-expect-error` test proving an omission no longer compiles, plus a separate test keeping the genuine D-01 `no-mr-no-tag` baseline.

### WR-07: `maxPages = 20` truncation was silent

**Files modified:** `taskflow/src/services/gitlab.ts`, `taskflow/src/services/gitlab.test.ts`
**Commit:** `2d316fbf`
**Applied fix:** exhausting the cap with a full final page now throws in both `searchProjectTags` and `fetchSourceBranchMRs`. Updated both JSDoc `@throws` blocks. The pre-existing test `"WR-06: a server that always returns a full page stops after exactly 20 requests"` asserted the truncated 2000-element *result* — rewritten to assert the walk still stops at 20 requests but now rejects.

**Residual (not fixed, deliberately):** the review's secondary point that `if (data.length < perPage) break;` trusts the server to honour `per_page` is unaddressed. Fixing it properly means switching to GitLab's `x-next-page`/`x-total-pages` headers, which the existing test doubles (plain `{ok, status, json}` literals with no `headers`) do not model — a change wider than this finding and better done deliberately. Noted for a follow-up.

### WR-08: `expectedTagName` hard-coded the `v` prefix

**Files modified:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts`, `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts`, `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx`, `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx`
**Commit:** `47d60615`
**Applied fix:** took both halves of the reviewer's suggestion — `expectedTagName` now carries the bare version (the form `findReleaseTag` actually matches), and the tooltip reads `no tracking MR and no tag matching 33.7.0 (with or without a leading v) found`. Documented the field's contract on the `couldnt-verify` variant so a future renderer does not present it as a literal tag name.

### WR-09: step 5 reported "no tracking MR" for a channel that was never queried

**Files modified:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts`, `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts`
**Commit:** `32e25765`
**Applied fix:** `reason: trackingMRsCheckFailed || trackingMRsUnavailable ? 'check-failed' : 'no-mr-no-tag'`, exactly as suggested, plus a correction to step 3's now-stale comment (which still described the old `no-mr-no-tag` outcome as correct). The existing CR-03 test asserting `no-mr-no-tag` under `trackingMRsUnavailable` was updated to `check-failed`; added a companion test locking the healthy-channel case to `no-mr-no-tag` so the D-01 behaviour is still pinned.

### WR-10: the branch-row ternary chain's terminal `else` was the action-offering state

**Files modified:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx`, `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx`
**Commit:** `15e53a06`
**Applied fix:** extracted `BranchRowContent` with an exhaustive `switch (branchState.kind)`; `missing` is now an explicit case and the `default` arm is inert (`return null`). Used an `assertNeverBranchState(_state: never): null` helper rather than an inline `const _never: never` — the inline form fails the project's `noUnusedLocals`. Verified the guard bites: temporarily adding an eighth `BranchState` kind produces `error TS2345: Argument of type '{ kind: "archived"; … }' is not assignable to parameter of type 'never'` at the sidebar, where it previously compiled clean into the Create-branch arm.

**Note:** the verdict chain at the bottom of the same row (also flagged in WR-10's closing sentence, and in IN-04) was left as-is — it is type-narrowed today and the review classes it as the lesser half. That remains as accepted tech debt.

## Skipped Issues

None.

## Not in scope

IN-01 through IN-07 were not attempted (`fix_scope: critical_warning`). Two of them were incidentally addressed while fixing neighbours:
- **IN-07 (ellipsis inconsistency):** the pending tooltip's U+2026 was changed to ASCII `...` for consistency with the adjacent "Loading..." strings, as part of the WR-03/WR-10 row rewrite.
- **IN-07 (coverage gaps):** the four uncovered transport/credential paths it lists are now tested, as a by-product of CR-01, WR-04, WR-05 and WR-07.

---

_Fixed: 2026-08-12T07:20:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
