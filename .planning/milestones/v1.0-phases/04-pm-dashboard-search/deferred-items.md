# Deferred Items — Phase 04-pm-dashboard-search

## Pre-existing failures (out of scope)

### MyTasksTab skeleton test
- **File:** taskflow/src/routes/dashboard/MyTasksTab.test.tsx
- **Test:** "renders skeleton when isLoading (activeJiraProject present, fetch delayed)"
- **Status:** Pre-existing failure before Plan 03 changes (confirmed via git stash)
- **Error:** `expected 0 to be greater than 0` — skeleton data-testid query returns 0 elements
- **Scope:** Not caused by Plan 03 changes — deferred for separate fix
