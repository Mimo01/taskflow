---
phase: 02-developer-dashboard
plan: 01
subsystem: api
tags: [jira, gitlab, zustand, typescript, vitest, tdd, link-engine]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "jira.ts and gitlab.ts with PAT validation, auth.store.ts, settings.store.ts base, vi.stubGlobal fetch mocking pattern"
provides:
  - "JiraIssue, JiraTransition types + fetchSprintIssues, fetchTransitions, postTransition, postComment in jira.ts"
  - "GitLabMR, MRCommit, MRApprovals, DiscussionNote, Discussion types + fetchAssignedMRs, fetchReviewerMRs, fetchMRCommits, fetchMRApprovals, fetchMRDiscussions in gitlab.ts"
  - "linkEngine.ts with extractTicketKeys (word-boundary regex), linkMRToTask, linkMRToTaskViaCommits, deriveReviewHealth, isStale"
  - "dashboard.store.ts ephemeral store (activeTab: 'my-tasks')"
  - "settings.store.ts extended with staleMrThresholdDays: 3"
affects:
  - 02-02
  - 02-03
  - 02-04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plain fetch() (not tauri-plugin-http) — linter enforces this; vi.stubGlobal('fetch', ...) in tests"
    - "Pure functions in linkEngine.ts — no fetch, accepts pre-fetched data"
    - "Negative lookbehind in ticket key regex: (?<![A-Za-z0-9-])\\b([A-Z][A-Z0-9]+-\\d+)\\b"
    - "Ephemeral vs persisted Zustand stores — dashboard store ephemeral, settings store persisted"

key-files:
  created:
    - taskflow/src/services/linkEngine.ts
    - taskflow/src/services/linkEngine.test.ts
    - taskflow/src/stores/dashboard.store.ts
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira.test.ts
    - taskflow/src/services/gitlab.ts
    - taskflow/src/services/gitlab.test.ts
    - taskflow/src/stores/settings.store.ts

key-decisions:
  - "Plain fetch() confirmed as project pattern (linter enforced) — vi.stubGlobal works for mocking; @tauri-apps/plugin-http import was in plan spec but linter actively reverted it"
  - "Negative lookbehind in ticket key regex: (?<![A-Za-z0-9-]) prevents PREFIX-FEAT-1 from matching FEAT-1; simple \\b was insufficient"
  - "linkMRToTaskViaCommits accepts mr parameter for API consistency even though title is not scanned — void mr suppresses TS warning"

patterns-established:
  - "Service layer: all fetch calls wrap in try/catch for network errors, check specific HTTP status codes, return typed data"
  - "TDD with vi.stubGlobal('fetch', ...): set mock per test in describe block, vi.restoreAllMocks() in beforeEach"
  - "Pure business logic in linkEngine.ts: functions accept pre-fetched data, no side effects, easily unit-tested without mocks"

requirements-completed: [DEV-01, DEV-02, DEV-03, DEV-04, DEV-05, LINK-01, LINK-02, UI-02, UI-03]

# Metrics
duration: 9min
completed: 2026-03-11
---

# Phase 2 Plan 01: Service Layer and Link Engine Summary

**Jira and GitLab Phase 2 API functions, pure link engine with word-boundary ticket key regex, ephemeral dashboard store, and staleMrThresholdDays setting — 65 tests passing**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-11T13:38:29Z
- **Completed:** 2026-03-11T13:47:48Z
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- Extended jira.ts with 4 new functions (fetchSprintIssues, fetchTransitions, postTransition, postComment) + JiraIssue, JiraTransition types
- Extended gitlab.ts with 5 new functions (fetchAssignedMRs, fetchReviewerMRs, fetchMRCommits, fetchMRApprovals, fetchMRDiscussions) + 5 new types
- Created linkEngine.ts with 5 pure functions including word-boundary regex with negative lookbehind to prevent false matches in compound identifiers
- Created dashboard.store.ts (ephemeral Zustand, activeTab: 'my-tasks') and extended settings.store.ts with staleMrThresholdDays: 3

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for Jira/GitLab functions** - `1691a58` (test)
2. **Task 1 GREEN: Extend Jira and GitLab service layers** - `64f62ce` (feat)
3. **Task 2 RED: Failing tests for linkEngine** - `4e2b909` (test)
4. **Task 2 GREEN: Create linkEngine, dashboard store, extend settings store** - `b8806b6` (feat)

_Note: TDD tasks have separate test (RED) and feat (GREEN) commits per each task_

