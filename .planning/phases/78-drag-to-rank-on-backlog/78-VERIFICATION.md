---
phase: 78-drag-to-rank-on-backlog
verified: 2026-06-04T13:00:00Z
status: human_needed
score: 4/4 automated must-haves verified
overrides_applied: 0
human_verification:
  - test: "Intra-section reorder — visual drag interaction (RANK-02 / D-07)"
    expected: "Press-and-hold ~150ms on a backlog row, drag within the active-sprint section: a semi-transparent ghost-placeholder row (opacity ~50%, dashed border) follows the dragged key's live position; on drop the row stays in its new slot (no snap-back). Reload — new order persists (RANK-03)."
    why_human: "dnd-kit PointerSensor drag and DragOverlay rendering are not exercisable in jsdom; the ghost-placeholder model (opacity-50, border-dashed) and absence of snap-back require real pointer events."
  - test: "Click vs drag disambiguation (D-06)"
    expected: "A quick click (<150ms) on a row opens the peek; a click on the issue key navigates full-page; a drag does NOT open the peek on release."
    why_human: "The justDragged ref guard (50ms window) and the 150ms PointerSensor activation delay are time-dependent; jsdom cannot simulate pointer timing."
  - test: "No-flicker during background refetch (RANK-05 / D-08)"
    expected: "Begin a drag; alt-tab away and back (triggering refetchOnWindowFocus) mid-drag — the list order does not jump or revert while dragging."
    why_human: "The cancelQueries + isDraggingRef gate interaction with the react-query background-refetch lifecycle requires the real Tauri window-focus event."
  - test: "Cross-section drag — section highlight + ConfirmSprintMoveDialog (D-03/D-04/D-05)"
    expected: "Drag a row from the active-sprint section toward a future-sprint section — the target section shows a subtle highlight ring while hovering. On drop a dialog appears with 'Keep Position' and 'Confirm'. Keep Position restores original position; Confirm moves the row to the target section and persists after reload."
    why_human: "Multi-container pointer drag, the DroppableSection useDroppable detection, custom collision detection, and the ConfirmSprintMoveDialog trigger require real pointer events and section-header/gap hover scenarios jsdom cannot simulate."
  - test: "Failure rollback banner (RANK-04 / D-09)"
    expected: "If a rank PUT fails (e.g. revoked network, 403 board), the list reverts to pre-drag order and an inline banner reads 'Couldn't save new order — reverted'. The banner is dismissible."
    why_human: "Inducing a real API failure requires the running Tauri app. The test suite verifies the rollback mechanism in isolation; the end-to-end banner rendering and dismiss in the real app require human eyes."
---

# Phase 78: Drag-to-Rank on Backlog — Verification Report

**Phase Goal:** Users can drag stories within the Backlog active-sprint list to reorder them; the new order persists to Jira and survives background polling without flicker.
**Verified:** 2026-06-04T13:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Backlog active-sprint list renders stories in Jira rank order on initial load | ✓ VERIFIED | `SortableContext items` derives from `displayIssues` (WR-03 fix); `renderSection` uses `localOrder.get(sectionId) ?? serverOrder` — when no drag override exists the server order is the render source of truth. `BacklogPage.network.test.tsx` (1 test) verifies RANK-01 GREEN. |
| 2 | User can drag a story row to a new position; card visually moves immediately on drop with no snap-back flicker even when a background poll fires during the drag window | ? HUMAN NEEDED | Code path verified: `DndContext` + per-section `SortableContext` wired; `PointerSensor { delay: 150, tolerance: 5 }`; live-reorder ghost-placeholder model (fourth polish pass); `cancelQueries` in `onMutate` + `isDraggingRef` gate. Real pointer drag and DragOverlay rendering not exercisable in jsdom. |
| 3 | After a successful drag, the new order persists to Jira via PUT /rest/agile/1.0/issue/rank using rankCustomFieldId read from the cached GreenHopper backlog response (never hardcoded) | ✓ VERIFIED | `rankIssueApi` exists at `services/jira/rank-api.ts`; barrel-exported from `services/jira.ts` line 26; `BacklogPage.tsx` mutation reads `backlog?.rankCustomFieldId` (integer from cache) — no `10105` literal in the mutation body (only in a doc comment at line 394). `rank-api.test.ts` (5 tests) asserts integer `rankCustomFieldId` fixture value 10105 and PUT to `/rest/agile/1.0/issue/rank`. GREEN. `BacklogPage.rank.test.ts` RANK-03 case GREEN. |
| 4 | If the rank API call fails, the list rolls back to the pre-drag order and surfaces an inline error | ✓ VERIFIED | `rankMutation.onError` restores `context.snapshot` via `setQueryData`, restores `localOrder` to `previousOrder`, sets `rankError = "Couldn't save new order — reverted"` (BacklogPage.tsx line 911). Banner rendered at line 1526. `BacklogPage.rank.test.ts` RANK-04 case GREEN. |

