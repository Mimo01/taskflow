---
phase: 54-aio-on-issue-detail
plan: "54-11"
subsystem: ui
tags: [aio, tcms, impacted-executions, cross-project, status-bug, new-route, round-3-uat]

# Dependency graph
requires:
  - phase: 54-aio-on-issue-detail
    provides: "Plan 54-10 description-images grid aggregation; Plan 54-07/54-08 ImpactedExecutionsList scaffolding (read-only rows + status chip from detail.run.status); fetchAioTestRunDetail service from Plan 54-06 Branch A1."
provides:
  - "Cross-project detail fetch fix: AioTestRunsSection derives the AIO project key per row from `runRef.cycleKey.split('-')[0]` so cross-project impacted executions resolve correctly. Status chips reflect real run status (not always 'Not Run')."
  - "New `AioTestRunDetailPage` route at `/aio-cycle/:projectKey/:cycleKey/run/:runId`. Single-run drill-down — header (back-link + run id + status chip) + step table that routes step content through WikiRenderer."
  - "Clickable Impacted Executions rows: cycle key → cycle detail page; run ID → new run detail page. Both targets use the cycle-derived projectKey."
  - "6 new tests across 54-11."
affects: [phase-55, phase-56]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cycle-derived project key pattern: in the AIO domain, cycle keys follow `{PROJECT}-CY-{N}`. Anywhere we fetch detail by (projectKey, cycleKey, runId), derive projectKey from the cycle key per row — the parent issue's projectKey can differ from the cycle's project on cross-project linkages. Applies to both service-call sites and Link href construction."
    - "Single-run drill-down route: `/aio-cycle/:projectKey/:cycleKey/run/:runId`. Tightly mirrors `AioCycleDetailPage` structure (params → useQuery → header + table), reuses existing helpers (aioRunStatusBadgeClass, EmptyState, ErrorState, AioCycleDetailSkeleton, useDelayedLoading)."

key-files:
  created:
    - ".planning/phases/54-aio-on-issue-detail/54-11-PLAN.md"
    - ".planning/phases/54-aio-on-issue-detail/54-11-SUMMARY.md"
    - "taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx"
    - "taskflow/src/routes/dashboard/AioTestRunDetailPage.test.tsx"
  modified:
    - "taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx"
    - "taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx"
    - "taskflow/src/routes/routes.tsx"
    - ".planning/phases/54-aio-on-issue-detail/54-HUMAN-UAT.md"

key-decisions:
  - "Cycle-derived projectKey fix lives in TWO places: the service-call site (detail fetch) AND the render site (link hrefs). Symmetric — anywhere we form a project-scoped URL/path with a cycle key, the projectKey must come from the cycle key. The parent issue's projectKey is correct only for traceability fetches (which use AIO project ID, not key)."
  - "v1 of AioTestRunDetailPage inlines the step table render instead of refactoring the existing StepTable out of AioTestRunsSection. The two surfaces will diverge slightly (this page has no 'collapse on PASS' state, no header chip per step, etc.) — and extracting a shared StepTable would require a separate refactor scope. Inline for now; refactor if a third surface needs it."
  - "MemoryRouter wraps renderSection in tests so `<Link>` renders without crashing. Existing tests still pass — the wrapper is transparent for non-Link assertions."
  - "Updated prior direct-lookup test assertion (UNIQUE_CYCLE_KEY='ESHOP-CY-1011' + PROJECT_KEY='PROJ') to assert the new corrected behavior ('ESHOP' projectKey). The old assertion encoded the bug — keeping it would have made the GREEN commit fail."

patterns-established:
  - "Cycle-derived project key derivation: `cycleKey.split('-')[0]`. Tolerant fallback to outer-scope projectKey when split fails. Documented at the call sites."

requirements-completed: [AIOI-01, AIOI-04]

# Metrics
duration: 45min
completed: 2026-05-14
---

# Phase 54 Plan 54-11: Cross-project impacted-execution fix + clickable rows + new run detail page

