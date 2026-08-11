---
phase: 89-three-channel-drift-detection
reviewed: 2026-08-11T09:05:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/ReleasesTab.test.tsx
  - taskflow/src/routes/dashboard/ReleasesTab.tsx
  - taskflow/src/routes/dashboard/release-detail/IssuesSection.tsx
  - taskflow/src/routes/dashboard/release-detail/MrDriftSection.test.tsx
  - taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx
  - taskflow/src/routes/dashboard/release-detail/driftDetection.test.ts
  - taskflow/src/routes/dashboard/release-detail/driftDetection.ts
  - taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
  - taskflow/src/routes/standup-notes/TodayColumn.markdown.test.ts
  - taskflow/src/routes/standup-notes/mrMatching.test.ts
  - taskflow/src/services/gitlab.test.ts
  - taskflow/src/services/gitlab.ts
  - taskflow/src/services/linkEngine.test.ts
  - taskflow/src/services/notifications.test.ts
findings:
  critical: 1
  warning: 12
  info: 6
  total: 19
status: issues_found
---

# Phase 89: Code Review Report

**Reviewed:** 2026-08-11T09:05:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

The pure module (`driftDetection.ts`) is well factored and its documented overrides (D-10/D-11/D-12/D-18) are implemented consistently with their comments; I did not find a defect in the D-10 state gate, the two-part TASK predicate, or the `id`-keyed union. The defects cluster in three places the phase touched hardest: the MR-title key highlighting in `MrDriftSection.tsx` (silently mangles titles for lowercase/space-separated keys), the Channel A window plumbing in `useReleaseDetail.ts` (cold mount fires the ~15MB project-wide MR fetch **twice**, reproduced empirically), and `fetchAllMRPages` in `gitlab.ts` (trusts `x-total-pages` without a continuation check and without bounds, so it can both silently truncate and allocate/loop unboundedly).

Cross-module consistency is also weaker than the docs claim: the Releases list and the detail page resolve the "matched milestone" with two different tie-break rules and two different windows, and the list-page drift count fires on branch drift for a release branch that provably does not exist yet — the same false-positive class that `branchMissing`/`milestoneMissing` were deliberately gated against.

Note: `TodayColumn.markdown.test.ts`, `mrMatching.test.ts`, `linkEngine.test.ts` and `notifications.test.ts` show no changes in this phase's commit range (`5e91952f~1..HEAD`); reviewed lightly, nothing to report.

No structural pre-pass findings were supplied with this review.

## Narrative Findings (AI reviewer)

### Critical

#### CR-01: MR-title key highlighting deletes characters when the extracted key is not a literal substring of the title

**File:** `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx:160-185`
**Issue:** The highlighter assumes every key returned by `extractTicketKeys` appears verbatim in `mr.title`. It does not. `extractTicketKeys` (`linkEngine.ts:41-59`) **uppercases** every key and **normalises space-separated forms** (`"PROJ 123"` → `"PROJ-123"`). For those titles `remaining.indexOf(k)` returns `-1`, and both branches misbehave:

- `if (idx > 0) parts.push(remaining.slice(0, idx))` — false for `-1`, so the leading text is silently dropped;
- `remaining = remaining.slice(idx + k.length)` becomes `slice(k.length - 1)`, chopping `k.length - 1` characters off the front of the *unmatched* text.

Repro: title `"PROJ 123 fix the thing"` → keys `["PROJ-123"]`, `idx = -1`, `remaining.slice(7)` → the row renders `PROJ-123` + `"3 fix the thing"`; the text `"PROJ 12"` is gone. Same for any lowercase key (`"proj-123: fix"`). Titles are the primary identifying text in the drift list, so this is visibly wrong output, not cosmetic. No test covers a non-literal key (`MrDriftSection.test.tsx` only uses `title: 'Fix thing'` / `'Merged thing'`).
**Fix:** Match on a case-insensitive/whitespace-tolerant regex derived from the key, and always guard `idx === -1`:

