---
phase: 87-release-detail-decomposition
plan: 03
subsystem: refactor
tags: [react, typescript, decomposition, jsx-extraction]

requires: ["87-02"]
provides:
  - "release-detail/MetaRow.tsx — private leaf component, preserves min-w-0 (D-13)"
  - "release-detail/ReleaseDetailSkeleton.tsx — loading skeleton, moved verbatim"
  - "release-detail/ReleaseHeader.tsx — ReleaseBreadcrumbHeader + ReleaseTitleHeading (two exports)"
  - "release-detail/DescriptionsSection.tsx — Jira + GitLab description blocks"
  - "release-detail/LabelSummarySection.tsx — label chip list from milestone MRs"
  - "ReleaseDetailPage.tsx down to 1045 lines (from 1167), consumes all five as direct-path imports"
affects: [87-04, 87-05, 87-06]

tech-stack:
  added: []
  patterns:
    - "Named exports only, interface XxxProps above the component (issue-detail/ convention), except MetaRow (documented inline-type exception)"
    - "Direct relative-path imports from the page shell, no release-detail/index.ts barrel (D-05)"

key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/MetaRow.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx
    - taskflow/src/routes/dashboard/release-detail/DescriptionsSection.tsx
    - taskflow/src/routes/dashboard/release-detail/LabelSummarySection.tsx
  modified:
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/stores/breadcrumb.store.ts

key-decisions:
  - "PLANNER DEVIATION FROM D-01 (per plan's own instruction): ReleaseHeader.tsx exports two components (ReleaseBreadcrumbHeader, ReleaseTitleHeading) instead of one — the breadcrumb renders unconditionally above the isLoading||!version ternary while the title heading renders inside the loaded left column; merging them would move the heading out of its current DOM position."
  - "Exported TrailEntry from breadcrumb.store.ts (was a private interface) so ReleaseBreadcrumbHeaderProps can type its trail prop against the store's own shape instead of duplicating it."
  - "LabelSummarySection's gate uses milestoneMRsLoaded: boolean (shell passes !!milestoneMRs) rather than a length check — semantically identical to the prior `milestoneMRs && labelSummary.length > 0` (an empty loaded array was already truthy under the old code)."

requirements-completed: [FOUND-01]

duration: 35min
completed: 2026-08-10
---

# Phase 87 Plan 03: Release Detail — Leaf Section Extraction Summary

**Extracted the five low-risk leaf pieces of `ReleaseDetailPage.tsx` (MetaRow, skeleton, breadcrumb/title header, descriptions, label summary) into `release-detail/*.tsx`, each a byte-identical JSX move behind a props interface — page down to 1045 lines.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 completed
- **Files modified:** 7 (5 created, 2 modified)
- **Net LOC:** `ReleaseDetailPage.tsx` 1167 → 1045 lines (-122)

## Accomplishments

- `release-detail/MetaRow.tsx`: private copy of the shared layout row, keeps `flex-1 min-w-0` (the one-class delta from `issue-detail/MetaRow.tsx` that D-13 mandates stays private), inline destructured prop type preserved (documented exception to the `interface XxxProps` convention).
- `release-detail/ReleaseDetailSkeleton.tsx`: verbatim two-column loading skeleton, `data-testid="release-detail-skeleton"` and the `width: 288` right-column style preserved.
- `release-detail/ReleaseHeader.tsx`: two named exports, `ReleaseBreadcrumbHeader` (renders unconditionally above the loading ternary, null-guards on `trail.length`, accepts `onBack`/`onBreadcrumbClick` closures rather than importing `useNavigate`/`useBreadcrumbStore` itself) and `ReleaseTitleHeading` (renders only inside the loaded branch, non-nullable `versionId`/`versionName` props).
- `release-detail/DescriptionsSection.tsx`: verbatim three-way description ternary (collapsed-empty branch, Jira section with dynamic heading text, conditional GitLab section with `ReactMarkdown`/`remarkGfm`), no `rehype-raw` or `dangerouslySetInnerHTML` added (T-87-06 mitigation held).
- `release-detail/LabelSummarySection.tsx`: verbatim label chip list, gate rewritten to an explicit `milestoneMRsLoaded` boolean prop (shell passes `!!milestoneMRs`).
- `ReleaseDetailPage.tsx` rewired: all five sections imported by direct relative path (no barrel), unused `ArrowLeft`/`Rocket`/`Skeleton`/`ReactMarkdown`/`remarkGfm`/`FileText`/`Tag` imports dropped, `handleBreadcrumbClick` closure added at shell level.
- `breadcrumb.store.ts`: `TrailEntry` interface exported (previously private) so `ReleaseHeader.tsx` can type its `trail` prop against the canonical store shape.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract MetaRow.tsx and ReleaseDetailSkeleton.tsx** - `648b3896` (feat)
2. **Task 2: Extract ReleaseHeader.tsx (breadcrumb header + title heading as two exports)** - `4949385d` (feat)
3. **Task 3: Extract DescriptionsSection.tsx and LabelSummarySection.tsx** - `c41f93e3` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `taskflow/src/routes/dashboard/release-detail/MetaRow.tsx` - new (8 lines)
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx` - new (21 lines)
- `taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx` - new (61 lines)
- `taskflow/src/routes/dashboard/release-detail/DescriptionsSection.tsx` - new (62 lines)
- `taskflow/src/routes/dashboard/release-detail/LabelSummarySection.tsx` - new (34 lines)
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` - sections deleted/rewired, 1167 → 1045 lines
- `taskflow/src/stores/breadcrumb.store.ts` - `TrailEntry` interface exported

