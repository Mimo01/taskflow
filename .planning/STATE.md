---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Polish
status: planning
stopped_at: Completed quick-5 (GitLab group to project selection)
last_updated: "2026-03-12T20:41:32.940Z"
last_activity: "2026-03-12 - Completed quick task 5: GitLab group selection replaced with project selection across auth store, onboarding wizard, settings, ReleasesTab, and notification polling"
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 8
  completed_plans: 8
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
Last activity: 2026-03-12 - Completed quick task 5: GitLab group selection replaced with project selection across auth store, onboarding wizard, settings, ReleasesTab, and notification polling

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

## Session Continuity

Last session: 2026-03-12T20:36:00.000Z
Stopped at: Completed quick-5 (GitLab group to project selection)
Resume file: None
