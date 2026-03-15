# Roadmap: Taskflow

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-03-12)
- ✅ **v1.1 Polish** — Phases 5-8 (shipped 2026-03-13)
- 🚧 **v1.2 Jira Parity** — Phases 9-13 (in progress)

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

### 🚧 v1.2 Jira Parity (In Progress)

**Milestone Goal:** Replace the need to open Jira — full issue detail, backlog management, epic tracking, and task creation/editing from within the app.

- [x] **Phase 9: Custom Field Discovery + Issue Detail Foundation** - Full issue detail view accessible from any screen; custom field infrastructure powering all later phases (human verification passed)
- [x] **Phase 10: Sprint Board Redesign** - Subtask-as-card kanban with drag-to-move status transitions and full team visibility (completed 2026-03-14)
- [x] **Phase 11: Create/Edit Issue Form** - Create and edit any Jira issue with all required fields, dynamically built from createmeta (completed 2026-03-14)
- [x] **Phase 12: Backlog View** - Backlog list with move-to-sprint, create story, and epic/label/assignee filters (completed 2026-03-14)
- [x] **Phase 13: Epic Management** - Epic list, detail, cross-view filtering, and epic creation (completed 2026-03-14)
- [x] **Phase 14: Fix v1.2 Wiring and Credential Bugs** - Wire BoardColumn/QuickCreateInput into SprintBoardTab, fix cache invalidation key, fix CreateEpicDialog credential store (completed 2026-03-15)
- [x] **Phase 15: Fix BOARD-04 statusId Bug** - Pass numeric Jira status ID to QuickCreateInput so new issues land in the clicked column (completed 2026-03-15)
- [x] **Phase 16: Write Missing Phase 10 + 11 VERIFICATION.md** - Create formal verification artifacts so CREATE-01..04 and BOARD-01..05 are fully accounted for across all three verification sources (completed 2026-03-15)
- [x] **Phase 17: Nyquist Validation — Phases 9–14** - Fill draft VALIDATION.md files to achieve Nyquist compliance across all v1.2 phases (completed 2026-03-15)

## Phase Details

### Phase 9: Custom Field Discovery + Issue Detail Foundation
**Goal**: Users can open a full issue detail view from any screen in the app, read the description and comments, edit key fields inline, and never need to open Jira just to check an issue
**Depends on**: Phase 8 (existing codebase)
**Requirements**: ISSUE-01, ISSUE-02, ISSUE-03, ISSUE-04, ISSUE-05, ISSUE-06, ISSUE-07, ISSUE-08, ISSUE-09
**Success Criteria** (what must be TRUE):
  1. User can click any issue from any view (sprint board, my tasks, search results, notifications) and see the full detail panel without leaving the current screen
  2. User can read the full description rendered as formatted text (not raw wiki markup) and scroll through the complete comment thread
  3. User can see all issue metadata in one place: priority, assignee, reporter, story points, status, epic link, sprint, labels, fix versions, dates, subtasks, and linked issues
  4. User can edit assignee, priority, and story points inline and see the update reflected immediately (with rollback if the API call fails)
  5. User can post a comment and open the issue in Jira via a deep link from the detail panel
**Plans**: 8 plans

Plans:
- [x] 09-01-PLAN.md — Install deps + shadcn Sheet + Wave 0 test scaffolds
- [x] 09-02-PLAN.md — discoverCustomFields(), fetchIssueDetail(), updateIssueField() + settings store + main.tsx
- [x] 09-03-PLAN.md — WikiRenderer (jira2md + react-markdown pipeline)
- [x] 09-04-PLAN.md — IssueDetailSheet shell + IssueDetailContent + IssueDetailSidebar (read-only)
- [x] 09-05-PLAN.md — Inline field editors with optimistic updates (assignee, priority, story points, labels)
- [x] 09-06-PLAN.md — Comment thread + CommentComposer + Open in Jira deep link
- [x] 09-07-PLAN.md — Wire sheet into SprintBoardTab + MyTasksTab (TaskCard onClick, TaskRow onIssueClick)
- [x] 09-08-PLAN.md — Wire sheet into search + notifications (Dashboard root) + human verification

### Phase 10: Sprint Board Redesign
**Goal**: The sprint board shows every team member's subtasks as first-class kanban cards grouped under their parent story, and developers can drag cards between columns to transition status without any context switching
**Depends on**: Phase 9
**Requirements**: BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-05
**Success Criteria** (what must be TRUE):
  1. The sprint board shows all team members' work (not just the current user's) with subtasks rendered as individual kanban cards grouped under collapsible parent story headers
  2. User can drag a subtask or story card from one status column to another and see the status update immediately, with the card snapping back if the transition fails
  3. User can click any board card to open the issue detail panel without leaving the board
  4. User can create a new story or subtask directly from the board without navigating away
**Plans**: 4 plans

