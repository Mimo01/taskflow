# Roadmap: Taskflow

## Milestones

- 🚧 **v1.14 Release Management** — Phases 87-91 (in progress)
- ✅ **v1.13 Personal Workspace** — Phases 81-86 (shipped 2026-06-16)
- ✅ **v1.12 Jira Experience Improvements** — Phases 76-80 (shipped 2026-06-07)
- ✅ **v1.11 GreenHopper API Migration** — Phases 71-75 (shipped 2026-06-01)
- ✅ **v1.10 Cleanup, Roles Removal & Standup Notes** — Phases 65-70 (shipped 2026-05-25)
- ✅ **v1.9 Tempo, Dashboard Redesign & Cleanup** — Phases 59-64 (shipped 2026-05-23)
- ✅ **v1.8 AIO Test Management** — Phases 50-58 (shipped 2026-05-19)
- ✅ **v1.7 Performance & Perceived Speed** — Phases 42-49 (shipped 2026-04-05)
- ✅ **v1.6.3 Release & Auto-Update Pipeline** — Phases 38-41 (shipped 2026-03-29)
- ✅ **v1.5 Dashboard Redesign & Feature Parity** — Phases 31-37 (shipped 2026-03-24)
- ✅ **v1.4 Internal Quality & Performance** — Phases 25-30 (shipped 2026-03-20)
- ✅ **v1.3 UX & Branding** — Phases 18-24 (shipped 2026-03-19)
- ✅ **v1.2 Jira Parity** — Phases 9-17 (shipped 2026-03-15)
- ✅ **v1.1 Polish** — Phases 5-8 (shipped 2026-03-13)
- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-03-12)

## Phases

**Phase Numbering:**

