---
phase: 72
plan: 02
subsystem: routes/dashboard
tags: [greenhopper, react-query, sprint-board, status-popover, bulk-action, quick-create, transitions, jira]
requires:
  - Plan 72-01 (useGhTransitions, getGhTransitions, invalidateGhTransitions, fetchAllJiraStatuses)
provides:
  - All four legacy fetchTransitions call sites route through the GH cache
  - Sprint-board toolbar 'Reload workflow transitions' action with inline aria-live feedback
  - QuickCreateInput prop additions (projectId, issueTypeId)
  - StatusPopover prop swap (issueKey → projectId + issueTypeId)
  - JiraIssue/JiraIssueDetail type extensions (optional project + issuetype.id)
affects:
  - taskflow/src/services/jira.ts (JiraIssue/JiraIssueDetail types, search field= lists)
  - taskflow/src/services/jira/types.ts (parallel duplicate types)
  - taskflow/src/routes/dashboard/TaskRow.tsx (StatusPopover prop pass-through)
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx (StatusPopover prop pass-through)
  - taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx (jira mock — useGhTransitions stub)
tech-stack:
  added: []
  patterns:
    - "Hook consumer via useGhTransitions(projectId, issueTypeId) — project-scoped envelope dedupes per session"
    - "Imperative consumer via getGhTransitions(queryClient, baseUrl, token, projectId, issueTypeId) — shares the envelope + status map"
    - "Toolbar invalidation via invalidateGhTransitions(qc, projectId) + queryClient.invalidateQueries({ queryKey: ['jira-statuses'] })"
    - "Inline aria-live label idiom (no toast library; CONTEXT D-07 strings used verbatim)"
key-files:
  created:
    - taskflow/src/routes/dashboard/StatusPopover.test.tsx
  modified:
    - taskflow/src/routes/dashboard/StatusPopover.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
    - taskflow/src/routes/dashboard/BulkActionBar.tsx
    - taskflow/src/routes/dashboard/BulkActionBar.test.tsx
    - taskflow/src/routes/dashboard/QuickCreateInput.tsx
    - taskflow/src/routes/dashboard/QuickCreateInput.test.tsx
    - taskflow/src/routes/dashboard/TaskRow.tsx
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira/types.ts
decisions:
  - "Sentinel projectId/issueTypeId for the project-envelope warm derived from localIssues[0].fields (PATTERNS §SprintBoardTab Analog #2 alternative). The planner's preferred derivation from the ['project-statuses'] query response was infeasible — fetchProjectStatuses flattens to JiraProjectStatus[] with no project id field. Documented inline."
  - "issuetype.id typed as optional (id?: string) to keep ~50 pre-existing test fixtures compiling — runtime always returns it when 'issuetype' is in the search fields= list. Same for project (project?: { id; key })."
  - "Sprint/detail fetch fields= lists extended with 'project' (jira.ts:377, 411, 472, 520, 568, 569, 1616). Without this the new GH transitions cache lookup would fall back to projectId=0 and never resolve."
  - "Toolbar reload action uses inline aria-live label (role='status', aria-live='polite') beside the existing lastRefreshed span — no toast dependency added (RESEARCH Pitfall 5, CONTEXT D-07)."
metrics:
  duration: ~25 minutes
  completed: 2026-05-29
---

# Phase 72 Plan 02: GH Transitions Cache Migration + Toolbar Reload Action Summary

Migrated the four `fetchTransitions` call sites in `src/routes/dashboard/` to the Plan 01 cache APIs and added the sprint-board "Reload workflow transitions" toolbar action with inline aria-live feedback per CONTEXT D-07. After this plan the sprint board issues exactly one `/rest/greenhopper/1.0/xboard/work/transitions.json` per project per session and zero `/rest/api/2/issue/*/transitions` calls; the toolbar action invalidates both the envelope cache and the `['jira-statuses']` map and re-fetches. The legacy `fetchTransitions` definition is still present in `services/jira.ts` and `services/jira/transitions.ts` (Plan 03 deletes it).

