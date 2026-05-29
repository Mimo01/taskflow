# Roadmap: Taskflow

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-03-12)
- ✅ **v1.1 Polish** — Phases 5-8 (shipped 2026-03-13)
- ✅ **v1.2 Jira Parity** — Phases 9-17 (shipped 2026-03-15)
- ✅ **v1.3 UX & Branding** — Phases 18-24 (shipped 2026-03-19)
- ✅ **v1.4 Internal Quality & Performance** — Phases 25-30 (shipped 2026-03-20)
- ✅ **v1.5 Dashboard Redesign & Feature Parity** — Phases 31-37 (shipped 2026-03-24)
- ✅ **v1.6.3 Release & Auto-Update Pipeline** — Phases 38-41 (shipped 2026-03-29)
- ✅ **v1.7 Performance & Perceived Speed** — Phases 42-49 (shipped 2026-04-05)
- ✅ **v1.8 AIO Test Management** — Phases 50-58 (shipped 2026-05-19)
- ✅ **v1.9 Tempo, Dashboard Redesign & Cleanup** — Phases 59-64 (shipped 2026-05-23)
- ✅ **v1.10 Cleanup, Roles Removal & Standup Notes** — Phases 65-70 (shipped 2026-05-25)
- ◆ **v1.11 GreenHopper API Migration** — Phases 71-75 (in progress, started 2026-05-28)

## Phases

### v1.11 GreenHopper API Migration (Active)

**Goal:** Eliminate Jira API n+1 bottlenecks by migrating the app's Jira backbone to the on-prem GreenHopper API (`/rest/greenhopper/1.0/xboard/*`). See `.planning/research/GREENHOPPER-API.md` for the endpoint reference and `.planning/REQUIREMENTS.md` for REQ-IDs.

**Cutover policy:** hard cutover per surface — each phase replaces its REST path in place; the old REST board/backlog/detail/transitions paths are deleted as their replacements ship.

#### Phase 71: GreenHopper Adapter Foundation

**Goal:** Build the typed GreenHopper API client and adapter layer that every later phase consumes. No UI changes ship in this phase.

**Requirements:** GH-ADAPT-01, GH-ADAPT-02, GH-ADAPT-03

**Success criteria:**

1. `services/jira/greenhopper/` module exists with typed fetchers for `allData`, `data`, `details`, `transitions` returning the documented response shapes
2. Entity-map resolvers translate `statusId` / `priorityId` / `typeId` / `epicId` into the existing UI `Status` / `Priority` / `Type` / `Epic` types
3. `adaptIssue(greenhopperIssue, entityMaps)` produces an object that the existing sprint-board / backlog `Issue` consumers accept without code changes
4. Unit tests cover the adapter with fixtures captured from a real GreenHopper response

**Plans:** 6/6 plans complete

- [x] 71-01-PLAN.md — Wave 0: capture script + redacted real fixtures (blocks all)
- [x] 71-02-PLAN.md — Wave 1: greenhopperFetch client + types.ts
- [x] 71-03-PLAN.md — Wave 2: four typed fetchers (allData/data/details/transitions) + tests
- [x] 71-04-PLAN.md — Wave 2: buildEntityMaps + resolvers + warnOnce + tests
- [x] 71-05-PLAN.md — Wave 3: adaptIssue + createAdapter + fixture-driven tests
- [x] 71-06-PLAN.md — Wave 4: public barrel + jira.ts re-export (D-05) + full suite verify

#### Phase 72: Workflow Transitions via GreenHopper

**Goal:** Replace per-issue REST `/transitions` calls with a cached per-project `transitions.json` map; wire it into sprint-board drag-to-transition and issue-detail status change.

**Requirements:** GH-TRANS-01, GH-TRANS-02, GH-TRANS-03

**Success criteria:**

1. `transitions.json` is fetched once per project per session and cached, keyed by `projectId × issueTypeId → workflow → transitions[]`
2. Sprint-board drag-to-transition reads available transitions from the cache (no per-issue REST `/transitions` call in the network log)
3. Issue-detail status change reads from the same cache
4. Cache is refreshed on session start and via a manual refresh action; the old per-issue `/transitions` REST path is deleted

**Plans:** 3/3 plans complete

Plans:

- [x] 72-01-PLAN.md — Wave 1: warnOnce extract + statuses.ts + transitions cache (useGhTransitions/getGhTransitions/invalidateGhTransitions) + jira.ts re-exports + tests
- [x] 72-02-PLAN.md — Wave 2: swap 4 call sites (StatusPopover, SprintBoardTab, BulkActionBar, QuickCreateInput) + sprint-board toolbar 'Reload workflow transitions' action
- [x] 72-03-PLAN.md — Wave 3: hard cutover — delete legacy fetchTransitions GET from services/jira.ts and services/jira/transitions.ts + tests; full suite green

