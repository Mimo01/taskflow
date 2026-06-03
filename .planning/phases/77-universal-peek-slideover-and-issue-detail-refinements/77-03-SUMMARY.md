---
phase: 77-universal-peek-slideover-and-issue-detail-refinements
plan: "03"
subsystem: ui
tags: [react, tanstack-router, vitest, peek-panel, squeeze-layout, hotkeys, resizable]

requires:
  - "77-01 (peekPanelWidth in settings.store, PeekPanel.test.tsx stub)"
  - "77-02 (IssueDetailView with layout='single-column' + onOpenIssue prop)"
provides:
  - "PeekPanel.tsx — CSS squeeze/push panel with resize handle, header bar (key, Open full page, X), IssueDetailView single-column, Escape guard"
  - "main.tsx peek state (peekIssueKey, peekPanelWidth), handleOpenPeek, route-change close, onOpenIssue in outlet context"
  - "CommandPalette.tsx onOpenIssue prop — body selection routes to peek"
  - "NotificationPopover.tsx onOpenIssue prop — body row click routes to peek"
  - "PeekPanel.test.tsx — 7 passing tests covering PEEK-02/03/04/06/07 + Pitfall 6"
affects:
  - "77-04 (TaskCard key-click split, other surfaces consuming onOpenIssue from outlet context)"

tech-stack:
  added: []
  patterns:
    - "CSS squeeze layout: PeekPanel as flex-row sibling of <main> — no Dialog, no backdrop, no aria-hidden suppression"
    - "Swap-in-peek (D-13): PeekPanel passes onOpenIssue=setPeekIssueKey to IssueDetailView — inner links swap the peek without navigation"
    - "Palette open guard: useHotkeys enabled only when !paletteOpen — prevents double-dismiss (Pitfall 6)"
    - "Route-change close via useEffect on location.pathname — peek closes on any route change, swaps don't change pathname so they stay open"
    - "onOpenIssue universal seam: outlet context carries handleOpenPeek; CommandPalette/NotificationPopover receive it as a direct prop"

key-files:
  created:
    - taskflow/src/components/app/PeekPanel.tsx
  modified:
    - taskflow/src/main.tsx
    - taskflow/src/components/app/CommandPalette.tsx
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/components/app/PeekPanel.test.tsx
    - taskflow/src/components/app/settings.store.test.ts
    - taskflow/src/components/app/CommandPalette.test.tsx

key-decisions:
  - "CommandPalette body-select now calls onOpenIssue (peek) — key element click split (onIssueClick for navigate) is delivered in Plan 04 Task 3"
  - "NotificationPopover body row click rerouted to onOpenIssue — key element split delivered in Plan 04 Task 3 (NotificationRow.tsx)"
  - "onNavigateFull: setPeekIssueKey(null) then handleIssueClick(key, true) — close first to avoid layout flash on navigation"
  - "min-h-0 on the flex-row wrapper div is required (A5) to prevent the peek from stretching layout height in Safari"

patterns-established:
  - "Squeeze layout: wrap <main> in flex-row div with min-h-0; PeekPanel mounts after </main> as a shrink-0 sibling"
  - "Persist panel width via settings.store (peekPanelWidth), apply ?? 480 default at read time in PeekPanel via useResizable"

requirements-completed: [PEEK-01, PEEK-02, PEEK-03, PEEK-04, PEEK-05, PEEK-06, PEEK-07]

duration: ~45min
completed: 2026-06-03
---

# Phase 77 Plan 03: PeekPanel + Peek State Wiring Summary

**Universal non-blocking peek panel (CSS squeeze layout, no Dialog/backdrop) mounted at AppLayout level with full IssueDetailView single-column, resizable divider (360-720px persisted), Escape/X/Open-full-page dismissal, route-change close, and onOpenIssue seam wired to outlet context + CommandPalette + NotificationPopover; 7 unit tests passing (PEEK-02/03/04/06/07 + Pitfall 6)**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-03T12:00:00Z
- **Completed:** 2026-06-03T13:55:00Z
- **Tasks:** 3 autonomous + 1 checkpoint (human-verify approved)
- **Files modified:** 7

## Accomplishments

- Created `PeekPanel.tsx` (~100 lines): resize handle via `useResizable(direction:'left', min:360, max:720)`, header bar (key label, Open full page button, X close button), `IssueDetailView layout="single-column"` as body, Escape hotkey guarded by `!paletteOpen` (Pitfall 6)
- Wired peek state in `main.tsx`: `peekIssueKey` + `peekPanelWidth` state, `handleOpenPeek`, route-change close via `useEffect(location.pathname)`, `<div className="flex flex-row flex-1 overflow-hidden min-h-0">` squeeze wrapper, `PeekPanel` mounted after `<main>`, `onOpenIssue: handleOpenPeek` added to outlet context
- Added `onOpenIssue` prop to `CommandPalette` (body selection → peek) and `NotificationPopover` (body row click → peek); key-element split deferred to Plan 04
- Activated 7 PeekPanel unit tests: PEEK-02 (renders body for key), PEEK-03 (no role=dialog), PEEK-04 (swap issueKey updates header), PEEK-06 (Open full page calls onNavigateFull), PEEK-07 (Escape + X both call onClose), Pitfall 6 (Escape blocked while palette open)
- Fixed stale tests in `settings.store.test.ts` and `CommandPalette.test.tsx` broken by Plan 03 changes (Rule 1 deviation)

## Task Commits

