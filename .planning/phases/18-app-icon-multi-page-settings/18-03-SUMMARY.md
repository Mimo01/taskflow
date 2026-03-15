---
phase: 18-app-icon-multi-page-settings
plan: "03"
subsystem: ui
tags: [react, settings, sidebar-nav, zustand, lucide-react, vitest]

# Dependency graph
requires:
  - phase: 18-app-icon-multi-page-settings
    plan: "01"
    provides: settings.store migration with persist v1 + migrate
provides:
  - Settings.tsx two-column sidebar-nav shell with 5-item nav and useState routing
  - ConnectionsSection.tsx with Jira + GitLab connection cards and inline test feedback
  - Stub sections AppearanceSection, NotificationsSection, WorkflowSection for Plans 04/05
affects:
  - 18-04 (AppearanceSection slot in Settings shell is ready)
  - 18-05 (NotificationsSection and WorkflowSection slots are ready)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Settings sidebar nav uses SECTIONS config array driving both sidebar render and content switch
    - ConnectionCard uses inline TestStatus state machine (idle/pending/success/error)
    - No createContext/useContext — prop drilling only
    - No toast calls — all feedback inline in component

key-files:
  created:
    - taskflow/src/routes/settings/ConnectionsSection.tsx
    - taskflow/src/routes/settings/AppearanceSection.tsx
    - taskflow/src/routes/settings/NotificationsSection.tsx
    - taskflow/src/routes/settings/WorkflowSection.tsx
  modified:
    - taskflow/src/routes/settings/Settings.tsx

key-decisions:
  - "validateFn prop typed as Promise<any> to accept both validateJira (returns JiraUser) and validateGitLab (returns GitLabUser) without duplication"
  - "Token input is always editable (type=password) rather than readOnly with Edit toggle, to satisfy test expectations for onChange status reset"
  - "Stub sections (AppearanceSection, NotificationsSection, WorkflowSection) created as separate files so Plans 04/05 can replace content without touching Settings.tsx"

patterns-established:
  - "Settings sections expose data-testid='section-{id}' wrapper divs for selector-based testing"
  - "SECTIONS config array pattern: drives sidebar buttons and content switch from single source of truth"

requirements-completed: [SETTINGS-01, SETTINGS-02]

# Metrics
duration: 5min
completed: 2026-03-15
---

# Phase 18 Plan 03: Settings Sidebar Nav + ConnectionsSection Summary

**Two-column Settings shell with 5-item sidebar nav (useState routing) and Jira/GitLab connection cards with inline spinner/success/error test feedback**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-15T12:28:31Z
- **Completed:** 2026-03-15T12:33:32Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Rewrote Settings.tsx as a two-column layout: fixed 208px sidebar + scrollable content area, default section 'connections', no React Router sub-routes
- Created ConnectionsSection.tsx with two service cards (Jira, GitLab), each with URL input, masked token input, Test Connection button, and inline status feedback
- Created stub files for AppearanceSection, NotificationsSection, WorkflowSection (Plans 04/05 will replace content)
- 18 tests pass across both test files

## Task Commits

1. **Task 1: Rewrite Settings.tsx as two-column sidebar-nav shell** - `4e5b6e6` (feat)
2. **Task 2: Create ConnectionsSection with inline Jira/GitLab test feedback** - `5d47d1c` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `taskflow/src/routes/settings/Settings.tsx` — Two-column sidebar-nav shell; SECTIONS config array; useState activeSection
- `taskflow/src/routes/settings/ConnectionsSection.tsx` — Jira + GitLab ConnectionCard components; inline TestStatus state machine
- `taskflow/src/routes/settings/AppearanceSection.tsx` — Stub with data-testid for Plan 18-04
- `taskflow/src/routes/settings/NotificationsSection.tsx` — Stub with data-testid for Plan 18-05
- `taskflow/src/routes/settings/WorkflowSection.tsx` — Stub with data-testid for Plan 18-05

## Decisions Made

- `validateFn` prop typed as `Promise<any>` — avoids duplicating the union type since `validateJira` returns `JiraUser` and `validateGitLab` returns `GitLabUser`, but the component only needs to know the call succeeded
- Token input is always editable (not readOnly) — tests fire `onChange` on the token field to assert status reset; a readOnly input with no handler cannot satisfy that requirement
- Stub files are separate .tsx files rather than inline stubs in Settings.tsx — cleaner separation; Plans 04/05 replace file contents, Settings.tsx import stays unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] validateFn type narrowed from void to any**
- **Found during:** Task 2 (ConnectionsSection implementation)
- **Issue:** Plan specified `validateFn: (url, token) => Promise<void>` but actual functions return typed user objects (JiraUser/GitLabUser) — TypeScript TS2322 errors
- **Fix:** Changed prop type to `Promise<any>` with eslint-disable comment
- **Files modified:** taskflow/src/routes/settings/ConnectionsSection.tsx
- **Verification:** `npx tsc --noEmit` shows 0 errors in settings files
- **Committed in:** 5d47d1c (Task 2 commit)

**2. [Rule 1 - Bug] Token input always editable, no readOnly/Edit-toggle**
- **Found during:** Task 2 test execution
- **Issue:** Plan's Edit-toggle design leaves the token input readOnly by default; the `status resets on token change` test fires onChange on the token input while not in editing mode — a readOnly input with no onChange handler cannot pass this test
- **Fix:** Simplified to always-editable password input (no Edit toggle); URL and token are both always mutable inputs
- **Files modified:** taskflow/src/routes/settings/ConnectionsSection.tsx
- **Verification:** All 9 ConnectionsSection tests pass
- **Committed in:** 5d47d1c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 — type mismatch, Rule 1 — design mismatch with test expectations)
**Impact on plan:** Both fixes necessary for TypeScript correctness and test compliance. The simpler token input design still satisfies all must_have truths.

## Issues Encountered

None beyond the deviations documented above.

## Next Phase Readiness

- Settings shell is ready to accept AppearanceSection (Plan 18-04) — import and slot already in place
- Settings shell is ready for NotificationsSection and WorkflowSection (Plan 18-05)
- ConnectionsSection is complete and fully tested
- No blockers for Plans 04/05

---
*Phase: 18-app-icon-multi-page-settings*
*Completed: 2026-03-15*
