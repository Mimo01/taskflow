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
Last activity: 2026-06-06 - Completed quick task 260606-ubz: peek "Open full page" now preserves the breadcrumb trail back to the source page (dropped resetTrail=true in main.tsx onNavigateFull). | 2026-06-06 - Quick task 260606-spj APPROVED & closed: issue peek redesign — header now shows issue-type icon + key + truncated title (controls stay visible during load, title via a deduped same-key useQuery so no extra fetch); Linked Issues + Merge Requests moved out of the top sidebar to sit just above the activity/comments feed in the peek (new useLinkedMRs hook + omitLinkedIssues/omitMergeRequests props; final order Fields → content → Linked Issues → Merge Requests → activity). Two-column full page unchanged. --full pipeline; verified 6/6; 21/21 tests; npm run check GREEN.

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
| 260606-oyy | Sprint board: priority now shown as Jira iconUrl icon (card footer + swimlane header) instead of left border; card left border repurposed to issue-type color via issueTypeStripeClass(); new PriorityIcon component; a11y alt text; issue-type stripe tuned to 3px per UAT | 2026-06-06 | a553b75b | Approved & closed | [260606-oyy-on-sprint-board-i-want-to-change-how-pri](./quick/260606-oyy-on-sprint-board-i-want-to-change-how-pri/) |
| 260606-pxn | Backlog view: show Jira priority icon in task rows — reuses PriorityIcon in its own column (key → priority → title, like the swimlane); explicit-px wrapper so the column holds width in the WebKit virtualized table (class-sized content collapses to 0); px-0 per UAT | 2026-06-06 | f686edd7 | Approved & closed | [260606-pxn-on-backlog-view-put-the-priority-icon-in](./quick/260606-pxn-on-backlog-view-put-the-priority-icon-in/) |
| 260606-qfn | Add issue-type icon (Story/Bug/Task/Epic) to backlog rows + sprint board story swimlane header — reuses IssueTypeIcon; dedicated column BEFORE the key in both (type → key → priority → summary, consistent per user); explicit-px wrapper on the backlog cell; issueTypeName prop threaded to all 3 SprintBoardTab call sites; null-safe issuetype?.name; npm run check GREEN | 2026-06-06 | 825ddbda | Approved & closed | [260606-qfn-add-issue-type-icon-to-backlog-issue-row](./quick/260606-qfn-add-issue-type-icon-to-backlog-issue-row/) |
| 260606-qup | Backlog rows: add horizontal edge padding so the type icon (first cell) and assignee avatar (last cell) aren't flush against the row edges — first cell px-0 → pl-4 pr-0, assignee cell px-2 → pl-2 pr-4 in RowCells (covers both render paths); explicit-px inner spans untouched to keep virtualized columns from collapsing; matches the section header's px-4 edge convention | 2026-06-06 | 91c6d386 | Approved & closed | [260606-qup-on-backlog-view-issue-rows-have-no-left-](./quick/260606-qup-on-backlog-view-issue-rows-have-no-left-/) |
| 260606-r80 | Unassigned avatar made visually distinct in CachedAvatar — unassigned branch now uses border-dashed border-muted-foreground/50 + bg-muted/40 (dimmed dashed placeholder) instead of the same solid bg-muted circle as assigned initials; User icon kept; assigned initials + image branches unchanged; existing-token reuse (no new colors); Test 9 added asserting border-dashed present/absent; 9/9 tests + npm run check GREEN | 2026-06-06 | 3c0199f5 | Approved & closed | [260606-r80-unassigned-avatar-distinct](./quick/260606-r80-unassigned-avatar-distinct/) |
| 260606-rgc | Epics page brought to backlog parity (EpicsPage.tsx) — removed the `<thead>` column-header row (headerless like the backlog table); added a `<colgroup>` to preserve column widths that previously lived only on the deleted `<th>`s; assignee cell now ALWAYS renders CachedAvatar with `name={...|| 'Unassigned'}` (distinct dashed-border unassigned treatment) matching BacklogRow, replacing the old `assignee ? … : null` conditional. UAT follow-ups: (1) status pill was visually off — statusPillClass omits a display and needs a flex-item parent for its min-w/text-center, so wrapped the span in `<div className="flex">` (1dd00a2a); (2) spacing polish — status col w-32→w-28 (excess right margin) and assignee cell px-3→pl-3 pr-6 + col w-12→w-16 so the avatar isn't flush to the container edge (8fdc867d). --full pipeline (discuss+research+check+review+verify), verified 5/5, npm run check GREEN. New memory: statusPillClass needs flex parent. | 2026-06-06 | 8fdc867d | Approved & closed | [260606-rgc-make-the-epics-page-match-more-backlog-v](./quick/260606-rgc-make-the-epics-page-match-more-backlog-v/) |
| 260606-s09 | Filter stories by "Unassigned" in Backlog + Sprint Board, merged into the existing assignee filter. New shared `taskflow/src/lib/assignee-filter.ts` holds a reserved sentinel `UNASSIGNED_FILTER = '__unassigned__'` (+ label "Unassigned"), `buildAssigneeOptions()` (pins sentinel to TOP, only when ≥1 visible issue is unassigned, with a collision guard so a real displayName equal to the sentinel is never offered), and `matchesAssigneeFilter()` (sentinel matched strictly on `assignee == null`, excluded from the named substring pass — OR semantics). Both BacklogPage and SprintBoardTab now delegate to the single shared helper (predicate drift eliminated); UnifiedFilterBar `displayMap` renders the sentinel as "Unassigned" in the dropdown, search, and active chip. `filter.store.ts` untouched (sentinel round-trips as a plain string). --full pipeline (discuss+research+check+review+verify); code-review WR-01/IN-01 fixed in a0c22947; 12/12 vitest pass; verified 6/6; npm run check GREEN. Post-approval UI polish: Unassigned dropdown option styled italic+muted with a divider via a generic `distinctValue` prop on FilterDropdown (0266f84b), + pr-0.5 to stop truncate clipping the italic trailing glyph (79bc5910). | 2026-06-06 | 79bc5910 | Approved & closed | [260606-s09-in-backlog-and-sprint-board-filters-i-wa](./quick/260606-s09-in-backlog-and-sprint-board-filters-i-wa/) |
| 260606-ubz | Peek "Open full page" now preserves the breadcrumb trail back to the page the peek was opened from. The `onNavigateFull` handler in `main.tsx` called `handleIssueClick(key, true)`, where `resetTrail=true` wiped the trail (`breadcrumbReset()` + pushed nothing); dropped the arg so the default `resetTrail=false` path runs — pushing the source list route (via `routeLabel`) or the parent issue (issue→issue drill) onto the trail before navigating to `/issue/${key}`, identical to a normal list click. Inline quick fix (1 line), tsc clean. | 2026-06-06 | 943cba44 | Approved & closed | [260606-ubz-peek-open-full-page-should-push-breadcru](./quick/260606-ubz-peek-open-full-page-should-push-breadcru/) |
| 260606-spj | Issue peek redesign — (1) header now shows IssueTypeIcon + key + truncated title (was key-only); the icon/title appear once the issue loads via a deduped `useQuery` on the SAME `['jira-issue-detail', issueKey, jiraBaseUrl]` key IssueDetailView uses (TanStack dedupes → no extra fetch), while Close + Open-full-page controls stay PeekPanel-owned and visible during load (left container `min-w-0 flex-1`, key `shrink-0`, title `truncate pr-0.5`). (2) Merge Requests moved out of the top sidebar block to the BOTTOM of the single-column peek content (below description/activity): MR fetch extracted into new `issue-detail/useLinkedMRs.ts` hook, sidebar gained `omitMergeRequests` prop gated by `layout==='single-column'`, and IssueDetailView's single-column branch renders `<MergeRequestsSection>` after the activity feed. Two-column full page is byte-identical (omitMergeRequests=false). Edited the REAL `issue-detail/IssueDetailSidebar.tsx`, not the barrel. --full pipeline (discuss+research+check+review+verify); verified 6/6; 7/7 PeekPanel tests; npm run check GREEN (465 files). Code review: 0 critical, 3 advisory warnings left as-is (pre-existing MR 20-item page cap, redundant two-column hook subscription, queryFn DRY). Post-approval follow-ups (inline, same pattern): Linked Issues also moved out of the top sidebar via a new `omitLinkedIssues` prop (6acd11f8), then both Linked Issues + Merge Requests placed JUST ABOVE the activity/comments feed in the peek (fd58e525) — final single-column order: Fields → content → Linked Issues → Merge Requests → activity/comments. Two-column full page unchanged throughout (props default false). 21/21 tests; npm run check GREEN. | 2026-06-06 | fd58e525 | Approved & closed | [260606-spj-on-issue-peek-component-show-both-key-an](./quick/260606-spj-on-issue-peek-component-show-both-key-an/) |

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
| 16 | Consistent story point badge width in Backlog regardless of digit count | 2026-06-06 | a0aa443b | Approved | — |
