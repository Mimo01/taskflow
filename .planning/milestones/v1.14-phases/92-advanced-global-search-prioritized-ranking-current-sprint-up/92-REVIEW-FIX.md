---
phase: 92-advanced-global-search-prioritized-ranking-current-sprint-up
fixed_at: 2026-10-16T16:05:13Z
review_path: .planning/milestones/v1.14-phases/92-advanced-global-search-prioritized-ranking-current-sprint-up/92-REVIEW.md
iteration: 1
findings_in_scope: 16
fixed: 16
skipped: 0
status: all_fixed
---

# Phase 92: Code Review Fix Report (second pass)

**Fixed at:** 2026-10-16T16:05:13Z
**Source review:** .planning/milestones/v1.14-phases/92-advanced-global-search-prioritized-ranking-current-sprint-up/92-REVIEW.md
**Iteration:** 1 (second review pass; the first-pass fix report is preserved in git at 3ffab10e)

**Summary:**
- Findings in scope: 16 (1 Critical, 6 Warning, 9 Info; fix_scope = all)
- Fixed: 16
- Skipped: 0

I checked each finding against the code before fixing it. Every finding with a regression test was confirmed to fail before its fix. To check this, I put the pre-fix file in place temporarily inside the isolated worktree (no git stash). The pre-commit hook (biome, tsc and the full vitest suite) passed on every commit. The final suite run was 3762 passed, 2 skipped, 7 todo.

Two fixes need human checks: WR-02 needs confirming against live Jira, and WR-06 changes loading-state logic. Both are flagged below.

## Fixed Issues

### CR-01: Kept Direct-match parent row duplicates the cmdk value, which traps keyboard navigation

**Files modified:** `taskflow/src/components/app/CommandPalette.tsx`, `taskflow/src/components/app/CommandPalette.test.tsx`
**Commit:** 736857b7
**Applied fix:** `renderIssueRow` takes an optional `value`. The pinned Direct-match row now uses `direct:<KEY>`, so no two cmdk items share a value. New test: direct key `TEST-18` heads its matched subtask `TEST-19`. Before the fix, two rows were `aria-selected`. After it, exactly one row is selected and ArrowDown reaches `TEST-19`. The existing bare-number test now looks for `data-value="direct:TEST-18"`.

### WR-01: Key-shaped search terms turn off description and comment search

**Files modified:** `taskflow/src/components/app/CommandPalette.tsx`, `taskflow/src/components/app/CommandPalette.test.tsx`
**Commit:** 9e8cb4b1
**Applied fix:** The Direct-match block now comes before the body search, so the body search can use the key lookup's result. A key-shaped query (`utf-8`, `covid-19`) runs the body search once there is a `keyMiss`: no index entry, and the key lookup has settled without data. A real key still skips the body search, and the existing "does not request a body search for a key-like query" test still passes. New test: `utf-8` with a null lookup fires the body search and shows the hit.

### WR-02: Tokens that Jira drops (stopwords, punctuation-only) each get their own ANDed clause

**Files modified:** `taskflow/src/services/jira.ts`, `taskflow/src/services/jira.test.ts`
**Commit:** aea77ba5
**Status:** fixed: requires human verification (live Jira)
**Applied fix:** `buildBodySearchJql` now drops tokens that have no letter or digit (`=`). It also drops Lucene's default English stopwords from every token except the last; the last keeps them because its `*` wildcard skips analysis (`sign-in` gives `text ~ "sign" AND text ~ "in*"`). The two tests that locked in `text ~ "="` and `text ~ "in"` were updated, and a new test covers `fix the login`, `move to backlog`, `a = b`, `sign-in` and punctuation-only input (returns null). **Needs a live check:** search the real instance for `fix the login` and `sign-in flow`. Confirm that description hits come back and that a final-token stopword such as `to*` is accepted. If the instance uses a non-English analyser or a custom stopword list, `BODY_SEARCH_STOPWORDS` in `jira.ts` will need to match it.

### WR-03: "No results found" flashes during the 300 ms debounce

