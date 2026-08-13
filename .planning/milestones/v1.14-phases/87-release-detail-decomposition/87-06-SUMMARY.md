---
phase: 87-release-detail-decomposition
plan: 06
subsystem: refactor
tags: [react, typescript, decomposition, jsx-extraction]

requires: ["87-05"]
provides:
  - "release-detail/EditReleaseModal.tsx — presentational Edit Release dialog, props-driven from useEditRelease's 21-field return object (D-08)"
  - "ReleaseDetailPage.tsx down to 322 lines (from 473), release-detail/ folder finished at 13 files, no index.ts barrel"
affects: []

tech-stack:
  added: []
  patterns:
    - "Named export, interface EditReleaseModalProps above the component (issue-detail/ convention)"
    - "@base-ui/react/dialog primitive preserved verbatim — no swap (T-87-14)"
    - "Setter props typed as (v: string) => void / (v: boolean) => void rather than Dispatch<SetStateAction<T>>, matching how the page shell already destructures useEditRelease's setters"

key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/EditReleaseModal.tsx
  modified:
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx

key-decisions:
  - "ReleaseDetailPage.tsx final LOC: 322 lines (below the pre-refactor 1518, above D-06's 150-250 target). D-06 is a stated health indicator, not a hard gate — the remaining bulk is the page-level orchestration (breadcrumb/pin/open-in-jira handlers, useReleaseDetail/useEditRelease wiring, useResizable) that has no further natural extraction target without violating D-16 (no speculative splits)."
  - "release-detail/ folder finished at exactly 13 files: releaseSummaries.ts, releaseSummaries.test.ts, useReleaseDetail.ts, useEditRelease.ts, MetaRow.tsx, ReleaseDetailSkeleton.tsx, ReleaseHeader.tsx, DescriptionsSection.tsx, LabelSummarySection.tsx, IssuesSection.tsx, UnmatchedMRsSection.tsx, ReleaseDetailSidebar.tsx, EditReleaseModal.tsx. No index.ts (D-05)."
  - "Task 3 manual UAT: user ran the 11-step click-through in 87-VALIDATION.md and approved with no visual or behavioral differences from the pre-refactor page, including explicit confirmation of the step-6 DOM nesting check and the step-11 query-cache sharing check."

requirements-completed: [FOUND-01]

duration: 20min
completed: 2026-08-10
---

# Phase 87 Plan 06: Release Detail — Edit Modal Extraction and Phase Close Summary

**Extracted the Edit Release dialog into `EditReleaseModal.tsx` as a pure presentational component wired from `useEditRelease`'s existing return object, completing the `release-detail/` decomposition at 13 files with zero behavior change; `ReleaseDetailPage.tsx` now sits at 322 lines.**

## Performance

- **Duration:** ~20 min (Tasks 1-2 ~15min, Task 3 checkpoint approval + final verification pass ~5min)
- **Tasks:** 3 of 3 completed
- **Files modified:** 2 (1 created, 1 modified)
- **Net LOC:** `ReleaseDetailPage.tsx` 473 → 322 lines (-151)

## Accomplishments

- `release-detail/EditReleaseModal.tsx`: verbatim `Dialog.Root`/`Dialog.Portal`/`Dialog.Backdrop`/`Dialog.Popup`/`Dialog.Close` structure from `@base-ui/react/dialog` (T-87-14: no primitive swap), all six controlled fields (name, date, description, released toggle, milestone title, milestone description) with original `id`/`htmlFor` pairs and `disabled={isSaving}` flags, the GitLab milestone fieldset gated on a new `showMilestoneSection` boolean prop, both `Jira: {jiraError}` / `GitLab: {gitlabError}` error banners, and the footer Cancel/Save buttons with the `isSaving` spinner swap — all class strings byte-identical to the pre-refactor JSX. 14 props total (`open`, `onOpenChange`, 6 controlled `edit*`/`setEdit*` pairs, `isSaving`, 2 error strings, `showMilestoneSection`, `isSaveDisabled`, `onCancel`, `onSave`). No `useEditRelease`/`useQuery`/store hook imports (confirmed via grep, D-08 held).
- `ReleaseDetailPage.tsx`: replaced the ~175-line inline `Dialog.Root` block with `<EditReleaseModal ... />` at its original position (last child of the resizable-container wrapper, after the sidebar). `showMilestoneSection={gitlabMatch.type !== 'none' && !!matchedMilestone}` and `isSaveDisabled={isSaving || !editName.trim() || !isEditDirty || isMilestoneTitleInvalid}` computed inline in the shell — the latter copied character-for-character from the original Save button's `disabled` expression. Dropped now-unused `Dialog`, `Input`, `Textarea`, `X`, `Loader2`, `Check` imports.
- Task 2 structural audit: confirmed `release-detail/` holds exactly the 13 expected files with no `index.ts` barrel and no `TODO`/`placeholder`/`Phase 88-91` forward-shaping seams (D-16). No unused imports or stale comments found in the finished shell — no tidy-up changes were needed. Route entry unchanged: `ReleaseDetailPage.tsx` still exports `export default function ReleaseDetailPage()` from `routes/dashboard/ReleaseDetailPage.tsx`, imported by `routes/routes.tsx` via `lazy(() => import('./dashboard/ReleaseDetailPage'))`.

## Task Commits

