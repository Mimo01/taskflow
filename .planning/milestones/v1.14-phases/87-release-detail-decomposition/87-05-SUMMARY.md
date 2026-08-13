---
phase: 87-release-detail-decomposition
plan: 05
subsystem: refactor
tags: [react, typescript, decomposition, jsx-extraction, hooks]

requires: ["87-04"]
provides:
  - "release-detail/ReleaseDetailSidebar.tsx — presentational sidebar, drag handle + Details MetaRows + MR-state/issue-status/story-point distribution blocks, props-driven (D-08)"
  - "release-detail/useEditRelease.ts — edit-modal state, diff builders and the combined Jira+GitLab save with its four cache invalidations"
  - "ReleaseDetailPage.tsx down to 473 lines (from 779), useResizable/containerRef stay in the shell, edit-modal JSX still inline (Plan 06 extracts it)"
affects: [87-06]

tech-stack:
  added: []
  patterns:
    - "Named exports only, interface XxxProps above the component (issue-detail/IssueDetailSidebar.tsx convention)"
    - "useResizable stays in the page shell (owns containerRef); only width/isDragging/onResizeMouseDown cross the prop boundary into the sidebar (hazard 7)"
    - "Co-located feature hook (release-detail/useEditRelease.ts, NOT src/hooks/) returning one flat object, matching issue-detail/useFieldMutation.ts's placement convention (D-10)"

key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
    - taskflow/src/routes/dashboard/release-detail/useEditRelease.ts
  modified:
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx

key-decisions:
  - "useEditRelease's exact return-object field list (all 21 fields, for Plan 06 to wire EditReleaseModal props without re-reading the hook): editing, setEditing, editName, setEditName, editDate, setEditDate, editDescription, setEditDescription, editReleased, setEditReleased, editMilestoneTitle, setEditMilestoneTitle, editMilestoneDescription, setEditMilestoneDescription, jiraError, gitlabError, isSaving, isEditDirty, isMilestoneTitleInvalid, startEditing, cancelEditing, handleSave. (Page shell destructures everything except setEditing, which it no longer needs directly since startEditing/cancelEditing/handleSave already own all editing-flag transitions.)"
  - "ReleaseDetailPage.tsx post-Plan-05: 473 lines."

requirements-completed: [FOUND-01]

duration: 20min
completed: 2026-08-10
---

# Phase 87 Plan 05: Release Detail — Sidebar and Edit-State Extraction Summary

**Extracted the right sidebar into `ReleaseDetailSidebar.tsx` and lifted all edit-modal state/diff-builders/combined-save into a co-located `useEditRelease.ts` hook, taking the page shell from 779 to 473 lines with zero behavior change.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 3 (2 created, 1 modified)
- **Net LOC:** `ReleaseDetailPage.tsx` 779 → 473 lines (-306)

## Accomplishments

- `release-detail/ReleaseDetailSidebar.tsx`: verbatim drag-handle markup (`cursor-ew-resize`, `var(--ring)` hover/drag border), Details heading + Edit button, all Status/Release Date/GitLab Milestone/MR Labels `MetaRow`s, and the three conditional distribution blocks (MR state, issue status, story points) — all kept inline in one file per the `IssueDetailSidebar` granularity precedent. No `useResizable`/`useQuery`/`useSettingsStore`/`useAuthStore` imports (confirmed via grep, D-08 held).
- `release-detail/useEditRelease.ts`: all 10 `useState` declarations, `startEditing`, `cancelEditing`, `buildJiraDiff`, `buildGitlabDiff`, `isEditDirty`, `isMilestoneTitleInvalid`, and `handleSave` moved verbatim — same `Promise.allSettled` shape, same per-source error messages/fallbacks, same no-rollback partial-failure semantics, and the same four `queryClient.invalidateQueries` calls (`jira-fix-versions`, `jira-version-counts`, `gitlab-milestones`, `gitlab-milestone-mrs`) with the original explanatory comment preserved above the milestone-MRs invalidation. No `useMutation`/`useCallback`/`useMemo` introduced.
- `ReleaseDetailPage.tsx`: calls `useEditRelease({...})` unconditionally alongside `useReleaseDetail(versionId)`, both above the `if (!versionId) return null` guard (confirmed via `grep -n`: lines 79/104 for the two hooks, line 183 for the guard). Renders `<ReleaseDetailSidebar ... />` in place of the inline block. Dropped now-unused imports: `Pencil`, `Badge`, `Calendar`, `AlertTriangle`, `GitMerge`, `useQueryClient`, `updateFixVersion`, `updateMilestone`, `readSecret`. The edit-modal JSX itself stays inline in the page — Plan 06 extracts it into `EditReleaseModal.tsx`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract ReleaseDetailSidebar.tsx** - `1c38c137` (feat)
2. **Task 2: Extract useEditRelease.ts (edit state, diff builders, combined save)** - `a952d00c` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` - new (243 lines)
- `taskflow/src/routes/dashboard/release-detail/useEditRelease.ts` - new (212 lines)
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` - sidebar block + edit state/handlers extracted, 779 → 473 lines

