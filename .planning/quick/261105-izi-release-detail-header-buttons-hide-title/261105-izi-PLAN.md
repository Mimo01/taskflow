---
quick_id: 261105-izi
mode: quick
files: [taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx, taskflow/src/routes/dashboard/release-detail/ReleaseHeader.test.tsx]
---

# Quick 261105-izi: release detail header buttons hide title on small screens

**Cause:** The header action group is `flex-none`; "Refreshed: <time>" text and the Pin/Edit/Open in Jira
labels only collapse at `@max-[640px]/page`. The refresh button + timestamp (added after the layout was tuned)
widened the group to ~470px, so between ~640–900px the title truncates to nothing.

## Task 1: Staged collapse, sooner
- files: ReleaseHeader.tsx, ReleaseHeader.test.tsx
- action: hide "Refreshed:" text at `@max-[1024px]/page` (first to go); button labels sr-only at
  `@max-[896px]/page` (icon-only). Update the two class assertions in the test.
- verify: `npx vitest run src/routes/dashboard/release-detail/ReleaseHeader.test.tsx`
- done: at any page width ≥ ~400px the title keeps ≥ ~100px.