```tsx
for (const k of keys) {
  const [proj, num] = k.split('-');
  const re = new RegExp(`${proj}[\\s-]${num}`, 'i');
  const m = re.exec(remaining);
  if (!m) continue;              // never slice on a miss
  if (m.index > 0) parts.push(remaining.slice(0, m.index));
  parts.push(
    <button key={k} type="button" onClick={(e) => { e.stopPropagation(); onNavigateToIssueFromMR(k); }}
      className="text-primary hover:underline font-mono">{m[0]}</button>,
  );
  remaining = remaining.slice(m.index + m[0].length);
}
```

### Warnings

#### WR-01: Cold mount issues the project-wide Channel A fetch twice, with two different windows

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:298-347`
**Issue:** `channelAUpdatedAfter` falls back to a 12-month default while `fixVersions` is `undefined`, but the Channel A query's `enabled` guard does **not** include `!!fixVersions`. Whenever the local Stronghold token read (`readSecret`, effect at lines 61-67) resolves before the networked `fetchFixVersions` — the realistic ordering, since one is a local keystore read and the other a Jira REST round trip — the query fires with the default window, then the key changes and the whole thing is fetched again with the derived window.

Reproduced: with `fetchFixVersions` delayed 30 ms (all other mocks unchanged from `useReleaseDetail.test.tsx`), `fetchAllProjectMRs` is called **2** times on a single mount. This is the ~42-page / ~15 MB fetch the entire windowing optimisation exists to avoid, plus a permanently cached wrong-window entry. `useReleaseDetail.test.tsx` Test G/G2 read `mock.calls[0]` and therefore cannot detect it (and may be asserting on the *default* window, not the derived one).
**Fix:** Gate the query on the derived value being real:

```ts
const channelAWindowReady = fixVersions !== undefined;
// ...
enabled: !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && channelAWindowReady,
```
and assert call *count* (not `calls[0]`) in Test G.

#### WR-02: `fetchAllMRPages` can silently truncate when `x-total-pages` under-reports

**File:** `taskflow/src/services/gitlab.ts:1727-1741`
**Issue:** When the header is present and `> 1`, the function fetches exactly pages `2..totalPages` and returns — it never checks whether the *last* fetched page was short. `x-total-pages` is a snapshot taken during page 1; MRs created/updated between page 1 and the final batch (or a proxy/older GitLab that reports a stale or capped count) push records past the advertised last page and they are dropped with no signal. The sequential walk this replaced could not truncate, because it only stopped on a short page. This is the "silent under-report of drift" failure the phase explicitly set out to eliminate; there is no test for a header that under-reports.
**Fix:** After the header-driven batches, continue the short-page walk from `totalPages + 1` when the last page came back full:

```ts
let nextPage = totalPages + 1;
let lastLen = results.at(-1)?.data.length ?? 0;
while (lastLen === MR_PAGE_SIZE) {
  const { data } = await fetchMRPage(buildUrl(nextPage++), baseUrl, token, context, errorLabel);
  allMRs.push(...data);
  lastLen = data.length;
}
```

#### WR-03: `x-total-pages` is trusted unbounded, and the sequential fallback has no page cap

**File:** `taskflow/src/services/gitlab.ts:1729-1750`
**Issue:** Two unbounded paths on server-controlled input:
1. `Array.from({ length: totalPages - 1 }, ...)` — `Number('1e9')` is finite, so a broken/hostile header allocates a billion-element array and hard-kills the webview before a single extra request is made. There is also no integer check (`2.5` yields a truncated batch list).
2. The fallback walk (`while (true)`) has no `maxPages` guard. A server that ignores `page` (or a proxy that keeps returning page 1) loops forever, accumulating into `allMRs` until OOM. Every other paginator in this file bounds itself — `searchProjectTags` (`maxPages = 20`, line 362) and `fetchUserCommits` (`page <= 50`, line 2013) — so this is an inconsistency, not a style call.

**Fix:** `const MR_MAX_PAGES = 200;` then `if (Number.isInteger(totalPages) && totalPages > 1 && totalPages <= MR_MAX_PAGES)` and bound the fallback with `for (let page = 2; page <= MR_MAX_PAGES; page++)`.

#### WR-04: A failed Channel A/B/C query renders as "no drift" with no error surface

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:336-414`, `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx:90-101`
**Issue:** Only `isLoading` is threaded out of the three channel queries; `isError` is discarded. If Channel A 401s or the branch-MR fetch 500s, `allProjectMRs`/`branchTargetedMRs` stay `undefined`, `?? []` swallows it, and the section renders "No merge requests found" or a silently short list with a `0` badge — indistinguishable from a genuinely clean release. `ReleasesTab` gets this right for its sibling signals (gates on `isSuccess`, shows a `branches-error-chip`); the detail page does not.
**Fix:** Return `isErrorDrift = isErrorA || isErrorB || isErrorC` from the hook, pass it into `MrDriftSection`, and render an error/degraded row instead of the empty state when it is set.

