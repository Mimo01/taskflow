---
phase: quick-260609-hvu
plan: "01"
subsystem: onboarding
tags: [wizard, error-ux, jira, gitlab, expandable-log]
dependency_graph:
  requires: []
  provides: [wizard-error-log]
  affects: [JiraStep, GitLabStep]
tech_stack:
  added: []
  patterns: [useRef-log-accumulation, chevron-toggle-panel]
key_files:
  created: []
  modified:
    - taskflow/src/routes/onboarding/JiraStep.tsx
    - taskflow/src/routes/onboarding/GitLabStep.tsx
decisions:
  - "Log collected inside mutationFn try/catch via local array, assigned to ref on failure — avoids state re-renders mid-mutation and ensures log is available synchronously when error renders"
  - "Stack trace appended as a separate log line when present — gives full error chain without polluting the primary message"
  - "showDetails resets to false on every new validation attempt — prevents stale log from prior attempt confusing the user"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-09"
  tasks_completed: 2
  files_modified: 2
---

# Phase quick-260609-hvu Plan 01: Wizard Expandable Error Log Summary

**One-liner:** Collapsible step-by-step error log panel added to JiraStep and GitLabStep using a useRef log accumulator and ChevronDown/Up toggle.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add expandable error log panel to JiraStep | 4c8e0bea | taskflow/src/routes/onboarding/JiraStep.tsx |
| 2 | Apply the same pattern to GitLabStep | 3a5eb7cb | taskflow/src/routes/onboarding/GitLabStep.tsx |

## What Was Built

Both wizard step components now show an expandable "Show details" panel below any validation error message. The panel displays a timestamped step-by-step log narrating exactly which API calls were attempted and where the failure occurred.

**JiraStep log sequence:**
1. Timestamp + URL
2. Step 1: validateJira — OK with display name, or FAILED with message + stack
3. Step 2: listJiraProjects — OK with project count

**GitLabStep log sequence:**
1. Timestamp + URL
2. Step 1: validateGitLab — OK with name and username, or FAILED with message + stack
3. Step 2: listGitLabProjects — OK with project count

The toggle button uses ChevronDown/Up icons, resets on every new attempt, and the pre panel is scrollable (max-h-48), monospace, muted-background styled.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None beyond the accepted T-hvu-01/T-hvu-02 items in the plan's threat model (local-only rendering, no external transmission).

## Self-Check: PASSED

- taskflow/src/routes/onboarding/JiraStep.tsx: modified and committed (4c8e0bea)
- taskflow/src/routes/onboarding/GitLabStep.tsx: modified and committed (3a5eb7cb)
- biome check ./src/routes/onboarding/: 0 errors
- tsc errors in JiraStep/GitLabStep: 0 (pre-existing AboutDialog errors unrelated)
