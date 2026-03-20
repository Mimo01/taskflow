# Roadmap: Taskflow

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-03-12)
- ✅ **v1.1 Polish** — Phases 5-8 (shipped 2026-03-13)
- ✅ **v1.2 Jira Parity** — Phases 9-17 (shipped 2026-03-15)
- ✅ **v1.3 UX & Branding** — Phases 18-24 (shipped 2026-03-19)
- 🚧 **v1.4 Internal Quality & Performance** — Phases 25-29 (in progress)

## Phases

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

### v1.4 Internal Quality & Performance (In Progress)

**Milestone Goal:** Harden the codebase with tests, consistent patterns, tooling, and API profiling — no new user-facing features.

- [x] **Phase 25: Tooling & Dependencies** - Biome linter/formatter setup, dependency updates (completed 2026-03-19)
- [x] **Phase 26: Test Regression Fixes** - Fix pre-existing test failures and warnings (completed 2026-03-19)
- [x] **Phase 27: Refactoring & Type Safety** - Service decomposition, shared utilities, strict typing (completed 2026-03-19)
- [x] **Phase 28: Test Coverage, Performance & Accessibility** - New unit tests, virtualization, aria fixes (completed 2026-03-20)
- [x] **Phase 29: Developer Tools** - Unified debug/profiling page with granular settings (completed 2026-03-20)

## Phase Details

### Phase 25: Tooling & Dependencies
**Goal**: Codebase uses consistent automated formatting/linting and all dependencies are current
**Depends on**: Nothing (first phase of v1.4)
**Requirements**: TOOL-01, TOOL-02, DEPS-01
**Success Criteria** (what must be TRUE):
  1. Running `biome check` on the entire source tree passes with zero errors
  2. A CI-ready script exists that fails on lint/format violations
  3. All npm dependencies are at their latest compatible versions with no runtime regressions
  4. `npm audit` shows no high/critical vulnerabilities introduced by updates
**Plans**: 2 plans
Plans:
- [ ] 25-01-PLAN.md — Install Biome, configure linting/formatting, auto-fix entire codebase
- [ ] 25-02-PLAN.md — Update all npm dependencies (minor/patch + 4 major jumps)

### Phase 26: Test Regression Fixes
**Goal**: All pre-existing test failures and warnings are resolved so the test suite runs clean
**Depends on**: Phase 25
**Requirements**: TEST-03, TEST-04, TEST-05
**Success Criteria** (what must be TRUE):
  1. The 6 Phase 8 test regressions pass (previously failing since v1.2)
  2. The 8 LazyStore teardown warnings no longer appear in test output
  3. The 2 TypeScript errors in test files are resolved and `tsc --noEmit` passes on test files
  4. `npm test` runs with zero failures and zero warnings
**Plans**: 3 plans
Plans:
- [ ] 26-01-PLAN.md — Global LazyStore mock in setup.ts, npm test script, jira.ts unused var fix
- [ ] 26-02-PLAN.md — Fix all 57 failing tests across 10 test files and TS errors
- [ ] 26-03-PLAN.md — Gap closure: add vitest globals type reference to setup.ts (tsc fix)

### Phase 27: Refactoring & Type Safety
**Goal**: Large modules are decomposed into focused units and all unsafe type patterns are eliminated
**Depends on**: Phase 26
**Requirements**: REFAC-01, REFAC-02, REFAC-03, REFAC-04, REFAC-05, REFAC-06, REFAC-07, REFAC-08, TYPE-01, TYPE-02
**Success Criteria** (what must be TRUE):
  1. jira.ts is replaced by focused domain modules (issues, sprints, fields, projects, epics, backlog) with no change in API behavior
  2. CreateEditIssueModal and IssueDetailSidebar are composed of smaller sub-components (each under 200 lines)
  3. A single `createTauriStorage()` utility is used by all 4 stores that currently duplicate LazyStore adapter code
  4. Zero `as unknown as X` double-casts and zero `any` types remain in production source files
  5. All existing tests still pass after refactoring (no regressions introduced)
**Plans**: 5 plans
Plans:
- [ ] 27-01-PLAN.md — Shared utilities (createTauriStorage), route extraction, inline style cleanup
- [ ] 27-02-PLAN.md — jira.ts decomposition into domain modules with barrel export
- [ ] 27-03-PLAN.md — CreateEditIssueModal decomposition with useReducer
- [ ] 27-04-PLAN.md — IssueDetailSidebar decomposition into section sub-components
- [ ] 27-05-PLAN.md — Double-cast fixes, TYPE-02 verification, Biome strict rules

