---
status: diagnosed
phase: 60-static-dashboard-welcome-screen
source: 60-01-SUMMARY.md, 60-02-SUMMARY.md, 60-03-SUMMARY.md, 60-04-SUMMARY.md
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Dashboard Hero Section
expected: Navigate to the Dashboard route. A hero section appears with a gradient background and centred "Welcome back, {your display name}" heading. Today's date is shown in long en-GB format (e.g. "Thursday, 21 May 2026"). No drag handles, widget picker, or configuration controls are visible.
result: pass

### 2. Sprint Card — Active Sprint
expected: A "Sprint" card is visible showing the active sprint's name, days remaining until sprint end, and a labelled progress bar reflecting the % of story points done. The bar should reflect real data (non-zero if work is in progress).
result: pass

### 3. Sprint Card — Empty State
expected: If you have a project with no active sprint, or after disabling credentials temporarily, the Sprint card shows "No active sprint" (exact text) instead of crashing or showing a broken UI.
result: skipped
reason: requires project with no active sprint; not available in current test environment

### 4. In-Progress Card — Your Subtasks
expected: A card titled something like "In Progress" lists only your own in-progress subtasks (filtered by your Jira display name). Each row is a clickable button. Clicking one navigates to the issue detail page (/issue/:key).
result: issue
reported: "yes, but clicking on it doesn't put it into breadcrumb so I can go easily back to dashboard"
severity: minor

### 5. In-Progress Card — Cap & Overflow
expected: If more than 3 subtasks are in progress, only 3 rows appear and a plain-text caption like "and N more" is shown beneath them (not a link or button). If zero subtasks match, the card shows "No subtasks in progress — nice work!" (exact text).
result: skipped
reason: requires >3 in-progress subtasks or zero in-progress subtasks; not available in current test environment

### 6. Release Card — Next Release
expected: A "Next Release" (or similar) card shows the name of the soonest upcoming unreleased Jira fix version and a timing label: "Today" (blue badge) if due today, "N days overdue" (amber text) if past due, or "N days away" (muted text) if future.
result: issue
reported: "yes but there is no progress bar of how many tasks are done"
severity: minor

### 7. Release Card — Empty State
expected: When no unreleased fix version with a release date exists in the project, the card shows "No upcoming releases" (exact text) without crashing.
result: skipped
reason: requires project with no unreleased fix versions; not available in current test environment

### 8. Responsive 3-Card Grid
expected: On a wider screen (≥1024px), all three cards (Sprint, In Progress, Release) appear side-by-side in a 3-column grid. On a tablet-width screen (~768px), they stack to 2 columns. On mobile, they stack to a single column.
result: pass

## Summary

total: 8
passed: 3
issues: 2
pending: 0
skipped: 3
blocked: 0

## Gaps

- truth: "Navigating to an issue from the In-Progress card adds Dashboard to the breadcrumb trail so the user can navigate back easily"
  status: failed
  reason: "User reported: yes, but clicking on it doesn't put it into breadcrumb so I can go easily back to dashboard"
  severity: minor
  test: 4
  root_cause: "DashboardInProgressCard calls navigate('/issue/:key') directly via its own useNavigate(), bypassing handleIssueClick in AppLayout (main.tsx) which pushes the current page onto the breadcrumb trail before navigating"
  artifacts:
    - path: "taskflow/src/routes/dashboard/DashboardInProgressCard.tsx"
      issue: "Calls useNavigate() directly instead of onIssueClick from outlet context"
    - path: "taskflow/src/main.tsx"
      issue: "handleIssueClick (lines 314-327) is the correct entry point — not called by DashboardInProgressCard"
    - path: "taskflow/src/routes/dashboard/IssueDetailPage.tsx"
      issue: "Breadcrumb/back-arrow header only renders when trail.length > 0"
  missing:
    - "DashboardInProgressCard must consume onIssueClick from useOutletContext or as a prop instead of calling navigate directly"
    - "Dashboard index.tsx must thread onIssueClick down to DashboardInProgressCard as a prop"
  debug_session: ""

- truth: "The Release card shows a progress bar indicating how many tasks in the release are done vs total"
  status: failed
  reason: "User reported: yes but there is no progress bar of how many tasks are done"
  severity: minor
  test: 6
  root_cause: "DashboardReleaseCard fetches only fix version metadata (name, date, released flag) with no query for issues tagged with the fix version, so there is no issue count data to compute done% from"
  artifacts:
    - path: "taskflow/src/routes/dashboard/DashboardReleaseCard.tsx"
      issue: "Missing second useQuery for release issues; no donePct computed; no Progress bar rendered"
    - path: "taskflow/src/services/jira.ts"
      issue: "No fetchReleaseIssues function — needs JQL search: project={key} AND fixVersion={name}"
  missing:
    - "Add fetchReleaseIssues(jiraBaseUrl, jiraToken, projectKey, versionName) to jira.ts using JQL fixVersion query, returning status fields only"
    - "Add second useQuery in DashboardReleaseCard keyed on ['jira-release-issues', activeJiraProject, soonest?.name]"
    - "Compute donePct = doneCount / totalCount where doneCount filters statusCategory.key === 'done'"
    - "Render <Progress value={donePct} /> and caption '{donePct}% complete · {doneCount} / {totalCount} issues' after the timing label"
  debug_session: ""
