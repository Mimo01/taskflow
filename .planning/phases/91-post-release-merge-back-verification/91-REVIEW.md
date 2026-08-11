---
phase: 91-post-release-merge-back-verification
reviewed: 2026-08-11T22:20:00Z
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
  warning: 4
  info: 6
  total: 11
status: issues_found
---

# Phase 91: Code Review Report

**Reviewed:** 2026-08-11T22:20:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Re-review after gap closure (plans 91-04/91-05/91-06). Every prior finding was
re-verified against the file on disk, not against the summaries.

Confirmed closed by the gap-closure plans (not carried forward):

- **CR-01** — `TrackingMR` now projects `target_branch`
  (`mergeBackVerification.ts:39`) and step 4 requires
  `mr.target_branch === defaultBranch` (L175-177), with unit and hook-level
  regression tests (`mergeBackVerification.test.ts:222-254`,
  `useReleaseDetail.test.tsx:563-591`).
- **CR-02** — `compareRefs` rejects on a non-array `diffs`/`commits`
  (`gitlab.ts:1945-1952`), tested at `gitlab.test.ts:786-814`.
- **CR-03 / CR-04** — `trackingMRsUnavailable` and `defaultBranchCheckFailed`
  now terminate at `couldnt-verify` (`mergeBackVerification.ts:145-163`,
  wired at `useReleaseDetail.ts:284-298`), with hook tests at
  `useReleaseDetail.test.tsx:527-559`.
- **WR-02** — deterministic `reduce` on `merged_at` then `iid`
  (`mergeBackVerification.ts:182-191`).
- **WR-03** — hook tests now assert terminal verdict kinds, not tautologies.
- **WR-05** — the D-12 lock scopes to `data-testid="meta-row-merged-back"`
  (`MetaRow.tsx:5-7`, `ReleaseDetailSidebar.test.tsx:256-263`).
- **WR-06** — `fetchSourceBranchMRs` is a bounded `for` loop with
  `maxPages = 20` (`gitlab.ts:1853-1856`), tested at `gitlab.test.ts:676-686`.

Baseline health: `npx tsc --noEmit` clean; 224 tests across the four touched
test files pass.

Still open / newly found:

1. **The tag evidence channel still has no in-flight and no failure signal**
   (prior WR-01, not closed and not recorded as deferred in
   `91-VERIFICATION.md`, whose `deferred:` list is empty). It is the only one of
   the four channels without a loading guard, so the row renders a terminal,
   factually unverified "no `vX.Y.Z` tag found" claim before the tag query
   resolves, and renders the same claim permanently when the tag fetch fails.
   Escalated to BLOCKER because the wrong verdict is user-visible for a full
   round-trip and then *reverts to `Loading...`*.
2. The CR-03 fix introduced an asymmetry: step 10 admits the gap for
   `trackingMRsCheckFailed` but not for `trackingMRsUnavailable`, so the
   resolver can emit the accusatory `likely-not-merged` from a single channel.
   Unreachable today only via an undocumented invariant in the hook.
3. Four files touched by the gap-closure commits now fail `biome check`
   formatting; all four were clean at `HEAD~8` (verified by running biome over
   temp copies of the pre-phase blobs — no stash).
4. Prior WR-07 (five-branch JSX ternary + duplicated date formatting) and the
   info-tier items (inline query key, `catch {}` error relabelling, service
   duplication) are unchanged.

No structural pre-pass was supplied for this review.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The tag channel has no loading or failure signal — the row states "no vX.Y.Z tag found" before (and without) ever knowing

**File:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts:203-211`, `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:200-219`, `taskflow/src/services/gitlab.ts:352-385`

**Issue:**
Three of the four evidence channels have an explicit in-flight guard —
`defaultBranch` (step 2, L145-150), `trackingMRs` (step 3, L161-163) and
`compareResult` (step 6, L214-216). The tag channel has none. The resolver only
receives the *resolved* `tagName`:

```ts
// useReleaseDetail.ts:216
const mergeBackTagName = findReleaseTag((releaseTags ?? []).map((t) => t.name), matchedVersionNumber);
```

While the `gitlab-release-tags` query is in flight, `releaseTags` is
`undefined`, so `mergeBackTagName` is `null`, and step 5 fires immediately:

```ts
// mergeBackVerification.ts:205
if (tagName === null) {
  return { kind: 'couldnt-verify', reason: trackingMRsCheckFailed ? 'check-failed' : 'no-mr-no-tag', expectedTagName };
}
```

Concrete sequence for a released version whose tracking MR is closed/absent
(the branch-deleted case this feature exists for): the tracking-MR query
resolves `[]` → the row renders `Couldn't verify` with the tooltip
`no tracking MR and no v33.5.0 tag found` → the tag query resolves → the compare
query (gated on the *resolved* tag, L267-273) only then starts → the row reverts
to `Loading...` → the row finally renders `Merged into develop`. The user is
shown a terminal negative claim, then a loading state, then the opposite
verdict. The wrong state persists for at least one full tag-fetch round-trip
because the compare query is sequenced after the tag query.

