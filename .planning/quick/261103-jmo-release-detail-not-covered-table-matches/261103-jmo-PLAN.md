---
quick_id: 261103-jmo
type: quick
autonomous: true
files_modified:
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
---

# Quick 261103-jmo: "Not covered by tasks above" column order matches "Deployment package mismatches"

User likes the Deployment package mismatches column order on release detail and wants the
"Not covered by tasks above" (secondary) table to match as closely as possible — at minimum,
State must come after Key (currently State is first).

## Reference order (DeploymentPackageSection.tsx ~L355-376, unchanged)

icon · Key · State · Assignee · Reporter · Summary · Fix · [Apply]

## Current secondary order (UnifiedTaskTable.tsx)

State · icon · Key · Merge request · Author · Reviewers · MR state · BR · MS · Fix · [Apply]

## Target secondary order

icon · Key · State · Author · Reviewers · Merge request · MR state · BR · MS · Fix · [Apply]

(Author ↔ Assignee, Reviewers ↔ Reporter, Merge request ↔ Summary; MR-only columns
MR state / BR / MS sit after the summary, before Fix — keeping Fix + Apply last as in the reference.)

## Task 1: Reorder secondary header + row cells

files: taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx

action:
- `SecondaryHeaderStrip` (~L734): reorder spans to icon, Key, State, Author, Reviewers,
  Merge request, MR state, BR, MS, Fix, action spacer. Keep every existing className/testid.
- `MrSubLine` (~L773): ONLY in the `reasonCell` (secondary) branch, render
  `keyCell` → `reasonCell` → `MrAuthorCell` → `MrReviewersCell` → summary span → `MrStatePill`
  → BR → MS → fix target → action. The primary path (no `reasonCell`) must render exactly as
  today: `keyCell ?? iid` → summary → BR → MS. Simplest: compute the summary span once as a
  const and branch the JSX order on `reasonCell`, without duplicating BR/MS logic.
- Update the WR-06 comment block (~L124) and the `SecondaryHeaderStrip` docstring so they
  describe the new order.
- Keep all column widths/responsive classes as-is (COL_SECONDARY_KEY still hides icon+key at 520).

verify: `cd taskflow && npx vitest run src/routes/dashboard/release-detail` passes;
`npx biome check src/routes/dashboard/release-detail/UnifiedTaskTable.tsx` and `npx tsc --noEmit` clean.

done: header labels and row cells are in the target order; primary task rows unchanged.

## Task 2: Regression test for the secondary column order

files: taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx

action: Add a test next to the existing "orders task columns Key / Summary / ..." test (~L2951)
asserting `secondary-header` labels (children textContent, trimmed, non-empty) are, in order:
Key, State, Author, Reviewers, Merge request, MR state, BR, MS, Fix. Also assert in a rendered
secondary row that the `secondary-type-icon` / key cell precedes the state pill (use DOM order via
`compareDocumentPosition` or children index). Use whatever existing fixture produces a secondary
row (search the file for `secondary-section`). Fix any existing test that asserted the old order.

verify: test passes with the change (and would fail against the old order).

done: one commit containing code + test (pre-commit runs the full suite; do not split RED/GREEN).
