# Phase 27: Refactoring & Type Safety - Research

**Researched:** 2026-03-19
**Domain:** TypeScript refactoring, module decomposition, type safety
**Confidence:** HIGH

## Summary

Phase 27 is a pure refactoring phase: decompose three oversized modules (jira.ts at 2,018 lines, CreateEditIssueModal at 915 lines, IssueDetailSidebar at 725 lines), extract a shared LazyStore adapter used by 5 stores, fix 9 double-casts in production code, enable Biome strict type rules, extract route config from main.tsx, and address minor inline style cleanup. No new features, no new tests (those come in Phase 28).

The codebase is in solid shape: all 489 tests pass, Biome is configured and passing, and the `apiFetch` instrumentation layer already provides the shared fetch utility the jira modules need. The double-cast fixes are straightforward -- 3 in jira.ts are identical error-handling patterns, 2 in gitlab.ts are response type assertions, 2 in stores are migration function return types, and 1 in NotificationRow is a keyboard-to-mouse event coercion.

**Primary recommendation:** Execute in dependency order -- shared utilities first (LazyStore adapter, jira/ barrel), then component decomposition (CreateEditIssueModal, IssueDetailSidebar), then type fixes + Biome rules, then route extraction. Run the full test suite after each major refactoring step.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- jira.ts decomposition: `src/services/jira/` subdirectory with barrel `index.ts` re-exporting. Domain modules: `types.ts`, `client.ts`, `issues.ts`, `sprints.ts`, `epics.ts`, `fields.ts`, `comments.ts`, `backlog.ts`, `projects.ts`
- CreateEditIssueModal: hooks + sub-components in `routes/dashboard/create-edit-issue/` subdirectory. Extract `useCreateEditForm.ts` (useReducer + validation), `useIssueMutations.ts`. Sub-components: `IssueTypeSelector.tsx`, `CustomFieldsSection.tsx`, `LinkRowsSection.tsx`. Main becomes ~200-line orchestrator. Form state converted from 21 useStates to useReducer.
- IssueDetailSidebar: section sub-components in `routes/dashboard/issue-detail/`. Extract: `FieldsSection.tsx`, `DescriptionSection.tsx`, `SubtasksSection.tsx`, `LinkedIssuesSection.tsx`, `MergeRequestsSection.tsx`. Shared hooks in `useFieldMutation.ts`. Main becomes ~150-line layout orchestrator.
- LazyStore adapter: Extract `createTauriStorage()` factory to shared utility. Apply to all 5 stores (settings, auth, notifications, pinned-tabs, recent-items).
- TYPE-01 double-cast fixes: Replace all 9 `as unknown as X` with proper type guards. Fix first, then enable Biome rules.
- Biome rules: Enable noExplicitAny and double-cast rules after type fixes. Remove Phase 25 suppressions.
- TYPE-02: Scout found 0 `any` types in production -- verify and skip if confirmed.

### Claude's Discretion
- Barrel export vs explicit import path updates (jira/ modules)
- Fetch/error utility placement (Jira-specific vs shared)
- Auth function grouping in jira/
- Utility function placement for IssueDetailSidebar helpers
- Whether REFAC-06 needs work given existing partialize() pattern
- Route extraction approach for REFAC-07
- Additional Biome strict rules beyond the suppressed ones
- Commit structure

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REFAC-01 | jira.ts decomposed into focused domain modules | Verified: 2,018 lines, 40+ exports, clear domain boundaries. Barrel re-export preserves 48 non-test import sites. |
| REFAC-02 | CreateEditIssueModal decomposed with useReducer | Verified: 915 lines, 21 useState calls, 509 lines JSX. useReducer pattern well-suited. |
| REFAC-03 | IssueDetailSidebar decomposed into sub-components | Verified: 725 lines, clear section boundaries already visible in JSX. |
| REFAC-04 | Shared createTauriStorage() replaces duplicated LazyStore adapter | Verified: Identical 10-line adapter duplicated across 5 stores. Trivial extraction. |
| REFAC-05 | API error handling boilerplate extracted | Verified: 3 identical `as unknown as { status; text? }` patterns in jira.ts. apiFetch already handles auth errors; remaining boilerplate is the catch-block error inspection. |
| REFAC-06 | Notifications store split | Verified: Already uses partialize() to separate persisted from transient. Splitting may not be warranted -- assess during implementation. |
| REFAC-07 | Route definitions extracted from main.tsx | Verified: 15 routes in main.tsx (lines 485-507), simple flat array. Extraction to `src/routes/routes.tsx` is straightforward. |
| REFAC-08 | Inline styles replaced with Tailwind | Verified: Only 1 inline style in SprintBoardTab (line 92). Trivial. |
| TYPE-01 | All `as unknown as X` double-casts replaced | Verified: 9 in production code across 6 files. All fixable with type guards or proper typing. |
| TYPE-02 | All `any` types replaced | Verified: 0 occurrences of `: any` in production source. Requirement already satisfied. |
</phase_requirements>

