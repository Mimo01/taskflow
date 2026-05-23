---
phase: quick-260518-krb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira.test.ts
  - taskflow/src/services/jira/issues.ts
  - taskflow/src/services/jira/issues.test.ts
  - taskflow/src/components/app/Sidebar.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/routes/dashboard/BulkActionBar.tsx
  - taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
autonomous: true
requirements: [KRB-01, KRB-02, KRB-03]
tags: [refactor, jira, deduplication, typescript, service-layer]

must_haves:
  truths:
    - "Every function that was importable from '@/services/jira/issues' is now importable from '@/services/jira' with the same signature"
    - "fetchSprintIssues result objects still include fields.duedate (not silently dropped)"
    - "fetchMyTasksHierarchy parent issue objects still include fields.duedate"
    - "fetchIssueDetail still enriches subtasks with assignee data (the 22-line block survives the merge)"
    - "fetchJiraIssueByKey URL still requests reporter, priority, customfield_13415 fields"
    - "fetchSprintStories returns only parent issues (not subtasks) — same JQL as before"
    - "fetchSprintSubtasks chunks parent keys by SUBTASK_CHUNK_SIZE (50) — same chunking as before"
    - "updateIssueField, createIssue, bulkUpdateIssue, searchJira, searchJiraClosed, fetchIssueSummary, fetchIssueDetail all pass the correct operationName 4th arg to apiFetch (Create/Edit Issue, Search Issues, Search Closed Issues, Load Issue Detail)"
    - "jira/issues.ts file no longer exists on disk"
    - "jira.ts no longer contains the line `export { fetchJiraIssueByKey } from './jira/issues'`"
    - "All 5 caller files import from '@/services/jira' instead of '@/services/jira/issues'"
    - "npx tsc --noEmit passes with zero new errors"
    - "npx vitest run passes — existing 76 jira.test.ts tests remain green AND the appended unique-to-issues tests are green; total test count in jira.test.ts must be >= 90 (no coverage lost)"
    - "jira.test.ts retains all original 76 tests untouched; only NEW describe blocks (fetchSprintStories, fetchSprintSubtasks, fetchJiraIssueByKey, searchJira, searchJiraClosed) are appended"

  artifacts:
    - path: "taskflow/src/services/jira.ts"
      provides: "Single canonical Jira service surface — contains all 13 unified functions"
      contains: "export async function fetchSprintStories"
    - path: "taskflow/src/services/jira.ts"
      provides: "fetchSprintSubtasks exported"
      contains: "export async function fetchSprintSubtasks"
    - path: "taskflow/src/services/jira.ts"
      provides: "fetchJiraIssueByKey moved inline (no re-export)"
      contains: "export async function fetchJiraIssueByKey"
    - path: "taskflow/src/services/jira.test.ts"
      provides: "Augmented test file — original 76 tests preserved + 5 new describe blocks appended (fetchSprintStories, fetchSprintSubtasks, fetchJiraIssueByKey, searchJira, searchJiraClosed). Final test count >= 90."
      contains: "describe('fetchSprintStories'"

  key_links:
    - from: "taskflow/src/services/jira.ts"
      to: "taskflow/src/services/jira/client.ts"
      via: "import { isResponseLikeError } from './jira/client'"
      pattern: "import.*isResponseLikeError.*from.*['\"]\\./jira/client['\"]"
    - from: "taskflow/src/components/app/Sidebar.tsx"
      to: "taskflow/src/services/jira.ts"
      via: "import { fetchSprintStories } from '@/services/jira'"
      pattern: "from '@/services/jira'"
    - from: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      to: "taskflow/src/services/jira.ts"
      via: "import { fetchSprintStories, fetchSprintSubtasks } from '@/services/jira'"
      pattern: "from '@/services/jira'"
    - from: "taskflow/src/routes/dashboard/BulkActionBar.tsx"
      to: "taskflow/src/services/jira.ts"
      via: "import { updateIssueField } from '@/services/jira'"
      pattern: "from '@/services/jira'"
    - from: "taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts"
      to: "taskflow/src/services/jira.ts"
      via: "import { updateIssueField } from '@/services/jira'"
      pattern: "from '@/services/jira'"
    - from: "taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts"
      to: "taskflow/src/services/jira.ts"
      via: "import { bulkUpdateIssue, createIssue, wrapCustomFieldValue } from '@/services/jira'"
      pattern: "from '@/services/jira'"
---

<objective>
Unify two duplicate Jira service implementations into a single canonical surface. `taskflow/src/services/jira.ts` (2209 lines, 62 callers) is the winner; `taskflow/src/services/jira/issues.ts` (718 lines, 5 callers) is deleted after migration.