#### WR-05: Releases-list drift count fires branch drift for a release branch that does not exist

**File:** `taskflow/src/routes/dashboard/ReleasesTab.tsx:311-314`
**Issue:** `computeRowDriftCount(openMrs, derived, matchedMilestoneId)` is called with the *derived* branch name regardless of whether that branch exists. When the release branch has not been created yet (the common early-cycle state, already flagged separately by `row-missing-branch`), every open MR carrying the release milestone targets `develop`/`main`, so `evaluateBranchDrift` is true for all of them and the row reports "N mismatched" for a branch nobody could have targeted. That is the exact false-positive class `branchMissing` and `milestoneMissing` were gated against (see the CR-01/WR-04 comments at lines 287-296), and it double-reports the missing-branch triangle. `ReleasesTab.test.tsx:741-780` locks the behaviour in (`fetchProjectBranches` resolves `[]`, yet a count is asserted).
**Fix:** Pass the branch name only when it is confirmed present:

```ts
const confirmedBranch = branchPresent ? derived : null;
const driftCount = openMrsLoaded && !version.released
  ? computeRowDriftCount(openMrs ?? [], confirmedBranch, matchedMilestoneId) : 0;
```

#### WR-06: List page and detail page resolve "the matched milestone" by different rules

**File:** `taskflow/src/routes/dashboard/ReleasesTab.tsx:255-269` vs `taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts:79-98`
**Issue:** `ReleasesTab.toMatched` takes the **first** fuzzy candidate encountered (`if (match.type === 'fuzzy' && bestMatch.type === 'none')`), while `resolveGitLabMatch` takes the **closest by due_date** with an explicit deterministic tie-break. The two also fetch different milestone windows (list: min..max of all fix versions ±7d; detail: this version's date ±7d). With more than one milestone in a version's window, the row and the detail page can therefore evaluate drift against *different* milestones and different branch names — producing exactly the "1 here, 4 there" confusion commit `8cf1b802` tried to paper over with wording.
**Fix:** Have `ReleasesTab` call `resolveGitLabMatch` (it already takes a milestone array) instead of hand-rolling the loop, so both surfaces share one tie-break.

#### WR-07: `evaluateMilestoneDrift` uses strict `=== null` where the rest of the module uses `== null`/`?.`

**File:** `taskflow/src/routes/dashboard/release-detail/driftDetection.ts:144`
**Issue:** `if (mr.milestone === null || mr.milestone.id !== matchedMilestoneId)` throws `TypeError: Cannot read properties of undefined` if `milestone` is absent rather than explicitly `null` (a partial/proxied payload, a hand-built fixture, or any future `Partial<GitLabMR>` construction). The two sibling call sites deliberately tolerate it: `computeRowDriftCount` uses `mr.milestone?.id` (line 325) and `buildIssueMrIndex` uses `mr.milestone == null` (line 382). One of the three will crash the whole render on input the other two absorb.
**Fix:** `return mr.milestone == null || mr.milestone.id !== matchedMilestoneId;`

#### WR-08: The "deterministic" drift comparator is not total — `iid` ties are possible by the module's own admission

**File:** `taskflow/src/routes/dashboard/release-detail/driftDetection.ts:274-277`
**Issue:** The comparator's second key is `b.mr.iid - a.mr.iid`. `unionMRs`'s own doc (lines 60-66) states the union is keyed by `id` precisely because "two distinct MRs (even in different projects/forks) could share an `iid`". For such a pair the comparator returns `0`, so final order falls back to `Map` insertion order — i.e. channel array order — contradicting the "proven order-independent by test" claim in the JSDoc (the test at `driftDetection.test.ts:297-349` uses four distinct `iid`s and cannot exercise the tie).
**Fix:** Add a total tie-break: `return b.mr.iid - a.mr.iid || b.mr.id - a.mr.id;` and add a same-`iid`/different-`id` ordering test.

#### WR-09: Issue → MR selection is last-wins over an unordered union

**File:** `taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts:121-128` (via `driftDetection.ts:365-372`)
**Issue:** `matchIssuesToMRs` does `releaseMrByIssue.set(matchedKey, mr)` in a loop — the **last** MR linked to a key wins. Its input used to be the milestone-MR fetch in server order; it is now `Array.from(union.values())` filtered by milestone, whose order is Channel A → B → C insertion order. For an issue with more than one MR on the release milestone (re-opened work, split MRs, revert MRs), the Issues table can now display a different MR than before the swap, chosen by nothing more meaningful than channel ordering — while `buildIssueMrIndex`'s `wrongMilestoneByKey` uses `.find` (first-wins) for the opposite direction. The doc comment claims the swap changes only the data source, not behaviour; that is not true for multi-MR issues.
**Fix:** Make the choice explicit and stable, e.g. prefer `opened` then `merged`, tie-broken by highest `iid`, and document it — or at minimum switch to first-wins to match `wrongMilestoneByKey`.

#### WR-10: `openUrl` promises are floated with no rejection handling

**File:** `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx:146`, `taskflow/src/routes/dashboard/release-detail/IssuesSection.tsx:138,181`
**Issue:** `onClick={() => openUrl(mr.web_url)}` discards a promise that rejects when the opener plugin fails or the URL is rejected by the platform. The user gets a dead click and the app gets an unhandled rejection. `IssuesSection.tsx:138` additionally passes `row.mr?.web_url ?? ''` — inside a branch already guarded by `row.mr`, so the `?? ''` can only mask a bug by asking the OS to open an empty URL.
**Fix:** `onClick={() => { void openUrl(mr.web_url).catch(() => {}); }}` (or a shared `openExternal` helper that reports failure), and drop the redundant `?? ''`.

#### WR-11: Clicking a ticket key in the drift list pushes a duplicate breadcrumb every time

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:181-186`
**Issue:** `handleNavigateToIssueFromMR` calls `breadcrumbPush` unconditionally, while `seedReleaseBreadcrumb` (lines 160-167, fifteen lines above) exists precisely to make that idempotent. `breadcrumb.store.ts` `push` is a bare append. Navigate to an issue from the drift list, go back, click another key → the trail carries the release name twice, and the back handler (`handleBack`, which pops one entry) now returns to the same page. The drift section is the main consumer of this callback since `UnmatchedMRsSection` was deleted, so the path is hotter than before.
**Fix:** `const handleNavigateToIssueFromMR = (key: string) => { seedReleaseBreadcrumb(); navigate(\`/issue/${key}\`); };`

#### WR-12: The Channel A window is derived only from *unreleased* versions, so released releases lose Channel A

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:298-325`
**Issue:** `openReleaseDates` filters `!v.released`, so the window is anchored on upcoming work only. Opening the detail page for a *released* version from a year or two ago derives a window that can exclude every MR of that release, making Channel A return nothing relevant. Channel C is also empty for those versions in practice (release branches are deleted after merge — the codebase asserts this in `resolveBranchState`/tag-lookup logic), so the drift list collapses to Channel B alone and the badge under-reports without any indication. The doc comment at `gitlab.ts:1762-1770` justifies the window on the assumption that B *and* C stay effective; for released versions that assumption does not hold. (Flagging the derivation's *scope*, not the windowing trade-off itself.)
**Fix:** Include the currently-viewed `version.releaseDate` in the window derivation (still project-stable if you key on it separately, or accept a version-scoped key for released versions only), or suppress the drift badge/mark the section degraded when `version.released && windowStart > version.releaseDate`.

### Info

#### IN-01: Test name and comment contradict the fixture

**File:** `taskflow/src/routes/dashboard/ReleasesTab.test.tsx:741-780`
**Issue:** The test is named "...wrong target branch and **no release milestone**" and its comment claims "the milestone is unset — **both** branch and milestone drift fire", but the fixture MR carries `milestone: { id: 1 }`, which equals the matched milestone id, so `evaluateMilestoneDrift` returns `false` and only branch drift fires. A future reader will trust the comment over the fixture.
**Fix:** Fix the name/comment, or set `milestone: null` and assert both predicates.

#### IN-02: Vacuous test — asserts on the fixture, not the function

**File:** `taskflow/src/routes/dashboard/release-detail/driftDetection.test.ts:153-158`
**Issue:** `it('reads no milestone field other than id (Pitfall 1)')` never calls `evaluateMilestoneDrift`; it asserts `mr.milestone` equals the object it just constructed. It passes for any implementation.
**Fix:** Delete it, or assert the real contract, e.g. `evaluateMilestoneDrift({ ...mr, milestone: { id: 7 } } as GitLabMR, 7) === false` with the extra fields removed.

#### IN-03: Test name promises more than it asserts

**File:** `taskflow/src/routes/dashboard/release-detail/MrDriftSection.test.tsx:148-151`
**Issue:** "renders the degraded-state banner **and no BR/MS marks** when no milestone matched" asserts only the banner; it renders no rows at all, so the second clause is untested.
**Fix:** Pass a row with `br: 'na', ms: 'na'` and assert both cells contain the em dash.

#### IN-04: `matchIssuesToMRs`'s `unmatched` return value is now dead

**File:** `taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts:114-135`
**Issue:** With `UnmatchedMRsSection` deleted, the only production caller (`buildIssueMrIndex`, `driftDetection.ts:372`) destructures `{ matchedRows }` and discards `unmatched`; `releaseUnmatched` is accumulated for nobody.
**Fix:** Drop `unmatched` from the return type (and its accumulation), or document that the drift list supersedes it.

#### IN-05: The whole drift pipeline re-derives on every render

**File:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:389-413`
**Issue:** `fixVersionIssueKeys`, `selectChannelA`, `unionMRs`, `buildIssueMrIndex` and `buildDriftRows` all run unmemoised on every render of a page that also owns a drag-to-resize handler (`useResizable` re-renders continuously while dragging), over an array sized in the thousands. Every result is a fresh identity, so no downstream memoisation can help either.
**Fix:** Wrap the block in a single `useMemo` keyed on `[allProjectMRs, milestoneMRs, branchTargetedMRs, fixVersionIssues, releaseBranchName, matchedMilestone?.id]`.

#### IN-06: Drift-list header columns cannot align with the rows

**File:** `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx:104-125` vs `142-202`
**Issue:** The header uses `<span className="flex-none" />` (no width) as the author-column spacer while the row's author cell is a `flex-none` span whose width depends on the author's name and avatar. The `BR`/`MS`/`TASK` labels therefore drift horizontally relative to the check/warning cells as soon as author names differ in length. (See the project's "table vs flex rows" note — per-row sizing is intentional here, but the header must then be width-matched or dropped.)
**Fix:** Give the author cell a fixed width (e.g. `w-[160px] truncate`) in both header and row, mirroring the `w-[44px]`/`w-[72px]`/`w-[64px]` treatment already used for the other columns.

---

_Reviewed: 2026-08-11T09:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
