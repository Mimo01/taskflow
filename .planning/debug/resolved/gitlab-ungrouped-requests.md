---
status: resolved
trigger: "Investigate why many GitLab requests appear ungrouped in the Operations tab"
created: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:00:00Z
---

## Current Focus

hypothesis: Multiple apiFetch('gitlab', ...) calls are missing the 4th operation label parameter
test: Audit every apiFetch('gitlab', ...) call across the codebase
expecting: Calls without 4th param go to ungrouped bucket
next_action: Report findings

## Symptoms

expected: All GitLab requests grouped under operation labels in Operations tab
actual: Many GitLab requests appear in the "Ungrouped Requests" section
errors: none
reproduction: Enable dev tools + operation profiling, trigger any GitLab-related action
started: Phase 29 added operation labels but missed some calls

## Eliminated

(none needed - root cause found on first pass)

## Evidence

- timestamp: 2026-03-20
  checked: operation-profiler.store.ts addFetch logic
  found: When label is undefined, fetch goes straight to ungrouped array (line 62-64)
  implication: Any apiFetch call without 4th param = ungrouped

- timestamp: 2026-03-20
  checked: All apiFetch('gitlab', ...) calls across codebase
  found: 3 calls in notifications.ts missing operation labels, 0 in IssueDetailSidebar (has label)
  implication: notifications.ts is the source of ungrouped GitLab requests

## Resolution

root_cause: Three apiFetch('gitlab', ...) calls in notifications.ts (lines 517, 521-525, 526-530) are missing the 4th operation label parameter. Every time notifications poll, these 1-3 requests per MR go to ungrouped.
fix: Add operation labels to all three calls
verification: pending
files_changed: [taskflow/src/services/notifications.ts]
