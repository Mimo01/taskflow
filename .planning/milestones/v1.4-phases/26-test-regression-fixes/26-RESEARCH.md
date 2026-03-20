# Phase 26: Test Regression Fixes - Research

**Researched:** 2026-03-19
**Domain:** Vitest test suite repair (React/Tauri app)
**Confidence:** HIGH

## Summary

The test suite has 57 test failures across 10 files and 47 unhandled rejection errors (all from LazyStore/Tauri IPC), plus 5 TypeScript errors across 2 files. Running from the project root (`/Tasker`) instead of the `taskflow` subdirectory causes an additional 132 failures because vitest does not pick up `taskflow/vitest.config.ts` (no jsdom environment, no setup file, no `@` alias). The success criterion says `npm test` must pass, but no `test` script exists in `package.json` -- this must be added.

The failures fall into 5 distinct root-cause categories, each with a clear fix pattern. The LazyStore unhandled rejections (47 errors) are the highest-impact fix because they affect 8 different test files and can be solved with a single global mock in the test setup file. The remaining test failures are component-level issues: missing mock props, outdated assertions, and missing router/mock exports.

**Primary recommendation:** Fix in this order: (1) add `npm test` script, (2) global LazyStore mock in setup.ts, (3) update settings store mocks to include `quickFilters`, (4) fix individual test assertions to match current production behavior, (5) fix TypeScript errors.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Default to updating tests to match current production code behavior
- Only fix production code if the test reveals a genuine runtime bug
- For the UnifiedFilterBar `quickFilters` crash: fix in tests only (provide missing props) -- production code always passes the prop correctly
- Treat all failures equally regardless of origin -- goal is a clean suite, not attribution
- Small production fixes (missing defaults, prop threading) are acceptable if needed to make tests pass; defer to Phase 27 only if architectural changes are required
- Mock LazyStore with a synchronous in-memory mock in test setup -- tests don't need real Tauri persistence
- Fix ALL 57 failing tests, not just the 6 originally documented
- Fix with proper typing (update interfaces, add missing mock properties, correct signatures) -- no `as X` type assertion workarounds
- Minimal fixes only -- just make tests pass
- Don't improve weak assertions or add missing edge cases -- Phase 28 handles that
- Don't add new tests beyond what's needed to fix existing failures

### Claude's Discretion
- Test structure decisions (preserve vs light refactor of describe blocks, test names)
- LazyStore mock architecture (shared utility vs inline per file)
- Verification approach (incremental per file vs final full run)
- Commit structure (per test file, per failure category, or grouped)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-03 | Fix 6 pre-existing Phase 8 test regressions | Covered by root-cause categories 2-4 (quickFilters crash, assertion mismatches, missing mock exports); all 6 original regressions are within the 57 total failures |
| TEST-04 | Fix 8 LazyStore teardown warnings in test suite | Root-cause category 1: global `@tauri-apps/plugin-store` mock in setup.ts eliminates all 47 unhandled rejections |
| TEST-05 | Fix 2 pre-existing TypeScript errors in test files | Root-cause category 5: SprintBoardTab.test.tsx JiraIssue type mismatch (4 TS errors) + jira.ts unused variable (1 TS error) |

</phase_requirements>

## Architecture Patterns

### Root-Cause Categories (5 categories, all failures mapped)

#### Category 1: LazyStore / Tauri IPC Unhandled Rejections (47 errors, 8 files)

**What:** Every Zustand store using `persist` with `@tauri-apps/plugin-store` LazyStore triggers unhandled promise rejections because `window.__TAURI_INTERNALS__` is undefined in jsdom. These show as "Unhandled Rejection: TypeError: Cannot read properties of undefined (reading 'invoke')" in test output.

**Affected stores (7 files with `new LazyStore`):**
- `src/stores/auth.store.ts` (auth.json)
- `src/stores/settings.store.ts` (settings.json)
- `src/stores/notifications.store.ts` (notifications.json)
- `src/stores/recent-items.store.ts` (recent-items.json)
- `src/stores/pinned-tabs.store.ts` (pinned-tabs.json)
- `src/services/stronghold.ts` (stronghold-meta.json)
- `src/services/theme.ts` (settings.json)

**Affected test files (8 files generate these errors):**
- `src/routes/notifications/NotificationPopover.test.tsx` (15 errors)
- `src/routes/dashboard/SprintBoardTab.test.tsx` (15 errors)
- `src/components/app/TopBar.test.tsx` (8 errors)
- `src/services/jira.test.ts` (4 errors)
- `src/services/gitlab.test.ts` (2 errors)
- `src/services/notifications.test.ts` (1 error)
- `src/routes/dashboard/IssueDetailSidebar.test.ts` (1 error)
- `src/routes/dashboard/IssueDetailSheet.test.tsx` (1 error)

