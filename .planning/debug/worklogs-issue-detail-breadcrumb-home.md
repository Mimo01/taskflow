---
status: diagnosed
trigger: "Issue detail breadcrumb back-link shows 'Home' when navigated from the Worklogs page (should show 'Worklogs')"
created: 2026-05-23T00:00:00Z
updated: 2026-05-23T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — `routeLabel` in main.tsx (lines 285-298) has no `/worklogs` case; falls through to default `'Home'` return at line 297. WorklogsPage correctly calls `onIssueClick`, which correctly calls `handleIssueClick`, which correctly takes the "from a list page" branch and pushes `{ path: '/worklogs', label: routeLabel('/worklogs') }` — but the label resolves to `'Home'`. Fix is a single line addition in the routeLabel map.
test: Traced WorklogsPage row onClick → outlet `onIssueClick` → `handleIssueClick` in main.tsx → `routeLabel(location.pathname)` → no `/worklogs` case → returns 'Home'
expecting: Fix is to add `if (pathname.startsWith('/worklogs')) return 'Worklogs';` to `routeLabel` (line ~291 between `/sprint-progress` and `/releases`, or any consistent spot)
next_action: Hand back to plan-phase --gaps with this root cause

## Symptoms

expected: When clicking an epic/story/subtask row on the Worklogs page, the issue detail page should show 'Worklogs > {ISSUE-KEY}' in the breadcrumb (the back-link should say 'Worklogs')
actual: Breadcrumb shows 'Home > {ISSUE-KEY}' instead of 'Worklogs > {ISSUE-KEY}'
errors: None
reproduction: Open Worklogs page, click any epic/story/subtask row, observe breadcrumb on the issue detail page that loads
started: Plan 64-01 commit 16b75990 (Worklogs page hierarchy table introduced — first time worklogs page navigates to issue detail)

## Eliminated

- hypothesis: "WorklogsPage is not actually wiring onIssueClick correctly (i.e., not using outlet context)"
  evidence: "Read WorklogsPage.tsx lines 228-231 and 960/995/1022 — `useOutletContext<{ onIssueClick }>()` is consumed correctly and each row button calls `onIssueClick(epicKey/storyKey/subtaskKey)`. Identical pattern to BacklogPage.tsx:191-194."
  timestamp: 2026-05-23T00:00:00Z

- hypothesis: "Outlet provider does not include onIssueClick when rendering /worklogs"
  evidence: "main.tsx line 543-553 shows a single `<Outlet context={{ onIssueClick: handleIssueClick, ... }} />` shared across all routes inside AppLayout. WorklogsPage is rendered as a child of AppLayout via routes.tsx line 45 (`{ path: '/worklogs', element: withLazy(WorklogsPage) }`). The outlet context is identical for /backlog and /worklogs."
  timestamp: 2026-05-23T00:00:00Z

- hypothesis: "Breadcrumb store strips or rewrites the label"
  evidence: "breadcrumb.store.ts is a 20-line zustand store — `push` is `trail: [...s.trail, entry]`, IssueDetailPage.tsx:360 renders `{entry.label}` literally. No mutation happens; what gets pushed is what gets shown."
  timestamp: 2026-05-23T00:00:00Z

## Evidence

- timestamp: 2026-05-23T00:00:00Z
  checked: taskflow/src/routes/worklogs/WorklogsPage.tsx
  found: |
    Line 18:   import { useOutletContext } from 'react-router-dom';
    Lines 228-231:
      const { onIssueClick } = useOutletContext<{
        onIssueClick: (key: string, resetTrail?: boolean) => void;
      }>();
    Line 960: epic row button — onClick={() => onIssueClick(epicKey)}
    Line 995: story row button — onClick={() => onIssueClick(storyKey)}
    Line 1022: subtask row button — onClick={() => onIssueClick(subtaskKey)}
    All three call onIssueClick with the key only (no resetTrail argument; defaults to false).
  implication: WorklogsPage's wiring is correct and matches BacklogPage's pattern exactly.

