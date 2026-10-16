---
phase: 92-advanced-global-search-prioritized-ranking-current-sprint-up
plan: 05
subsystem: search
tags: [command-palette, cmdk, ranking, react-query]
requires: [92-02, 92-03, 92-04]
provides: [upgraded CommandPalette with ranked tiers, body/closed queries, direct match, states]
affects: [92-06]
key-files:
  modified:
    - taskflow/src/components/app/CommandPalette.tsx
    - taskflow/src/components/app/CommandPalette.test.tsx
decisions:
  - "Controlled cmdk value (selectedValue) keeps the selected issue key stable across body-result insertion; no useLayoutEffect fallback was needed (jsdom test passes)"
  - "Direct match shows its heading with a Skeleton h-8 row while the key fetch is in flight (per task 2), so tests wait on the resolved row text, not the heading"
requirements: [D-02, D-03, D-06, D-09, D-14, D-15, D-16, D-17, D-18, D-21]
metrics:
  tasks: 2
  completed: 2026-10-16
---

# Phase 92 Plan 05: Command palette upgrade Summary

`CommandPalette` now renders ranked sprint/backlog/closed tiers from the local GreenHopper index (instant title hits), merges one debounced (300 ms) `searchJiraBody` request, offers opt-in "Include closed issues", pins a Direct match resolved from the index (network only on miss), filters MR/Navigation/Action groups by query, and shows loading, cold-index, error, empty, overflow and stable-selection states.

## Commits
- One combined commit for Tasks 1 and 2 (same two files; the pre-commit hook runs the full suite, so RED/GREEN and both tasks were committed together, as in 92-04).

## Deviations from Plan
- Worktree base was behind main; reset to main per the startup check and ran `npm ci`.
- Tasks 1 and 2 committed together (see above).
- Bare-number direct match: a single digit is still the D-18 default state (query < 2 chars), so the test uses `18` -> TEST-18 rather than `8`.
- `<SearchResultRow` appears once in source (shared `renderIssueRow` helper used by Direct match and all tiers) rather than the >= 2 grep in the plan; behaviour is identical.
- Header comment reworded so the string `CommandDialog` no longer appears (acceptance grep).
- Recent-item label/type resolution prefers the local index entry, then the legacy sprint-board cache, then the persisted value; the icon-resolution tests are unchanged and pass.
- No production code was bent for mocks; the test mock for `useGlobalSearchSources` returns a synthetic GreenHopper backlog.

## Known Stubs
None.

## Threat Flags
None. T-92-01/02/05/09 mitigations hold: raw text only goes to `searchJiraBody` (key-like queries skip it), no `dangerouslySetInnerHTML`, single debounced request with `retry: false` and 60 s stale time, fixed error copy.

## Verification
CommandPalette tests (52), biome check on the two files, and `tsc --noEmit` clean.

## Self-Check: PASSED