## What Shipped

### Task 1: StatusPopover + SprintBoardTab — commit `a41b395f`

**StatusPopover (`src/routes/dashboard/StatusPopover.tsx`)**
- Prop surface flipped from `issueKey: string` → `projectId: number, issueTypeId: string`. The component no longer needs `jiraBaseUrl` / `token` props — the hook resolves those internally via `useAuthStore` + `readSecret('jira-pat')`.
- Replaced `useQuery({queryKey: ['transitions', issueKey], queryFn: ... fetchTransitions(...), enabled: false})` with `useGhTransitions(projectId, issueTypeId)`. Removed `enabled: false` + manual `refetch()` on open — the project-scoped cache is cheap to keep warm.
- Imports: dropped `fetchTransitions`, `useQuery`, `readSecret`; added `useGhTransitions`.

**Parents updated to pass the new props:**
- `TaskRow.tsx:111` — `projectId={Number(issue.fields.project?.id ?? 0)} issueTypeId={issue.fields.issuetype?.id ?? ''}`.
- `issue-detail/FieldsSection.tsx:376` — same shape, sourcing from `f.project` / `f.issuetype`.

**SprintBoardTab (`src/routes/dashboard/SprintBoardTab.tsx`)**
- Replaced the per-issue prefetch loop (`useEffect` at lines ~729-742, `queryClient.fetchQuery({queryKey: ['transitions', issue.key], ...})` mapped over `localIssuesRef.current`) with a single `useGhTransitions(sentinelProjectId, sentinelIssueTypeId)` call that warms the project envelope. Removed the now-unused `localIssuesRef` declaration.
- `getTransitions` helper retyped from `(issueKey: string)` to `(issue: JiraIssue)` and reads the per-type cache `['gh-transitions', Number(issue.fields.project?.id ?? 0), issue.fields.issuetype?.id ?? '']`. All five call sites (`getTransitions(story.key)` × 3, `getTransitions(card.key)` × 2, `getTransitions(stickyHeader.story.key)`) updated to pass the full issue object. `VirtualizedSwimlanes` prop type updated to match.
- New toolbar "Reload workflow transitions" button sibling to the existing RefreshCw at lines ~1101-1117:
  - `aria-label="Reload workflow transitions"`, `title="Reload workflow transitions"`, lucide `Workflow` icon.
  - Click handler `handleReloadWorkflowTransitions` reads `pid = Number(localIssues[0]?.fields.project?.id ?? 0)`, calls `invalidateGhTransitions(queryClient, pid)`, then `await queryClient.invalidateQueries({ queryKey: ['jira-statuses'] })`.
  - Inline feedback via a new `useState<string|null>(null)` cleared after 3s; renders verbatim CONTEXT D-07 strings — `"Workflow transitions reloaded"` on success, `"Failed to reload workflow"` on error / invalid pid — inside a `role="status" aria-live="polite"` span beside the existing `lastRefreshed` label (line 1103).
- Imports: dropped `fetchTransitions`; added `useGhTransitions`, `invalidateGhTransitions`, `Workflow` from `lucide-react`.

**Tests:**
- New `StatusPopover.test.tsx` (4 cases): mocks `@/services/jira` to expose only `useGhTransitions`; verifies the hook is called with `(10042, '3')`, renders transition list / loading / error states, and that the source-grep guard for the absent legacy import holds (component-import would fail at module-load if it still referenced `fetchTransitions`).
- `SprintBoardTab.test.tsx`: jira mock swapped (`fetchTransitions` → `useGhTransitions`, `invalidateGhTransitions`); lucide mock extended with `Workflow`. Two new cases:
  - "routes transitions through useGhTransitions (no fetchTransitions call)" — asserts the hook is invoked on board mount.
  - "toolbar 'Reload workflow transitions' action invalidates envelope + jira-statuses" — spies on `QueryClient.prototype.invalidateQueries`, asserts `invalidateGhTransitions(qc, 10042)` and `invalidateQueries({ queryKey: ['jira-statuses'] })`, and confirms the inline aria-live text reads exactly `"Workflow transitions reloaded"`.