**Score:** 3/4 truths fully verified by code inspection + automated tests. Truth #2 requires human verification of the pointer drag visual and flicker-gate behavior.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/routes/dashboard/BacklogRow.tsx` | useSortable-wrapped draggable row with justDragged-guarded click | ✓ VERIFIED | `useSortable({ id: issue.key, disabled: isOverlay })` line 193; `setNodeRef` applied to both `<tr>` paths (lines 266, 289); `data-dragging` wired; `justDragged?.current` guard on both click paths (lines 272, 295). |
| `taskflow/src/routes/dashboard/BacklogPage.tsx` | DndContext + per-section SortableContext + rank mutation + flicker gate + error banner + cross-section confirm | ✓ VERIFIED | `DndContext` (line 1559, 4 occurrences); `SortableContext` (4 occurrences); `rankMutation` with `onMutate`/`onError`/`onSuccess`/`onSettled`; `cancelQueries` in `onMutate`; `isDraggingRef` (6 occurrences); banner "Couldn't save new order — reverted"; `cancelLabel="Keep Position"` at line 1500. |
| `taskflow/src/routes/dashboard/backlogDragHelpers.ts` | Pure drag helpers (container resolution, live-reorder, cross-section membership) | ✓ VERIFIED | File exists with `resolveSourceContainer`, `resolveTargetContainer`, `computeLiveReorder`, `sortByKeyOrder`, `moveIssueAcrossSections`, `resolveIntraSectionRank`, `resolveCrossSectionDrop` and more. 35 tests GREEN. |
| `taskflow/src/services/jira/rank-api.ts` | rankIssueApi service function (PUT rank) with 204/207/4xx handling | ✓ VERIFIED | Implements `rankIssueApi`; 204 → return; 401/403 → `ApiError`; 207 → body inspection (WR-01 fix); any other non-ok → generic Error. |
| `taskflow/src/services/jira.ts` | Barrel re-export of rankIssueApi | ✓ VERIFIED | `export { rankIssueApi } from './jira/rank-api';` at line 26. |
| `taskflow/src/services/jira/rank.ts` | Fixed LexoRank midpoint (cross-bucket CR-01 + BigInt base-36 CR-02) | ✓ VERIFIED | `beforeBucket !== afterBucket` branch present; `parseBase36` (3 occurrences); no `KNOWN-BROKEN` text; `rank.test.ts` E1–E12 all GREEN (12 tests). |
| `taskflow/src/components/ui/confirm-sprint-move-dialog.tsx` | cancelLabel prop with 'Cancel' default | ✓ VERIFIED | `cancelLabel?: string` in interface (line 21); destructured with default `'Cancel'` (line 32); rendered as `{cancelLabel}` in DialogClose (line 47). |
| `taskflow/src/test/package-deps.guard.test.ts` | @dnd-kit absence guard removed | ✓ VERIFIED | `grep -c "@dnd-kit absence guard"` returns 0; `react-grid-layout absence guard` guard still present (count 1). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `BacklogPage.tsx` | `rankIssueApi` | `rankMutation.mutationFn` | ✓ WIRED | `rankIssueApi` imported + called in mutation at line 892; 3 occurrences. |
| `BacklogPage.tsx` | `['gh-backlog', boardId]` cache | `cancelQueries` in `onMutate` | ✓ WIRED | `queryClient.cancelQueries({ queryKey: ['gh-backlog', boardId] })` at line 897. |
| `BacklogRow.tsx` | `DndContext` sortable state | `useSortable({ id: issue.key })` | ✓ WIRED | `useSortable` called at line 193; `setNodeRef`/`attributes`/`listeners` applied to both `<tr>` render paths. |
| `services/jira/rank-api.ts` | `PUT /rest/agile/1.0/issue/rank` | `apiFetch` | ✓ WIRED | URL built at line 32; `apiFetch('jira', url, { method: 'PUT', ... }, 'Rank Issue')` at line 34. |
| `services/jira.ts` | `rankIssueApi` | barrel export | ✓ WIRED | `export { rankIssueApi } from './jira/rank-api'` at line 26. |
| `BacklogPage.tsx` | `backlog?.rankCustomFieldId` (integer) | mutation vars | ✓ WIRED | `backlog?.rankCustomFieldId ?? 0` passed as `rankCustomFieldId` at lines 1080, 1236. No hardcoded `10105` in mutation body. |
| `rankMutation.onSuccess` | `localOrder` cleanup (CR-01 fix) | `setLocalOrder` delete | ✓ WIRED | `onSuccess` deletes the section's `localOrder` entry at line 914–929 so the reconciled server order takes over on invalidation. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `BacklogPage.tsx` sections | `displayIssues` | `localOrder.get(sectionId) ?? serverOrder` from `useGhBacklogData` cache | Yes — server-fetched `GhBacklogResponse`; `localOrder` only active during drag window | ✓ FLOWING |
| `rankIssueApi` call | `rankCustomFieldId` | `backlog?.rankCustomFieldId` from cached `GhBacklogResponse` | Yes — integer read from server response | ✓ FLOWING |
| Rollback banner | `rankError` state | `onError` callback sets string literal | Yes — set on actual API rejection, cleared by dismiss | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| rank.test.ts E1–E12 (LexoRank correctness) | `npm test -- --run src/services/jira/rank.test.ts` | 12 passed | ✓ PASS |
| rank-api.test.ts (PUT shape, integer rankCustomFieldId, 401/207 handling) | `npm test -- --run src/services/jira/rank-api.test.ts` | 5 passed | ✓ PASS |
| BacklogPage.rank.test.ts (RANK-03/04/05) | `npm test -- --run src/routes/dashboard/__tests__/BacklogPage.rank.test.ts` | 7 passed | ✓ PASS |
| BacklogPage.network.test.tsx (RANK-01 rank-order render) | `npm test -- --run src/routes/dashboard/__tests__/BacklogPage.network.test.tsx` | 1 passed | ✓ PASS |
| backlogDragHelpers.test.ts (container resolution, live-reorder, cross-section) | `npm test -- --run src/routes/dashboard/__tests__/backlogDragHelpers.test.ts` | 35 passed | ✓ PASS |
| biome + tsc clean | `npm run check` | 447 files, no errors | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RANK-01 | Plan 04 | Backlog active-sprint list ordered by Jira rank | ✓ SATISFIED | `SortableContext items` = `displayIssues.map(i => i.key)` (WR-03); server order is render source when no localOrder override. BacklogPage.network.test.tsx GREEN. |
| RANK-02 | Plan 04 | User can drag a story to reorder within the active-sprint list | ? HUMAN NEEDED | Code wired (DndContext, PointerSensor, live-reorder, arrayMove in handleDragEnd). Real pointer drag not verifiable in jsdom. |
| RANK-03 | Plans 01/03/04 | Reorder persists via PUT /rest/agile/1.0/issue/rank, rankCustomFieldId from backlog cache | ✓ SATISFIED | `rankIssueApi` implemented and tested; `backlog?.rankCustomFieldId` used (no hardcoded constant); rank-api.test.ts and BacklogPage.rank.test.ts GREEN. |
| RANK-04 | Plans 01/04 | Failed rank update rolls back and surfaces error | ✓ SATISFIED | `onError` restores snapshot + localOrder + sets rankError banner text. BacklogPage.rank.test.ts RANK-04 case GREEN. |
| RANK-05 | Plans 01/04 | Drag reordering does not flicker when background poll refreshes | ? HUMAN NEEDED (code VERIFIED) | `cancelQueries` in `onMutate` + `isDraggingRef`-gated `localOrder` are in place (BacklogPage.rank.test.ts RANK-05 case GREEN). The absence of visible flicker during an actual focus-refetch requires human verification with the running Tauri app. |