#### Phase 73: Sprint Board on `allData.json`

**Goal:** Replace the multi-call sprint-board fetch with a single `allData.json` call; render columns from `columnsData` and surface `timeInColumn`.

**Requirements:** GH-BOARD-01, GH-BOARD-02, GH-BOARD-03, GH-BOARD-04

**Success criteria:**

1. Opening the sprint board issues exactly one `allData.json` request to load issues + columns + swimlanes + entity maps (verified in the network log)
2. Columns render from GreenHopper `columnsData`; subtasks are grouped under their parent story via `parentId`
3. `timeInColumn.enteredStatus` is available on each card / consumed by the existing "time in status" UI
4. Drag-to-transition (optimistic + rollback), QuickCreateInput, epic / quick-filter / label filters, and sprint goal banner all work; old REST board-fetch path is deleted

**Plans:** 3 plans

Plans:

- [x] 73-01-PLAN.md — Wave 1: useGhAllData hook + getGhAllData + invalidateGhAllData + formatTimeAgo helpers + jira.ts re-exports + tests
- [x] 73-02-PLAN.md — Wave 2: SprintBoardTab data-layer rewrite onto useGhAllData (statusCategory bucketing, orphan-subtask warnOnce, R-04 projectId source) + TaskCard timeInColumn badge
- [x] 73-03-PLAN.md — Wave 3: single "Reload board" toolbar (5-key invalidation per R-01/R-02) + Sidebar prefetch swap to getGhAllData + delete fetchSprintSubtasks (GH-CUT-01)

#### Phase 74: Backlog on `data.json`

**Goal:** Replace the paginated REST backlog fetch with a single `data.json` call.

**Requirements:** GH-BACKLOG-01, GH-BACKLOG-02

**Success criteria:**

1. Opening the backlog issues exactly one `data.json` request (verified in the network log)
2. Move-to-sprint, create story, filter by epic / label / assignee, and virtualized rendering all work on the new data source
3. Old REST backlog-fetch path is deleted

**Plans:** 6 plans

Plans:

- [x] 74-01-PLAN.md — Wave 0: type widening (GhBacklogResponse per D-04a) + Wave 0 test scaffolds (types pin, useGhBacklogData RED, adapter-backlog RED, BacklogPage.network RED, Sidebar.prefetch RED) + static-grep guard script
- [x] 74-02-PLAN.md — Wave 1: useGhBacklogData / getGhBacklogData / invalidateGhBacklogData + greenhopper barrel + services/jira.ts re-exports (D-09b)
- [x] 74-03-PLAN.md — Wave 2: BacklogPage data-layer rewrite (single useGhBacklogData, adapter chain, sprint reverse-index, ACTIVE/FUTURE filter, mutation invalidation swap, drop label/subtask/flagged chips)
- [x] 74-04-PLAN.md — Wave 2: Sidebar /backlog prefetch collapse 3 → 1 (getGhBacklogData)
- [ ] 74-05-PLAN.md — Wave 3: Reload backlog toolbar action + aria-live status region + human-verify checkpoint
- [ ] 74-06-PLAN.md — Wave 4: hard-cutover delete (fetchBacklogIssues / fetchBacklogSprintStories / fetchBacklogView / BacklogViewData) + activate check:legacy-backlog guard + full-suite gate

#### Phase 75: Issue Detail on `details.json` + Performance Verification

**Goal:** Replace the multi-fetch issue detail panel with a single `details.json` call; render server HTML where viable, fall back to REST v2 for interactive composers; record before/after perf metrics and confirm no REST paths replaced by this milestone remain.

**Requirements:** GH-DETAIL-01, GH-DETAIL-02, GH-DETAIL-03, GH-DETAIL-04, GH-CUT-01, GH-CUT-02

**Success criteria:**

1. Opening an issue detail panel issues exactly one `details.json` request for operations + sprint + tabs (verified in the network log)
2. HEADER / DETAILS tabs render from `defaultTabs` fields and `inlineEditableFields`; COMMENT / ATTACHMENT / SUB_TASKS / ISSUES_IN_EPIC tabs render from `Section.html` with documented REST v2 fallbacks for interactive surfaces (comment composer, attachment upload)
3. Existing detail-panel features (edit fields, post comment, open-in-Jira deep link, pin, clone, watcher toggle) work unchanged
4. Verification artifact records before/after request counts and end-to-end time for sprint-board open, backlog open, and issue-detail open; confirms the old REST paths for board / backlog / detail / transitions no longer exist in the codebase

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-03-12</summary>

