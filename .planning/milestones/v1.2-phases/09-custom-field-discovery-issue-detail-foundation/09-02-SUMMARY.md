---
phase: 09-custom-field-discovery-issue-detail-foundation
plan: "02"
subsystem: api
tags: [jira, custom-fields, settings-store, zustand, tanstack-query, typescript]

# Dependency graph
requires:
  - phase: 09-custom-field-discovery-issue-detail-foundation
    provides: "Plan 09-01 installed shadcn Sheet, jira2md, react-markdown deps and added test scaffolds"

provides:
  - "discoverCustomFields() — resolves epicLinkFieldKey, epicNameFieldKey, sprintFieldKey, storyPointsFieldKey from one API call"
  - "fetchIssueDetail() — GET /rest/api/2/issue/{key} with explicit fields param including dynamic custom field keys"
  - "updateIssueField() — PUT /rest/api/2/issue/{key} with Data Center-compatible body format"
  - "JiraIssueDetail and JiraIssueLink interfaces exported from jira.ts"
  - "Settings store extended with epicLinkFieldKey, epicNameFieldKey, sprintFieldKey, accountFieldKey fields and setters"
  - "useCustomFieldDiscovery hook in main.tsx that populates all four field keys into settings store at startup"

affects:
  - "09-04-PLAN.md IssueDetailSheet — reads epicLinkFieldKey, sprintFieldKey from settings store"
  - "09-05-PLAN.md and later plans — consume custom field IDs from settings store"
  - "Any component that calls fetchIssueDetail or updateIssueField"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "discoverCustomFields: schema.custom identifiers (com.pyxis.greenhopper.jira:gh-epic-link etc.) used to match fields — never hardcode IDs"
    - "fetchIssueDetail: explicit fields= query param required — Jira DC silently omits fields not listed"
    - "updateIssueField: 204 is treated as success (Jira DC returns 204 not 200 on PUT)"
    - "Data Center assignee update uses { name: username } not { accountId: ... }"

key-files:
  created: []
  modified:
    - "taskflow/src/services/jira.ts"
    - "taskflow/src/services/jira.test.ts"
    - "taskflow/src/stores/settings.store.ts"
    - "taskflow/src/main.tsx"

key-decisions:
  - "discoverStoryPointsField removed — fully superseded by discoverCustomFields which handles all four fields"
  - "accountFieldKey added to settings store as string | null (null default) — reserved for Phase 11 without blocking current work"
  - "fetchIssueDetail accepts epicNameFieldKey separately from research code example — included in explicit fields list per Pitfall 1"

patterns-established:
  - "Pattern: All custom field IDs stored in settings store — never call discovery per-issue"
  - "Pattern: TDD for jira.ts service functions — RED (failing tests) then GREEN (implementation)"

requirements-completed: [ISSUE-03]

# Metrics
duration: 10min
completed: 2026-03-13
---

# Phase 9 Plan 02: Custom Field Discovery Infrastructure Summary

**discoverCustomFields() replaces discoverStoryPointsField() resolving all four instance-specific field IDs (epic link, epic name, sprint, story points) from one API call; settings store, main.tsx, and jira.ts updated**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-13T22:35:00Z
- **Completed:** 2026-03-13T22:41:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `discoverCustomFields()`, `fetchIssueDetail()`, `updateIssueField()`, `JiraIssueDetail`, `JiraIssueLink` to jira.ts with 10 new tests (TDD)
- Extended settings store with epicLinkFieldKey, epicNameFieldKey, sprintFieldKey, accountFieldKey fields and their setters
- Replaced `useStoryPointsFieldDiscovery` hook in main.tsx with `useCustomFieldDiscovery` that populates all four field keys
- Removed dead code: `discoverStoryPointsField` from jira.ts and its old test suite (tests updated to use discoverCustomFields)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add discoverCustomFields, fetchIssueDetail, updateIssueField to jira.ts** - `03286e9` (feat + test, TDD)
2. **Task 2: Extend settings store + update main.tsx discovery hook** - `af541cf` (feat)

_Note: Task 1 used TDD — RED (10 failing tests added) then GREEN (implementation). No separate refactor commit needed._

## Files Created/Modified

- `taskflow/src/services/jira.ts` — Added discoverCustomFields, fetchIssueDetail, updateIssueField, JiraIssueDetail, JiraIssueLink; removed discoverStoryPointsField
- `taskflow/src/services/jira.test.ts` — Added 10 tests for new functions; updated APIF-03 describe block to use discoverCustomFields
- `taskflow/src/stores/settings.store.ts` — Added epicLinkFieldKey, epicNameFieldKey, sprintFieldKey, accountFieldKey with defaults and setters
- `taskflow/src/main.tsx` — Replaced useStoryPointsFieldDiscovery with useCustomFieldDiscovery; updated import

## Decisions Made

- `discoverStoryPointsField` removed immediately (not kept as deprecated) — no callers outside tests; test suite updated to use discoverCustomFields equivalents
- `accountFieldKey: string | null` added to settings store with `null` default — Phase 11 will populate it; does not require discovery logic in this plan
- `fetchIssueDetail` includes `epicNameFieldKey` in the explicit fields list (research code example omitted it; Pitfall 1 requires explicit listing)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated APIF-03 tests from discoverStoryPointsField to discoverCustomFields**
- **Found during:** Task 2 (after removing discoverStoryPointsField)
- **Issue:** jira.test.ts had 4 tests that imported and called `discoverStoryPointsField` — removing the function would break those tests
- **Fix:** Replaced the APIF-03 describe block tests to use `discoverCustomFields` equivalents that test the same storyPointsFieldKey resolution behavior
- **Files modified:** `taskflow/src/services/jira.test.ts`
- **Verification:** All 54 jira.test.ts tests pass
- **Committed in:** af541cf (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug: broken test import after function removal)
**Impact on plan:** Required fix — removing discoverStoryPointsField without updating its tests would have broken the test suite. No scope creep.

## Issues Encountered

- Pre-existing test failures found in SubtasksPanel.test.tsx (4 tests), MyTasksTab.test.tsx (1 test), ReleasesTab.test.tsx (1 test). All are in Phase 8 UI components unrelated to 09-02 changes. Documented in `deferred-items.md` per scope boundary rule.

## Next Phase Readiness

- All custom field IDs available from settings store — 09-04 IssueDetailSheet can read epicLinkFieldKey, sprintFieldKey, storyPointsFieldKey directly
- `fetchIssueDetail` and `updateIssueField` ready for use in IssueDetailSheet and IssueDetailSidebar
- 6 pre-existing test failures (Phase 8 UI) remain unresolved — does not block Phase 9 plan execution

---
*Phase: 09-custom-field-discovery-issue-detail-foundation*
*Completed: 2026-03-13*
