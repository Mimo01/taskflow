---
phase: 08-dashboard-enrichment
plan: 05
subsystem: ui
tags: [react, tanstack-query, dashboard, panels, tailwind]

# Dependency graph
requires:
  - phase: 08-dashboard-enrichment
    provides: SubtasksPanel (DASH-01), MrHealthPanel (DASH-02), SprintHealthPanel (DASH-03), NotificationsPanel (DASH-04)
provides:
  - Dashboard route wiring all four enriched panels in 2x2 grid
  - Old count-card grid removed (devCards, pmCards, cardValue gone)
  - Developer role: 4-panel 2x2 grid (Subtasks, MR Health, Sprint Health, Notifications)
  - PM role: 2-panel grid (Sprint Health, Notifications)
affects: [dashboard, phase-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dashboard as thin wiring layer: panels own data fetching, dashboard only loads tokens and passes as props
    - role-conditional layout: early return for PM role, default developer/tech-lead layout

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/index.tsx

key-decisions:
  - "Dashboard index.tsx is a thin wiring layer only — token loading + prop passing; panels handle their own queries"
  - "currentUser query enabled for all roles (not just non-pm) — MrHealthPanel needs userId for dev role"
  - "PM layout uses early return pattern for clean role separation"
  - "Developer/tech-lead defaults share the same 4-panel layout"
  - "Notifications store sanitized on rehydration — numeric/null id values coerced to string to prevent row click failures"

patterns-established:
  - "Dashboard-as-wiring: route component loads credentials, panels fetch their own data"

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-04]

# Metrics
duration: ~35min
completed: 2026-03-13
---

# Phase 08 Plan 05: Dashboard Integration Summary

**dashboard/index.tsx rewritten as thin wiring layer rendering 4 panel components (SubtasksPanel, MrHealthPanel, SprintHealthPanel, NotificationsPanel) in 2x2 CSS grid, replacing deprecated count-card grid**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-13T10:05:41Z
- **Completed:** 2026-03-13 (visual checkpoint approved)
- **Tasks:** 1 auto task + visual checkpoint (approved)
- **Files modified:** 1 (+ 4 post-checkpoint fix commits)

## Accomplishments
- Removed deprecated count-card grid: devCards, pmCards, cardValue, assignedMrs, reviewerMrs, sprintIssues, fixVersions queries all removed
- Developer role 2x2 grid: SubtasksPanel / MrHealthPanel / SprintHealthPanel / NotificationsPanel
- PM role 2-column grid: SprintHealthPanel / NotificationsPanel
- Token loading (jiraToken, gitlabToken via readSecret) and currentUser query retained for props
- All panel prop interfaces satisfied with `?? ''` fallbacks; each panel's own `enabled` guard handles missing credentials
- Visual verification approved — all 4 panels rendered correctly in the running app
- Post-checkpoint: fixed 4 interactive bugs (subtask sprint query, row clicks, notifications store rehydration, cursor styling)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite dashboard/index.tsx with 2x2 panel grid** - `7dcf893` (feat)

Post-checkpoint fix commits (visual verification):

2. **Fix: subtask sprint query and broken notifications link** - `f50106d` (fix)
3. **Fix: subtask row clicks and always show view-all link** - `1aa03e2` (fix)
4. **Fix: sanitize rehydrated notifications store on load** - `e218c3f` (fix)
5. **Fix: add cursor-pointer to subtask rows** - `66f05d3` (fix)

**Plan metadata (pre-checkpoint):** `11473c3` (docs)

## Files Created/Modified
- `taskflow/src/routes/dashboard/index.tsx` - Rewritten as thin wiring layer for 4 panel components

## Decisions Made
- Dashboard index is a thin wiring layer only — no query logic, just token loading and prop passing
- currentUser query enabled for all roles (not role-gated) since MrHealthPanel is in the developer layout and needs userId
- PM layout uses early return pattern for clean separation from developer layout
- Developer and tech-lead roles share the same 4-panel layout (no role distinction needed)

## Deviations from Plan

### Auto-fixed Issues (found during visual checkpoint review)

**1. [Rule 1 - Bug] Fixed subtask sprint query including subtask issue types**
- **Found during:** Visual checkpoint review
- **Issue:** Subtask JQL fetched from openSprints() without excluding subtaskIssueTypes() — on Jira DC this can return subtasks directly, causing empty SubtasksPanel view
- **Fix:** Added `issuetype not in subtaskIssueTypes()` guard to sprint JQL
- **Committed in:** `f50106d`

**2. [Rule 1 - Bug] Fixed subtask row click handler and removed broken notifications link**
- **Found during:** Visual checkpoint review
- **Issue:** Clicking a subtask row did not open the Jira issue; also a broken notifications link was present
- **Fix:** Corrected row click handler; removed broken link; made view-all link always render
- **Committed in:** `1aa03e2`

**3. [Rule 1 - Bug] Fixed notifications store rehydration with invalid id types**
- **Found during:** Visual checkpoint review
- **Issue:** Rehydrated notifications store could contain numeric or null id values, causing row click failures on string comparison
- **Fix:** Added sanitization in onRehydrateStorage — coerces all notification ids to string
- **Committed in:** `e218c3f`

**4. [Rule 1 - Bug] Added cursor-pointer to subtask rows**
- **Found during:** Visual checkpoint review
- **Issue:** Subtask rows appeared non-interactive — no pointer cursor on hover
- **Fix:** Added `cursor-pointer` Tailwind class to subtask row elements
- **Committed in:** `66f05d3`

---

**Total deviations:** 4 auto-fixed (all Rule 1 bugs, discovered during visual verification)
**Impact on plan:** All fixes necessary for correct interactive behavior. No scope creep — changes were within already-built panel components and the notifications store.

## Issues Encountered

Visual checkpoint revealed four interactive bugs not caught by the automated vitest suite (row clicks, store rehydration, cursor styling, JQL guard). All four were fixed in post-checkpoint commits.

Two pre-existing test failures confirmed out-of-scope (MyTasksTab skeleton test + ReleasesTab version count test — both existed before this plan). All new panel tests remain GREEN.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 4 dashboard panels (DASH-01 through DASH-04) are wired into the dashboard route and visually verified
- Phase 8 dashboard enrichment is complete
- No blockers for future work

---
*Phase: 08-dashboard-enrichment*
*Completed: 2026-03-13*
