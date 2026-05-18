---
phase: quick-260518-jqh
plan: "01"
subsystem: jira-issue-detail
tags: [react, jira, vitest, typescript, tdd]

dependency_graph:
  requires:
    - taskflow/src/services/jira.ts (legacy barrel — actual runtime import path)
    - taskflow/src/services/jira/issues.ts (modular copy)
    - taskflow/src/services/jira/types.ts (modular copy)
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  provides:
    - Priority icon rendered next to name in issue detail sidebar
    - Severity MetaRow conditionally shown from customfield_13415
    - customfield_13415 requested in both legacy jira.ts and modular jira/issues.ts
  affects:
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira/issues.ts
    - taskflow/src/services/jira/types.ts
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/services/jira/issues.test.ts
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx

tech_stack:
  added: []
  patterns:
    - extractSeverity pure helper exported from FieldsSection for testability
    - TDD RED/GREEN cycle for both service and component layers
    - data-testid=priority-icon to distinguish priority img from CachedAvatar role=img elements

key_files:
  created:
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx
  modified:
    - taskflow/src/services/jira.ts (legacy barrel — where IssueDetailSheet actually imports from)
    - taskflow/src/services/jira/issues.ts
    - taskflow/src/services/jira/types.ts
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/services/jira/issues.test.ts

decisions:
  - Added customfield_13415 as hardcoded field in fetchIssueDetail (not via customFields arg) — severity is a stable known field for this project per D-260518-joj
  - Used data-testid=priority-icon on the priority icon img because CachedAvatar renders role=img divs that conflict with getByRole('img')
  - Cast f.customfield_13415 to its known type shape in FieldsSection to resolve TypeScript index-signature conflict
  - IssueDetailSheet imports from legacy jira.ts barrel (not jira/issues.ts) — both files required the same additions; plan only specified modular files

metrics:
  duration: "~30 minutes"
  completed: "2026-05-18T12:47:00Z"
---

# Phase quick-260518-jqh Plan 01: Jira Issue Detail Priority Icon + Severity Row Summary

**One-liner:** Priority icon img and conditional Severity MetaRow added to issue detail sidebar by updating both the legacy `jira.ts` barrel and the modular `jira/issues.ts` + `jira/types.ts` to request and type `customfield_13415`.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 (RED) | Failing tests: fetchIssueDetail URL contains customfield_13415 | 0d32af8 | done |
| 1 (GREEN) | Add customfield_13415 to modular fetchIssueDetail + JiraIssueDetail type | f2c9602 | done |
| 2 (RED) | Failing tests: priority icon img + Severity MetaRow render behavior | 37d9a4f | done |
| 2 (GREEN) | Implement extractSeverity, priority icon, Severity MetaRow in FieldsSection | 19d059c | done |
| fix | Add customfield_13415 to legacy jira.ts (actual runtime import path) | b4ec3e7 | done |
| 3 | Human verification — approved | — | done |

## What Was Built

**Task 1 — fetchIssueDetail + type (modular files):**
- `fetchIssueDetail` in `jira/issues.ts` now includes `'customfield_13415'` in the hardcoded fields array.
- `JiraIssueDetail.fields` in `jira/types.ts` now declares `customfield_13415?: { value?: string; name?: string } | null` before the index signature, matching the shape already on `JiraIssue.fields`.
- 2 new tests added to `issues.test.ts` — both pass.

**Fix b4ec3e7 — legacy jira.ts (applied by user after verification):**
- `IssueDetailSheet` and all issue detail components import `fetchIssueDetail` and `JiraIssueDetail` from the legacy `jira.ts` barrel, not from `jira/issues.ts`. The same two additions were applied there: `'customfield_13415'` added to the fields array, and `customfield_13415?: { value?: string; name?: string } | null` added to `JiraIssueDetail.fields`.

