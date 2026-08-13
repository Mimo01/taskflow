---
phase: 88
slug: release-branch-milestone-creation
status: planned
nyquist_compliant: true
wave_0_complete: false  # closed by Plan 88-01 at execution time
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
| 88-01-T1 | 88-01 | 1 | RELBR-01 | T-88-INJ-PRE | Derived name constrained to `release/` + `\d+\.\d+\.\d+`; unparseable titles yield `null`, never a guess | unit | `npm run test -- src/routes/dashboard/release-detail/releaseBranch.test.ts -t "deriveReleaseBranchName"` | ✅ created by 88-01-T1 | ⬜ pending |
| 88-01-T1 | 88-01 | 1 | RELBR-05 | T-88-V5 | Git-ref rules enforced before any write call | unit | `npm run test -- src/routes/dashboard/release-detail/releaseBranch.test.ts -t "isValidGitRefName"` | ✅ created by 88-01-T1 | ⬜ pending |
| 88-01-T2 | 88-01 | 1 | RELMS-03 | T-88-V5 | Title format `X.Y.Z (DD.MM.YYYY)` enforced before write (anchored regex, single source of truth) | unit | `npm run test -- src/routes/dashboard/release-detail/releaseMilestone.test.ts -t "MILESTONE_TITLE_FORMAT"` | ✅ created by 88-01-T2 | ⬜ pending |
| 88-01-T2 | 88-01 | 1 | RELMS-04 | T-88-DUP | Duplicate title blocked client-side pre-write (normalized compare, exact-input write); ancestor milestones excluded | unit | `npm run test -- src/routes/dashboard/release-detail/releaseMilestone.test.ts -t "findDuplicateMilestone"` | ✅ created by 88-01-T2 | ⬜ pending |
| 88-02-T1 | 88-02 | 1 | RELBR-04 | T-88-ID | `fetchProject` supplies the real `default_branch`; no hardcoded `main`; call goes through `apiFetch` (PAT redaction) | unit (mocked fetch) | `npm run test -- src/services/gitlab.test.ts -t "fetchProject"` | ✅ existing file, new describe | ⬜ pending |
| 88-02-T1 | 88-02 | 1 | RELBR-03 | T-88-DOS | Branch set fetched in ONE fully-paginated `search=release/` call — no page cap, no per-row query | unit (mocked fetch, 2-page sequence) | `npm run test -- src/services/gitlab.test.ts -t "fetchProjectBranches"` | ✅ existing file, new describe | ⬜ pending |
| 88-02-T2 | 88-02 | 1 | RELBR-02 | T-88-INJ | 404 from `GET .../branches/:branch` treated as "missing", not thrown; branch name `encodeURIComponent`-encoded in the path segment | unit (mocked fetch) | `npm run test -- src/services/gitlab.test.ts -t "404-as-missing"` | ✅ existing file, new describe | ⬜ pending |
| 88-02-T2 | 88-02 | 1 | RELMS-02 | T-88-INJ, T-88-ID | Milestone/branch writes go through `apiFetch` (PAT redaction); GitLab `message` body surfaced verbatim incl. `string[]` shape | unit (mocked fetch) | `npm run test -- src/services/gitlab.test.ts -t "createMilestone"` | ✅ existing file, new describe | ⬜ pending |
| 88-03-T1 | 88-03 | 2 | RELBR-02 | T-88-INJ | Branch query gated on a non-null derived name; windowed milestone key unchanged (D-05 cache contract) | static + regression suite | `npx tsc --noEmit` and `npm run test -- src/routes/dashboard/ReleasesTab.test.tsx src/routes/dashboard/release-detail/` | ✅ | ⬜ pending |
| 88-03-T2 | 88-03 | 2 | RELBR-03 | T-88-V5 | Missing-branch warning renders; `invalid-ref` state exposes no create affordance | component (jsdom) | `npm run test -- src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` | ✅ created by 88-03-T2 | ⬜ pending |
| 88-03-T2 | 88-03 | 2 | RELMS-01 | — | Existing "No milestone matched" row/alert unchanged | existing unit coverage (`resolveGitLabMatch`) + component | `npm run test -- src/routes/dashboard/release-detail/releaseSummaries.test.ts` | ✅ | ⬜ pending |
| 88-04-T1 | 88-04 | 2 | RELBR-03 | T-88-DOS | Exactly ONE branch-set fetch regardless of row count (fetch-once page-cap regression guard) | component (jsdom, call-count assertion) | `npm run test -- src/routes/dashboard/ReleasesTab.test.tsx -t "drift indicators"` | ✅ existing file, new describe | ⬜ pending |
| 88-04-T2 | 88-04 | 2 | RELMS-01 | T-88-XSS | Missing indicators render as `size-3` orange icons with hardcoded native `title` copy — no badge, no injected markup | component (jsdom) | `npm run test -- src/routes/dashboard/ReleasesTab.test.tsx -t "drift indicators"` | ✅ existing file, new describe | ⬜ pending |
| 88-05-T1 | 88-05 | 3 | RELBR-04 | T-88-ERR | Server error renders inside the dialog; dialog stays open (D-16) | component (jsdom) | `npm run test -- src/routes/dashboard/release-detail/CreateBranchDialog.test.tsx` | ✅ created by 88-05-T1 | ⬜ pending |
| 88-05-T2 | 88-05 | 3 | RELBR-05 | T-88-V5 | Invalid git ref has no reachable write path (Create disabled); `ref` is the fetched `default_branch` | static + regression suite | `npx tsc --noEmit` and `npm run test -- src/routes/dashboard/release-detail/` | ✅ | ⬜ pending |
| 88-05-T3 | 88-05 | 3 | RELBR-04 | T-88-AUTH, T-88-CSRF-ANALOG | Live write behind a blocking confirm dialog; 403 / protected-branch rejection surfaces in-dialog | manual UAT (live write) | manual click-through — see plan `<how-to-verify>` steps 1-8 | n/a | ⬜ pending |
| 88-06-T1 | 88-06 | 4 | RELMS-03, RELMS-04 | T-88-V5, T-88-DUP | Off-format and duplicate titles cannot be submitted; exact user input preserved for the write | component (jsdom) | `npm run test -- src/routes/dashboard/release-detail/CreateMilestoneDialog.test.tsx` | ✅ created by 88-06-T1 | ⬜ pending |
| 88-06-T2 | 88-06 | 4 | RELMS-02 | T-88-INJ, T-88-ID | Write goes through `apiFetch` with title + `due_date` only; existing windowed milestone key invalidated (no parallel query) | static + regression suite | `npx tsc --noEmit` and `npm run test -- src/routes/dashboard/release-detail/ src/routes/dashboard/ReleasesTab.test.tsx` | ✅ | ⬜ pending |
| 88-06-T3 | 88-06 | 4 | RELMS-02, RELMS-04 | T-88-ERR, T-88-DUP | Out-of-window duplicate rejected server-side renders verbatim in-dialog (D-08) | manual UAT (live write) | manual click-through — see plan `<how-to-verify>` steps 1-9 | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> **Planner resolution:** all four gaps are closed by **Plan 88-01 (Wave 1)**, which is the phase's Wave 0. No plan in Wave 2+ may start before 88-01 lands.