### Task 2: BulkActionBar + QuickCreateInput — commit `7cd3df00`

**BulkActionBar (`src/routes/dashboard/BulkActionBar.tsx`)**
- Added `useQueryClient` hook + `const queryClient = useQueryClient();` near the top.
- Replaced the inner `fetchTransitions(jiraBaseUrl, jiraToken, key)` at line ~161 with:
  ```ts
  const issue = issues.find((i) => i.key === key);
  if (!issue) throw new Error(`Issue ${key} not in selection`);
  const projectId = Number(issue.fields.project?.id ?? 0);
  const issueTypeId = issue.fields.issuetype?.id ?? '';
  const transitions = await getGhTransitions(queryClient, jiraBaseUrl, jiraToken, projectId, issueTypeId);
  ```
- `postTransition` unchanged (D-08: POST stays on REST).
- Imports: dropped `fetchTransitions`; added `getGhTransitions` and `useQueryClient`.

**QuickCreateInput (`src/routes/dashboard/QuickCreateInput.tsx`)**
- Added `projectId: number` and `issueTypeId: string` props (planner Q2 + RESEARCH Pitfall 6). `createIssue`'s signature is NOT widened.
- Added `useQueryClient` hook.
- Replaced `fetchTransitions(jiraBaseUrl, jiraToken, newKey)` at line ~51 with `getGhTransitions(queryClient, jiraBaseUrl, jiraToken, projectId, issueTypeId)`.
- Note: this component is NOT currently rendered from any parent in the codebase (verified by `grep -rn 'import.*QuickCreateInput' src` — only the test file imports it). No SprintBoardTab JSX threading was needed; future renderer will pass the new props.

**Tests:**
- `BulkActionBar.test.tsx`: replaced 35 `it.todo` stubs with a focused Phase 72 suite (2 cases):
  - "resolves transitions via getGhTransitions for each selected key" — two-key bulk status change asserts `getGhTransitions` called twice with `(qc, baseUrl, token, 10042, '3')` and `postTransition` called twice.
  - "throws when a selected key is not present in the issues prop" — fail-fast guard surfaces in the progress indicator (`fail:1`).
- `QuickCreateInput.test.tsx`: existing 3 cases preserved (open/Enter/Escape behaviour); new case "uses getGhTransitions for post-create transition lookup" asserts the new call shape.

### Cross-cutting type + fetch-fields changes (committed inside Task 1)

- `JiraIssue.fields.issuetype` extended with optional `id?: string` (both copies — `jira.ts:151-155` and `jira/types.ts:35-41`).
- `JiraIssue.fields.project?: { id: string; key: string }` added (both copies).
- `JiraIssueDetail.fields` extended in the same way.
- Six search-field lists in `jira.ts` extended with `project`:
  - lines 377 / 411 / 472 / 520 / 568 / 569 (sprint stories, sprint subtasks variants, fetchAllSprintIssues helper).
  - line 1616 (single-issue detail fetch).

## Verification

- Per-task automated tests:
  - `npx vitest run src/routes/dashboard/StatusPopover.test.tsx src/routes/dashboard/SprintBoardTab.test.tsx` — **2 files, 26 passed.**
  - `npx vitest run src/routes/dashboard/BulkActionBar.test.tsx src/routes/dashboard/QuickCreateInput.test.tsx` — **2 files, 6 passed.**
- Full repo `npx vitest run` — **140 files passed (3 skipped), 1652 tests passed, 18 todo, 2 skipped, 0 failures.**
- `npx tsc --noEmit -p .` — clean.
- `npx biome check src/routes/dashboard/{StatusPopover,SprintBoardTab,BulkActionBar,QuickCreateInput}.tsx` — clean.