- timestamp: 2026-05-23T00:00:00Z
  checked: taskflow/src/routes/dashboard/BacklogPage.tsx
  found: |
    Lines 190-194:
      export default function BacklogPage() {
        const { onIssueClick, openCreateStory } = useOutletContext<{
          onIssueClick: (key: string) => void;
          openCreateStory: () => void;
        }>();
    Same pattern as WorklogsPage. Single shared outlet context provider, same handler.
  implication: BacklogPage uses the same call site, but routes to /backlog → 'Backlog' label works because routeLabel maps it.

- timestamp: 2026-05-23T00:00:00Z
  checked: taskflow/src/main.tsx (handleIssueClick)
  found: |
    Lines 314-327 (handleIssueClick):
      const handleIssueClick = (issueKey: string, resetTrail = false) => {
        if (resetTrail) {
          breadcrumbReset();
        } else if (location.pathname.startsWith('/issue/')) {
          // Drilling issue→issue — push current issue onto trail
          const currentKey = location.pathname.replace('/issue/', '');
          breadcrumbPush({ path: location.pathname, label: currentKey });
        } else {
          // From a list page — push source page name as first breadcrumb entry
          breadcrumbReset();
          breadcrumbPush({ path: location.pathname, label: routeLabel(location.pathname) });
        }
        navigate(`/issue/${issueKey}`);
        ...
      };

    WorklogsPage calls onIssueClick(key) with no resetTrail → resetTrail=false; location.pathname is /worklogs which does NOT start with /issue/ → takes the else branch → breadcrumbReset() then breadcrumbPush({ path: '/worklogs', label: routeLabel('/worklogs') }).
  implication: Control flow lands in the "From a list page" branch. The label pushed is whatever routeLabel('/worklogs') returns.

- timestamp: 2026-05-23T00:00:00Z
  checked: taskflow/src/main.tsx (routeLabel)
  found: |
    Lines 285-298:
      function routeLabel(pathname: string): string {
        if (pathname.startsWith('/sprint-board')) return 'Sprint Board';
        if (pathname.startsWith('/backlog')) return 'Backlog';
        if (pathname.startsWith('/my-tasks')) return 'My Tasks';
        if (pathname.startsWith('/epics')) return 'Epics';
        if (pathname.startsWith('/dashboard')) return 'Dashboard';
        if (pathname.startsWith('/sprint-progress')) return 'Sprint Progress';
        if (pathname.startsWith('/releases')) return 'Releases';
        if (pathname.startsWith('/issue/')) return 'Issue';
        if (pathname.startsWith('/merge-requests')) return 'Merge Requests';
        if (pathname.startsWith('/mr/')) return 'MR Detail';
        if (pathname.startsWith('/release/')) return 'Release';
        return 'Home';
      }

    NO case for '/worklogs'. Pathname '/worklogs' falls through every if and returns 'Home' (line 297).
  implication: ROOT CAUSE. routeLabel was never extended when the Worklogs page route was added.

- timestamp: 2026-05-23T00:00:00Z
  checked: taskflow/src/routes/routes.tsx
  found: |
    Line 23: const WorklogsPage = lazy(() => import('./worklogs/WorklogsPage'));
    Line 45: { path: '/worklogs', element: withLazy(WorklogsPage) },
  implication: Confirms the URL pathname is exactly '/worklogs' (no parent prefix). startsWith('/worklogs') will reliably match.

- timestamp: 2026-05-23T00:00:00Z
  checked: taskflow/src/stores/breadcrumb.store.ts and IssueDetailPage.tsx
  found: |
    breadcrumb.store.ts: 20-line zustand store, push appends entry as-is, no transformation.
    IssueDetailPage.tsx:349-363 renders `{entry.label}` literally inside a button.
  implication: The label stored is the label rendered. 'Home' is what the user sees because 'Home' is what was pushed.

## Resolution

root_cause: |
  taskflow/src/main.tsx — the `routeLabel(pathname)` helper (lines 285-298) maps every other top-level route to a human-readable breadcrumb label but is missing a case for `/worklogs`. When WorklogsPage calls `onIssueClick(key)`, the shared `handleIssueClick` in AppLayout takes the "from a list page" branch (lines 322-325) and pushes `{ path: '/worklogs', label: routeLabel('/worklogs') }` into the breadcrumb store. `routeLabel('/worklogs')` falls through all eleven `if (pathname.startsWith(...))` checks and returns the default `'Home'` at line 297. The breadcrumb store stores the label verbatim; IssueDetailPage renders `entry.label` verbatim — so the back-link shows "Home" instead of "Worklogs". WorklogsPage's own wiring (useOutletContext + onIssueClick calls) is correct and matches BacklogPage's pattern; the gap is purely in the route→label mapping table, which was never extended when the Worklogs route was added.
fix: (deferred — plan-phase --gaps will plan)
verification: (deferred — fix not yet applied)
files_changed: []
