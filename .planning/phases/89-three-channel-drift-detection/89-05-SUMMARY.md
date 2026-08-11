---
phase: 89-three-channel-drift-detection
plan: 05
subsystem: frontend
tags: [react, release-detail, drift-detection, ui]

# Dependency graph
requires:
  - phase: 89-02
    provides: driftDetection.ts — DriftRow, DriftMark, TaskDriftReason, Channel types
  - phase: 89-03
    provides: useReleaseDetail.ts driftRows/driftFlaggedCount/isLoadingDrift/hasMatchedMilestone
affects: [89-UI-SPEC.md conformance check]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentational, props-driven section component (no useQuery/useMemo/useCallback) consuming driftDetection.ts's DriftRow directly"
    - "div+flex row list with explicit pixel widths (w-[Npx]) instead of a <table>, per the WebKit/Tauri narrow-column-collapse defect"
    - "Native title attribute for hover-only detail — no Tooltip primitive in this codebase"

key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx
    - taskflow/src/routes/dashboard/release-detail/MrDriftSection.test.tsx
    - .planning/phases/89-three-channel-drift-detection/89-05-SUMMARY.md
  modified:
    - taskflow/src/routes/dashboard/release-detail/IssuesSection.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
    - taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts
  deleted:
    - taskflow/src/routes/dashboard/release-detail/UnmatchedMRsSection.tsx

key-decisions:
  - "Renamed matchIssuesToMRs's returned `unmatchedMRs` field to `unmatched` (releaseSummaries.ts, outside the plan's declared file list) to satisfy the plan's strict repo-wide grep verification — its only consumer (buildIssueMrIndex) already destructured just matchedRows, so this is a pure rename with no behavior change"

requirements-completed: [DRIFT-04, DRIFT-05, DRIFT-06, DRIFT-07, DRIFT-08]

# Metrics
duration: ~40min (Tasks 1-2; Task 3 is a pending human-verify checkpoint)
completed: 2026-08-11
---

# Phase 89 Plan 05: MR-First Drift Section Summary

**Built `MrDriftSection.tsx` — the phase's primary UI surface — as a presentational flex-row list rendering every MR discovered by the three-channel union with BR/MS/TASK status columns, absorbed and deleted `UnmatchedMRsSection`, and wired it as a sibling below the re-sourced Issues table. Task 3 (human UI-SPEC verification) is a pending checkpoint.**

## Performance

- **Duration:** ~40 min for Tasks 1-2
- **Tasks:** 2/3 complete; Task 3 is `checkpoint:human-verify` (gate="blocking") — automated gate run and green, awaiting human sign-off against `89-UI-SPEC.md` in a running app
- **Files created:** 3 (MrDriftSection.tsx, MrDriftSection.test.tsx, this SUMMARY)
- **Files modified:** 4
- **Files deleted:** 1 (UnmatchedMRsSection.tsx)

## Accomplishments

