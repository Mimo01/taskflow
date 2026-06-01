---
status: resolved
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
result: passed (user approved 2026-05-29)

### 2. Manual refresh toolbar action invalidates and refetches; aria-live label updates verbatim
expected: Click "Reload workflow transitions" in sprint-board toolbar; both ['gh-transitions-envelope', N] and ['jira-statuses'] queries refetch; inline aria-live span renders exactly "Workflow transitions reloaded" on success or "Failed to reload workflow" on error (verbatim from D-07).
result: passed (user approved 2026-05-29)

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

### G-01 Sprint-board subtask cards had no transitions (resolved)

Discovered during UAT — fix committed inline as `f7732dd1`.
Root cause: `SprintBoardTab.getTransitions` read `getQueryData(['gh-transitions', projectId, issueTypeId])`, only populated for the sentinel hook's single issueTypeId. Subtask types had no per-type query registered.
Fix: new `peekGhTransitions(qc, projectId, issueTypeId)` sync helper reads envelope + status-map directly and adapts on demand.

### G-02 All workflow transitions shown regardless of current status (resolved)

Discovered during UAT — fix committed inline as `f7732dd1`.
Root cause: GH `transitions.json` envelope returns the full workflow (unlike legacy per-issue REST which server-filtered).
Fix: `fromStatusId` carried through adapter + `filterTransitionsForStatus` helper applied in `SprintBoardTab.getTransitions` and `StatusPopover`.

### G-03 Bulk + post-create flows pick by destination only (deferred)

`BulkActionBar` and `QuickCreateInput` find a transition by `tr.to.id === targetStatusId` without filtering by the issue's current status — may pick an inapplicable transition when the workflow has multiple transitions reaching the same destination from different sources. Not user-reported during UAT; tracked here for follow-up.