## Standard Stack

No new libraries needed. This is purely a refactoring phase using existing project tools.

### Core (already in project)
| Library | Version | Purpose | Role in Phase |
|---------|---------|---------|---------------|
| TypeScript | 5.9 | Type system | Type guard functions, proper typing |
| Zustand | 5.x | State management | Store refactoring, createTauriStorage |
| React | 18.x | UI framework | Component decomposition, useReducer |
| Biome | 2.4.8 | Linting | Enable noExplicitAny, double-cast rules |
| Vitest | 4.1.0 | Testing | Regression verification after each step |

### No New Dependencies
This phase adds zero new packages. All work uses existing TypeScript features and project libraries.

## Architecture Patterns

### Pattern 1: Service Module Barrel Export

**What:** Decompose `jira.ts` into `src/services/jira/` with barrel `index.ts` re-exporting everything.
**Why barrel:** 48 non-test files import from `@/services/jira`. A barrel export at `index.ts` means zero import path changes across the codebase -- TypeScript resolves `@/services/jira` to `@/services/jira/index.ts` automatically.

**Recommended structure:**
```
src/services/jira/
  index.ts        # barrel -- re-exports everything from all modules
  types.ts        # JiraUser, JiraProject, JiraIssue, JiraFixVersion, JiraTransition,
                  # JiraComment, JiraActiveSprint, JiraIssueLink, JiraAttachment,
                  # JiraIssueDetail, JiraProjectStatus, CreatemetaField, IssueLinkType,
                  # BacklogViewData, EpicEnriched (15 interfaces/types)
  client.ts       # shared fetch helper, error handling utilities, constants (PAGE_SIZE, SUBTASK_CHUNK_SIZE)
                  # fetchAllSearchPages (internal helper used by issues, sprints, backlog, epics)
  projects.ts     # validateJira, listJiraProjects
  issues.ts       # fetchSprintIssues, fetchMyTasksHierarchy, fetchIssueDetail,
                  # fetchIssueSummary, updateIssueField, createIssue, bulkUpdateIssue,
                  # wrapCustomFieldValue, searchJira
  sprints.ts      # fetchActiveSprint, fetchSprintsForBoard, addIssuesToSprint
  fields.ts       # discoverCustomFields, fetchCreatemeta, fetchProjectStatuses
  comments.ts     # fetchComments, postComment, updateComment, deleteComment
  epics.ts        # fetchEpicsBasic, fetchEpicEnrichmentMap, fetchEpicsWithEnrichment, fetchEpicStories
  backlog.ts      # fetchBacklogIssues, fetchBacklogView
  links.ts        # fetchIssueLinkTypes, createIssueLink
  worklogs.ts     # fetchIssueWorklogs
  transitions.ts  # fetchTransitions, postTransition
  versions.ts     # fetchFixVersions
```

