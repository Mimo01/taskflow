---
phase: 90
slug: per-mr-corrective-actions
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-11
---

# Phase 90 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `90-RESEARCH.md` → `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.0.18` (existing) |
| **Config file** | `taskflow/vitest.config.ts` (existing — not modified this phase) |
| **Quick run command** | `cd taskflow && npx vitest run src/routes/dashboard/release-detail/MrDriftSection.test.tsx src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` |
| **Full suite command** | `cd taskflow && npm run test` |
| **Estimated runtime** | ~15 s quick / ~90 s full (2306 tests) |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <changed test file>`
- **After every plan wave:** `npm run test` (full suite) + `npm run check`
  — biome baseline is 2 pre-existing formatting errors in `BacklogPage.tsx`/`BacklogRow.tsx`; gate on **zero new** errors, not on a clean run
- **Before `/gsd-verify-work`:** Full suite green excluding the known baseline
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Task IDs are filled in by the planner; rows below are the required verification coverage.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 90-02-T1 | 02 | 2 | MRFIX-01 | — | Retarget PUT scoped to the resolved release branch only; no arbitrary target accepted from UI | unit (mutation) | `npx vitest run useMrFixMutation.test.tsx -t "retarget:"` | ✅ | ✅ green |
| 90-03-T3 | 03 | 3 | MRFIX-01 | — | N/A | unit (component) | `npx vitest run MrDriftSection.test.tsx -t "pending:"` | ✅ | ✅ green |
| 90-02-T1 | 02 | 2 | MRFIX-02 | — | Milestone id resolved server-side from the release, not user input | unit (mutation) | `npx vitest run useMrFixMutation.test.tsx -t "assign milestone:"` | ✅ | ✅ green |
| 90-03-T3 | 03 | 3 | MRFIX-03 | — | N/A | unit (component) | `npx vitest run MrDriftSection.test.tsx -t "independent:"` | ✅ | ✅ green |
| 90-03-T3 | 03 | 3 | MRFIX-03 | — | Sticky failure must not leak raw token/PAT-bearing error bodies into the UI | unit (component) | `npx vitest run MrDriftSection.test.tsx -t "sticky failure"` | ✅ | ✅ green |
| 90-03-T3 | 03 | 3 | MRFIX-04 | — | No write path reachable when release branch is absent | unit (component) | `npx vitest run MrDriftSection.test.tsx -t "unavailable"` | ✅ | ✅ green |
| 90-01-T3 | 01 | 1 | MRFIX-01/02 (D-10) | — | Flattened error message contains no `[object Object]` and no credential material | unit (service) | `npx vitest run gitlab.test.ts -t "flattenGitLabError"` | ✅ | ✅ green |
| 90-03-T1 | 03 | 3 | MRFIX-03 (D-11) | — | N/A | unit (component) | `npx vitest run MrDriftSection.test.tsx -t "held sort order"` | ✅ | ✅ green |
| 90-02-T2 | 02 | 2 | MRFIX-01/02 (D-12) | — | N/A | unit (hook) | `npx vitest run useReleaseDetail.test.tsx -t "flagged count"` | ✅ | ✅ green |
| 90-02-T1 | 02 | 2 | MRFIX-01/02 (D-13) | — | N/A | unit (mutation) | `npx vitest run useMrFixMutation.test.tsx -t "invalidates the project-granular key"` | ✅ | ✅ green — **relocated**: the D-13 project-granular invalidation assertions live in `useMrFixMutation.test.tsx`'s `invalidateMrChannelCaches` suite (Plan 02 Task 1), not in `useReleaseDetail.test.tsx` as originally drafted; `useReleaseDetail.test.tsx` Test A/B cover the sibling milestone-create invalidation path instead |

*Status glyphs: ✅ green · ❌ red · ⚠️ flaky · (not-yet-run glyph retired — no rows remain in that state)*

---

## Wave 0 Requirements

- [x] `src/routes/dashboard/release-detail/MrDriftSection.test.tsx` — new cases: pending / success-glyph / sticky-failure / unavailable states, independent per-cell concurrency (D-09), held sort order under a mid-session success transition (D-11)
- [x] `src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` — new cases: optimistic patch + rollback for both mutations, project-granular invalidation across all three channel query keys (D-13, relocated to `useMrFixMutation.test.tsx` — see row note above), flagged-count decrement before PUT settles (D-12)
- [x] GitLab error flattener — `gitlab.test.ts` already existed; the three error-body shapes (string / string[] / `Record<string,string[]>`) are asserted through `flattenGitLabError`'s dedicated `describe` block and through `updateMergeRequest`'s error path
- [x] No framework/config install needed — Vitest is already fully configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Retargeting a real MR actually changes `target_branch` on GitLab and the drift flag clears after refetch | MRFIX-01 | Requires a live GitLab write against the team's project; no fixture can prove the real API accepts the payload | Open a release detail page with a flagged MR, click the branch cell, confirm the MR's target branch on GitLab, reload and confirm the flag is gone |
| Assigning the release milestone to a real MR persists | MRFIX-02 | Live write; `milestone_id` must be the global milestone `id`, which only the live API validates | Click the milestone cell on a flagged MR, verify on GitLab that the milestone is attached |
| Approval-reset / protected-branch side effect of retargeting (ROADMAP probe) | MRFIX-01 | Depends on the team's GitLab project settings, not on our code | Read-only probe: `GET /projects/:id/approvals` (`reset_approvals_on_push`), `GET /projects/:id/merge_requests/:iid/approvals`, `GET /projects/:id/protected_branches`; record findings in the phase SUMMARY |
| One real failing-PUT error body captured as ground truth for the flattener (research Open Question A1) | MRFIX-01 (D-10) | Only the live instance reveals its actual error shape | During the probe, trigger one invalid `target_branch` PUT against a scratch MR and record the verbatim response body |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`vitest run`, never `vitest`)
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** all ten per-task verification rows resolve to a real, named, passing test as of the Plan 04 Task 1 run below.

---

## Run record

**Date:** 2026-08-11 (Plan 04 Task 1)

- **Full suite:** `npm run test` — 178 test files passed / 2 skipped (180 total), **2360 tests passed** / 0 failed / 2 skipped / 13 todo (2375 total)
- **`npx tsc --noEmit`:** exits 0, clean
- **`npx biome check ./src`:** the recorded baseline (`BacklogPage.tsx` + `BacklogRow.tsx`, 2 pre-existing formatting errors) has **drifted upward since it was last measured** (v1.13 Phase 81/82). As of this run, `biome check ./src` also flags `src/components/ui/chart.tsx` (2 `noArrayIndexKey` + 2 stale `suppressions/unused`) and `src/routes/my-tasks/MyTasksPage.tsx`/`MyTasksPage.test.tsx` (1 `noNonNullAssertion` + 7 stale `suppressions/unused`) — 14 additional diagnostics beyond the documented 2-file baseline, for **16 total pre-existing diagnostics**. **None of these files were touched by any Phase 90 plan** (90-01..90-04 only modified `gitlab.ts`/`gitlab.test.ts`, `useMrFixMutation.ts`/`.test.tsx`, `useReleaseDetail.test.tsx`, `MrDriftSection.tsx`/`.test.tsx`, `ReleaseDetailPage.tsx`) — confirmed via `git status`/`git diff` showing zero pending changes to `chart.tsx`, `MyTasksPage.tsx`, or `MyTasksPage.test.tsx` at the start of this plan. **Zero new diagnostics were introduced by Phase 90's own files.** This baseline drift is logged to `deferred-items.md` as a pre-existing, out-of-scope finding per the executor's SCOPE BOUNDARY rule (Phase 90 must not "fix" files it did not touch) — recorded honestly rather than silently gated as green.
