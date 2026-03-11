---
status: complete
phase: 04-pm-dashboard-search
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md
started: 2026-03-11T23:00:00Z
updated: 2026-03-11T23:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Role-Conditional PM Dashboard
expected: When logged in as a user with role "pm", the dashboard shows three tabs: Sprint Progress, Workload, and Releases. The developer tabs (My Tasks, Sprint Board, MR Attention) should NOT appear for PM users.
result: pass

### 2. Sprint Progress Tab
expected: The Sprint Progress tab shows sprint issues grouped into three bucket rows: To Do, In Progress, and Done. Each row displays an issue count. If any issues have story points, a progress bar appears showing completed vs total points (e.g. "8 / 16 pts").
result: pass

### 3. Workload Tab
expected: The Workload tab shows a list of assignees with their open (non-done) task count and story points. Assignees are sorted by task count descending (busiest first). An empty state message appears if no issues are assigned.
result: pass

### 4. Releases Tab
expected: The Releases tab shows fix versions from Jira, each with a linked GitLab milestone or tag. Versions with exact date matches show the GitLab link normally; fuzzy matches show a dashed underline indicator. Each version shows an issue count. Unmatched versions show no GitLab link.
result: issue
reported: "Unexpected Application Error! (fixVersions ?? []).map is not a function. (In '(fixVersions ?? []).map((v) => ({ queryKey: [\"jira-version-counts\", v.id], queryFn: () => fetchVersionIssueCounts(jiraBaseUrl, jiraToken, v.id), enabled: !!jiraBaseUrl && !!jiraToken, staleTime: 5 * 6e4 }))', '(fixVersions ?? []).map' is undefined)"
severity: blocker

### 5. Search Icon in TopBar
expected: A search/magnifying glass icon button is visible in the top bar, positioned before the bell (notifications) icon.
result: pass

### 6. Open Search Overlay
expected: Clicking the search icon opens a full-screen overlay. The overlay contains a text input field that receives focus automatically. The rest of the screen is dimmed.
result: pass

### 7. Debounced Search with Grouped Results
expected: Typing 2 or more characters in the search input triggers a search (after ~400ms debounce). Results appear grouped into two sections: "Tasks" (Jira issues) and "Merge Requests" (GitLab MRs). Typing 1 character or less shows no results. A loading state appears while searching.
result: pass

### 8. Search Result Detail Panel
expected: Clicking a result from the search list opens a detail panel. For Jira issues: shows key, summary, status, assignee, story points, and description excerpt, with an "Open in Jira" button. For GitLab MRs: shows title, state badge, author, and linked ticket key chip, with an "Open in GitLab" button. A back button returns to the results list.
result: issue
reported: "For jira result, the description is not rendered properly but as plaintext with all special chars. For gitlab result, I would expect to have a link to jira ticket as well (if available)"
severity: major

### 9. Close Search Overlay
expected: Pressing the Escape key closes the search overlay. Clicking on the dimmed backdrop outside the search panel also closes it. The overlay disappears completely and normal app state resumes.
result: pass

## Summary

total: 9
passed: 7
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Releases tab shows fix versions from Jira with GitLab date-matching and issue counts"
  status: failed
  reason: "User reported: Unexpected Application Error! (fixVersions ?? []).map is not a function. (fixVersions ?? []).map is undefined"
  severity: blocker
  test: 4
  artifacts: []
  missing: []
- truth: "Jira issue detail panel shows a description excerpt"
  status: failed
  reason: "User reported: the description is not rendered properly but as plaintext with all special chars"
  severity: major
  test: 8
  artifacts: []
  missing: []
- truth: "GitLab MR detail panel shows linked ticket key chip"
  status: failed
  reason: "User reported: would expect to have a link to jira ticket as well (if available) — chip shown but not clickable/linked"
  severity: major
  test: 8
  artifacts: []
  missing: []
