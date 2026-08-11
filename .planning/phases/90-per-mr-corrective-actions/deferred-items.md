# Phase 90 — Deferred Items

Out-of-scope discoveries logged during execution, not fixed per the executor's SCOPE BOUNDARY rule
(only fix issues directly caused by the current task's own changes).

## Biome baseline drift beyond the recorded 2-file baseline (found during Plan 04, Task 1)

**Recorded baseline (per `90-VALIDATION.md`, `90-03-SUMMARY.md`, and prior-phase memory):** `npx biome check ./src`
confined to 2 pre-existing formatting errors in `BacklogPage.tsx` / `BacklogRow.tsx`.

**Actual state as of 2026-08-11 (Plan 04 Task 1 full-suite run):** 16 total diagnostics across 5 files:

- `src/routes/dashboard/BacklogPage.tsx` — 1 format error (known baseline)
- `src/routes/dashboard/BacklogRow.tsx` — 4 diagnostics: format error + 2x `lint/a11y/noStaticElementInteractions` + 2x `lint/a11y/useKeyWithClickEvents` (the "2 errors" baseline undercounted this file; it was always more than 1 diagnostic, just previously summarized as "2 pre-existing formatting errors")
- `src/components/ui/chart.tsx` — 4 diagnostics: 2x `lint/suspicious/noArrayIndexKey` + 2x stale `suppressions/unused` (Phase 81 charting foundation file)
- `src/routes/my-tasks/MyTasksPage.tsx` — 1 `lint/style/noNonNullAssertion`
- `src/routes/my-tasks/MyTasksPage.test.tsx` — 6 stale `suppressions/unused` (Phase 82 My Tasks page)

**Scope determination:** none of `chart.tsx`, `MyTasksPage.tsx`, or `MyTasksPage.test.tsx` were touched by any
Phase 90 plan (90-01 through 90-04 only modified `gitlab.ts`/`gitlab.test.ts`, `useMrFixMutation.ts`/`.test.tsx`,
`useReleaseDetail.test.tsx`, `MrDriftSection.tsx`/`.test.tsx`, `ReleaseDetailPage.tsx`) — confirmed via `git status`
at the start of this plan showing zero pending changes to those three files. This is pre-existing drift from
Phase 81/82, not a Phase 90 regression. **Zero new diagnostics were introduced by Phase 90's own files.**

**Action:** not fixed in this plan (out of scope per SCOPE BOUNDARY). Recommend a dedicated tech-debt cleanup
task (`biome check --write` + manual review of the `noArrayIndexKey`/`noStaticElementInteractions` lint findings,
which are not format-only and need human judgment) at the next milestone-close audit or a standalone quick task.