- Integer phases (87, 88, 89...): Planned milestone work
- Decimal phases (87.1, 87.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 87: Release Detail Decomposition** - `ReleaseDetailPage.tsx` (1518 LOC) split into a `release-detail/` folder mirroring `issue-detail/`, zero user-visible change
- [ ] **Phase 88: Release Branch & Milestone Creation** - resolve/detect the release branch and GitLab milestone, create either behind a confirm dialog
- [ ] **Phase 89: Three-Channel Drift Detection** - union Jira-linkage, GitLab-milestone, and branch-target MR discovery into one drift report (read-only)
- [ ] **Phase 90: Per-MR Corrective Actions** - retarget and assign-milestone per MR row, optimistic with independent retry
- [ ] **Phase 91: Post-Release Merge-Back Verification** - advisory check that a released tag's branch has landed in the default branch

### 🚧 v1.14 Release Management (In Progress)

**Milestone Goal:** Turn the Releases view from a read-only Jira↔GitLab match into a working release-coordination surface that detects git-flow drift and lets the user fix it per-MR.

## Phase Details

### Phase 87: Release Detail Decomposition

**Goal**: `ReleaseDetailPage.tsx` is decomposed into a `release-detail/` folder mirroring the existing `issue-detail/` precedent, with zero user-visible behavior change, so every later v1.14 phase lands in a reviewable, section-scoped file rather than growing an already-overloaded monolith.
**Depends on**: Nothing (first phase; continues from Phase 86)
**Requirements**: FOUND-01
**Success Criteria** (what must be TRUE):

  1. The release detail page renders identically (layout, data, interactions) before and after the refactor — no visible regression
  2. Release detail code lives in a `release-detail/` folder with one file per section/hook, matching the `issue-detail/` structure convention
  3. The full test suite (including release-detail-related tests) passes with zero regressions after decomposition

**Plans:** 6 plans
Plans:
**Wave 1**

- [x] 87-01-PLAN.md — Pure `releaseSummaries.ts` module + unit tests + move the two Jira fetchers into `services/jira.ts` via `apiFetch`

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 87-02-PLAN.md — `useReleaseDetail.ts` (6 queries verbatim) and rewire the page off its inline data layer

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 87-03-PLAN.md — Extract `MetaRow`, `ReleaseDetailSkeleton`, `ReleaseHeader`, `DescriptionsSection`, `LabelSummarySection`

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 87-04-PLAN.md — Extract `IssuesSection` with `UnmatchedMRsSection` nested inside its `<section>` wrapper (D-12b)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 87-05-PLAN.md — Extract `ReleaseDetailSidebar` and lift edit state into `useEditRelease.ts`

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 87-06-PLAN.md — Extract `EditReleaseModal`, final structural audit, full-suite gate + manual UAT

**UI hint**: yes

### Phase 88: Release Branch & Milestone Creation

**Goal**: Users can see whether the release branch and GitLab milestone exist for a release, and create either one directly from the release view when missing, so drift detection and corrective actions (later phases) always have a real branch/milestone to target.
**Depends on**: Phase 87
**Requirements**: RELBR-01, RELBR-02, RELBR-03, RELBR-04, RELBR-05, RELMS-01, RELMS-02, RELMS-03, RELMS-04
**Success Criteria** (what must be TRUE):

  1. User sees whether `release/<milestone title>` exists on the release detail view, with a release-level warning surfaced when it's missing
  2. User can create the missing release branch off the GitLab project default branch, behind a confirm dialog, with the branch name validated against git ref rules before creation
  3. User sees when no GitLab milestone matches the Jira fix version, and can create one (format `1.1.0`) behind a confirm dialog that lists recent milestones for reference
  4. A duplicate milestone title is detected and blocked before creation, with a clear message

**Plans**: TBD
**UI hint**: yes
**Probe**: yes — do a quick manual scan of `GET /projects/:id/milestones` for existing whitespace/near-duplicate titles that could confuse exact-title matching (RELMS-04). Note: permission/role gating is explicitly OUT OF SCOPE (team is all Developer+); a 403 surfaces as a normal `ApiError` and needs no probe

### Phase 89: Three-Channel Drift Detection

**Goal**: Users can see a single, reconciled view of every MR relevant to a release — discovered via Jira-key linkage, GitLab milestone, and release-branch targeting — with disagreements between channels flagged as drift, before any corrective write action is introduced.
**Depends on**: Phase 88 (needs the resolved release branch name for Channel C)
**Requirements**: DRIFT-01, DRIFT-02, DRIFT-03, DRIFT-04, DRIFT-05, DRIFT-06, DRIFT-07, DRIFT-08, DRIFT-09
**Success Criteria** (what must be TRUE):

  1. User sees one unified MR list for a release, built from three discovery channels (Jira-key linkage, GitLab milestone, release-branch target), each MR retaining which channel(s) found it
  2. User sees a flag on any MR whose target branch isn't the release branch, whose milestone isn't the release milestone, or whose Jira task isn't in the fix version
  3. Merged, closed, and draft MRs are classified separately and never inflate the drift count
  4. The release row shows an aggregate drift count reflecting the union of all flagged MRs

**Plans**: TBD
**UI hint**: yes
**Probe**: yes — verify whether any release branch in the team's GitLab history has ever carried >100 MRs targeting it (or build a synthetic >100-MR fixture) so the fully-paginated Channel C fetch is proven complete, not just theoretically correct

### Phase 90: Per-MR Corrective Actions

**Goal**: Users can fix flagged drift directly from an MR's row — retarget to the release branch and/or assign the release milestone — each as an independently retryable, optimistic action with no confirm dialog and no inline warning (per user decision).
**Depends on**: Phase 89 (drift flags must exist and be reviewable before write actions), Phase 88 (retarget needs a resolved, existing release branch)
**Requirements**: MRFIX-01, MRFIX-02, MRFIX-03, MRFIX-04
**Success Criteria** (what must be TRUE):

  1. User can retarget a flagged MR to the release branch directly from its row, applied immediately with optimistic update and rollback on failure — no confirm dialog, no warning
  2. User can assign the release milestone to a flagged MR directly from its row, applied immediately with optimistic update and rollback on failure
  3. Each corrective action shows its own per-row status and can be retried independently without affecting the other action's state
  4. The retarget action is unavailable/disabled while the release branch does not exist

**Plans**: TBD
**UI hint**: yes
**Probe**: yes — verify via a live MR with approvals whether MR-approval / protected-branch rules are actually configured on the team's project, since that determines whether the documented approval-reset side effect of retargeting is a real, observable consequence for this team

### Phase 91: Post-Release Merge-Back Verification

**Goal**: Once a Jira fix version is marked released, users can see — as an advisory verdict with manual override, never a hard blocker — whether `release/[tag]` has actually been merged back into the project default branch, closing the release-coordination loop.
**Depends on**: Phase 88 (needs the resolved release branch name and default branch)
**Requirements**: MERGE-01, MERGE-02, MERGE-03
**Success Criteria** (what must be TRUE):

  1. Once its Jira fix version is released, user sees whether `release/[tag]` has been merged into the project default branch
  2. Detection prefers the tracking MR's state (`merged`/`merged_at`) when one exists, and falls back to content comparison (`repository/compare`) when no such MR is found
  3. The verdict is presented as advisory ("likely not yet merged") with a manual "I confirmed this myself" override — never as a hard blocking state

**Plans**: TBD
**UI hint**: yes
**Probe**: yes — this phase is probe-gated: confirm the team's actual GitLab merge-strategy setting (Settings → Merge requests → squash vs merge-commit vs rebase) on the project(s) this milestone targets before finalizing the detection method, since squash/rebase merges make the raw `merged` field on `GET /repository/branches/:branch` unreliable as a negative signal (GitLab issue #36963)

<details>
<summary>✅ v1.13 Personal Workspace (Phases 81-86) — SHIPPED 2026-06-16</summary>

- [x] Phase 81: Charting Foundation (3/3 plans) — completed 2026-06-14
- [x] Phase 82: My Tasks Page (5/5 plans) — completed 2026-06-14
- [x] Phase 83: Dashboard Stat Tiles + Sprint Health (3/3 plans) — completed 2026-06-15
- [x] Phase 84: Dashboard Trend Chart + Activity Strip (4/4 plans) — completed 2026-06-15
- [x] Phase 85: Sprint Insights (Conditional, probe-gated) (4/4 plans) — completed 2026-06-15
- [x] Phase 86: Dashboard Redesign to Screenshot Layout (4/4 plans) — completed 2026-06-16

See archive: `.planning/milestones/v1.13-ROADMAP.md`

</details>

<details>
<summary>✅ v1.12 Jira Experience Improvements (Phases 76-80) — SHIPPED 2026-06-07</summary>

- [x] Phase 76: Visual Polish and Shared Primitives (4/4 plans) — completed 2026-06-03
- [x] Phase 77: Universal Peek Slideover and Issue-Detail Refinements (4/4 plans) — completed 2026-06-03
- [x] Phase 78: Drag-to-Rank on Backlog (4/4 plans) — completed 2026-06-04
- [x] Phase 79: Drag-to-Transition on Sprint Board (3/3 plans) — completed 2026-06-04
- [x] Phase 80: Subtask Templates and Bulk Creation (4/4 plans) — completed 2026-06-05

See archive: `.planning/milestones/v1.12-ROADMAP.md`

</details>

<details>
<summary>✅ v1.11 GreenHopper API Migration (Phases 71-75) — SHIPPED 2026-06-01</summary>

- [x] Phase 71: GreenHopper Adapter Foundation (6/6 plans) — completed 2026-05-28
- [x] Phase 72: Workflow Transitions via GreenHopper (3/3 plans) — completed 2026-05-29
- [x] Phase 73: Sprint Board on allData.json (3/3 plans) — completed 2026-05-29
- [x] Phase 74: Backlog on data.json (6/6 plans) — completed 2026-05-29
- [x] Phase 75: Progressive Issue Detail Rendering (4/4 plans) — completed 2026-05-30

See archive: `.planning/milestones/v1.11-ROADMAP.md`

</details>

<details>
<summary>✅ v1.0–v1.10 (Phases 1-70) — SHIPPED 2026-03-12 → 2026-05-25</summary>

Earlier milestones are collapsed. See per-milestone archives in `.planning/milestones/v{X.Y}-ROADMAP.md`:

- v1.0 MVP (Phases 1-4) — 2026-03-12
- v1.1 Polish (Phases 5-8) — 2026-03-13
- v1.2 Jira Parity (Phases 9-17) — 2026-03-15
- v1.3 UX & Branding (Phases 18-24) — 2026-03-19
- v1.4 Internal Quality & Performance (Phases 25-30) — 2026-03-20
- v1.5 Dashboard Redesign & Feature Parity (Phases 31-37) — 2026-03-24
- v1.6.3 Release & Auto-Update Pipeline (Phases 38-41) — 2026-03-29
- v1.7 Performance & Perceived Speed (Phases 42-49) — 2026-04-05
- v1.8 AIO Test Management (Phases 50-58) — 2026-05-19
- v1.9 Tempo, Dashboard Redesign & Cleanup (Phases 59-64) — 2026-05-23
- v1.10 Cleanup, Roles Removal & Standup Notes (Phases 65-70) — 2026-05-25

</details>

## Progress

**Execution Order:** Phases execute in numeric order: 87 → 88 → 89 → 90 → 91

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 87. Release Detail Decomposition | 4/6 | In Progress|  |
| 88. Release Branch & Milestone Creation | 0/TBD | Not started | - |
| 89. Three-Channel Drift Detection | 0/TBD | Not started | - |
| 90. Per-MR Corrective Actions | 0/TBD | Not started | - |
| 91. Post-Release Merge-Back Verification | 0/TBD | Not started | - |

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.14 Release Management | 5 (87-91) | TBD | in progress |
| v1.0 MVP | 4 (1-4) | 20 | 2026-03-12 |
| v1.1 Polish | 4 (5-8) | 24 | 2026-03-13 |
| v1.2 Jira Parity | 9 (9-17) | 29 | 2026-03-15 |
| v1.3 UX & Branding | 7 (18-24) | 27 | 2026-03-19 |
| v1.4 Internal Quality & Performance | 6 (25-30) | 21 | 2026-03-20 |
| v1.5 Dashboard Redesign & Feature Parity | 7 (31-37) | 25 | 2026-03-24 |
| v1.6.3 Release & Auto-Update Pipeline | 4 (38-41) | 10 | 2026-03-29 |
| v1.7 Performance & Perceived Speed | 9 (42-49) | 23 | 2026-04-05 |
| v1.8 AIO Test Management | 9 (50-58) | 45 | 2026-05-19 |
| v1.9 Tempo, Dashboard Redesign & Cleanup | 6 (59-64) | 20 | 2026-05-23 |
| v1.10 Cleanup, Roles Removal & Standup Notes | 6 (65-70) | 15 | 2026-05-25 |
| v1.11 GreenHopper API Migration | 5 (71-75) | 22 | 2026-06-01 |
| v1.12 Jira Experience Improvements | 5 (76-80) | 19 | 2026-06-07 |
| v1.13 Personal Workspace | 6 (81-86) | 23 | 2026-06-16 |