1. **Task 1: Extract EditReleaseModal.tsx** - `a663f1a4` (feat)
2. **Task 2: Final structural audit and full-suite regression gate** - no code changes required; audit-only, folded into this SUMMARY
3. **Task 3: Manual UAT click-through** - checkpoint, no code changes; result recorded below, folded into the final SUMMARY commit

## Files Created/Modified

- `taskflow/src/routes/dashboard/release-detail/EditReleaseModal.tsx` - new (203 lines)
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` - edit-modal JSX extracted, 473 → 322 lines

## Decisions Made

- `ReleaseDetailPage.tsx` final LOC (322) recorded above D-06's 150-250 target range; treated per plan instruction as a reported health indicator, not a gate requiring further splitting.
- Setter props on `EditReleaseModalProps` typed as plain `(v: string) => void` / `(v: boolean) => void` rather than `Dispatch<SetStateAction<T>>`, matching how the page shell already destructures and forwards `useEditRelease`'s returned setters (no `Dispatch` import needed).

## Verification

- `cd taskflow && npm run check` — 2 errors, both pre-existing baseline formatting errors in `BacklogPage.tsx` / `BacklogRow.tsx` (confirmed by name, not new). 30 pre-existing warnings, none referencing `ReleaseDetailPage.tsx` or `EditReleaseModal.tsx`.
- `cd taskflow && npx tsc --noEmit -p .` — clean, no output.
- Pre-commit hook ran the full Vitest suite on the Task 1 commit: 169 test files passed (2 skipped), 2083 tests passed (2 skipped, 13 todo), 0 failing — D-15 held, `ReleasesTab.test.tsx` and `UpcomingReleasesTimeline.test.tsx` included in that green run.
- `grep -c "export default function ReleaseDetailPage"` → 1; `grep -c "useQuery(\|Dialog.Root\|cursor-ew-resize\|async function fetch"` in `ReleaseDetailPage.tsx` → 0; `ls release-detail/` → 13 files, no `index.ts`; `grep -rc "TODO\|placeholder\|Phase 88\|Phase 89\|Phase 90\|Phase 91"` in `release-detail/` → 0 matches; `git grep -n "ReleaseDetailPage" -- taskflow/src` shows the route import path (`routes/routes.tsx`) unchanged.

## Deviations from Plan

None - Tasks 1 and 2 executed exactly as written. No auto-fixes were needed.

## Issues Encountered

None blocking.

## User Setup Required

None - no external service configuration required.

## Task 3: Manual UAT — PASSED (approved)

Task 3 was a `checkpoint:human-verify` gate (`gate="blocking"`) requiring the user to click through the 11-step verification path in `87-VALIDATION.md` § Manual-Only Verifications, since `ReleaseDetailPage` has no automated characterization test (D-14) and this was the phase's only means of verifying Success Criterion 1 ("renders identically").

**Result:** The user ran the full 11-step click-through and responded **"approved"**. All 11 steps passed with no visual or behavioral differences reported from the pre-refactor page, including the two explicitly-flagged structural checks:

- **Step 6 (D-12b DOM nesting):** confirmed the Unmatched MRs block is a DOM descendant of the Issues `<section>` — not a sibling, not a separate card below the section.
- **Step 11 (D-11 cache sharing):** confirmed navigating Releases tab → release detail → back shows no refetch/loading flash for the releases list; `jira-fix-versions`, `jira-version-counts`, and `gitlab-milestones` query keys remain shared across the round trip.

No differences were reported for any of the other 9 steps (loading skeleton + breadcrumb visibility, header, all three description-rendering branches, label chips, issues table across all four MR-match states, ticket-key/row navigation, sidebar rows and resize handle, edit-modal save-disabled logic and refresh-on-save, pin/unpin and Open in Jira).

## Next Phase Readiness

Phase 87 closes with Task 3 approved. All three success criteria are satisfied: FOUND-01 SC1 (identical rendering, manual UAT approved), FOUND-01 SC2 (`release-detail/` holds 13 files mirroring `issue-detail/`, shell unmoved), FOUND-01 SC3 (full suite green, including `ReleasesTab.test.tsx` and `UpcomingReleasesTimeline.test.tsx`). v1.14 moves to Phase 88 (Release branch + GitLab milestone existence/create).

## Self-Check

- `taskflow/src/routes/dashboard/release-detail/EditReleaseModal.tsx` - FOUND
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` - FOUND (322 lines)
- Commit `a663f1a4` - FOUND
- Commit `3e81fc74` (draft SUMMARY, Tasks 1-2) - FOUND
- `npx tsc --noEmit -p .` re-run at finalization - clean, no output
- `npm run check` re-run at finalization - 2 errors (BacklogPage.tsx / BacklogRow.tsx baseline only), 30 warnings
- `npm test -- ReleasesTab.test.tsx UpcomingReleasesTimeline.test.tsx releaseSummaries.test.ts` re-run at finalization - 3 files / 40 tests passed
- `npm test` (full suite) re-run at finalization - 169 passed / 2 skipped test files, 2083 passed / 2 skipped / 13 todo tests, 0 failing

## Self-Check: PASSED

All created/modified files verified present on disk; both commits verified in git log; full verification suite re-run at finalization time and confirmed at the expected baseline with zero regressions.

---
*Phase: 87-release-detail-decomposition*
*Completed: 2026-08-10*