All 5 RANK-01..05 requirements accounted for. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TBD/FIXME/XXX/placeholder markers found in any phase-78 modified file | — | — |

No debt markers found. Biome + TSC clean.

### Deferred Code-Review Items (non-blocking)

Per 78-REVIEW.md, the following items were explicitly deferred from the code review pass and are not blocking this verification:

- **WR-04:** Sibling cache mutations (`handleToggleFlag`, `confirmMoveToSprint`, `confirmMoveToBacklog`) skip `cancelQueries` — tracked for a follow-up pass, outside the rank/drag scope.
- **IN-01–IN-04:** Minor: redundant 204 guard clause, `rankIssue` missing precondition doc, dead virtualization machinery, vestigial `forwardRef`. Informational only.

### Human Verification Required

#### 1. Intra-section reorder — visual drag interaction (RANK-02)

**Test:** Run `cd taskflow && npm run tauri dev`, open the Backlog page for a board with an active sprint. Press-and-hold a story row for ~150ms, then drag it to a new position within the same sprint section.
**Expected:** A ghost-placeholder row (translucent, dashed border) appears live in the dragged position; no insertion line needed (ghost IS the cue). On drop, the row stays in its new slot with no snap-back. Reload the page — the new order persists.
**Why human:** dnd-kit PointerSensor and DragOverlay are not exercisable in jsdom.

