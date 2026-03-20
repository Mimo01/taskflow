# Phase 26: Test Regression Fixes - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all pre-existing test failures and warnings so the test suite runs clean. This covers 57 failing tests across 10 files, 8 LazyStore teardown warnings, and 2 TypeScript errors in test files. No new test coverage (Phase 28), no refactoring (Phase 27) — just make the existing suite green.

</domain>

<decisions>
## Implementation Decisions

### Fix vs update strategy
- Default to updating tests to match current production code behavior
- Only fix production code if the test reveals a genuine runtime bug
- For the UnifiedFilterBar `quickFilters` crash: fix in tests only (provide missing props) — production code always passes the prop correctly
- Treat all failures equally regardless of origin (Phase 8 regressions, dep update side effects, or other causes) — goal is a clean suite, not attribution
- Small production fixes (missing defaults, prop threading) are acceptable if needed to make tests pass; defer to Phase 27 only if architectural changes are required

### LazyStore teardown
- Mock LazyStore with a synchronous in-memory mock in test setup — tests don't need real Tauri persistence
- LazyStore mock placement and structure (shared utility vs inline) is Claude's discretion

### Scope boundaries
- Fix ALL 57 failing tests, not just the 6 originally documented — success criterion #4 ("npm test runs with zero failures and zero warnings") already covers this
- Roadmap success criteria left as-is — the intent is clear

### TypeScript errors
- Fix with proper typing (update interfaces, add missing mock properties, correct signatures) — no `as X` type assertion workarounds

### Test quality bar
- Minimal fixes only — just make tests pass
- Don't improve weak assertions or add missing edge cases — Phase 28 (TEST-01, TEST-02) is scoped for comprehensive coverage
- Don't add new tests beyond what's needed to fix existing failures

### Claude's Discretion
- Test structure decisions (preserve vs light refactor of describe blocks, test names)
- LazyStore mock architecture (shared utility vs inline per file)
- Verification approach (incremental per file vs final full run)
- Commit structure (per test file, per failure category, or grouped)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — TEST-03 (6 Phase 8 regressions), TEST-04 (8 LazyStore teardown warnings), TEST-05 (2 TS errors in test files)

### Phase context
- `.planning/ROADMAP.md` — Phase 26 success criteria (all 4 must be TRUE)
- `.planning/phases/25-tooling-dependencies/25-CONTEXT.md` — Phase 25 decisions (Biome active, deps updated, noExplicitAny suppressed)

### Project conventions
- `.planning/PROJECT.md` — Key decisions table (tauriService abstraction, vi.stubGlobal pattern for tests, prop threading not context)

</canonical_refs>

<code_context>
## Existing Code Insights

### Failing Test Files (10 files, 57 failures, 47 errors)
- `src/routes/dashboard/SprintBoardTab.test.tsx` — 15 failures (UnifiedFilterBar quickFilters crash)
- `src/routes/dashboard/BacklogPage.test.tsx` — 16 failures (all tests failing)
- `src/routes/dashboard/MrAttentionTab.test.tsx` — 8 failures (all tests failing)
- `src/routes/dashboard/IssueDetailSheet.test.tsx` — 7 failures (optimistic update, linked issues, comments)
- `src/services/notifications.test.ts` — 4 failures (broadened Jira notifications)
- `src/services/jira.test.ts` — 2 failures (discoverCustomFields error handling)
- `src/routes/notifications/NotificationPopover.test.tsx` — 2 failures
- `src/routes/notifications/NotificationRow.test.tsx` — 1 failure
- `src/components/app/KeyboardShortcutsPanel.test.tsx` — 1 failure
- `src/components/app/RecentItemsPopover.test.tsx` — 1 failure

### Established Patterns
- Tests use `vi.stubGlobal` for Tauri runtime mocking (tauriService abstraction)
- React Testing Library for component tests
- Vitest as test runner
- Props threaded explicitly (no React context) — test mocks should follow this pattern

### Integration Points
- `vitest.config.ts` or `vite.config.ts` test section — may need setup file for LazyStore mock
- Test setup files — LazyStore mock registration

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 26-test-regression-fixes*
*Context gathered: 2026-03-19*
