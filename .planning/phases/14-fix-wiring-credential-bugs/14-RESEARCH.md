# Phase 14: Fix v1.2 Wiring and Credential Bugs - Research

**Researched:** 2026-03-15
**Domain:** React component wiring, TanStack Query cache invalidation, Zustand store patterns
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOARD-04 | User can create a new story or subtask directly from the sprint board without leaving the board view | BoardColumn + QuickCreateInput are fully implemented and tested; fix is importing them into SprintBoardTab.tsx and wiring createIssue/onCreated callback |
| BACK-03 | User can create a new story directly from the backlog view | Story creation already succeeds; fix is a one-line query key correction in main.tsx handleCreateModalClose |
| EPIC-04 | User can create a new epic from within the app | CreateEpicDialog form is correct; fix is replacing useSettingsStore() with useAuthStore() + readSecret for the three credential fields |
</phase_requirements>

---

## Summary

Phase 14 closes three surgical bugs uncovered by the v1.2 milestone audit. Every bug is an integration wiring failure — the underlying feature logic is already correct and tested. No new components, no new API calls, and no new UI patterns are introduced.

**Gap 1 (BOARD-04):** `BoardColumn.tsx` and `QuickCreateInput.tsx` were built and tested during Phase 10 but never imported into `SprintBoardTab.tsx`. The sprint board renders its own internal `DroppableCell` function and uses `CATEGORY_COLUMNS` (To Do / In Progress / Done) for the column layout, while `BoardColumn` uses individual `JiraProjectStatus` objects as column data. These two layout models differ — wiring requires choosing which column-per-status model to use. The simplest correct fix is to keep the existing `DroppableCell` / `CATEGORY_COLUMNS` layout (which is fully tested and works) and add a `QuickCreateInput` at the bottom of each column's `DroppableCell`. `BoardColumn` itself need not replace `DroppableCell` — it was built as an alternative column design. What matters for BOARD-04 is that a `QuickCreateInput` is rendered inside each column. The `QuickCreateInput` needs `statusId`, `statusName`, `projectKey`, `jiraBaseUrl`, `jiraToken`, and `onCreated`. All of these are already available in `SprintBoardTab` scope.

**Gap 2 (BACK-03):** `main.tsx` line 130 invalidates `['jira-backlog']` but `BacklogPage` uses query key `['jira-backlog-view', activeJiraProject, jiraBaseUrl]`. TanStack Query's `invalidateQueries` matches by prefix — changing the invalidation key to `['jira-backlog-view']` will correctly invalidate all queries whose key starts with that prefix regardless of the trailing segments.

**Gap 3 (EPIC-04):** `CreateEpicDialog.tsx` casts `useSettingsStore()` as if it holds `jiraBaseUrl`, `activeJiraProject`, and `jiraToken`. These fields do not exist in `SettingsState`. They live in `useAuthStore` (jiraBaseUrl, activeJiraProject) and in Stronghold (jiraToken, retrieved via `readSecret('jira-pat')`). The fix replaces the settings store cast with proper sources. A critical constraint: the existing test file mocks `useSettingsStore` to provide all four fields and passes `jiraToken: 'tok'` directly from the mock — the test does NOT mock `useAuthStore` or `readSecret`. This means the production fix must be implemented in a way that is compatible with the test mock OR the test mock must be updated to match the correct pattern.

**Primary recommendation:** Three targeted edits to three files. No new components. No new tests required unless existing tests need mock updates.

---

## Standard Stack

### Core (already installed — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | v5 | Cache invalidation via `invalidateQueries` | Already in use throughout |
| zustand | ^4 | State store — useAuthStore provides credentials | Already in use |
| @/services/stronghold | local | `readSecret('jira-pat')` for Jira token | Established pattern in SprintBoardTab, EpicDetailSheet |

### No Installation Required
All dependencies are already present. This phase makes zero new npm installs.

---

## Architecture Patterns

### Pattern 1: TanStack Query Prefix Invalidation
**What:** `invalidateQueries({ queryKey: ['prefix'] })` invalidates ALL cached queries whose key starts with that prefix.
**When to use:** When you want to invalidate a family of related queries without knowing the full key.
**Example:**
```typescript
// BacklogPage uses: ['jira-backlog-view', activeJiraProject, jiraBaseUrl]
// Correct invalidation (prefix match):
queryClient.invalidateQueries({ queryKey: ['jira-backlog-view'] })
// Wrong (was in code — no match):
queryClient.invalidateQueries({ queryKey: ['jira-backlog'] })
```
**Confidence:** HIGH — confirmed by TanStack Query v5 docs (partial key matching is the default behavior).

