---
phase: 90-per-mr-corrective-actions
plan: 03
subsystem: ui-drift-cells
tags: [react-query, tailwind-v4, lucide-react, vitest, release-detail]

# Dependency graph
requires:
  - phase: 90-per-mr-corrective-actions
    plan: 02
    provides: useMrFixMutation — the per-(MR, action) mutation hook this plan's UI binds to
provides:
  - DriftActionCell — the interactive BR/MS cell (retarget/assign-milestone) inside MrDriftSection
  - MrFixContext — the exported prop shape ReleaseDetailPage threads from useReleaseDetail
  - applyHeldOrder — D-11 held-sort-order helper
affects: [90-04 (later plan's UAT will click-verify these cells)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useRef order-freeze snapshot (never useMemo) for a list whose sort comparator keeps re-evaluating on every render — captured once on first non-empty render, held for the life of the mount"
    - "Named Tailwind group variants (group/row, group/fix) combined with group-hover/row: and group-focus-visible/fix: to drive an icon swap from two independent trigger sources (row hover, cell focus) without JS state"
    - "Same DOM footprint (flex-none w-[28px] flex items-center justify-center) preserved across every render branch (span vs button) so the column never resizes across state transitions"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx
    - taskflow/src/routes/dashboard/release-detail/MrDriftSection.test.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx

key-decisions:
  - "applyHeldOrder/orderRef live in MrDriftSection.tsx, not useReleaseDetail.ts (see Deviations) — 'life of the mounted list' is the list component itself"
  - "Focus-reveal mechanism used: group-focus-visible/fix: (the primary option per plan instruction), not the data-revealed fallback — Tailwind v4's named-group variant combinator handles focus-visible the same way it already handles group-hover/row: elsewhere in this codebase (dropdown-menu.tsx, context-menu.tsx use group-focus/<name>:), so no CSS-emission problem was hit and the JS-state fallback was not needed. Plan 04's UAT should confirm this visually via keyboard Tab, since Tailwind class generation can't be proven from a jsdom test run alone."

requirements-completed: [MRFIX-01, MRFIX-02, MRFIX-03, MRFIX-04]

# Metrics
duration: 55min
completed: 2026-08-11
---

# Phase 90 Plan 03: Per-MR Corrective Action Cells Summary

**`DriftActionCell` — the BR/MS drift cells become focus-reachable, row-hover-revealed buttons bound one-per-cell to `useMrFixMutation`, inside the unchanged 28px footprint, with a `useRef`-frozen row order (D-11) so a settling cell never jumps out from under the pointer.**

## Performance

- **Duration:** 55 min
- **Completed:** 2026-08-11
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `applyHeldOrder(rows, heldIds)` exported from `MrDriftSection.tsx`: stable partition of held vs unknown ids, never mutates input, empty `heldIds` is a no-op pass-through. Wired into the component via a `useRef<number[] | null>` snapshot captured on first non-empty render — explicitly not a `useMemo` (React Compiler is on; a memo is not a stability guarantee). 8 dedicated tests, including two `rerender()`-based DOM-order integration assertions (a fixed row stays first; a brand-new row appends last) and a loading→real-rows first-capture case.
- `DriftActionCell` added: same `flex-none w-[28px] flex items-center justify-center` root in every branch (pending span, error button, ok span, na span, inert span, actionable button) — `w-[28px]` occurrence count went 4→5, never regressed. Calls `useMrFixMutation` unconditionally per cell (Rules of Hooks), so BR and MS lock independently on the same row (D-09).
- Render precedence implemented exactly per plan: `pending` → `Loader2` spinner (no click) → `error` → red `AlertTriangle` with `title`/`aria-label` = `errorMessage`, still clickable (retry) → `mark === 'ok'` → green `Check` → `mark === 'na'` → muted dash → `flag && actionable` → hover/focus-reveal button (`AlertTriangle` rest, `GitBranch`/`Milestone` reveal) → `flag && !actionable` → inert orange span, with the verbatim D-14 copy on BR when the release branch doesn't exist.
- `aria-label` mirrors `title` verbatim on both action buttons and the error-retry button (D2 accessible-naming requirement).
- `ReleaseDetailPage.tsx` passes `fix={{ projectId: activeGitlabProject, baseUrl: gitlabBaseUrl, token: gitlabToken, releaseBranchName, releaseBranchExists: branchState.kind === 'exists', matchedMilestone: matchedMilestone ? { id, title } : null }}` — all three destructured fields (`activeGitlabProject`, `gitlabBaseUrl`, `gitlabToken`) were already present in the page's `useReleaseDetail` destructure, so no hook-return change was needed.
- Full interaction test suite (Task 3, 15 new tests): `pending` (spinner locks second click, call count stays 1), `success` (settled `ok` mark renders green check, no longer a `<button>`), `sticky failure` (exact tooltip text, red glyph, survives a live `queryClient.invalidateQueries()` sweep, no `[object Object]`, no `role="alert"` anywhere), `retry` (second click re-fires and clears red), `independent` (BR/MS on one row fire two calls with disjoint bodies — `{ target_branch }` vs `{ milestone_id }` — and a failing MS leaves BR still spinning, not red), `unavailable` (no release branch → inert span, click is a no-op, MS on the same row stays actionable), inert-cell coverage (`ok`/`na`/non-evaluated rows and TASK never render a `<button>`, even when flagged), degraded-banner coverage, and an aria-label/title identity assertion.
- 35/35 tests in `MrDriftSection.test.tsx`, 220/220 in `src/routes/dashboard/release-detail/`, `npx tsc --noEmit` exits 0, `npx biome check ./src` confined to the pre-existing BacklogPage/BacklogRow baseline (verified: no new files in the diagnostic list).

## Task Commits

Each task was committed atomically:

1. **Task 1: Freeze the row order for the life of the mounted list (D-11)** — `dc0f7315` (feat)
2. **Task 2: Build DriftActionCell and wire the fix context from the page** — `12842d1e` (feat)
3. **Task 3: Interaction test suite — pending, success, sticky failure, independence, unavailable** — `2b458c2f` (test)

## Files Created/Modified

- `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx` — `applyHeldOrder`, `orderRef` freeze, `MrFixContext` interface + required `fix` prop, `DriftActionCell`, `group/row` on the row, BR/MS call sites swapped from `DriftMarkCell` to `DriftActionCell`
- `taskflow/src/routes/dashboard/release-detail/MrDriftSection.test.tsx` — `QueryClientProvider` test harness, `updateMergeRequest` mock, `held sort order` describe (8 tests), `per-MR corrective actions` describe (15 tests)
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` — `fix` prop wired to `<MrDriftSection>` from the existing `useReleaseDetail` destructure

## Decisions Made

- `applyHeldOrder`/`orderRef` were placed in `MrDriftSection.tsx` per the plan's explicit output-note instruction, not in `useReleaseDetail.ts` where `90-PATTERNS.md` originally grouped the pattern — the freeze is a view-layer concern (the mounted list), and `90-VALIDATION.md` places the `held sort order` test in `MrDriftSection.test.tsx`. Recorded as a planned deviation per the plan's own instruction (see Deviations below).
- Focus-reveal implemented with `group-focus-visible/fix:` (the plan's primary option), not the `data-revealed` JS-state fallback. This codebase already uses named `group-focus/<name>:` variants successfully in `dropdown-menu.tsx`/`context-menu.tsx` under the same Tailwind v4 pipeline, so there was no observed reason to expect `group-focus-visible/fix:` to fail CSS emission. This cannot be fully proven from a jsdom test run (Tailwind class generation happens at build time, not test time) — flagged for Plan 04's keyboard-Tab UAT to confirm visually.

## Deviations from Plan

### Planned deviation (per plan's own `<output>` instruction)

**1. `applyHeldOrder`/`orderRef` live in `MrDriftSection.tsx`, not `useReleaseDetail.ts`**
- **Rationale (from the plan):** "life of the mounted list" is the list component itself, and `90-VALIDATION.md` places the `held sort order` test in `MrDriftSection.test.tsx`.
- **Files:** `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx`
- **Commit:** `dc0f7315`

No other deviations. All three tasks matched their acceptance criteria without needing Rule 1/2/3 auto-fixes.

## Issues Encountered

- Biome's formatter reflowed two long lines (an import list and one `DriftActionCell` JSX call) after Task 2, and one string-quote-style diff after Task 3 (the codebase enforces single quotes; a double-quoted test title tripped the formatter). Both fixed inline with `npx biome format --write` before the corresponding commit — no behavioral change, both are Rule 1 auto-fixes too trivial to warrant a separate deviation entry.
- The mocked `updateMergeRequest` needed an explicit `mockUpdateMergeRequest.mockReset()` in a `beforeEach` inside the new `per-MR corrective actions` describe block — without it, queued `mockResolvedValueOnce`/`mockRejectedValueOnce`/never-resolving-promise calls from earlier tests bled into later ones (observed as call counts of 6 instead of 1 in the `unavailable` test before the fix). This is standard Vitest mock-isolation hygiene, not a plan deviation.

## User Setup Required

None — no external service configuration required. The Phase 90 D-16 live-GitLab probe remains owed (carried from Plans 01/02); this plan's code does not depend on it and, per D-16, adds no confirm dialog, warning, or tooltip line regardless of probe status.

## Known Stubs

None. `DriftActionCell` is fully wired to the real `useMrFixMutation` hook from Plan 02; no mock data flows into the rendered UI outside of tests.

## Threat Flags

None. All six threat-register dispositions for this plan's files (T-90-11 through T-90-15, T-90-SC) are satisfied as designed:
- T-90-11 (write-scope tampering): `targetBranch`/`milestone` come only from the `fix` prop, resolved upstream — no text input or "change it anyway" affordance exists on `ok`/`na` cells.
- T-90-12 (unavailable-state write): the non-actionable branch renders a `<span>` with no click handler, not a disabled `<button>` — verified by the `unavailable` test asserting zero calls after a click.
- T-90-13 (error tooltip disclosure): the tooltip renders only `errorMessage` from Plan 01's `flattenGitLabError`; the sticky-failure test asserts no `[object Object]` and no element outside the row.
- T-90-14 (retry-storm DoS): the pending branch has no click handler and `fire()` self-locks (Plan 02); the `pending` test asserts a second click does not increase the call count.
- T-90-15 (icon-only accessible naming): `aria-label` mirrors `title` verbatim on every action/error button — asserted directly.
- T-90-SC (dependency safety): zero new dependencies — `lucide-react` (`GitBranch`, `Milestone` added to the existing import) and `@tanstack/react-query` were both already pinned; no install ran.

## Next Phase Readiness

- All four requirements (MRFIX-01..04) are observable in the automated test suite: retarget, assign-milestone, independent per-cell status/retry, and unavailable retarget without a branch.
- Row width is unchanged (`w-[28px]` count 4→5, one new occurrence from the error-state button, no cell lost its explicit width) and the frozen sort holds through a success transition (integration-tested).
- No error surface exists outside the cell (`role="alert"` absent, verified).
- Plan 04 should keyboard-Tab-verify the `group-focus-visible/fix:` reveal visually in a real browser/webview — this is the one claim this plan could not verify from jsdom alone.

---
*Phase: 90-per-mr-corrective-actions*
*Completed: 2026-08-11*

## Self-Check: PASSED
All created/modified files verified present on disk; all 3 task commit hashes (dc0f7315, 12842d1e, 2b458c2f) verified in git log.