## Acceptance Assertions

| Assertion | Expected | Actual |
|-----------|----------|--------|
| `grep -cE 'fetchTransitions' StatusPopover.tsx` | 0 | 0 |
| `grep -c 'useGhTransitions' StatusPopover.tsx` | ≥ 1 | 3 |
| `grep -cE 'fetchTransitions' SprintBoardTab.tsx` | 0 | 0 |
| `grep -c 'invalidateGhTransitions' SprintBoardTab.tsx` | ≥ 1 | 2 |
| `grep -cE \"queryKey:\\s*\\[\\s*'transitions'\" SprintBoardTab.tsx + StatusPopover.tsx` | 0 / 0 | 0 / 0 |
| `grep -c 'Reload workflow transitions' SprintBoardTab.tsx` | ≥ 2 | 3 |
| `grep -c 'aria-live' SprintBoardTab.tsx` | ≥ 1 | 3 |
| `grep -c 'Workflow transitions reloaded' SprintBoardTab.tsx` (B-01) | ≥ 1 | 1 |
| `grep -c 'Failed to reload workflow' SprintBoardTab.tsx` (B-01) | ≥ 1 | 2 |
| `grep -c 'Workflow transitions reloaded' SprintBoardTab.test.tsx` (B-01 test) | ≥ 1 | 1 |
| `grep -cE \"queryKey:.*['\\\"']jira-statuses['\\\"']\" SprintBoardTab.tsx` (B-02 src) | ≥ 1 | 1 |
| `grep -cE \"queryKey:.*['\\\"']jira-statuses['\\\"']\" SprintBoardTab.test.tsx` (B-02 test) | ≥ 1 | 2 |
| `grep -cE 'function getTransitions\\(issue' SprintBoardTab.tsx` (W-02) | ≥ 1 | 1 |
| `grep -cE 'fetchTransitions' BulkActionBar.tsx` | 0 | 0 |
| `grep -c 'getGhTransitions' BulkActionBar.tsx` | ≥ 1 | 2 |
| `grep -cE 'fetchTransitions' QuickCreateInput.tsx` | 0 | 0 |
| `grep -c 'getGhTransitions' QuickCreateInput.tsx` | ≥ 1 | 3 |
| `grep -cE 'projectId\\s*:\\s*number' QuickCreateInput.tsx` | ≥ 1 | 1 |
| `grep -cE 'issueTypeId\\s*:\\s*string' QuickCreateInput.tsx` | ≥ 1 | 1 |
| `grep -rE 'fetchTransitions' src/routes/dashboard/` (only comments/test names) | 0 source-code hits | 0 (10 hits, all in comments / test descriptors) |
| `grep -cE 'sonner|react-hot-toast|react-toastify|@radix-ui/react-toast' package.json` | 0 | 0 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] projectId/issueTypeId not present on JiraIssue fields**
- **Found during:** Task 1 (initial read of SprintBoardTab + sprint stories fetcher).
- **Issue:** The plan called for `Number(issue.fields.project.id)` and `issue.fields.issuetype.id`, but (a) the JiraIssue type's `issuetype` literal only declared `{ name, subtask }`, no `id`, and (b) the sprint stories / subtasks `fields=` search-API lists did not include `project`, so the runtime payload never carried the project object either.
- **Fix:** Extended both JiraIssue copies (`jira.ts`, `jira/types.ts`) with `issuetype.id?: string` (optional to preserve ~50 existing test fixtures) and `project?: { id: string; key: string }`. Added `project` to the six search-field lists in `jira.ts` (sprint stories, sprint subtasks, fetchAllSprintIssues helper, single-issue detail).
- **Files modified:** `src/services/jira.ts`, `src/services/jira/types.ts`.
- **Commit:** `a41b395f`.

