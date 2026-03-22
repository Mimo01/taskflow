# Requirements: Taskflow

**Defined:** 2026-03-22
**Core Value:** Developers and PMs can see everything they need — tasks, merge requests, sprint state, and notifications — in one place, without switching between Jira and GitLab.

## v1.5 Requirements

Requirements for milestone v1.5: Dashboard Redesign & Feature Parity.

### Issue Detail

- [x] **DETAIL-01**: User can view unified activity timeline on issue detail (changelog + comments + worklogs merged chronologically)
- [x] **DETAIL-02**: User can filter activity timeline by type (field changes / comments / worklogs)
- [x] **DETAIL-03**: User can edit own comments on issues
- [x] **DETAIL-04**: User can delete own comments on issues
- [x] **DETAIL-05**: User can watch/unwatch issues with eye icon toggle and watcher count
- [ ] **DETAIL-06**: User can view issue attachments inline (image thumbnails, file list)
- [x] **DETAIL-07**: User can download issue attachments
- [x] **DETAIL-08**: User can upload file attachments to issues
- [ ] **DETAIL-09**: User can @mention team members in comments with autocomplete popover
- [x] **DETAIL-10**: User sees overdue badge on issues where due date has passed
- [x] **DETAIL-11**: User can clone an issue (copies summary, description, labels, priority, assignee)

### Time Tracking

- [x] **TIME-01**: User can log time spent on an issue with natural language input ("2h 30m")
- [x] **TIME-02**: User can view worklogs on issue detail (author, time spent, date, comment)
- [x] **TIME-03**: User can edit own worklog entries
- [x] **TIME-04**: User can delete own worklog entries
- [ ] **TIME-05**: User sees time tracking summary on issue detail (estimated, spent, remaining)

### Board & Sprint

- [ ] **BOARD-01**: User sees sprint goal banner on sprint board header
- [ ] **BOARD-02**: User can toggle board quick filters fetched from Jira board config
- [ ] **BOARD-03**: User can filter sprint board by label via quick filter chips
- [ ] **BOARD-04**: User can select multiple issues and bulk-change status
- [ ] **BOARD-05**: User can select multiple issues and bulk-change assignee
- [ ] **BOARD-06**: User can select multiple issues and bulk-change priority
- [ ] **BOARD-07**: User sees progress indicator during bulk operations with success/failure counts

### Filters

- [ ] **FILT-01**: User can save current search as a named filter (synced to Jira server)
- [ ] **FILT-02**: User can view and execute saved/favourite filters from Jira
- [ ] **FILT-03**: User can edit and delete saved filters
- [ ] **FILT-04**: User can access saved filters from sidebar and command palette

### Layout

- [ ] **LAYOUT-01**: User can choose which sidebar items are visible
- [ ] **LAYOUT-02**: User can reorder sidebar items via drag-and-drop
- [ ] **LAYOUT-03**: User can apply Dev or PM preset to restore default sidebar configuration
- [ ] **LAYOUT-04**: User can add/remove/resize dashboard widgets in a grid layout
- [ ] **LAYOUT-05**: User can drag dashboard widgets to rearrange layout
- [ ] **LAYOUT-06**: Dashboard layout persists across app restarts
- [ ] **LAYOUT-07**: User can reset dashboard to Dev or PM preset layout

## Future Requirements

### GitLab Enhancements

- **GLAB-01**: User can see GitLab MR comments on issue activity timeline
- **GLAB-02**: User can see GitLab pipeline status on issue timeline
- **GLAB-03**: User can approve/comment on MRs from Taskflow

### Advanced Filters

- **AFILT-01**: Full JQL editor with syntax highlighting and field autocomplete

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full JQL editor with syntax highlighting | Months of work; plain text JQL input sufficient for v1.5 |
| Attachment inline editing/annotation | Image editing is separate domain; open in OS default app instead |
| Real-time collaboration on comments | Requires WebSocket infrastructure; Jira DC has no real-time API |
| Custom workflow builder | Jira workflows are admin-configured server-side; client overrides cause confusion |
| Bulk file upload (drag folder) | Jira API is single-file; sequential upload with progress is safer |
| Burndown / velocity charts | No historical data from Jira DC REST API; LinearB/Swarmia exist for this |
| Comment reactions/emojis | Not available in Jira DC REST API v2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DETAIL-01 | Phase 31 | Complete |
| DETAIL-02 | Phase 31 | Complete |
| DETAIL-03 | Phase 31 | Complete |
| DETAIL-04 | Phase 31 | Complete |
| DETAIL-05 | Phase 31 | Complete |
| DETAIL-06 | Phase 32 | Pending |
| DETAIL-07 | Phase 32 | Complete |
| DETAIL-08 | Phase 32 | Complete |
| DETAIL-09 | Phase 32 | Pending |
| DETAIL-10 | Phase 31 | Complete |
| DETAIL-11 | Phase 31 | Complete |
| TIME-01 | Phase 32 | Complete |
| TIME-02 | Phase 32 | Complete |
| TIME-03 | Phase 32 | Complete |
| TIME-04 | Phase 32 | Complete |
| TIME-05 | Phase 32 | Pending |
| BOARD-01 | Phase 33 | Pending |
| BOARD-02 | Phase 33 | Pending |
| BOARD-03 | Phase 33 | Pending |
| BOARD-04 | Phase 33 | Pending |
| BOARD-05 | Phase 33 | Pending |
| BOARD-06 | Phase 33 | Pending |
| BOARD-07 | Phase 33 | Pending |
| FILT-01 | Phase 33 | Pending |
| FILT-02 | Phase 33 | Pending |
| FILT-03 | Phase 33 | Pending |
| FILT-04 | Phase 33 | Pending |
| LAYOUT-01 | Phase 34 | Pending |
| LAYOUT-02 | Phase 34 | Pending |
| LAYOUT-03 | Phase 34 | Pending |
| LAYOUT-04 | Phase 34 | Pending |
| LAYOUT-05 | Phase 34 | Pending |
| LAYOUT-06 | Phase 34 | Pending |
| LAYOUT-07 | Phase 34 | Pending |

**Coverage:**
- v1.5 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after roadmap creation*
