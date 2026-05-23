# Quick Task 260518-krb: Jira Unification — Research

**Researched:** 2026-05-18
**Domain:** TypeScript service layer refactor — duplicate function consolidation
**Confidence:** HIGH (all findings verified by direct source inspection)

---

## Summary

`jira.ts` (2209 lines) and `jira/issues.ts` (718 lines) share 10 duplicate functions plus 3 functions that are unique to `issues.ts` and must be moved. The differences between the two versions are mostly minor and well-understood: `issues.ts` uses `isResponseLikeError(err)` helper instead of inline duck-typing, passes an `operationName` 4th argument to `apiFetch`, and `fetchIssueDetail` in `issues.ts` strips out the subtask-enrichment second query that exists in `jira.ts`. There is one behavioral regression to watch: `jira.ts`'s `fetchIssueDetail` has a subtask-assignee enrichment block that `issues.ts` drops entirely. The decision to use `issues.ts` bodies means that enrichment is lost unless it is deliberately preserved.

**Primary recommendation:** Use `issues.ts` function bodies as the replacement in `jira.ts`, but manually re-examine `fetchIssueDetail` — the `issues.ts` version is a simplified rewrite that silently drops the subtask-assignee enrichment that currently exists in `jira.ts`. Decide explicitly whether to keep it.

---

## Diff Analysis — All 10 Duplicate Functions

### 1. `fetchSprintIssues`

| Dimension | jira.ts | jira/issues.ts |
|-----------|---------|----------------|
| Error detection | 18-line inline duck-type cast | `isResponseLikeError(err)` helper (3 lines) |
| `duedate` in fields string | YES — `...timetracking,duedate` | NO — `...timetracking` (no duedate) |
| `SUBTASK_CHUNK_SIZE` source | Local const on line 180 | Imported from `./client` |
| `@deprecated` tag | No | Yes — says "use fetchSprintStories + fetchSprintSubtasks" |

**Winner:** `issues.ts` body is cleaner, BUT the `duedate` field difference is a behavioral regression. The `jira.ts` version fetches `duedate` on sprint issues; `issues.ts` drops it. Sprint board callers that read `issue.fields.duedate` will silently get `undefined` after the switch. **Must add `duedate` back to the `issues.ts` version.**

---

### 2. `fetchMyTasksHierarchy`

| Dimension | jira.ts | jira/issues.ts |
|-----------|---------|----------------|
| Error detection | Inline duck-type cast | `isResponseLikeError(err)` helper |
| `duedate` in fields string | YES — `...timetracking,duedate` | NO — `...timetracking` |
| Logic | Identical (4-step strategy) | Identical |

**Winner:** Same situation as `fetchSprintIssues`. The `duedate` field is present in `jira.ts` but absent in `issues.ts`. Add `duedate` back when copying `issues.ts` body.

---

### 3. `fetchIssueDetail`

| Dimension | jira.ts | jira/issues.ts |
|-----------|---------|----------------|
| `customfield_13415` in fields array | YES (line 1154) | YES (line 371) — identical |
| `apiFetch` 4th arg (operationName) | ABSENT — no 4th arg | `'Load Issue Detail'` |
| Subtask-assignee enrichment block | YES — 22 lines (lines 1189–1213), fetches assignees for all subtasks | ABSENT — returns issue as-is |
| Return type | `await response.json() as JiraIssueDetail` then enrichment, then return | `return response.json() as Promise<JiraIssueDetail>` (no enrichment) |

**Winner:** `issues.ts` body is cleaner and has the operation name. However, it drops the subtask-assignee enrichment entirely. This enrichment was intentional: Jira's built-in `subtasks` field only returns `summary+status`, not `assignee`. The issue detail sidebar subtask list with avatars relies on this. **Must explicitly decide: keep enrichment or drop it.** Recommended: keep it, copy to `issues.ts` body before merging.

---

### 4. `fetchIssueSummary`

| Dimension | jira.ts | jira/issues.ts |
|-----------|---------|----------------|
| `apiFetch` 4th arg | ABSENT | `'Load Issue Detail'` |
| Logic | Identical | Identical |

