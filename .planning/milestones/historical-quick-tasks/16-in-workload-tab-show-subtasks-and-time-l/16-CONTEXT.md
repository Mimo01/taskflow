# Quick Task 16: Workload tab subtasks + time-logged tasks - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Task Boundary

In the Workload tab, each person row currently shows only their assigned stories. The user wants:
1. Subtasks shown in the expanded view (nested under their parent story)
2. People who logged time on any task/subtask appear in the workload, even if not assigned to them

</domain>

<decisions>
## Implementation Decisions

### Sub-row layout
- Subtasks appear nested under their parent story in the expanded view
- Hierarchy: Assignee row → Story row → Subtask rows (indented further)

### Time-logged attribution
- Query the Jira worklogs API to determine who actually logged time
- Endpoint: `GET /rest/api/3/issue/{issueIdOrKey}/worklog`
- Build assignee map based on worklog authors, not just issue assignees
- A person appears in the workload if they logged time on any issue in the sprint (story or subtask), regardless of assignment

### Task count for subtasks
- The "Tasks" column keeps its current behavior: counts non-done stories only
- Subtasks do not increment the task counter (they are detail items, not top-level work)

### Claude's Discretion
- How to handle Jira worklogs API performance (batching, caching strategy)
- Whether to show subtasks that have no time logged or only subtasks with time logged
- How to handle subtasks whose parent story is not in the sprint issues list

</decisions>

<specifics>
## Specific Requirements

- People mostly log time on subtasks, not stories — this is the primary motivation
- The change should not break existing behavior for the task count and points columns
- Must not regress the expandable story rows feature

</specifics>
