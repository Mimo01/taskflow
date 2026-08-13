---
phase: 87
slug: release-detail-decomposition
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-10
audited: 2026-08-13
---

# Phase 87 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `87-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`vitest run`) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `npm test -- releaseSummaries.test.ts` (run from `taskflow/`) |
| **Full suite command** | `npm test` (run from `taskflow/`) |
| **Estimated runtime** | quick ~5s · full ~60s |

**Quality gate command:** `npm run check` (biome check + tsc) from `taskflow/`.

> **Baseline is NOT zero.** `tsc --noEmit` is clean, but `biome check ./src` reports
> **2 pre-existing formatting errors** in `src/routes/dashboard/BacklogPage.tsx` and
> `src/routes/dashboard/BacklogRow.tsx`, both unrelated to this phase and pre-dating it.
> The gate for Phase 87 is **zero NEW errors/warnings relative to this 2-error baseline**.
> Do not "fix" the Backlog files here — that is out of scope per D-16.

---

## Sampling Rate

- **After every task commit:** Run `npm test -- releaseSummaries.test.ts` (once it exists), plus `npx tsc --noEmit`
- **After every plan wave:** Run `npm run check` **and** `npm test -- ReleasesTab.test.tsx UpcomingReleasesTimeline.test.tsx`
- **Before `/gsd-verify-work`:** Full suite (`npm test`) green + `npm run check` at baseline + manual UAT click-through complete
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Task IDs are filled in by the planner. This table records the required
> verification *shape* per work category; the planner must map each emitted task
> into one of these rows.

> Reconciled 2026-08-13 against the 21 executed tasks across plans 87-01…87-06.
> Mapped at plan granularity — each row names the plans whose tasks fall in that category.

| Work category | Plans | Requirement | Test Type | Automated Command | File Exists | Status |
|---------------|-------|-------------|-----------|-------------------|-------------|--------|
| Extract `releaseSummaries.ts` pure module | 87-01 | FOUND-01 / D-09 | unit | `npm test -- releaseSummaries.test.ts` | ✅ | ✅ green (13 tests) |
| Write `releaseSummaries.test.ts` edge cases | 87-01 | FOUND-01 / D-14 | unit | `npm test -- releaseSummaries.test.ts` | ✅ | ✅ green (7 describes, all 6 RESEARCH §8 cases) |
| Extract `useReleaseDetail.ts` (6 queries, verbatim keys) | 87-02, 87-04 | FOUND-01 / D-07, D-11 | typecheck + consumer suite | `npx tsc --noEmit && npm test -- ReleasesTab.test.tsx UpcomingReleasesTimeline.test.tsx` | ✅ | ✅ green |
| Move 2 Jira fetchers to `services/jira.ts` via `apiFetch` | 87-02 | FOUND-01 / D-12, D-12a | typecheck + consumer suite | `npx tsc --noEmit && npm test -- ReleasesTab.test.tsx` | ✅ | ✅ green |
| **`jira-version-counts` cache-key + payload-shape parity** | 87-02 (audit 2026-08-13) | FOUND-01 SC3 / D-11, WR-01 | unit + component | `npx vitest run src/routes/dashboard/ReleasesTab.versionCountsParity.test.tsx` | ✅ | ✅ green (2 tests, added by this audit) |
| Extract each presentational section file | 87-03, 87-05 | FOUND-01 / D-01, D-08, D-12b | typecheck + biome | `npm run check` | ✅ | ✅ green |
| Slim page shell to ~150–250 LOC | 87-06 | FOUND-01 / D-06 | typecheck + full suite | `npm run check && npm test` | ✅ | ✅ green (shell landed at 322 LOC — over the aspirational target, recorded in 87-VERIFICATION.md, not a test failure) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `taskflow/src/routes/dashboard/release-detail/releaseSummaries.test.ts` — **delivered** (13 tests, 7 describes); covers the edge cases enumerated in RESEARCH.md §8:
  - `labelSummary`: empty MR list → `[]`; MRs with no labels; equal-count alphabetical tie-break
  - `labelCoverage`: zero MRs → `null` (guard, not `{total:0}`); zero labelled MRs → `allLabeled: false`
  - `mrStateCounts`: `merged`/`opened`/else-bucket, incl. a `locked`-state MR landing in `closed`
  - `storyPoints` / `hasStoryPoints`: `null`/`undefined`/non-number SP excluded; `hasStoryPoints` requires `> 0` (a `0` does **not** count)
  - `issueStatusCounts`: unknown `statusCategory.key` falls back to `new`
  - `milestoneWindow`: month-boundary rollover on `addDays(-7)`; `null` when `releaseDate` absent