Worse, the claim is unfalsifiable on failure: `searchProjectTags` swallows every
error and returns `[]` (`gitlab.ts:374, 380-382`). A 500/timeout/permission
failure on the tag endpoint is therefore indistinguishable from "the tag does
not exist", and the row permanently asserts `no ... tag found` — precisely the
class of unverified negative claim D-01 and the module header forbid, and for
which the `reason: 'check-failed'` branch already exists but is unreachable from
the tag channel.

No test covers a slow or failing `searchProjectTags`:
`useReleaseDetail.test.tsx:148` resolves it instantly, and
`mergeBackVerification.test.ts` cannot exercise a "tag pending" input because
the parameter does not exist.

**Fix:** thread the tag channel's two states into the resolver the same way the
other three are threaded.

```ts
// mergeBackVerification.ts — params
tagLookupPending?: boolean;   // tag query enabled and still in flight
tagCheckFailed?: boolean;     // tag query errored / could not be completed

// insert before step 5
if (tagName === null && tagLookupPending) return { kind: 'loading' };
if (tagName === null && tagCheckFailed) {
  return { kind: 'couldnt-verify', reason: 'check-failed', expectedTagName };
}
```

```ts
// useReleaseDetail.ts
const {
  data: releaseTags,
  isError: tagsErrored,
} = useQuery({ /* ...unchanged... */ });

const tagLookupPending = needsTagLookup && releaseTags === undefined && !tagsErrored;
```

`searchProjectTags` must also stop swallowing errors for this caller — either
add a variant that rejects, or return a discriminated
`{ status: 'ok' | 'failed'; tags: GitLabTag[] }` so `tagCheckFailed` is real
rather than inferred. Add a hook test with a slow and with a rejecting
`searchProjectTags`, asserting the verdict is `loading` then terminal, and never
`couldnt-verify/no-mr-no-tag` while the lookup is unresolved.

## Warnings

### WR-01: Step 10 admits the gap for a failed MR channel but not for an unavailable one

**File:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts:236-249`, `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:284`

**Issue:** The CR-03 fix lets `trackingMRsUnavailable` fall through step 3, but
step 10 — whose documented rationale (planner call P-04) is "a non-empty diff
plus an unknown MR channel is not enough to put 'Likely not merged' on a
release" — only tests `trackingMRsCheckFailed`:

```ts
if (trackingMRsCheckFailed) return { kind: 'couldnt-verify', ... };
return { kind: 'likely-not-merged', ... };
```

A permanently-disabled channel is exactly as unknown as an errored one, so
`trackingMRsUnavailable: true` + a real tag + `diffCount > 0` emits the
accusatory `likely-not-merged` on the strength of one channel. Today this is
unreachable only because `deriveReleaseBranchName` and
`extractVersionFromMilestoneTitle` share one regex (`releaseBranch.ts:43-59`),
so `releaseBranchName === null` implies `matchedVersionNumber === null` implies
`tagName === null` and step 5 intercepts. That coupling is nowhere asserted; the
resolver is a public pure module whose parameter surface permits the state, and
`mergeBackVerification.test.ts:335-367` only covers `trackingMRsUnavailable`
with `tagName: null` and with `diffCount: 0`.

**Fix:**

```ts
// step 10
if (trackingMRsCheckFailed || trackingMRsUnavailable) {
  return { kind: 'couldnt-verify', reason: 'check-failed', expectedTagName };
}
```

plus a unit case: `trackingMRsUnavailable: true`, `tagName: 'v33.7.0'`,
`compareResult: { diffCount: 4, commitCount: 12, timedOut: false }` →
`couldnt-verify`, explicitly not `likely-not-merged`.

### WR-02: Gap-closure commits regressed `biome check` on four previously-clean files

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:151-154`, `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx:121,137`, `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts:281-286,296-299,310-312`, `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx:261,278`

**Issue:** `npx biome check` reports formatter diffs in all four files. Running
the same command against copies of the `HEAD~8` blobs of those exact files
returns "Checked 4 files … No fixes applied" — so these are *new* files added to
the flagged set by this phase, which is the meaningful lint gate here (the
absolute diagnostic count drifts; newly-flagged files do not). Example:

```
useReleaseDetail.ts:151  const {
                           data: project,
                           isError: defaultBranchCheckFailed,
                         } = useQuery({
        should be:       const { data: project, isError: defaultBranchCheckFailed } = useQuery({
```

**Fix:** `cd taskflow && npx biome check --write src/routes/dashboard/release-detail/`, then re-run `npx biome check` over the phase's file set to confirm no newly-flagged files.

