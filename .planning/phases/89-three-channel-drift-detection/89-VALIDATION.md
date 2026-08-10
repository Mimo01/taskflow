---
phase: 89
slug: three-channel-drift-detection
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-10
---

# Phase 89 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `89-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (version pinned in `taskflow/package.json`) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `npm run test -- driftDetection` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5s quick / full suite ≈ 2247 tests |

**Static gate:** `npm run check` (biome + tsc). Baseline is **2 pre-existing biome formatting errors** (BacklogPage/BacklogRow) — gate on *zero new* errors, never on a clean run.

---

## Sampling Rate

- **After every task commit:** `npm run test -- driftDetection` (add `-- gitlab` when fetchers changed)
- **After every plan wave:** `npm run test` (full suite) — must not regress `useReleaseDetail.test.tsx`, `ReleaseDetailSidebar.test.tsx`, `releaseSummaries.test.ts`, `ReleasesTab.test.tsx`
- **Before `/gsd-verify-work`:** Full suite green + `npm run check` with no new errors
- **Max feedback latency:** ~10 seconds for the quick run

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| DRIFT-01 | Channel A discovers MRs via Jira-key linkage to fix-version issues | unit | `npx vitest run driftDetection -t "Channel A"` | ❌ W0 | ⬜ pending |
| DRIFT-02 | Channel B discovers MRs via GitLab milestone (reuses `fetchMilestoneMRs`) | unit | `npx vitest run driftDetection -t "unionMRs"` | ❌ W0 | ⬜ pending |
| DRIFT-03 | Channel C discovers MRs via release-branch target, **fully paginated** | unit (loop) + probe (live) | `npx vitest run gitlab -t "fetchBranchTargetedMRs"` | ❌ W0 | ⬜ pending |
| DRIFT-04 | Three channels union into one set retaining per-channel provenance | unit | `npx vitest run driftDetection -t "unionMRs"` | ❌ W0 | ⬜ pending |
| DRIFT-05 | MR flagged when target branch ≠ release branch | unit | `npx vitest run driftDetection -t "evaluateBranchDrift"` | ❌ W0 | ⬜ pending |
| DRIFT-06 | MR flagged when release milestone not assigned | unit | `npx vitest run driftDetection -t "evaluateMilestoneDrift"` | ❌ W0 | ⬜ pending |
| DRIFT-07 | MR flagged when Jira task not in fix version (incl. D-11 keyless case) | unit | `npx vitest run driftDetection -t "evaluateTaskDrift"` | ❌ W0 | ⬜ pending |
| DRIFT-08 | Merged/closed classified separately; drafts evaluated per D-10 override | unit | `npx vitest run driftDetection -t "state classification"` | ❌ W0 | ⬜ pending |
| DRIFT-09 | Release row shows aggregate drift count (union of flagged MRs) | unit + manual render | `npx vitest run driftDetection -t "countFlaggedMRs"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/.../release-detail/driftDetection.test.ts` — new file; covers DRIFT-01, DRIFT-04 … DRIFT-09 (pure union + predicate + count logic; the phase's primary test target per D-19)
- [ ] `taskflow/src/services/gitlab.test.ts` — **exists** (confirmed by pattern mapper; RESEARCH.md's "may not exist" note is superseded). Extend additively with pagination-loop tests for `fetchBranchTargetedMRs` / `fetchAllProjectMRs`: mock `apiFetch` with multi-page fixtures, assert the loop accumulates every page and terminates only on a short page.
- [ ] `ReleasesTab.test.tsx` — extend with the D-14/D-15 aggregate-indicator assertion once wired (inspect the existing test structure before assuming additive-only).
- [ ] No framework install needed — Vitest already configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Channel C completeness against a real >100-MR release branch | DRIFT-03 | Live-instance pagination behavior cannot be proven by mocked fixtures alone; this is the roadmap-mandated probe | Run `.planning/phases/89-three-channel-drift-detection/probe.sh` against `git.devel.sun.orange.sk` project `455`. Confirm total MR count > 100 for some branch **or** build a synthetic >100-MR fixture, and confirm the fetch returns every page. |
| `target_branch` / `draft` present on the GitLab **list** endpoint (Assumption A2) | DRIFT-03, DRIFT-05, DRIFT-08 | `GitLabMR` (gitlab.ts:425) never declared these fields; only `GitLabMRDetail` does. Must be confirmed against the live instance before predicates depend on them. | Probe A in `probe.sh` — one live request; inspect the raw JSON for both keys. |
| Drift badge / aggregate indicator visual rendering | DRIFT-09 | Visual conformance to `89-UI-SPEC.md` | Launch app, open a release with known drift, compare against UI-SPEC. |

---

## Validation Sign-Off

- [x] All tasks have automated verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all ❌ MISSING references above (driftDetection.test.ts in 89-02; gitlab.test.ts pagination tests in 89-01; ReleasesTab.test.tsx in 89-04)
- [x] No watch-mode flags (`vitest run`, never bare `vitest`)
- [x] Feedback latency < 10s for the quick run
- [ ] Probe executed and Assumption A2 resolved before predicates ship (89-01 Task 1, blocking checkpoint)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-08-10 — verification map bound to plans 89-01..89-05