**Winner:** `issues.ts`. Only difference is the operation name label.

---

### 5. `updateIssueField`

| Dimension | jira.ts | jira/issues.ts |
|-----------|---------|----------------|
| `apiFetch` 4th arg | ABSENT | `'Create/Edit Issue'` |
| Logic | Identical | Identical |

**Winner:** `issues.ts`. Only difference is the operation name label.

---

### 6. `createIssue`

| Dimension | jira.ts | jira/issues.ts |
|-----------|---------|----------------|
| `apiFetch` 4th arg | ABSENT | `'Create/Edit Issue'` |
| Logic | Identical | Identical |

**Winner:** `issues.ts`. Only difference is the operation name label.

---

### 7. `bulkUpdateIssue`

| Dimension | jira.ts | jira/issues.ts |
|-----------|---------|----------------|
| `apiFetch` 4th arg | ABSENT | `'Create/Edit Issue'` |
| Logic | Identical | Identical |

**Winner:** `issues.ts`. Only difference is the operation name label.

---

### 8. `wrapCustomFieldValue`

| Dimension | jira.ts | jira/issues.ts |
|-----------|---------|----------------|
| Logic | Identical | Identical |
| Comment wording | `"accounts, versions, components…"` | `"accounts, versions, components..."` (3 dots vs ellipsis) |

**Winner:** Either. Pure logic function, no imports needed.

---

### 9. `searchJira`

| Dimension | jira.ts | jira/issues.ts |
|-----------|---------|----------------|
| `apiFetch` 4th arg | ABSENT | `'Search Issues'` |
| Logic | Identical | Identical |

**Winner:** `issues.ts`. Only difference is the operation name label.

---

### 10. `searchJiraClosed`

| Dimension | jira.ts | jira/issues.ts |
|-----------|---------|----------------|
| `apiFetch` 4th arg | ABSENT | `'Search Closed Issues'` |
| Logic | Identical | Identical |

**Winner:** `issues.ts`. Only difference is the operation name label.

---

## Functions Unique to `jira/issues.ts` — Must Be Moved to `jira.ts`

### `fetchSprintStories`
New function split out from `fetchSprintIssues` — fetches only parent issues. Callers: `Sidebar.tsx`, `SprintBoardTab.tsx`. No equivalent in `jira.ts`. Move inline.

### `fetchSprintSubtasks`
New function split out — fetches only subtasks for given parent keys. Caller: `SprintBoardTab.tsx`. No equivalent in `jira.ts`. Move inline.

### `fetchJiraIssueByKey`
Currently in `jira/issues.ts` but re-exported by `jira.ts` line 24 via `export { fetchJiraIssueByKey } from './jira/issues'`. Move body into `jira.ts`, remove the re-export line. **Important:** the `issues.ts` version of this function fetches `reporter,priority,customfield_13415` in addition to the base fields — these were added in a recent fix. The `jira.ts` re-export transparently surfaces the `issues.ts` version, so existing callers (CommandPalette, AioCycleDetailPage) already get the richer fields.

---

## Dependencies: What `jira/issues.ts` Imports That `jira.ts` Doesn't

| Import | Source | Status in `jira.ts` |
|--------|--------|---------------------|
| `isResponseLikeError` | `./jira/client` | NOT imported — `jira.ts` has 3 identical inline duck-type blocks instead |
| `SUBTASK_CHUNK_SIZE` | `./jira/client` | NOT imported — `jira.ts` has its own `const SUBTASK_CHUNK_SIZE = 50` on line 180 |
| `fetchAllSearchPages` | `./jira/client` | NOT imported — `jira.ts` has its own private copy of this function (lines 202–241) |
| `JiraIssue`, `JiraIssueDetail`, `CreatemetaField` | `./jira/types` | `jira.ts` defines these inline, does NOT import from `./jira/types` |

**Action required for merge:**
1. Add `import { isResponseLikeError } from './jira/client';` to `jira.ts` (or inline the helper — the inline version already exists three times in `jira.ts`; using the shared helper is cleaner).
2. `SUBTASK_CHUNK_SIZE` — `jira.ts` already has `const SUBTASK_CHUNK_SIZE = 50` on line 180. No import needed; the functions that move in will use the local const.
3. `fetchAllSearchPages` — `jira.ts` has its own private copy. The moved-in functions will use the existing local `fetchAllSearchPages`. No import needed.

