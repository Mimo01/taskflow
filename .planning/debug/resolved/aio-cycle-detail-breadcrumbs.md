---
slug: aio-cycle-detail-breadcrumbs
status: resolved
trigger: When going from AIO cycles to cycle detail the breadcrumbs to go back are not set
created: 2026-06-17
updated: 2026-06-17
---

## Symptoms

- **Expected:** Breadcrumbs should show the path back (same as on other pages)
- **Actual:** Breadcrumbs are empty / missing on cycle detail page
- **Errors:** No console errors visible
- **Timeline:** Unsure if it ever worked (possibly newly built feature never wired up)
- **Reproduction:** Click a cycle in the AIO cycles list → navigate to cycle detail → breadcrumbs are empty

## Current Focus

```yaml
hypothesis: >
  AioProjectOverviewPage navigated to cycle detail via a plain <NavLink> without
  pushing to useBreadcrumbStore, so trail.length === 0 on AioCycleDetailPage,
  hiding the breadcrumb bar entirely.
test: completed
expecting: breadcrumb bar shows 'AIO Cycles' link on cycle detail page
next_action: human verify in running app
reasoning_checkpoint:
  hypothesis: >
    Breadcrumbs missing because AioProjectOverviewPage uses a plain <NavLink> (no
    breadcrumb push) to navigate to cycle detail; AioCycleDetailPage only renders
    the breadcrumb bar when trail.length > 0.
  confirming_evidence:
    - "AioProjectOverviewPage.tsx line 599-604: NavLink with no breadcrumb push (now fixed)"
    - "AioCycleDetailPage.tsx line 803: breadcrumb bar conditional on trail.length > 0"
    - "AioCycleDetailPage.tsx line 769 openRun(): push then navigate — correct pattern that works for run detail breadcrumbs"
    - "main.tsx lines 316-322: breadcrumb reset skips /aio-cycle/ paths, so trail survives the navigation"
  falsification_test: >
    If after adding the push the breadcrumb bar still does not appear, trail is being
    reset or not read correctly — hypothesis is wrong.
  fix_rationale: >
    Push the cycles page location to the trail before navigating away, exactly as
    openRun() does. The conditional render in AioCycleDetailPage will then find
    trail.length > 0 and show the breadcrumb bar.
  blind_spots: >
    Direct URL navigation (pinned tab) bypasses the push entirely — breadcrumbs will
    still be empty in that case, but that is existing behavior and out of scope.
```

## Evidence

- timestamp: 2026-06-17T09:00:00Z
  checked: AioProjectOverviewPage.tsx line 587-625 (cycle table row rendering)
  found: Cycle title was a <NavLink to={...}> with no onClick, no breadcrumb push
  implication: Trail is never populated when navigating from cycles list to cycle detail

- timestamp: 2026-06-17T09:01:00Z
  checked: AioCycleDetailPage.tsx line 803
  found: Breadcrumb bar only rendered when `trail.length > 0`
  implication: Empty trail = no breadcrumb UI shown

- timestamp: 2026-06-17T09:02:00Z
  checked: AioCycleDetailPage.tsx line 769 (openRun)
  found: openRun does `useBreadcrumbStore.getState().push({ label: cycleName, path: location.pathname })` before navigate — this is the correct pattern
  implication: The same pattern must be applied in AioProjectOverviewPage when navigating to cycle detail

- timestamp: 2026-06-17T09:03:00Z
  checked: main.tsx lines 314-323 (breadcrumb reset effect)
  found: Reset fires when new pathname does NOT start with /issue/, /mr/, /release/, or /aio-cycle/. Navigating to /aio-cycle/... is excluded from reset.
  implication: Pushing trail before navigating to /aio-cycle/ will preserve it correctly

- timestamp: 2026-06-17T09:04:00Z
  checked: sidebar-items.ts line 82
  found: AIO Cycles page sidebar label is "AIO Cycles"
  implication: Push label should be "AIO Cycles" for consistency with sidebar navigation label

- timestamp: 2026-06-17T09:05:00Z
  checked: npm run check output after fix
  found: No errors in AioProjectOverviewPage.tsx or breadcrumb-related files. Two pre-existing TS errors in MyTaskRow.tsx (unrelated).
  implication: Fix is type-safe and lint-clean

## Eliminated

## Resolution

```yaml
root_cause: >
  AioProjectOverviewPage used a plain <NavLink> to navigate to cycle detail pages
  without pushing the current page to useBreadcrumbStore. AioCycleDetailPage only
  renders its breadcrumb bar when trail.length > 0, so it remained hidden.
fix: >
  Replaced the cycle title <NavLink> in AioProjectOverviewPage with a <button> that
  calls useBreadcrumbStore.getState().push({ label: 'AIO Cycles', path: location.pathname })
  then navigate() to the cycle detail URL, matching the openRun() pattern in
  AioCycleDetailPage.
verification: confirmed by user 2026-06-17
files_changed:
  - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
```
