---
phase: quick-260405-tci
verified: 2026-04-05T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Quick Task: Change Sprint of a Story from Issue Detail Sidebar — Verification Report

**Task Goal:** Change sprint of a story from issue detail sidebar with confirmation, and add confirmation to backlog view sprint changes. The sprint selector should use the same shared component in both places.
**Verified:** 2026-04-05
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can click the Sprint field in issue detail sidebar and select a different sprint | VERIFIED | `FieldsSection.tsx` line 562-607: Sprint row guarded by `isStory`, renders `DropdownMenu` with `DropdownMenuTrigger` (data-testid="sprint-edit"), populated by `sprintsQuery` via `fetchSprintList` |
| 2 | Selecting a sprint in issue detail shows a confirmation dialog before executing the move | VERIFIED | `FieldsSection.tsx` lines 589-596: `onSelectSprint` sets `pendingSprintMove` and closes picker; lines 609-619 render `ConfirmSprintMoveDialog` wired to `handleSprintMoveConfirm` |
| 3 | Moving a sprint from backlog context menu also shows a confirmation dialog before executing | VERIFIED | `BacklogPage.tsx` line 521-528: `requestMoveToSprint` sets `pendingSprintMove` instead of executing; lines 728-746 render `ConfirmSprintMoveDialog` before calling `confirmMoveToSprint` |
| 4 | After confirming, the issue moves to the selected sprint and caches invalidate | VERIFIED | `FieldsSection.tsx` `sprintMoveMutation` (lines 228-244) calls `addIssuesToSprint`/`moveIssuesToBacklog` and invalidates `jira-issue-detail`, `jira-sprint-stories`, `jira-backlog-sprint-stories`, `jira-backlog-issues`, `jira-sprint-list`; `BacklogPage.tsx` `confirmMoveToSprint` (lines 540-571) does the same with optimistic update + rollback |
| 5 | User can cancel the confirmation dialog without moving the issue | VERIFIED | `ConfirmSprintMoveDialog` has a `DialogClose` Cancel button; `onOpenChange` callbacks in both `FieldsSection` and `BacklogPage` clear `pendingSprintMove`/`pendingBacklogMove` when `open=false` |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/components/ui/dropdown-menu.tsx` | Wraps @base-ui/react/menu, same styling as context-menu | VERIFIED | 243 lines; exports DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuGroup, and sub-menu components |
| `taskflow/src/components/ui/sprint-move-menu-items.tsx` | Shared sprint list items component used in both places | VERIFIED | 60 lines; exports `SprintMoveMenuItems` with polymorphic `Item`, `Separator`, `Label` props — works with both ContextMenu and DropdownMenu primitives |
| `taskflow/src/components/ui/confirm-sprint-move-dialog.tsx` | Reusable confirmation dialog | VERIFIED | 52 lines; exports `ConfirmSprintMoveDialog`; imports Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle from `@/components/ui/dialog`; shows issue key, from/to sprint names; has Cancel + Confirm buttons |
| `taskflow/src/routes/dashboard/BacklogRow.tsx` | Uses SprintMoveMenuItems with ContextMenu | VERIFIED | Line 24 imports `SprintMoveMenuItems`; lines 218-229 use it with `Item={ContextMenuItem}`, `Separator={ContextMenuSeparator}`, `Label={ContextMenuLabel}` |
| `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` | Uses SprintMoveMenuItems with DropdownMenu | VERIFIED | Lines 25 imports `SprintMoveMenuItems`; lines 585-600 use it with `Item={DropdownMenuItem}`, `Separator={DropdownMenuSeparator}`, `Label={DropdownMenuLabel}`; `sprintPickerOpen` state present (line 109) |
| `taskflow/src/routes/dashboard/issue-detail/utils.ts` | extractSprintId handles string arrays (Java toString format) | VERIFIED | Lines 72-95: handles array of objects (prefer active), array of Java toString strings (parses `id=(\d+)` and prefers `/state=ACTIVE/i`), single object, and null |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `FieldsSection.tsx` | `@/services/jira/sprints` | `addIssuesToSprint` / `moveIssuesToBacklog` calls on confirm | WIRED | Line 31 imports both; `sprintMoveMutation.mutationFn` (line 229) calls both based on `sprintId === null` |
| `confirm-sprint-move-dialog.tsx` | `@/components/ui/dialog.tsx` | Dialog component imports | WIRED | Lines 2-10 import Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle |
| `BacklogPage.tsx` | `confirm-sprint-move-dialog.tsx` | `ConfirmSprintMoveDialog` rendered with pending move state | WIRED | Line 46 imports; two dialog instances rendered at lines 728-761 for sprint move and backlog move |
| `FieldsSection.tsx` | `@/services/jira/backlog` | `fetchSprintList` (shares cache with backlog view) | WIRED | Line 30 imports `fetchSprintList`; line 139 uses it in `sprintsQuery` with key `['jira-sprint-list', boardId, jiraBaseUrl]` — same cache key as backlog view |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `FieldsSection.tsx` — sprint picker | `sprintsQuery.data` | `fetchSprintList` from `@/services/jira/backlog`, enabled when `sprintPickerOpen && !!boardId && !!jiraToken` | Yes — real API call; shares cache with BacklogPage | FLOWING |
| `FieldsSection.tsx` — current sprint display | `sprintName` / `currentSprintId` | `extractSprintName(rawSprint)` / `extractSprintId(rawSprint)` from issue detail query result | Yes — derived from live issue detail data | FLOWING |
| `BacklogPage.tsx` — `requestMoveToSprint` fromSprintName | `issue.fields.sprint.name` | Searched from `sprintStories` + `backlogIssues` query results | Yes — from live query data | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| TypeScript compiles clean | `npx tsc --noEmit` | No output (exit 0) | PASS |
| `extractSprintId` handles Java toString array | Pattern `/id=(\d+)/` in utils.ts lines 88-91 | Present and correct | PASS |
| `SprintMoveMenuItems` excludes current sprint | `currentSprintId == null \|\| s.id !== currentSprintId` filter at line 37 | Filters correctly | PASS |
| Backlog "Move to Backlog" also uses confirmation | `requestMoveToBacklog` at line 530, wired to `ConfirmSprintMoveDialog` at lines 747-761 | Present and wired | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| QUICK-TCI | 260405-tci-PLAN.md | Sprint change from issue detail sidebar with confirmation; shared component | SATISFIED | All five truths verified; shared `SprintMoveMenuItems` used in both `BacklogRow` (ContextMenu) and `FieldsSection` (DropdownMenu) |

---

### Anti-Patterns Found

None. No TODOs, placeholders, empty implementations, or console.log stubs found in modified files.

---

### Human Verification Required

#### 1. Sprint picker interaction in issue detail sidebar

**Test:** Open any story's issue detail sidebar. Click the Sprint field.
**Expected:** A dropdown appears listing active and future sprints (excluding current sprint). Selecting one opens a "Move Issue" confirmation dialog showing issue key, from-sprint, and to-sprint. Cancel closes without action; Confirm executes the move and the Sprint field updates.
**Why human:** Dropdown trigger interaction and dialog rendering require a live app session.

#### 2. Backlog context menu confirmation flow

**Test:** Right-click any issue row in the Backlog view and select a sprint from "Move to...".
**Expected:** A confirmation dialog appears (not an immediate move). Cancel dismisses it; Confirm executes the move with optimistic UI update and cache invalidation.
**Why human:** Right-click context menu behavior and optimistic update timing require a live app session.

#### 3. "Move to Backlog" option in issue detail

**Test:** Open an issue that is currently assigned to a sprint in issue detail sidebar. Click the Sprint field.
**Expected:** Sprint list includes a "Backlog" option at the bottom separated by a divider. Selecting it opens confirmation dialog with toSprintName="Backlog".
**Why human:** Conditional rendering of Backlog option (only when `currentSprintId !== null`) needs live verification.

#### 4. Java toString sprint format (extractSprintId)

**Test:** On a Jira DC instance that returns sprint fields as string arrays (Java toString format), open a story's issue detail.
**Expected:** Current sprint is correctly detected and excluded from the picker; "Move to Backlog" option appears (since `currentSprintId` would be non-null).
**Why human:** Requires a real Jira DC environment with the old sprint field format.

---

### Gaps Summary

No gaps. All five must-have truths are verified. All six key artifacts exist, are substantive, and are wired correctly. Data flows from real API sources through the shared components to user-visible output. TypeScript compiles without errors.

---

_Verified: 2026-04-05_
_Verifier: Claude (gsd-verifier)_