Purpose: Eliminate maintenance hazard from two parallel implementations of 10 duplicate functions (most recently the priority/severity icon work had to be done twice in jira.ts and jira/issues.ts because of the dual-file gotcha noted in MEMORY.md project_jira_ts_dual_file.md).

Output: Single jira.ts file with 3 newly-added inline functions (fetchSprintStories, fetchSprintSubtasks, fetchJiraIssueByKey), 7 existing functions enhanced with `operationName` apiFetch arg, jira/issues.ts deleted, the 5 unique-to-issues describe blocks APPENDED to the existing 1519-line jira.test.ts (preserving all 76 existing tests), jira/issues.test.ts deleted, 5 callers updated.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260518-krb-there-are-two-duplicate-implementations-/260518-krb-CONTEXT.md
@.planning/quick/260518-krb-there-are-two-duplicate-implementations-/260518-krb-RESEARCH.md
@taskflow/src/services/jira.ts
@taskflow/src/services/jira/issues.ts
@taskflow/src/services/jira/client.ts
@taskflow/src/services/jira/issues.test.ts
@taskflow/src/services/jira.test.ts

<interfaces>
<!-- Exact signatures the executor must preserve when moving functions into jira.ts.
     All signatures are extracted from jira/issues.ts and must NOT change. -->

From taskflow/src/services/jira/client.ts:
- `export const SUBTASK_CHUNK_SIZE = 50` — already imported by jira/issues.ts. NOT needed in jira.ts because jira.ts already has its own local `const SUBTASK_CHUNK_SIZE = 50` on line 180.
- `export function isResponseLikeError(err: unknown): err is { status: number; text?: () => Promise<string> }` — MUST be imported by jira.ts to use in the three new functions (and optionally to replace the 3 inline duck-type cast blocks in fetchSprintIssues / fetchMyTasksHierarchy).
- `export async function fetchAllSearchPages(baseSearchUrl, headers): Promise<JiraIssue[]>` — exists in BOTH jira/client.ts (with `getJiraLimit()` concurrency wrapper) and jira.ts (without, as private). DO NOT switch jira.ts to import from client.ts in this refactor — the existing local copy in jira.ts is already used by 10+ functions in jira.ts. Keep using the local copy for the moved-in functions to minimize blast radius (Risk 3/5 from RESEARCH.md is accepted: the moved functions will use the local non-rate-limited version, which is consistent with all other jira.ts functions).

Existing jira.ts already contains (line numbers approximate):
- Line 24: `export { fetchJiraIssueByKey } from './jira/issues';` — REMOVE this line, replace with inline implementation
- Line 180: `const SUBTASK_CHUNK_SIZE = 50;` — keep as-is
- Line 181: `const PAGE_SIZE = 200;` — keep as-is
- Line 202-241: `async function fetchAllSearchPages` — keep as-is (the moved-in functions will use this)
- Line 308: `export async function fetchSprintIssues` — KEEP as-is (already has `duedate`, already has correct logic). Only optional improvement: replace the inline duck-type cast block (lines ~340-356) with `if (isResponseLikeError(err)) { ... }` for cleanliness — preserve identical behavior.
- Line 410: `export async function fetchMyTasksHierarchy` — KEEP as-is (already has `duedate`). Same optional cleanup as fetchSprintIssues.
- Line 847: `export async function searchJira` — Add `'Search Issues'` as 4th arg to apiFetch call
- Line 889: `export async function searchJiraClosed` — Add `'Search Closed Issues'` as 4th arg to apiFetch call
- Line 1135: `export async function fetchIssueDetail` — Add `'Load Issue Detail'` as 4th arg to apiFetch (line ~1177) AND to the enrichment apiFetch (line ~1194). KEEP the subtask-assignee enrichment block (lines 1188-1212) intact.
- Line 1221: `export async function fetchIssueSummary` — Add `'Load Issue Detail'` as 4th arg
- Line 1240: `export async function updateIssueField` — Add `'Create/Edit Issue'` as 4th arg
- Line 1361: `export async function createIssue` — Add `'Create/Edit Issue'` as 4th arg
- Line 1560: `export async function bulkUpdateIssue` — Add `'Create/Edit Issue'` as 4th arg

Existing jira.test.ts already contains (do NOT modify these):
- Line 1: imports `from './jira'` — the file already targets the canonical surface
- Line 31: top-level `describe('jira service', () => { ... })` block opened
- Line 36 onward: 25+ existing describe blocks across the 76 existing tests (validateJira, listJiraProjects, fetchSprintIssues, fetchTransitions, postTransition, postComment, APIF-01..APIF-03, fetchIssueWorklogs, fetchFixVersions, PAGI-01..PAGI-02, ISSUE-03 family, BOARD-04 family, CREATE-01..CREATE-04, EPIC-01, EPIC-03, etc.)
- Line 1519: closing `})` of the top-level `describe('jira service', ...)` block. This is the INSERTION POINT for the 5 new describe blocks (insert ABOVE the closing brace so the new blocks become siblings of the existing inner describe blocks).
- Important: jira.test.ts already mocks `../lib/apiFetch` at the top. The 5 appended describe blocks must use the SAME apiFetch mock (do not introduce a new mock at the top of file — reuse the existing one). DO NOT add `vi.mock('./jira/client', ...)` — the new code under test calls jira.ts's PRIVATE fetchAllSearchPages, so apiFetch-level mocking is the only viable strategy.