## Decisions Made

- Followed `issue-detail/MergeRequestsSection.tsx` as the structural analog per 87-PATTERNS.md for all five sections: named export, `interface XxxProps` immediately above the component, props destructured in the signature, presentational only (no routing/store hooks except the documented `MetaRow` inline-type exception).
- Kept the `ReleaseHeader.tsx` split into two named exports rather than one, per the plan's explicit RESEARCH-driven deviation instruction — this preserves the exact DOM position of both the breadcrumb (outside the loading ternary) and the title heading (inside the loaded left column).
- No `release-detail/index.ts` barrel created (D-05); every section imported by direct relative path from the page shell.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported TrailEntry from breadcrumb.store.ts**
- **Found during:** Task 2
- **Issue:** The plan instructs `ReleaseBreadcrumbHeaderProps.trail` to "use the trail element type from `@/stores/breadcrumb.store`," but the store's `TrailEntry` interface was private (not exported), which would have blocked the import.
- **Fix:** Added `export` to the existing `interface TrailEntry` declaration in `breadcrumb.store.ts`. No behavior change — purely a type-visibility fix.
- **Files modified:** `taskflow/src/stores/breadcrumb.store.ts`
- **Commit:** `4949385d`

**2. [Rule 1 - Lint] Biome import-sort and formatting**
- **Found during:** Task 2 and Task 3 `npm run check`
- **Issue:** New relative imports were not alphabetically sorted relative to existing same-folder imports; `LabelSummarySectionProps`'s inline object-array type exceeded the line-length wrap threshold.
- **Fix:** Ran `npx biome check --write` / `npx biome format --write` on the affected files.
- **Files modified:** `ReleaseDetailPage.tsx`, `LabelSummarySection.tsx`
- **Verification:** `npx biome check` clean on all touched files; `npm run check` shows exactly the pre-existing 2-error `BacklogPage.tsx`/`BacklogRow.tsx` baseline (0 new).
- **Committed in:** `4949385d`, `c41f93e3`

### Documented Plan Deviation (planner-authored)

**D-01 split:** `ReleaseHeader.tsx` exports two components (`ReleaseBreadcrumbHeader`, `ReleaseTitleHeading`) rather than one — the plan's own `<action>` block calls this out explicitly (RESEARCH.md §1 verified the breadcrumb and title heading are not adjacent in the JSX tree; a single merged component would move the heading out of the left column and change the DOM). Not an executor-introduced deviation — following the plan as written.

---

**Total deviations:** 2 auto-fixed (Rule 3 type-export, Rule 1 formatting), 1 plan-documented structural note (not a deviation from instructions)
**Impact on plan:** None on scope or behavior; all functional acceptance criteria pass.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plans 04-06 can continue extracting the remaining `ReleaseDetailPage.tsx` sections (Issues/UnmatchedMRs table, ReleaseDetailSidebar, EditReleaseModal) using the same direct-path-import, `interface XxxProps`, presentational-only convention established here. The page shell still owns `useResizable`/`containerRef`, all edit-modal state/handlers, and now also `handleBreadcrumbClick` — none of these move until their respective plans.

No blockers.

---
*Phase: 87-release-detail-decomposition*
*Completed: 2026-08-10*