**Fix pattern:** Global mock of `@tauri-apps/plugin-store` in `src/test/setup.ts`:

```typescript
// Mock @tauri-apps/plugin-store globally — LazyStore needs Tauri IPC which
// is unavailable in jsdom. Provide a synchronous in-memory implementation.
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    private data = new Map<string, unknown>();
    async get<T>(key: string): Promise<T | undefined> {
      return this.data.get(key) as T | undefined;
    }
    async set(key: string, value: unknown): Promise<void> {
      this.data.set(key, value);
    }
    async delete(key: string): Promise<void> {
      this.data.delete(key);
    }
    async save(): Promise<void> {}
    async load(): Promise<void> {}
  }
  return { LazyStore };
});
```

**Why global, not per-file:** 7 production files instantiate LazyStore at module scope. Any test that transitively imports these (even through components) will trigger the error. A setup-file mock catches them all.

#### Category 2: Missing `quickFilters` in Settings Store Mocks (31+ failures, 2 files)

**What:** `UnifiedFilterBar` reads `quickFilters` from `useSettingsStore()`. Tests that mock the settings store without providing `quickFilters` (and related functions: `addQuickFilter`, `removeQuickFilter`, `renameQuickFilter`, `moveQuickFilter`) cause a crash: `TypeError: Cannot read properties of undefined (reading 'length')` at line 299 of `UnifiedFilterBar.tsx`.

**Affected test files:**
- `src/routes/dashboard/SprintBoardTab.test.tsx` (15 of 17 failures)
- `src/routes/dashboard/BacklogPage.test.tsx` (all 16 failures)

**Fix pattern:** Add `quickFilters: []` plus stub functions to every `useSettingsStore` mock:

```typescript
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    storyPointsFieldKey: 'customfield_10016',
    epicLinkFieldKey: 'customfield_10014',
    epicColorFieldKey: 'customfield_10013',
    // Must provide quickFilters or UnifiedFilterBar crashes
    quickFilters: [],
    addQuickFilter: vi.fn(),
    removeQuickFilter: vi.fn(),
    renameQuickFilter: vi.fn(),
    moveQuickFilter: vi.fn(),
  })),
}));
```

Also add `epicColorFieldKey` and `epicNameFieldKey` where missing, since these are now used by production components.

#### Category 3: Missing Mock Exports / Router Context (8+ failures, 2+ files)

**What:** Several test files mock `react-router-dom` but don't export all hooks the component needs. Most common: `useLocation` missing causes `MrAttentionTab` (8 failures) and `IssueDetailSheet` (some failures) to crash.

**Affected:**
- `src/routes/dashboard/MrAttentionTab.test.tsx` -- all 8 failures from missing `useLocation` export
- `src/routes/dashboard/IssueDetailSheet.test.tsx` -- `useNavigate` not in router context

**Fix pattern:** Add missing exports to router mock:

```typescript
vi.mock('react-router-dom', () => ({
  useOutletContext: vi.fn(() => ({ /* ... */ })),
  useNavigate: vi.fn(() => vi.fn()),
  useLocation: vi.fn(() => ({ pathname: '/dashboard', search: '', hash: '', state: null, key: 'default' })),
}));
```

#### Category 4: Production Code Changed, Test Assertions Outdated (6+ failures, 4+ files)

**What:** Production code evolved but test expectations were not updated. Each requires updating the test to match current behavior.

**Specific cases:**

| File | Tests | Root Cause | Fix |
|------|-------|------------|-----|
| `src/services/jira.test.ts` | 2 | `discoverCustomFields` now returns 5 fields (added `epicColorFieldKey`) but test expects 4 | Add `epicColorFieldKey: 'customfield_10013'` to expected objects |
| `src/services/notifications.test.ts` | 4 | Broadened notification matching (assignee/reporter/watcher) tests expect behavior that production code no longer implements this way | Update test expectations to match current `fetchJiraNotifications` implementation |
| `src/routes/notifications/NotificationPopover.test.tsx` | 2 | Read/unread toggle behavior changed | Update assertions to match current component behavior |
| `src/routes/notifications/NotificationRow.test.tsx` | 1 | Missing `parentKey` chip rendering | Update test to match current NotificationRow component structure |
| `src/components/app/KeyboardShortcutsPanel.test.tsx` | 1 | Shortcut key badge text changed | Update expected text |
| `src/components/app/RecentItemsPopover.test.tsx` | 1 | `openUrl` call behavior changed | Update assertion |
| `src/routes/dashboard/IssueDetailSheet.test.tsx` | 7 | Multiple: optimistic update API changed, linked issues rendering changed, comment thread rendering changed | Update each test assertion to match current implementation |

