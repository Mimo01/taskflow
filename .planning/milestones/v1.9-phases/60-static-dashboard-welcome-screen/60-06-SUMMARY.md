---
phase: 60-static-dashboard-welcome-screen
plan: "06"
subsystem: dashboard
tags: [jira, dashboard, release-card, progress-bar, testing]
dependency_graph:
  requires: []
  provides: [release-progress-bar, fetchReleaseIssues]
  affects: [DashboardReleaseCard, jira.ts]
tech_stack:
  added: []
  patterns: [second-useQuery-per-component, resilient-api-fetch]
key_files:
  created: []
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/routes/dashboard/DashboardReleaseCard.tsx
    - taskflow/src/routes/dashboard/DashboardReleaseCard.test.tsx
decisions:
  - fetchReleaseIssues returns [] on any error (matches searchJira resilience pattern) so it never blocks dashboard rendering
  - Second useQuery placed after soonest derivation lines to respect React hooks call order while using enabled guard for conditional disabling
  - fields=status only in fetchReleaseIssues URL keeps response payload minimal — status is all that is needed for done% computation
metrics:
  duration: "~12 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  files_changed: 3
---

# Phase 60 Plan 06: Release Progress Bar Summary

Added `fetchReleaseIssues` to jira.ts and a second `useQuery` in DashboardReleaseCard that computes done percentage from Jira issue status categories and renders a Progress bar with "N% complete · X / Y issues" caption.

## What Was Built

**fetchReleaseIssues (jira.ts):** New exported async function that queries Jira's search API using JQL `project=PROJ AND fixVersion="versionName"` with `fields=status&maxResults=500`. Follows the same resilient pattern as `searchJira` — returns `[]` on network errors or non-ok responses, never throws, so it never blocks dashboard rendering. Inserted between `fetchFixVersions` and `searchJira`.

**DashboardReleaseCard.tsx:** Added `fetchReleaseIssues` and `Progress` imports. Second `useQuery` keyed on `['jira-release-issues', activeJiraProject, soonest?.name]` with `enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject && !!soonest` — disabled when no upcoming release exists. `donePct` computed with `totalCount > 0` guard to prevent NaN on zero-issue releases. Progress bar (`<Progress value={donePct} className="h-1.5" />`) and caption (`{donePct}% complete · {doneCount} / {totalCount} issues`) rendered inside the soonest block after the timing label div.

**DashboardReleaseCard.test.tsx:** Updated existing Tests 1-5 to use `mockReturnValueOnce(...).mockReturnValueOnce(...)` for the two sequential useQuery calls. Added Tests 6 (42% with 5/12 done), 7 (0% with 0/0 zero-issue guard), and 8 (empty state + no progressbar). All 8 tests pass.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add fetchReleaseIssues to jira.ts | b895da0e | taskflow/src/services/jira.ts |
| 2 | Add second useQuery, donePct, Progress bar to DashboardReleaseCard | 2e0cc043 | taskflow/src/routes/dashboard/DashboardReleaseCard.tsx |
| 3 | Update tests for two-query mock, add Tests 6-8 | 946e50c9 | taskflow/src/routes/dashboard/DashboardReleaseCard.test.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the Progress bar and caption are fully wired to live Jira data via the second useQuery.

## Threat Flags

None — no new network endpoints or auth paths beyond what was planned. fetchReleaseIssues uses the same Bearer PAT pattern as all other jira.ts functions. versionName comes from Jira's own API response (trusted source) and is URL-encoded via encodeURIComponent.

## Self-Check

Files created/modified:
- taskflow/src/services/jira.ts — FOUND (fetchReleaseIssues exported, 1 match confirmed)
- taskflow/src/routes/dashboard/DashboardReleaseCard.tsx — FOUND (Progress bar and second useQuery in place)
- taskflow/src/routes/dashboard/DashboardReleaseCard.test.tsx — FOUND (339 lines, 8 tests)

Commits:
- b895da0e — FOUND
- 2e0cc043 — FOUND
- 946e50c9 — FOUND

TypeScript: no errors across all modified files.
Tests: 8/8 pass.

## Self-Check: PASSED