## Files Created/Modified

- `/Users/mimo/Desktop/Tasker/taskflow/src/services/jira.ts` - Added JiraIssue, JiraTransition types + 4 async functions
- `/Users/mimo/Desktop/Tasker/taskflow/src/services/jira.test.ts` - Added 14 new tests for Phase 2 Jira functions
- `/Users/mimo/Desktop/Tasker/taskflow/src/services/gitlab.ts` - Added 5 GitLab types + 5 async functions
- `/Users/mimo/Desktop/Tasker/taskflow/src/services/gitlab.test.ts` - Added 6 new tests for Phase 2 GitLab functions
- `/Users/mimo/Desktop/Tasker/taskflow/src/services/linkEngine.ts` - Created: pure link engine, 5 exported functions
- `/Users/mimo/Desktop/Tasker/taskflow/src/services/linkEngine.test.ts` - Created: 18 tests, all passing
- `/Users/mimo/Desktop/Tasker/taskflow/src/stores/dashboard.store.ts` - Created: ephemeral store with DashTab type
- `/Users/mimo/Desktop/Tasker/taskflow/src/stores/settings.store.ts` - Added staleMrThresholdDays: 3 + setStaleMrThresholdDays

## Decisions Made

- **Plain fetch() is the enforced pattern**: The plan specified `import { fetch } from '@tauri-apps/plugin-http'` but the project's linter actively reverts service files to plain `fetch()`. Both the existing Phase 1 services and all new Phase 2 functions use global `fetch()`. Tests use `vi.stubGlobal('fetch', ...)`.
- **Negative lookbehind in ticket regex**: `\b([A-Z][A-Z0-9]+-\d+)\b` was insufficient — `PREFIX-FEAT-1` matched `FEAT-1` because `-` is not a word character so `\b` fires between `-` and `F`. Added `(?<![A-Za-z0-9-])` lookbehind to fix.
- **`linkMRToTaskViaCommits` receives `mr` parameter**: Kept for API consistency with `linkMRToTask`; used `void mr` to suppress TypeScript unused variable warning.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ticket key regex to prevent false matches in compound identifiers**
- **Found during:** Task 2 (linkEngine.test.ts: word boundary test failing)
- **Issue:** `\b([A-Z][A-Z0-9]+-\d+)\b` matched `FEAT-1` inside `PREFIX-FEAT-1` because `-` creates a word boundary
- **Fix:** Added negative lookbehind `(?<![A-Za-z0-9-])` before the word boundary — `PREFIX-FEAT-1` no longer yields `FEAT-1`
- **Files modified:** `taskflow/src/services/linkEngine.ts`
- **Verification:** All 18 linkEngine tests pass including the word boundary check
- **Committed in:** `b8806b6` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] Used plain fetch() instead of @tauri-apps/plugin-http fetch**
- **Found during:** Task 1 (linter reverted service files during git stash check)
- **Issue:** Plan specified `import { fetch } from '@tauri-apps/plugin-http'` but the project linter enforces plain `fetch()` globally in all service files
- **Fix:** Followed linter-enforced pattern (plain fetch, vi.stubGlobal for tests) — this matches the existing Phase 1 services that were also reverted to plain fetch
- **Files modified:** `jira.ts`, `gitlab.ts`, all test files
- **Verification:** 65/65 tests pass; linter does not revert the new code
- **Committed in:** `64f62ce` (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bug fixes)
**Impact on plan:** Both fixes essential for correctness. No scope creep. All must-have truths and artifacts satisfied.

## Issues Encountered

- Git stash check during pre-existing TS error investigation caused the linter to rewrite jira.ts, gitlab.ts, and test files to its enforced pattern — had to restart the RED phase with the correct mock pattern (`vi.stubGlobal` instead of `vi.mock('@tauri-apps/plugin-http')`)
- Pre-existing TypeScript errors in `OnboardingWizard.tsx`, `GitLabStep.tsx`, `JiraStep.tsx`, `TokenSection.tsx`, `stronghold.ts` — all out of scope for this plan, logged to deferred items

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All typed interfaces and service functions are in place — Plans 02, 03, 04 can import from jira.ts, gitlab.ts, linkEngine.ts without guessing at shapes
- dashboard.store.ts ready for tab-switching UI in Plans 02 and 03
- settings.store.ts provides staleMrThresholdDays for isStale() calls in Plan 04
- 65 tests passing, no regressions from Phase 1

---
*Phase: 02-developer-dashboard*
*Completed: 2026-03-11*