### Pattern 2: readSecret for Jira Token in React Components
**What:** Components that need the Jira PAT call `readSecret('jira-pat')` inside a `useEffect` or async handler, NOT by reading from a Zustand store (the stores never hold token strings).
**When to use:** Any component that calls Jira API directly and needs the PAT.
**Example from SprintBoardTab:**
```typescript
// SprintBoardTab.tsx — established pattern
const [jiraToken, setJiraToken] = useState<string | null>(null)
useEffect(() => {
  if (jiraBaseUrl) {
    readSecret('jira-pat')
      .then(t => setJiraToken(t))
      .catch(() => setJiraToken(null))
  }
}, [jiraBaseUrl])
```
**Confidence:** HIGH — verified in SprintBoardTab.tsx and EpicDetailSheet.tsx source.

### Pattern 3: Credentials from useAuthStore (not useSettingsStore)
**What:** `jiraBaseUrl` and `activeJiraProject` live in `useAuthStore`. `useSettingsStore` holds only custom field keys, UI settings, and theme.
**SettingsState fields:** `storyPointsFieldKey`, `epicLinkFieldKey`, `epicNameFieldKey`, `sprintFieldKey`, `accountFieldKey`, `role`, `theme`, `onboardingComplete`, and notification settings.
**AuthState fields:** `jiraBaseUrl`, `activeJiraProject`, `jiraConnected`, `jiraBaseUrl`, `gitlabBaseUrl`.
**Confidence:** HIGH — verified directly in `auth.store.ts` and `settings.store.ts` source.

### Pattern 4: QuickCreateInput Props
**What:** `QuickCreateInput` requires explicit props — it does NOT read from any store. The caller is responsible for passing credentials.
**Interface (from source):**
```typescript
interface QuickCreateInputProps {
  statusId: string
  statusName: string
  projectKey: string
  jiraBaseUrl: string
  jiraToken: string
  onCreated: () => void
}
```
**Confidence:** HIGH — verified in `QuickCreateInput.tsx` source.

### Pattern 5: CATEGORY_COLUMNS Layout in SprintBoardTab
**What:** SprintBoardTab uses three fixed category columns (`new` / `indeterminate` / `done`). The `DroppableCell` component is an internal function component. `BoardColumn` is a separate, differently-structured alternative that uses per-status objects.
**Impact on BOARD-04:** The simplest wiring is to place `QuickCreateInput` as a child inside each `DroppableCell` render, using the `col.label` and `col.key` for `statusName` and `statusId`. The `jiraToken` state and `activeJiraProject` / `jiraBaseUrl` are already in scope. `onCreated` should call `refetch()` or `queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] })`.
**Confidence:** HIGH — verified in SprintBoardTab.tsx source.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache prefix invalidation | Custom key matching | TanStack Query `invalidateQueries` with prefix | Already built-in to TQ v5 |
| Secure token reading | Store token in Zustand | `readSecret('jira-pat')` | Established stronghold pattern; never store PATs in state |
| Epic dialog credentials | Type-cast wrong store | `useAuthStore()` + `readSecret` | Auth store is the source of truth for connection info |

---

## Common Pitfalls

### Pitfall 1: CreateEpicDialog Test Mock Constraint
**What goes wrong:** The existing `CreateEpicDialog.test.tsx` mocks `useSettingsStore` to provide `jiraBaseUrl`, `activeJiraProject`, and `jiraToken`. If the production code is changed to read from `useAuthStore` and `readSecret`, the test will break because those are not mocked.
**Why it happens:** The test was written to match the (incorrect) implementation — it bakes in the wrong-store pattern.
**How to avoid:** When fixing the production code, also update the test mock to mock `useAuthStore` (for `jiraBaseUrl` and `activeJiraProject`) and `@/services/stronghold` (for `readSecret` returning `'tok'`). The `useSettingsStore` mock can then revert to only providing `epicNameFieldKey`.
**Warning signs:** Test fails with "Not configured" error after production fix — means credentials are still coming from the wrong source OR mock wasn't updated.

### Pitfall 2: QuickCreateInput Missing jiraToken Guard
**What goes wrong:** `SprintBoardTab` reads `jiraToken` from a `useState` that starts as `null` (populated asynchronously via `readSecret`). If `QuickCreateInput` is rendered before `jiraToken` is set, passing `null` as `jiraToken` will cause a runtime error in `createIssue`.
**Why it happens:** `readSecret` is async and the query `enabled` guard only gates the main `fetchSprintIssues` query, not the rendered JSX.
**How to avoid:** Render `QuickCreateInput` only when `jiraToken` is non-null (already guarded by `data &&` condition around swimlanes, since queries are disabled without a token).
**Warning signs:** `QuickCreateInput` visible but shows error on submit even with valid summary text.