- [x] Phase 1: Foundation (6/6 plans) — completed 2026-03-11
- [x] Phase 2: Developer Dashboard (7/7 plans) — completed 2026-03-11
- [x] Phase 3: Notifications Hub (2/2 plans) — completed 2026-03-12
- [x] Phase 4: PM Dashboard + Search (5/5 plans) — completed 2026-03-12

See archive: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Polish (Phases 5-8) — SHIPPED 2026-03-13</summary>

- [x] Phase 5: API Foundation + Quick Wins (8/8 plans) — completed 2026-03-12
- [x] Phase 6: Workload + Sprint Progress Enrichment (3/3 plans) — completed 2026-03-12
- [x] Phase 7: Story/Subtask Hierarchy + MR Subtask Filter (5/5 plans) — completed 2026-03-13
- [x] Phase 8: Dashboard Enrichment (8/8 plans) — completed 2026-03-13

See archive: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 Jira Parity (Phases 9-17) — SHIPPED 2026-03-15</summary>

- [x] Phase 9: Custom Field Discovery + Issue Detail Foundation (8/8 plans) — completed 2026-03-14
- [x] Phase 10: Sprint Board Redesign (4/4 plans) — completed 2026-03-14
- [x] Phase 11: Create/Edit Issue Form (5/5 plans) — completed 2026-03-14
- [x] Phase 12: Backlog View (4/4 plans) — completed 2026-03-14
- [x] Phase 13: Epic Management (5/5 plans) — completed 2026-03-14
- [x] Phase 14: Fix v1.2 Wiring and Credential Bugs (3/3 plans) — completed 2026-03-15
- [x] Phase 15: Fix BOARD-04 statusId Bug — completed 2026-03-15
- [x] Phase 16: Write Missing Phase 10 + 11 VERIFICATION.md — completed 2026-03-15
- [x] Phase 17: Nyquist Validation — Phases 9–14 — completed 2026-03-15

See archive: `.planning/milestones/v1.2-ROADMAP.md`

</details>

<details>
<summary>✅ v1.3 UX & Branding (Phases 18-24) — SHIPPED 2026-03-19</summary>

- [x] Phase 18: App Icon + Multi-Page Settings (6/6 plans) — completed 2026-03-15
- [x] Phase 19: Keyboard Foundation (6/6 plans) — completed 2026-03-15
- [x] Phase 20: Command Palette + Recent Items (6/6 plans) — completed 2026-03-16
- [x] Phase 21: Header Redesign + Pinned Issue Tabs (5/5 plans) — completed 2026-03-16
- [x] Phase 22: Polish — Empty States + Error Recovery (3/3 plans) — completed 2026-03-16
- [x] Phase 23: Fix J/K Guard (architecturally resolved) — completed 2026-03-19
- [x] Phase 24: Verify Phase 22 (1/1 plan) — completed 2026-03-19

See archive: `.planning/milestones/v1.3-ROADMAP.md`

</details>

<details>
<summary>✅ v1.4 Internal Quality & Performance (Phases 25-30) — SHIPPED 2026-03-20</summary>

- [x] Phase 25: Tooling & Dependencies (2/2 plans) — completed 2026-03-19
- [x] Phase 26: Test Regression Fixes (3/3 plans) — completed 2026-03-19
- [x] Phase 27: Refactoring & Type Safety (5/5 plans) — completed 2026-03-19
- [x] Phase 28: Test Coverage, Performance & Accessibility (5/5 plans) — completed 2026-03-20
- [x] Phase 29: Developer Tools (3/3 plans) — completed 2026-03-20
- [x] Phase 30: Fix A11Y-01 Test Regression & Checkbox Cleanup (1/1 plan) — completed 2026-03-20

See archive: `.planning/milestones/v1.4-ROADMAP.md`

</details>

<details>
<summary>✅ v1.5 Dashboard Redesign & Feature Parity (Phases 31-37) — SHIPPED 2026-03-24</summary>

- [x] Phase 31: Issue Detail Enrichment (4/4 plans) — completed 2026-03-22
- [x] Phase 32: Time Tracking, Attachments & Mentions (5/5 plans) — completed 2026-03-22
- [x] Phase 33: Board, Sprint & Filters (6/6 plans) — completed 2026-03-23
- [x] Phase 34: Layout Customization (5/5 plans) — completed 2026-03-23
- [x] Phase 35: Restore Saved Filters (3/3 plans) — completed 2026-03-24
- [x] Phase 36: Restore Sidebar Drag-Reorder (1/1 plan) — completed 2026-03-24
- [x] Phase 37: Wire Saved Filters to Sprint Board (1/1 plan) — completed 2026-03-24

See archive: `.planning/milestones/v1.5-ROADMAP.md`

</details>

<details>
<summary>✅ v1.6.3 Release & Auto-Update Pipeline (Phases 38-41) — SHIPPED 2026-03-29</summary>