## Decisions Made

- Followed `issue-detail/IssueDetailSidebar.tsx` as the structural precedent: `interface ReleaseDetailSidebarProps` above the component, props destructured in the signature, sub-blocks kept inline rather than split into further files.
- `useResizable()`/`containerRef` stayed in the page shell exactly as directed (RESEARCH hazard 7) — only `width`, `isDragging`, and `onResizeMouseDown` (renamed from the shell's local `handleMouseDown` at the prop boundary, matching the plan's specified prop name) cross into the sidebar.
- `useEditRelease.ts` co-located in `release-detail/`, not `src/hooks/`, per D-10 and the `useFieldMutation.ts` placement convention.
- Full 21-field return-object list recorded above in `key-decisions` for Plan 06's `EditReleaseModal` wiring.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `setEditing` destructure and leftover `queryClient` declaration in the page shell**
- **Found during:** Task 2, `npx tsc --noEmit`
- **Issue:** After moving `handleSave`/`startEditing`/`cancelEditing` into `useEditRelease`, two things needed cleanup for a valid build: (a) the page no longer calls `setEditing` directly (all editing-flag transitions now happen inside the hook's own functions), so destructuring it in the page tripped `noUnusedParameters`/`noUnusedLocals`; (b) the page's old `const queryClient = useQueryClient();` line was left behind after the import itself was dropped in Task 1, which would have been a stale/undefined reference.
- **Fix:** Dropped `setEditing` from the page's destructure of `useEditRelease()`'s return (still returned by the hook itself, satisfying the plan's required return-object shape) and removed the orphaned `queryClient` declaration line.
- **Files modified:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx`
- **Verification:** `npx tsc --noEmit -p .` exits clean; `npm run check` at the pre-existing 2-error baseline (unrelated `BacklogPage.tsx`/`BacklogRow.tsx`).
- **Commit:** `a952d00c`

### Documented plan-text imprecision (not a code issue)

- Task 2's acceptance criterion `grep -c "useState(" ... returns 10` observes 8, not 10, because `jiraError`/`gitlabError` use the generic form `useState<string | null>(null)` — the substring `useState(` doesn't match `useState<string | null>(`. All 10 `useState` declarations are present and verbatim (confirmed via `grep -c "useState"` = 11, i.e. 10 declarations + 1 import line). No code change needed; this is a grep-pattern gap in the plan's own acceptance text, not a deviation from the required move.

**Total deviations:** 1 auto-fixed build-cleanup fix (Rule 1); 1 documented plan-text imprecision (no code impact).
**Impact on plan:** None on scope — all functional and structural acceptance criteria pass.

## Issues Encountered

None blocking.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 06 can now extract the remaining inline edit-modal JSX into `EditReleaseModal.tsx`, threading the full 21-field `useEditRelease()` return object (listed above under `key-decisions`) as its props without needing to re-read `useEditRelease.ts`. The page shell's edit-modal `<Dialog.Root>` block (still inline) is the only remaining heavyweight JSX section; `ReleaseDetailPage.tsx` is already at 473 lines, within D-06's 150-250 target once the modal is extracted.

No blockers.

## Self-Check

- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` - FOUND
- `taskflow/src/routes/dashboard/release-detail/useEditRelease.ts` - FOUND
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` - FOUND (473 lines)
- Commit `1c38c137` - FOUND
- Commit `a952d00c` - FOUND

## Self-Check: PASSED

All created/modified files verified present on disk; both commits verified in git log.

---
*Phase: 87-release-detail-decomposition*
*Completed: 2026-08-10*
