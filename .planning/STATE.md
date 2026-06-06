---
gsd_state_version: 1.0
milestone: v1.12
milestone_name: Jira Experience Improvements
status: executing
stopped_at: Phase 80 UI-SPEC approved
last_updated: "2026-06-05T10:24:18.142Z"
last_activity: 2026-06-05
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 19
  completed_plans: 19
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-02)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, notifications, and test execution health — in one place, without switching between Jira, GitLab, and AIO.
**Current focus:** Phase 80 — subtask-templates-and-bulk-creation

## Current Position

Phase: 80
Plan: Not started
Status: Executing Phase 80
Last activity: 2026-06-06 - Completed quick task 260606-oyy: sprint board priority shown as Jira icon (card footer + swimlane header) instead of left border; card left border now encodes issue type via issueTypeStripeClass(); new PriorityIcon component (verified, npm run check GREEN, 40/40 tests)

Progress: [██████████] 100%

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
| Phase 77 P01 | 15 | 2 tasks | 4 files |
| Phase 77 P03 | 45min | 4 tasks | 7 files |
| Phase 77 P04 | 30min | 4 tasks | 8 files |
| Phase 78-drag-to-rank-on-backlog P01 | 8min | 3 tasks | 6 files |
| Phase 78-drag-to-rank-on-backlog P02 | 3min | 2 tasks | 2 files |
| Phase 78-drag-to-rank-on-backlog P03 | 3min | 1 tasks | 2 files |

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
- [Phase ?]: peekPanelWidth defaults to null (not 480) in initialSettings — mirrors issueDetailPanelWidth; PeekPanel applies ?? 480 at read time (Plan 03)
- [Phase ?]: A1 confirmed — JiraIssueDetail.fields.parent present at types.ts:152, no type change needed
- [Phase ?]: CommandPalette body-select routes to peek (onOpenIssue); key-element navigate split delivered in Plan 04 Task 3
- [Phase ?]: NotificationPopover body row routes to peek; NotificationRow key split delivered in Plan 04 Task 3
- [Phase ?]: min-h-0 required on flex-row squeeze wrapper (A5) for height containment in Safari
- [Phase ?]: [Phase 77-04]: D-10 key/body split applied universally — div role=button body→onOpenIssue, inner key button→stopPropagation→navigate; Pitfall 1 avoided by outer-button-to-div conversion
- [Phase ?]: CR-01: cross-bucket midpoint stays in lower bucket, extends before value with midChar 'i'
- [Phase ?]: CR-02: digit-by-digit BigInt parseBase36 replaces BigInt(parseInt) to avoid float64 precision loss
- [Phase 78-04]: SortableContext per-section (sprint-<id>/backlog id), localOrder Map flicker gate, DragOverlay isOverlay, justDragged 50ms guard
- [Phase 78-04]: rankMutation onMutate calls cancelQueries(['gh-backlog',boardId]) + snapshots cache; onError restores snapshot + localOrder; onSettled invalidates

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
| 260604-knq | Backlog drag-to-rank: drop DragOverlay, drag row in place (keep autoScroll synced) | 2026-06-04 | 2a2a4c30 | | [260604-knq-phase-78-backlog-drag-to-rank-keep-dnd-k](./quick/260604-knq-phase-78-backlog-drag-to-rank-keep-dnd-k/) |
| 260605-hb4 | Notifications & dashboard issue clicks open the full page (not the peek sidebar) | 2026-06-05 | 2cc4a751 | Verified | [260605-hb4-currently-all-clicks-on-issues-except-ke](./quick/260605-hb4-currently-all-clicks-on-issues-except-ke/) |
| 260605-hx2 | Resolution control set via workflow transition — sidebar + StatusPopover + board drag & right-click picker (reworked from rejected field-PUT) | 2026-06-06 | f604bb13 | Verified (live UAT approved on ESHOP-20308) | [260605-hx2-add-resolution-field-control-to-issue-de](./quick/260605-hx2-add-resolution-field-control-to-issue-de/) |
| 260606-o5y | Sprint board: story swimlane rows open the issue peek preview like cards (PEEK-01 body→peek, PEEK-05 key→full-page); all 3 sites wired; WR-01 keyboard double-fire guard added to row + card | 2026-06-06 | b96862cc | Approved & closed | [260606-o5y-on-sprint-board-story-rows-open-issue-pr](./quick/260606-o5y-on-sprint-board-story-rows-open-issue-pr/) |
| 260606-oqf | Issue peek panel: add elevation so it stops blending in — leftward shadow + ring-1 ring-foreground/10 (matches sheet/popover/dialog conventions, theme-aware light+dark) | 2026-06-06 | a33b9b5b | Approved & closed | [260606-oqf-on-issue-peek-panel-add-more-distinction](./quick/260606-oqf-on-issue-peek-panel-add-more-distinction/) |
| 260606-oyy | Sprint board: priority now shown as Jira iconUrl icon (card footer + swimlane header) instead of left border; card left border repurposed to issue-type color via new issueTypeStripeClass(); new PriorityIcon component; a11y alt text | 2026-06-06 | 976a0e8e | Verified | [260606-oyy-on-sprint-board-i-want-to-change-how-pri](./quick/260606-oyy-on-sprint-board-i-want-to-change-how-pri/) |

## Deferred Items

| Category | Item | Status |
|----------|------|--------|
| code_review | WR-05 (70-REVIEW) | non-blocking — unguarded `as number\|null` SP cast in Today*Section.tsx |
| code_review | IN-01 (70-REVIEW) | benign — setCopied setTimeout not cleared on unmount in StandupNotesPage.tsx |

## Session Continuity

Last session: 2026-06-05T08:37:17.891Z
Stopped at: Phase 80 UI-SPEC approved
Resume file: .planning/phases/80-subtask-templates-and-bulk-creation/80-UI-SPEC.md
| 5 | Store full untruncated response bodies in devtools logs | 2026-06-03 | 99036280 | — |
