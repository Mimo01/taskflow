---
status: resolved
trigger: "workload-tab-dropdown-loading — after workload-tab-person-filter fix, expandable rows (dropdowns) in Workload tab are not loading correctly"
created: 2026-03-13T00:00:00Z
updated: 2026-03-13T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED.
test: All 23 tests pass after fix.
expecting: User opens Workload tab, clicks a person — assigned stories are visible immediately (before worklogs load). After worklogs load, subtasks and time totals populate.
next_action: human verification

## Symptoms

expected: Clicking a person's row in the Workload tab expands to show their stories/subtasks (the ones where they logged time).
actual: The dropdown either doesn't load at all (worklogMap still loading), or doesn't show all the expected data (stories with no worklogs missing from drill-down).
errors: Unknown — user hasn't reported console errors yet.
reproduction: Open Workload tab, click on a person to expand their row.
started: After the workload-tab-person-filter fix was applied.

## Eliminated

- hypothesis: The worklog query key is unstable (new array each render causing refetch loops)
  evidence: sprintIssues.map().join() produces a stable string; TanStack serializes keys; query is stable
  timestamp: 2026-03-13T00:00:00Z

- hypothesis: The worklogMap query never becomes enabled (token/URL race condition)
  evidence: Both queries share the same token/URL requirements; sprint query fires first; worklog query enables once sprint data arrives. Logic is correct.
  timestamp: 2026-03-13T00:00:00Z

- hypothesis: Subtask time is double-counted
  evidence: Story loop adds story-level timetracking; subtask loop adds subtask-level timetracking. No overlap.
  timestamp: 2026-03-13T00:00:00Z

## Evidence

- timestamp: 2026-03-13T00:00:00Z
  checked: WorkloadTab.tsx useMemo — two-pass structure (working tree, post-person-filter-fix)
  found: |
    The workload-tab-person-filter fix moved ALL story attribution (stories[]) into Pass 2, which is
    gated by `if (worklogMap)`. This meant:
    1. While worklogMap is still loading (async, fires after sprint data arrives), all
       expandable rows show stories: [] — empty dropdowns.
    2. Stories with zero worklogs (e.g., assigned but not started) never appear in anyone's
       drill-down, even after worklogMap loads.
    The prior fix also added a test "does not show stories in drill-down when nobody has worklogs"
    that encoded this broken behavior as the expected behavior, masking the regression in the test suite.
  implication: |
    Two bugs from the over-correction:
    1. UX regression: dropdown empty while worklogs load (was instant in the old code)
    2. Data regression: stories with no worklogs disappear from the assignee's drill-down

- timestamp: 2026-03-13T00:00:00Z
  checked: What the correct model should be
  found: |
    - stories[] in drill-down = assignment-based (all your assigned stories, immediate, no async wait)
    - subtasks within each story = worklog-filtered (show only subtasks YOU logged time on)
    - time totals on summary row = worklog-based (time you actually logged)
    - worklog-only authors = appear via Pass 2 worklog attribution (correct from prior fix)
  implication: Pass 1 should build stories[] from assignment. Pass 2 overlays subtasks + time totals.

## Resolution

root_cause: |
  The workload-tab-person-filter fix over-corrected: it moved ALL story attribution into the
  worklog-based `if (worklogMap)` block (Pass 2). This caused:
  1. Empty dropdowns until worklogMap loads (async after sprint data)
  2. Stories with zero worklogs invisible in the assignee's drill-down forever

fix: |
  Restored Pass 1 to build stories[] from assignment (same as old code) with subtasks: [] and
  zero time fields. Pass 2 now OVERLAYS worklog data into existing story rows:
  - Finds the story row in the assignee's stories[] and updates subtasks + time fields
  - For worklog-only authors (not assigned), pushes the story into their stories[]
  - Time totals on summary row remain worklog-based (accumulated in Pass 2)

  Two tests that encoded the over-corrected behavior were updated:
  - "assigned person only sees stories in drill-down where they also have worklogs" →
    now verifies assigned person sees ALL their stories; worklog-only person sees only worklog stories
  - "does not show stories in drill-down when nobody has worklogs" →
    now verifies assigned stories ARE visible immediately even when no worklogs have loaded

verification: All 23 tests pass.
files_changed:
  - taskflow/src/routes/dashboard/WorkloadTab.tsx
  - taskflow/src/routes/dashboard/WorkloadTab.test.tsx
