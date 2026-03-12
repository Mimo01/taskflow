---
status: resolved
trigger: "Sprint issues list shows subtasks that are not assigned to the current user"
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:00:00Z
---

## Current Focus

hypothesis: confirmed
test: direct code read of fetchSprintIssues in jira.ts
expecting: missing assignee filter on second JQL query
next_action: report diagnosis — no code changes requested

## Symptoms

expected: Sprint issues list shows only subtasks assigned to the current user
actual: Sprint issues list shows ALL subtasks of parent issues, including those assigned to other users
errors: none (silent data correctness bug)
reproduction: open sprint view with assignedToMe=true; subtasks of user's parent issues appear regardless of their own assignee
started: present in current implementation

## Eliminated

- hypothesis: bug is in the first query (parent issue fetch)
  evidence: first JQL correctly includes `AND assignee = currentUser()` when assignedToMe=true (line 183, 187)
  timestamp: 2026-03-12T00:00:00Z

## Evidence

- timestamp: 2026-03-12T00:00:00Z
  checked: fetchSprintIssues, lines 176–257 of taskflow/src/services/jira.ts
  found: |
    assigneeClause is correctly constructed at line 183:
      `const assigneeClause = assignedToMe ? ' AND assignee = currentUser()' : '';`
    First JQL at line 186–188 correctly uses assigneeClause.
    Second (subtask) JQL at line 235–237 does NOT use assigneeClause:
      `issuetype in subtaskIssueTypes() AND parent in (${chunk.join(',')})`
    No assignee filter is applied to the subtask query at all.
  implication: every subtask of every parent issue in the sprint is returned, regardless of who it is assigned to

- timestamp: 2026-03-12T00:00:00Z
  checked: assignedToMe parameter propagation
  found: assignedToMe is a function-level parameter (line 180, defaulting to true) but is never referenced in the subtask query construction block (lines 234–248)
  implication: the parameter value is available and just needs to be applied conditionally in the subtask JQL string

## Resolution

root_cause: |
  The second JQL query in fetchSprintIssues (the subtask fetch, line 235–237) does not
  apply an assignee filter. The `assigneeClause` variable (built from `assignedToMe`) is
  constructed and correctly used in the first query, but is completely absent from the
  subtask JQL. As a result, when `assignedToMe=true`, the subtask query returns every
  subtask whose parent is in the result set — regardless of who the subtask is assigned to.

fix: already applied in Phase 05 execution — `${assigneeClause}` appended to subtask JQL at jira.ts:236
verification: confirmed present in codebase (2026-03-12)
files_changed:
  - taskflow/src/services/jira.ts
