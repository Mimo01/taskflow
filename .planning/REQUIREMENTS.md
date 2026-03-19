# Requirements: Taskflow

**Defined:** 2026-03-19
**Core Value:** Developers and PMs can see everything they need — tasks, merge requests, sprint state, and notifications — in one place, without switching between Jira and GitLab.

## v1.4 Requirements

Requirements for v1.4 Internal Quality & Performance. Each maps to roadmap phases.

### Testing

- [ ] **TEST-01**: All service modules (jira, gitlab, notifications) have unit tests covering happy path and error cases
- [ ] **TEST-02**: All Zustand stores have unit tests covering state transitions and persistence
- [ ] **TEST-03**: Fix 6 pre-existing Phase 8 test regressions
- [ ] **TEST-04**: Fix 8 LazyStore teardown warnings in test suite
- [ ] **TEST-05**: Fix 2 pre-existing TypeScript errors in test files

### Tooling

- [ ] **TOOL-01**: Biome configured for linting and formatting with CI-ready check script
- [ ] **TOOL-02**: All existing source files pass Biome lint and format checks

### Dependencies

- [ ] **DEPS-01**: All dependencies updated to latest compatible versions with no regressions

### Refactoring

- [ ] **REFAC-01**: jira.ts decomposed into focused domain modules (issues, sprints, fields, projects, epics, backlog)
- [ ] **REFAC-02**: CreateEditIssueModal decomposed into smaller composable components with useReducer for form state
- [ ] **REFAC-03**: IssueDetailSidebar decomposed into focused sub-components
- [ ] **REFAC-04**: Shared `createTauriStorage()` utility replaces duplicated LazyStore adapter across 4 stores
- [ ] **REFAC-05**: API error handling boilerplate extracted into shared utility (try/catch + status check pattern)
- [ ] **REFAC-06**: Notifications store split into persisted data store and transient UI state store
- [ ] **REFAC-07**: Route definitions extracted from main.tsx into dedicated routes config
- [ ] **REFAC-08**: Inline styles replaced with Tailwind classes (SprintBoardTab gradient)

### Type Safety

- [ ] **TYPE-01**: All `as unknown as X` double-casts replaced with proper typing
- [ ] **TYPE-02**: All `any` types in production code replaced with specific types

### Performance

- [ ] **PERF-01**: Notification list, backlog list, and sprint board use virtualization for 100+ items
- [ ] **PERF-02**: Unread count selectors memoized (no Set creation on every render)

### Accessibility

- [ ] **A11Y-01**: All form inputs in CreateEditIssueModal and ConnectionsSection have proper aria labels
- [ ] **A11Y-02**: Custom dropdowns use semantic HTML or proper ARIA roles

### Developer Tools

- [ ] **DEVT-01**: Unified Developer Tools page combining debug logs and API profiler in a cohesive layout
- [ ] **DEVT-02**: Operation-level profiling groups multiple fetches into logical operations with total time, fetch count, and per-fetch breakdown
- [ ] **DEVT-03**: Granular settings panel with independent toggles: request logging, response body capture, operation profiling, performance waterfall, retention limit
- [ ] **DEVT-04**: Developer Tools hidden from main Settings navigation — accessible only via Cmd+Shift+D or command palette
- [ ] **DEVT-05**: Performance waterfall visualization showing operation timeline with fetch durations

## Future Requirements

### Code Quality

- **QUAL-01**: Integration test suite with real API mocks (MSW)
- **QUAL-02**: Code coverage reporting with minimum thresholds
- **QUAL-03**: Pre-commit hooks for lint and format checks

## Out of Scope

| Feature | Reason |
|---------|--------|
| New user-facing features | v1.4 is internal quality only |
| E2E testing (Playwright/Cypress) | Tauri webview E2E requires custom setup; defer to v1.5+ |
| CI/CD pipeline | No CI infrastructure yet; defer |
| Performance benchmarking automation | Manual profiling via Developer Tools sufficient for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 28 | Pending |
| TEST-02 | Phase 28 | Pending |
| TEST-03 | Phase 26 | Pending |
| TEST-04 | Phase 26 | Pending |
| TEST-05 | Phase 26 | Pending |
| TOOL-01 | Phase 25 | Pending |
| TOOL-02 | Phase 25 | Pending |
| DEPS-01 | Phase 25 | Pending |
| REFAC-01 | Phase 27 | Pending |
| REFAC-02 | Phase 27 | Pending |
| REFAC-03 | Phase 27 | Pending |
| REFAC-04 | Phase 27 | Pending |
| REFAC-05 | Phase 27 | Pending |
| REFAC-06 | Phase 27 | Pending |
| REFAC-07 | Phase 27 | Pending |
| REFAC-08 | Phase 27 | Pending |
| TYPE-01 | Phase 27 | Pending |
| TYPE-02 | Phase 27 | Pending |
| PERF-01 | Phase 28 | Pending |
| PERF-02 | Phase 28 | Pending |
| A11Y-01 | Phase 28 | Pending |
| A11Y-02 | Phase 28 | Pending |
| DEVT-01 | Phase 29 | Pending |
| DEVT-02 | Phase 29 | Pending |
| DEVT-03 | Phase 29 | Pending |
| DEVT-04 | Phase 29 | Pending |
| DEVT-05 | Phase 29 | Pending |

**Coverage:**
- v1.4 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