**Key decisions:**
- `client.ts` keeps `fetchAllSearchPages` because it is used by issues, sprints, backlog, and epics modules. It also houses error-handling helpers and the shared headers construction.
- `types.ts` consolidates all 15 exported interfaces. Domain modules import from `./types`.
- The barrel `index.ts` does `export * from './types'; export * from './issues';` etc. -- simple and complete.

### Pattern 2: Component Decomposition with Custom Hooks

**What:** Extract form state and mutations into custom hooks, extract repeated JSX sections into sub-components.
**When to use:** Component exceeds 200-300 lines with identifiable sub-sections.

**CreateEditIssueModal structure:**
```
src/routes/dashboard/create-edit-issue/
  index.ts                   # re-export CreateEditIssueModal + types
  CreateEditIssueModal.tsx   # ~200-line orchestrator
  useCreateEditForm.ts       # useReducer replacing 21 useStates + validation logic
  useIssueMutations.ts       # useMutation hooks for create + edit
  IssueTypeSelector.tsx      # issue type dropdown with icon
  CustomFieldsSection.tsx    # dynamic custom fields from createmeta
  LinkRowsSection.tsx        # issue link rows with add/remove
```

**IssueDetailSidebar structure:**
```
src/routes/dashboard/issue-detail/
  index.ts                   # re-export IssueDetailSidebar
  IssueDetailSidebar.tsx     # ~150-line layout orchestrator
  FieldsSection.tsx          # status/assignee/priority/sprint/epic fields
  DescriptionSection.tsx     # markdown description display
  SubtasksSection.tsx        # subtask list
  LinkedIssuesSection.tsx    # linked issues display
  MergeRequestsSection.tsx   # MR list display
  useFieldMutation.ts        # shared field update hook + useDebounce
  utils.ts                   # extractSprintName, statusDot, mrStateClasses
```

### Pattern 3: Shared Storage Factory

**What:** Extract duplicated LazyStore adapter into `createTauriStorage()`.

The identical 10-line adapter appears in all 5 stores:
```typescript
// src/lib/tauri-storage.ts
import { LazyStore } from '@tauri-apps/plugin-store';
import { createJSONStorage } from 'zustand/middleware';

export function createTauriStorage(filename: string) {
  const store = new LazyStore(filename);
  return createJSONStorage(() => ({
    getItem: async (name: string): Promise<string | null> => {
      const value = await store.get<string>(name);
      return value ?? null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
      await store.set(name, value);
      await store.save();
    },
    removeItem: async (name: string): Promise<void> => {
      await store.delete(name);
      await store.save();
    },
  }));
}
```

Each store then becomes: `const tauriStorage = createTauriStorage('settings.json');`

### Pattern 4: useReducer for Complex Form State

**What:** Replace 21 useState calls with a single useReducer.
**Why:** The CreateEditIssueModal has interdependent state (e.g., issue type changes reset certain fields, edit mode pre-fills from initialValues). useReducer centralizes this logic.

```typescript
// useCreateEditForm.ts
interface FormState {
  selectedIssueType: IssueType;
  summary: string;
  description: string;
  assigneeInputValue: string;
  selectedAssigneeName: string | null;
  timeEstimate: string;
  priority: string | null;
  storyPoints: string;
  epicLinkKey: string | null;
  epicOpen: boolean;
  epicFilter: string;
  parentKey: string | null;
  customFieldValues: Record<string, string>;
  customFieldInputValues: Record<string, string>;
  customFieldAutoResults: Record<string, unknown[]>;
  customFieldShowResults: Record<string, boolean>;
  showAssigneeResults: boolean;
  apiError: string | null;
  linkRows: IssueLinkRowValue[];
}

type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormState; value: FormState[keyof FormState] }
  | { type: 'RESET'; initialValues?: EditInitialValues }
  | { type: 'SET_ISSUE_TYPE'; issueType: IssueType }
  // ... other specific actions
```

