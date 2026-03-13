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

- [ ] **Phase 9: Custom Field Discovery + Issue Detail Foundation** - Full issue detail view accessible from any screen; custom field infrastructure powering all later phases
- [ ] **Phase 10: Sprint Board Redesign** - Subtask-as-card kanban with drag-to-move status transitions and full team visibility
- [ ] **Phase 11: Create/Edit Issue Form** - Create and edit any Jira issue with all required fields, dynamically built from createmeta
- [ ] **Phase 12: Backlog View** - Backlog list with move-to-sprint, create story, and epic/label/assignee filters
- [ ] **Phase 13: Epic Management** - Epic list, detail, cross-view filtering, and epic creation

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
**Plans**: TBD

### Phase 10: Sprint Board Redesign
**Goal**: The sprint board shows every team member's subtasks as first-class kanban cards grouped under their parent story, and developers can drag cards between columns to transition status without any context switching
**Depends on**: Phase 9
**Requirements**: BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-05
**Success Criteria** (what must be TRUE):
  1. The sprint board shows all team members' work (not just the current user's) with subtasks rendered as individual kanban cards grouped under collapsible parent story headers
  2. User can drag a subtask or story card from one status column to another and see the status update immediately, with the card snapping back if the transition fails
  3. User can click any board card to open the issue detail panel without leaving the board
  4. User can create a new story or subtask directly from the board without navigating away
**Plans**: TBD

### Phase 11: Create/Edit Issue Form
**Goal**: Users can create new Jira issues and edit existing ones with all required fields — including any instance-specific required custom fields — from a form that builds itself from the live Jira configuration
**Depends on**: Phase 9
**Requirements**: CREATE-01, CREATE-02, CREATE-03, CREATE-04
**Success Criteria** (what must be TRUE):
  1. User can create a new story, subtask, or bug with summary, description, assignee, story points, issue type, epic link, priority, and parent (for subtasks) all set from a single form
  2. All required custom fields on the Orange Jira instance (including the Account field) appear in the create form and are discovered dynamically — no hardcoded field IDs
  3. User can open an existing issue for editing and update its summary, description, assignee, story points, priority, and epic link
  4. User can add issue links (relates to, blocks, is blocked by) with link type selection from the Jira-discovered list
**Plans**: TBD

### Phase 12: Backlog View
**Goal**: Users can see all backlog issues in one place, move issues into the active sprint, create new stories, and filter the list — eliminating the need to open Jira for sprint grooming
**Depends on**: Phase 9, Phase 11
**Requirements**: BACK-01, BACK-02, BACK-03, BACK-04, BACK-05
**Success Criteria** (what must be TRUE):
  1. User can see all backlog issues (issues not in any active or future sprint, including those returned from completed sprints) in a paginated list
  2. User can select one or more backlog issues and move them into the active sprint in a single action
  3. User can create a new story directly from the backlog view and see it appear in the list
  4. User can filter the backlog by epic, label, and assignee and click any row to open the issue detail panel
**Plans**: TBD

### Phase 13: Epic Management
**Goal**: Users can view all epics, filter the sprint board and backlog by a selected epic, drill into an epic's stories, and create new epics — completing the daily Jira workflow without leaving the app
**Depends on**: Phase 9, Phase 11
**Requirements**: EPIC-01, EPIC-02, EPIC-03, EPIC-04
**Success Criteria** (what must be TRUE):
  1. User can see a list of all epics with name, status, story count, and total story points
  2. User can select an epic and have the sprint board and backlog filter to show only issues belonging to that epic
  3. User can open an epic detail view showing all stories under that epic
  4. User can create a new epic from within the app
**Plans**: TBD

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
| 9. Custom Field Discovery + Issue Detail Foundation | v1.2 | 0/TBD | Not started | - |
| 10. Sprint Board Redesign | v1.2 | 0/TBD | Not started | - |
| 11. Create/Edit Issue Form | v1.2 | 0/TBD | Not started | - |
| 12. Backlog View | v1.2 | 0/TBD | Not started | - |
| 13. Epic Management | v1.2 | 0/TBD | Not started | - |
