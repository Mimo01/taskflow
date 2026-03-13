# Deferred Items — Phase 09

Discovered during 09-02 execution. Out of scope — pre-existing failures not caused by 09-02 changes.

## Pre-existing Test Failures (Scope Boundary)

These tests were failing before 09-02 execution began (confirmed by git log showing no 09-02 changes to these files):

| Test File | Failing Tests | Root Cause |
|-----------|--------------|------------|
| `src/routes/dashboard/SubtasksPanel.test.tsx` | 4 tests — "renders subtask row", "hides orphan subtasks", "display limit", "Jira deep-link" | Component renders "No open subtasks" despite mock data; likely sprint data query mock mismatch |
| `src/routes/dashboard/MyTasksTab.test.tsx` | 1 test — "renders skeleton when isLoading" | Skeleton not rendered; likely async loading state mock issue |
| `src/routes/dashboard/ReleasesTab.test.tsx` | 1 test — "shows task count and completion status" | Assertion failure on version row data |

**Last known good commits for these files:**
- SubtasksPanel: `a0216ac` (Phase 8)
- MyTasksTab: Phase 8
- ReleasesTab: Phase 8

**Recommendation:** Fix in a separate plan once Phase 9 UI components are complete.
