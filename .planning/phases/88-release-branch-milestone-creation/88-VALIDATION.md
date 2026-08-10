---
phase: 88
slug: release-branch-milestone-creation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-10
---

# Phase 88 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `88-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 (jsdom, globals, `./src/test/setup.ts`) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `npm run test -- src/routes/dashboard/release-detail/releaseBranch.test.ts` |
| **Full suite command** | `npm run test` (== `vitest run`) |
| **Estimated runtime** | ~5s quick / ~60s full |

**Static gate:** `npm run check` (biome + tsc) must show zero NEW errors relative to the documented 2-error `BacklogPage.tsx` / `BacklogRow.tsx` formatting baseline (STATE.md). Do not gate on a "clean run".

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- <touched test file>`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green + `npm run check` at baseline
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Task IDs are filled in by the planner. Requirement → test-type mapping below is fixed by research.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | RELBR-01 | — | N/A | unit | `npm run test -- releaseBranch.test.ts -t "deriveReleaseBranchName"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | RELBR-05 | T-88-V5 | Git-ref rules enforced before any write call | unit | `npm run test -- releaseBranch.test.ts -t "isValidGitRefName"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | RELMS-03 | T-88-V5 | Title format `X.Y.Z (DD.MM.YYYY)` enforced before write | unit | `npm run test -- releaseBranch.test.ts -t "MILESTONE_TITLE_FORMAT"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | RELMS-04 | — | Duplicate title blocked client-side pre-write | unit | `npm run test -- releaseMilestoneDuplicate.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | RELBR-02 | — | 404 from `GET .../branches/:branch` treated as "missing", not thrown | unit (mocked fetch) + manual UAT | `npm run test -- src/services/gitlab.test.ts` (if added) / manual | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | RELBR-03 | — | N/A | manual UAT | manual click-through (release-level warning when branch missing) | n/a | ⬜ pending |
| TBD | TBD | 2 | RELBR-04 | T-88-INJ | `encodeURIComponent` on branch name in every URL path segment | unit (derivation/dialog logic) + manual (live write) | `npm run test -- releaseBranch.test.ts` / manual | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | RELMS-01 | — | N/A | existing unit coverage (`resolveGitLabMatch` in `releaseSummaries.test.ts`) | `npm run test -- releaseSummaries.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 2 | RELMS-02 | T-88-INJ | Milestone write goes through `apiFetch` (PAT redaction preserved) | manual UAT (live write) | manual click-through | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/routes/dashboard/release-detail/releaseBranch.test.ts` — stubs for RELBR-01 (`deriveReleaseBranchName`) and RELBR-05 (`isValidGitRefName`)
- [ ] Milestone title format regex test — RELMS-03 (`MILESTONE_TITLE_FORMAT`); co-located in `releaseBranch.test.ts` or a sibling `releaseMilestone.test.ts` depending on where the planner puts the constant
- [ ] `releaseMilestoneDuplicate.test.ts` (or equivalent) — RELMS-04 pure duplicate-match against a fixture milestone list (windowed + ancestor-filtered)
- [ ] Framework install: **none** — Vitest is already configured; `releaseSummaries.test.ts` lives in the same folder as the reference pattern

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Branch exists/missing row renders on release detail sidebar | RELBR-02 | Requires live GitLab data + rendered app | Open a release with an existing `release/<version>` branch and one without; confirm both states render per 88-UI-SPEC.md |
| Release-level warning appears when branch missing | RELBR-03 | Visual/placement assertion | Open a release with no matching branch; confirm the release-level warning surfaces |
| Branch actually created off default branch | RELBR-04 | Live write to GitLab; not safely automatable | Trigger create from the confirm dialog; verify in GitLab that `release/<version>` exists and points at the project default branch HEAD |
| Milestone actually created; dialog lists recent milestones | RELMS-02, RELMS-03 | Live write + dialog rendering | Open the create-milestone dialog on a release with no GitLab match; confirm the recent-milestone reference list renders, then create and verify in GitLab |
| GitLab 400 "already exists" surfaces as in-dialog error | RELBR-04, RELMS-02 | Requires a real server-side rejection | Attempt to create a branch/milestone that already exists; confirm the error renders inside the dialog (not as a toast/crash) |
| **Probe (gates RELMS-04 fuzzy-vs-exact decision)** | RELMS-04 | Needs the app's stored PAT (Tauri stronghold) | Run `.planning/phases/88-release-branch-milestone-creation/probe.sh` with `GITLAB_BASE_URL`, `GITLAB_PAT`, `PROJECT_ID` set; check for whitespace/case/near-duplicate titles and `project_id`/`group_id` presence |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, never `vitest`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
