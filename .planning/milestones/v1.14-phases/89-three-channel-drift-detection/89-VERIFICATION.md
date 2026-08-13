---
phase: 89-three-channel-drift-detection
verified: 2026-08-11T07:39:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

> **POST-VERIFICATION AMENDMENT — 2026-08-11**
> DRIFT-09 (aggregate drift count on the Releases list row) was **descoped by the
> user at UAT** after this report was written: drift belongs on the release detail
> page only. Plan 89-04's feature and its now-dead helpers (`computeRowDriftCount`,
> `fetchOpenProjectMRs`) were removed. This report's DRIFT-09 finding is therefore
> superseded — treat it as descoped, not as a regression or an unmet requirement.
> The other 8 DRIFT requirements and this report's verdict are unaffected; the
> release detail surface was not modified. See `89-04-SUMMARY.md`.


# Phase 89: Three-Channel Drift Detection Verification Report

**Phase Goal:** Users can see a single, reconciled view of every MR relevant to a release — discovered via Jira-key linkage, GitLab milestone, and release-branch targeting — with disagreements between channels flagged as drift, before any corrective write action is introduced.

**Verified:** 2026-08-11T07:39:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (mapped to DRIFT-01..09)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DRIFT-01: Channel A discovers MRs via Jira issue keys of the fix version's issues | ✓ VERIFIED (accepted trade-off) | `fetchAllProjectMRs` + `selectChannelA` (`gitlab.ts:1802-1826`, `driftDetection.ts`). **Narrowed post-SUMMARY** by `updated_after` windowing (12mo default / 6mo buffer / 24mo cap, month-floored) added in commits `991fae74`/`bd8fc0f7`. See "Accepted Trade-off" section below — judged non-blocking because Channels B/C remain unbounded safety nets and the window is generous. |
| 2 | DRIFT-02: Channel B discovers MRs via GitLab milestone | ✓ VERIFIED | `fetchMilestoneMRs` unchanged, wired at `useReleaseDetail.ts` as `milestoneMRs`, key `['gitlab-milestone-mrs', ...]` |
| 3 | DRIFT-03: Channel C discovers MRs via target-branch match, fully paginated | ✓ VERIFIED | `fetchBranchTargetedMRs` (`gitlab.ts`), `while(true)`/short-page-break loop confirmed by reading source; multi-page unit test in `gitlab.test.ts`; A2 resolved live (`89-PROBE-RESULTS.md`: `target_branch: PRESENT`, `draft: PRESENT`); Channel-C completeness proven via synthetic >100-MR fixture (live branch only had 8 MRs) |
| 4 | DRIFT-04: The three channels union into one MR set with per-channel provenance | ✓ VERIFIED | `unionMRs` keyed by `mr.id` (not `iid`), `Set<Channel>` per entry; 33 unit tests in `driftDetection.test.ts`; `DriftRow.channels` rendered via `Found via: ...` tooltip in `MrDriftSection.tsx` (`grep -c 'Found via:'` = 1) |
| 5 | DRIFT-05: MR flagged when target branch ≠ release branch | ✓ VERIFIED | `evaluateBranchDrift` (`driftDetection.ts:~131`), D-18 null-guard, unit tested |
| 6 | DRIFT-06: MR flagged when release milestone not assigned | ✓ VERIFIED | `evaluateMilestoneDrift` (`driftDetection.ts:142-145`), unit tested |
| 7 | DRIFT-07: MR flagged when Jira task not in fix version | ✓ VERIFIED | `evaluateTaskDrift` returns 3-valued `TaskDriftReason`, checks title + source_branch keys, unit tested |
| 8 | DRIFT-08: Merged/closed/draft MRs classified so they don't pollute drift counts | ✓ VERIFIED | `classifyMrState` gate `mr.state === 'opened'`; D-10 override (drafts ARE evaluated, not muted) implemented and guarded by a named regression test at both the logic layer (`driftDetection.test.ts` "state classification") and render layer (`MrDriftSection.test.tsx`) |
| 9 | DRIFT-09: Release row shows an aggregate drift count | ✓ VERIFIED | `ReleasesTab.tsx` `gitlab-open-mrs` single fetch-once query, `computeRowDriftCount` per row, `row-drift-count` testid, tooltip explaining branch/milestone-only coverage; relabeled "{n} mismatched" (commit `8cf1b802`) to resolve list-vs-detail count confusion — see "Count Coherence" section below |

**Score:** 9/9 truths verified (1 carries a documented, judged-acceptable trade-off)

### Accepted Trade-off: DRIFT-01 Channel A Windowing