### Phase 28: Test Coverage, Performance & Accessibility
**Goal**: Service and store layers have comprehensive tests, long lists are virtualized, and forms are accessible
**Depends on**: Phase 27
**Requirements**: TEST-01, TEST-02, PERF-01, PERF-02, A11Y-01, A11Y-02
**Success Criteria** (what must be TRUE):
  1. Every service module (jira/*, gitlab, notifications) has unit tests covering happy path and at least one error case
  2. Every Zustand store has unit tests covering state transitions and persistence round-trips
  3. Notification list, backlog list, and sprint board render 200+ items without visible scroll jank (virtualized)
  4. All form inputs in CreateEditIssueModal and ConnectionsSection have associated aria labels (verifiable via accessibility audit)
  5. Custom dropdowns use proper ARIA roles (listbox/option or equivalent)
**Plans**: 5 plans
Plans:
- [ ] 28-01-PLAN.md — Unit tests for 6 smaller Jira service modules (comments, transitions, versions, worklogs, links, projects)
- [ ] 28-02-PLAN.md — Unit tests for 6 larger Jira service modules (issues, sprints, epics, fields, backlog, client)
- [ ] 28-03-PLAN.md — Unit tests for 6 untested Zustand stores + PERF-02 memoized unread count
- [ ] 28-04-PLAN.md — Install @tanstack/react-virtual, virtualize BacklogPage, NotificationPopover, SprintBoardTab
- [ ] 28-05-PLAN.md — ARIA labels for form inputs + listbox/option roles for custom dropdowns

### Phase 29: Developer Tools
**Goal**: Developers have a unified hidden tools page for API debugging, operation profiling, and performance analysis
**Depends on**: Phase 25 (needs working codebase; independent of refactoring)
**Requirements**: DEVT-01, DEVT-02, DEVT-03, DEVT-04, DEVT-05
**Success Criteria** (what must be TRUE):
  1. A Developer Tools page exists combining debug logs and API profiler in a single cohesive layout
  2. Operations group multiple API fetches into logical units showing total time, fetch count, and per-fetch breakdown
  3. A settings panel offers independent toggles for request logging, response body capture, operation profiling, performance waterfall, and retention limit
  4. Developer Tools is not visible in Settings navigation — accessible only via Cmd+Shift+D or command palette
  5. A performance waterfall visualization shows operation timeline with fetch duration bars
**Plans**: 3 plans
Plans:
- [ ] 29-01-PLAN.md — Settings store migration (v7->v8), operation profiler store, apiFetch granular toggles
- [ ] 29-02-PLAN.md — DevToolsPage UI: three tabs (Logs, Operations, Waterfall), settings panel, empty states
- [ ] 29-03-PLAN.md — apiFetch call site annotation (~60 sites), routing, shortcut, cleanup old debug-logs

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 6/6 | Complete | 2026-03-11 |
| 2. Developer Dashboard | v1.0 | 7/7 | Complete | 2026-03-11 |
| 3. Notifications Hub | v1.0 | 2/2 | Complete | 2026-03-12 |
| 4. PM Dashboard + Search | v1.0 | 5/5 | Complete | 2026-03-12 |
| 5. API Foundation + Quick Wins | v1.1 | 8/8 | Complete | 2026-03-12 |
| 6. Workload + Sprint Progress Enrichment | v1.1 | 3/3 | Complete | 2026-03-12 |
| 7. Story/Subtask Hierarchy + MR Subtask Filter | v1.1 | 5/5 | Complete | 2026-03-13 |
| 8. Dashboard Enrichment | v1.1 | 8/8 | Complete | 2026-03-13 |
| 9. Custom Field Discovery + Issue Detail Foundation | v1.2 | 8/8 | Complete | 2026-03-14 |
| 10. Sprint Board Redesign | v1.2 | 4/4 | Complete | 2026-03-14 |
| 11. Create/Edit Issue Form | v1.2 | 5/5 | Complete | 2026-03-14 |
| 12. Backlog View | v1.2 | 4/4 | Complete | 2026-03-14 |
| 13. Epic Management | v1.2 | 5/5 | Complete | 2026-03-14 |
| 14. Fix v1.2 Wiring and Credential Bugs | v1.2 | 3/3 | Complete | 2026-03-15 |
| 15. Fix BOARD-04 statusId Bug | v1.2 | — | Complete | 2026-03-15 |
| 16. Write Missing Phase 10 + 11 VERIFICATION.md | v1.2 | — | Complete | 2026-03-15 |
| 17. Nyquist Validation — Phases 9–14 | v1.2 | — | Complete | 2026-03-15 |
| 18. App Icon + Multi-Page Settings | v1.3 | 6/6 | Complete | 2026-03-15 |
| 19. Keyboard Foundation | v1.3 | 6/6 | Complete | 2026-03-15 |
| 20. Command Palette + Recent Items | v1.3 | 6/6 | Complete | 2026-03-16 |
| 21. Header Redesign + Pinned Issue Tabs | v1.3 | 5/5 | Complete | 2026-03-16 |
| 22. Polish — Empty States + Error Recovery | v1.3 | 3/3 | Complete | 2026-03-16 |
| 23. Fix J/K Guard | v1.3 | — | Complete | 2026-03-19 |
| 24. Verify Phase 22 | v1.3 | 1/1 | Complete | 2026-03-19 |
| 25. Tooling & Dependencies | 2/2 | Complete    | 2026-03-19 | - |
| 26. Test Regression Fixes | 3/3 | Complete    | 2026-03-19 | - |
| 27. Refactoring & Type Safety | 5/5 | Complete    | 2026-03-19 | - |
| 28. Test Coverage, Performance & Accessibility | 5/5 | Complete    | 2026-03-20 | - |
| 29. Developer Tools | 5/5 | Complete   | 2026-03-20 | - |
