# Quick Task 260316-s5u: Add comment mentions and expand notification types - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Task Boundary

Expand the notification system with new notification types and per-type filtering. Currently supports Jira comment-mentions, Jira issue-updates, and GitLab MR notes.

</domain>

<decisions>
## Implementation Decisions

### Comment Mentions Scope
- Add GitLab @mention detection in MR comments (notify when current user is @mentioned)
- Add Jira "all comments" notifications for issues where user is assignee/reporter/watcher (not just mentions)

### New Notification Types
- **MR approvals** (GitLab): Notify when user's MR is approved or changes are requested
- **Pipeline failures** (GitLab): Notify when CI pipeline fails on user's MRs
- **Issue assignments** (Jira): Notify when an issue is newly assigned to the user
- **Due date reminders** (Jira): Notify when assigned issues are approaching their due date

### Notification Type Filtering
- Per-type toggles: individual on/off for each notification type in settings
- Replace current source-level toggles with granular per-type controls

</decisions>

<specifics>
## Specific Ideas

- Existing notification types: `comment-mention`, `issue-update`, `mr-note`
- New types to add: `gitlab-mention`, `jira-comment`, `mr-approval`, `pipeline-failure`, `issue-assignment`, `due-date-reminder`
- Settings UI should group toggles by source (Jira section / GitLab section)
- Due date reminders need a threshold (e.g., 1 day before due)

</specifics>
