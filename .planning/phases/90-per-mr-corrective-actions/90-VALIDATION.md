---
phase: 90
slug: per-mr-corrective-actions
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| TBD | TBD | TBD | MRFIX-01 | — | Retarget PUT scoped to the resolved release branch only; no arbitrary target accepted from UI | unit (mutation) | `npx vitest run useReleaseDetail.test.tsx -t "retarget"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MRFIX-01 | — | N/A | unit (component) | `npx vitest run MrDriftSection.test.tsx -t "pending"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MRFIX-02 | — | Milestone id resolved server-side from the release, not user input | unit (mutation) | `npx vitest run useReleaseDetail.test.tsx -t "assign milestone"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MRFIX-03 | — | N/A | unit (component) | `npx vitest run MrDriftSection.test.tsx -t "independent"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MRFIX-03 | — | Sticky failure must not leak raw token/PAT-bearing error bodies into the UI | unit (component) | `npx vitest run MrDriftSection.test.tsx -t "sticky failure"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MRFIX-04 | — | No write path reachable when release branch is absent | unit (component) | `npx vitest run MrDriftSection.test.tsx -t "unavailable"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MRFIX-01/02 (D-10) | — | Flattened error message contains no `[object Object]` and no credential material | unit (service) | `npx vitest run gitlab -t "flattenGitLabError"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MRFIX-03 (D-11) | — | N/A | unit (component) | `npx vitest run MrDriftSection.test.tsx -t "held sort order"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MRFIX-01/02 (D-12) | — | N/A | unit (hook) | `npx vitest run useReleaseDetail.test.tsx -t "flagged count"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MRFIX-01/02 (D-13) | — | N/A | unit (mutation) | `npx vitest run useReleaseDetail.test.tsx -t "invalidates the project-granular key"` | ✅ pattern exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/routes/dashboard/release-detail/MrDriftSection.test.tsx` — new cases: pending / success-glyph / sticky-failure / unavailable states, independent per-cell concurrency (D-09), held sort order under a mid-session success transition (D-11)
- [ ] `src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` — new cases: optimistic patch + rollback for both mutations, project-granular invalidation across all three channel query keys (D-13), flagged-count decrement before PUT settles (D-12)
- [ ] GitLab error flattener — confirm whether a dedicated `gitlab.test.ts` exists; if not, assert the three error-body shapes (string / string[] / `Record<string,string[]>`) through `updateMergeRequest`'s error path
- [ ] No framework/config install needed — Vitest is already fully configured

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, never `vitest`)
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
