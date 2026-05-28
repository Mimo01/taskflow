---
status: partial
phase: 72-workflow-transitions-via-greenhopper
source: [72-VERIFICATION.md]
started: 2026-05-29
updated: 2026-05-29
---

## Current Test

[awaiting human testing]

## Tests

### 1. No per-issue /rest/api/2/issue/*/transitions GET in network log during drag-to-transition
expected: Open sprint board, DevTools → Network → filter "transitions", drag an issue between columns; only one /rest/greenhopper/1.0/xboard/work/transitions.json?projectId=N per fresh project (or zero on cache hit), zero per-issue REST hits.
result: [pending]

### 2. Manual refresh toolbar action invalidates and refetches; aria-live label updates verbatim
expected: Click "Reload workflow transitions" in sprint-board toolbar; both ['gh-transitions-envelope', N] and ['jira-statuses'] queries refetch; inline aria-live span renders exactly "Workflow transitions reloaded" on success or "Failed to reload workflow" on error (verbatim from D-07).
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
