---
phase: 87-release-detail-decomposition
reviewed: 2026-08-10T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/release-detail/DescriptionsSection.tsx
  - taskflow/src/routes/dashboard/release-detail/EditReleaseModal.tsx
  - taskflow/src/routes/dashboard/release-detail/IssuesSection.tsx
  - taskflow/src/routes/dashboard/release-detail/LabelSummarySection.tsx
  - taskflow/src/routes/dashboard/release-detail/MetaRow.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx
  - taskflow/src/routes/dashboard/release-detail/UnmatchedMRsSection.tsx
  - taskflow/src/routes/dashboard/release-detail/releaseSummaries.test.ts
  - taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts
  - taskflow/src/routes/dashboard/release-detail/useEditRelease.ts
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/stores/breadcrumb.store.ts
findings:
  critical: 0
  warning: 7
  info: 5
  total: 12
status: issues_found
---

# Phase 87: Code Review Report

**Reviewed:** 2026-08-10
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 87 decomposed `ReleaseDetailPage.tsx` (1518 → 322 lines) into 13 files under
`release-detail/`. I diffed the post-refactor tree against the pre-refactor file
(`git show 4af774ae:taskflow/src/routes/dashboard/ReleaseDetailPage.tsx`) line by line and
traced every extracted prop, handler, query key, `enabled` guard and render condition.

**Behavior-preservation verdict:** the relocation itself is clean. Every query key
(`jira-fix-versions`, `jira-version-counts`, `jira-fixversion-issues`, `gitlab-milestones`,
`gitlab-milestone-mrs`, `gitlab-recent-project-mrs`), every `staleTime`, every `enabled`
predicate, and every JSX conditional maps 1:1 to the original. Boolean props (`hasMrs`,
`hasIssues`, `milestoneMRsLoaded`, `hasReleaseDate`, `showMilestoneSection`,
`isSaveDisabled`) evaluate to exactly the expressions they replaced. Hook call order is
stable, the `if (!versionId) return null` early exit still sits after all hooks, and no
`useEffect`/dependency array changed. Fragment-vs-element boundaries preserve the
`space-y-6 > *` cascade, so no layout drift. `npx tsc --noEmit`, `biome check` on the 14
in-scope files, and `vitest run release-detail` (13 tests) all pass.

No BLOCKER-severity defect was proven. The findings below are real quality and robustness
problems, several of which are consequences of the extraction stopping half-way: a shared
service function was created but its second call site was never migrated, a prop was carried
across the boundary and then deliberately discarded, and the hook exports six values nobody
consumes. The most intricate extracted logic (`resolveGitLabMatch`'s fuzzy tie-break,
`buildWrongMilestoneMap`) has zero test coverage despite the phase adding a test file
specifically for this module.

## Warnings

### WR-01: `fetchVersionIssueCounts` was promoted to `services/jira.ts` but `ReleasesTab` still runs its own divergent copy on the same query key

**File:** `taskflow/src/services/jira.ts:1139-1183`, `taskflow/src/routes/dashboard/ReleasesTab.tsx:35-71,185-189`

**Issue:** The phase created the shared, exported `fetchVersionIssueCounts` +
`VersionIssueCounts` in `services/jira.ts`, and `useReleaseDetail.ts:66` caches it under
`['jira-version-counts', versionId]`. `ReleasesTab.tsx:185` writes the **same cache key**
with a **different local function** returning a **different shape**
(`{issuesFixed, issuesAffected, issuesTotal}` vs `{issuesFixed, issuesTotal}`) via **raw
`fetch`** rather than `apiFetch`, and **without** the `/^\d+$/` versionId guard that the new
service function has (`jira.ts:1163`).

Consequences, all reachable today:
- Whether a given counts entry got the 15s timeout, devtools redaction, and 401
  `markDisconnected` instrumentation is now decided by *which page mounted first* — the
  detail page can render counts fetched by the un-instrumented ReleasesTab path.
- The numeric-versionId JQL guard is bypassed on the ReleasesTab path, so the guard the phase
  added provides no actual protection for the shared cache entry.
- `VersionIssueCounts` now exists twice with two shapes (`jira.ts:1140`,
  `ReleasesTab.tsx:35`); the TS type at the detail-page consumer is a runtime lie.

**Fix:** delete the local copy in `ReleasesTab.tsx` (lines 35-71) and the now-unused `fetch`
import, and use the shared service:

```ts
import { fetchFixVersions, fetchVersionIssueCounts } from '@/services/jira';
// ...
queryFn: () => fetchVersionIssueCounts(jiraBaseUrl ?? '', jiraToken ?? '', v.id),
```

`issuesAffected` is never read in `ReleasesTab` (`MatchedVersion` only carries `issuesFixed`
/ `issuesTotal`), so dropping it is safe.

---

### WR-02: `ReleaseDetailSidebar` accepts `matchedMilestone` and immediately throws it away