The simplest path: add only `isResponseLikeError` import from `./jira/client`. Everything else is already in `jira.ts`.

---

## Test Coverage Analysis

`issues.test.ts` tests the following functions (all imported from `./issues`):

| Function | Test count | Notes |
|----------|------------|-------|
| `fetchSprintIssues` | 5 tests | Tests mock `fetchAllSearchPages` and `isResponseLikeError` from `./client` |
| `fetchIssueDetail` | 5 tests | Tests mock `apiFetch` directly. Includes `customfield_13415` URL check and type access test. |
| `createIssue` | 3 tests | Checks 4th arg `'Create/Edit Issue'` in apiFetch call |
| `updateIssueField` | 3 tests | Checks 4th arg `'Create/Edit Issue'` in apiFetch call |
| `fetchSprintStories` | 5 tests | Mocks `fetchAllSearchPages` and `isResponseLikeError` |
| `fetchSprintSubtasks` | 4 tests | Mocks `fetchAllSearchPages`, tests SUBTASK_CHUNK_SIZE splitting |
| `searchJira` | 3 tests | Mocks `apiFetch` |
| `fetchJiraIssueByKey` | 8 tests | Includes URL field string check at line 421 |
| `searchJiraClosed` | 4 tests | Includes JQL `statusCategory = Done` check |

**Total: ~40 tests. All must be preserved.**

**After migration, the test file's import path changes from `'./issues'` to `'../../services/jira'` (or a relative equivalent). The mock paths also change:**
- `vi.mock('../../lib/apiFetch', ...)` — stays the same (same relative depth from `taskflow/src/services/`)
- `vi.mock('./client', ...)` — becomes `vi.mock('./jira/client', ...)` if test moves, OR functions move to `jira.ts` and no longer call through `./client` (they use the local copies). **This is the critical test decision.**

**Recommended approach:** Move the test file to `taskflow/src/services/jira.test.ts`, update its import path to `'./jira'` or `'./jira/issues'` depending on where the functions land. Mock paths for `apiFetch` stay `'../lib/apiFetch'`. The `./client` mock becomes irrelevant once functions are in `jira.ts` (they call local `fetchAllSearchPages`, not the one from `./client`). The tests that mock `fetchAllSearchPages` will need to mock the local function — which is a private function in `jira.ts`, not directly mockable. **This is the major testing risk.**

---

## Risk Analysis

### Risk 1: `duedate` field dropped from `fetchSprintIssues` and `fetchMyTasksHierarchy`
- **What breaks:** Any component reading `issue.fields.duedate` from sprint issues will get `undefined` silently.
- **Verify:** Search for `duedate` in components that consume `fetchSprintIssues`/`fetchMyTasksHierarchy` results.
- **Fix:** Add `duedate` to the `fields` string in the `issues.ts` version before merging.

### Risk 2: `fetchIssueDetail` subtask-assignee enrichment dropped
- **What breaks:** Issue detail subtask list shows no avatars / `assignee: undefined` for all subtasks.
- **Verify:** Open any issue detail with subtasks.
- **Fix:** Copy the enrichment block from `jira.ts` lines 1189–1213 into the `issues.ts` version before merging.

### Risk 3: `fetchAllSearchPages` in `jira.ts` vs `./client` — two implementations diverged
- `jira.ts` version (line 212): calls `apiFetch` directly without `getJiraLimit()`.
- `./client` version (line 68): wraps apiFetch call in `getJiraLimit()(() => ...)` — concurrency limiter.
- The modular functions in `issues.ts` use the `./client` version (with rate limiting). Once moved to `jira.ts`, they will use the local version (without rate limiting), silently losing concurrency control.
- **Fix:** Either import `fetchAllSearchPages` from `./jira/client` in `jira.ts` (and remove the local private copy), or add `getJiraLimit()` to the local copy. Importing from client is the correct approach.