### Pitfall 3: Wrong Cache Key Invalidation Still in Place
**What goes wrong:** If the key in `main.tsx` handleCreateModalClose is changed from `['jira-backlog']` to `['jira-backlog-view']` but other callers also need invalidation updates, the fix is incomplete.
**Why it happens:** There is only one invalidation call for the backlog (line 130 of main.tsx). No other site calls invalidate backlog queries. This is a single-site fix.
**How to avoid:** Verify after fix that `invalidateQueries({ queryKey: ['jira-backlog-view'] })` is the only invalidation needed and that no other callers use the old `['jira-backlog']` key.
**Warning signs:** Backlog still doesn't refresh — check query key in BacklogPage useQuery call.

### Pitfall 4: Epic Dialog Uses useMutation (async) — Token Race
**What goes wrong:** If `readSecret` is called inside the `mutationFn` (async, at submit time), there is no race condition — the token is fetched fresh at mutation time. But if it is loaded via `useEffect` into state (like SprintBoardTab pattern), there is a brief window where token is null.
**Why it happens:** `useMutation` is async by design — calling `readSecret` inside `mutationFn` is safe and eliminates the async state management.
**How to avoid:** For `CreateEpicDialog`, the cleanest fix is to call `readSecret('jira-pat')` inside the `mutationFn` directly (no `useEffect` needed) since the form only uses the token at submit time.
**Warning signs:** "Not configured" error thrown at submit — check if `readSecret` was inadvertently called outside the async context.

---

## Code Examples

### Fix 1: main.tsx cache invalidation key (BACK-03)
```typescript
// Line 130 in handleCreateModalClose — change FROM:
queryClient.invalidateQueries({ queryKey: ['jira-backlog'] })
// TO:
queryClient.invalidateQueries({ queryKey: ['jira-backlog-view'] })
```
**Source:** Verified against BacklogPage.tsx query key and main.tsx source.

### Fix 2: CreateEpicDialog credential sources (EPIC-04)
```typescript
// Replace useSettingsStore cast with correct sources:
import { useAuthStore } from '@/stores/auth.store'
import { readSecret } from '@/services/stronghold'

// Inside component:
const { epicNameFieldKey } = useSettingsStore()
const { jiraBaseUrl, activeJiraProject } = useAuthStore()

// Inside mutationFn (async):
const jiraToken = await readSecret('jira-pat').catch(() => null)
if (!jiraBaseUrl || !jiraToken || !activeJiraProject || !epicNameFieldKey) {
  throw new Error('Not configured')
}
```
**Source:** Pattern verified from `SprintBoardTab.tsx` and `auth.store.ts`.

### Fix 3: QuickCreateInput wiring in SprintBoardTab (BOARD-04)
```typescript
// Add import at top of SprintBoardTab.tsx:
import QuickCreateInput from './QuickCreateInput'

// Inside the DroppableCell for each column (after the cards mapping),
// or as a child of the existing flex column container:
{jiraToken && activeJiraProject && (
  <QuickCreateInput
    statusId={col.key}
    statusName={col.label}
    projectKey={activeJiraProject}
    jiraBaseUrl={jiraBaseUrl!}
    jiraToken={jiraToken}
    onCreated={() => {
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] })
    }}
  />
)}
```
**Note:** `statusId` for `QuickCreateInput` is used to find a transition target. The CATEGORY_COLUMNS keys are `'new'`, `'indeterminate'`, `'done'` — not real Jira status IDs. `QuickCreateInput.handleSubmit` uses `transitions.find(tr => tr.to.id === statusId)` — if no transition matches, the issue is created in default status and the board re-fetch shows it in the right column. This is documented in the QuickCreateInput JSDoc: "If postTransition has no valid transition, the issue lands in its default status; the board re-fetch will show it in the correct column." So using category keys as `statusId` is acceptable — no transition fires for the initial column but the board refreshes correctly.
**Source:** Verified from `QuickCreateInput.tsx` source and JSDoc comment.

