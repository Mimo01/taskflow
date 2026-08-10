---
phase: 87-release-detail-decomposition
plan: 04
subsystem: refactor
tags: [react, typescript, decomposition, jsx-extraction]

requires: ["87-03"]
provides:
  - "release-detail/UnmatchedMRsSection.tsx — presentational leaf, unmatched-MRs list, no routing/store hooks"
  - "release-detail/IssuesSection.tsx — Issues heading/badge, progress bar, milestone warning, issues table, nests UnmatchedMRsSection as its last child (D-12b)"
  - "ReleaseDetailPage.tsx down to 779 lines (from 1045), renders a single <IssuesSection /> and never references UnmatchedMRsSection"
affects: [87-05, 87-06]

tech-stack:
  added: []
  patterns:
    - "Named exports only, interface XxxProps above the component (issue-detail/ convention)"
    - "Composition-parent pattern: IssuesSection imports and renders UnmatchedMRsSection as a JSX child inside the same <section> wrapper (mirrors issue-detail/IssueDetailSidebar.tsx)"
    - "PEEK-05 key/body split preserved: a dedicated onOpenIssueFull prop for the explicit key-link click, separate from the row-body onOpenIssue (which may resolve to a peek-panel opener from outlet context)"

key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/UnmatchedMRsSection.tsx
    - taskflow/src/routes/dashboard/release-detail/IssuesSection.tsx
  modified:
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx

key-decisions:
  - "PLANNER DEVIATION (Rule 1 - bug prevention): added a distinct onOpenIssueFull prop to IssuesSection alongside onOpenIssue. The plan's prop list specified only onOpenIssue for both the row body and the issue-key <button>, but the pre-refactor code called `openIssueFull()` directly and unconditionally from the key button (bypassing any outlet-context peek handler), while the row body used `(onOpenIssue ?? openIssueFull)`. main.tsx always wires an onOpenIssue peek handler onto the outlet context for nested routes, so collapsing both handlers onto one resolved prop would have made the key-link click open the peek panel instead of always navigating full-page — a regression of the app-wide PEEK-05 key/body split pattern (see BacklogRow.tsx's identical split: onIssueClick for the key button vs (onOpenIssue ?? onIssueClick) for the row body)."

requirements-completed: [FOUND-01]

duration: 25min
completed: 2026-08-10
---

# Phase 87 Plan 04: Release Detail — Issues Section Extraction Summary

**Extracted the phase's highest-risk block — the Issues table with MR matching and its nested Unmatched MRs list — into `release-detail/IssuesSection.tsx` + `release-detail/UnmatchedMRsSection.tsx`, preserving the D-12b nesting and the PEEK-05 key/body click split; page down to 779 lines.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 3 (2 created, 1 modified)
- **Net LOC:** `ReleaseDetailPage.tsx` 1045 → 779 lines (-266)

## Accomplishments

- `release-detail/UnmatchedMRsSection.tsx`: props-driven leaf (`unmatchedMRs`, `onNavigateToIssueFromMR`), verbatim markup (heading, subtitle, per-MR row with `GitMerge` state color, `extractTicketKeys` inline-key-splicing IIFE), no routing/store hook imports (D-08).
- `release-detail/IssuesSection.tsx`: verbatim Issues heading/badge, `Progress` bar, milestone-warning banner, loading/empty/table states, all four MR-match cell states (matched, no-milestone, wrong-milestone, missing-MR), with `<UnmatchedMRsSection>` rendered as the LAST CHILD inside the same `<section>` wrapper — confirmed by `grep -n`:
  ```
  224:      <UnmatchedMRsSection
  228:    </section>
  ```
  `<UnmatchedMRsSection` (line 224) precedes `</section>` (line 228) — the D-12b structural gate holds.