Plans:
- [ ] 10-01-PLAN.md — Install @dnd-kit + fetchProjectStatuses/createIssue service functions + Wave 0 RED test stubs
- [ ] 10-02-PLAN.md — Rebuild board layout with workflow-API columns, grouped kanban, StoryHeaderRow + BoardColumn
- [ ] 10-03-PLAN.md — Drag-and-drop (DndContext + DraggableCard + useDroppable) + QuickCreateInput
- [ ] 10-04-PLAN.md — Human verification checkpoint (all five BOARD requirements)

### Phase 11: Create/Edit Issue Form
**Goal**: Users can create new Jira issues and edit existing ones with all required fields — including any instance-specific required custom fields — from a form that builds itself from the live Jira configuration
**Depends on**: Phase 9
**Requirements**: CREATE-01, CREATE-02, CREATE-03, CREATE-04
**Success Criteria** (what must be TRUE):
  1. User can create a new story, subtask, or bug with summary, description, assignee, story points, issue type, epic link, priority, and parent (for subtasks) all set from a single form
  2. All required custom fields on the Orange Jira instance (including the Account field) appear in the create form and are discovered dynamically — no hardcoded field IDs
  3. User can open an existing issue for editing and update its summary, description, assignee, story points, priority, and epic link
  4. User can add issue links (relates to, blocks, is blocked by) with link type selection from the Jira-discovered list
**Plans**: 5 plans

Plans:
- [ ] 11-01-PLAN.md — Wave 0 RED test stubs + jira.ts service extensions (createIssue, fetchCreatemeta, bulkUpdateIssue, fetchIssueLinkTypes, createIssueLink)
- [ ] 11-02-PLAN.md — CreateEditIssueModal core (Dialog, type switcher, dynamic createmeta fields, DescriptionEditor, create/edit mutations)
- [ ] 11-03-PLAN.md — IssueLinkRow + issue links wired into modal (link type discovery, search picker, post-create links)
- [ ] 11-04-PLAN.md — Wiring: AppLayout state lift + Sidebar Create Issue button + IssueDetailContent Edit + Add Subtask buttons
- [ ] 11-05-PLAN.md — Human verification checkpoint (all four CREATE requirements)

### Phase 12: Backlog View
**Goal**: Users can see all backlog issues in one place, move issues into the active sprint, create new stories, and filter the list — eliminating the need to open Jira for sprint grooming
**Depends on**: Phase 9, Phase 11
**Requirements**: BACK-01, BACK-02, BACK-03, BACK-04, BACK-05
**Success Criteria** (what must be TRUE):
  1. User can see all backlog issues (issues not in any active or future sprint, including those returned from completed sprints) in a paginated list
  2. User can select one or more backlog issues and move them into the active sprint in a single action
  3. User can create a new story directly from the backlog view and see it appear in the list
  4. User can filter the backlog by epic, label, and assignee and click any row to open the issue detail panel
**Plans**: 4 plans

Plans:
- [ ] 12-01-PLAN.md — Wave 0 RED test stubs + jira.ts service extensions (fetchBacklogIssues, addIssuesToSprint)
- [ ] 12-02-PLAN.md — BacklogPage + BacklogRow + BacklogFilterBar (list render, filters, row click)
- [ ] 12-03-PLAN.md — Move-to-sprint mutation + Create Story wiring + AppLayout Outlet context extension
- [ ] 12-04-PLAN.md — Route registration + Sidebar NavLinks + human verification checkpoint

### Phase 13: Epic Management
**Goal**: Users can view all epics, filter the sprint board and backlog by a selected epic, drill into an epic's stories, and create new epics — completing the daily Jira workflow without leaving the app
**Depends on**: Phase 9, Phase 11
**Requirements**: EPIC-01, EPIC-02, EPIC-03, EPIC-04
**Success Criteria** (what must be TRUE):
  1. User can see a list of all epics with name, status, story count, and total story points
  2. User can select an epic and have the sprint board and backlog filter to show only issues belonging to that epic
  3. User can open an epic detail view showing all stories under that epic
  4. User can create a new epic from within the app
**Plans**: 5 plans

Plans:
- [ ] 13-01-PLAN.md — jira.ts service functions (fetchEpicsWithEnrichment, fetchEpicStories) + Wave 0 RED test stubs
- [ ] 13-02-PLAN.md — EpicsPage route + Sidebar /epics NavLink + main.tsx route registration
- [ ] 13-03-PLAN.md — SprintBoardTab epic filter bar + CreateEpicDialog component
- [ ] 13-04-PLAN.md — EpicDetailSheet component + AppLayout wiring (state, mount, Outlet context)
- [ ] 13-05-PLAN.md — Full test suite gate + human verification checkpoint (all four EPIC requirements)