#### Category 5: TypeScript Errors (5 errors, 2 files)

**What:** `tsc --noEmit` reports 5 errors:

1. **`src/routes/dashboard/SprintBoardTab.test.tsx`** (4 errors): `makeIssue()` helper returns objects missing required `JiraIssue` fields. The type changed (added required fields) but test fixture wasn't updated.

2. **`src/services/jira.ts`** (1 error): `_sprintIdsWithIssues` declared but never read (TS6133). Unused variable.

**Fix pattern for SprintBoardTab.test.tsx:** Update `makeIssue()` helper to include all required `JiraIssue` fields (likely missing `description`, `subtasks`, `timetracking`, or similar optional-but-typed fields). Use proper typing per user constraint -- no `as X` workarounds.

**Fix pattern for jira.ts:** Remove or use the `_sprintIdsWithIssues` variable. Since this is a small production fix, it's acceptable per user constraints.

### Infrastructure Fix: `npm test` Script

**What:** Success criterion #4 says `npm test` runs clean, but `taskflow/package.json` has no `test` script. Running `npx vitest run` from the `taskflow` directory works correctly.

**Fix:** Add to `taskflow/package.json` scripts:
```json
"test": "vitest run"
```

### Recommended Project Structure for Fixes

```
taskflow/
├── src/test/
│   └── setup.ts              # ADD: global LazyStore mock + existing crypto polyfill
├── src/routes/dashboard/
│   ├── SprintBoardTab.test.tsx    # FIX: settings mock, makeIssue types, quickFilters
│   ├── BacklogPage.test.tsx       # FIX: settings mock (quickFilters)
│   ├── MrAttentionTab.test.tsx    # FIX: add useLocation to router mock
│   └── IssueDetailSheet.test.tsx  # FIX: router context, updated assertions
├── src/services/
│   ├── jira.test.ts               # FIX: discoverCustomFields expects 5 fields
│   ├── jira.ts                    # FIX: remove unused _sprintIdsWithIssues
│   └── notifications.test.ts     # FIX: update broadened notification assertions
├── src/routes/notifications/
│   ├── NotificationPopover.test.tsx  # FIX: read/unread toggle assertions
│   └── NotificationRow.test.tsx      # FIX: parentKey chip assertion
├── src/components/app/
│   ├── KeyboardShortcutsPanel.test.tsx  # FIX: key badge text
│   └── RecentItemsPopover.test.tsx      # FIX: openUrl assertion
└── package.json               # ADD: "test" script
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tauri store mock | Custom window.__TAURI_INTERNALS__ shim | vi.mock('@tauri-apps/plugin-store') with in-memory Map | Module mock intercepts at import level; shimming the global is fragile and version-dependent |
| Router context in tests | Wrapping every render in `<MemoryRouter>` | vi.mock('react-router-dom') with needed hooks | Tests already use this pattern; consistency matters more than correctness |
| QueryClient per test | Shared singleton QueryClient | `new QueryClient()` in beforeEach with `retry: false` | Existing pattern in codebase; prevents test pollution |

## Common Pitfalls

### Pitfall 1: Vitest Config Not Found When Running From Root
**What goes wrong:** Running `npx vitest run` from `/Tasker` (project root) instead of `/Tasker/taskflow` causes vitest to miss the config. All jsdom, setup files, and path aliases are lost. Tests fail with "document is not defined" (51 instances) and "window is not defined" (11 instances).
**Why it happens:** vitest.config.ts is in `taskflow/`, not the repo root. Vitest searches upward from cwd.
**How to avoid:** Always run from `taskflow/` directory, or use `--config` flag. The `npm test` script in `taskflow/package.json` solves this.
**Warning signs:** 189 failures instead of 57; `environment 0ms` in vitest output.

### Pitfall 2: LazyStore Mock Must Be in Setup File, Not Per-Test
**What goes wrong:** Mocking `@tauri-apps/plugin-store` in individual test files only catches direct imports. Stores imported transitively (e.g., component imports store) still trigger the real LazyStore.
**Why it happens:** `vi.mock()` in a test file only applies to that file's module graph. But stores are instantiated at module scope when any importer loads them.
**How to avoid:** Place the mock in `src/test/setup.ts` which runs before all tests.
**Warning signs:** Some tests pass, others still get "Unhandled Rejection" despite having per-file mocks.

### Pitfall 3: Incomplete Settings Store Mock
**What goes wrong:** Mocking `useSettingsStore` with only 2-3 fields causes crashes in components that read additional fields (e.g., `quickFilters`, `epicColorFieldKey`, `epicNameFieldKey`).
**Why it happens:** The settings store grew over multiple phases. Old test mocks don't include new fields.
**How to avoid:** When mocking `useSettingsStore`, include all fields that the component-under-test (and its children) access. At minimum: `storyPointsFieldKey`, `epicLinkFieldKey`, `epicNameFieldKey`, `epicColorFieldKey`, `quickFilters: []`, and the quickFilter mutation functions.
**Warning signs:** "Cannot read properties of undefined" errors pointing to UnifiedFilterBar or other child components.

### Pitfall 4: Forgetting to Mock @tauri-apps/plugin-opener
**What goes wrong:** Tests that render components with "Open in Jira/GitLab" buttons crash because `openUrl` from `@tauri-apps/plugin-opener` calls Tauri IPC.
**How to avoid:** Mock `@tauri-apps/plugin-opener` in tests that render components using it.

### Pitfall 5: Changing Test Assertions Without Verifying Production Behavior
**What goes wrong:** Blindly updating test expectations to "whatever the test output shows" may mask real bugs.
**How to avoid:** For each assertion mismatch, verify the current production code behavior first. The user decision says "default to updating tests to match current production code behavior" -- but verify the behavior is intentional, not a bug.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-03 | 6 Phase 8 test regressions pass | unit | `cd taskflow && npx vitest run` (all 57 failures resolved) | Existing tests |
| TEST-04 | 8 LazyStore teardown warnings gone | unit | `cd taskflow && npx vitest run 2>&1 \| grep "Unhandled" \| wc -l` (must be 0) | setup.ts mock |
| TEST-05 | TS errors in test files resolved | type-check | `cd taskflow && npx tsc --noEmit 2>&1 \| grep "\.test\." \| wc -l` (must be 0) | Existing files |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run [changed-test-file]`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green + `npx tsc --noEmit` clean

