---
gsd_state_version: 1.0
milestone: v1.12
milestone_name: Jira Experience Improvements
status: executing
stopped_at: Phase 77 context gathered
last_updated: "2026-06-03T10:24:16.806Z"
last_activity: "2026-06-03 - Completed quick task 260603-fb8: Let users select which Jira board (fix wrong rapidViewId)"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-02)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, notifications, and test execution health — in one place, without switching between Jira, GitLab, and AIO.
**Current focus:** Phase 76 — visual-polish-and-shared-primitives

## Current Position

Phase: 77
Plan: Not started
Status: Executing Phase 76
Last activity: 2026-06-03 - Completed quick task 260603-fb8: Let users select which Jira board (fix wrong rapidViewId)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity (v1.11 reference):**

- Plans completed: 22 (5 phases, 4 days, 284 commits)
- Average phase size: ~4.4 plans
- LOC delta: +48,340 / −16,981

**By Phase (v1.12 planned):**

| Phase | Requirements | Description |
|-------|-------------|-------------|
| 76 | VISUAL-01..05 | Done-state strikethrough + card color stripes + shared utils + rank service stub |
| 77 | PEEK-01..07, DETAIL-01..02 | Universal non-blocking peek slideover + issue-detail refinements |
| 78 | RANK-01..05 | Drag-to-rank on Backlog active-sprint list |
| 79 | TRAN-01..05 | Drag-to-transition on Sprint Board with per-transition drop zones |
| 80 | SUBTPL-01..08 | Subtask templates in Settings + bulk creation modal |

## Accumulated Context

### Decisions

Key decisions for v1.12 (drawn from research + PROJECT.md):

- Peek primitive: `IssueDetailSheet` with `modal={false}` on `Sheet` — resolve `aria-hidden` suppression at Phase 77 plan step before implementation
- `@dnd-kit` install in Phase 78 (removes Phase 67 absence guard test); reused by Phase 79 — single install for both drag features
- `rankCustomFieldId` read from `GhBacklogResponse` cache — never hardcoded; unit test asserts fixture value `10105`
- Flicker mitigation: `cancelQueries` in `onMutate` + `isDraggingRef`-gated local state as rendered source of truth during drag
- `hasScreen: true` transitions filtered from drop zone targets (remain accessible via StatusPopover)
- Bulk create: sequential `for` loop (not `Promise.all`); per-row status tracking; retry-failed-only on partial failure
- DETAIL-01/02 folded into Phase 77 — both require the `onIssuePeek` click model established in that phase
- Phase 80 independent of Phases 77-79; depends only on Phase 76 shared primitives

### Blockers/Concerns

- Phase 77: `Sheet modal={false}` vs CSS `position:fixed` — must verify `@base-ui/react Dialog modal={false}` suppresses `aria-hidden` on document root before writing plans
- Phase 79: `hasScreen` propagation through `__adaptToJiraTransition` — confirm before writing plans
- Apple Developer ID certificate not yet acquired — blocks macOS notarization (carried from v1.7)
- Windows code signing decision pending (carried from v1.7)

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260602-x58 | Standup Notes: collapse story status transitions to initial → final | 2026-06-02 | 19ccf8ed | | [260602-x58-on-standup-notes-page-when-presenting-st](./quick/260602-x58-on-standup-notes-page-when-presenting-st/) |
| 260603-fb8 | Let users select which Jira board (fix wrong rapidViewId/board id) | 2026-06-03 | e3f3b752 | Verified | [260603-fb8-select-jira-board](./quick/260603-fb8-select-jira-board/) |

## Deferred Items

| Category | Item | Status |
|----------|------|--------|
| code_review | WR-05 (70-REVIEW) | non-blocking — unguarded `as number\|null` SP cast in Today*Section.tsx |
| code_review | IN-01 (70-REVIEW) | benign — setCopied setTimeout not cleared on unmount in StandupNotesPage.tsx |

## Session Continuity

Last session: 2026-06-03T10:24:16.801Z
Stopped at: Phase 77 context gathered
Resume file: .planning/phases/77-universal-peek-slideover-and-issue-detail-refinements/77-CONTEXT.md
| 5 | Store full untruncated response bodies in devtools logs | 2026-06-03 | 99036280 | — |