### Risk 4: `isResponseLikeError` not yet in `jira.ts`
- If only the function bodies are copied without importing `isResponseLikeError`, TypeScript will fail to compile.
- **Fix:** Add `import { isResponseLikeError } from './jira/client';` to `jira.ts`.

### Risk 5: Test file mock breakage for `fetchAllSearchPages`
- `issues.test.ts` mocks `./client` to control `fetchAllSearchPages`. After moving functions to `jira.ts`, those functions use the private local `fetchAllSearchPages` in `jira.ts`, which cannot be externally mocked by the test.
- **Options:** (a) Import `fetchAllSearchPages` from `./jira/client` in `jira.ts` (keeps mock path valid), (b) rewrite affected tests to mock at `apiFetch` level. Option (a) is cleaner and enables the mock to work as-is if the test is updated to `vi.mock('./jira/client', ...)`.

### Risk 6: `fetchJiraIssueByKey` test URL expectation mismatch
- Test line 421: `expect(url).toContain('fields=summary,status,assignee,customfield_10016,issuetype')`
- Actual URL in `issues.ts`: `fields=summary,status,assignee,reporter,priority,customfield_13415,customfield_10016,issuetype`
- The `toContain` check will **FAIL** — the expected substring is not present in the actual URL because `reporter,priority,customfield_13415,` are inserted before `customfield_10016`.
- **Fix:** Update the test assertion to `toContain('customfield_10016')` and `toContain('customfield_13415')` separately, or update the expected substring to match the real URL.

---

## Integration Points — Direct Importers of `jira/issues.ts` (5 files)

| File | Imports |
|------|---------|
| `taskflow/src/components/app/Sidebar.tsx` | `fetchSprintStories` |
| `taskflow/src/routes/dashboard/SprintBoardTab.tsx` | `fetchSprintStories`, `fetchSprintSubtasks` |
| `taskflow/src/routes/dashboard/BulkActionBar.tsx` | `updateIssueField` |
| `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts` | `updateIssueField` |
| `taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts` | `bulkUpdateIssue`, `createIssue`, `wrapCustomFieldValue` |

All 5 files must have their import path changed from `@/services/jira/issues` to `@/services/jira`.

**Callers already using `@/services/jira` (no change needed):**
- `fetchJiraIssueByKey`: `CommandPalette.tsx`, `AioCycleDetailPage.tsx` — already reach it through `jira.ts` re-export
- `fetchIssueDetail`: `IssueDetailSheet.tsx`, `IssueDetailPage.tsx` — already use `@/services/jira`
- `fetchSprintIssues`, `fetchMyTasksHierarchy`, `searchJira`, etc.: already use `@/services/jira`

---

## Ordered Implementation Steps (for planner)

1. Add `import { isResponseLikeError, fetchAllSearchPages as fetchAllSearchPagesClient } from './jira/client';` to `jira.ts` — or decide to use only local helpers (see Risk 3/5 above).
2. In `jira.ts`: replace the 10 duplicate function bodies with `issues.ts` versions, preserving `duedate` field in `fetchSprintIssues` and `fetchMyTasksHierarchy`, and preserving subtask-enrichment block in `fetchIssueDetail`.
3. Add `fetchSprintStories` and `fetchSprintSubtasks` to `jira.ts`.
4. Move `fetchJiraIssueByKey` body into `jira.ts` and remove line 24 re-export.
5. Update 5 caller files to import from `@/services/jira` instead of `@/services/jira/issues`.
6. Update `issues.test.ts`: change import path, fix `fetchJiraIssueByKey` URL assertion (Risk 6), update `vi.mock` paths.
7. Delete `jira/issues.ts`.
8. Verify `jira/index.ts` — it does NOT re-export from `issues.ts`, so no change needed there.

---

## Sources

All findings are `[VERIFIED]` by direct inspection of:
- `taskflow/src/services/jira.ts` (2209 lines)
- `taskflow/src/services/jira/issues.ts` (718 lines)
- `taskflow/src/services/jira/client.ts` (146 lines)
- `taskflow/src/services/jira/index.ts` (14 lines)
- `taskflow/src/services/jira/issues.test.ts` (539 lines)
- `grep -rn` output of all import consumers