#### 2. Click vs drag disambiguation (D-06)

**Test:** Quick-click (< 150ms) a story row. Then quick-click the issue key in a row.
**Expected:** Quick click opens the peek slideover. Clicking the issue key opens full-page issue detail. A drag does NOT open the peek on release.
**Why human:** The justDragged 50ms ref guard and the 150ms PointerSensor activation are time-dependent; jsdom cannot simulate pointer timing.

#### 3. No-flicker during background refetch (RANK-05 / D-08)

**Test:** Begin dragging a row. While holding the drag, alt-tab away and back (triggering `refetchOnWindowFocus`). Continue drag and drop.
**Expected:** The list order does not jump or revert during or after the drag. The dropped row stays in its new position.
**Why human:** The cancelQueries + isDraggingRef gate interacts with the Tauri window-focus event; jsdom cannot simulate this lifecycle.

#### 4. Cross-section drag — section highlight + ConfirmSprintMoveDialog (D-03/D-04/D-05) — User-confirmed accepted design

**Test:** Drag a row from the active-sprint section toward a future-sprint section header or body.
**Expected:** The target section shows a subtle ring highlight while hovering. On drop, "Move Issue" dialog appears with "Keep Position" and "Confirm" buttons. "Keep Position" restores original position. "Confirm" moves the row to the target section and persists after reload.
**Why human:** Multi-container pointer drag, DroppableSection detection, custom collision detection, and the ConfirmSprintMoveDialog trigger require real pointer events. This is the accepted cross-section interaction model per phase UAT (cross-section reflowing ghost was reverted at commit 88b4de39 as structurally unstable).
**Note:** The SUMMARY confirms this path was human-approved in the UAT iteration and commits c5dbf106, 1f648bd8, 9c0ee850, bdc048c8, 7c122eae, 164fff83, f4cbca05 iteratively refined it. Re-confirm all sub-behaviors work as described.

#### 5. Failure rollback banner (RANK-04 / D-09)

**Test:** Induce a rank API failure (revoke network briefly, or test against a board where rank write returns 403). Perform a drag-to-reorder.
**Expected:** The list reverts to pre-drag order and an inline banner reads "Couldn't save new order — reverted". The banner is dismissible via its close button.
**Why human:** Inducing a real API failure requires the running Tauri app. The automated test verifies the rollback mechanism in isolation; the banner rendering and dismiss in the real app need human confirmation.

---

## Gaps Summary

No gaps. All must-have truths are either fully verified by code inspection + automated tests, or require human verification of visual/real-time behavior that jsdom structurally cannot cover. The distinction is important: the code that implements the behavior EXISTS, is WIRED, and DATA FLOWS — but the behaviors themselves (pointer drag animation, flicker absence during window-focus refetch, cross-section confirm dialog trigger) are Manual-Only Verifications as documented in the phase's own 78-VALIDATION.md.

The phase reached this state after extensive UAT iteration (4 polish passes + code review fix pass). All Critical and key Warning findings from 78-REVIEW.md are resolved (CR-01 localOrder cleared on success, WR-01 207 handling, WR-02 deterministic sort, WR-03 filtered SortableContext items, WR-05 confirm double-fire guard).

---

_Verified: 2026-06-04T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