**File:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx:20,40`;
passed at `ReleaseDetailPage.tsx:281`

**Issue:** The prop is declared (`matchedMilestone: GitLabMilestone | null`) and then
destructured as `matchedMilestone: _matchedMilestone` — the underscore rename exists purely to
silence the unused-variable lint. Nothing in the sidebar body reads it. This is dead data
crossing a component boundary; worse, an underscore-prefixed prop is exactly the shape of a
*dropped* prop and reads as a bug during future maintenance ("was this supposed to be
rendered?"). Confirmed against the original: the pre-refactor sidebar markup
(orig lines 1104-1302) never referenced `matchedMilestone` either, so nothing was lost — but
then the prop should not exist.

**Fix:** remove `matchedMilestone` from `ReleaseDetailSidebarProps`, from the destructuring,
and from the call site in `ReleaseDetailPage.tsx:281`.

---

### WR-03: `useReleaseDetail` exports six values no caller consumes

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:167-196`

**Issue:** The returned object includes `milestones`, `milestoneWindow`, `fixVersionIssues`,
`missingRows`, and `storyPointsFieldKey`, none of which are destructured by
`ReleaseDetailPage.tsx:53-77` (the hook's only consumer). `fixVersionIssues` in particular is
a near-duplicate of the already-exported `releaseIssues` (`= fixVersionIssues ?? []`), which
invites a future caller to pick the wrong one and reintroduce an `undefined` check that the
hook already handles. An over-wide return surface defeats the point of the extraction: the
hook's contract no longer documents what the page actually needs.

**Fix:** trim the return to the 22 values the page destructures. If any of the extras are kept
deliberately for Phase 88, add a comment naming the intended consumer.

---

### WR-04: The most intricate extracted functions have no test coverage

**File:** `taskflow/src/routes/dashboard/release-detail/releaseSummaries.test.ts`

**Issue:** `releaseSummaries.ts` exports 10 functions; the test file covers 7 of the simple
aggregators and skips the three with real branching:
- `resolveGitLabMatch` (lines 62-105) — exact-wins-and-breaks, fuzzy closest-`due_date`
  tie-break, `NaN`→`POSITIVE_INFINITY` fallback for a milestone with no `due_date`. This is
  the logic whose ordering bug the original inline comment explicitly warns about
  ("an order-dependent fuzzy match could otherwise target the wrong milestone"), and it is
  now trivially unit-testable — yet untested.
- `matchIssuesToMRs` (lines 114-135) — the matched/unmatched partition. Note the un-asserted
  behavior that when two MRs carry the same ticket key, the **last** one silently wins
  (`releaseMrByIssue.set` overwrite) and the earlier MR is **not** pushed to `unmatchedMRs`,
  so it disappears from the UI entirely.
- `buildWrongMilestoneMap` (lines 150-168) — the GGX-WARN-01 null-milestone-is-a-warn rule and
  the id-based comparison.

Extracting pure functions and then not testing the hard ones spends the refactor's cost
without collecting its benefit.

**Fix:** add cases for: exact match short-circuits mid-list; two fuzzy candidates → nearer
`due_date` wins; fuzzy candidate with `due_date: null` loses to any dated candidate; an MR
whose key is not in the issue set lands in `unmatchedMRs`; two MRs sharing one key (assert and
lock in the intended winner); `buildWrongMilestoneMap` returns empty when
`matchedMilestone` is null, and flags an MR whose `milestone` is `null`.

---

### WR-05: `fetchVersionIssueCounts` reports `0 / 0 done` on an auth failure, and its doc comment contradicts the code

**File:** `taskflow/src/services/jira.ts:1145-1183`

**Issue:** Two related problems in the newly-exported function:
1. A 401/403 from Jira takes the `r.ok ? ... : { total: 0 }` branch, so the caller receives
   `{issuesFixed: 0, issuesTotal: 0}` and `IssuesSection.tsx:44-47` renders a confident
   "0 / 0 done" badge for a release that may have hundreds of issues. Under the new
   `apiFetch` routing (D-12a), the 401 also silently flips `jiraConnected` to false
   (`apiFetch.ts:72`) — so the UI now has the failure signal but the counts still lie. The
   progress bar is suppressed (`issuesTotal > 0` guard), which makes the "0 / 0" read as real
   data rather than an error.
2. The docblock asserts "Never throws on an HTTP failure ... this always resolves to a counts
   object", but line 1163 throws synchronously for a non-numeric `versionId` (reachable from a
   hand-typed `/release/abc` URL). A caller trusting the doc will not wrap it.

**Fix:** distinguish "zero issues" from "could not read": return
`{ issuesFixed: 0, issuesTotal: 0, degraded: true }` (or throw on non-ok so react-query
surfaces `isError`) and have `IssuesSection` render a dash instead of `0 / 0` when degraded.
At minimum, correct the docblock to state the versionId-validation throw.

---