Functions to ADD to jira.ts (copy bodies from jira/issues.ts, then adjust):

1. `fetchSprintStories(baseUrl, token, projectKey, assignedToMe = false, storyPointsFieldKey = 'customfield_10016', epicLinkFieldKey = 'customfield_10014'): Promise<JiraIssue[]>`
   - Insert immediately AFTER fetchSprintIssues (line 395) so all sprint-fetch functions are grouped.
   - Body source: jira/issues.ts lines 25-62. The body already adds `timetracking` field but does NOT include `duedate` in the fields string. ADD `,duedate` at the end of the fields string to maintain parity with fetchSprintIssues. Final fields string: `summary,status,assignee,issuetype,labels,${spFields},${epicLinkFieldKey},parent,subtasks,timetracking,duedate`.
   - Use `isResponseLikeError(err)` (the imported helper) — do NOT inline-duck-type.

2. `fetchSprintSubtasks(baseUrl, token, parentKeys, assignedToMe = false): Promise<JiraIssue[]>`
   - Insert immediately after fetchSprintStories.
   - Body source: jira/issues.ts lines 76-108. Logic is pure (no error-detection branches needed). The local SUBTASK_CHUNK_SIZE on jira.ts line 180 will be used automatically.

3. `fetchJiraIssueByKey(baseUrl, token, issueKey): Promise<JiraIssue | null>`
   - Insert near other fetch-by-key helpers (e.g., after fetchIssueSummary, around line 1238).
   - Body source: jira/issues.ts lines 641-671. Keep the fields string EXACTLY: `summary,status,assignee,reporter,priority,customfield_13415,customfield_10016,issuetype`. Use `'Fetch Issue By Key'` as the 4th arg to apiFetch (matches existing jira/issues.ts version).