### Anti-Patterns to Avoid
- **Moving test files during refactoring:** jira.test.ts should stay at `src/services/jira.test.ts` (or move to `src/services/jira/__tests__/`) but the existing test must keep working. Do NOT break test imports.
- **Circular dependencies:** `client.ts` must not import from domain modules. Domain modules import from `client.ts` and `types.ts` only. The barrel `index.ts` imports from all modules but is never imported internally.
- **Changing API behavior:** Every exported function must have identical signatures and behavior. This is a structure-only refactor.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Storage adapter | Copy-paste LazyStore code | `createTauriStorage()` factory | 5 identical copies already exist; DRY |
| Error type narrowing | `as unknown as` casts | Type guard functions | Type-safe, Biome-compliant |
| Form state management | 21 individual useState | useReducer + typed actions | Centralized, testable, predictable |
| Module barrel exports | Manual import rewiring | TypeScript index.ts resolution | Zero-change migration path |

## Common Pitfalls

### Pitfall 1: Breaking Test Imports After jira.ts Move
**What goes wrong:** Moving `jira.ts` to `jira/` breaks `jira.test.ts` imports.
**Why it happens:** Test file imports `./jira` which no longer resolves to a file.
**How to avoid:** Either move the test file too, or ensure barrel `index.ts` is in place before any imports change. Run `npx vitest --run` after the move.
**Warning signs:** TypeScript errors on `from './jira'` or `from '@/services/jira'`.

### Pitfall 2: Circular Dependencies in jira/ Modules
**What goes wrong:** Module A imports from Module B which imports from Module A.
**Why it happens:** Functions that call each other across domain boundaries (e.g., issues.ts calling fetchAllSearchPages from client.ts is fine, but if client.ts imported from issues.ts that would be circular).
**How to avoid:** Strict dependency direction: types.ts < client.ts < domain modules. Domain modules never import from each other.
**Warning signs:** Runtime errors about undefined imports, or TypeScript circular reference warnings.

### Pitfall 3: useReducer Losing Reset-on-Open Behavior
**What goes wrong:** CreateEditIssueModal stops resetting fields when reopened.
**Why it happens:** The current component uses a `useEffect` keyed on open/initialValues to reset all 21 states. The useReducer must support a `RESET` action dispatched by the same effect.
**How to avoid:** Implement `RESET` action that accepts optional initialValues and sets all fields to defaults or initial values.
**Warning signs:** Modal opens with stale data from previous edit session.

### Pitfall 4: Barrel Export Breaking Tree Shaking
**What goes wrong:** Importing one function pulls in the entire jira module.
**Why it happens:** `export *` from barrel can prevent bundler tree-shaking if modules have side effects.
**How to avoid:** jira modules are pure functions with no side effects at module level. Vite handles `export *` correctly for pure modules. No action needed, but verify bundle doesn't grow.
**Warning signs:** Noticeable increase in bundle size (unlikely given these are all async functions).

### Pitfall 5: Notifications Store Partialize Already Handles REFAC-06
**What goes wrong:** Splitting the store introduces regressions in hydration/merge logic.
**Why it happens:** The notifications store already has a sophisticated `partialize` + `merge` function that handles migration from old format. Splitting into two stores would require duplicating or reimplementing this logic.
**How to avoid:** Assess whether splitting adds value beyond what partialize already provides. If the store is cleanly organized with partialize, document it as "requirement satisfied by existing pattern" rather than forcing a split.
**Warning signs:** Broken notification persistence after restart, lost read state.

## Code Examples

### Double-Cast Fix: jira.ts Error Handling (3 identical patterns)

**Current (lines 334, 448, 1492):**
```typescript
const errObj = err as unknown as { status: number; text?: () => Promise<string> };
```

**Fixed -- type guard in client.ts:**
```typescript
// src/services/jira/client.ts
interface ResponseLikeError {
  status: number;
  text?: () => Promise<string>;
}

function isResponseLikeError(err: unknown): err is ResponseLikeError {
  return (
    err !== null &&
    typeof err === 'object' &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number'
  );
}

// Usage in catch blocks:
if (isResponseLikeError(err)) {
  const status = err.status; // no cast needed
  const body = typeof err.text === 'function' ? await err.text() : '';
  // ...
}
```

