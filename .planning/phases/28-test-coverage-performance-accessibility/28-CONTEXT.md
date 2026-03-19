# Phase 28: Test Coverage, Performance & Accessibility - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add comprehensive unit tests for all service and store modules, virtualize long lists for smooth scrolling at 200+ items, and fix accessibility gaps in forms and custom dropdowns. No new user-facing features. No refactoring beyond what's needed for virtualization integration.

</domain>

<decisions>
## Implementation Decisions

### Test Scope & Strategy
- Claude's discretion on old jira.test.ts handling (recommended: start fresh per module, archive or remove the monolith test)
- Coverage depth: happy path + at least one error case per module (matches success criteria exactly)
- All 12 Jira modules tested equally — no prioritization by size
- Store tests: state transitions + persistence rehydration round-trips using Phase 26 LazyStore mock
- 6 untested stores to cover: auth, breadcrumb, debug-log, filter, onboarding, pinned-tabs
- 12 untested Jira modules to cover: backlog, client, comments, epics, fields, issues, links, projects, sprints, transitions, versions, worklogs
- Existing test patterns: vi.stubGlobal for Tauri runtime, React Testing Library, Vitest

### Virtualization
- Library: **@tanstack/react-virtual** — locked decision (consistent with TanStack Query ecosystem)
- Lists to virtualize: notification list, backlog list, sprint board columns
- Sprint board virtualization approach: Claude's discretion (recommended: virtualize within columns independently, sticky parent story headers)
- Notification virtualization scope: Claude's discretion (full page vs popover vs both)
- PERF-02 memoization: Claude's discretion on approach (Zustand selector equality, useMemo, or cached derived state)

### Accessibility
- A11Y-01 scope: Claude's discretion (recommended: CreateEditIssueModal and ConnectionsSection per success criteria, extend if quick wins found)
- A11Y-02 custom dropdowns: Claude's discretion on identifying custom vs library-provided dropdowns and adding listbox/option roles
- A11y testing: Claude's discretion (recommended: verify via RTL assertions, add vitest-axe if justified)

### Sequencing & Priority
- All 6 requirements (TEST-01, TEST-02, PERF-01, PERF-02, A11Y-01, A11Y-02) are required — no deprioritization
- Sequencing: Claude's discretion (recommended: tests first → virtualization → a11y, since tests validate pre-change behavior)
- Plan structure: Claude's discretion on number and grouping of plans

### Claude's Discretion
- Old jira.test.ts migration strategy
- Test file organization (colocated vs centralized)
- Sprint board virtualization architecture
- Notification list virtualization scope (page only vs page + popover)
- PERF-02 memoization pattern
- A11y scope beyond the two specified components
- Automated a11y testing tooling
- Sequencing of tests → perf → a11y work
- Plan count and boundaries
- Commit structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — TEST-01 (service unit tests), TEST-02 (store unit tests), PERF-01 (virtualization), PERF-02 (memoized selectors), A11Y-01 (form aria labels), A11Y-02 (dropdown ARIA roles)

### Phase context
- `.planning/ROADMAP.md` — Phase 28 success criteria (5 conditions that must be TRUE)
- `.planning/phases/26-test-regression-fixes/26-CONTEXT.md` — LazyStore mock pattern, vi.stubGlobal conventions, test fix approach
- `.planning/phases/27-refactoring-type-safety/27-CONTEXT.md` — Jira module decomposition (12 modules in src/services/jira/), component extraction patterns

### Project conventions
- `.planning/PROJECT.md` — Tech stack (TanStack Query, Zustand, shadcn/ui, @dnd-kit, Tailwind v4), key decisions (prop threading, tauriService abstraction)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/test/setup.ts` — Global test setup with LazyStore in-memory mock (Phase 26)
- `src/services/jira.test.ts` — 489 passing tests across 42 files; old monolith tests may have reusable assertions
- `src/services/gitlab.test.ts`, `notifications.test.ts`, etc. — Established test patterns for service modules
- `src/stores/notifications.store.test.ts`, `settings.store.test.ts`, `recent-items.store.test.ts` — Store test patterns with persistence

### Established Patterns
- Services mock `tauriService.fetch` via `vi.stubGlobal` — all Jira/GitLab module tests follow this
- Stores use Zustand persist middleware + `createTauriStorage()` utility (Phase 27)
- React Testing Library for component rendering and assertions
- Props threaded explicitly (no React context) — component tests provide props directly

### Integration Points
- `src/services/jira/` — 12 modules needing test files alongside them
- `src/stores/` — 6 stores needing test files alongside them
- `src/routes/notifications/` — NotificationPopover.tsx (363 lines) and full-page notification list for virtualization
- `src/routes/dashboard/BacklogPage.tsx` (619 lines) — Backlog list for virtualization
- `src/routes/dashboard/SprintBoardTab.tsx` (591 lines) — Sprint board columns for virtualization
- `src/routes/dashboard/create-edit-issue/` — Form inputs needing aria-label audit
- `src/routes/settings/ConnectionsSection.tsx` — Form inputs needing aria-label audit
- `package.json` — @tanstack/react-virtual dependency to add

### Current Test State
- 489 tests passing, 42 test files, 1 skipped file, 4 todo tests
- Zero virtualization in codebase
- Minimal aria-labels: 4 found across CreateEditIssueModal and ConnectionsSection
- Biome a11y rules active at warn level (Phase 25)

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

*Phase: 28-test-coverage-performance-accessibility*
*Context gathered: 2026-03-20*
