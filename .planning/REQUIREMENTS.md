# Requirements: Taskflow — v1.12 Jira Experience Improvements

**Defined:** 2026-06-02
**Core Value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, notifications, and test execution health — in one place, without switching between Jira, GitLab, and AIO.

## v1.12 Requirements

Requirements for the v1.12 milestone. Each maps to a roadmap phase.

### Visual Consistency (done-state + card colors)

- [x] **VISUAL-01**: Done current-sprint stories appear struck-through on the Backlog active-sprint list (matching the kanban board)
- [x] **VISUAL-02**: Done current-sprint items appear struck-through in the Standup Notes Today section
- [x] **VISUAL-03**: Any per-story/issue list the Dashboard renders for the current sprint shows done items struck-through (treated as satisfied where the card is aggregate-only with no per-story rows)
- [x] **VISUAL-04**: Sprint board cards show a left-edge color stripe driven by issue priority
- [x] **VISUAL-05**: The card color stripe is legible in both light and dark themes (WCAG ≥ 3:1 against the card surface)

### Backlog Drag-to-Rank

- [x] **RANK-01**: The Backlog active-sprint list is ordered by Jira rank
- [x] **RANK-02**: User can drag a story within the Backlog active-sprint list to reorder it
- [x] **RANK-03**: A reorder persists to Jira via the rank API (`PUT /rest/agile/1.0/issue/rank`, `rankCustomFieldId` from the backlog response)
- [x] **RANK-04**: A failed rank update rolls back the optimistic reorder and surfaces an error
- [x] **RANK-05**: Drag reordering does not flicker or revert when the background poll refreshes (optimistic order held during drag)

### Sprint Board Drag-to-Transition

- [ ] **TRAN-01**: User can drag a card between sprint board columns to change its status
- [ ] **TRAN-02**: When a target column maps to multiple workflow statuses, the column splits into per-transition drop zones during the drag
- [ ] **TRAN-03**: Transitions blocked by a required screen or validators are not offered as silent drop targets (excluded or clearly indicated, no silent snap-back)
- [ ] **TRAN-04**: A failed transition rolls back the optimistic move and surfaces an error
- [ ] **TRAN-05**: A successful drag-transition refreshes the board (invalidates GreenHopper board data)

### Universal Issue Peek (slideover)

- [x] **PEEK-01**: Clicking an issue anywhere in the app (board, backlog, standup, dashboard, search, notifications) — except on its issue key — opens a slideover preview of that issue
- [x] **PEEK-02**: The peek slideover works for any issue type (story, subtask, bug, epic, task)
- [x] **PEEK-03**: The underlying view stays fully interactive while the peek is open (non-blocking — no focus trap, no backdrop that swallows clicks)
- [x] **PEEK-04**: Clicking a different issue in the underlying view swaps the previewed issue without closing the peek
- [x] **PEEK-05**: Clicking an issue's key opens the full-page issue detail (not the peek)
- [x] **PEEK-06**: The peek provides an explicit "open full page" affordance
- [x] **PEEK-07**: The peek can be dismissed via Escape and an explicit close control

### Issue-Detail Refinements

- [x] **DETAIL-01**: On a subtask's issue detail, the parent is shown in the main content area (not the right sidebar), consistent with how subtasks render under a story
- [x] **DETAIL-02**: Clickable areas in issue detail (parent, subtasks, linked issues) show a pointer cursor on hover

### Subtask Templates & Bulk Creation

- [ ] **SUBTPL-01**: User can create, edit, and delete named subtask templates in Settings
- [ ] **SUBTPL-02**: Subtask templates persist across sessions (Tauri Store, mirroring the Tempo-filters store pattern)
- [ ] **SUBTPL-03**: Each template line requires a title; optional fields are resolved from the subtask issue type's createmeta (description, assignee, priority, labels, original estimate, story points, due date, components, custom fields)
- [ ] **SUBTPL-04**: From a parent issue, user can apply a template (or build an ad-hoc list) to create multiple subtasks at once
- [ ] **SUBTPL-05**: User can preview and inline-edit the resolved subtask list before creating
- [ ] **SUBTPL-06**: Creating spawns all subtasks under the parent in listed order
- [ ] **SUBTPL-07**: A partial failure mid-batch is surfaced per-subtask, and retry skips already-created subtasks
- [ ] **SUBTPL-08**: Parent-inheritance placeholders (`@inherit`, `@current`, `@unassigned`) resolve at creation time

## Future Requirements

Deferred to a later milestone. Tracked but not in this roadmap.

### Sprint Board

- **SBOARD-01**: Configurable swimlane group-by switcher (by epic / assignee / story) on the sprint board
- **SBOARD-02**: Card color stripe driven by issue type (in addition to priority) with a user-selectable color dimension

## Out of Scope

Explicitly excluded for v1.12. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Flags / impediments | Already fully built (`customfield_10021` integration: card highlight, icon, context-menu toggle, backlog, settings field) |
| Swimlane parent-story grouping | Already exists (fixed subtasks-under-story grouping on the board) |
| Rapid sequential inline subtask entry | Superseded by subtask templates (SUBTPL-*) |
| Drag-to-rank on the sprint board | User scoped rank to the Backlog list; the board is transition-only |
| Bulk-create REST endpoint | Jira DC has no batch-create; bulk creation loops `createIssue` in order |
| `pragmatic-drag-and-drop` library | Uses HTML5 DnD API which requires disabling Tauri `dragDropEnabled`, breaking existing attachment drag-drop upload — `@dnd-kit` (Pointer Events) chosen instead |
| Multi-select drag in backlog | Not requested; single-item drag sufficient for v1.12 |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VISUAL-01 | Phase 76 | Complete |
| VISUAL-02 | Phase 76 | Complete |
| VISUAL-03 | Phase 76 | Complete |
| VISUAL-04 | Phase 76 | Complete |
| VISUAL-05 | Phase 76 | Complete |
| RANK-01 | Phase 78 | Complete |
| RANK-02 | Phase 78 | Complete |
| RANK-03 | Phase 78 | Complete |
| RANK-04 | Phase 78 | Complete |
| RANK-05 | Phase 78 | Complete |
| TRAN-01 | Phase 79 | Pending |
| TRAN-02 | Phase 79 | Pending |
| TRAN-03 | Phase 79 | Pending |
| TRAN-04 | Phase 79 | Pending |
| TRAN-05 | Phase 79 | Pending |
| PEEK-01 | Phase 77 | Complete |
| PEEK-02 | Phase 77 | Complete |
| PEEK-03 | Phase 77 | Complete |
| PEEK-04 | Phase 77 | Complete |
| PEEK-05 | Phase 77 | Complete |
| PEEK-06 | Phase 77 | Complete |
| PEEK-07 | Phase 77 | Complete |
| DETAIL-01 | Phase 77 | Complete |
| DETAIL-02 | Phase 77 | Complete |
| SUBTPL-01 | Phase 80 | Pending |
| SUBTPL-02 | Phase 80 | Pending |
| SUBTPL-03 | Phase 80 | Pending |
| SUBTPL-04 | Phase 80 | Pending |
| SUBTPL-05 | Phase 80 | Pending |
| SUBTPL-06 | Phase 80 | Pending |
| SUBTPL-07 | Phase 80 | Pending |
| SUBTPL-08 | Phase 80 | Pending |

**Coverage:**

- v1.12 requirements: 32 total
- Mapped to phases: 32 (100%)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-02*
*Last updated: 2026-06-02 — traceability filled in after roadmap creation*