### WR-03: Sidebar tests type-erase every prop, so verdict fixtures are unchecked

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx:28`

**Issue:**

```ts
function renderSidebar(overrides: { branchState: BranchState } & Record<string, unknown>) {
```

Every `mergeBackVerdict` fixture in the Merged-back suite (L165-309) is spread
in as `unknown`, so none of them is checked against `MergeBackVerdict`. Adding a
required field to a verdict variant, renaming `via`, or misspelling
`commitsNotInDefault` in a fixture produces no compile error — the suite would
keep passing while asserting against a shape the component no longer receives.
This is the same hidden-coupling class `mrChannelKeys.ts`'s header documents.
The `satisfies MergeBackVerdict` at L40 covers only the default value.

**Fix:**

```ts
type SidebarProps = React.ComponentProps<typeof ReleaseDetailSidebar>;
function renderSidebar(overrides: Partial<SidebarProps> & { branchState: BranchState }) { ... }
```

### WR-04: Five-branch nested ternary with duplicated date formatting in the Merged-back row

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx:285-340`

**Issue:** Unchanged from the prior review (WR-07). The row is a five-arm nested
ternary in JSX where `couldnt-verify` is the implicit `else`, and both
formatters are invoked twice on the same input:

```tsx
title={formatEvidenceDate(mergeBackVerdict.mergedAt)
  ? `via !${mergeBackVerdict.mrIid}, merged ${formatEvidenceDate(mergeBackVerdict.mergedAt)}`
  : `via !${mergeBackVerdict.mrIid}`}
...
{formatVerdictDate(mergeBackVerdict.mergedAt) && ` · ${formatVerdictDate(mergeBackVerdict.mergedAt)}`}
```

The implicit-`else` arm is the risk: any future verdict kind that is not
`merged`, `likely-not-merged` or `loading` silently renders as "Couldn't
verify"; only the `.reason` property access makes TypeScript object.

**Fix:** extract `MergeBackRow({ verdict }: { verdict: MergeBackVerdict })` with
`switch (verdict.kind)` and a `default: assertNever(verdict)`, computing
`const verdictDate = formatVerdictDate(...)` / `const evidenceDate = formatEvidenceDate(...)`
once per branch.

## Info

### IN-01: Dead `matchedMilestone` prop still threaded into the sidebar

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx:69,96`, `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:326`
**Issue:** `matchedMilestone` is declared in the props interface, destructured as
`_matchedMilestone`, never read, and still passed by the page.
**Fix:** drop it from the interface, the destructure and the call site.

### IN-02: The tracking-MR query key is an inline literal

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:236`
**Issue:** `['gitlab-mr-source-branch', activeGitlabProject, releaseBranchName]`
is inlined while `mrChannelKeys.ts` states "Every producer and every consumer of
these keys must go through this module. Do not re-inline the literals." This
cache is also never patched or invalidated by `useMrFixMutation` (practically
harmless: an MR sourced from `release/X` is not a retarget target).
**Fix:** add `mrChannelKeys.sourceBranch(projectId, branchName)`, or document
in-place why this cache sits outside the channel contract.

### IN-03: Unreachable defensive branch in step 11

**File:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts:248`
**Issue:** `commitsNotInDefault: compareResult ? compareResult.commitCount : 0` —
steps 6 and 7 guarantee `compareResult` is defined here. The fallback can only
ever surface as the nonsensical tooltip "has 0 commits not in develop" if the
precedence order is later broken.
**Fix:** narrow above the return, or read `compareResult.commitCount` directly.

### IN-04: Both `via` variants share one `data-testid`

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx:294,309`
**Issue:** `merge-back-merged` is used for `tracking-mr` and `content-compare`,
so tests can only tell them apart by tooltip text, though P-02 gives them
deliberately different evidence semantics.
**Fix:** `data-testid={`merge-back-merged-${mergeBackVerdict.via}`}` (or a
`data-via` attribute) and assert on it.

### IN-05: `MergeBackCompareInput` duplicates `GitLabCompareResult` field-for-field

**File:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts:46-50`, `taskflow/src/services/gitlab.ts:437-441`
**Issue:** Two structurally identical interfaces kept in sync by hand; the
service-free constraint forbids only a *value* import, and the file already uses
`import type { GitLabMR }` (L35).
**Fix:** `export type MergeBackCompareInput = Pick<GitLabCompareResult, 'diffCount' | 'commitCount' | 'timedOut'>` via `import type`, matching the `TrackingMR` precedent one line above.

### IN-06: `catch {}` relabels every transport failure as "check the base URL"

**File:** `taskflow/src/services/gitlab.ts:1869-1871,1931-1933`
**Issue:** Unchanged from the prior review (IN-02). DNS failure, TLS error,
abort and proxy reset all surface as
`Cannot reach ${baseUrl} — check the base URL`, discarding the cause. Consistent
with the rest of the file, so this is a file-wide convention rather than a
phase-specific defect.
**Fix:** if revisited file-wide, preserve the cause via
`new Error(msg, { cause: err })`.

---

_Reviewed: 2026-08-11T22:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
</content>
