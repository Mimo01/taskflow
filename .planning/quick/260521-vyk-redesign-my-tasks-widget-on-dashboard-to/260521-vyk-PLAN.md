---
quick_id: 260521-vyk
slug: redesign-my-tasks-widget-on-dashboard-to
description: Redesign My Tasks widget on dashboard to show subtasks with parent story context using grouped indented layout
date: 2026-05-21
---

## Task

Redesign `DashboardInProgressCard` on the dashboard so subtasks are shown grouped under their parent story, providing context for each subtask.

## Design Reference

`~/Downloads/A _ Parent _ indented subtask _current_.png` — shows:
- Parent story row: icon + summary (bold) + key (muted, right)
- Subtask row: indent + └ connector + summary (muted) + key (right)

## Plan

### Task 1: Update DashboardInProgressCard.tsx

**Files:** `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx`

**Action:**
1. Import `LayoutGrid` from lucide-react (fallback story icon)
2. After filtering `myInProgressSubtasks`, build an `issueByKey` map from sprint issues for icon URL lookup
3. Group displayed subtasks by `issue.fields.parent?.key`
4. Render grouped layout: parent row (icon + summary + key) → indented subtask rows (└ + summary + key)
5. Orphan subtasks (no parent data) shown as plain rows (key + summary)

**Verify:** Component renders parent story row above subtask row; clicking each calls `onIssueClick` with correct key

### Task 2: Update DashboardInProgressCard.test.tsx

**Files:** `taskflow/src/routes/dashboard/DashboardInProgressCard.test.tsx`

**Action:**
1. Extend `makeSprintIssue` fixture to accept optional `parentKey` and `parentSummary` params
2. Add test 6: verifies grouped display — parent row shows summary+key, subtask row shows └ connector, both clicks call `onIssueClick` with correct key

**Verify:** All 6 tests pass
