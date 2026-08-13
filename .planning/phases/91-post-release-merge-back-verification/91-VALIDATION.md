---
phase: 91
slug: post-release-merge-back-verification
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-11
audited: 2026-08-13
---

# Phase 91 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `91-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom env) + `@testing-library/react` |
| **Config file** | `taskflow/vitest.config.ts` (already configured — no Wave 0 install) |
| **Quick run command** | `cd taskflow && npx vitest run src/routes/dashboard/release-detail/mergeBackVerification.test.ts` |
| **Full suite command** | `cd taskflow && npm run test` |
| **Quality gate** | `cd taskflow && npm run check` (biome + `tsc --noEmit`) |
| **Estimated runtime** | ~5s targeted · full suite ~60-90s |

**Biome baseline caveat:** the baseline has drifted to ~16 pre-existing diagnostics across 5 files
(recorded in `deferred-items.md` during Phase 90). **Do not hardcode a diagnostic count.** Gate on
**"no NEW files flagged"** and do not fix unrelated pre-existing files in this phase.

---

## Sampling Rate

- **After every task commit:** Run the targeted `npx vitest run <changed test file>`
- **After every plan wave:** Run `npm run test` (full suite) + `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green; no NEW biome files flagged
- **Max feedback latency:** ~10 seconds (targeted run)

---

## Per-Task Verification Map

> Reconciled 2026-08-13 against the 31 executed tasks across plans 91-01…91-09 (the planner never
> filled this table at plan time). Mapped at plan granularity. MERGE-03 is descoped (D-12) and
> correctly has no tasks and no tests.
>
> **Threat Ref / Secure Behavior:** N/A for every row — read-only phase, no new writes or auth surface.

| Plan | Tasks | Requirement | Test Type | Automated Command | File Exists | Status |
|------|-------|-------------|-----------|-------------------|-------------|--------|
| 91-01 | 3 | MERGE-02 | unit | `npx vitest run src/routes/dashboard/release-detail/mergeBackVerification.test.ts` | ✅ | ✅ green |
| 91-02 | 3 | MERGE-02 | unit + service | `npx vitest run src/routes/dashboard/release-detail/mergeBackVerification.test.ts src/services/gitlab.test.ts` | ✅ | ✅ green |
| 91-03 | 4 | MERGE-01, MERGE-02 | component + hook | `npx vitest run src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` | ✅ | ✅ green |
| 91-04 | 3 | MERGE-02 | service | `npx vitest run src/services/gitlab.test.ts` | ✅ | ✅ green |
| 91-05 | 3 | MERGE-01, MERGE-02 | component | `npx vitest run src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` | ✅ | ✅ green |
| 91-06 | 4 | MERGE-01 (+MERGE-03 descope recorded) | component | same | ✅ | ✅ green |
| 91-07 | 3 | MERGE-01, MERGE-02 | component + unit | `npx vitest run src/routes/dashboard/release-detail/` | ✅ | ✅ green |
| 91-08 | 4 | MERGE-01, MERGE-02 | unit (CR/WR review fixes) | `npx vitest run src/routes/dashboard/release-detail/mergeBackVerification.test.ts` | ✅ | ✅ green |
| 91-09 | 4 | MERGE-01, MERGE-02 | unit + component (tag-channel health) | `npx vitest run src/routes/dashboard/release-detail/` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Delivered coverage:** `mergeBackVerification.test.ts` carries 47 tests across 7 describes, including
the CR-01/WR-02 `target_branch` filtering, CR-03/CR-04 terminal fallbacks, the tag-channel loading/failure
guards (91-VERIFICATION truth 5), and the WR-01 step-10 healthy-tracking-MR-channel requirement.
`ReleaseDetailSidebar.test.tsx` has a dedicated `Merged back row (MERGE-01)` describe;
`useReleaseDetail.test.tsx` has `merge-back queries (D-05 gating)`.

---

## Requirement → Observable Signal Map

| Req ID | Behavior proving it | Test Type | Automated Command |
|--------|--------------------|-----------|-------------------|
| MERGE-01 | "Merged back" row renders one of the four states (`merged` / `likely-not-merged` / `couldn't-verify` / hidden) for a released version | component | `npx vitest run src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` |
| MERGE-01 | Row is **hidden** for an unreleased version or when no milestone matched (D-11) | component | same |
| MERGE-01 | Zero extra GitLab calls fire for an unreleased version (D-05) | hook | `npx vitest run src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` |
| MERGE-02 | A `merged` tracking MR takes precedence over content comparison | unit | `npx vitest run src/routes/dashboard/release-detail/mergeBackVerification.test.ts` |
| MERGE-02 | Closed-but-not-merged MR falls through to tag comparison, **not** treated as negative (D-02) | unit | same |
| MERGE-02 | No tracking MR **and** no tag ⇒ `couldn't-verify`, never negative (D-01) | unit | same |
| MERGE-02 | No tracking MR + tag + **empty `diffs[]`** ⇒ `merged` via content (D-04) | unit | same |
| MERGE-02 | No tracking MR + tag + non-empty `diffs[]` ⇒ `likely-not-merged` (D-04) | unit | same |
| MERGE-02 | `compare_timeout: true` ⇒ `couldn't-verify`, **never** `likely-not-merged` | unit | same |
| MERGE-02 | `fetchSourceBranchMRs` fully paginates — no fetch-once page cap | service | `npx vitest run src/services/gitlab.test.ts` |
| MERGE-02 | `compareRefs` maps `diffs.length` correctly; missing ref handled as data (404-as-missing), not a crash | service | same |
| D-08 | The `released` branch-row wording no longer asserts a merge (the word "merged" is gone) | component | `npx vitest run src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` |
| **MERGE-03** | **DESCOPED by D-12** — no override control exists, nothing persists. Same handling as DASH-06 (P84) and DRIFT-09 (P89). **No test. Absence is not a gap.** | — | — |