### Phase 14: Fix v1.2 Wiring and Credential Bugs
**Goal**: All three broken E2E flows are restored — inline issue creation is reachable from the sprint board, backlog refreshes after story creation, and epic creation succeeds with correct credentials
**Depends on**: Phase 10, Phase 12, Phase 13
**Requirements**: BOARD-04, BACK-03, EPIC-04
**Gap Closure:** Closes gaps from v1.2 audit
**Success Criteria** (what must be TRUE):
  1. SprintBoardTab renders BoardColumn and QuickCreateInput — user can create a story/subtask from the sprint board
  2. Creating a story from the backlog triggers cache invalidation with the correct key and the backlog list refreshes immediately
  3. Creating an epic via CreateEpicDialog succeeds — credentials come from useAuthStore, not useSettingsStore
**Plans**: 3 plans

Plans:
- [x] 14-01-PLAN.md — Import BoardColumn + QuickCreateInput into SprintBoardTab.tsx (BOARD-04)
- [x] 14-02-PLAN.md — Fix cache invalidation key in main.tsx (BACK-03)
- [x] 14-03-PLAN.md — Replace useSettingsStore with useAuthStore in CreateEpicDialog.tsx (EPIC-04)

### Phase 15: Fix BOARD-04 statusId Bug
**Goal**: New issues created from the sprint board land in the clicked column — QuickCreateInput receives a real numeric Jira status ID instead of the category key string so the transition lookup succeeds
**Depends on**: Phase 14
**Requirements**: BOARD-04
**Gap Closure:** Closes integration bug from v1.2 audit (col.key category string never matched tr.to.id numeric ID)
**Success Criteria** (what must be TRUE):
  1. SprintBoardTab passes the first numeric status ID in the clicked column's category (from workflowStatuses) to QuickCreateInput's statusId prop
  2. When a user creates an issue from a column, postTransition is called with a matching transition — issue lands in that column's status
  3. Regression test: creating from a column with mocked numeric status IDs verifies postTransition is called
**Plans**: 1 plan

Plans:
- [ ] 15-01-PLAN.md — Fix statusId prop in SprintBoardTab.tsx + regression test

### Phase 16: Write Missing Phase 10 + 11 VERIFICATION.md
**Goal**: CREATE-01..04 and BOARD-01..05 are fully accounted for across all three verification sources — VERIFICATION.md files created for both phases from existing human approval evidence
**Depends on**: Phase 15
**Requirements**: CREATE-01, CREATE-02, CREATE-03, CREATE-04, BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-05
**Gap Closure:** Closes CREATE-01..04 orphan status and BOARD verification gap from v1.2 audit
**Success Criteria** (what must be TRUE):
  1. `.planning/phases/10-sprint-board-redesign/10-VERIFICATION.md` exists and references all five BOARD requirements as SATISFIED
  2. `.planning/phases/11-create-edit-issue-form/11-VERIFICATION.md` exists and references all four CREATE requirements as SATISFIED
  3. Both files reference the human approval evidence from SUMMARY files
**Plans**: 1 plan

Plans:
- [ ] 16-01-PLAN.md — Write VERIFICATION.md for Phase 10 and Phase 11

### Phase 17: Nyquist Validation — Phases 9–14
**Goal**: All six v1.2 VALIDATION.md files reach nyquist_compliant: true — test coverage gaps filled so no requirement relies only on manual verification
**Depends on**: Phase 16
**Requirements**: ISSUE-01..09, BOARD-01..05, BACK-01..05, EPIC-01..04, CREATE-01..04
**Gap Closure:** Closes Nyquist compliance gap from v1.2 audit (all phases in draft state)
**Success Criteria** (what must be TRUE):
  1. Each phase VALIDATION.md has nyquist_compliant: true and wave_0_complete: true
  2. Each requirement has at least one automated test covering it
**Plans**: 6 plans

Plans:
- [ ] 17-01-PLAN.md — Validate Phase 9 (ISSUE-01..09)
- [ ] 17-02-PLAN.md — Validate Phase 10 (BOARD-01..05)
- [ ] 17-03-PLAN.md — Validate Phase 11 (CREATE-01..04)
- [ ] 17-04-PLAN.md — Validate Phase 12 (BACK-01..05)
- [ ] 17-05-PLAN.md — Validate Phase 13 (EPIC-01..04)
- [ ] 17-06-PLAN.md — Validate Phase 14 (BOARD-04, BACK-03, EPIC-04)

## Progress

**Execution Order:** 9 → 10 → 11 → 12 → 13

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
| 10. Sprint Board Redesign | 4/4 | Complete    | 2026-03-14 | - |
| 11. Create/Edit Issue Form | 4/5 | In Progress|  | - |
| 12. Backlog View | 4/4 | Complete    | 2026-03-14 | - |
| 13. Epic Management | 5/5 | Complete    | 2026-03-14 | - |
| 14. Fix v1.2 Wiring and Credential Bugs | v1.2 | Complete    | 2026-03-14 | 2026-03-15 |