This also consolidates the duck-typing check that already exists at line 328-332 but is followed by a double-cast.

### Double-Cast Fix: gitlab.ts Response Typing (lines 754, 803)

**Current:**
```typescript
return data as unknown as GitLabMR[];
```

**Fix:** The `data` variable comes from `await response.json()`. Type the json() result:
```typescript
const data: GitLabMR[] = await response.json();
// Process labels...
return data;
```

Or if the response JSON shape doesn't exactly match GitLabMR[], use a proper intermediate type that reflects what the API actually returns, then map to GitLabMR[].

### Double-Cast Fix: Store Migration Returns (pinned-tabs, recent-items)

**Current:**
```typescript
migrate: (persisted, _version) => persisted as unknown as PinnedTabsState,
```

**Fix:** Type the `persisted` parameter properly:
```typescript
migrate: (persisted: Record<string, unknown>, _version: number) => {
  return persisted as PinnedTabsState;
},
```

The Zustand persist `migrate` function receives `unknown` as the persisted state type. A single `as PinnedTabsState` assertion is valid because migration IS the point where you assert the shape. The `unknown` intermediate is unnecessary.

### Double-Cast Fix: settings.store.ts Migration (line 252)

**Current:**
```typescript
return s as unknown as SettingsState;
```

**Fix:** Same as above -- the migration function builds up the state object `s` through version checks. After all migrations, a single assertion is sufficient:
```typescript
return s as SettingsState;
```

### Double-Cast Fix: NotificationRow Event Coercion (line 161)

**Current:**
```typescript
onClick(e as unknown as React.MouseEvent);
```

**Fix:** Change the `onClick` prop type to accept `React.MouseEvent | React.KeyboardEvent`:
```typescript
// In the component props or at the call site:
onClick: (e: React.MouseEvent | React.KeyboardEvent) => void;
```

Or use a more targeted approach -- the onClick handler likely only uses `e.stopPropagation()` or similar, so a union type is appropriate.

### Route Extraction (REFAC-07)