**2. [Rule 3 — Blocking issue] IssueDetailSheet.test.tsx jira mock missing useGhTransitions**
- **Found during:** Task 2 full-suite run.
- **Issue:** `FieldsSection` (rendered inside `IssueDetailSheet`) now consumes `useGhTransitions` via `StatusPopover`. The test mock for `@/services/jira` did not expose it, so Vitest threw "No 'useGhTransitions' export is defined" mid-render — 7 unrelated tests failed.
- **Fix:** Added a default `useGhTransitions` stub (`{ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }`) to the jira mock factory at `IssueDetailSheet.test.tsx:24`.
- **Files modified:** `src/routes/dashboard/IssueDetailSheet.test.tsx`.
- **Commit:** `7cd3df00`.

### Deviation from PATTERNS analog

**Sentinel projectId derivation in SprintBoardTab.** PATTERNS §SprintBoardTab.tsx Analog #1 / planner decision Q3 said "derive projectId from the already-fetched `['project-statuses', activeJiraProject, jiraBaseUrl]` query data (response carries the project's numeric id)". On reading the actual `fetchProjectStatuses` implementation (`src/services/jira/fields.ts:127-159`) the response is flattened to `JiraProjectStatus[]` — only status `id` + `name` + `statusCategory` — with no project id field surfaced through the existing query data. To avoid widening the public fetcher signature mid-plan, the sentinel derives `pid = Number(localIssues[0]?.fields.project?.id ?? 0)` instead, which works because (a) the search-fields fix above propagates `project` to every sprint issue, (b) it covers all D-07a contexts (the toolbar is only visible when a sprint board is rendered, which implies at least one fetched issue). Documented inline via code comment.

## Threat Surface

No new threat flags. The plan's `<threat_model>` covers all introduced surface:
- T-72-07 / T-72-08 / T-72-09 / T-72-10 / T-72-11 / T-72-12 / T-72-SC — all dispositions hold.
- T-72-SC (npm install gate): `package.json` unchanged (verified by `grep -cE 'sonner|react-hot-toast|react-toastify|@radix-ui/react-toast' package.json` → `0`). No package installs in this plan.

## Known Stubs

None. All four call sites consume the new cache; no placeholder data flows.

## Legacy Code Status

- `fetchTransitions` at `src/services/jira.ts:678-711` — **intentionally untouched.** Zero consumers in `src/routes/dashboard/` after this plan. Plan 03 deletes it per D-08.
- `src/services/jira/transitions.ts` — untouched. `postTransition` is permanent; the REST `fetchTransitions` is Plan 03's job.

## Self-Check: PASSED

Files verified to exist:
- FOUND: taskflow/src/routes/dashboard/StatusPopover.tsx (modified)
- FOUND: taskflow/src/routes/dashboard/StatusPopover.test.tsx (created)
- FOUND: taskflow/src/routes/dashboard/SprintBoardTab.tsx (modified)
- FOUND: taskflow/src/routes/dashboard/SprintBoardTab.test.tsx (modified)
- FOUND: taskflow/src/routes/dashboard/BulkActionBar.tsx (modified)
- FOUND: taskflow/src/routes/dashboard/BulkActionBar.test.tsx (modified)
- FOUND: taskflow/src/routes/dashboard/QuickCreateInput.tsx (modified)
- FOUND: taskflow/src/routes/dashboard/QuickCreateInput.test.tsx (modified)
- FOUND: taskflow/src/routes/dashboard/TaskRow.tsx (modified — prop pass-through)
- FOUND: taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx (modified — prop pass-through)
- FOUND: taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx (modified — mock)
- FOUND: taskflow/src/services/jira.ts (types + search fields=)
- FOUND: taskflow/src/services/jira/types.ts (parallel types)

Commits verified in `git log`:
- FOUND: a41b395f feat(72-02): migrate StatusPopover + SprintBoardTab to GH transitions cache
- FOUND: 7cd3df00 feat(72-02): migrate BulkActionBar + QuickCreateInput to getGhTransitions