**Static assertion (grep, not a runtime test):** both new service functions call
`apiFetch('gitlab', …)` — zero raw `fetch` in `services/gitlab.ts` additions (P87 D-12a).

---

## Wave 0 Requirements

- [x] `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts` — **delivered** (47 tests) pure-module
      test file (sibling to `releaseBranch.test.ts`), covering every MERGE-02 precedence case above
- [x] **Delivered** — extended `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` — new
      "Merged back" row cases (4 visible states + hidden), **and update** the existing
      `branch-status-released` assertions to match D-08's softened wording
- [x] **Delivered** — extended `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` — assert query
      gating: zero calls for an unreleased version; both new queries fire for a released version with
      a matched milestone
- [x] **Delivered** — extended `taskflow/src/services/gitlab.test.ts` — mocked-fetch coverage for `fetchSourceBranchMRs`
      (2-page pagination fixture) and `compareRefs` (empty-diff, non-empty-diff, `compare_timeout: true`,
      and missing-ref fixtures)
- [x] No framework/config install needed — Vitest + Testing Library + jsdom already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Verdict correctness against **live** GitLab data | MERGE-01, MERGE-02 | Requires a real PAT, a real released fix version, and a real merged `release/*` branch. No live GitLab is reachable from CI or from any prior probe (P90's `probe.sh` never ran in any environment). Fixtures can prove the mapping, not the field semantics of this specific instance. | Open a released fix version's release detail page → confirm the "Merged back" row appears, names the **fetched** `project.default_branch` (never a hardcoded `main`/`develop`), and that the hover tooltip names the actual evidence (MR iid + merged date, or commit/diff count). |
| Verdict is read as **advisory**, not blocking | MERGE-01 (success criterion 3, minus the descoped override) | Subjective tone/placement judgement | At UAT: confirm the row is one line inside the Details block, carries no dismiss/confirm affordance, and nothing anywhere blocks or marks the release unfinished. |
| Old releases with no tag show `couldn't-verify`, not a soft accusation (D-09) | MERGE-02 | Depends on the real historical tag record, which P88's probe showed is incomplete | At UAT: open an old released version with no `v<version>` tag → row must read `? Couldn't verify`. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency (31 tasks / 9 plans)
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers all MISSING references above — all 4 items delivered
- [x] No watch-mode flags (`vitest run`, never bare `vitest`)
- [x] Feedback latency < 10s for targeted runs
- [x] MERGE-03 recorded as **descoped**, not as a gap (override accepted in 91-VERIFICATION.md)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-13 (retroactive audit via `/gsd-validate-phase`)

---

## Validation Audit 2026-08-13

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All four Wave 0 deliverables exist and pass; every plan maps to a green automated command. The
`nyquist_compliant: false` flag was **stale bookkeeping** — this file was written at plan time and never
updated after execution. No test was missing; nobody ticked the boxes.

The three Manual-Only rows below are correctly manual (they need a live GitLab instance with a real PAT,
a real released fix version, and a real merged `release/*` branch) and remain open. They are tracked as
open human-verification items in `.planning/v1.14-MILESTONE-AUDIT.md`, not as validation gaps.