Imports to add to jira.ts (top of file, after existing imports around line 21):
  `import { isResponseLikeError } from './jira/client';`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate function bodies into jira.ts (additive surface unification)</name>
  <files>taskflow/src/services/jira.ts</files>
  <action>
    Unify all surface in jira.ts WITHOUT touching jira/issues.ts yet. Do this incrementally:

    (1) Remove line 24 `export { fetchJiraIssueByKey } from './jira/issues';`. Leave line 25-26 (`export * from './jira-changelog'` and `./jira-watchers`) untouched.

    (2) Add import `import { isResponseLikeError } from './jira/client';` after the existing import block (after line 21).

    (3) Add 4th-arg operationName labels to existing apiFetch calls (precise: only inside the function bodies listed below — do NOT touch other apiFetch calls in jira.ts):
      - `fetchIssueDetail` (around line 1177): pass `'Load Issue Detail'` as 4th arg.
      - `fetchIssueDetail` enrichment block (around line 1194): pass `'Load Issue Detail'` as 4th arg.
      - `fetchIssueSummary` (around line 1228): pass `'Load Issue Detail'`.
      - `updateIssueField` (around line 1248): pass `'Create/Edit Issue'`.
      - `createIssue` (around line 1395): pass `'Create/Edit Issue'`.
      - `bulkUpdateIssue` (around line 1567): pass `'Create/Edit Issue'`.
      - `searchJira` (around line 859): pass `'Search Issues'`.
      - `searchJiraClosed` (around line 901): pass `'Search Closed Issues'`.
      DO NOT change apiFetch signatures elsewhere in jira.ts. DO NOT touch fetchSprintIssues / fetchMyTasksHierarchy apiFetch calls (they go through fetchAllSearchPages which already passes its own label).

    (4) Insert new function `fetchSprintStories` immediately after the closing brace of `fetchSprintIssues` (the function ending around line 395). Copy the body from jira/issues.ts lines 25-62. CRITICAL: the fields string in jira/issues.ts is `summary,status,assignee,issuetype,labels,${spFields},${epicLinkFieldKey},parent,subtasks,timetracking` — APPEND `,duedate` so the result reads `...timetracking,duedate`. Use the imported `isResponseLikeError` helper for error detection (do not inline the duck-type cast). Keep the JSDoc comment block above the function.

    (5) Insert new function `fetchSprintSubtasks` immediately after fetchSprintStories. Copy the body from jira/issues.ts lines 76-108 verbatim. The local `SUBTASK_CHUNK_SIZE` on jira.ts line 180 will be picked up automatically. No `isResponseLikeError` needed (this function has no error-branching).

    (6) Insert new function `fetchJiraIssueByKey` immediately AFTER `fetchIssueSummary` (which ends around line 1238). Copy the body from jira/issues.ts lines 641-671 verbatim. Keep the exact fields string `summary,status,assignee,reporter,priority,customfield_13415,customfield_10016,issuetype` and the 4th apiFetch arg `'Fetch Issue By Key'`. This is silent-failure (returns null on any error).

    (7) OPTIONAL CLEANUP (only if straightforward): replace the inline duck-type cast blocks inside `fetchSprintIssues` (lines ~340-356) and `fetchMyTasksHierarchy` (lines ~454-470) with calls to the imported `isResponseLikeError(err)` helper. The behavior must be byte-identical: still narrow to `err.status: number`, still call `err.text()` for body sniffing, still throw the same Error messages. If unsure, leave the inline casts in place — they are correct and tested, just verbose.

    Per CONTEXT.md decisions D-01 (keep jira.ts canonical), D-02 (preserve duedate), D-03 (preserve enrichment), D-04 (move unique functions), D-05 (operation names), and the dual-file gotcha in MEMORY.md project_jira_ts_dual_file.md.

    Do NOT delete jira/issues.ts yet — Task 2 handles that and the caller updates atomically so we can rerun `npx tsc --noEmit` at each step and bisect any breakage.
  </action>
  <verify>
    <automated>cd taskflow &amp;&amp; npx tsc --noEmit 2&gt;&amp;1 | tee /tmp/krb-tsc-task1.log; ! grep -E "error TS" /tmp/krb-tsc-task1.log &amp;&amp; grep -c "^export async function fetchSprintStories\|^export async function fetchSprintSubtasks\|^export async function fetchJiraIssueByKey\|import { isResponseLikeError } from './jira/client'" src/services/jira.ts | awk '$1 &gt;= 4 {exit 0} {print "expected &gt;=4 markers, got " $1; exit 1}' &amp;&amp; ! grep -F "export { fetchJiraIssueByKey } from './jira/issues'" src/services/jira.ts</automated>
  </verify>
  <done>
    jira.ts compiles cleanly with `npx tsc --noEmit`. The 4 new markers are present: import of `isResponseLikeError`, and three new `export async function` declarations for fetchSprintStories, fetchSprintSubtasks, fetchJiraIssueByKey. The re-export line `export { fetchJiraIssueByKey } from './jira/issues'` is gone. The 8 apiFetch operationName labels are added. jira/issues.ts is still on disk and still exports its functions (Task 2 will remove it).
  </done>
</task>