**Round-3 UAT (user) surfaced two bugs in the Impacted Executions list: status chips always showed 'Not Run' even on PASS/FAIL runs (cross-project detail-fetch failure), and rows weren't clickable to their detail.**

## Performance

- **Duration:** ~45 min (plan write + status fix + new page + click wiring + tests + docs)
- **Started:** 2026-05-14T13:25Z (after round-3 UAT user diagnostic)
- **Completed:** 2026-05-14T13:45Z
- **Tasks:** 4 auto + 1 checkpoint:human-verify (round-4 UAT)
- **Files modified/created:** 6 code/test + 2 plan/summary + 1 UAT doc

## Accomplishments

- **Status bug root cause confirmed via user-shared API response.** URL `/project/VTE/testcycle/ESHOP-CY-759/testrun/209620?assignSteps=true` → `'For the selected project, No Cycle found with Key: ESHOP-CY-759'`. The detail fetch used the parent issue's projectKey ('VTE') for cross-project cycles (ESHOP-CY-759). Fix: derive projectKey per row from `runRef.cycleKey.split('-')[0]`. Applied to both in-cycle and cross-cycle fetch sites.
- **New AioTestRunDetailPage shipped.** Mirrors AioCycleDetailPage structure: URL params → useQuery → header (back-link + run id + status chip from live fetch) + step table that routes content through WikiRenderer. Reuses existing helpers (aioRunStatusBadgeClass, EmptyState, ErrorState, AioCycleDetailSkeleton, useDelayedLoading). No new dependencies.
- **Clickable rows.** Cycle key + run ID cells in ImpactedExecutionsList now render as `<Link>` elements. Hrefs use the cycle-derived projectKey so cross-project navigation works. Visual unchanged at rest (only hover-state styling differs).
- **Test coverage uplift.** 6 new tests across plan 54-11:
  - 1 for cross-project detail fetch assertion (`expect(...calls[0][2]).toBe('OTHER')`)
  - 3 for new run detail page (success render, null detail / 404, cross-project routing)
  - 2 for click target hrefs (cycle link, run link)

## Task Commits

1. **Plan 54-11 written** — `bba99a7` (plan)
2. **Task 1: cross-project detail fetch fix + test** — `21a4b4d` (fix)
3. **Task 2: new AioTestRunDetailPage + route + 3 tests** — commit 2 of 3 (feat)
4. **Task 3: clickable rows + 2 tests** — `ca06965` (feat)
5. **Task 4: HUMAN-UAT round-4 scaffold + SUMMARY (this file)** — final docs commit

## Files Created/Modified

- `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx` — in-cycle and cross-cycle fetch sites derive projectKey from cycle key per row. Updated comment on `ImpactedExecutionsList` from "no click handlers — phase-53 concern" to "two link targets per row, cycle-derived projectKey".
- `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx` — `renderSection` wrapped in MemoryRouter. Updated direct-lookup perf-path test assertion. Added 3 new Plan 54-11 tests.
- `taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx` — new file. Single-run drill-down page.
- `taskflow/src/routes/dashboard/AioTestRunDetailPage.test.tsx` — new file. 3 tests.
- `taskflow/src/routes/routes.tsx` — lazy import + route entry for the new page.
- `.planning/phases/54-aio-on-issue-detail/54-HUMAN-UAT.md` — round-4 scaffold (re_uat_round bumped 3→4); Gap 5 + Gap 6 entries in `## Gaps`.

## Decisions Made

- **Cycle-derived projectKey is the canonical pattern.** Anywhere we form a project-scoped path with a cycle key, derive projectKey from the cycle key. Fallback to outer-scope projectKey when split fails (`'OTHER-CY-9'.split('-')[0] || projectKey`).
- **No StepTable refactor.** AioTestRunDetailPage inlines the step table render for v1. Extraction would require coordinating two consumers and isn't justified for one new surface.
- **MemoryRouter in tests.** Wrapping renderSection (vs. importing BrowserRouter or rendering at the App-level) is the minimal change. Existing tests don't break because Link renders identically to a static element when there's no route match.
- **Updated prior test assertion (not deleted).** The buggy assertion (`PROJECT_KEY='PROJ'` for cycle 'ESHOP-CY-1011') was encoding the bug, not the contract. Updated comment explains why.

