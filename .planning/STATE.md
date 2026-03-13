---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Polish
status: planning
stopped_at: Completed 08-dashboard-enrichment-03-PLAN.md
last_updated: "2026-03-13T10:04:05.851Z"
last_activity: "2026-03-13 - Completed quick task 12: Fix MR-to-Jira task mapping empty array"
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 21
  completed_plans: 20
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.
**Current focus:** v1.1 Polish — Phase 5: API Foundation + Quick Wins

## Current Position

Phase: 5 of 8 (API Foundation + Quick Wins)
Plan: — of —
Status: Ready to plan
Last activity: 2026-03-13 - Completed quick task 12: Fix MR-to-Jira task mapping empty array

Progress: [░░░░░░░░░░] 0% (v1.1)

## Performance Metrics

**Velocity (v1.0 baseline):**
- Total plans completed: 20
- Average duration: ~9.4 min
- Total execution time: ~75 min

**Recent Trend:**
- Last 5 plans: 5min, 4min, 10min, 4min, 4min
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Key v1.1 constraints from research:

- [v1.1 APIF]: Two-query subtask strategy mandatory — `sprint in openSprints()` excludes subtasks on Jira DC; second query: `issuetype in subtaskIssueTypes() AND parent in (KEY-1,...)`
- [v1.1 APIF]: Always use `issuetype.subtask === true` (not name comparison) — admin can rename the type
- [v1.1 APIF]: `discoverStoryPointsField()` required — `customfield_10016` is default but not guaranteed on DC
- [v1.1 WORK]: Time tracking fields may be admin-disabled — graceful hide (not zeros) is the primary path
- [v1.1 HIER]: Mutation `onSettled` must invalidate both `['jira-issues','my-tasks',...]` and `['jira-issues','sprint-board',...]`
- [v1.1 REL]: Sort must use `releaseDate` only — `startDate` confirmed unavailable in GET responses on DC
- [Phase 05-api-foundation-quick-wins]: Pre-existing TypeScript errors confirmed out-of-scope via git stash check
- [Phase 05-api-foundation-quick-wins]: REL-01/02/03 stubs intentionally fail (RED state) — Plan 04 makes them pass
- [Phase 05-api-foundation-quick-wins]: APIF-04 passes immediately as searchGitLabMRs fix lands in same plan
- [Phase 05-api-foundation-quick-wins]: Use version.id lookup (not array index) for versionCountQueries after sort to avoid off-by-one counts
- [Phase 05-api-foundation-quick-wins]: APIF-02: fetchSprintIssues two-query strategy implemented with SUBTASK_CHUNK_SIZE=50, subtask fields exclude description, silent fallback on subtask query failure
- [Phase 05-api-foundation-quick-wins]: APIF-02 guard: issuetype not in subtaskIssueTypes() in sprint JQL prevents Jira DC edge case where openSprints() returns subtasks causing empty sprint view
- [Phase 05-api-foundation-quick-wins]: REL-01: onRehydrateStorage clears numeric activeJiraProject at startup — fixes Releases tab showing wrong project data
- [Phase 05-api-foundation-quick-wins]: APIF-02 subtask JQL bug: assigneeClause was in scope but not interpolated into second query template literal — one-character fix appending ${assigneeClause}
- [Phase 05-api-foundation-quick-wins]: REL-01: fetchFixVersions must use /rest/api/2/project/{projectKey}/versions — Jira Server silently ignores ?projectKey= filter on /rest/api/2/version
- [Phase 05-api-foundation-quick-wins]: REL-01: onRehydrateStorage clears numeric activeJiraProject via useAuthStore.setState() — direct mutation is overwritten by async Tauri storage hydration
- [Phase 06]: WorkloadTab: exclude done stories from point totals — preserves original test behavior
- [Phase 06]: WorkloadTab: useState Set expand/collapse chosen over @base-ui/react Collapsible for simplicity and testability
- [Phase 06]: SPPG: donePct = 100 - todoPct - inProgPct to prevent rounding gap in stacked bar
- [Phase 06]: SPPG: issuetype.subtask boolean used for story partition (not name comparison)
- [Phase 06-workload-sprint-progress-enrichment]: WorkloadTab done-story fix: replace guard skip with conditional increment — done stories always pushed to assignee map, count/pts only incremented for non-done
- [Phase 07-story-subtask-hierarchy-mr-subtask-filter]: HIER-01: Orphans silently dropped — render block deleted, groupedData memo kept for tests/future use
- [Phase 07-story-subtask-hierarchy-mr-subtask-filter]: onMutate fix: my-tasks cache key holds { issues, myIssueKeys } not JiraIssue[] — typing was silently wrong
- [Phase 07-story-subtask-hierarchy-mr-subtask-filter]: queryFn return shape changed to {filtered, merged} so subtask extension memo accesses pre-filter pool without stale closure
- [Phase 07-story-subtask-hierarchy-mr-subtask-filter]: viaSubtaskKey only set when sprintIssueKeySet link is null — sprint-linked MRs never get via label
- [Phase 07-story-subtask-hierarchy-mr-subtask-filter]: boardGroups useMemo partitions sprint issues into stories/subtasksByParent — columns and counts derived from stories only
- [Phase 07-story-subtask-hierarchy-mr-subtask-filter]: expandedStories standalone useState decoupled from query cache — collapse state survives 60s refetch
- [Phase 07-story-subtask-hierarchy-mr-subtask-filter]: Single button wrapping Badge+chevron is idiomatic — avoids nested interactive elements and makes the entire row the hit target
- [Phase 07-story-subtask-hierarchy-mr-subtask-filter]: queryKey for gitlab-mrs includes userId as third element — ensures fresh fetch when userId changes from undefined to real value
- [Phase 07-story-subtask-hierarchy-mr-subtask-filter]: enabled guard requires !!userId — prevents query firing before validateGitLab resolves
- [Phase 07-story-subtask-hierarchy-mr-subtask-filter]: gitlab.ts uncommitted diff discarded via git checkout — duplicate fetchProjectMilestonesInRange never committed
- [Quick-12]: MyTasksTab gitlabMrs queryKey now ['gitlab-mrs', gitlabBaseUrl, userId] — matches MrAttentionTab for shared TanStack cache
- [Quick-12]: fetchProjectMRs added to gitlab.ts — project-level MR pool enables Jira-key linking without GitLab assignment
- [Quick-12]: Sprint-linked project MR bypass implemented in data useMemo (not queryFn) to keep queryFn pure
- [Phase 08-dashboard-enrichment]: it.todo() chosen for Wave 0 stubs — cleaner test output vs expect(true).toBe(false); vitest reports pending rather than error noise
- [Phase 08-dashboard-enrichment]: NotificationRow actual props are { item, isUnread?, onClick } — plan interface block referenced wrong props; corrected in implementation
- [Phase 08-dashboard-enrichment]: fetchActiveSprint uses two-step Agile REST API pattern: board discovery then active sprint fetch
- [Phase 08-dashboard-enrichment]: SubtasksPanel receives jiraBaseUrl/jiraToken/activeJiraProject as props — no internal secret reads
- [Phase 08-dashboard-enrichment]: fetchActiveSprint added to jira.ts in Plan 03 (Plan 02 not yet executed) — Rule 3 blocking dependency
- [Phase 08-dashboard-enrichment]: SprintHealthPanel reads JiraIssue[] directly from fetchSprintIssues (array, not {issues, myIssueKeys}) — confirmed from SprintProgressTab pattern