- [x] `src/routes/dashboard/release-detail/releaseBranch.test.ts` — RELBR-01 (`deriveReleaseBranchName`) and RELBR-05 (`isValidGitRefName`), plus `resolveBranchState` → **Task 88-01-T1**
- [x] Milestone title format regex test — RELMS-03 (`MILESTONE_TITLE_FORMAT`). **Planner decision:** the constant lives in a sibling module `releaseMilestone.ts`, so the test is `releaseMilestone.test.ts`, not `releaseBranch.test.ts` → **Task 88-01-T2**
- [x] Duplicate-detection test — RELMS-04 pure duplicate-match against a fixture milestone list (windowed + ancestor-filtered). **Planner decision:** co-located in `releaseMilestone.test.ts` rather than a standalone `releaseMilestoneDuplicate.test.ts`, since the duplicate matcher and the format constant share a module → **Task 88-01-T2**
- [x] Framework install: **none** — Vitest is already configured; `releaseSummaries.test.ts` lives in the same folder as the reference pattern
- [x] Service-layer coverage (not a formal Wave 0 gap, added by the planner): `src/services/gitlab.test.ts` already exists with a `vi.mock('@tauri-apps/plugin-http')` harness, so all five new GitLab functions get mocked-fetch unit tests in **Plan 88-02 (Wave 1)** — including the 404-as-missing path and the two-page pagination assertion

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — the only two tasks without `<automated>` are the blocking human-verify checkpoints 88-05-T3 and 88-06-T3, which cover live GitLab writes that cannot be safely automated
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — every `type="auto"` task in all six plans carries at least one `<automated>` command
- [x] Wave 0 covers all MISSING references — all four gaps map to Plan 88-01 (Wave 1); see the resolution note above
- [x] No watch-mode flags — every command uses `npm run test` (== `vitest run`); no bare `vitest` invocation appears in any plan
- [x] Feedback latency < 60s — every per-task command is file-scoped (`-- <path>` or `-t "<name>"`), well under the ~5s quick-run budget
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-signed 2026-08-10 (Phase 88 plan set 88-01…88-06)
