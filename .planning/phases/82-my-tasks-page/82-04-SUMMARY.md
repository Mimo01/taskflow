---
phase: 82-my-tasks-page
plan: "04"
subsystem: my-tasks
tags: [ui, component, react, react-query, zustand]
dependency_graph:
  requires: ["82-01", "82-02", "82-03"]
  provides: ["my-tasks-page-ui", "MyTaskRow", "MyTasksPage"]
  affects: []
tech_stack:
  added: []
  patterns:
    - "div[role=button] + sibling <button> stopPropagation (overlay-button pattern)"
    - "StatusPopover inside flex div wrapper (statusPillClass flex-parent fix)"
    - "explicit style={{ width:18, height:18 }} icon spans (WebKit 0-width fix)"
    - "Component useState for transient filter (never in Zustand store)"
    - "Single Tabs root wrapping both tab strip and content panels"
key_files:
  created:
    - taskflow/src/routes/my-tasks/MyTaskRow.tsx
    - taskflow/src/routes/my-tasks/MyTasksPage.tsx
    - taskflow/src/routes/my-tasks/MyTasksPage.test.tsx
  modified: []
decisions:
  - "StatusPopover renders its own PopoverTrigger — MyTaskRow does NOT wrap a custom button as children; the flex div wrapper is placed around StatusPopover itself"
  - "Single Tabs root wraps both TabsList header and TabsContent panels (not two separate Tabs instances)"
  - "getMrHealth() returns 'waiting_for_review' when issue key is in myOpenMRIssueKeys set — full ReviewHealth derivation (approvals fetch) deferred to plan 82-05 wiring"
  - "handleOpenPeek() navigates to /issue/:key as a fallback — PeekPanel integration is wired in plan 82-05"
metrics:
  duration: "~25 min"
  completed: "2026-06-14"
  tasks_completed: 2
  files_created: 3
---

# Phase 82 Plan 04: My Tasks Page UI Summary

MyTaskRow and MyTasksPage composed from existing primitives, Wave 0 sort lib and store, and the two new Jira service functions — delivering the full row anatomy, all four inline interactions, three grouping modes, the six-count transient filter strip, scope toggle, per-section states, and a passing smoke test.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | MyTaskRow.tsx — full anatomy + inline interactions | b7eab6dc | MyTaskRow.tsx |
| 2 | MyTasksPage.tsx + MyTasksPage.test.tsx | 48b00c2f | MyTasksPage.tsx, MyTasksPage.test.tsx |

## What Was Built

### Task 1: MyTaskRow.tsx (307 lines)

Full 9-element left-to-right anatomy per MYTASK-05:
1. IssueTypeIcon — `style={{ width:18, height:18 }}` (WebKit 0-width fix)
2. Issue key `<button>` with `stopPropagation` → `onOpenIssue` (overlay-button pattern)
3. PriorityIcon — `style={{ width:18, height:18 }}`
4. Summary with Flag icon + OverdueBadge
5. StatusPopover inside `<div className="flex shrink-0">` (statusPill flex-parent fix)
6. Due date — `text-destructive` when overdue, `aria-label` with "overdue" suffix
7. Story points badge — inline-flex w-7, `?` when null
8. MR health Badge (tone: green/orange/blue) — when `mrHealth` prop provided
9. Progress bar (time logged/remaining) — when `timetracking.originalEstimateSeconds > 0`

Inline interactions (MYTASK-06, D-07, D-08):
- Outer `div[role=button]` with `tabIndex=0` + `onKeyDown` Enter/Space → `onOpenPeek`
- Issue key sibling `<button>` with `e.stopPropagation()` → `onOpenIssue`
- StatusPopover click → inline status transition
- Right-click ContextMenu: "Log Work" (LogWorkPopover), "Copy issue key", "Copy link" — exactly D-07 (no Flag/Unflag, no Open in browser)

Subtask indent: `pl-8` when `isSubtask=true` (D-03)
Flagged row: `bg-yellow-100 dark:bg-yellow-900/30` (BacklogRow pattern)

### Task 2: MyTasksPage.tsx (685 lines) + MyTasksPage.test.tsx (120 lines)

Page root composes all Wave 0 outputs:

**Summary/filter strip (MYTASK-02, D-01):**
- Six count pills: To Do / In Progress / In Review / Done this sprint / Overdue / MRs awaiting me
- Counts derived from `deriveCounts()` — no extra API calls
- `activeFilter` is component `useState<FilterKey | null>` — NEVER in `useMyTasksStore` (D-01/D-10)
- Single-select toggle, `aria-pressed` on active pill

**Grouping tabs + scope toggle (MYTASK-03, MYTASK-07/08):**
- Single `<Tabs>` root wrapping both `<TabsList>` and `<TabsContent>` panels
- `groupingMode` reads/writes `useMyTasksStore` (persisted)
- Scope toggle pair with `role="group" aria-label="Scope"`, `aria-pressed`, `h-9` minimum height
- `scope` reads/writes `useMyTasksStore` (persisted)