### Pending Todos

None.

### Blockers/Concerns

- Phase 5: Two-query subtask JQL strategy must be validated on the real Orange Jira DC v10.3.15 instance before hierarchy UI is built
- Phase 6: Verify time tracking admin status on Orange Jira instance — graceful-hide may be the only visible result
- Phase 5: Confirm `discoverStoryPointsField()` result on real instance vs assumed `customfield_10016`

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 4 | Jira & GitLab api call logging, debug option toggle in settings and new UI page for displaying the logs | 2026-03-12 | e3eb929 | Verified | [4-jira-gitlab-api-call-logging-debug-optio](./quick/4-jira-gitlab-api-call-logging-debug-optio/) |
| 5 | GitLab group selection replaced with project selection (auth store, onboarding, settings, ReleasesTab, notifications) | 2026-03-12 | 6e2fb62 | Verified | [5-change-gitlab-active-group-selection-to-](./quick/5-change-gitlab-active-group-selection-to-/) |
| 6 | Sort WorkloadTab assignees by story points descending with alphabetical tiebreaker | 2026-03-12 | 99dc766 | Verified | [6-sort-assignees-by-total-story-points-in-](./quick/6-sort-assignees-by-total-story-points-in-/) |
| 7 | Add Stories and Subtasks columns to SprintProgressTab assignee breakdown table | 2026-03-12 | ded80fa | Verified | [7-in-sprint-progress-page-show-a-new-colum](./quick/7-in-sprint-progress-page-show-a-new-colum/) |
| 8 | Add Tech Lead role with access to all Developer and PM features | 2026-03-12 | 2f3fb6a | Verified | [8-add-a-new-role-with-access-to-all-featur](./quick/8-add-a-new-role-with-access-to-all-featur/) |
| 9 | Add 15-second AbortController timeout to all Jira and GitLab API calls | 2026-03-12 | 7859212 | Verified | [9-add-timeouts-for-jira-and-gitlab-api-cal](./quick/9-add-timeouts-for-jira-and-gitlab-api-cal/) |
| 10 | GitLab disconnection amber banner mirroring Jira banner, stacks when both disconnected | 2026-03-12 | 5a1d3d4 | Verified | [10-when-gitlab-fails-to-connect-there-is-no](./quick/10-when-gitlab-fails-to-connect-there-is-no/) |
| 11 | Active page indicator in sidebar using NavLink with bg-accent highlight | 2026-03-12 | dbd0a8d | Verified | [11-add-active-page-indicator-in-sidebar](./quick/11-add-active-page-indicator-in-sidebar/) |
| 12 | Fix MR-to-Jira task mapping: userId=0 reviewer bug + project-level MR pool for Jira-key linking | 2026-03-13 | d81be7a | Verified | [12-fix-mr-to-jira-task-mapping-empty-array-](./quick/12-fix-mr-to-jira-task-mapping-empty-array-/) |
| Phase 06 P01 | 203 | 2 tasks | 2 files |
| Phase 06 P02 | 4 | 2 tasks | 2 files |
| Phase 06-workload-sprint-progress-enrichment P03 | 5 | 1 tasks | 2 files |
| Phase 07-story-subtask-hierarchy-mr-subtask-filter P01 | 15 | 2 tasks | 2 files |
| Phase 07-story-subtask-hierarchy-mr-subtask-filter P03 | 10 | 2 tasks | 3 files |
| Phase 07-story-subtask-hierarchy-mr-subtask-filter P02 | 3 | 2 tasks | 2 files |
| Phase 07-story-subtask-hierarchy-mr-subtask-filter P04 | 3 | 1 tasks | 1 files |
| Phase 07-story-subtask-hierarchy-mr-subtask-filter P05 | 2 | 2 tasks | 2 files |
| Phase 08-dashboard-enrichment P01 | 2 | 2 tasks | 4 files |
| Phase 08-dashboard-enrichment P04 | 2 | 1 tasks | 2 files |
| Phase 08-dashboard-enrichment P02 | 3 | 2 tasks | 3 files |
| Phase 08-dashboard-enrichment P03 | 3 | 2 tasks | 5 files |

## Session Continuity

Last session: 2026-03-13T10:04:05.848Z
Stopped at: Completed 08-dashboard-enrichment-03-PLAN.md
Resume file: None