### WR-06: Repeated ticket-key clicks in the Unmatched MRs list push duplicate breadcrumb entries, producing duplicate React keys

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:162-167`;
rendered by `ReleaseHeader.tsx:28-29`

**Issue:** `handleNavigateToIssueFromMR` pushes `/release/${versionId}` unconditionally, while
the sibling `seedReleaseBreadcrumb` (lines 141-148) performs the *same* push behind an
idempotency check. Sequence: click an issue row (seeds `/release/:id` via
`onSeedBreadcrumb`, peek opens, no navigation) → click a ticket key inside an unmatched MR
title → a second identical `/release/:id` entry is appended. `ReleaseBreadcrumbHeader` then
renders `trail.map(... key={entry.path})` with two children sharing one key: React logs a
duplicate-key warning and the release name appears twice in the trail.

The extraction preserved this from the original (orig lines 1020-1027), but it is now an
explicitly named handler that visibly diverges from the idempotent seeder two functions
above it — the asymmetry is a defect, not a style choice.

**Fix:** reuse the idempotent seeder:

```ts
const handleNavigateToIssueFromMR = (key: string) => {
  seedReleaseBreadcrumb();
  navigate(`/issue/${key}`);
};
```

(and, defensively, key the breadcrumb map on `${entry.path}-${i}`).

---

### WR-07: `storyPointsFieldKey` is interpolated into the search URL without encoding

**File:** `taskflow/src/services/jira.ts:1208-1220`

**Issue:** `fields` is built by joining `storyPointsFieldKey` (from
`settings.store.ts:319`, set by the runtime field-resolution query in `main.tsx:95`) and then
spliced raw into the query string at line 1220, while the neighbouring `jql` is correctly
`encodeURIComponent`-wrapped. A field key containing `&`, `#`, or a space corrupts the request
or appends attacker-influenced query parameters. The value is server-derived today, so this is
low likelihood — but the function is now a **public export in `services/jira.ts`** callable
with an arbitrary key, which widens the blast radius beyond the single trusted call site it
had while it was file-local.

**Fix:**

```ts
].map(encodeURIComponent).join(',');
```

## Info

### IN-01: `MetaRow` and `ReleaseDetailSidebar` use the `React` global namespace without importing it

**File:** `taskflow/src/routes/dashboard/release-detail/MetaRow.tsx:1`,
`ReleaseDetailSidebar.tsx:16`

`React.ReactNode` / `React.MouseEvent` resolve only through the ambient `@types/react` UMD
global. `UnmatchedMRsSection.tsx:3` does it correctly with `import type React from 'react'`, so
the new directory is internally inconsistent. `tsc` passes today; it breaks the moment the UMD
global is disabled. **Fix:** add `import type React from 'react';` to both, or import
`ReactNode` / `MouseEvent` by name.

---

### IN-02: `MILESTONE_LEEWAY_DAYS` is exported from `releaseSummaries.ts` but `ReleasesTab` still declares its own

**File:** `releaseSummaries.ts:27` vs `ReleasesTab.tsx:147`

The same magic 7 now lives in two places with the constant exported and unused by the second.
The `addDays` closure is duplicated alongside it (`releaseSummaries.ts:41-45` vs
`ReleasesTab.tsx:151-155`). **Fix:** import the constant (and ideally the `addDays` helper)
in `ReleasesTab`.

---

### IN-03: Test fixtures cast through `as unknown as`, disabling type checking of the fixtures

**File:** `releaseSummaries.test.ts:29,58`

`makeMR` / `makeIssue` both end in `as unknown as GitLabMR` / `as unknown as JiraIssue`. If
`GitLabMR` or `JiraIssue` gains a required field or renames one, these tests keep compiling
against a stale shape and give false confidence. **Fix:** build the fixture as a real typed
literal and drop the double cast, or narrow to `Partial<GitLabMR> as GitLabMR` at a single
documented spot.

---

### IN-04: Edit-modal state is not reset when `versionId` changes

**File:** `useEditRelease.ts:37-47`

The route component is not remounted when `/release/:versionId` changes (pinned-tab
navigation between releases), so `editName`/`editDate`/... survive the switch. `startEditing`
re-seeds from the new `version`, so the visible path is safe, but `isEditDirty` (line 98) is
computed from stale form state against the *new* version between the param change and the next
`startEditing` — an Edit button pressed at the wrong moment can present a pre-dirtied form.
Carried over from the pre-refactor code. **Fix:** `useEffect(() => cancelEditing(), [versionId])`,
or key the hook's state on `versionId`.

---

### IN-05: `computeLabelCoverage.labeled` is computed but never asserted or rendered

**File:** `releaseSummaries.ts:218`; consumer `ReleaseDetailSidebar.tsx:147-158`

The sidebar renders `unlabeled.length`, `total`, and `allLabeled`; `labeled` is dead in both
the UI and `releaseSummaries.test.ts:93-105`. Either assert it or drop it from `LabelCoverage`.

---

_Reviewed: 2026-08-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
