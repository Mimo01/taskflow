---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Polish
status: planning
stopped_at: Completed quick task 18 — Increase default window size + widen onboarding wizard
last_updated: "2026-03-13T15:40:00.000Z"
last_activity: "2026-03-13 - Completed quick task 18: Tauri window 1100x750, onboarding max-w-lg"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 24
  completed_plans: 24
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
Last activity: 2026-03-13 - Completed quick task 18: Make the default app dimensions a little bit bigger. Also make the wizard container a little bit bigger (wider)

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
- [Phase 08-dashboard-enrichment]: Dashboard index.tsx is a thin wiring layer only — token loading + prop passing; panels handle their own queries
- [Phase 08-dashboard-enrichment]: PM layout uses early return pattern for clean role separation; developer/tech-lead default shares 4-panel grid
- [Phase 08-dashboard-enrichment]: Dashboard index.tsx is a thin wiring layer only — token loading + prop passing; panels handle their own queries
- [Phase 08-dashboard-enrichment]: Notifications store sanitized on rehydration — numeric/null id values coerced to string to prevent row click failures
- [Phase 08-dashboard-enrichment]: sprintData?.issues ?? [] — line 61 fix aligns with fetchSprintIssues {issues, myIssueKeys} return shape; Tauri opener mock uses mockRejectedValue so window.open fallback is exercised; View all notifications Link placed after conditional content block with mt-auto
- [Phase 08-dashboard-enrichment]: Array.isArray(data) guard in sprintIssueKeySet useMemo — rejects non-array objects that pass ?? [] but throw when iterated
- [Phase 08-dashboard-enrichment]: Array.isArray(projectMrs) guard on spread — fetchProjectMRs may return {} on parse failure causing spread throw
- [Phase 08-dashboard-enrichment]: NotificationsPage reuses existing NotificationRow and NotificationDetail sub-components — no new UI primitives needed
- [Phase 08-dashboard-enrichment]: Bell sidebar link placed above Debug Logs in bottom utility section, no role-gating

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
| 13 | Custom error page replacing default React Router boundary — ErrorPage.tsx + errorElement on root route | 2026-03-13 | 4db00be | Verified | [13-add-a-custom-error-page-to-replace-the-d](./quick/13-add-a-custom-error-page-to-replace-the-d/) |
| 14 | Remove fullpage /notifications route and dashboard NotificationsPanel — bell popover is sole notifications surface | 2026-03-13 | ec6d662 | Done | [14-remove-fullpage-notifications-and-dashbo](./quick/14-remove-fullpage-notifications-and-dashbo/) |
| 15 | Comment count badge on TaskRow + existing comments list in InlineComment panel | 2026-03-13 | d0404e9 | Verified | [15-show-comment-count-on-my-tasks-page-and-](./quick/15-show-comment-count-on-my-tasks-page-and-/) |
| 16 | WorkloadTab subtask nesting + worklog attribution: three-level hierarchy and fetchIssueWorklogs | 2026-03-13 | 36553c8 | Verified | [16-in-workload-tab-show-subtasks-and-time-l](./quick/16-in-workload-tab-show-subtasks-and-time-l/) |
| 17 | WorkloadTab Tasks column counts all stories (in-progress + done); Done badge on done sub-rows | 2026-03-13 | 4d74b93 | Done | [17-in-the-workload-tab-only-in-progress-tas](./quick/17-in-the-workload-tab-only-in-progress-tas/) |
| 18 | Tauri window 1100x750; onboarding wizard containers max-w-lg | 2026-03-13 | 57c0c9e | Done | [18-make-the-default-app-dimensions-a-little](./quick/18-make-the-default-app-dimensions-a-little/) |
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
| Phase 08 P05 | 35 | 1 tasks | 1 files |
| Phase 08-dashboard-enrichment P06 | 5 | 2 tasks | 3 files |
| Phase 08-dashboard-enrichment P07 | 3 | 1 tasks | 1 files |
| Phase 08-dashboard-enrichment P08 | 2 | 2 tasks | 3 files |

## Session Continuity

Last session: 2026-03-13T15:40:00.000Z
Stopped at: Completed quick task 18 — Increase default window size + widen onboarding wizard
Resume file: None
