# Requirements: Taskflow

**Defined:** 2026-03-12
**Core Value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.

## v1.1 Requirements

Requirements for v1.1 Polish milestone. Each maps to roadmap phases.

### API Foundation

- [ ] **APIF-01**: Jira `JiraIssue` type extended with `parent?`, `subtasks[]`, `timetracking?`, `issuetype.subtask` boolean
- [ ] **APIF-02**: `fetchSprintIssues` uses two-query strategy to include subtasks (second query: `issuetype in subtaskIssueTypes() AND parent in (...)`)
- [ ] **APIF-03**: Story points field ID discovered via `discoverStoryPointsField()` with fallback to `customfield_10016`
- [ ] **APIF-04**: GitLab MR fetch calls filter to `state=opened` only

### Releases

- [ ] **REL-01**: User can see releases ordered newest to oldest by release date
- [ ] **REL-02**: User can see released/unreleased status badge on each release
- [ ] **REL-03**: User can see overdue badge on past-date unreleased releases and days-until countdown on future unreleased releases

### Workload

- [ ] **WORK-01**: User sees correct story points per assignee (subtasks excluded from point totals)
- [ ] **WORK-02**: User sees original estimate, time spent, and remaining estimate columns per assignee
- [ ] **WORK-03**: User sees time tracking aggregated at story level under each assignee

### Sprint Progress

- [ ] **SPPG-01**: User sees story points broken down by status bucket (To Do / In Progress / Done with counts and %)
- [ ] **SPPG-02**: User sees sprint-wide time totals (total estimate vs total time logged)
- [ ] **SPPG-03**: User sees per-assignee breakdown table with point counts and time tracking

### Story/Subtask Hierarchy

- [ ] **HIER-01**: My Tasks groups all assigned subtasks under their parent story header
- [ ] **HIER-02**: Sprint Board groups subtask cards under parent story card in each column (collapsible)
- [ ] **HIER-03**: Subtasks whose parent story is not in the current sprint display a parent story badge

### MR Attention

- [ ] **MRAT-01**: MR Attention shows only open (`state=opened`) merge requests
- [ ] **MRAT-02**: MR Attention includes MRs linked to stories where current user has at least one assigned subtask

### Dashboard

- [ ] **DASH-01**: Dashboard shows current user's open subtasks from the current sprint
- [ ] **DASH-02**: Dashboard shows current user's open MR health summary (needs review / approved / changes requested)
- [ ] **DASH-03**: Dashboard shows sprint health (days left, % points done, at-risk in-progress items)
- [ ] **DASH-04**: Dashboard shows last 3 unread Jira/GitLab notifications inline

## Future Requirements

*(None defined — all v1.1 items are scoped above)*

## Out of Scope

| Feature | Reason |
|---------|--------|
| Drag-and-drop subtask reordering | Requires Jira rank API; no demand yet |
| Burndown charts | No historical data store; out of scope since v1.0 |
| Configurable MR filter rules | Hardcoded rules sufficient for v1.1 |
| Workload overload threshold config | Nice-to-have, defer to later milestone |
| Virtualised list for large sprints | Only needed for 200+ issues; unlikely at current team size |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| APIF-01 | — | Pending |
| APIF-02 | — | Pending |
| APIF-03 | — | Pending |
| APIF-04 | — | Pending |
| REL-01 | — | Pending |
| REL-02 | — | Pending |
| REL-03 | — | Pending |
| WORK-01 | — | Pending |
| WORK-02 | — | Pending |
| WORK-03 | — | Pending |
| SPPG-01 | — | Pending |
| SPPG-02 | — | Pending |
| SPPG-03 | — | Pending |
| HIER-01 | — | Pending |
| HIER-02 | — | Pending |
| HIER-03 | — | Pending |
| MRAT-01 | — | Pending |
| MRAT-02 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |
| DASH-04 | — | Pending |

**Coverage:**
- v1.1 requirements: 22 total
- Mapped to phases: 0
- Unmapped: 22 ⚠️

---
*Requirements defined: 2026-03-12*
*Last updated: 2026-03-12 after initial definition*
