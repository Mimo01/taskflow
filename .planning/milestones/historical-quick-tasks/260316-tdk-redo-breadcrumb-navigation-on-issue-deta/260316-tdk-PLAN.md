---
phase: quick-260316-tdk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/main.tsx
  - taskflow/src/stores/breadcrumb.store.ts
  - taskflow/src/routes/dashboard/IssueDetailPage.tsx
autonomous: true
requirements: [BREAD-01]

must_haves:
  truths:
    - "Clicking an issue from a list page shows breadcrumb trail starting with source page name (e.g. Sprint Board / PROJ-1)"
    - "Drilling issue to issue stacks onto breadcrumb trail (Sprint Board / PROJ-1 / PROJ-2)"
    - "Clicking a pinned tab shows no breadcrumbs (trail is empty)"
    - "Navigating to any non-issue route resets breadcrumbs completely"
    - "Back arrow pops breadcrumb trail and navigates to the popped entry, not browser history"
    - "When trail is empty, back arrow navigates to /dashboard"
  artifacts:
    - path: "taskflow/src/stores/breadcrumb.store.ts"
      provides: "Breadcrumb trail store with source page tracking"
      contains: "trail"
    - path: "taskflow/src/main.tsx"
      provides: "handleIssueClick with source-page breadcrumb push + route-change reset"
      contains: "handleIssueClick"
    - path: "taskflow/src/routes/dashboard/IssueDetailPage.tsx"
      provides: "Back button using breadcrumb trail navigation instead of browser history"
      contains: "handleBack"
  key_links:
    - from: "taskflow/src/main.tsx"
      to: "taskflow/src/stores/breadcrumb.store.ts"
      via: "breadcrumbPush on list-page->issue navigation"
      pattern: "breadcrumbPush.*label.*routeLabel"
    - from: "taskflow/src/routes/dashboard/IssueDetailPage.tsx"
      to: "taskflow/src/stores/breadcrumb.store.ts"
      via: "handleBack pops trail and navigates to popped entry"
      pattern: "breadcrumbPop|trail\\.slice"
    - from: "taskflow/src/main.tsx"
      to: "taskflow/src/stores/breadcrumb.store.ts"
      via: "useEffect on location.pathname resets trail on non-issue routes"
      pattern: "breadcrumbReset"
---

<objective>
Redo breadcrumb navigation on issue detail to be context-aware with stacking.

Purpose: Currently breadcrumbs from list pages are lost (trail resets on list->issue). User needs to see where they came from (e.g. "Sprint Board") and drill-down ancestry (e.g. "Sprint Board / PROJ-1 / PROJ-2"). Tab/sidebar navigation should clear the trail entirely.

Output: Updated breadcrumb store, handleIssueClick logic, IssueDetailPage back button, and route-change reset effect.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/main.tsx
@taskflow/src/stores/breadcrumb.store.ts
@taskflow/src/routes/dashboard/IssueDetailPage.tsx

<interfaces>
From taskflow/src/stores/breadcrumb.store.ts:
```typescript
interface TrailEntry {
  path: string
  label: string
}
interface BreadcrumbState {
  trail: TrailEntry[]
  push: (entry: TrailEntry) => void
  pop: () => void
  reset: () => void
}
export const useBreadcrumbStore = create<BreadcrumbState>(...)
```

From taskflow/src/main.tsx (key function):
```typescript
const handleIssueClick = (issueKey: string, resetTrail = false) => {
  // resetTrail=true: pinned tabs, command palette, notifications
  // Currently: list page -> issue RESETS trail (wrong)
  // Currently: issue -> issue pushes current key (correct)
}

function routeLabel(pathname: string): string {
  // Maps pathname to human-readable label
}
```

