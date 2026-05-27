---
phase: quick-260528-19k
verified: 2026-05-28T01:25:00Z
status: gaps_found
score: 5/6
overrides_applied: 0
gaps:
  - truth: "App builds and the full test suite passes with no live my-tasks references remaining"
    status: failed
    reason: "SubtasksPanel.test.tsx still asserts the 'View all in My Tasks' link exists (line 233), but that link was removed from SubtasksPanel.tsx in Task 2. The test was not included in Task 3's update scope. npm test fails: 1 failed / 1554 passed."
    artifacts:
      - path: "taskflow/src/routes/dashboard/SubtasksPanel.test.tsx"
        issue: "Line 233 — expect(screen.getByText(/View all.*in My Tasks/i)).toBeInTheDocument() — references removed UI element. Line 207 test name also references the removed feature."
    missing:
      - "Update SubtasksPanel.test.tsx: remove or rewrite the test at line 207 ('limits display to 5 subtasks and shows View all in My Tasks link when more exist') — either remove the hasMore/link assertions or change them to assert the link is absent"
---

# Quick Task quick-260528-19k: Remove My Tasks Page — Verification Report

**Task Goal:** Completely remove My Tasks page — route, page components, sidebar entry, settings toggle, settings-store field, and all live code references — while preserving the Dashboard My Subtasks widget (SubtasksPanel) and its fetchMyTasksHierarchy data source.
**Verified:** 2026-05-28T01:25:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The /my-tasks route no longer exists and navigating there 404s naturally (no redirect) | VERIFIED | routes.tsx has no /my-tasks route or MyTasksTab import; no redirect added |
| 2 | The 'My Tasks' item no longer appears in the sidebar navigation | VERIFIED | sidebar-items.ts has no my-tasks entry; Sidebar.tsx PREFETCH_ROUTES has no /my-tasks; CheckSquare removed from Sidebar.tsx imports only |
| 3 | The 'Show subtasks in My Tasks' toggle no longer appears in Settings > Workflow | VERIFIED | WorkflowSection.tsx has no showSubtasksInMyTasks or setShowSubtasksInMyTasks references |
| 4 | showSubtasksInMyTasks is removed from the settings store and stripped from persisted state on upgrade (version 24 migration) | VERIFIED | settings.store.ts line 340: `version: 24`; line 438: `if (version < 24)` migration; line 439: `delete (s as Record<string, unknown>).showSubtasksInMyTasks` |
| 5 | The Dashboard My Subtasks widget (SubtasksPanel) still renders correctly using fetchMyTasksHierarchy | VERIFIED | SubtasksPanel.tsx imports fetchMyTasksHierarchy (line 11), uses it in useQuery (line 45), keeps queryKey ['jira-issues', 'my-tasks', ...] (line 43); "View all in My Tasks" link removed; npm build passes |
| 6 | App builds and the full test suite passes with no live my-tasks references remaining | FAILED | npm run build passes. npm test fails: SubtasksPanel.test.tsx line 233 expects `getByText(/View all.*in My Tasks/i)` which references the link removed from SubtasksPanel.tsx — test was not updated. Result: 1 failed / 1554 passed. |

**Score:** 5/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/stores/settings.store.ts` | Settings store at version 24 with showSubtasksInMyTasks removed + migration | VERIFIED | version: 24, version < 24 migration deletes showSubtasksInMyTasks |
| `taskflow/src/components/app/sidebar-items.ts` | Sidebar nav items without my-tasks entry | VERIFIED | No my-tasks entry found |
| `taskflow/src/routes/routes.tsx` | Route table without /my-tasks | VERIFIED | No /my-tasks route or MyTasksTab reference |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `taskflow/src/routes/dashboard/SubtasksPanel.tsx` | `fetchMyTasksHierarchy` | useQuery — preserved | VERIFIED | Import at line 11, query at line 45 |
| `taskflow/src/stores/settings.store.ts` | persisted localStorage state | migrate() version < 24 deletes showSubtasksInMyTasks | VERIFIED | Lines 438-439 confirm migration block |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `taskflow/src/main.tsx` | 330, 347 | Comments still reference "my-tasks" cache shape | INFO | Cosmetic only — no live code impact, no route reference; plan task 2b said to update these comments but executor left them. Does not affect build or tests. |
| `taskflow/src/routes/dashboard/SubtasksPanel.test.tsx` | 207, 233 | Test asserts presence of removed UI element ("View all in My Tasks" link) | BLOCKER | npm test fails — test suite broken |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| npm run build | `cd taskflow && npm run build` | built in 4.19s, no errors | PASS |
| npm test | `cd taskflow && npm test` | 1 failed (SubtasksPanel.test.tsx:233) / 1554 passed | FAIL |

### Human Verification Required

None — all items are programmatically verifiable.

## Gaps Summary

One blocker gap found.

`SubtasksPanel.test.tsx` was not included in Task 3's list of test files to update. The test at line 207-234 asserts that when more than 5 subtasks exist, a "View all in My Tasks" link appears — but that link was removed from SubtasksPanel.tsx in Task 2. The test now fails with `Unable to find an element with the text: /View all.*in My Tasks/i`.

**Fix:** Update `SubtasksPanel.test.tsx` line 207 test:
- Rename the test to remove the "View all" reference (e.g., "limits display to 5 subtasks when more exist")
- Remove or invert line 232-233 (remove the `getByText(/View all.*in My Tasks/i).toBeInTheDocument()` assertion, or assert the link is NOT present)
- The `hasMore` variable in the test setup may also need adjustment if the "View all" link was the only consumer of that mock data

The main.tsx comments at lines 330 and 347 still reference "my-tasks" (plan task 2b said to update them). This is cosmetic and does not block builds or tests.

---

_Verified: 2026-05-28T01:25:00Z_
_Verifier: Claude (gsd-verifier)_
