---
phase: quick-261001-fmk
verified: 2026-10-01T00:00:00Z
status: human_needed
score: 8/8 must-haves verified (automated); visual UAT pending
human_verification:
  - test: "Open epic with several stories in Sheet; confirm Progress region above Stories list and skeleton on load without layout jump"
    expected: "Region sits above Stories; skeleton geometry matches"
    why_human: "Visual layout"
  - test: "Check burnup plausibility and footnote; note late done-line steps (updated fallback)"
    expected: "Scope area and done line plausible; footnote visible"
    why_human: "Chart rendering / data plausibility against live Jira"
  - test: "Status bar vs legend, assignee rows (Unassigned, sorted by remaining, one line each)"
    expected: "Segments match legend counts/SP; rows single-line"
    why_human: "Visual"
  - test: "Toggle Count / SP"
    expected: "All panels, % done and forecast update"
    why_human: "Interactive visual check"
  - test: "Open same epic in full View; check dark mode"
    expected: "Identical section; colours acceptable"
    why_human: "Visual"
  - test: "Open epic with 0 stories"
    expected: "No progress section; 'No stories in this epic' shown"
    why_human: "Visual"
---

# Quick 261001-fmk Verification

**Goal:** Detailed progress section in epic detail view above Stories list; epic list quick peek unchanged.
**Status:** human_needed (all automated checks pass; Task 3 visual UAT pending)

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Region above Stories list (Sheet and View) | VERIFIED | `<EpicProgressSection>` rendered in `isEpic` branch of IssueDetailContent.tsx immediately before the Stories `<section>`; `<section aria-label="Epic progress">` (implicit region) |
| 2 | Burnup scope by created, done by fallback chain, footnote | VERIFIED | `deriveBurnup`/`doneDateKey` (resolutiondate, statuscategorychangedate, updated, today; null if not done category); footnote "Scope by story creation date" present |
| 3 | Status bar by status name, category colour, legend count + SP | VERIFIED | `deriveStatusBuckets` groups by name; segments use `statusCategoryDotClass`; legend `name · count · N SP` |
| 4 | Per-assignee bars incl. Unassigned, sorted by remaining desc | VERIFIED | `deriveAssigneeBuckets` (Unassigned fallback, sort remaining desc then name) |
| 5 | Four tiles (% done, projected finish / Not enough data / Complete, unestimated, unassigned open) | VERIFIED | `Tile` x4, forecast reasons handled |
| 6 | Count/SP toggle default Count drives all panels | VERIFIED | `useState<Metric>('count')`; metric passed to all derive calls; aria-pressed buttons |
| 7 | Skeleton while loading; 0 stories renders nothing | VERIFIED | `!stories` -> skeleton; `length === 0` -> null; tests pass |
| 8 | EpicDetailSheet tests and quick-peek unchanged | VERIFIED | EpicProgressCells.tsx has no diff vs base; EpicDetailSheet.test.tsx passes unchanged |

## Artifacts and wiring
- epic-progress.ts: exports all required functions (plus extra `formatDateKey`); pure, `today` injected, no `new Date()`.
- EpicProgressSection.tsx: `'use no memo'` first line, imports from `@/lib/epic-progress`, 220px explicit-height wrapper, animations off, no Card wrapper.
- jira.ts: fetchEpicStories fields extended with created, resolutiondate, updated, statuscategorychangedate; JQL/ORDER BY untouched (diff confirms); optional typed fields added.
- Data flow: stories come from existing epicStories prop (fetchEpicStories) into the section; derived from real data.

## Spot checks
- vitest (epic-progress, EpicProgressSection, EpicDetailSheet, jira.test): 4 files, 144 tests passed.
- `npx tsc --noEmit`: clean.
- No TBD/FIXME/XXX markers in new files.

## Notes
- Minor deviation: implicit region role instead of explicit `role="region"` (equivalent semantics).
- Known caveat: done-line may step late when resolutiondate is null (fallback to updated); flagged for UAT.
- Full-suite and biome not re-run by verifier; SUMMARY claims them (flaky Worklogs test passed on retry).
