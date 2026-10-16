---
phase: 92-advanced-global-search-prioritized-ranking-current-sprint-up
plan: 06
subsystem: search
tags: [command-palette, recent-items, uat, polish, react-query]
requires: [92-01, 92-02, 92-03, 92-04, 92-05]
provides: [automated phase gates + validation map, live UAT sign-off, UAT polish of search + history rows]
affects: []
key-files:
  created:
    - taskflow/src/components/app/RecentItemRow.tsx
    - taskflow/src/components/app/RecentItemRow.test.tsx
    - taskflow/src/hooks/useRecentIssues.ts
  modified:
    - .planning/milestones/v1.14-phases/92-advanced-global-search-prioritized-ranking-current-sprint-up/92-VALIDATION.md
    - taskflow/src/components/app/SearchResultRow.tsx
    - taskflow/src/components/app/HighlightedText.tsx
    - taskflow/src/components/app/CommandPalette.tsx
    - taskflow/src/components/app/RecentItemsPopover.tsx
    - taskflow/src/lib/global-search.ts
    - taskflow/src/lib/search-text.ts
    - taskflow/src/services/jira.ts
    - taskflow/src/hooks/useGlobalSearchSources.ts
    - taskflow/src/stores/recent-items.store.ts
    - taskflow/src/routes/dashboard/IssueDetailView.tsx
decisions:
  - "Body (description/comment) matches render a second, single truncating line under the row's key column: match icon + highlighted excerpt (user-chosen over a preview footer)"
  - "Matches are highlighted with a soft amber background + full-strength text, not an underline"
  - "Parent-context rows (story above a matched/recent subtask) are the same full row, only faded (opacity-40); subtasks indent one fixed step (pl-3)"
  - "Open epics get their own 'Epics' section (rank between Backlog and Closed); done epics stay in Closed"
  - "Recent Items (palette + top-bar popover) share one row component and resolver; issues outside the search index are batch-fetched (key-in JQL, validateQuery=false) incl. epic link + epic names"
  - "Body search requests fields=comment so comment hits get a real excerpt; a body hit with no description/comment text is labelled 'Matched in another field'"
  - "Final sizing: 32px rows, 14px titles, 12px key/status/epic, 20px avatar; strict column grid; subtle hairline between story groups"
requirements: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14, D-15, D-16, D-17, D-18, D-19, D-20, D-21]
metrics:
  tasks: 2
  completed: 2026-10-16
---

# Phase 92 Plan 06: Phase gates, live UAT and polish Summary

Task 1 ran all automated gates (full vitest suite, `tsc --noEmit`, biome on the phase's files) and filled the decision-to-test map in `92-VALIDATION.md`. Task 2, the live-Jira and visual UAT, was **approved by the user** after an iterative polish loop. The loop produced the 21 `fix(92-06)` commits listed below. The final state passes `npm run build`, `tsc`, biome on all 24 phase-touched files, and the full suite (3728 passed, 2 skipped).

## Task 1
- `714d84a1` docs(92-06): validation map (Task ID column, D-19..D-21 rows, D-03 test path fixed, nyquist_compliant / wave_0_complete true)

## Task 2 — UAT feedback addressed
| Commit | Change |
|--------|--------|
| 6270661d | No extra ↳ glyph on subtasks (type icon is the arrow); shared RecentItemRow for palette Recent Items + top-bar popover |
| 9b25a8b0 | Recent subtasks shown under their parent story (buildRecentRows) |
| 8a897cb1 | Open epics get an "Epics" section instead of rendering as Backlog stories |
| 406fd880, ce5be164 | Parent rows: same size, only faded (opacity-40); uniform row height; key column alignment; MR rows use the shared row |
| 64776187 | Recent subtasks show their parent with a cold cache (parent persisted on the recent item) |
| 3fb2bd84 | Subtle hairline divider between story groups |
| 00b1fe1f, 1ae3c9da, ba1ca52d | Body matches never squeeze the title; compact status pill; comment hits get real excerpts (fields=comment) |
| f39a5c7f | Consistent column grid; popover rows match palette height and padding |
| 80f01b78, 98fcd23a | History always shows assignee/status/epic: batch fetch of non-indexed recent keys (fetchIssuesByKeys + useRecentIssues); popover widened to 40rem so epics show |
| bc0fd85f | Done issues show a struck-through key (app-wide convention) |
| f584280e | No flash/blink on open: stable fetch keys + keepPreviousData + skeleton until ready; fixed `isIndexLoading` stuck true when no board exists |
| 588c5f66, 55b89c90 | Body matches: one muted line under the row with the highlighted excerpt |
| 6dcc6614 | Amber background highlight; excerpts start at the match's sentence |
| 3a4ce993 | Small subtask indent; match line starts under the key column |
| 9a9e79a6 | Rows slightly larger and roomier (final sizing) |
| 4da4641c | History popover closes on select; "Matched in another field" label replaces a wrong comment claim |

## Deviations from Plan
- Task 2 was a pure human-verify checkpoint. In practice the user requested many design changes during UAT, and the orchestrator implemented them inline with tests, as atomic `fix(92-06)` commits. These went beyond the original UI-SPEC:
  - a two-line row for body matches
  - an Epics section
  - recent-items enrichment
  - the final sizing
- `useGlobalSearchSources.isIndexLoading` fix: a disabled TanStack v5 query stays `isPending`, so the old flag reported "loading" forever when no board existed. A regression test was added and proven to fail before the fix.
- The body search now also requests `comment`. This makes responses larger but gives accurate comment excerpts.

## Known Limits (accepted at UAT)
- Fuzzy title matching tolerates dropped or extra letters, but not transpositions (`checkuot`); this is a fuzzysort limitation.
- Description/comment hits for issues not on the board fall into the Backlog tier (RESEARCH limit 10b).

## Known Stubs
None.

## Self-Check: PASSED
