---
phase: 11-create-edit-issue-form
plan: "04"
subsystem: ui
tags: [react, typescript, lucide-react, modal, state-management]

# Dependency graph
requires:
  - phase: 11-03
    provides: CreateEditIssueModal component with EditInitialValues interface and defaultIssueType/defaultParentKey props

provides:
  - AppLayout owns createModal state (open, mode, initialValues, defaultType, defaultParent)
  - Sidebar Create Issue button (PlusSquare icon, button not NavLink) opens modal in create mode
  - IssueDetailContent Edit button opens modal in edit mode pre-filled with all fields
  - IssueDetailContent Add subtask button opens modal in create mode with Subtask type + parent key
  - IssueDetailSheet threads onEdit/onAddSubtask props through to IssueDetailContent
  - CreateEditIssueModal accepts defaultIssueType and defaultParentKey props

affects:
  - 11-05 (cache invalidation on modal close)
  - future phases using CreateEditIssueModal entry points

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Modal state lifted to AppLayout shell (same pattern as IssueDetailSheet)
    - Prop threading (AppLayout → IssueDetailSheet → IssueDetailBody → IssueDetailContent) for modal callbacks
    - Button (not NavLink) for non-route actions in sidebar nav

key-files:
  created: []
  modified:
    - src/main.tsx
    - src/components/app/Sidebar.tsx
    - src/routes/dashboard/CreateEditIssueModal.tsx
    - src/routes/dashboard/IssueDetailSheet.tsx
    - src/routes/dashboard/IssueDetailContent.tsx

key-decisions:
  - "Modal state (createModalOpen, mode, initialValues, defaultType, defaultParent) lifted to AppLayout — consistent with IssueDetailSheet placement"
  - "Sidebar Create Issue is a <button> not <NavLink> — no route change, opens dialog; consistent with RESEARCH.md Pattern 7"
  - "defaultIssueType/defaultParentKey added to CreateEditIssueModalProps — required for Add Subtask pre-set entry point"
  - "Edit button reads storyPointsFieldKey/epicLinkFieldKey from useSettingsStore inside IssueDetailContent (not from props)"

patterns-established:
  - "Modal entry-point pattern: caller sets mode + optional pre-fill values, passes single onEdit/onAddSubtask callback, AppLayout owns all modal state"
  - "Sidebar non-route items are <button type=button> with same NAV_LINK_CLASS styling as inactive NavLink"

requirements-completed: [CREATE-01, CREATE-02, CREATE-03]

# Metrics
duration: 15min
completed: 2026-03-14
---

# Phase 11 Plan 04: Wire Modal Entry Points Summary

**Three modal entry points wired to AppLayout state: Sidebar Create Issue button, IssueDetailContent Edit button, and IssueDetailContent Add Subtask button**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-14T14:10:00Z
- **Completed:** 2026-03-14T14:25:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- AppLayout owns all CreateEditIssueModal state — accessible from any entry point without prop drilling to routes
- Sidebar gains a "Create Issue" button (PlusSquare icon, `<button>` element) positioned between Dashboard link and role-specific Work section
- IssueDetailContent gains Edit button (Pencil icon) and "Add subtask" button (Plus icon) — Edit pre-fills all CREATE-03 fields from the open issue, Add Subtask pre-sets type=Subtask and parent key

## Task Commits

Each task was committed atomically:

1. **Task 1: Lift modal state to AppLayout and add Sidebar button** - `a305725` (feat)
2. **Task 2: Edit button and Add Subtask button in IssueDetailContent** - `474f193` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/main.tsx` - Added createModal state + handlers, CreateEditIssueModal render, onOpenCreate prop to Sidebar, onEdit/onAddSubtask wiring to IssueDetailSheet
- `src/components/app/Sidebar.tsx` - Added SidebarProps interface, onOpenCreate prop, PlusSquare Create Issue button
- `src/routes/dashboard/CreateEditIssueModal.tsx` - Added defaultIssueType and defaultParentKey to CreateEditIssueModalProps; wired into selectedIssueType and parentKey state initialization
- `src/routes/dashboard/IssueDetailSheet.tsx` - Added onEdit/onAddSubtask to IssueDetailSheetProps and IssueDetailBody; threaded through to IssueDetailContent
- `src/routes/dashboard/IssueDetailContent.tsx` - Added onEdit/onAddSubtask props; Edit button with Pencil icon; Add subtask button with Plus icon; reads field keys from useSettingsStore

## Decisions Made
- Modal state lifted to AppLayout (same level as IssueDetailSheet) — consistent shell ownership pattern
- Sidebar Create Issue is a `<button>`, not `<NavLink>` — opens dialog, no route navigation
- `defaultIssueType` and `defaultParentKey` added to `CreateEditIssueModalProps` during this plan because the modal from plan 11-03 lacked them — auto-fixed per Rule 2 (missing critical props for plan requirements)
- Edit button reads `storyPointsFieldKey`/`epicLinkFieldKey` from `useSettingsStore()` inside `IssueDetailContent` rather than prop-threading from parent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added defaultIssueType and defaultParentKey to CreateEditIssueModalProps**
- **Found during:** Task 1 (main.tsx wiring)
- **Issue:** Plan 11-04 requires passing `defaultIssueType='Subtask'` and `defaultParentKey` from AppLayout to CreateEditIssueModal for the Add Subtask entry point, but these props were not added to the modal interface in plan 11-03
- **Fix:** Added `defaultIssueType?: 'Story' | 'Subtask' | 'Bug'` and `defaultParentKey?: string` to `CreateEditIssueModalProps`; wired into `selectedIssueType` and `parentKey` state initialization
- **Files modified:** src/routes/dashboard/CreateEditIssueModal.tsx
- **Verification:** TypeScript compiles without errors for CreateEditIssueModal props
- **Committed in:** a305725 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical props)
**Impact on plan:** Required for correctness — without these props the Add Subtask entry point could not pre-set issue type or parent key.

## Issues Encountered
- Pre-existing TypeScript errors in `WorkloadTab.test.tsx`, `SprintProgressTab.test.tsx`, `IssueDetailSheet.test.tsx`, `JiraStep.tsx`, and `jira.ts` were present before this plan; none were caused by these changes and all are out of scope
- 3 pre-existing test file failures (MyTasksTab.test, ReleasesTab.test, SubtasksPanel.test) confirmed present before changes; 329 tests pass

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three modal entry points wired and accessible in the live app
- Plan 11-05 (cache invalidation on modal close) can now proceed — modal `onClose` callback in AppLayout is the correct place to trigger invalidation
- No blockers

---
*Phase: 11-create-edit-issue-form*
*Completed: 2026-03-14*