1. **Task 1: Build PeekPanel** - `e71702d6` (feat)
2. **Task 2: Wire peek state in main.tsx + onOpenIssue to CommandPalette/NotificationPopover/TopBar** - `df272803` (feat)
3. **Task 3: Activate PeekPanel.test.tsx — PEEK-02/03/04/06/07 (7 tests)** - `882f2073` (test)
4. **Fix: Update stale settings.store / CommandPalette tests** - `a482de83` (fix)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `taskflow/src/components/app/PeekPanel.tsx` — **Created**: squeeze layout panel; resize handle, header bar, IssueDetailView single-column body, Escape guard
- `taskflow/src/main.tsx` — **Modified**: peek state, handleOpenPeek, route-change close, flex-row squeeze wrapper, PeekPanel mount, outlet context onOpenIssue
- `taskflow/src/components/app/CommandPalette.tsx` — **Modified**: `onOpenIssue` prop added; body-select routes to peek
- `taskflow/src/routes/notifications/NotificationPopover.tsx` — **Modified**: `onOpenIssue` prop added; body row click routes to peek
- `taskflow/src/components/app/PeekPanel.test.tsx` — **Modified**: 7 it.todo → 7 passing it() assertions
- `taskflow/src/components/app/settings.store.test.ts` — **Modified**: updated for Plan 03 changes (Rule 1)
- `taskflow/src/components/app/CommandPalette.test.tsx` — **Modified**: updated for onOpenIssue prop (Rule 1)

## Decisions Made

- CommandPalette body-select now calls `onOpenIssue` (peek) exclusively for this plan; the key-element click split (`onIssueClick` for full-page navigation) is delivered in Plan 04 Task 3 where an inner key clickable is added with `stopPropagation`.
- NotificationPopover body row click rerouted to `onOpenIssue`; key-element split in NotificationRow.tsx likewise deferred to Plan 04 Task 3.
- `onNavigateFull` calls `setPeekIssueKey(null)` before `handleIssueClick(key, true)` to close the peek eagerly and avoid a layout flash while the route change propagates.
- `min-h-0` is mandatory on the flex-row wrapper div (A5) — without it, Safari stretches the layout height because `flex-1` children in a column flex container don't respect the viewport boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale tests broken by Plan 03 changes**
- **Found during:** Task 3 (PeekPanel test activation — full suite run)
- **Issue:** `settings.store.test.ts` and `CommandPalette.test.tsx` were failing because Plan 03's changes (new `peekPanelWidth` store field, new `onOpenIssue` prop on CommandPalette) invalidated their existing assertions
- **Fix:** Updated both test files to match the new interfaces
- **Files modified:** `taskflow/src/components/app/settings.store.test.ts`, `taskflow/src/components/app/CommandPalette.test.tsx`
- **Verification:** `npm run check` clean; full vitest suite green (1702 passing)
- **Committed in:** `a482de83`

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Required for test suite health; no scope creep.

## Issues Encountered

None beyond the auto-fixed stale tests above.

## Known Stubs

- **CommandPalette body-select / key-element split** — body clicks currently always open the peek. The inner key label as a distinct clickable (with `stopPropagation` → `onIssueClick` for full-page navigation) is not yet present in `CommandPalette.tsx`. This is intentional — Plan 04 Task 3 adds it.
- **NotificationRow key-element split** — same pattern: body row → peek, key label → full-page. The inner key button in `NotificationRow.tsx` is added in Plan 04 Task 3.

Both stubs are structural placeholders, not data stubs. The peek correctly opens and renders; only the key-click navigate path is missing until Plan 04.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. `peekIssueKey` is derived from in-DOM issue keys (existing rendered data). `peekPanelWidth` read from settings store is clamped by `useResizable` min/max at read time (T-77-04 mitigated).

## Next Phase Readiness

- `onOpenIssue` universal seam is live in outlet context — Plan 04 surfaces (TaskCard, BacklogRow, SprintBoard card) consume it via `useOutletContext`
- PeekPanel renders full editable detail — comments, composer, worklogs, AIO test runs all present (D-05)
- Key-element click split for CommandPalette and NotificationRow delivered in Plan 04 Task 3

---
*Phase: 77-universal-peek-slideover-and-issue-detail-refinements*
*Completed: 2026-06-03*

## Self-Check

### Files Created/Verified

- [x] `taskflow/src/components/app/PeekPanel.tsx` — `e71702d6`
- [x] `taskflow/src/main.tsx` modified — `df272803`
- [x] `taskflow/src/components/app/CommandPalette.tsx` modified — `df272803`
- [x] `taskflow/src/routes/notifications/NotificationPopover.tsx` modified — `df272803`
- [x] `taskflow/src/components/app/PeekPanel.test.tsx` — `882f2073`
- [x] `taskflow/src/components/app/settings.store.test.ts` — `a482de83`
- [x] `taskflow/src/components/app/CommandPalette.test.tsx` — `a482de83`

### Commits Verified Present

- [x] `e71702d6` — feat(77-03): build PeekPanel
- [x] `df272803` — feat(77-03): wire peek state in main.tsx
- [x] `882f2073` — test(77-03): activate PeekPanel.test.tsx
- [x] `a482de83` — fix(77-03): update existing tests broken by Plan 03 changes

### Checks

- [x] `npm run check` — clean (biome + tsc, 441 files)
- [x] `vitest run PeekPanel.test.tsx` — 7/7 passing

## Self-Check: PASSED
