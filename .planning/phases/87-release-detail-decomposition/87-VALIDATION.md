---
phase: 87
slug: release-detail-decomposition
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-10
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

| Work category | Requirement | Test Type | Automated Command | File Exists | Status |
|---------------|-------------|-----------|-------------------|-------------|--------|
| Extract `releaseSummaries.ts` pure module | FOUND-01 / D-09 | unit | `npm test -- releaseSummaries.test.ts` | ❌ W0 | ⬜ pending |
| Write `releaseSummaries.test.ts` edge cases | FOUND-01 / D-14 | unit | `npm test -- releaseSummaries.test.ts` | ❌ W0 | ⬜ pending |
| Extract `useReleaseDetail.ts` (6 queries, verbatim keys) | FOUND-01 / D-07, D-11 | typecheck + consumer suite | `npx tsc --noEmit && npm test -- ReleasesTab.test.tsx UpcomingReleasesTimeline.test.tsx` | ✅ | ⬜ pending |
| Move 2 Jira fetchers to `services/jira.ts` via `apiFetch` | FOUND-01 / D-12, D-12a | typecheck + consumer suite | `npx tsc --noEmit && npm test -- ReleasesTab.test.tsx` | ✅ | ⬜ pending |
| Extract each presentational section file | FOUND-01 / D-01, D-08, D-12b | typecheck + biome | `npm run check` | ✅ | ⬜ pending |
| Slim page shell to ~150–250 LOC | FOUND-01 / D-06 | typecheck + full suite | `npm run check && npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/routes/dashboard/release-detail/releaseSummaries.test.ts` — new file; covers the edge cases enumerated in RESEARCH.md §8:
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
| Query cache still shared with ReleasesTab / UpcomingReleasesTimeline | FOUND-01 SC3 / D-11 | Consumer tests don't exercise this page; a changed key fails silently | Navigate Releases tab → release detail → back; confirm no refetch waterfall for `jira-fix-versions`, `jira-version-counts`, `gitlab-milestones` |

---

## Validation Sign-Off

- [ ] Every planner task maps to a row in the Per-Task Verification Map
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 delivers `releaseSummaries.test.ts` before dependent extraction tasks land
- [ ] No watch-mode flags (`npm test` = `vitest run`, not `vitest`)
- [ ] Feedback latency < 60s
- [ ] `npm run check` at or below the 2-error `BacklogPage`/`BacklogRow` baseline
- [ ] Manual UAT click-through completed and recorded
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