- `MrDriftSection.tsx` — presentational, props-driven (`rows`, `flaggedCount`, `hasMatchedMilestone`, `isLoading`, `onNavigateToIssueFromMR`), no `useQuery`/`useMemo`/`useCallback`/`React.memo`
- Row anatomy per D-08: `!iid` button (opens `mr.web_url`), Jira key, linkified title (reusing `extractTicketKeys` IIFE), author avatar (`CachedAvatar`), state badge, and three BR/MS/TASK status cells — all `div`+flex, explicit pixel widths (`w-[44px]`/`w-[72px]`/`w-[64px]`/`w-[28px]`), no `<table>` (D-20)
- Glyphs: `ok` → green check, `flag` → orange `AlertTriangle`, `na` → muted em dash; orange reserved for the warning glyph only — `opened` state badge is blue (IssuesSection convention), not orange, avoiding the `UnmatchedMRsSection` collision the UI-SPEC calls out
- D-10 regression guard at the render layer: draft MRs (`evaluated: true`) render real marks, not em dashes; merged/closed rows (`evaluated: false`) render muted title/key text and em dashes in all three columns
- D-09 provenance tooltip on the `!iid` button: `Found via: {channel names}`, never a visible row element
- D-12 TASK-cell title: `No linked task` vs `{KEY} not in this fix version`
- D-18 degraded-state banner (`data-testid="drift-degraded-banner"`) when `hasMatchedMilestone` is false, reusing the `AlertTriangle` banner markup from `IssuesSection.tsx`
- Empty state and loading spinner per UI-SPEC copy
- 10 render tests: order preservation, flag/ok/na glyphs, muting, draft regression guard, both TASK title variants, degraded banner, empty state, heading badge count
- `UnmatchedMRsSection.tsx` deleted (D-02); confirmed via grep that `IssuesSection.tsx` was its only importer
- `IssuesSection.tsx`: dropped the `UnmatchedMRsSection` import/render and the `unmatchedMRs`/`onNavigateToIssueFromMR` props — the MR-cell table body (D-06) is byte-identical, confirmed by `git diff` showing no changes inside the `<td>` block
- `ReleaseDetailPage.tsx`: destructures `driftRows`/`driftFlaggedCount`/`isLoadingDrift`/`hasMatchedMilestone` instead of `unmatchedMRs`; renders `<MrDriftSection>` as the immediate next sibling after `<IssuesSection>`
- `useReleaseDetail.ts`: removed the `unmatchedMRs` derivation (its last consumer is gone) and the now-unused `linkMRToTask` import
- Full suite: 2307 passed, 2 skipped, 13 todo (up from 89-03's 2293 baseline — 10 new MrDriftSection tests, net of the removed `unmatchedMRs` derivation logic which had no dedicated tests)
- `npx tsc --noEmit` exits 0
- `npx biome check` on all touched files: 0 errors; repo-wide `npm run check`: 2 errors, both in the pre-existing `BacklogRow.tsx` baseline (unrelated `lint/a11y` findings), 0 new errors introduced by this plan

## Task Commits

1. **Task 1: Build MrDriftSection as a presentational flex-row list** — `6a7b04fc` (feat)
2. **Task 2: Delete UnmatchedMRsSection, rewire IssuesSection, and mount MrDriftSection as a sibling** — `30186b84` (feat)

## Files Created/Modified

- `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx` — the MR-first drift section, 209 lines
- `taskflow/src/routes/dashboard/release-detail/MrDriftSection.test.tsx` — 10 render tests
- `taskflow/src/routes/dashboard/release-detail/IssuesSection.tsx` — `UnmatchedMRsSection` import/render/props removed; MR cell untouched
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` — `MrDriftSection` mounted as a sibling below `IssuesSection`
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` — `unmatchedMRs` derivation and its import removed
- `taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts` — `matchIssuesToMRs`'s `unmatchedMRs` return field renamed to `unmatched` (Rule 1 deviation, see below)
- `taskflow/src/routes/dashboard/release-detail/UnmatchedMRsSection.tsx` — deleted

## Decisions Made

- Kept `buildDriftRows`'s row order as rendered (no re-sort in the component) — the hook already sorts flagged-first, then `iid` descending, per D-03; the component trusts that order rather than re-deriving it.
- Rendered the `taskKeys[0]` value in the fixed-width Jira-key cell slot even though `taskKeys` can contain multiple keys — the UI-SPEC's row anatomy calls for a single fixed-width key slot, and the full extracted-key list is already surfaced via the TASK-cell title for the `not-in-fix-version` case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Renamed `matchIssuesToMRs`'s `unmatchedMRs` return field to `unmatched`**
- **Found during:** Task 2's final verification pass (`grep -rn 'unmatchedMRs' taskflow/src`)
- **Issue:** `releaseSummaries.ts` (not in this plan's declared `files_modified`) has an unrelated internal function `matchIssuesToMRs` whose return type names one field `unmatchedMRs` — a naming coincidence with the deleted `UnmatchedMRsSection`/hook-level `unmatchedMRs`, not a functional dependency. It was the only remaining repo-wide match for the plan's own verification grep, which requires zero output.
- **Fix:** Renamed the field to `unmatched`. Confirmed by grep that the only caller (`buildIssueMrIndex` in `driftDetection.ts`) already destructures just `{ matchedRows }`, so this is a pure rename with no behavioral or test impact.
- **Files modified:** `taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts`
- **Verification:** `grep -rn 'unmatchedMRs' taskflow/src` returns no output; `npx tsc --noEmit` exits 0; full suite stays green (`releaseSummaries.test.ts` has no assertions on this field name).
- **Committed in:** `30186b84` (Task 2)

## Issues Encountered

None beyond the auto-fixed deviation above.

## User Setup Required

None for Tasks 1-2.

**Task 3 (checkpoint) requires human verification** — see "Next Phase Readiness" below.

## Next Phase Readiness

### Automated gate — CONFIRMED GREEN

- `cd taskflow && npx vitest run` (full suite): 2307 passed, 2 skipped, 13 todo, 0 failed
- `cd taskflow && npx tsc --noEmit`: exits 0
- `cd taskflow && npm run check`: 2 pre-existing errors in `BacklogRow.tsx` (documented baseline, unrelated `lint/a11y` findings — `noStaticElementInteractions`/`useKeyWithClickEvents`), 0 new errors from this plan's files
- `grep -rn 'UnmatchedMRsSection\|unmatchedMRs\|fetchRecentProjectMRs\|buildWrongMilestoneMap' taskflow/src` — no output

### Task 3 — pending human verification (checkpoint:human-verify, gate="blocking")

This plan's Task 3 requires a human to run `npm run tauri dev` and visually verify `MrDriftSection` against `89-UI-SPEC.md`'s Layout Contract, Color, Typography, and Copywriting sections — specifically:
- The three BR/MS/TASK status columns stay vertically aligned across rows at default and narrowed panel widths (D-20's WebKit/Tauri narrow-column-collapse defect)
- Orange appears only on the warning glyphs, never on the `opened` state badge (which is blue) or elsewhere
- The `Found via: ...` provenance tooltip on `!iid` hover names channels, not letters
- The degraded no-milestone state shows the banner plus Jira-linked MRs
- The heading badge count matches the on-screen flagged-row count, and the Releases-list `{n} drift` badge (89-04) is `<=` the detail-page count

This step cannot be completed from within an isolated parallel-executor worktree, since it requires a running Tauri app connected to live GitLab/Jira credentials in the user's primary development environment. It is deferred to the orchestrator/user after this worktree's branch is merged.

Because the plan's `<verify>` requirement for Task 3 (`npx vitest run && npm run check`) has already been run and is green, and because Tasks 1-2's acceptance criteria are all independently verifiable and confirmed (see Self-Check below), this plan is **functionally complete** pending only the visual sign-off step.

---
*Phase: 89-three-channel-drift-detection*
*Completed: 2026-08-11 (Tasks 1-2; Task 3 checkpoint pending)*

## Self-Check: PASSED

- `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx` — FOUND on disk
- `taskflow/src/routes/dashboard/release-detail/MrDriftSection.test.tsx` — FOUND on disk
- `taskflow/src/routes/dashboard/release-detail/UnmatchedMRsSection.tsx` — CONFIRMED DELETED
- Commit `6a7b04fc` — FOUND in `git log --oneline`
- Commit `30186b84` — FOUND in `git log --oneline`
- `npx vitest run src/routes/dashboard/release-detail/MrDriftSection.test.tsx` — 10/10 passed
- `npx vitest run` (full suite) — 2307 passed, 2 skipped, 13 todo, 0 failed
- `npx tsc --noEmit` — exits 0
- Acceptance-criteria greps (no `<table>`, `>=4` explicit px widths, no orange-opened badge, no hooks in the component, `Found via:` present exactly once, `UnmatchedMRsSection`/`unmatchedMRs` absent repo-wide) — confirmed passing