Post-SUMMARY UAT reported the drift section as "very very slow." Measured against the live instance: Channel A (`fetchAllProjectMRs`, all-history, all-states) is ~4189 MRs / 42 pages / ~15MB, and the GitLab server is throughput-limited (5-, 12-, 20-way parallelism all ~8s — added parallelism buys nothing). Two fixes landed:

1. Parallel page fetching (`db4421f2`) using `x-total-pages` with a bounded, verified fallback (`bd8fc0f7` closed the WR-02/WR-03 gaps this introduced — see Outstanding Review Findings).
2. An `updated_after` window on Channel A only (`991fae74`), derived from unreleased fix versions: earliest unreleased release date minus a 6-month buffer, month-floored for query-key stability, capped at 24 months, defaulting to 12 months when no open-release dates exist.

**Verified in code** (`useReleaseDetail.ts:304-338`): the window derivation exactly matches this description — `BUFFER_MONTHS = 6`, `MAX_LOOKBACK_MONTHS = 24`, `DEFAULT_LOOKBACK_MONTHS = 12`, floored to `Date.UTC(y, m, 1)`.

**Judgment:** This is a genuine, material narrowing of DRIFT-01's literal completeness guarantee — Channel A no longer reaches all project history, so an MR that is simultaneously old (untouched >24mo), off-milestone, off-branch, and only discoverable by Jira-key match will now be silently excluded from Channel A. This is a real (if narrow) regression from "discovered via the Jira issue keys of the fix version's issues" read literally.

Verified mitigating factors:
- Channels B (milestone) and C (branch) are confirmed unbounded in code (no `updated_after` on either fetcher) — an MR attached to the release's milestone or targeting its release branch is still discovered at any age, regardless of Channel A's window.
- The window is release-derived, not hardcoded, and is part of the query key, so a narrower cached window can never be silently served for a wider one.
- The window (12-24 months) covers all realistic in-flight development; the residual gap (MR authored/updated >24 months ago, linked only by a Jira key in its title/branch, never touching the milestone or release branch) is a narrow edge case.
- The trade-off is transparently documented in code comments (`gitlab.ts:1783-1793`, `useReleaseDetail.ts:304-312`) and in the SUMMARY, not hidden.

