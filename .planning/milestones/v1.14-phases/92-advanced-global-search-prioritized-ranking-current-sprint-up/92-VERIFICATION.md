---
phase: 92-advanced-global-search-prioritized-ranking-current-sprint-up
verified: 2026-10-16T17:20:00Z
status: passed
score: 21/21 decisions verified
overrides_applied: 0
gaps: []
---

# Phase 92: Advanced Global Search Verification Report

**Phase Goal:** Global search (CommandPalette) returns instant, ranked issue results from the cached backlog index (sprint tier, then field, subtasks grouped under their parent), with compact rows, one debounced Jira body request per query, and a larger dialog.
**Status:** passed. Re-verification: No.

Requirement IDs: none in REQUIREMENTS.md; the contract is 92-CONTEXT.md D-01..D-21. UAT deviations listed in 92-06-SUMMARY.md are treated as the accepted contract.

## Decision Coverage (code evidence, not SUMMARY)

| Decision | Status | Evidence |
|---|---|---|
| D-01 scope; closed only via opt-in | VERIFIED | `buildSearchIndex` (global-search.ts) puts done issues outside the active sprint in the `closed` tier. `buildResultModel` hides them unless `includeClosed`. `buildBodySearchJql` uses `statusCategory != Done` for scope open and `= Done` for closed. |
| D-02 hybrid index | VERIFIED | Title hits come from the local index (no request). `bodyQuery` in CommandPalette.tsx uses a 300ms debounced `searchJiraBody`, `staleTime` 60s and `keepPreviousData`. The closed request fires only when `includeClosed` is on. Descriptions are not bulk-prefetched. |
| D-03 cold cache | VERIFIED | `useGlobalSearchSources` calls `useGhBacklogData` with `ignoreRoute: true` on the shared `['gh-backlog', boardId]` key. |
| D-04 field inference | VERIFIED, with accepted extension | `classifyBodyHit` checks description first, then comments (the body request adds `fields=comment`), then falls back to the "other" label. This is the UAT-approved refinement. |
| D-05 strict ordering | VERIFIED | The sort in `buildResultModel` goes tier rank, then field, then match kind and score. Ranks are Current 0, future sprints 1..n, Backlog 1000, Epics 1500 (accepted), Closed 2000. |
| D-06 tier headers | VERIFIED | `CommandGroup heading={sec.tier.label}`; the "(next)" suffix is set on the first FUTURE sprint. |
| D-07 grouping | VERIFIED | Child-only groups rank at `min(child field)+1`. Subtasks sit under the parent's tier. |
| D-08 fuzzy | VERIFIED | `matchText` ranks exact, then word-start, then fuzzy (fuzzysort, `FUZZY_THRESHOLD` 0.35, minimum token length 3). Transpositions are not matched (accepted limit). |
| D-09 size | VERIFIED | `max-w-3xl` panel; `CommandList` has `max-h-[70vh]`. |
| D-10 row | VERIFIED, with accepted deviation | `SearchResultRow` has type icon, key, title, epic badge, status pill and avatar. Sizing is the UAT-final one (32px rows, 20px avatar). |
| D-11 snippet and tag | VERIFIED, with accepted deviation | Body matches render a second excerpt line plus a tag (`desc`, `comment` or `other`). |
| D-12 highlighting | VERIFIED, with accepted deviation | Titles and snippets render through `HighlightedText` `<mark>` ranges with an amber background. |
| D-13 context header | VERIFIED | A parent with no hit of its own renders as a dimmed row, with matched subtasks indented below. The `withoutDirectMatch` fix for CR-02 keeps the parent as a dimmed row when it has indented children. |
| D-14 upgrade in place | VERIFIED | Same default export and props. Still mounted in `main.tsx:689`. |
| D-15 | VERIFIED | No "Search Jira for" item. An "Include closed issues" item feeds the Closed tier. |
| D-16 | VERIFIED | MR, Navigation and Action groups are filtered with `matchesSecondary` and are shown only when matching (or in the default state). |
| D-17 | VERIFIED | `resolveKeyLookup` and `findIndexEntry` are tried first. `keyQuery` is enabled only when there is no local hit. The result is pinned as "Direct match". |
| D-18 | VERIFIED | A query under 2 characters shows Recent Items plus Navigation. |
| D-19 | VERIFIED | `useQuery` on `['gh-all-data', boardId]` with `queryFn: skipToken` is a passive read. `addSubtasks` merges entries and de-duplicates by key. |
| D-20 | VERIFIED | `gh.done && tierId !== CURRENT_ID` goes to Closed; done issues in the active sprint stay in Current. |
| D-21 | VERIFIED | The hook is enabled only while the palette is open, with a 5 minute stale time and no refetch on window focus. |

## Anti-Patterns and Gates

- `TBD`, `FIXME` and `XXX` markers in phase files: none found.
- Code review CR-01 and CR-02: both fixed in c4331191. The JQL now splits tokens on reserved characters (test in `jira.test.ts:2648`). `withoutDirectMatch` has tests.
- The 9 warnings and 8 info items in 92-REVIEW.md are advisory and are not re-assessed here.

## Spot-Checks and Gates Run

| Check | Result |
|---|---|
| `vitest` on `lib/global-search`, `lib/search-text`, `components/app`, `hooks` | 25 files, 266 tests passed |
| `vitest` on `src/services/jira` | 35 files, 466 tests passed |
| `tsc --noEmit` | clean |
| `biome check` on phase files | clean (55 files) |

I did not run the full suite or `npm run build` myself; those figures (3728 passed, build OK) come from 92-06-SUMMARY.md.

## Human Verification

None outstanding. The live-Jira UAT (92-06 Task 2) was approved by the user on 2026-10-16.

## Notes (non-blocking)

- The body-search JQL is project-wide and open-status, not sprint-scoped. Issues from closed sprints that are still open can appear in the Backlog tier. This is the known limit 10b from RESEARCH, accepted at UAT.
- The closed search is a second opt-in request, separate from "one debounced body request per query". It fires only on user action (D-15).

## Gaps Summary

None. The phase goal is achieved in the codebase.

_Verified: 2026-10-16_
_Verifier: Claude (gsd-verifier)_