- `ReleaseDetailPage.tsx`: the entire inline Issues/Unmatched-MRs block replaced with a single `<IssuesSection />` render; `resolvedOnOpenIssue = onOpenIssue ?? openIssueFull` and `handleNavigateToIssueFromMR` closures added at shell level; Action Buttons block and all five `usePinnedTabsStore` reads stay unchanged in the shell (D-03); unused imports dropped (`Info`, `CachedAvatar`, `Progress`, `statusPillClass`, `extractTicketKeys`, default `React` import).
- No `IssuesTable.tsx`, `IssueRow.tsx`, `ReleaseProgressBar.tsx`, or `MilestoneWarning.tsx` file created (D-02 held).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create UnmatchedMRsSection.tsx as a presentational leaf** - `9bf1c2a4` (feat), import-order fix `837f5842` (style)
2. **Task 2: Create IssuesSection.tsx with UnmatchedMRsSection nested inside its section wrapper, and wire the page** - `d5f394c9` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `taskflow/src/routes/dashboard/release-detail/UnmatchedMRsSection.tsx` - new (102 lines)
- `taskflow/src/routes/dashboard/release-detail/IssuesSection.tsx` - new (230 lines)
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` - Issues block deleted/rewired, 1045 → 779 lines

## Decisions Made

- Followed `issue-detail/IssueDetailSidebar.tsx` as the composition-parent analog per 87-PATTERNS.md: `IssuesSection` imports `UnmatchedMRsSection` via same-folder relative path and renders it as a JSX child inside its own returned `<section>`, never as a page-shell sibling.
- Preserved the PEEK-05 key/body click split (Rule 1 auto-fix, see key-decisions above): `onOpenIssueFull` added as a dedicated prop for the explicit key `<button>` click, kept separate from the row-body `onOpenIssue` prop.
- `hasReleaseDate={!!version.releaseDate}` passed as a primitive boolean per the plan's prop contract, rather than threading the full `version` object into `IssuesSection`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added a distinct `onOpenIssueFull` prop to preserve the PEEK-05 key/body click split**
- **Found during:** Task 2
- **Issue:** The plan's `IssuesSection` prop contract lists a single `onOpenIssue: (key: string) => void`, with only the row-body click's `(onOpenIssue ?? openIssueFull)` fallback called out as needing resolution in the shell. The pre-refactor code's issue-key `<button onClick>` called `openIssueFull(row.issue.key)` directly and unconditionally — it never consulted the outlet-context `onOpenIssue` at all. Since `main.tsx` always wires an `onOpenIssue: handleOpenPeek` value onto the outlet context for every nested route (line 642), using a single resolved `onOpenIssue` prop for both the row body and the key button would make the key-link click always open the peek panel instead of forcing full-page navigation — a real behavior regression of the app-wide PEEK-05 split pattern (confirmed against `BacklogRow.tsx`'s identical two-prop split: `onIssueClick` for the key button, `(onOpenIssue ?? onIssueClick)` for the row body).
- **Fix:** Added `onOpenIssueFull: (key: string) => void` to `IssuesSectionProps`, wired the key `<button>`'s `onClick` to call `onOpenIssueFull(key)` only, and passed the shell's existing `openIssueFull` closure (unresolved, unconditional — matching original behavior exactly) as that prop. The row body keeps `onSeedBreadcrumb()` then `onOpenIssue(key)` per the plan's instruction, with the shell passing `resolvedOnOpenIssue = onOpenIssue ?? openIssueFull`.
- **Files modified:** `taskflow/src/routes/dashboard/release-detail/IssuesSection.tsx`, `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx`
- **Verification:** `npx tsc --noEmit` exits 0; `npm run check` at the pre-existing 2-error baseline; the PEEK-05 pattern's own file (`BacklogRow.tsx`) and its inline comment (`// Key cell — PEEK-05: inner button navigates full-page, stopPropagation prevents row onOpenIssue`) were used to confirm this is the established convention, not a new one.
- **Commit:** `d5f394c9`

**2. [Rule 1 - Lint] Biome import-sort fix**
- **Found during:** Task 1 pre-commit hook (post-commit)
- **Issue:** `UnmatchedMRsSection.tsx`'s `lucide-react` and `@tauri-apps/plugin-opener` imports were not alphabetically sorted.
- **Fix:** Reordered imports; ran `npx biome check` clean.
- **Files modified:** `taskflow/src/routes/dashboard/release-detail/UnmatchedMRsSection.tsx`
- **Commit:** `837f5842`

**3. [Rule 1 - Lint] Biome format fix (JSX line-wrap)**
- **Found during:** Task 2, `npm run check`
- **Issue:** A multi-line `<span className={statusPillClass(...)}>` in `IssuesSection.tsx` exceeded Biome's line-length wrap threshold when moved verbatim; `npm run check` reported it as a new formatting error beyond the 2-error baseline.
- **Fix:** Ran `npx biome format --write` on the touched files; verified `npm run check` returns to exactly 2 baseline errors (unrelated `BacklogPage.tsx`/`BacklogRow.tsx`).
- **Files modified:** `taskflow/src/routes/dashboard/release-detail/IssuesSection.tsx`
- **Committed in:** `d5f394c9`

### Documented Plan Deviation (executor-authored, Rule 1)

**Additional `onOpenIssueFull` prop:** not present in the plan's own prop-contract text (see auto-fixed issue 1 above). This is a correctness-preserving addition, not a scope change — no new files, no architectural change, and the acceptance-criteria greps for `IssuesSection.tsx` all still pass unmodified.

---

**Total deviations:** 1 auto-fixed behavior-preservation fix (Rule 1, extra prop), 2 auto-fixed lint/format fixes (Rule 1)
**Impact on plan:** None on scope; `IssuesSection`'s prop surface grew by one prop beyond the plan's literal list to prevent a real click-behavior regression. All functional and structural acceptance criteria pass, including the D-12b nesting gate.

## Issues Encountered

None blocking. The `onOpenIssueFull` prop gap (see deviations) was caught during Task 2 implementation by cross-referencing `BacklogRow.tsx`'s PEEK-05 comment before wiring the shell, not after a test failure — no dedicated `ReleaseDetailPage` test file exists in this codebase to catch it via automated verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plans 05-06 can continue extracting the remaining `ReleaseDetailPage.tsx` sections (sidebar `MetaRow` groups → `ReleaseDetailSidebar.tsx`, the edit modal → `EditReleaseModal.tsx`) using the same direct-path-import, `interface XxxProps`, presentational-only convention established across plans 03-04. The page shell still owns `useResizable`/`containerRef`, all edit-modal state/handlers, `usePinnedTabsStore` reads, and the Action Buttons block — none of these move until their respective plans.

No blockers.

## Self-Check

- `taskflow/src/routes/dashboard/release-detail/UnmatchedMRsSection.tsx` - FOUND
- `taskflow/src/routes/dashboard/release-detail/IssuesSection.tsx` - FOUND
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` - FOUND (779 lines)
- Commit `9bf1c2a4` - FOUND
- Commit `837f5842` - FOUND
- Commit `d5f394c9` - FOUND

## Self-Check: PASSED

All created/modified files verified present on disk; all 3 commits verified in git log.

---
*Phase: 87-release-detail-decomposition*
*Completed: 2026-08-10*