From taskflow/src/routes/dashboard/IssueDetailPage.tsx:
```typescript
const handleBack = () => {
  breadcrumbPop()
  navigate(-1)  // Uses browser history (wrong per decisions)
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix handleIssueClick breadcrumb logic and add route-change reset</name>
  <files>taskflow/src/main.tsx</files>
  <action>
Two changes in main.tsx:

**1. Fix handleIssueClick breadcrumb push logic (around line 167-178):**

Replace the current logic with:
```
const handleIssueClick = (issueKey: string, resetTrail = false) => {
  if (resetTrail) {
    breadcrumbReset();
  } else if (location.pathname.startsWith('/issue/')) {
    // Drilling issue->issue: push current issue key onto trail
    const currentKey = location.pathname.replace('/issue/', '');
    breadcrumbPush({ path: location.pathname, label: currentKey });
  } else {
    // From a list page: push source page name as first breadcrumb entry, then clear any stale trail first
    breadcrumbReset();
    breadcrumbPush({ path: location.pathname, label: routeLabel(location.pathname) });
  }
  navigate(`/issue/${issueKey}`);
  // ... rest of recent-item resolution unchanged
};
```

The key change: the `else` branch (list page -> issue) now pushes the source page label instead of just resetting.

**2. Add useEffect to reset breadcrumbs when navigating to any non-issue route (after line 136):**

```typescript
// Reset breadcrumb trail when navigating away from issue detail
useEffect(() => {
  if (!location.pathname.startsWith('/issue/')) {
    breadcrumbReset();
  }
}, [location.pathname]);
```

This covers sidebar clicks, browser navigation, and any other non-issue route change. It does NOT fire when navigating between issues (issue->issue keeps the trail).
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>handleIssueClick pushes source page name when navigating from list page to issue. Route-change effect resets trail on non-issue navigation. TypeScript compiles clean.</done>
</task>

<task type="auto">
  <name>Task 2: Fix IssueDetailPage back button to use breadcrumb trail navigation</name>
  <files>taskflow/src/routes/dashboard/IssueDetailPage.tsx</files>
  <action>
Replace the handleBack function (currently lines 89-92) with breadcrumb-trail-based navigation:

```typescript
const handleBack = () => {
  if (trail.length > 0) {
    // Pop the last entry and navigate to it
    const target = trail[trail.length - 1];
    breadcrumbPop();
    navigate(target.path, { replace: true });
  } else {
    // No trail — go to a sensible default
    navigate('/dashboard');
  }
};
```

Key differences from current code:
- NO `navigate(-1)` (browser history). Always uses breadcrumb trail.
- When trail is empty, navigates to `/dashboard` (sensible default per decisions).
- Uses `replace: true` so the back navigation doesn't pollute browser history.

Also update the breadcrumb entry click handler (around line 117-119). Currently it truncates to `trail.slice(0, i)` and navigates — this is already correct behavior. No change needed there.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Back arrow pops breadcrumb trail and navigates to the popped entry. Empty trail navigates to /dashboard. No browser history dependency.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles with no errors
2. Manual test flow: Navigate to Sprint Board -> click issue -> breadcrumb shows "Sprint Board / PROJ-XXX"
3. Manual test flow: From issue detail, click a subtask/linked issue -> breadcrumb stacks: "Sprint Board / PROJ-1 / PROJ-2"
4. Manual test flow: Click a pinned tab -> breadcrumbs empty
5. Manual test flow: Click sidebar link (e.g. Backlog) -> breadcrumbs reset
6. Manual test flow: Back arrow from stacked trail -> goes to previous issue in trail
7. Manual test flow: Back arrow when trail empty -> goes to /dashboard
</verification>

<success_criteria>
- Breadcrumbs show source page name when navigating from any list page to issue detail
- Drilling issue->issue stacks the full ancestry in the breadcrumb trail
- Pinned tab clicks, command palette, notifications reset breadcrumbs
- Any non-issue route navigation resets breadcrumbs
- Back arrow follows breadcrumb trail, not browser history
- Empty trail back arrow goes to /dashboard
</success_criteria>

<output>
After completion, create `.planning/quick/260316-tdk-redo-breadcrumb-navigation-on-issue-deta/260316-tdk-SUMMARY.md`
</output>
