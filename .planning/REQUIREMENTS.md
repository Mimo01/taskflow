# Requirements: Taskflow

**Defined:** 2026-03-13
**Core Value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.

## v1.2 Requirements

Requirements for the Jira Parity milestone. Goal: replace the need to open real Jira for day-to-day work.

### Issue Detail (ISSUE)

- [x] **ISSUE-01**: User can open a full detail panel for any Jira issue (story, subtask, bug, epic) from any view in the app
- [x] **ISSUE-02**: User can read the full issue description rendered from Jira wiki markup as formatted text
- [x] **ISSUE-03**: User can view all issue metadata: priority, assignee, reporter, story points, status, epic link, sprint, labels, fix versions, dates
- [x] **ISSUE-04**: User can edit issue fields inline from the detail panel: assignee, priority, story points (optimistic update + rollback)
- [x] **ISSUE-05**: User can view all child subtasks with their status from the issue detail panel
- [x] **ISSUE-06**: User can view linked issues (relates to, blocks, is blocked by) from the issue detail panel
- [x] **ISSUE-07**: User can read the full comment thread for any issue from the detail panel
- [x] **ISSUE-08**: User can post a comment on any issue from the detail panel
- [x] **ISSUE-09**: User can open any issue directly in Jira via a deep link from the detail panel

### Sprint Board (BOARD)

- [x] **BOARD-01**: Sprint board shows subtasks as kanban cards grouped under collapsible parent story headers (Jira-like layout)
- [x] **BOARD-02**: Sprint board shows all team members' tasks (board-wide view, not filtered to current user only)
- [x] **BOARD-03**: User can drag subtask/story cards between status columns to transition status (optimistic update + rollback on failure)
- [x] **BOARD-04**: User can create a new story or subtask directly from the sprint board without leaving the board view
- [x] **BOARD-05**: User can open the issue detail panel from any sprint board card

### Backlog (BACK)

- [ ] **BACK-01**: User can view all backlog issues (issues not in any active or future sprint) in a paginated list
- [ ] **BACK-02**: User can move one or more backlog issues into the active sprint
- [ ] **BACK-03**: User can create a new story directly from the backlog view
- [ ] **BACK-04**: User can filter the backlog by epic, label, and assignee
- [ ] **BACK-05**: User can open the issue detail panel from any backlog row

### Epics (EPIC)

- [ ] **EPIC-01**: User can view a list of all epics with name, status, story count, and point totals
- [ ] **EPIC-02**: User can filter the sprint board and backlog by a selected epic
- [ ] **EPIC-03**: User can open an epic detail view showing all stories under that epic
- [ ] **EPIC-04**: User can create a new epic from within the app

### Create/Edit (CREATE)

- [x] **CREATE-01**: User can create a new Jira issue (story, subtask, bug) with: summary, description, assignee, story points, issue type, epic link, priority, and parent (for subtasks)
- [x] **CREATE-02**: User can set all required custom fields when creating or editing an issue — fields are discovered dynamically from the `createmeta` endpoint, not hardcoded (covers Account and any other required fields on the Orange instance)
- [x] **CREATE-03**: User can edit an existing issue's summary, description, assignee, story points, priority, and epic link
- [x] **CREATE-04**: User can add issue links to any issue (relates to, blocks, is blocked by) with link type selection from the discovered list

## v1.3+ Requirements

Deferred to future release. Tracked but not in current roadmap.

### Write Actions

- **WRITE-01**: User can create GitLab MR comments and approvals from the app
- **WRITE-02**: User can create a GitLab MR from within the app

### Advanced Jira

- **ADV-01**: User can upload attachments to Jira issues
- **ADV-02**: User can view issue changelog / history
- **ADV-03**: User can bulk edit multiple issues at once
- **ADV-04**: User can reorder backlog items by rank drag (requires Jira ranking plugin)

## Out of Scope

| Feature | Reason |
|---------|--------|
| ADF rich-text editor for write | DC v2 uses wiki markup strings — ADF editor adds 8–12 MB bundle, incompatible with ~10 MB portable build target |
| Drag-and-drop backlog rank reorder | Jira rank API unreliable on DC configurations without the ranking plugin |
| Issue history / changelog | Rarely read; available via Jira deep-link |
| Bulk issue edit | High API and UI complexity for low return on small teams |
| Real-time board updates (< 30s) | DC has no webhook push; 60s polling cadence is sufficient |
| Attachment upload | Requires multipart POST + file system access; excluded by PROJECT.md |
| OAuth / SSO login | Team uses PATs; OAuth adds server-side requirements conflicting with no-server architecture |
| Historical analytics / burndown | LinearB/Swarmia exist for this; no daily-use value |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ISSUE-01 | Phase 9 | Complete |
| ISSUE-02 | Phase 9 | Complete |
| ISSUE-03 | Phase 9 | Complete |
| ISSUE-04 | Phase 9 | Complete |
| ISSUE-05 | Phase 9 | Complete |
| ISSUE-06 | Phase 9 | Complete |
| ISSUE-07 | Phase 9 | Complete |
| ISSUE-08 | Phase 9 | Complete |
| ISSUE-09 | Phase 9 | Complete |
| BOARD-01 | Phase 10 | Complete |
| BOARD-02 | Phase 10 | Complete |
| BOARD-03 | Phase 10 | Complete |
| BOARD-04 | Phase 10 | Complete |
| BOARD-05 | Phase 10 | Complete |
| BACK-01 | Phase 12 | Pending |
| BACK-02 | Phase 12 | Pending |
| BACK-03 | Phase 12 | Pending |
| BACK-04 | Phase 12 | Pending |
| BACK-05 | Phase 12 | Pending |
| EPIC-01 | Phase 13 | Pending |
| EPIC-02 | Phase 13 | Pending |
| EPIC-03 | Phase 13 | Pending |
| EPIC-04 | Phase 13 | Pending |
| CREATE-01 | Phase 11 | Complete |
| CREATE-02 | Phase 11 | Complete |
| CREATE-03 | Phase 11 | Complete |
| CREATE-04 | Phase 11 | Complete |

**Coverage:**
- v1.2 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 after roadmap creation*