- [x] No framework install needed — Vitest, `@testing-library/react`, `QueryClientProvider`/`MemoryRouter` patterns already present (`releaseLinker.test.ts` is the pure-module precedent to copy: no `render()`, no mocks)

---

## Manual-Only Verifications

`ReleaseDetailPage` has **no** automated test coverage today (D-15, confirmed by RESEARCH.md §8),
and D-14 explicitly declines a page-level characterization test for this phase. Therefore
"renders identically" (Success Criterion 1) is verified manually. This is the phase's
known validation ceiling — it is a deliberate, recorded tradeoff, not a gap to fill.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Page renders identically pre/post refactor | FOUND-01 SC1 | No page-level test exists; D-14 declined adding one as disproportionate for a mechanical split | Click-through `/release/:versionId` covering: loading skeleton → loaded state; description rendering (Jira-only **and** Jira+GitLab-matched **and** neither-has-description branches); label summary; issues table across all 4 MR-match states (matched / none / wrong-milestone / missing); unmatched-MRs list; sidebar metadata (every `MetaRow` variant); edit modal open → edit → save (incl. partial-failure paths); pin/unpin; resizable sidebar drag |
| DOM nesting of Issues + Unmatched MRs unchanged | FOUND-01 SC1 / D-12b | Structural, not behavioral — no assertion catches a changed wrapper | Inspect rendered DOM: `UnmatchedMRsSection` must remain **inside** the `IssuesSection` `<section>` wrapper, not a sibling. Compare against pre-refactor DOM. |
| ~~Query cache still shared with ReleasesTab / UpcomingReleasesTimeline~~ | FOUND-01 SC3 / D-11 | **NO LONGER MANUAL — automated 2026-08-13** | Superseded by `ReleasesTab.versionCountsParity.test.tsx`, which asserts both producers write the identical `['jira-version-counts', id]` key tuple *and* a payload matching the shared `VersionIssueCounts` contract. Writing this test exposed 87-REVIEW **WR-01** as a live split-brain: `ReleasesTab.tsx` carried its own unexported `fetchVersionIssueCounts` (raw `fetch`, no `/^\d+$/` versionId guard, extra never-read `issuesAffected: 0` field) writing the same cache key as the shared `services/jira.ts` fetcher. Closed in the same audit by deleting the local duplicate (−37 LOC) and consuming the shared fetcher. Manual navigation spot-check for the *other* two keys (`jira-fix-versions`, `gitlab-milestones`) remains worthwhile but is no longer the only line of defence. |

---

## Validation Sign-Off

- [x] Every planner task maps to a row in the Per-Task Verification Map (21 tasks / 6 plans, mapped at plan granularity)
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 delivers `releaseSummaries.test.ts` before dependent extraction tasks land
- [x] No watch-mode flags (`npm test` = `vitest run`, not `vitest`)
- [x] Feedback latency < 60s (full suite 12.6s)
- [x] `npm run check` — `tsc --noEmit` clean; biome clean on all files this phase touched. **Baseline note:** the "2-error" baseline recorded above is stale; it has since drifted to ~16 diagnostics across 5 files (Phases 81/82 origin, per Phase 90 `deferred-items.md`). Gate on "no NEW files flagged", never an absolute count.
- [x] Manual UAT click-through completed and recorded
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-13 (retroactive audit via `/gsd-validate-phase`)

---

## Validation Audit 2026-08-13

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

**Gap found:** `jira-version-counts` was written by two divergent producers under one cache key, with no
automated assertion of key or shape parity (87-REVIEW WR-01, previously carried as manual-only).

**Resolution:** `ReleasesTab.versionCountsParity.test.tsx` added (2 tests). It failed on the shape assertion,
correctly proving the open bug rather than documenting the buggy behaviour. The divergence was then closed by
deleting `ReleasesTab.tsx`'s duplicate local `fetchVersionIssueCounts` (lines 36-72) plus its now-unused
`@tauri-apps/plugin-http` import, and importing the shared fetcher from `@/services/jira`. `ReleasesTab.test.tsx`'s
count test was re-pointed from the raw-transport mock to the service mock — the correct layer now that the page
routes through `apiFetch`.

**Net effect:** −37 LOC of duplicated implementation, +2 tests, ReleasesTab gains the `/^\d+$/` versionId guard
and `apiFetch` instrumentation it previously bypassed. Full suite 2621 passed / 0 failed.

**Severity note (recorded for accuracy):** the divergence was *latent*, not user-visible — the extra
`issuesAffected` field was never read by any consumer, and both readers default via `?? 0`. It was a live
correctness hazard for any future consumer, not an active defect.