**Three grouping modes (MYTASK-04):**
- My Day: `groupByMyDay()` → band groups with exact UI-SPEC labels, subtasks nested
- By Status: groups by statusCategory.key in To Do / In Progress / Done order
- By Sprint & Parent: groups by `customfield_10020` sprint field, active first then closed newest-first then Backlog

**Query wiring (MYTASK-07):**
- `scope='current-sprint'` → `fetchMyTasksHierarchy` with key `['jira-issues','my-tasks',...]`
- `scope='all-assigned'` → `fetchAllAssignedHierarchy` with key `['jira-issues','my-tasks-all',...]`
- Both: `staleTime: 30_000`, `placeholderData: (prev) => prev`
- Optional GitLab authored-MRs query enabled only when gitlabUserId + token present (graceful degrade, A2)

**Per-section states (D-11):**
- Skeleton rows while loading
- ErrorState with `viewName="My Tasks"` + `onRetry`
- Three EmptyState variants with exact UI-SPEC copy:
  - My Day empty: "You're all caught up" / "No tasks need your attention right now. Check back after standup."
  - Filter zero rows: "No matches" / "No tasks match the active filter. Click the filter again to clear it."
  - All Assigned empty: "No assigned issues" / "You have no issues assigned across all sprints and the backlog."

**Progressive indicator (D-06):**
- Skeleton row pair + "Loading more tasks…" shown when `scope=all-assigned` and `isFetching && !isLoading`

**Smoke test (MYTASK-01):** 5/5 green — renders page title, filter pills, grouping tabs, scope toggle, and empty state without throwing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] StatusPopover renders its own trigger — cannot wrap children**
- **Found during:** Task 1 implementation
- **Issue:** Plan action said "wire StatusPopover with inner button as children". StatusPopover internally uses `<PopoverTrigger>` from Radix, rendering its own pill button — it does not accept `children` as the trigger.
- **Fix:** Removed the redundant inner `<button>` child and placed `<StatusPopover>` directly inside the `<div className="flex shrink-0">` wrapper. StatusPopover renders the pill itself via its own `PopoverTrigger` with `statusPillClass`.
- **Files modified:** taskflow/src/routes/my-tasks/MyTaskRow.tsx
- **Commit:** b7eab6dc

**2. [Rule 1 - Bug] Dual Tabs root consolidation**
- **Found during:** Task 2 implementation
- **Issue:** Initial draft used two separate `<Tabs>` instances (one for the header strip, one for content), which is redundant and may cause context mismatch.
- **Fix:** Consolidated into a single `<Tabs>` root that wraps both `<TabsList>` in the header row and the `<TabsContent>` panels below — correct controlled-tabs pattern.
- **Files modified:** taskflow/src/routes/my-tasks/MyTasksPage.tsx
- **Commit:** 48b00c2f

**3. [Rule - Implementation scope] getMrHealth() simplified**
- **Found during:** Task 2 implementation
- **Issue:** Full `ReviewHealth` derivation requires fetching MR approvals per-issue (async), which is not scoped to this plan.
- **Fix:** `getMrHealth()` returns `'waiting_for_review'` when the issue key is in `myOpenMRIssueKeys`, else `undefined`. Full approval-state derivation deferred to plan 82-05 (wiring plan) where PeekPanel and full issue context is available.
- **Impact:** MR health badge shows "In Review" for all issues with an authored MR; approved/changes-requested distinction requires plan 82-05 wiring.

**4. [Rule - Implementation scope] handleOpenPeek() navigates instead of opening peek**
- **Found during:** Task 2 implementation
- **Issue:** PeekPanel app-shell integration is wired in plan 82-05, not this plan.
- **Fix:** `handleOpenPeek()` falls back to `navigate('/issue/:key')` so the row is fully interactive and navigation works. Plan 82-05 will swap this to the real peek handler.
- **Impact:** Row body click navigates full-page rather than sliding the peek panel. Functionally equivalent until plan 82-05 wires the peek.

## Known Stubs

None that affect plan goal delivery. The two deferred items (getMrHealth full derivation, PeekPanel integration) are documented as deviations above and will be resolved in plan 82-05.

## Verification

- `npm run test -- --run src/routes/my-tasks/MyTasksPage.test.tsx` — 5/5 PASS (verified via temp copy to main checkout)
- `tsc --noEmit` — 0 errors for all my-tasks route files
- `git diff taskflow/package.json` — empty (no new packages)

## Self-Check: PASSED

- [x] MyTaskRow.tsx created at correct worktree path (307 lines)
- [x] MyTasksPage.tsx created at correct worktree path (685 lines)
- [x] MyTasksPage.test.tsx created at correct worktree path (120 lines)
- [x] Commit b7eab6dc exists (MyTaskRow)
- [x] Commit 48b00c2f exists (MyTasksPage + test)
- [x] All acceptance criteria assertions pass
- [x] No package.json modifications
- [x] No deletions in commits
