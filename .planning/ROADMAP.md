# Roadmap: Taskflow

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-03-12)
- 🚧 **v1.1 Polish** — Phases 5-8 (in progress)
- 📋 **v2.0** — Phases TBD (planned)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-03-12</summary>

- [x] Phase 1: Foundation (6/6 plans) — completed 2026-03-11
- [x] Phase 2: Developer Dashboard (7/7 plans) — completed 2026-03-11
- [x] Phase 3: Notifications Hub (2/2 plans) — completed 2026-03-12
- [x] Phase 4: PM Dashboard + Search (5/5 plans) — completed 2026-03-12

See archive: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Polish (In Progress)

**Milestone Goal:** Fix and enrich existing features — releases ordering/status, workload accuracy, sprint progress depth, dashboard usefulness, story/subtask hierarchy throughout, and MR Attention filtering.

- [x] **Phase 5: API Foundation + Quick Wins** - Extend Jira types and fetch strategy; fix GitLab open-only filter; ship Releases display improvements (completed 2026-03-12)
- [x] **Phase 6: Workload + Sprint Progress Enrichment** - Fix story points double-counting; add time tracking columns; enrich sprint progress with status breakdown and per-assignee table (completed 2026-03-12)
- [ ] **Phase 7: Story/Subtask Hierarchy + MR Subtask Filter** - Group subtasks under parent stories in My Tasks and Sprint Board; add MR Attention subtask-story filter
- [ ] **Phase 8: Dashboard Enrichment** - Add subtasks, MR health summary, sprint health, and recent notifications to the Developer dashboard

## Phase Details

### Phase 5: API Foundation + Quick Wins
**Goal**: The data layer serves parent/subtask/time-tracking fields to every consumer, open-only MRs are fetched from GitLab, and the Releases tab displays correctly sorted and badged releases
**Depends on**: Phase 4
**Requirements**: APIF-01, APIF-02, APIF-03, APIF-04, REL-01, REL-02, REL-03
**Success Criteria** (what must be TRUE):
  1. The Releases tab lists releases newest-to-oldest with a released/unreleased badge on every row
  2. Past-due unreleased releases show an overdue badge; future unreleased releases show a days-until countdown
  3. MR Attention and all MR lists show only open (not merged or closed) merge requests
  4. Sprint issues returned by the API include parent, subtasks, time tracking, and issuetype.subtask fields without any existing functionality breaking
**Plans**: 8 plans

Plans:
- [ ] 05-01-PLAN.md — Install shadcn Badge + fix searchGitLabMRs + write Wave 0 test stubs
- [x] 05-02-PLAN.md — Extend JiraIssue type + discoverStoryPointsField() + settings store
- [ ] 05-03-PLAN.md — fetchSprintIssues two-query subtask strategy
- [ ] 05-04-PLAN.md — Releases tab sort + Released/Unreleased/timing badges
- [ ] 05-05-PLAN.md — Fix sprint JQL: add issuetype not in subtaskIssueTypes() guard (gap closure)
- [ ] 05-06-PLAN.md — Fix releases wrong project: clear stale numeric project IDs on startup (gap closure)
- [ ] 05-07-PLAN.md — Fix subtask assignee filter: append assigneeClause to subtask JQL (gap closure)
- [ ] 05-08-PLAN.md — Fix fetchFixVersions endpoint + bare-array parse + auth store setState guard (gap closure)

### Phase 6: Workload + Sprint Progress Enrichment
**Goal**: Workload shows correct per-assignee story points (no double-counting) plus time tracking columns, and Sprint Progress shows a full breakdown by status, time totals, and per-assignee table
**Depends on**: Phase 5
**Requirements**: WORK-01, WORK-02, WORK-03, SPPG-01, SPPG-02, SPPG-03
**Success Criteria** (what must be TRUE):
  1. Workload story point totals match only parent stories — subtasks are not counted
  2. Workload shows original estimate, time spent, and remaining estimate columns per assignee
  3. Sprint Progress shows points broken down into To Do / In Progress / Done buckets with counts and percentages
  4. Sprint Progress shows sprint-wide time totals (total estimated vs total logged) and a per-assignee breakdown table
**Plans**: 3 plans

Plans:
- [ ] 06-01-PLAN.md — WorkloadTab rewrite: subtask exclusion, time tracking columns, expandable per-story rows
- [ ] 06-02-PLAN.md — SprintProgressTab rewrite: stacked bar, sprint time totals, per-assignee breakdown table
- [ ] 06-03-PLAN.md — Fix done-story exclusion: done stories appear as sub-rows, excluded from count/pts only (gap closure)

### Phase 7: Story/Subtask Hierarchy + MR Subtask Filter
**Goal**: My Tasks and Sprint Board group subtasks under their parent story, orphan subtasks show a parent context badge, and MR Attention includes MRs linked to stories where the current user has assigned subtasks
**Depends on**: Phase 5
**Requirements**: HIER-01, HIER-02, HIER-03, MRAT-01, MRAT-02
**Success Criteria** (what must be TRUE):
  1. My Tasks groups every assigned subtask under a collapsible parent story header
  2. Sprint Board renders subtask cards nested under their parent story card within each column, collapsible
  3. A subtask whose parent story is not in the current sprint displays a parent story name badge
  4. MR Attention shows only open MRs assigned to the current user or linked to stories where the current user has at least one assigned subtask
**Plans**: 3 plans

Plans:
- [ ] 07-01-PLAN.md — SprintBoardTab test scaffold (Wave 0) + MyTasksTab orphan suppression + onMutate fix
- [ ] 07-02-PLAN.md — TaskCard subtask chip/chevron + SprintBoardTab grouped hierarchy
- [ ] 07-03-PLAN.md — MrRow viaSubtaskKey + MrAttentionTab MRAT-02 subtask-linked MRs

### Phase 8: Dashboard Enrichment
**Goal**: The Developer dashboard surfaces the current user's open subtasks, open MR health summary, sprint health, and recent notifications without requiring any tab navigation
**Depends on**: Phase 7
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. Dashboard shows the current user's open subtasks from the active sprint
  2. Dashboard shows a MR health summary (needs review / approved / changes requested counts)
  3. Dashboard shows sprint health — days remaining, percentage of points done, and any at-risk in-progress items
  4. Dashboard shows the last 3 unread Jira and GitLab notifications inline
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7 → 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 6/6 | Complete | 2026-03-11 |
| 2. Developer Dashboard | v1.0 | 7/7 | Complete | 2026-03-11 |
| 3. Notifications Hub | v1.0 | 2/2 | Complete | 2026-03-12 |
| 4. PM Dashboard + Search | v1.0 | 5/5 | Complete | 2026-03-12 |
| 5. API Foundation + Quick Wins | 8/8 | Complete   | 2026-03-12 | 2026-03-12 |
| 6. Workload + Sprint Progress Enrichment | 3/3 | Complete   | 2026-03-12 | - |
| 7. Story/Subtask Hierarchy + MR Subtask Filter | v1.1 | 0/3 | Not started | - |
| 8. Dashboard Enrichment | v1.1 | 0/? | Not started | - |
