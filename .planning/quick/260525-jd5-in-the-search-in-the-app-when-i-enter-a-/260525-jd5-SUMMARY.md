---
phase: quick-260525-jd5
plan: "01"
subsystem: command-palette
tags: [search, jira, key-resolution, bare-number]
dependency_graph:
  requires: []
  provides: [bare-number-key-resolution]
  affects: [CommandPalette]
tech_stack:
  added: []
  patterns: [derived-key-resolution, tdd]
key_files:
  created: []
  modified:
    - taskflow/src/components/app/CommandPalette.tsx
    - taskflow/src/components/app/CommandPalette.test.tsx
decisions:
  - "resolvedKeyLookup derived after useAuthStore destructure to avoid TDZ ReferenceError"
  - "enabled gate uses resolvedKeyLookup.length > 0 combined with existing query.length >= 2 check — single-digit bare numbers (e.g. '5') still excluded"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-25T12:02:45Z"
  tasks_completed: 1
  files_modified: 2
---

# Phase quick-260525-jd5 Plan 01: Bare-number key resolution in CommandPalette Summary

**One-liner:** Bare-number queries (e.g. "12345") are now prefixed with `activeJiraProject` to resolve `PROJ-12345` as a Direct Match in the command palette.

## What Was Built

In `CommandPalette.tsx`, replaced the `isJiraKeyQuery` boolean gate with a derived `resolvedKeyLookup` string:

- If the trimmed query already matches a full Jira key pattern (`/^[A-Za-z]+-\d+$/`), `resolvedKeyLookup` equals the trimmed query unchanged.
- If the trimmed query is all digits (`/^\d+$/`) and `activeJiraProject` is set, `resolvedKeyLookup` becomes `${activeJiraProject}-${trimmed}`.
- Otherwise `resolvedKeyLookup` is an empty string and no direct-key fetch fires.

The direct-key lookup `useQuery` now uses `resolvedKeyLookup` as its queryKey discriminator and passes it to `fetchJiraIssueByKey` instead of `query.trim()`. The `enabled` condition gates on `resolvedKeyLookup.length > 0` (plus existing `query.length >= 2`, `!!jiraBaseUrl`, `!!activeJiraProject` guards).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Resolve bare numbers to active-project keys in direct lookup | 5556fddb | CommandPalette.tsx, CommandPalette.test.tsx |

## Verification

- `npx vitest run src/components/app/CommandPalette.test.tsx`: 17/17 passed
- `npx tsc --noEmit`: no errors
- New tests added:
  - "shows Direct Match for bare number with active project set" — asserts `fetchJiraIssueByKey` called with `TEST-12345` when query is `12345`
  - "full key query still resolves correctly" — asserts `PROJ-42` passthrough unchanged
  - Pre-existing "does not fire key fetch for non-key query" (`fix login`) still passes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `resolvedKeyLookup` placed before `useAuthStore` destructure caused TDZ ReferenceError**
- **Found during:** Task 1 (GREEN phase, first test run)
- **Issue:** `resolvedKeyLookup` initially placed before `useAuthStore` call, causing `Cannot access 'activeJiraProject' before initialization` (temporal dead zone)
- **Fix:** Moved `trimmed` and `resolvedKeyLookup` derivation to after the `useAuthStore` destructure
- **Files modified:** `CommandPalette.tsx`
- **Commit:** 5556fddb (same commit — caught before final commit)

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. The existing `fetchJiraIssueByKey` call is already guarded by `!!jiraBaseUrl && !!activeJiraProject`.

## Self-Check: PASSED

- [x] `taskflow/src/components/app/CommandPalette.tsx` — exists and modified
- [x] `taskflow/src/components/app/CommandPalette.test.tsx` — exists and modified
- [x] Commit `5556fddb` exists in git log