- [x] Phase 38: Updater Foundation + Service Layer (3/3 plans) — completed 2026-03-24
- [x] Phase 39: Update UX + Version Policy (2/2 plans) — completed 2026-03-24
- [x] Phase 40: Settings, About & Menu Integration (3/3 plans) — completed 2026-03-25
- [x] Phase 41: CI Pipeline (2/2 plans) — completed 2026-03-25

See archive: `.planning/milestones/v1.6.3-ROADMAP.md`

</details>

<details>
<summary>✅ v1.7 Performance & Perceived Speed (Phases 42-49) — SHIPPED 2026-04-05</summary>

- [x] Phase 42: Foundation (3/3 plans) — completed 2026-03-29
- [x] Phase 43: Cache Correctness (2/2 plans) — completed 2026-03-29
- [x] Phase 44: Loading UX (4/4 plans) — completed 2026-03-30
- [x] Phase 45: Query Optimization (3/3 plans) — completed 2026-03-30
- [x] Phase 46: Avatar Caching (2/2 plans) — completed 2026-03-30
- [x] Phase 47: v1.7 Debt Cleanup (2/2 plans) — completed 2026-03-31
- [x] Phase 47: Optimize Backlog Performance (2/2 plans) — completed 2026-03-31
- [x] Phase 48: Restore Backlog Progressive Loading (3/3 plans) — completed 2026-04-04
- [x] Phase 49: Fix Backlog Query Key Wiring & Doc Debt (2/2 plans) — completed 2026-04-04

See archive: `.planning/milestones/v1.7-ROADMAP.md`

</details>

<details>
<summary>✅ v1.8 AIO Test Management (Phases 50-58) — SHIPPED 2026-05-19</summary>

- [x] **Phase 50: Draggable Sidebar Resize** — completed 2026-05-10
- [x] **Phase 51: AIO Service Layer** — completed 2026-05-12
- [x] **Phase 52: AIO Navigation + Project Pages** — completed 2026-05-13
- [x] **Phase 53: Cycle Detail + Header Pinning** — completed 2026-05-13
- [x] **Phase 54: AIO on Issue Detail** — completed 2026-05-14
- [x] **Phase 55: AIO Project Selection in Settings** — completed 2026-05-14
- [x] **Phase 56: Redesign AIO cycles page + tabs + loading optimization** — completed 2026-05-14
- [x] **Phase 57: Redesign AIO cycles page (folder tree + batch summary)** — completed 2026-05-15
- [x] **Phase 58: Redesign data fetch of AIO cycle detail** — completed 2026-05-15

See archive: `.planning/milestones/v1.8-ROADMAP.md`

</details>

<details>
<summary>✅ v1.9 Tempo, Dashboard Redesign & Cleanup (Phases 59-64) — SHIPPED 2026-05-23</summary>

- [x] Phase 59: Dashboard Cleanup + Dependency Removal (3/3 plans) — completed 2026-05-20
- [x] Phase 60: Static Dashboard / Welcome Screen (6/6 plans) — completed 2026-05-21
- [x] Phase 61: Tempo Probe + Service Layer (4/4 plans) — completed 2026-05-21
- [x] Phase 62: Tempo Worklog Viewer UI (2/2 plans) — completed 2026-05-21
- [x] Phase 63: Tempo Saved Filters + Test Pass (3/3 plans) — completed 2026-05-21
- [x] Phase 64: Worklogs Hierarchy + Sticky + Popover CRUD (2/2 plans) — completed 2026-05-23

See archive: `.planning/milestones/v1.9-ROADMAP.md`

</details>

<details>
<summary>✅ v1.10 Cleanup, Roles Removal & Standup Notes (Phases 65-70) — SHIPPED 2026-05-25</summary>

- [x] Phase 65: Tech Debt Cleanup (2/2 plans) — completed 2026-05-24
- [x] Phase 66: Roles Removal (2/2 plans) — completed 2026-05-24
- [x] Phase 67: Settings UI Cleanup (1/1 plan) — completed 2026-05-24
- [x] Phase 68: Startup Wizard — Integrations Step (3/3 plans) — completed 2026-05-24
- [x] Phase 69: Standup Notes — Route + Yesterday Recap (4/4 plans) — completed 2026-05-25
- [x] Phase 70: Standup Notes — Today Section (3/3 plans) — completed 2026-05-25

See archive: `.planning/milestones/v1.10-ROADMAP.md`

</details>

## Progress

All v1.0-v1.10 phases shipped. See per-milestone archives in `.planning/milestones/v{X.Y}-ROADMAP.md` for phase-level history.

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
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
| v1.11 GreenHopper API Migration (active) | 5 (71-75) | — | in progress |

---

_v1.11 started 2026-05-28 — Phase 71 (GreenHopper Adapter Foundation) is next._
