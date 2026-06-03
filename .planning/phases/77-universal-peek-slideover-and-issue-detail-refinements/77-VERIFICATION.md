---
phase: 77-universal-peek-slideover-and-issue-detail-refinements
verified: 2026-06-03T00:00:00Z
status: human_needed
score: 4/5 must-haves verified (SC-5 is human-only)
overrides_applied: 0
human_verification:
  - test: "Open peek from every surface and confirm underlying view stays interactive"
    expected: "Peek opens as right-edge squeeze/push panel; board/backlog/list behind remains scrollable and clickable with no backdrop; no dark overlay visible"
    why_human: "CSS layout behavior (flex-row squeeze vs backdrop) cannot be verified by static grep — requires a running browser rendering the Tauri app"
  - test: "Drag the peek resize divider; restart and reopen a peek"
    expected: "Width changes live within 360–720 px clamp; width is restored after restart (persisted via settings store v26)"
    why_human: "useResizable behaviour and Tauri Store persistence are only observable at runtime"
  - test: "Click the issue key on a TaskCard, BacklogRow, DashboardInProgressCard, each standup row (Today + Yesterday/Earlier), a CommandPalette result row, and a notification row"
    expected: "Key click navigates full-page (/issue/:key) and does NOT open the peek on any surface; no double-fire"
    why_human: "stopPropagation correctness across multiple surfaces and the cmdk Command.Item event model require a live app; static code shows the pattern is applied but runtime interaction must confirm no cmdk intercept"
  - test: "Open peek, click a subtask/parent/linked-issue link INSIDE the peek body"
    expected: "The peek swaps to that issue (D-13); it does not navigate or close"
    why_human: "D-13 swap-in-peek relies on onOpenIssue=setPeekIssueKey flowing through IssueDetailView → IssueDetailContent — correct at code level but the user flow must be confirmed live"
  - test: "Press Escape with a form field (comment composer, inline edit) focused inside the peek"
    expected: "Escape cancels the inline edit (local handler fires first) and does NOT close the peek panel; WR-04 fix (enableOnFormTags: false) should produce this behavior"
    why_human: "Event bubbling / focus management inside Tauri's WebView cannot be asserted by unit tests; requires live interaction"
  - test: "Navigate /issue/:key directly (full-page) and verify comments, activity timeline, composer, worklogs, AIO test runs all render as before the IssueDetailView extraction"
    expected: "Full-page detail is visually and functionally identical to pre-phase-77 (two-column layout, all query data present)"
    why_human: "Full-page regression is a visual/interactive check; requires running the app"
  - test: "Open the peek for an epic, a bug, and a subtask (PEEK-02)"
    expected: "All three issue types render correctly in single-column peek (fields stacked above description + comments)"
    why_human: "Issue-type rendering inside peek requires live network data; mocked in unit tests only"
---

# Phase 77: Universal Peek Slideover and Issue-Detail Refinements — Verification Report

**Phase Goal:** Clicking any issue anywhere in the app opens a non-blocking right-edge slideover preview; clicking the issue key still navigates full-page; the underlying view stays fully interactive; subtask parent link moves to main content and cursor styles are correct throughout issue detail.
**Verified:** 2026-06-03
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| SC-1 | Clicking an issue body (board, backlog, standup, dashboard, search/command palette, notifications) opens the peek | VERIFIED | `onOpenIssue` threaded through outlet context to SprintBoardTab, BacklogPage, dashboard/index.tsx, StandupNotesPage (all sub-components), CommandPalette (handleIssueSelect), NotificationPopover/Row — every surface wired |
| SC-2 | Underlying view stays scrollable/clickable; no backdrop; not a Dialog | VERIFIED (code) / HUMAN NEEDED (runtime) | PeekPanel has no Dialog/Sheet import; renders as `<div>` sibling of `<main>` inside `flex flex-row flex-1 overflow-hidden min-h-0`; no `role="dialog"`; PEEK-03 unit test asserts `queryByRole('dialog')` is null |
| SC-3 | Clicking a different issue swaps the preview; clicking the issue key navigates full-page (stopPropagation split) | VERIFIED (code) / HUMAN NEEDED (runtime) | `onOpenIssue={(key) => setPeekIssueKey(key)}` on PeekPanel for swap; `stopPropagation` present in TaskCard, BacklogRow, DashboardInProgressCard, CommandPalette, NotificationRow; standup TodayUpNextSection, TodayInProgressSection, TodayColumn, YesterdayColumn, IssueActivityGroup all have onOpenIssue + stopPropagation on key element |
| SC-4 | Peek has visible close control + "Open full page" button; Escape dismisses | VERIFIED | PeekPanel renders `<Button aria-label="Close preview">` (X) and `<Button>Open full page</Button>` with ExternalLink icon; `useHotkeys('escape', onClose, { enableOnFormTags: false, enabled: !!issueKey && !paletteOpen })` |
| SC-5 | On a subtask's full-page detail: parent link in main content (above description), not sidebar; all clickable areas show pointer cursor | VERIFIED (code) | IssueDetailContent.tsx:223-232 — `{isSubtask && parent && (<button ... onClick={() => onOpenIssue?.(parent.key)}><ArrowUpRight/> {parent.key}...</button>)}` renders ABOVE `<h2>` title; FieldsSection has 0 occurrences of `label="Parent"`; subtask rows carry `cursor-pointer py-2`; epic story rows carry `cursor-pointer`; Add-subtask button carries `cursor-pointer`; DETAIL-01/02 tests pass |