## Deviations from Plan

None. Tasks executed as written, including the planned commit boundaries.

## Issues Encountered

- One test required `waitFor` on the status chip (which is conditional on `detailQuery.data`) rather than the unconditional title element — initial test version waited for the title and then sync-queried the chip before the fetch resolved. Fixed by moving the waitFor to the chip.
- EmptyState API takes `subtitle`/`icon` not `description` — caught by tsc, fixed inline before commit.

## User Setup Required

None.

## Round-4 UAT Outcome

**Status: PASS** (user-approved 2026-05-14T14:15Z).

Verified in UAT:
1. ✓ Cross-project impacted-execution status chips render REAL run status (PASS/FAIL/BLOCKED) — no more always "Not Run".
2. ✓ Cycle key cell navigates to the in-app cycle detail page.
3. ✓ Run ID cell navigates to the new in-app run detail page.
4. ✓ Single-run case uses CollapsibleRunBlock for consistency with multi-run case.
5. ✓ In-cycle CollapsibleRunBlock header shows cycle key + run ID alongside test case + status chip.
6. ✓ Breadcrumb integration uses the existing `useBreadcrumbStore` (IssueDetailPage convention) — not a parallel custom breadcrumb.
7. ✓ Test 4 ROADMAP SC end-to-end passes on a happy-path issue.

Phase 54 closes with this UAT round.

## Post-Plan Mid-UAT Iterations

The plan as originally written covered Tasks 1–4 (status fix, new page, click wiring, doc). Round-4 UAT surfaced four additional user requests that landed as inline follow-up commits inside the same plan boundary:

- **Single-run consistency (`4c7d16f`):** User asked the single-run path to use the same `CollapsibleRunBlock` as the multi-run path. Test fixture `TEST_RUN.status` switched PASS→FAIL so the existing step-rendering tests still see the expanded table.
- **In-cycle header info (`c9202cf`):** User wanted cycle key + run ID in the in-cycle header too. Added Link elements (later refactored to buttons — see breadcrumb integration below).
- **Custom-breadcrumb attempt → reverted (`a0894e6` → `27108bb`):** First attempt used `location.state` for breadcrumbs. User flagged: "we already have a breadcrumb system, integrate it into that one." Reverted to use `useBreadcrumbStore` with the standard back-arrow + trail-entries + current-segment rendering used by `IssueDetailPage` and `ReleaseDetailPage`.
- **Trail-preservation route allowlist (`8baeb70`):** `main.tsx`'s pathname-change effect was wiping the trail on AIO routes. Added `/aio-cycle/` to the preserve-trail allowlist so the trail survives the issue → cycle/run navigation.

## Next Phase Readiness

- Phase 54 awaits round-4 human UAT. Once approved, `/gsd:verify-work 54` writes the final verification document.
- If a future phase needs a single-step-row drill-down or comparison view, the AioTestRunDetailPage is the canonical template.
- Cycle-derived projectKey pattern documented for future AIO surfaces.

## Self-Check: PASSED

- `tsc --noEmit` exit 0.
- Full vitest suite: 1029 passed (baseline 1023 + 6 new on 54-11), 2 skipped, 39 todo, 0 failed.
- New page file + test file + route entry all in place.
- 2 new `<Link>` data-testids present in DOM: `impacted-execution-cycle-link` + `impacted-execution-run-link`.
- HUMAN-UAT.md contains both `fix_plan: "54-11"` entries (status fix + clickability).

---
*Phase: 54-aio-on-issue-detail*
*Completed: 2026-05-14*
