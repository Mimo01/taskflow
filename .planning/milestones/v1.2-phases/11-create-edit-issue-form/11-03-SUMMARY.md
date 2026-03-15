---
phase: 11-create-edit-issue-form
plan: "03"
subsystem: ui
tags: [react, tdd, typescript, issue-links, search, debounce, createIssueLink, fetchIssueLinkTypes]

# Dependency graph
requires:
  - phase: 11-create-edit-issue-form
    plan: "01"
    provides: "fetchIssueLinkTypes(), createIssueLink(), searchJira(), IssueLinkType interface"
  - phase: 11-create-edit-issue-form
    plan: "02"
    provides: "CreateEditIssueModal.tsx with issue links placeholder section, linkRows stub"

provides:
  - "IssueLinkRow.tsx: compact link row with link type Select (dynamic from fetchIssueLinkTypes) + debounced issue search (searchJira, 300ms) + remove button"
  - "IssueLinkRowValue interface exported from IssueLinkRow.tsx"
  - "CreateEditIssueModal.tsx: updated with useQuery(['jira-link-types']), Add link button, rendered IssueLinkRow list, post-create/edit createIssueLink calls per row"

affects:
  - 11-04 (wiring modal entry points in Sidebar and IssueDetailContent — now includes link row functionality)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IssueLinkRow: debounced type-to-search via useDebounce hook + useQuery(['jira-search', ...debouncedQuery])"
    - "createIssueLink called in for..of loop after createIssue()/bulkUpdateIssue() resolves — per-link errors caught silently (console.error only)"
    - "crypto.randomUUID?.() with fallback for test environments where crypto.randomUUID is unavailable"

key-files:
  created:
    - taskflow/src/routes/dashboard/IssueLinkRow.tsx
    - taskflow/src/routes/dashboard/IssueLinkRow.test.tsx
  modified:
    - taskflow/src/routes/dashboard/CreateEditIssueModal.tsx
    - taskflow/src/routes/dashboard/CreateEditIssueModal.test.tsx

key-decisions:
  - "IssueLinkRow uses internal debouncedQuery state (setState after 300ms) rather than passing debounced value to useQuery enabled flag — avoids debounce + useQuery interaction issues"
  - "crypto.randomUUID?.() with Date.now() fallback — crypto.randomUUID not available in vitest jsdom environment"
  - "Add link button disabled while linkTypesLoading — prevents adding rows before link types are known"
  - "Per-link createIssueLink failures are silent (console.error) — individual link errors do not fail the overall issue create/update"
  - "searchJira signature takes 4 args (baseUrl, token, projectKey, query) — plan spec showed 3 args; actual implementation includes projectKey"

patterns-established:
  - "Pattern: IssueLinkRow search dropdown — absolute-positioned div below input, mouseDown handler (not click) to prevent onBlur closing before selection"
  - "Pattern: post-mutation link creation — for..of after main mutation resolves, try/catch per link, silent on error"

requirements-completed: [CREATE-04]

# Metrics
duration: 7min
completed: 2026-03-14
---

# Phase 11 Plan 03: IssueLinkRow and Issue Links Wiring Summary

**IssueLinkRow component with dynamic link type discovery, 300ms debounced issue search, and post-create/edit createIssueLink API calls wired into CreateEditIssueModal**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-14T13:12:59Z
- **Completed:** 2026-03-14T13:20:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created IssueLinkRow.tsx with Select (link types from prop, display outward label), debounced issue search input (searchJira(), 300ms), absolute-positioned results dropdown, and remove (X) button in compact horizontal layout
- Exported IssueLinkRowValue interface (id: string, linkTypeId: string, issueKey: string)
- Updated CreateEditIssueModal with useQuery(['jira-link-types']) calling fetchIssueLinkTypes(), "Add link" button (disabled during loading), IssueLinkRow map with onChange/onRemove handlers, and post-mutation createIssueLink calls per row for both create and edit mode
- All 72 tests pass (9 new: 6 IssueLinkRow + 3 CREATE-04); 5 existing todos

## Task Commits

Each task was committed atomically:

1. **Task 1: IssueLinkRow component** - `afd804e` (feat)
2. **Task 2: Wire issue links into CreateEditIssueModal** - `9627ae0` (feat)

## Files Created/Modified

- `taskflow/src/routes/dashboard/IssueLinkRow.tsx` — IssueLinkRow component and IssueLinkRowValue interface
- `taskflow/src/routes/dashboard/IssueLinkRow.test.tsx` — 6 TDD tests (type dropdown, search input, remove button, dropdown results, onChange)
- `taskflow/src/routes/dashboard/CreateEditIssueModal.tsx` — Added link types query, IssueLinkRow rendering, post-mutation link creation
- `taskflow/src/routes/dashboard/CreateEditIssueModal.test.tsx` — Upgraded CREATE-04 stubs to 3 real passing tests

## Decisions Made

- `crypto.randomUUID?.()` with `Date.now()+Math.random()` fallback — jsdom test environment doesn't expose `crypto.randomUUID`
- Add link button disabled while `linkTypesLoading` — ensures link type options are populated before a row is added
- `searchJira` takes 4 args (baseUrl, token, projectKey, query) — plan spec listed 3 args but actual implementation in jira.ts includes projectKey; used the correct 4-arg signature
- mouseDown handler for issue selection (not click) — prevents input onBlur from closing the dropdown before the click registers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] crypto.randomUUID unavailable in vitest jsdom environment**
- **Found during:** Task 2 (Wire issue links into CreateEditIssueModal)
- **Issue:** `crypto.randomUUID is not a function` error in tests — jsdom does not expose `crypto.randomUUID`
- **Fix:** Changed `crypto.randomUUID()` to `crypto.randomUUID?.() ?? \`link-${Date.now()}-${Math.random()}\``
- **Files modified:** taskflow/src/routes/dashboard/CreateEditIssueModal.tsx
- **Verification:** Tests pass; production Tauri webview has crypto.randomUUID available
- **Committed in:** 9627ae0 (Task 2 commit)

**2. [Rule 1 - Bug] TDD fake timer + useQuery incompatibility**
- **Found during:** Task 1 (IssueLinkRow component)
- **Issue:** Tests using `vi.useFakeTimers()` with `vi.advanceTimersByTime(350)` caused useQuery to hang (never resolves) — fake timers block React Query's internal scheduling
- **Fix:** Removed fake timers from async tests; used `waitFor({ timeout: 2000 })` with real timers — debounce resolves naturally within 350ms + query execution
- **Files modified:** taskflow/src/routes/dashboard/IssueLinkRow.test.tsx
- **Verification:** All 6 IssueLinkRow tests pass
- **Committed in:** afd804e (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Both fixes necessary for test correctness. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in JiraStep.tsx, JiraStep.test.tsx, jira.ts, jira.test.ts — confirmed unrelated to Phase 11 changes; out-of-scope
- Pre-existing test errors in jira.test.ts (4 suite-level errors from zustand localStorage mock) — pre-existing; 69 tests still pass

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- IssueLinkRow.tsx exported with IssueLinkRowValue interface — ready for any future reuse
- CreateEditIssueModal now fully implements CREATE-04: link rows with dynamic types, issue search, post-create/edit link API calls
- Plan 11-04 can wire modal to Sidebar nav button and IssueDetailContent "Edit" button without changes to link row logic

---
*Phase: 11-create-edit-issue-form*
*Completed: 2026-03-14*