**Score:** 4/5 truths verified (SC-2 and SC-3 code-verified; SC-2, SC-3, SC-4, SC-5 require human confirmation for live interaction)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/stores/settings.store.ts` | peekPanelWidth field + setter + v26 migration | VERIFIED | `peekPanelWidth: null` at initialSettings; `peekPanelWidth: number | null` + `setPeekPanelWidth` in interface; `version: 26`; `if (version < 26) { ... s.peekPanelWidth = null }` migration block — all 4 grep targets confirmed |
| `taskflow/src/components/app/PeekPanel.tsx` | Squeeze layout panel: resize handle + header + IssueDetailView single-column | VERIFIED | 102 lines; renders `<IssueDetailView layout="single-column" onOpenIssue={onOpenIssue}/>`; min:360, max:720, direction:'left'; `!paletteOpen` guard; `enableOnFormTags: false` (WR-04 fix applied) |
| `taskflow/src/main.tsx` | peekIssueKey state, handleOpenPeek, route-change close, PeekPanel mount, onOpenIssue in context | VERIFIED | `peekIssueKey` useState; `handleOpenPeek`; `prevPathRef` + useEffect on `location.pathname` calling `setPeekIssueKey(null)`; `flex flex-row flex-1 overflow-hidden min-h-0` wrapper; `onOpenIssue: handleOpenPeek` in outlet context; PeekPanel mounted conditionally |
| `taskflow/src/routes/dashboard/IssueDetailView.tsx` | Shared full-detail body with layout + onOpenIssue props | VERIFIED | 825 lines; `layout: 'two-column' | 'single-column'` prop; 8 useQuery calls (base, epic-stories, comments, enrichment, changelog, worklogs, etc.); CommentComposer present; single-column layout at line 649+ |
| `taskflow/src/routes/dashboard/IssueDetailPage.tsx` | Thin wrapper rendering IssueDetailView two-column | VERIFIED | 0 useMutation calls; renders `<IssueDetailView layout="two-column" onOpenIssue={onIssueClick}>`; deliberate-divergence comment explains onOpenIssue=onIssueClick on full-page (WR-05 acknowledged) |
| `taskflow/src/routes/dashboard/IssueDetailContent.tsx` | Parent breadcrumb above title + cursor-pointer sweep | VERIFIED | ArrowUpRight breadcrumb at lines 223-232 guarded by `isSubtask && parent`; renders before `<h2>`; subtask rows `cursor-pointer py-2`; epic story rows `cursor-pointer`; Add-subtask `cursor-pointer` |
| `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` | Parent MetaRow removed | VERIFIED | `grep -c 'label="Parent"'` returns 0 |
| `taskflow/src/routes/dashboard/TaskCard.tsx` | div role=button body → onOpenIssue; inner key button → navigate full-page | VERIFIED | `role="button"` on outer; `stopPropagation` on key button; `onOpenIssue` prop consumed; `useKeyBodySplit` flag controls split |
| `taskflow/src/routes/dashboard/BacklogRow.tsx` | Row body → onOpenIssue; key cell button → onIssueClick | VERIFIED | `onOpenIssue` prop; key cell has `stopPropagation`; both `<tr onClick>` variants route to `onOpenIssue` |
| `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx` | div role=button rows → onOpenIssue; trailing key → onIssueClick | VERIFIED | `role="button"` on outer rows; `stopPropagation` on key buttons; `onOpenIssue` prop |
| `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` | onOpenIssue threaded to all standup sub-surfaces | VERIFIED | `onOpenIssue` destructured from useOutletContext; passed to TodayColumn and YesterdayColumn; all 5 standup source files (TodayColumn, TodayInProgressSection, TodayUpNextSection, YesterdayColumn, IssueActivityGroup) have `onOpenIssue` |
| `taskflow/src/components/app/CommandPalette.tsx` | Body → onOpenIssue (peek); inner key button → stopPropagation → onIssueClick | VERIFIED | `handleIssueSelect` calls `onOpenIssue`; `handleIssueKeyClick` calls `e.stopPropagation()` then `onIssueClick`; key buttons on all result row variants wired to `handleIssueKeyClick` |
| `taskflow/src/routes/notifications/NotificationRow.tsx` | Body → onOpenIssue; inner key button → stopPropagation → onIssueKeyClick | VERIFIED | `onIssueKeyClick` prop; key button calls `e.stopPropagation(); onIssueKeyClick?.()` |
| `taskflow/src/routes/notifications/NotificationPopover.tsx` | onIssueKeyClick passed in BOTH virtual and non-virtual render paths | VERIFIED | BL-01 fix confirmed: both the virtual path (line 184) and non-virtual fallback path (line 209) pass `onIssueKeyClick={() => onIssueKeyClick(entry.item)}` |
| `taskflow/src/components/app/PeekPanel.test.tsx` | PEEK-02/03/04/06/07 tests pass (real it(), not todo) | VERIFIED | All 7 test cases are `it(...)` (no `.todo`); assert no role=dialog, Open full page calls onNavigateFull, Escape calls onClose, X button calls onClose, swap updates header |
| `taskflow/src/routes/dashboard/TaskCard.test.tsx` | PEEK-05 tests pass | VERIFIED | Two PEEK-05 `it(...)` cases: key click asserts onIssueClick called + onOpenIssue NOT called; body click asserts onOpenIssue called |
| `taskflow/src/routes/dashboard/IssueDetailContent.test.tsx` | DETAIL-01/02 tests pass (real it(), not todo) | VERIFIED | Three `it(...)` cases: ArrowUpRight breadcrumb above h2; no "Parent" MetaRow in sidebar; subtask row has cursor-pointer class |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `main.tsx` outlet context | All visual surfaces | `onOpenIssue: handleOpenPeek` | WIRED | Confirmed at main.tsx:582; consumed by SprintBoardTab, BacklogPage, dashboard/index.tsx, StandupNotesPage |
| `TopBar` → `NotificationPopover` | peek open | `onOpenIssue={handleOpenPeek}` | WIRED | main.tsx:535 → TopBar.tsx:104 → NotificationPopover |
| `CommandPalette` | peek open | `onOpenIssue` prop + handleIssueSelect | WIRED | main.tsx:610-613 passes `onOpenIssue` to CommandPalette |
| `PeekPanel.onOpenIssue` | swap (D-13) | `(key) => setPeekIssueKey(key)` | WIRED | main.tsx:592 |
| `PeekPanel` | `IssueDetailView layout="single-column"` | direct render | WIRED | PeekPanel.tsx:98 |
| `IssueDetailPage` | `IssueDetailView layout="two-column"` | direct render | WIRED | IssueDetailPage.tsx:82-85 |
| `NotificationRow` key button | `onIssueKeyClick` (full-page) | `stopPropagation` | WIRED | NotificationRow.tsx:287-288; BL-01 confirmed fixed in both render paths |
| `settings.store peekPanelWidth` | `PeekPanel onWidthChange` | `setPeekPanelWidth` | WIRED | main.tsx:589-590 |
| `location.pathname` change | `setPeekIssueKey(null)` | useEffect + prevPathRef | WIRED | main.tsx:326-332 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `PeekPanel` → `IssueDetailView` | `issueKey` prop | click handler in list surface | Yes — click-derived existing key | FLOWING |
| `IssueDetailView` | `issue` (base query) | `useQuery(['jira-issue-detail', issueKey])` → Jira REST | Yes — PAT-secured REST fetch | FLOWING |
| `IssueDetailView` | `commentsQuery` | `useQuery(['jira-issue-comments', issueKey])` | Yes | FLOWING |
| `IssueDetailContent` parent breadcrumb | `issue.fields.parent` | base issue query | Conditional — only for subtasks with parent | FLOWING |
| `settings.store` peekPanelWidth | `peekPanelWidth: null | number` | Tauri Store (persisted) | Yes — nullable default, user-set on drag | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| PeekPanel exports PeekPanel function | `grep -q "export function PeekPanel" PeekPanel.tsx` | match | PASS |
| PeekPanel renders IssueDetailView single-column | `grep -q 'layout="single-column"' PeekPanel.tsx` | match | PASS |
| PeekPanel has no Dialog/Sheet import | `grep -c "from '@/components/ui/sheet'"` | 0 | PASS |
| settings.store version 26 with migration | `grep "version: 26" + "version < 26"` | both match | PASS |
| peekPanelWidth in store (4 occurrences) | `grep -c "peekPanelWidth"` | 7 | PASS |
| FieldsSection parent MetaRow removed | `grep -c 'label="Parent"' FieldsSection.tsx` | 0 | PASS |
| ArrowUpRight breadcrumb above h2 | code read at lines 223-235 | breadcrumb before h2 tag | PASS |
| stopPropagation in all key-split surfaces | grep on TaskCard, BacklogRow, DashboardInProgressCard, CommandPalette, NotificationRow | all match | PASS |
| BL-01 non-virtual NotificationRow path fixed | lines 204-214 of NotificationPopover.tsx | onIssueKeyClick present | PASS |
| All standup sub-components have onOpenIssue | for-loop check | all OK (test files excluded) | PASS |
| Route-change close effect | main.tsx:326-332 | prevPathRef + useEffect on pathname | PASS |

---

## Requirements Coverage

| Requirement | Phase | Description | Status | Evidence |
|------------|-------|-------------|--------|---------|
| PEEK-01 | 77 | Issue body click opens peek on all surfaces | SATISFIED | onOpenIssue wired across board, backlog, dashboard, standup, command palette, notifications |
| PEEK-02 | 77 | Peek works for any issue type | SATISFIED (code) / HUMAN (runtime) | IssueDetailView is type-agnostic; renders based on issueKey; human test required for epic/bug/subtask in live app |
| PEEK-03 | 77 | Underlying view stays interactive; no focus trap, no backdrop | SATISFIED (code) / HUMAN (runtime) | CSS flex-row sibling layout confirmed; no Dialog; PEEK-03 unit test passes; runtime visual confirmation needed |
| PEEK-04 | 77 | Clicking different issue swaps preview | SATISFIED (code) / HUMAN (runtime) | `onOpenIssue={(key) => setPeekIssueKey(key)}` — swap wired; PEEK-04 unit test passes; runtime swap confirmation needed |
| PEEK-05 | 77 | Key click navigates full-page (not peek) | SATISFIED (code) / HUMAN (runtime) | stopPropagation pattern applied on all surfaces; PEEK-05 unit test passes; runtime double-fire check needed |
| PEEK-06 | 77 | Peek provides explicit "open full page" affordance | SATISFIED | "Open full page" Button with ExternalLink icon in PeekPanel header; PEEK-06 unit test passes |
| PEEK-07 | 77 | Peek dismissible via Escape + explicit close | SATISFIED | useHotkeys('escape', onClose, ...) + X Button; PEEK-07 unit tests pass |
| DETAIL-01 | 77 | Subtask detail: parent in main content, not sidebar | SATISFIED | ArrowUpRight breadcrumb above h2; FieldsSection parent MetaRow removed; DETAIL-01 unit tests pass |
| DETAIL-02 | 77 | Clickable areas show pointer cursor | SATISFIED | cursor-pointer on subtask rows (py-2), epic story rows, Add-subtask button, parent breadcrumb; DETAIL-02 unit test passes |

All 9 requirements covered. No orphaned requirements.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `IssueDetailView.tsx` | 312 | Hardcoded magic `952` fallback width | INFO | Wrong initial split on non-standard window size until user drags; documented in REVIEW as IN-01, tracked |
| `IssueDetailView.tsx` | 311-314 | `useMemo` reads `containerRef.current` during render (ref is null at first render) | WARNING | Default two-column width always uses 952*0.42 fallback; documented in REVIEW as WR-03, tracked |
| `CommandPalette.tsx` | 177-183 | `pushRecentItem` called in palette then again in `handleIssueClick`; store dedupes so no visible bug | INFO | Redundant push; documented as WR-02/WR-01 in REVIEW, tracked |
| `NotificationPopover.tsx` | 308-310 | Ternary expression as a statement (`readSet.has(...) ? markAsUnread : markAsRead`) | INFO | Fragile pattern; documented as WR-06 in REVIEW, tracked |
| `IssueDetailView.tsx` | 431-438 | Worklog started fallback `toISOString().replace('Z', '+0000')` — brittle but currently correct | INFO | Documented as WR-07 in REVIEW, tracked |

No `TBD`, `FIXME`, or `XXX` markers found in phase-modified files. No stub implementations found (no `return null`, `return []`, or empty handlers in render paths).

---

## Human Verification Required

### 1. Peek opens as a non-blocking right-edge squeeze (PEEK-03)

**Test:** Run the app, click any issue card body on the Sprint Board or Backlog. Observe the panel layout.
**Expected:** A right-edge panel pushes the main content narrower (flex-row squeeze); the underlying list behind the peek is bright, scrollable, and all controls remain clickable. No dark/semi-transparent backdrop covers the background.
**Why human:** CSS flex-row squeeze vs. backdrop dimming is a browser rendering observation; grep cannot verify it.

### 2. Width persistence across restart (PEEK-07 / settings store)

**Test:** Open a peek, drag the left resize divider to a new width. Quit and relaunch the app. Open a peek again.
**Expected:** The panel reopens at the previously dragged width (not the 480 default). Width is clamped to 360–720 during drag.
**Why human:** Tauri Store persistence requires an actual process restart; cannot be verified statically.

### 3. Key click never also opens peek — no double-fire on any surface (PEEK-05)

**Test:** On each surface (Sprint Board TaskCard, Backlog row, Dashboard in-progress card, Standup Today + Yesterday rows, CommandPalette result, Notification row), click the issue key element specifically.
**Expected:** Navigation to /issue/:key happens; the peek panel does NOT open or flash. Repeat for each surface to confirm stopPropagation holds in the cmdk Command.Item context.
**Why human:** cmdk's internal onSelect can intercept click events in ways that grep cannot predict; stopPropagation on the key button may or may not block cmdk's onSelect depending on event ordering in the live WebView.

### 4. Swap-in-peek works (D-13 / PEEK-04)

**Test:** Open a peek. Inside the peek body, click a subtask row, parent breadcrumb, or linked issue link.
**Expected:** The peek header changes to the linked issue's key; content reloads for that issue. The app does not navigate away or close the peek.
**Why human:** D-13 requires that onOpenIssue inside IssueDetailView calls setPeekIssueKey (passed from main.tsx:592) rather than navigating — this event flow through IssueDetailContent → onOpenIssue prop must be confirmed live.

### 5. Escape inside inline edit closes edit only, not peek (WR-04 / PEEK-07)

**Test:** Open a peek for an issue that has comments. Click in the comment composer (or trigger an inline field edit inside the peek). Press Escape.
**Expected:** The composer/edit is cancelled; the peek panel stays open. Pressing Escape again (with no form field focused) should then close the peek.
**Why human:** `enableOnFormTags: false` is the fix for WR-04. This fix changes which handler claims the Escape event. The event bubbling order in a focused textarea vs. useHotkeys global handler must be confirmed in the live WebView.

### 6. Full-page /issue/:key regression check (Plan 02 extraction)

**Test:** Navigate directly to any /issue/:key full-page route.
**Expected:** Two-column layout (left content + right resizable sidebar), activity timeline, comment list, comment composer, worklogs section, and AIO test runs all present. The view is visually and functionally identical to pre-phase-77.
**Why human:** IssueDetailPage was reduced to a thin wrapper; all queries moved to IssueDetailView. A runtime rendering check is the only way to confirm no queries were accidentally dropped during extraction.

### 7. All issue types render in peek (PEEK-02)

**Test:** Open a peek for an epic, a bug, and a subtask.
**Expected:** Each renders correctly in single-column (sidebar fields stacked above description + comments). No crashes or empty panels.
**Why human:** Unit tests mock IssueDetailView; live rendering with real query data for each issue type is required.

---

## Gaps Summary

No gaps blocking goal achievement were found in the codebase. All artifacts exist with substantive implementations, all key links are wired, and the one BLOCKER from the code review (BL-01 — NotificationPopover non-virtual path dropping onIssueKeyClick) is confirmed fixed in the source. The seven human verification items above are runtime/interaction checks that the automated scan cannot substitute for; they are the standard gate before declaring the phase fully passed in a visual app.

---

_Verified: 2026-06-03_
_Verifier: Claude (gsd-verifier)_