**Files modified:** `taskflow/src/components/app/CommandPalette.tsx`, `taskflow/src/components/app/CommandPalette.test.tsx`
**Commit:** 1170b818
**Applied fix:** `bodyPending` is true while `debouncedQuery !== trimmed` and a body search will run for the query. That means a non-key query, or a key-shaped query whose lookup missed (consistent with WR-01), with the Jira URL and project set. `bodyPending` counts toward `anyFetching`, so the empty state waits. New test: right after typing, the empty state is not shown; it appears after the request settles.

### WR-04: `entryFromJiraIssue` skips the done→Closed routing that WR-09 added for sprint-board subtasks

**Files modified:** `taskflow/src/lib/global-search.ts`, `taskflow/src/lib/global-search.test.ts`
**Commit:** 2acb71ed
**Applied fix:** `catKey` is now computed before the tier is chosen. After the choice, `if (catKey === 'done' && tierId !== CURRENT_ID) tierId = CLOSED_ID`. New tests: a done hit under a Backlog parent goes to Closed, one under a current-sprint parent stays in Current, and a done issue with no indexed parent goes to Closed.

### WR-05: A failed body search still shows "No results found"

**Files modified:** `taskflow/src/components/app/CommandPalette.tsx`, `taskflow/src/components/app/CommandPalette.test.tsx`
**Commit:** bf93045a
**Applied fix:** `bodyError = bodyQuery.isError && debouncedQuery === trimmed` now controls the notice, and `!bodyError` was added to `showEmpty`. New test: a failed search with no title hits shows the notice but not the empty state, and typing a new query clears the notice straight away.

### WR-06: Index loading state can be wrong in either direction while the PAT is unread or missing

**Files modified:** `taskflow/src/hooks/useGlobalSearchSources.ts`, `taskflow/src/hooks/useGlobalSearchSources.test.tsx`
**Commit:** 14bfe03d
**Status:** fixed: requires human verification (loading-state logic)
**Applied fix:** The secret state now records `read: true` in both `then` and `catch`. `isIndexLoading = open && !backlog && (!secretRead || (token && (boardIdLoading || (boardId && isPending))))`. A missing PAT (read finished, no token, Jira URL set) is now reported as `isIndexError`, so the palette shows "Couldn't load issues" instead of skeletons that never clear. New tests: a rejected PAT read with a stored board id ends with `isIndexLoading` false and `isIndexError` true; with no stored board id, the index counts as loading until the PAT read settles. The existing "no board" test now uses `waitFor`, because the first tick (PAT unread) is now correctly reported as loading. Worth a manual check: open the palette with the Stronghold PAT removed, and confirm the error copy shows rather than skeletons.

### IN-01: `onOpenIssue` prop is accepted but never used, and the click comments contradict each other

**Files modified:** `taskflow/src/components/app/CommandPalette.tsx`, `taskflow/src/components/app/CommandPalette.test.tsx`, `taskflow/src/main.tsx`
**Commit:** 1a24bfc8
**Applied fix:** Removed the prop, its wiring in `main.tsx`, and the test references. `onIssueClick` is now required. The two contradicting comments are replaced by one that matches the code: `handleIssueClick` (main.tsx) pushes the recent item with a cache-resolved title, and IssueDetailView's effect makes the authoritative push. The peek-handler comment in `main.tsx` no longer lists CommandPalette.

### IN-02: `KIND_RANK` is defined twice

**Files modified:** `taskflow/src/lib/search-text.ts`, `taskflow/src/lib/global-search.ts`
**Commit:** 91096bd7
**Applied fix:** `search-text.ts` exports `KIND_RANK`, and `global-search.ts` imports it.

### IN-03: Field names are put into request URLs unencoded

**Files modified:** `taskflow/src/services/jira.ts`, `taskflow/src/services/jira.test.ts`
**Commit:** 9e6d56ec
**Applied fix:** A new `fieldsParam()` helper filters out empty names and runs `encodeURIComponent` on each. It is used by `searchJiraBody` and `fetchIssuesByKeys`. New test: a field name containing `&`, `=` and `#` is encoded, and an empty epic-link setting leaves no trailing comma.