**Task 2 — FieldsSection UI:**
- `extractSeverity(field)` pure helper exported from `FieldsSection.tsx` — returns `field?.value ?? field?.name ?? null`. Tested directly with 6 unit tests.
- Priority display-mode button wraps content in `<div className="flex items-center gap-1.5">` with a conditional `<img data-testid="priority-icon" src={iconUrl} alt="" className="w-3.5 h-3.5 shrink-0" />` before the name span.
- Severity MetaRow rendered immediately after Priority MetaRow, conditionally: `{severityValue ? <MetaRow label="Severity">{severityValue}</MetaRow> : null}`.
- 12 tests pass in new `FieldsSection.test.tsx` (6 helper tests + 6 render tests).

## Deviations from Plan

**1. [Rule 1 - Bug] Legacy jira.ts was the actual runtime import path — modular files alone were insufficient**
- **Found during:** Task 3 human verification
- **Issue:** The plan specified `jira/issues.ts` and `jira/types.ts`, but `IssueDetailSheet` imports from `@/services/jira` which resolves to the legacy `jira.ts` barrel. Without updating `jira.ts`, the runtime HTTP request was still missing `customfield_13415` and the type was unknown.
- **Fix:** User applied commit b4ec3e7 — identical additions to `jira.ts` (`'customfield_13415'` in fields array + typed property on `JiraIssueDetail.fields`).
- **Files modified:** `taskflow/src/services/jira.ts`
- **Commit:** b4ec3e7

**2. [Rule 1 - Bug] TypeScript error on f.customfield_13415 in JSX**
- **Found during:** Task 2 GREEN — tsc reported error TS2345
- **Issue:** `JiraIssueDetail.fields` has `[key: string]: unknown` index signature which TypeScript resolves over the named property when accessed via `f.customfield_13415` inside JSX, widening the type to `unknown`.
- **Fix:** Added explicit cast `const severityField = f.customfield_13415 as { value?: string; name?: string } | null | undefined` before passing to `extractSeverity`.
- **Files modified:** `FieldsSection.tsx`
- **Commit:** 19d059c

**3. [Rule 3 - Blocking] node_modules symlink needed in worktree**
- **Found during:** Task 1 test run — `sh: vitest: command not found`
- **Fix:** Created symlink `taskflow/node_modules -> /Users/mimo/Documents/Projects/taskflow/taskflow/node_modules` (same pattern as 260518-jbe).

**4. [Rule 1 - Bug] CachedAvatar role=img conflict in priority icon test**
- **Found during:** Task 2 test run — `getByRole('img')` matched CachedAvatar initials divs (role=img) in addition to the priority `<img>`.
- **Fix:** Added `data-testid="priority-icon"` to the img in FieldsSection; updated test to use `getByTestId`.
- **Commit:** 19d059c

## Pre-existing Issues (out of scope)

- `fetchJiraIssueByKey > calls the correct URL with required fields` test in `issues.test.ts` was already failing before this task — the URL had been updated in a prior quick task to include `reporter,priority,customfield_13415`, but the test still asserts the old shorter URL. Not introduced by this task.

## Known Stubs

None — severity and priority icon data flows from the real Jira API response.

## TDD Gate Compliance

- RED gate (test commits): 0d32af8 (service), 37d9a4f (component)
- GREEN gate (feat commits): f2c9602 (service), 19d059c (component)
- REFACTOR gate: Not needed

## Self-Check

Files created/modified:
- [x] `taskflow/src/services/jira.ts` — `customfield_13415` in fields array + typed on `JiraIssueDetail.fields` (b4ec3e7)
- [x] `taskflow/src/services/jira/issues.ts` — `customfield_13415` in fields array (f2c9602)
- [x] `taskflow/src/services/jira/types.ts` — `customfield_13415` typed on `JiraIssueDetail.fields` (f2c9602)
- [x] `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` — `extractSeverity`, priority icon, Severity MetaRow (19d059c)
- [x] `taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx` — created, 12 tests (19d059c)
- [x] `taskflow/src/services/jira/issues.test.ts` — 2 new tests (0d32af8, f2c9602)

Commits:
- [x] 0d32af8 — test RED service
- [x] f2c9602 — feat GREEN service
- [x] 37d9a4f — test RED component
- [x] 19d059c — feat GREEN component
- [x] b4ec3e7 — fix legacy jira.ts

## Self-Check: PASSED
