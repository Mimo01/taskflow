---
phase: 02-developer-dashboard
plan: 07
subsystem: ui
tags: [react, settings, tokens, gitlab, jira, error-handling]

# Dependency graph
requires:
  - phase: 02-developer-dashboard
    provides: TokenSection with group/project selectors, listGitLabGroups, listJiraProjects
provides:
  - GitLab group selector always rendered when gitlabBaseUrl is configured, with loading/error/success states
  - Jira project selector always rendered when jiraBaseUrl is configured, with loading/error/success states
  - Inline error messages on fetch failure instead of silently hiding the selector
affects: [uat, 02-developer-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [loading/error/success tristate pattern for async selectors]

key-files:
  created: []
  modified:
    - taskflow/src/routes/settings/TokenSection.tsx

key-decisions:
  - "Selector visibility gated on baseUrl presence (not list length) — ensures selector is always reachable by user"
  - "Tristate render: loading spinner -> error message -> dropdown (mutually exclusive) — avoids showing stale dropdown during re-fetch"
  - "finally block unconditionally clears loading flag — prevents stuck spinner on early returns (e.g. missing PAT)"

patterns-established:
  - "Async list fetch: setLoading(true) + setError(null) before IIFE; try/catch/finally; error surfaced inline not swallowed"
  - "Conditional render guard: {baseUrl && <div>...{loading}...{error}...{!loading && !error && <Select>}</div>}"

requirements-completed: [DEV-02]

# Metrics
duration: 2min
completed: 2026-03-11
---

# Phase 2 Plan 07: Fix Silent Failure in TokenSection Selectors Summary

**GitLab group and Jira project selectors now unconditionally rendered when base URL is configured, with loading/error/success tristate replacing the silent `groups.length > 0` visibility guard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-11T22:00:12Z
- **Completed:** 2026-03-11T22:01:52Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced `{gitlabGroups.length > 0 && ...}` and `{jiraProjects.length > 0 && ...}` guards with `{baseUrl && ...}` unconditional rendering
- Added `jiraProjectsLoading`, `jiraProjectsError`, `gitlabGroupsLoading`, `gitlabGroupsError` state variables
- Replaced silent `catch(() => [])` failure pattern with proper try/catch/finally that surfaces error text inline
- Loading state shows "Loading groups..." / "Loading projects..." while fetch is in-flight
- Error state shows readable error message on failure (network error, CORS, bad token)
- Success state shows Select dropdown; empty list shows "No groups/projects found" placeholder
- Removed unused `SelectValue` import (TypeScript had flagged it)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add loading and error state to project/group selectors in TokenSection** - `57c0335` (fix)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `taskflow/src/routes/settings/TokenSection.tsx` - Replaced silent-failure guards with loading/error/success tristate for both GitLab group and Jira project selectors

## Decisions Made

- Selector visibility gated on `baseUrl` presence (not list length) — the selector must always be visible when the integration is configured so the user can see errors and retry
- Tristate render order: loading -> error -> Select (mutually exclusive) — prevents stale dropdown showing while a re-fetch is in progress
- `finally` block unconditionally clears loading flag — an early `return` from a missing PAT would otherwise leave loading=true forever

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `SelectValue` import**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** `SelectValue` was imported but not used in TokenSection.tsx; `npx tsc --noEmit` reported TS6133 error
- **Fix:** Removed `SelectValue` from the Select component import destructuring
- **Files modified:** taskflow/src/routes/settings/TokenSection.tsx
- **Verification:** `tsc --noEmit` reports no errors for TokenSection.tsx
- **Committed in:** 57c0335 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — unused import causing TS error)
**Impact on plan:** Minor cleanup, no scope creep. Pre-existing TS errors in MyTasksTab and onboarding steps are out of scope.

## Issues Encountered

- Pre-existing TypeScript errors in `MyTasksTab.tsx` (`onStatusClick` prop mismatch), `GitLabStep.tsx`, and `JiraStep.tsx` — all out of scope for this plan, documented for deferred attention
- Pre-existing TopBar.test.tsx failures (Tauri LazyStore mock not set up) — pre-existing, out of scope

## Next Phase Readiness

- UAT tests 6, 7, 8, 9 should now pass — the GitLab group selector is always rendered when gitlabBaseUrl is set, errors surface inline, and the dropdown appears on success
- No blockers for remaining UAT closure work

---
*Phase: 02-developer-dashboard*
*Completed: 2026-03-11*
