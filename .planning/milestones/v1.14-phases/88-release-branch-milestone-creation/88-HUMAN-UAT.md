---
status: partial
phase: 88-release-branch-milestone-creation
source: [88-VERIFICATION.md, 88-11-SUMMARY.md]
started: 2026-08-10T22:25:00Z
updated: 2026-08-10T22:25:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live create-branch against a real GitLab project (RELBR-04)
expected: Branch is created at the correct ref (the project's fetched `default_branch`, not a hardcoded name); the sidebar flips from "missing" to "exists" after invalidation; a 403 (protected-branch rule or missing `api` scope) surfaces GitLab's actionable message text inside the dialog.
why_human: 88-11 Task 2 was waived at the wave-4 checkpoint. No `createBranch` call has executed against a real GitLab instance — coverage is mocked-fetch unit tests only.
result: [pending]

### 2. Live create-milestone + Releases-list propagation (RELMS-02)
expected: Milestone is created with the correct title and `due_date`; both the detail sidebar and the Releases list reflect it after navigating back without a manual refresh (the project-granular invalidation fix should make the list update within normal cache staleness).
why_human: 88-11 Task 3 was waived. The CR-02 invalidation fix is verified by code reading and unit test, but cross-view propagation against a real GitLab response has never been observed.
result: [pending]

### 3. Restricted-PAT error surfacing in both create dialogs
expected: A 401/403 from a scope-restricted PAT renders GitLab's explanatory message body, not a generic failure string; an object-shaped `message` body (GitLab's Grape validation-error shape, e.g. duplicate-title rejection) does not render as the literal string `[object Object]`.
why_human: 88-11 Task 4 was waived — no second scope-restricted PAT was tested. WR-01 (`gitlab.ts`) is confirmed still open at HEAD: the response-body cast flattens only `string` and `string[]` shapes, not GitLab's object-keyed validation-error shape. This item has a known code-level gap, not just missing evidence.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