### IN-04: Dead `!token` checks

**Files modified:** `taskflow/src/components/app/CommandPalette.tsx`
**Commit:** a76f2077
**Applied fix:** Removed `!token` from both body-search guards. `readSecret` throws on a missing PAT, so the only case the guard caught was an empty stored token, and it then quietly returned no results. That case now reaches Jira and shows up as the search error notice. The `jiraBaseUrl`/`activeJiraProject` guards stay because they narrow the types.

### IN-05: Network Direct match has no parent or epic data

**Files modified:** `taskflow/src/components/app/CommandPalette.tsx`, `taskflow/src/components/app/CommandPalette.test.tsx`
**Commit:** 735260cc
**Applied fix:** The key lookup now calls `fetchIssuesByKeys(base, token, [key], [epicLinkFieldKey])`, which requests `parent` and the epic-link field, and returns the first result or null. `epicLinkFieldKey` is part of the query key. The shared `fetchJiraIssueByKey` is unchanged, because other consumers use it. The test mocks were switched to `fetchIssuesByKeys`, with the expected arguments now `[key]` and `[epicLinkFieldKey]`; production code was not adapted to fit the mocks. New test: a network Direct match whose epic link points at an indexed epic shows the epic pill. One difference: `fetchIssuesByKeys` throws on an HTTP error where `fetchJiraIssueByKey` returned null. The palette now treats that error as a key miss: the body search runs (WR-01), and the query no longer retries (IN-08).

### IN-06: Indexes from lower-cased text and from the original text are mixed, so highlights can misalign

**Files modified:** `taskflow/src/lib/search-text.ts`, `taskflow/src/lib/search-text.test.ts`
**Commit:** b2db444a
**Applied fix:** A new `lowerSameLength()` lower-cases one character at a time and keeps any character whose lower-case form is longer (`İ`). It is used by `matchText` and `buildSnippet`, so all index sources line up with the original string. This keeps highlighting for those titles rather than turning it off. New tests check title and snippet ranges for `İstanbul … cart`.

### IN-07: The total cap can hide a higher-ranked tier's group while a lower-ranked tier still shows rows

**Files modified:** `taskflow/src/lib/global-search.ts`, `taskflow/src/lib/global-search.test.ts`
**Commit:** db375af6
**Applied fix:** A new `totalOverflowed` flag is shared across tiers. It is set when a group that fits its tier is hidden only because of `TOTAL_CAP`. After that, every later non-expanded group is counted as hidden; expanded tiers still show in full, as before. New test: four full tiers (32 rows), then a 9-row group that overflows the cap, then a 1-row tier. The 1-row tier is now hidden (`hiddenCount` 1), and all 42 rows are still accounted for.

### IN-08: Key lookup query is not scoped to the instance and retries on credential errors

**Files modified:** `taskflow/src/components/app/CommandPalette.tsx`, `taskflow/src/components/app/CommandPalette.test.tsx`
**Commit:** 81336a59
**Applied fix:** The query key is now `['search', 'key', jiraBaseUrl, resolvedKeyLookup, epicLinkFieldKey]`, with `retry: false`. New test: the cached query lives under the instance-scoped key and has `retry === false`.

### IN-09: Legacy bare-iid recent MRs navigate to a broken route and do not de-duplicate

**Files modified:** `taskflow/src/stores/recent-items.store.ts`, `taskflow/src/stores/recent-items.store.test.ts`
**Commit:** c0cc2ca2
**Applied fix:** I took the review's migration option. The store is now `version: 1`, and the migration from v0 drops `gitlab` entries whose id has no `/`. I confirmed the route is `/mr/:projectId/:iid`, so `/mr/12` matches nothing. All three current pushers (palette, MR list, MR detail) already write `project_id/iid`, so no new bare ids can appear. Resolving the id at navigation time was not used: there was nothing sensible to do when the MR is missing from the cache. New test: the migration keeps composite MR ids and Jira items, and drops the bare id. `recentMrMatches` still handles bare ids; that branch is now unused, and I left it to keep the change small.

---

_Fixed: 2026-10-16T16:05:13Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