### Fix 4: Updated CreateEpicDialog test mock (EPIC-04 test update)
```typescript
// Replace current useSettingsStore mock with split mocks:
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    epicNameFieldKey: 'customfield_10015',
  }),
}))
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
  }),
}))
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('tok'),
}))
```
**Source:** Pattern from other test files in the codebase (SprintBoardTab.test.tsx, EpicDetailSheet tests).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useSettingsStore` type-cast for credentials | `useAuthStore` for URL/project, `readSecret` for PAT | Phase 9/10 established pattern | EPIC-04 fix must follow this pattern |
| `['jira-backlog']` query key | `['jira-backlog-view', project, baseUrl]` | Phase 12 | BACK-03 fix targets the correct key |

---

## Open Questions

1. **Should BoardColumn replace DroppableCell or coexist?**
   - What we know: BoardColumn uses per-status objects; SprintBoardTab uses CATEGORY_COLUMNS (3 fixed categories). They are architecturally different layouts.
   - What's unclear: Whether the roadmap plan 14-01 intends a full layout replacement or just QuickCreateInput wiring.
   - Recommendation: The audit evidence says "replace the internal DroppableCell logic with the fully-built component." However, BoardColumn uses `JiraProjectStatus` objects while SprintBoardTab uses category keys. The planner should clarify scope. The minimal fix (QuickCreateInput inside existing layout) is safe and satisfies BOARD-04. A full BoardColumn replacement is higher risk.

2. **Does CreateEpicDialog test need to be updated as part of this phase?**
   - What we know: The test currently mocks the wrong store to provide credentials. After fixing production code, the test will fail unless updated.
   - What's unclear: Whether the plan treats test fixes as part of the implementation plans.
   - Recommendation: Test update must be part of the same plan as the production fix (14-03). The two changes are atomic.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom environment) |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose 2>&1 \| tail -20` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOARD-04 | QuickCreateInput visible in SprintBoardTab columns; createIssue fires from board | unit | `cd taskflow && npx vitest run SprintBoardTab` | ✅ (SprintBoardTab.test.tsx exists — no BOARD-04 specific test yet) |
| BACK-03 | Backlog query is invalidated on modal close after story create | unit | `cd taskflow && npx vitest run BacklogPage` | ✅ (BacklogPage.test.tsx — BACK-03 tests present) |
| EPIC-04 | createIssue called with correct creds from useAuthStore | unit | `cd taskflow && npx vitest run CreateEpicDialog` | ✅ (CreateEpicDialog.test.tsx — EPIC-04 tests present, but mocks wrong store) |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run --reporter=verbose 2>&1 | tail -10`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green (>=365 passing, baseline is 365) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `SprintBoardTab.test.tsx` needs a BOARD-04 test: render SprintBoardTab with data, assert `+ Add` button is visible in each column
- [ ] `CreateEpicDialog.test.tsx` mock update: replace `useSettingsStore` credential fields with `useAuthStore` + `readSecret` mocks

*(BacklogPage tests for BACK-03 exist and should pass after the one-line fix — no Wave 0 gap there.)*

---

## Sources

### Primary (HIGH confidence)
- `/Users/mimo/Desktop/Tasker/taskflow/src/routes/dashboard/SprintBoardTab.tsx` — full source read; confirms DroppableCell layout, available state (jiraToken, activeJiraProject, jiraBaseUrl), and missing QuickCreateInput import
- `/Users/mimo/Desktop/Tasker/taskflow/src/routes/dashboard/QuickCreateInput.tsx` — full source read; confirms props interface and onCreated pattern
- `/Users/mimo/Desktop/Tasker/taskflow/src/routes/dashboard/BoardColumn.tsx` — full source read; confirms different layout model from SprintBoardTab
- `/Users/mimo/Desktop/Tasker/taskflow/src/routes/dashboard/CreateEpicDialog.tsx` — full source read; confirms wrong-store cast on lines 16–26
- `/Users/mimo/Desktop/Tasker/taskflow/src/main.tsx` — full source read; confirms `['jira-backlog']` key on line 130
- `/Users/mimo/Desktop/Tasker/taskflow/src/stores/auth.store.ts` — full source read; confirms jiraBaseUrl/activeJiraProject live here
- `/Users/mimo/Desktop/Tasker/taskflow/src/stores/settings.store.ts` — full source read; confirms NO auth fields in SettingsState
- `/Users/mimo/Desktop/Tasker/taskflow/src/routes/dashboard/CreateEpicDialog.test.tsx` — full source read; confirms test mocks wrong store
- `/Users/mimo/Desktop/Tasker/.planning/v1.2-MILESTONE-AUDIT.md` — audit source; exact line numbers and evidence for all three gaps

### Secondary (MEDIUM confidence)
- Test suite run output: 365 passing, 18 errors (pre-existing gitlab.test.ts errors), baseline confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from source files directly
- Architecture: HIGH — all three bugs have exact file + line evidence from audit
- Pitfalls: HIGH — derived from source code analysis and test contract inspection

**Research date:** 2026-03-15
**Valid until:** Phase 14 completion (code changes are narrow and isolated)