<task type="auto">
  <name>Task 2: Update callers, APPEND new describe blocks to existing jira.test.ts, delete jira/issues.{ts,test.ts}</name>
  <files>taskflow/src/components/app/Sidebar.tsx, taskflow/src/routes/dashboard/SprintBoardTab.tsx, taskflow/src/routes/dashboard/BulkActionBar.tsx, taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts, taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts, taskflow/src/services/jira.test.ts, taskflow/src/services/jira/issues.test.ts, taskflow/src/services/jira/issues.ts</files>
  <action>
    Complete the cutover by switching all consumers to jira.ts, AUGMENTING the existing jira.test.ts with the unique-to-issues describe blocks, and removing the dead file.

    (A) Update the 5 caller import paths (exact, single-line changes; preserve the imported symbols):
      1. `taskflow/src/components/app/Sidebar.tsx` line 37:
         `import { fetchSprintStories } from '@/services/jira/issues';`
         → `import { fetchSprintStories } from '@/services/jira';`
      2. `taskflow/src/routes/dashboard/SprintBoardTab.tsx` line 39:
         `import { fetchSprintStories, fetchSprintSubtasks } from '@/services/jira/issues';`
         → `import { fetchSprintStories, fetchSprintSubtasks } from '@/services/jira';`
      3. `taskflow/src/routes/dashboard/BulkActionBar.tsx` line 21:
         `import { updateIssueField } from '@/services/jira/issues';`
         → `import { updateIssueField } from '@/services/jira';`
      4. `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts` line 4:
         `import { updateIssueField } from '@/services/jira/issues';`
         → `import { updateIssueField } from '@/services/jira';`
      5. `taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts` line 2:
         `import { bulkUpdateIssue, createIssue, wrapCustomFieldValue } from '@/services/jira/issues';`
         → `import { bulkUpdateIssue, createIssue, wrapCustomFieldValue } from '@/services/jira';`

      After this step, run `grep -rn "from '@/services/jira/issues'" taskflow/src/` and confirm zero matches.

    (B) APPEND new describe blocks to the existing `taskflow/src/services/jira.test.ts` — DO NOT overwrite the file, DO NOT create a new file. The existing 1519-line file already contains 76 passing tests across 25+ describe blocks (validateJira, listJiraProjects, fetchSprintIssues, fetchTransitions, postTransition, postComment, APIF-01..APIF-03, fetchIssueWorklogs, fetchFixVersions, PAGI-01..PAGI-02, ISSUE-03 family, BOARD-04 family, CREATE-01..CREATE-04, EPIC-01, EPIC-03). Those 76 tests MUST remain untouched.

      Concrete steps:

      1. Identify the FIVE describe blocks in `taskflow/src/services/jira/issues.test.ts` that test functionality NOT already covered by jira.test.ts. From the audit of issues.test.ts these are:
         - `describe('fetchSprintStories', ...)` (lines 261-308 of issues.test.ts)
         - `describe('fetchSprintSubtasks', ...)` (lines 309-351 of issues.test.ts)
         - `describe('fetchJiraIssueByKey', ...)` (lines 385-492 of issues.test.ts)
         - `describe('searchJira', ...)` (lines 352-384 of issues.test.ts)
         - `describe('searchJiraClosed', ...)` (lines 493-538 of issues.test.ts)

         The OTHER FOUR describe blocks in issues.test.ts (`fetchSprintIssues`, `fetchIssueDetail`, `createIssue`, `updateIssueField`) are duplicates of describe blocks already present in jira.test.ts at lines 131, 930/1480-region, 1052/1086, 985 respectively. DO NOT copy these duplicates — the existing 76 tests already cover this surface.

      2. Open `taskflow/src/services/jira.test.ts`. Locate the FINAL closing `})` on line 1519 (it closes the top-level `describe('jira service', () => { ... })` block). Insert the 5 NEW describe blocks IMMEDIATELY BEFORE that final closing `})` so they become inner siblings of all the existing describe blocks within `describe('jira service', ...)`.

      3. Adapt each copied describe block to jira.test.ts's existing mock environment:
         - jira.test.ts already does `vi.mock('../lib/apiFetch', ...)` at the top. REUSE this same mock — do NOT add a second `vi.mock('../lib/apiFetch', ...)` call.
         - DO NOT add any `vi.mock('./jira/client', ...)` or `vi.mock('./client', ...)` — the new code under test calls jira.ts's PRIVATE local `fetchAllSearchPages` and its locally-imported `isResponseLikeError`, which CANNOT be intercepted via `vi.mock`. All mocking must happen at the `apiFetch` level.
         - For tests previously written as `vi.mocked(fetchAllSearchPages).mockResolvedValueOnce(parents)`: rewrite to mock `apiFetch` with a Response-like object whose `.json()` resolves to `{ issues: parents, total: parents.length }` and `.ok` is `true`. jira.ts's `fetchAllSearchPages` loops until `startAt >= total`, so setting `total === parents.length` terminates after one page.
         - For tests previously written as `vi.mocked(fetchAllSearchPages).mockRejectedValueOnce(new ApiError(..., 401))`: rewrite to mock `apiFetch` returning `{ ok: false, status: 401, text: async () => '...' }` so jira.ts's fetchAllSearchPages throws ApiError internally.
         - For 400-with-sprint-error tests: return `{ ok: false, status: 400, text: async () => 'function not recognized' }`.
         - For tests previously calling `vi.mocked(isResponseLikeError).mockReturnValue(true)`: DROP these mock calls entirely — the real `isResponseLikeError` works on the mocked Response objects since they have numeric `status` properties.
         - For the fetchSprintSubtasks chunking test (60 keys → 2 chunks): assert `vi.mocked(apiFetch).toHaveBeenCalledTimes(2)` and check JQL contents of each call's URL arg, NOT `vi.mocked(fetchAllSearchPages).toHaveBeenCalledTimes(2)`.

      4. Fix the known broken assertion in the `fetchJiraIssueByKey` describe block (line 421 of the old issues.test.ts):
         `expect(url).toContain('fields=summary,status,assignee,customfield_10016,issuetype')`
         → replace with three separate assertions matching the actual URL:
         `expect(url).toContain('customfield_13415');`
         `expect(url).toContain('customfield_10016');`
         `expect(url).toContain('reporter,priority');`

      5. Imports needed at the top of jira.test.ts (only ADD if not already present — do not duplicate existing imports):
         - `ApiError` from `'../lib/api-error'` (note: jira.test.ts is one directory up vs issues.test.ts, so path is `../lib/api-error`, NOT `../../lib/api-error`). Check whether jira.test.ts already imports ApiError — if yes, skip; if no, add.
         - Add `fetchSprintStories`, `fetchSprintSubtasks`, `fetchJiraIssueByKey`, `searchJira`, `searchJiraClosed` to the existing `import { ... } from './jira'` statement at line 1 of jira.test.ts (merge into the existing destructured list — do NOT add a second import statement).

      6. After appending, run `grep -c "^\s*it(\|^\s*test(" taskflow/src/services/jira.test.ts`. Expect a count of at least 90 (the floor: 76 existing + the ~14 new tests across the 5 appended describe blocks. The exact upper bound depends on how many it() blocks each appended describe contains — typically 14-16).

      7. Delete `taskflow/src/services/jira/issues.test.ts` — its unique content has been merged into jira.test.ts.

    (C) Delete `taskflow/src/services/jira/issues.ts` entirely. Verify nothing else still references the path:
      `grep -rn "from '@/services/jira/issues'\|from './jira/issues'\|from '../jira/issues'\|from '../../jira/issues'" taskflow/src/` must return zero matches.

    Per CONTEXT.md D-06 (5 callers to update), D-07 (test migration + fix line-421 assertion + DO NOT LOSE TEST COVERAGE — explicit decision), D-08 (delete jira/issues.ts).
  </action>
  <verify>
    <automated>cd taskflow &amp;&amp; ! grep -rn "from '@/services/jira/issues'" src/ 2&gt;/dev/null &amp;&amp; ! grep -rn "from './jira/issues'" src/ 2&gt;/dev/null &amp;&amp; ! grep -rn "from '../jira/issues'" src/ 2&gt;/dev/null &amp;&amp; [ ! -f src/services/jira/issues.ts ] &amp;&amp; [ ! -f src/services/jira/issues.test.ts ] &amp;&amp; [ -f src/services/jira.test.ts ] &amp;&amp; TESTCOUNT=$(grep -cE "^\s*it\(|^\s*test\(" src/services/jira.test.ts) &amp;&amp; [ "$TESTCOUNT" -ge 90 ] &amp;&amp; grep -q "describe('fetchSprintStories'" src/services/jira.test.ts &amp;&amp; grep -q "describe('fetchSprintSubtasks'" src/services/jira.test.ts &amp;&amp; grep -q "describe('fetchJiraIssueByKey'" src/services/jira.test.ts &amp;&amp; grep -q "describe('searchJira'" src/services/jira.test.ts &amp;&amp; grep -q "describe('searchJiraClosed'" src/services/jira.test.ts &amp;&amp; npx tsc --noEmit 2&gt;&amp;1 | tee /tmp/krb-tsc-task2.log &amp;&amp; ! grep -E "error TS" /tmp/krb-tsc-task2.log</automated>
  </verify>
  <done>
    Zero `@/services/jira/issues` import references remain anywhere in `taskflow/src/`. The files `taskflow/src/services/jira/issues.ts` and `taskflow/src/services/jira/issues.test.ts` no longer exist. The augmented `taskflow/src/services/jira.test.ts` retains all 76 original tests AND contains at least 5 new top-level inner describe blocks (fetchSprintStories, fetchSprintSubtasks, fetchJiraIssueByKey, searchJira, searchJiraClosed) — total it()/test() count >= 90. `npx tsc --noEmit` passes with no errors.
  </done>