```typescript
// src/routes/routes.tsx
import type { RouteObject } from 'react-router-dom';
// ... lazy imports or direct imports

export const routes: RouteObject[] = [
  { path: '/', element: <Onboarding /> },
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/settings', element: <Settings /> },
  { path: '/my-tasks', element: <MyTasksTab /> },
  // ... all 15 routes
];

// main.tsx becomes:
import { routes } from './routes/routes';
const router = createHashRouter([
  {
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: routes,
  },
]);
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Monolithic service file | Domain-split modules with barrel | Maintainability, code navigation |
| Multiple useState | useReducer for complex forms | Predictable state transitions |
| Copy-pasted storage adapter | Shared factory function | DRY, single point of change |
| `as unknown as X` casts | Type guards + proper typing | Biome-enforceable type safety |

## Discretion Recommendations

### Barrel Export Strategy
**Recommendation: Re-export everything via barrel.** The 48 import sites all use `@/services/jira` or `../services/jira`. TypeScript resolves `@/services/jira` to `@/services/jira/index.ts` automatically. Zero import changes needed.

### Fetch/Error Utility Placement
**Recommendation: Keep in `src/services/jira/client.ts`.** The `apiFetch` wrapper already lives in `src/lib/apiFetch.ts` and handles fetch + logging + timeout for both Jira and GitLab. The jira-specific error handling (fetchAllSearchPages, the ResponseLikeError guard) is Jira-domain-specific and belongs in `jira/client.ts`.

### Auth/Validation Function Placement
**Recommendation: `projects.ts` for validateJira + listJiraProjects.** These are project/connection-level operations, not auth-specific. A separate `auth.ts` would be a single-function file (validateJira), which is not justified.

### REFAC-06 Assessment
**Recommendation: Mark as satisfied.** The notifications store already uses `partialize()` to separate persisted data (items, readIds, cursors) from transient UI state (permissionDenied, fetchError, retryFetch). The merge function handles migration. Splitting into two separate stores would require duplicating the Zustand + persist setup and the migration logic, with no clear benefit. Document this decision.

### Route Extraction Approach
**Recommendation: Extract route array to `src/routes/routes.tsx`.** Keep component imports in that file. main.tsx imports the array and wraps it in AppLayout. Simple, testable, no lazy loading complexity needed for 15 routes.

### Additional Biome Rules
**Recommendation: Enable `noExplicitAny` as "error" for production code (already "off" in test overrides -- keep tests permissive).** Do not enable `noNonNullAssertion` -- it would flag legitimate patterns like `document.getElementById('root')!` and many TanStack Query `data!` accesses. The noise-to-value ratio is poor.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest --run` |
| Full suite command | `cd taskflow && npx vitest --run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REFAC-01 | jira.ts decomposition preserves API behavior | regression | `cd taskflow && npx vitest --run src/services/jira.test.ts` | Yes |
| REFAC-02 | CreateEditIssueModal still renders/functions | regression | `cd taskflow && npx vitest --run` (full suite) | No dedicated test |
| REFAC-03 | IssueDetailSidebar still renders/functions | regression | `cd taskflow && npx vitest --run` (full suite) | No dedicated test |
| REFAC-04 | Store persistence still works | regression | `cd taskflow && npx vitest --run src/stores/` | Yes (3 store tests) |
| REFAC-05 | Error handling preserved | regression | `cd taskflow && npx vitest --run src/services/jira.test.ts` | Yes |
| REFAC-06 | Notification store unchanged | regression | `cd taskflow && npx vitest --run src/stores/notifications.store.test.ts` | Yes |
| REFAC-07 | Routes still work | manual | App navigation | No test |
| REFAC-08 | Visual appearance unchanged | manual | Visual inspection | No test |
| TYPE-01 | No double-casts remain | static | `cd taskflow && grep -r "as unknown as" src/ --include="*.ts" --include="*.tsx" \| grep -v test \| grep -v node_modules` | N/A (static check) |
| TYPE-02 | No `any` types remain | static | `cd taskflow && npx biome check src/` | N/A (Biome enforced) |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest --run` (full suite, ~11s)
- **Per wave merge:** Same (no separate waves -- single main branch)
- **Phase gate:** Full suite green + `npx biome check src/` clean + zero `as unknown as` in non-test production code

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. No new test files needed (Phase 28 handles that). The 489 passing tests serve as regression baseline.

## Open Questions

1. **jira.test.ts location after decomposition**
   - What we know: The test file imports from `./jira` and tests many functions across all domain modules.
   - What's unclear: Whether to keep as single file or split into per-module tests.
   - Recommendation: Keep as single `jira.test.ts` file for now (Phase 28 will add comprehensive tests). If it must move, place at `src/services/jira/__tests__/jira.test.ts` and update its imports.

2. **fetchAllSearchPages visibility**
   - What we know: It is currently a private (non-exported) function used by multiple exported functions.
   - What's unclear: Whether domain modules (issues, sprints, backlog, epics) can import non-exported helpers from client.ts.
   - Recommendation: Export it from `client.ts` but do NOT re-export from barrel `index.ts`. Internal modules import directly from `./client`.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all target files (jira.ts, CreateEditIssueModal.tsx, IssueDetailSidebar.tsx, 5 store files, biome.json, main.tsx, gitlab.ts, NotificationRow.tsx)
- Vitest run confirming 489 tests pass as baseline
- Biome config inspection confirming noExplicitAny is currently "off"

### Secondary (MEDIUM confidence)
- TypeScript barrel export resolution behavior (well-documented, standard behavior)
- Zustand persist middleware migrate function typing (verified via store source code)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing tools
- Architecture: HIGH -- patterns verified against actual codebase structure and import graph
- Pitfalls: HIGH -- derived from actual code inspection, not hypothetical
- Double-cast fixes: HIGH -- all 9 locations inspected, fix strategies verified against TypeScript semantics

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- no external dependencies changing)