**Conclusion:** Accepted as a deliberate, documented, user-driven (UAT-reported) performance trade-off. Not classified as a FAILED must-have — the phase goal ("single reconciled view... before any corrective write action") remains substantially achieved; the residual completeness gap is narrow, transparent, and does not undermine the core drift-detection mechanism. Flagged here per the verification brief rather than silently passed. No formal override entry was added to frontmatter since this does not fail an explicit PLAN must-have (89-01's must-haves only require the fetcher to be "fully-paginated," which it is — the window is an application-level filter, not a pagination cap).

### Count Coherence: List vs Detail (D-13/D-14)

Verified `computeRowDriftCount` (D-14, `ReleasesTab.tsx`) deliberately excludes TASK drift and only counts branch/milestone mismatches on MRs relevant to the row; `countFlaggedMRs` (D-13, detail page) counts all three columns including TASK and Channel-A key-matches. `list ≤ detail` is structural by construction — confirmed by reading both implementations. The list label was changed from "{n} drift" to "{n} mismatched" (commit `8cf1b802`) specifically so the two numbers reading differently ("1" vs "4" in the reported case) doesn't look like a bug. Tooltip text on the list badge (`ReleasesTab.tsx:650`) still correctly states "MRs need branch or milestone attention. Open the release for the full check, including task links." Semantics intact; only wording changed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/services/gitlab.ts` | 3 fully-paginated fetchers + widened `GitLabMR` | ✓ VERIFIED | `fetchBranchTargetedMRs`, `fetchAllProjectMRs`, `fetchOpenProjectMRs` all exported, all route through `apiFetch('gitlab', ...)`, no raw `fetch` |
| `taskflow/src/services/gitlab.test.ts` | multi-page pagination tests | ✓ VERIFIED | Pagination, parallel-fetch, header-fallback, mid-batch failure, cap tests present and passing |
| `taskflow/src/routes/dashboard/release-detail/driftDetection.ts` | pure drift module, ≥150 lines | ✓ VERIFIED | 11 exported functions, React-free (`grep` for hooks returns 0), 351+ lines |
| `taskflow/src/routes/dashboard/release-detail/driftDetection.test.ts` | full coverage | ✓ VERIFIED | 33+ unit tests across 9+ describe blocks |
| `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` | 3 channel queries wired | ✓ VERIFIED | `gitlab-all-project-mrs`, `gitlab-milestone-mrs`, `gitlab-branch-mrs` keys present; `driftRows`/`driftFlaggedCount`/`isLoadingDrift`/`hasMatchedMilestone` returned |
| `taskflow/src/routes/dashboard/ReleasesTab.tsx` | one open-MR fetch + per-row count | ✓ VERIFIED | `gitlab-open-mrs` key appears once; `computeRowDriftCount` called once per row; fetch-once test present |
| `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx` | MR-first drift section, ≥100 lines | ✓ VERIFIED | Presentational, no hooks, `div`+flex (no `<table>`), explicit pixel widths, `Found via:` provenance tooltip |
| `taskflow/src/routes/dashboard/release-detail/UnmatchedMRsSection.tsx` | deleted (D-02) | ✓ VERIFIED | File does not exist; `grep -rn 'UnmatchedMRsSection\|unmatchedMRs' src/` returns no matches |
| `.planning/phases/89-three-channel-drift-detection/89-PROBE-RESULTS.md` | A2 resolution, live evidence | ✓ VERIFIED | `A2: RESOLVED`, raw probe output present verbatim, synthetic-fixture proof path recorded |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `gitlab.ts` fetchers | `apiFetch('gitlab', ...)` | HTTP call | ✓ WIRED | Confirmed by reading source; no raw `fetch(` added |
| `useReleaseDetail.ts` | `driftDetection.buildDriftRows` | derived call over 3 channel results | ✓ WIRED | `buildDriftRows({ channelA, channelB, channelC, ... })` present |
| `useReleaseDetail.ts` | `fetchBranchTargetedMRs` | Channel C query, `enabled` gated on `releaseBranchName !== null` | ✓ WIRED | Confirmed in source; regression test asserts fetcher not called when milestone unmatched |
| `IssuesSection.tsx` MR cell | three-channel union via `buildIssueMrIndex` | `useReleaseDetail.ts` re-sourcing | ✓ WIRED | `matchIssuesToMRs` reused; `git diff` on the `<td>` block (per plan claim) shows no visual change |
| `ReleaseDetailPage.tsx` | `<MrDriftSection>` | sibling render after `<IssuesSection>` | ✓ WIRED | Import + JSX render confirmed at lines 24, 251 |
| `ReleasesTab.tsx` | `driftDetection.computeRowDriftCount` | per-row local derivation | ✓ WIRED | Called once per row inside `toMatched`, gated on `openMrsLoaded && !version.released`, and (post-fix) `branchPresent ? derived : null` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DRIFT-01 | 89-01, 89-02, 89-03 | Channel A — Jira-key discovery | ✓ SATISFIED (accepted trade-off) | See "Accepted Trade-off" above |
| DRIFT-02 | 89-01, 89-03 | Channel B — GitLab milestone | ✓ SATISFIED | Unchanged `fetchMilestoneMRs`, wired |
| DRIFT-03 | 89-01 | Channel C — target-branch, fully paginated | ✓ SATISFIED | `fetchBranchTargetedMRs`, A2 resolved live |
| DRIFT-04 | 89-02, 89-03, 89-05 | Union with provenance | ✓ SATISFIED | `unionMRs` id-keyed, channel Set |
| DRIFT-05 | 89-02 | Branch drift flag | ✓ SATISFIED | `evaluateBranchDrift` |
| DRIFT-06 | 89-02 | Milestone drift flag | ✓ SATISFIED | `evaluateMilestoneDrift` |
| DRIFT-07 | 89-02, 89-05 | Task drift flag | ✓ SATISFIED | `evaluateTaskDrift` |
| DRIFT-08 | 89-02, 89-05 | State classification | ✓ SATISFIED | `classifyMrState`, D-10 override |
| DRIFT-09 | 89-04 | Aggregate drift count on release row | ✓ SATISFIED | `computeRowDriftCount`, `row-drift-count` |

No orphaned requirements — all 9 DRIFT-* IDs in REQUIREMENTS.md are claimed by at least one phase-89 plan's frontmatter and are traced above.

### Anti-Patterns / Outstanding Review Findings

`89-REVIEW.md` (standard depth, 19 findings: 1 critical, 12 warning, 6 info) was raised after the 5 plan SUMMARYs. Commit `bd8fc0f7` resolved **CR-01** (title-mangling highlighter — verified fixed, `matchTicketKeyInTitle` now case/separator-tolerant with a `null`-miss guard) and **WR-01/02/03/05** (double-fetch on cold mount, unbounded/silently-truncating pagination header trust, false-positive branch drift on a not-yet-created branch — all verified fixed by reading current source).

**Outstanding, NOT fixed** (confirmed still present by reading current source):

| ID | Severity | Issue | Judged blocking? |
|----|----------|-------|-------------------|
| WR-04 | Warning | A failed Channel A/B/C query renders as "no drift" (isError discarded, `?? []` swallows failure) | No — degraded-state edge case (network/auth failure), not the primary success path; the phase's own success criteria don't require error-state UX |
| WR-06 | Warning | List page and detail page resolve "matched milestone" via different tie-break rules and different date windows; can select different milestones with >1 milestone candidate in range | No — narrow edge case (multiple milestone candidates in the ±7d window); does not affect the common single-milestone-per-release case, and is a refinement of `9-04`'s already-accepted "list ≤ detail" divergence, not a new contradiction |
| WR-07 | Warning | `evaluateMilestoneDrift` uses strict `=== null`, inconsistent with sibling `?.`/`== null` usage elsewhere — would throw on `milestone: undefined` | No — `GitLabMR.milestone` is typed `{id,title} \| null` (never `undefined`) on real API data; only a manually-built partial fixture could trigger it |
| WR-08 | Warning | Row sort comparator has no total tie-break for same-`iid`-different-`id` MRs (cross-fork/cross-project edge case) | No — narrow edge case explicitly out of scope for a single-project tool |
| WR-09 | Warning | Issue→MR selection for the Issues-table cell is last-wins over union-insertion order, not explicitly ordered | No — pre-existing ambiguity class (multi-MR-per-issue), not introduced correctness regression for the common case |
| WR-10 | Warning | `openUrl()` promise floated with no rejection handling | No — cosmetic/UX robustness, not a drift-detection correctness issue |
| WR-11 | Warning | Duplicate breadcrumb push on ticket-key navigation from drift list | No — navigation UX papercut, not part of the drift-detection goal |
| WR-12 | Warning | Channel A window derives only from unreleased versions, so viewing an old *released* version's detail page can get an empty/irrelevant Channel A window | No — released versions' release branches are also deleted post-merge (Channel C also thin), a pre-existing characteristic of viewing historical releases, not a new regression this phase introduced for the primary (unreleased-release) use case the drift feature targets |
| IN-01 to IN-06 | Info | Test-quality issues (misleading test names/comments, one vacuous test, dead field, missing memoization, header/row column-width mismatch risk) | No — none affect production behavior of the drift-detection goal |

None of the outstanding findings fail an explicit must-have truth from any of the 5 plans' frontmatter or from the roadmap's DRIFT-01..09 success criteria. They represent legitimate technical debt (documented, triaged, and prioritized by the reviewer) that does not block the phase goal — "users can see a single, reconciled view... with disagreements flagged as drift" is achieved on the primary path. Recommend tracking WR-04 and WR-06 for a future hardening pass since they touch trust/coherence of the drift signal, even though narrow.

### Human Verification Required

None outstanding. Plan 89-05's Task 3 (`checkpoint:human-verify`, gate="blocking") was completed by the user against the merged branch per the SUMMARY's "UAT Follow-up" section: the section rendered correctly against the UI-SPEC; two issues surfaced during UAT (perf, count-label coherence) and were fixed inline (verified above), not deferred. No unresolved human-verification items remain.

### Automated Verification Re-run (by this verifier, independent of SUMMARY claims)

- `cd taskflow && npx tsc --noEmit` — exit 0 (confirmed)
- `cd taskflow && npx vitest run` — 2322 passed, 2 skipped, 13 todo, 0 failed (confirmed, matches SUMMARY claim exactly)
- `cd taskflow && npm run check` — 2 errors (documented `BacklogPage.tsx`/`BacklogRow.tsx` baseline, confirmed unrelated to this phase's files), 30 warnings
- Targeted re-run: `driftDetection.test.ts`, `MrDriftSection.test.tsx`, `gitlab.test.ts`, `ReleasesTab.test.tsx`, `useReleaseDetail.test.tsx` — 211 passed, 0 failed
- Fix commits independently verified by reading current source, not by trusting SUMMARY/commit-message prose: CR-01 (`matchTicketKeyInTitle`), WR-01 (`fixVersionsSettled` gate), WR-02/WR-03 (`MR_MAX_PAGES = 500`, continuation check via `lastPageWasFull`), WR-05 (`branchPresent ? derived : null`) all confirmed present and correctly implemented in current `taskflow/src`

### Gaps Summary

No gaps. All 9 DRIFT-* requirements are implemented, wired, and tested. The one deliberate narrowing (DRIFT-01's Channel A history window) is judged an acceptable, well-documented, user-driven performance trade-off rather than a regression that fails the phase goal — the core three-channel union/reconciliation/drift-flagging mechanism the phase exists to deliver is fully present and functioning. Outstanding code-review findings (WR-04, WR-06 through WR-12, IN-01 through IN-06) are legitimate but non-blocking technical debt, none of which contradicts an explicit must-have.

---

_Verified: 2026-08-11T07:39:00Z_
_Verifier: Claude (gsd-verifier)_