</task>

<task type="auto">
  <name>Task 3: Full verification — typecheck, full test suite (exit code + count floor), surface parity grep</name>
  <files>(verification-only — no edits unless a test reveals a bug)</files>
  <action>
    Run the full verification battery and fix any regressions discovered.

    (1) Run `npx tsc --noEmit` from the `taskflow/` directory. Zero errors required. If errors appear, they will almost certainly be type narrowings inside the augmented test file (e.g. `as Response` casts) — fix locally, do not touch jira.ts production code unless a real type bug is found.

    (2) Run `npx vitest run` from the `taskflow/` directory. Use the process exit code as the source of truth: vitest exits 0 iff all tests pass. Save the run output for debugging, but do NOT rely on grep-matching stdout for FAIL detection (vitest's failure summary formatting varies and grep can miss real failures). Confirm exit code is 0.

    (3) Test count floor — confirm no test coverage was lost during the append step:
      `TESTCOUNT=$(grep -cE "^\s*it\(|^\s*test\(" taskflow/src/services/jira.test.ts)`
      Required: `TESTCOUNT >= 90`. This catches accidental overwrite of the existing 76 tests during the append in Task 2(B). Typical expected value is 90-95 (76 preserved + ~14-16 new across 5 describe blocks).

    (4) Confirm the 5 new inner describe blocks are present in jira.test.ts:
      `grep -c "describe('fetchSprintStories'\|describe('fetchSprintSubtasks'\|describe('fetchJiraIssueByKey'\|describe('searchJira'\|describe('searchJiraClosed'" taskflow/src/services/jira.test.ts` → expect 5.
      (Note: jira.test.ts already had `describe('fetchSprintIssues')`, so the 5 new ones are distinct from any prior coverage.)

    (5) Targeted vitest run for the appended blocks — run the new describe blocks in isolation to make failures easy to attribute:
      `npx vitest run -t "fetchSprintStories|fetchSprintSubtasks|fetchJiraIssueByKey|searchJira|searchJiraClosed" src/services/jira.test.ts`
      Exit code must be 0. If any of these fail:
      - First check whether the failure is a mock-related error (e.g. "fetchAllSearchPages is not a function") — that indicates the apiFetch-level rewrite in Task 2(B) was incomplete.
      - If the failure is an assertion mismatch (e.g. `expect(url).toContain('...')` failing), check whether the actual URL string in jira.ts matches the expected substring. The unified jira.ts is authoritative — adjust the test, not the production code, unless the URL is genuinely wrong (e.g. missing customfield_13415).

    (6) Surface parity grep — confirm all 13 functions are exported from jira.ts:
      `grep -E "^export (async )?function (fetchSprintIssues|fetchSprintStories|fetchSprintSubtasks|fetchMyTasksHierarchy|fetchIssueDetail|fetchIssueSummary|fetchJiraIssueByKey|updateIssueField|bulkUpdateIssue|createIssue|wrapCustomFieldValue|searchJira|searchJiraClosed)\b" taskflow/src/services/jira.ts | wc -l`
      Expected output: `13`.

    (7) Operation-name parity grep — confirm the 8 apiFetch operationName labels are present in jira.ts:
      `grep -E "'Load Issue Detail'|'Create/Edit Issue'|'Search Issues'|'Search Closed Issues'|'Fetch Issue By Key'" taskflow/src/services/jira.ts | wc -l`
      Expected: ≥ 8 (the count may be higher because `'Search Issues'` is also referenced by fetchAllSearchPages-related code; ≥8 is sufficient).

    (8) Critical-behavior grep — confirm the duedate field and subtask enrichment block survived:
      `grep -c "timetracking,duedate\|timetracking,duedate'" taskflow/src/services/jira.ts` → expect ≥ 3 (fetchSprintIssues, fetchMyTasksHierarchy, fetchSprintStories all include this)
      `grep -c "Jira's built-in subtasks field only returns summary+status" taskflow/src/services/jira.ts` → expect 1 (the enrichment block comment must survive)
      `grep -c "reporter,priority,customfield_13415" taskflow/src/services/jira.ts` → expect ≥ 1 (fetchJiraIssueByKey URL)

    (9) Smoke-import the 5 caller files via TypeScript compilation (already covered by step 1 — but explicitly verify by `grep` that all 5 now import from `@/services/jira`):
      `grep -E "from '@/services/jira'" taskflow/src/components/app/Sidebar.tsx taskflow/src/routes/dashboard/SprintBoardTab.tsx taskflow/src/routes/dashboard/BulkActionBar.tsx taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts | wc -l` → expect ≥ 5.

    If ALL nine checks pass, the refactor is complete. If any check fails, do not patch over the symptom — re-examine the corresponding step in Task 1 or Task 2 and finish that work properly.

    Note for pre-commit hook: per MEMORY.md feedback_no_verify_lint.md, `--no-verify` is OK when the lint hook fails on pre-existing unrelated warnings. Do NOT use `--no-verify` to bypass failures that this refactor introduces — fix those first.
  </action>
  <verify>
    <automated>cd taskflow &amp;&amp; npx tsc --noEmit 2&gt;&amp;1 | tee /tmp/krb-tsc-final.log &amp;&amp; ! grep -E "error TS" /tmp/krb-tsc-final.log &amp;&amp; npx vitest run 2&gt;&amp;1 | tee /tmp/krb-vitest.log; VITEST_EXIT=${PIPESTATUS[0]}; [ "$VITEST_EXIT" -eq 0 ] &amp;&amp; TESTCOUNT=$(grep -cE "^\s*it\(|^\s*test\(" src/services/jira.test.ts) &amp;&amp; [ "$TESTCOUNT" -ge 90 ] &amp;&amp; [ "$(grep -c "describe('fetchSprintStories'\|describe('fetchSprintSubtasks'\|describe('fetchJiraIssueByKey'\|describe('searchJira'\|describe('searchJiraClosed'" src/services/jira.test.ts)" -ge 5 ] &amp;&amp; [ "$(grep -cE "^export (async )?function (fetchSprintIssues|fetchSprintStories|fetchSprintSubtasks|fetchMyTasksHierarchy|fetchIssueDetail|fetchIssueSummary|fetchJiraIssueByKey|updateIssueField|bulkUpdateIssue|createIssue|wrapCustomFieldValue|searchJira|searchJiraClosed)\b" src/services/jira.ts)" -ge 13 ] &amp;&amp; [ "$(grep -c 'timetracking,duedate' src/services/jira.ts)" -ge 3 ] &amp;&amp; grep -q "Jira's built-in subtasks field only returns summary+status" src/services/jira.ts &amp;&amp; grep -q "reporter,priority,customfield_13415" src/services/jira.ts</automated>
  </verify>
  <done>
    All verifications green: `tsc --noEmit` passes, `vitest run` exits 0 (entire suite passes — checked via exit code, not stdout grep), jira.test.ts has >= 90 it()/test() blocks (no coverage lost), all 5 new describe blocks present in jira.test.ts, 13 named exports present in jira.ts, ≥3 occurrences of `timetracking,duedate`, the subtask-enrichment block comment is preserved, and `reporter,priority,customfield_13415` is present (fetchJiraIssueByKey URL). Refactor is complete and verified.
  </done>
</task>

</tasks>

<verification>
End-of-task pipeline (run from `taskflow/`):

1. `npx tsc --noEmit` — must pass with zero errors.
2. `npx vitest run` — must exit 0 (process exit code, not stdout grep). The augmented `src/services/jira.test.ts` must contribute >= 90 green tests (76 preserved + ~14 newly appended).
3. `! grep -rn "from '@/services/jira/issues'" taskflow/src/` — must return zero matches.
4. `[ ! -f taskflow/src/services/jira/issues.ts ]` — file must be deleted.
5. `[ ! -f taskflow/src/services/jira/issues.test.ts ]` — file must be deleted.
6. `[ -f taskflow/src/services/jira.test.ts ]` — augmented test file exists with >= 90 it()/test() blocks (test count floor enforces no coverage loss).
7. The 5 new inner describe blocks are present in jira.test.ts: fetchSprintStories, fetchSprintSubtasks, fetchJiraIssueByKey, searchJira, searchJiraClosed.
8. Spot-check the three preserved behaviors:
   - `grep -c "timetracking,duedate" taskflow/src/services/jira.ts` ≥ 3
   - `grep -q "Jira's built-in subtasks field only returns summary+status" taskflow/src/services/jira.ts`
   - `grep -q "reporter,priority,customfield_13415" taskflow/src/services/jira.ts`
</verification>

<success_criteria>
- Single canonical jira.ts file exports all 13 functions (fetchSprintIssues, fetchSprintStories, fetchSprintSubtasks, fetchMyTasksHierarchy, fetchIssueDetail, fetchIssueSummary, fetchJiraIssueByKey, updateIssueField, bulkUpdateIssue, createIssue, wrapCustomFieldValue, searchJira, searchJiraClosed) plus the rest of the existing surface (validateJira, listJiraProjects, fetchTransitions, comments, fix versions, etc.) — totalling 60+ exports.
- jira/issues.ts and jira/issues.test.ts are deleted.
- jira.test.ts is AUGMENTED, not replaced: all 76 original tests still pass AND the 5 unique-to-issues describe blocks are appended as inner siblings of the top-level `describe('jira service', ...)` block, yielding >= 90 total it()/test() blocks. The previously-broken `fetchJiraIssueByKey` URL assertion (Risk 6 from RESEARCH.md) is fixed during the append (split into three substring checks for customfield_13415, customfield_10016, reporter,priority).
- All 5 caller files import from `@/services/jira` only — no remaining `@/services/jira/issues` references anywhere in the repo.
- `duedate` field, subtask-assignee enrichment in `fetchIssueDetail`, and richer fields in `fetchJiraIssueByKey` (reporter/priority/customfield_13415) are all preserved — no silent behavioral regressions (Risk 1, 2, 6 from RESEARCH.md mitigated).
- `npx tsc --noEmit` passes and `npx vitest run` exits 0 (no FAIL detection via stdout grep — exit code is the contract).
- The dual-file gotcha noted in MEMORY.md `project_jira_ts_dual_file.md` is closed: there is now exactly one place to edit when modifying Jira service functions.
- CONTEXT.md Tests-section directive "Do not lose test coverage" is honored: the test count floor (>= 90 it()/test() blocks in jira.test.ts) blocks any execution that silently destroys the existing 76 tests.
</success_criteria>

<output>
Create `.planning/quick/260518-krb-there-are-two-duplicate-implementations-/260518-krb-SUMMARY.md` when done. The SUMMARY should record: (a) line numbers where the 3 new functions were inserted in jira.ts, (b) which optional cleanup steps were performed (step 7 of Task 1), (c) the exact insertion line number in jira.test.ts where the 5 new describe blocks were appended, (d) any test rewrites that diverged from the plan (specifically for the fetchAllSearchPages mock removal), and (e) the final it()/test() count in the augmented jira.test.ts (must be >= 90).
</output>
</content>
</invoke>