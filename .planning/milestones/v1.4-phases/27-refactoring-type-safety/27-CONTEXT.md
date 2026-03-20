# Phase 27: Refactoring & Type Safety - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Decompose large modules into focused units and eliminate unsafe type patterns. jira.ts (2,018 lines) splits into domain modules; CreateEditIssueModal (915 lines) and IssueDetailSidebar (725 lines) split into sub-components under 200 lines each; duplicated LazyStore adapter extracted to shared utility; 9 double-casts replaced with proper type guards; Biome strict type rules enabled. No new user-facing features. No new tests (Phase 28).

</domain>

<decisions>
## Implementation Decisions

### jira.ts Decomposition
- Subdirectory organization: `src/services/jira/` with barrel `index.ts` re-exporting everything
- Domain modules: `types.ts`, `client.ts` (shared fetch helper), `issues.ts`, `sprints.ts`, `epics.ts`, `fields.ts` (custom fields + createmeta), `comments.ts`, `backlog.ts`, `projects.ts`
- Claude's discretion on barrel export strategy (re-export everything vs update import paths across codebase)
- Claude's discretion on shared fetch/error utility placement (jira/client.ts vs top-level api-client.ts — based on how similar Jira and GitLab patterns actually are)
- Claude's discretion on validation/auth function placement (projects.ts vs separate auth.ts)

### CreateEditIssueModal Decomposition
- Hooks + sub-components approach in `routes/dashboard/create-edit-issue/` subdirectory
- Extract: `useCreateEditForm.ts` (useReducer + validation), `useIssueMutations.ts` (create + edit mutations)
- Extract sub-components: `IssueTypeSelector.tsx`, `CustomFieldsSection.tsx`, `LinkRowsSection.tsx`
- Main `CreateEditIssueModal.tsx` becomes ~200-line orchestrator
- Form state converted from 11 useStates to useReducer (per REFAC-02)

### IssueDetailSidebar Decomposition
- Section sub-components in `routes/dashboard/issue-detail/` subdirectory
- Extract: `FieldsSection.tsx` (status/assignee/priority/sprint/epic), `DescriptionSection.tsx`, `SubtasksSection.tsx`, `LinkedIssuesSection.tsx`, `MergeRequestsSection.tsx`
- Shared hooks (`useFieldMutation`, `useDebounce`) in `useFieldMutation.ts`
- Main `IssueDetailSidebar.tsx` becomes ~150-line layout orchestrator
- Claude's discretion on utility function placement (extractSprintName, statusDot, mrStateClasses) — issue-detail/utils.ts vs shared lib based on actual cross-component usage

### LazyStore Adapter
- Extract `createTauriStorage()` factory to shared utility
- Apply to all 5 stores (settings, auth, notifications, pinned-tabs, recent-items) — requirements said 4 but scout found 5

### Double-Cast Fixes (TYPE-01)
- Replace all 9 `as unknown as X` double-casts with proper type guards (type guard functions, instanceof, discriminated unions)
- Fix first, then enable Biome rules — clean sequential approach
- Locations: settings.store.ts (1), recent-items.store.ts (1), pinned-tabs.store.ts (1), NotificationRow.tsx (1), jira.ts (3), gitlab.ts (2)

### Biome Rule Enablement
- Enable noExplicitAny and double-cast rules after all type fixes are complete
- Remove Phase 25 suppressions so future violations are caught
- Claude's discretion on enabling additional strict rules (noNonNullAssertion, etc.) — based on real bug potential vs noise

### Scope Adjustments
- TYPE-02 (`any` types): Scout found 0 occurrences — Claude verifies and skips if confirmed
- REFAC-06 (notifications store split): Already uses partialize() cleanly — Claude assesses if splitting is still warranted
- REFAC-07 (route extraction): Claude decides best extraction approach for 15 routes from main.tsx
- REFAC-08 (inline styles): Only 1 gradient in SprintBoardTab — low priority, include if trivial

### Claude's Discretion
- Barrel export vs explicit import path updates (jira/ modules)
- Fetch/error utility placement (Jira-specific vs shared)
- Auth function grouping in jira/
- Utility function placement for IssueDetailSidebar helpers
- Whether REFAC-06 needs work given existing partialize() pattern
- Route extraction approach for REFAC-07
- Additional Biome strict rules beyond the suppressed ones
- Commit structure (per-requirement, per-file-group, or grouped by theme)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — REFAC-01 through REFAC-08, TYPE-01, TYPE-02 (10 requirements total)

### Phase context
- `.planning/ROADMAP.md` — Phase 27 success criteria (5 conditions that must be TRUE)
- `.planning/phases/25-tooling-dependencies/25-CONTEXT.md` — Biome config decisions, suppressed rules (noExplicitAny, double-casts) to be enabled in this phase
- `.planning/phases/26-test-regression-fixes/26-CONTEXT.md` — Test fix patterns, LazyStore mock setup

### Project conventions
- `.planning/PROJECT.md` — Key decisions table (prop threading not context, tauriService abstraction, LazyStore persistence patterns)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/jira.ts` (2,018 lines) — monolithic, covers issues/sprints/epics/fields/comments/backlog/projects/transitions/worklogs/attachments
- `src/routes/dashboard/CreateEditIssueModal.tsx` (915 lines) — form state (11 useStates), mutations, queries, 509 lines JSX
- `src/routes/dashboard/IssueDetailSidebar.tsx` (725 lines) — already has extracted utility functions, main component is 529 lines
- 5 stores with duplicated LazyStore adapter: settings.store.ts, auth.store.ts, notifications.store.ts, pinned-tabs.store.ts, recent-items.store.ts

### Established Patterns
- Prop threading (no React context) — maintain during component extraction
- TanStack Query for data fetching — queries stay in components or custom hooks
- Zustand stores with persist middleware + LazyStore — adapter pattern to be unified
- Barrel exports not currently used in services/ — jira/ will introduce this pattern
- No existing subdirectory organization in routes/dashboard/ — new pattern for extracted components

### Integration Points
- All files importing from `@/services/jira` — barrel export preserves or updates these
- CreateEditIssueModal imported in routes/dashboard/index.tsx and potentially other locations
- IssueDetailSidebar imported from IssueDetailPage and potentially sheet components
- biome.json — rule suppressions to be removed after type fixes
- main.tsx — route config extraction point (REFAC-07)

### Type Safety State
- 0 `any` types in production code (TYPE-02 likely already met)
- 9 `as unknown as X` double-casts across 6 files (TYPE-01 — all fixable)
- Notifications store already cleanly separated with partialize() (REFAC-06 may be satisfied)

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

*Phase: 27-refactoring-type-safety*
*Context gathered: 2026-03-19*