### Wave 0 Gaps
- [x] Test framework installed (Vitest 4.1.0)
- [x] Test config exists (`taskflow/vitest.config.ts`)
- [x] Setup file exists (`taskflow/src/test/setup.ts`)
- [ ] `taskflow/package.json` missing `"test": "vitest run"` script
- [ ] `src/test/setup.ts` missing global LazyStore mock

## Current Test Suite Baseline

| Metric | Value |
|--------|-------|
| Total test files | 43 |
| Passing test files | 32 |
| Failing test files | 10 |
| Skipped test files | 1 |
| Total tests | 493 |
| Passing tests | 432 |
| Failing tests | 57 |
| Todo tests | 4 |
| Unhandled errors | 47 |
| TS errors (test files) | 4 |
| TS errors (production, incidental) | 1 |

### Failure Breakdown by File

| File | Failures | Root Cause Category |
|------|----------|-------------------|
| SprintBoardTab.test.tsx | 15 | Cat 2 (quickFilters) + Cat 5 (TS types) |
| BacklogPage.test.tsx | 16 | Cat 2 (quickFilters) |
| MrAttentionTab.test.tsx | 8 | Cat 3 (missing useLocation) |
| IssueDetailSheet.test.tsx | 7 | Cat 3 (router) + Cat 4 (assertions) |
| notifications.test.ts | 4 | Cat 4 (assertions) |
| jira.test.ts | 2 | Cat 4 (assertions -- epicColorFieldKey) |
| NotificationPopover.test.tsx | 2 | Cat 4 (assertions) |
| NotificationRow.test.tsx | 1 | Cat 4 (assertions) |
| KeyboardShortcutsPanel.test.tsx | 1 | Cat 4 (assertions) |
| RecentItemsPopover.test.tsx | 1 | Cat 4 (assertions) |
| **Total** | **57** | |

## Sources

### Primary (HIGH confidence)
- Direct test execution: `cd taskflow && npx vitest run` -- all failure counts and error messages verified empirically
- Direct TypeScript check: `cd taskflow && npx tsc --noEmit` -- all 5 TS errors verified empirically
- Source code inspection: All affected store files, test files, and component files read directly

### Secondary (MEDIUM confidence)
- Root cause analysis for Category 4 (assertion mismatches): verified that production code changed by inspecting source, but exact fix for each test requires reading both the test and the current component implementation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Vitest 4.1.0, existing config verified
- Architecture (root causes): HIGH -- all 5 categories verified by running tests and inspecting code
- Pitfalls: HIGH -- discovered empirically (root-vs-taskflow directory issue, LazyStore mock scope)
- Individual test fixes: MEDIUM -- each Category 4 fix requires reading current production code during implementation

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- fixing existing tests, no external dependencies)
