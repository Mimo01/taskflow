# Requirements: Taskflow — v1.11 GreenHopper API Migration

**Defined:** 2026-05-28
**Core Value:** Developers and PMs can see everything they need — tasks, merge requests, sprint state, notifications, and test execution health — in one place, without switching between Jira, GitLab, and AIO.

**Milestone goal:** Eliminate Jira API n+1 bottlenecks by migrating the app's Jira backbone to the on-prem GreenHopper API (`/rest/greenhopper/1.0/xboard/*`). Reference: `.planning/research/GREENHOPPER-API.md`.

## v1.11 Requirements

### Adapter Layer

- [x] **GH-ADAPT-01**: GreenHopper API client module created under `services/jira/greenhopper/` with typed responses for `allData`, `data`, `details`, and `transitions`
- [x] **GH-ADAPT-02**: Entity-map resolver helpers (statusId → Status, priorityId → Priority, typeId → Type, epicId → Epic) so existing UI components can keep consuming the existing UI `Issue` / `Status` / `Epic` types
- [x] **GH-ADAPT-03**: Issue adapter mapping GreenHopper `Issue` shape (numeric IDs, `estimateStatistic.statFieldValue.value`, `parentId`/`epicId` resolved via lookup maps) onto the existing app `Issue` type used by board/backlog UI

### Sprint Board (`allData.json`)

- [ ] **GH-BOARD-01**: Sprint board fetches all issues, columns, swimlanes, statuses, priorities, types, and epics in a single `allData.json` call (replaces today's multi-call sprint-board fetch + per-issue enrichments)
- [ ] **GH-BOARD-02**: Per-issue `timeInColumn.enteredStatus` is surfaced on the card (or made available to the existing "time in status" UI if present)
- [ ] **GH-BOARD-03**: Sprint board renders columns from GreenHopper `columnsData` (not hardcoded status buckets) and groups by `parentId` for the subtask-under-story hierarchy
- [ ] **GH-BOARD-04**: Existing sprint-board features (drag-to-transition with optimistic rollback, QuickCreateInput per column, epic / quick-filter / label filters, sprint goal banner) work unchanged on the new data source

### Backlog (`data.json`)

- [x] **GH-BACKLOG-01**: Backlog view fetches the flat issue list via a single `data.json` call (replaces paginated REST + per-issue lookups)
- [x] **GH-BACKLOG-02**: Existing backlog features (move-to-sprint, create story, filter by epic/label/assignee, virtualized rendering) work unchanged on the new data source

### Issue Detail (Progressive Rendering)

- [x] **PERF-DETAIL-01**: Issue detail panel renders the header (title, key, status, assignee) as soon as the base issue fetch resolves, independently of comments / attachments / subtasks / description-heavy sections
- [x] **PERF-DETAIL-02**: Each detail section (description, custom fields, comments, attachments, subtasks, issue links) loads via its own independent request and shows a localized skeleton while pending; no global blocking spinner gates the panel
- [x] **PERF-DETAIL-03**: Existing detail-panel features (edit fields, post comment, open-in-Jira deep link, pin, clone, watcher toggle) work unchanged on the existing REST v2 paths — the detail panel stays on Jira REST (no GreenHopper `details.json` migration)

### Workflow Transitions (`transitions.json`)

- [x] **GH-TRANS-01**: `transitions.json` is fetched once per project and cached; lookup is keyed by `projectId × issueTypeId → workflow → transitions[]`
- [x] **GH-TRANS-02**: Sprint-board drag-to-transition and issue-detail status change read available transitions from the cached map (no per-issue REST `/transitions` call)
- [x] **GH-TRANS-03**: Cache is invalidated on project/workflow change (re-fetch on session start; manual refresh action available)

### Cutover & Verification

- [x] **GH-CUT-01**: Hard cutover per surface — each GreenHopper migration phase replaces its REST path in place. No coexistence flag; old REST paths for board / backlog / transitions are deleted as their replacements ship. (Issue detail stays on REST v2 — not migrated this milestone.)
- [x] **GH-CUT-02**: Performance verification — capture before/after request counts and end-to-end time for sprint-board open and backlog open; for issue-detail open, capture before/after time-to-first-meaningful-paint and time-to-fully-interactive plus per-section latencies. Recorded in the verification artifact of the final phase.

## v2 Requirements

_None deferred from this milestone._

## Out of Scope

| Feature | Reason |
|---------|--------|
| Migrating Jira write actions (status transitions POST, comment post/edit, inline field edit, attachment upload, worklog CRUD, createmeta) | GreenHopper provides reads; writes stay on existing REST v2 services in `services/jira/*` and `jira.ts` |
| Migrating global search / JQL search | Not covered by the four GreenHopper endpoints in scope |
| Coexistence feature flag / staged rollout | User chose hard cutover per surface — REST removed in place |
| Unifying `jira.ts` (60 imports) and modular `services/jira/` split | Pre-existing tech debt; out of scope unless directly blocking a migration phase |
| Multi-board switching UI | Board ID is supplied by existing settings; the migration uses the same board selection |

## Traceability

Filled by roadmap (Section 10 of new-milestone workflow).

| Requirement | Phase | Status |
|-------------|-------|--------|
| GH-ADAPT-01 | Phase 71 | Complete |
| GH-ADAPT-02 | Phase 71 | Complete |
| GH-ADAPT-03 | Phase 71 | Complete |
| GH-TRANS-01 | Phase 72 | Complete |
| GH-TRANS-02 | Phase 72 | Complete |
| GH-TRANS-03 | Phase 72 | Complete |
| GH-BOARD-01 | Phase 73 | Pending |
| GH-BOARD-02 | Phase 73 | Pending |
| GH-BOARD-03 | Phase 73 | Pending |
| GH-BOARD-04 | Phase 73 | Pending |
| GH-BACKLOG-01 | Phase 74 | Complete |
| GH-BACKLOG-02 | Phase 74 | Complete |
| PERF-DETAIL-01 | Phase 75 | Complete |
| PERF-DETAIL-02 | Phase 75 | Complete |
| PERF-DETAIL-03 | Phase 75 | Complete |
| GH-CUT-01 | Phase 75 | Complete |
| GH-CUT-02 | Phase 75 | Complete |

**Coverage:**

- v1.11 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-28*
*Last updated: 2026-05-30 — Phase 75 rescoped from GreenHopper `details.json` migration to progressive REST rendering (GH-DETAIL-01..04 dropped, PERF-DETAIL-01..03 added)*
