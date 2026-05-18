---
phase: 260518-jbe
plan: 01
subsystem: ui
tags: [react, jira, vitest, typescript]

# Dependency graph
requires:
  - phase: 260518-j1c
    provides: Defects table with Jira key, colored status, assignee column — base for new columns

provides:
  - Reporter column with CachedAvatar + displayName in AIO cycle detail Defects table
  - Priority column with optional icon + name in AIO cycle detail Defects table
  - Severity column with graceful value/name fallback in AIO cycle detail Defects table
  - JiraIssue.fields extended with optional reporter, priority, severity types
  - fetchJiraIssueByKey widened to request reporter, priority, severity from Jira REST

affects: [aio-cycle-detail, jira-types, jira-issues]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Defects table cell pattern: isLoading → Skeleton; populated → content; null → em-dash span"
    - "Severity read as severity?.value ?? severity?.name to handle both Jira field shapes"

key-files:
  created: []
  modified:
    - taskflow/src/services/jira/issues.ts
    - taskflow/src/services/jira/types.ts
    - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
    - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx

key-decisions:
  - "Severity requested by semantic field name 'severity'; Jira REST silently omits unknown fields so no error on projects without severity"
  - "Severity value read as severity?.value ?? severity?.name to handle both single-select option shapes used in different Jira configurations"
  - "Priority icon rendered as <img> with alt='' (decorative) at w-3.5 h-3.5 when iconUrl present"

patterns-established:
  - "DefectRow cell pattern: Skeleton while loading, content when populated, em-dash <span className='text-muted-foreground'> when null"

requirements-completed: [JBE-01]

# Metrics
duration: 8min
completed: 2026-05-18
---

# Quick Task 260518-jbe Summary

**Reporter, Priority, and Severity columns added to AIO cycle detail Defects table using existing fetchJiraIssueByKey query — 8 columns total, all cells degrade to em-dash when Jira fields absent**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-18T13:55:00Z
- **Completed:** 2026-05-18T14:01:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended `fetchJiraIssueByKey` URL to request `reporter`, `priority`, `severity` fields from Jira REST API (additive, no breaking changes)
- Extended `JiraIssue.fields` with optional `reporter`, `priority`, `severity` typed to mirror `JiraIssueDetail` shapes already in the codebase
- Added Reporter cell (CachedAvatar + displayName, same visual pattern as Assignee), Priority cell (optional icon img + name), and Severity cell (value/name fallback) to `DefectRow` between Assignee and Triggered By
- Added matching `<th>` headers: Reporter (w-36), Priority (w-24), Severity (w-24)
- Added 3 new render-coverage tests: column headers presence, populated row, missing-fields em-dash fallback — bringing Defects tab test count from 10 to 13 (suite: 27 → 30)

## Task Commits

1. **Task 1: Extend Jira issue fetch + types** - `19957a1` (feat)
2. **Task 2: Render Reporter, Priority, Severity columns** - `1cd7350` (feat)

## Files Created/Modified
- `taskflow/src/services/jira/issues.ts` - Widened `fields=` query string in `fetchJiraIssueByKey` to include reporter, priority, severity
- `taskflow/src/services/jira/types.ts` - Added optional `reporter`, `priority`, `severity` to `JiraIssue.fields` before index signature
- `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` - New Reporter, Priority, Severity `<td>` cells in `DefectRow`; new `<th>` headers in defects thead
- `taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx` - 3 new tests + updated header count assertion (5→8)

## Decisions Made
- Severity is requested by the semantic name `severity` in the Jira fields query. Jira REST silently omits fields it doesn't know, so this is safe against projects that lack a severity custom field.
- Severity value resolved as `severity?.value ?? severity?.name` because Jira Service Management uses `value` on single-select option objects while some configurations expose `name`. Both keys are optional in the type.
- No new network requests — all three new columns consume data from the `issueQuery` already fired per defect row.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- Worktree `taskflow/` directory lacked `node_modules` (expected for git worktrees). Symlinked from main repo (`ln -s .../taskflow/node_modules`) to run vitest against the worktree's modified files for proper verification.

## Next Phase Readiness
- Defects table now exposes full triage metadata: Key, Title, Status, Assignee, Reporter, Priority, Severity, Triggered By
- No blockers

---
*Phase: 260518-jbe*
*Completed: 2026-05-18*
