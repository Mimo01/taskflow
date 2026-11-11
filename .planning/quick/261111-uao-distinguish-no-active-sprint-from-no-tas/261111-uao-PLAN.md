---
phase: quick-261111-uao
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/hooks/useActiveSprint.ts
  - taskflow/src/hooks/useActiveSprint.test.tsx
  - taskflow/src/lib/sprint-empty-state.ts
  - taskflow/src/lib/sprint-empty-state.test.ts
  - taskflow/src/components/app/Sidebar.tsx
  - taskflow/src/routes/dashboard/index.tsx
  - taskflow/src/routes/dashboard/index.test.tsx
  - taskflow/src/routes/dashboard/MyIssuesCard.tsx
  - taskflow/src/routes/dashboard/MyIssuesCard.test.tsx
  - taskflow/src/routes/my-tasks/MyTasksPage.tsx
  - taskflow/src/routes/my-tasks/MyTasksPage.test.tsx
  - taskflow/src/routes/standup-notes/TodayColumn.tsx
  - taskflow/src/routes/standup-notes/TodayColumn.test.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
autonomous: true
requirements: [QUICK-261111-uao]

must_haves:
  truths:
    - "When the board has no active sprint, the Dashboard MY ISSUES card says 'No active sprint', not 'No issues assigned'"
    - "When the board has no active sprint, My Tasks (Current Sprint scope) says 'No active sprint', and hides the sprint stat tiles, the pts donut and the '0 open · 0 done · 0 pts' subline"
    - "When the board has no active sprint, Standup Today replaces In Progress / Up Next with a compact 'No active sprint' state, keeps the MR sections, and drops the '0 in progress · 0 up next' counts"
    - "When the board has no active sprint, Sprint Board says 'No active sprint' instead of 'No sprint issues' and hides filter chips/bar and the zero column counts"
    - "While the active-sprint lookup is still pending, none of the four surfaces flashes 'No active sprint' (or the no-tasks copy); a disabled query never counts as pending"
    - "If sprint issues exist, they always render, whatever the active-sprint lookup returned"
  artifacts:
    - path: "taskflow/src/hooks/useActiveSprint.ts"
      provides: "Shared active-sprint hook + query-key helper"
      exports: ["useActiveSprint", "activeSprintQueryKey"]
    - path: "taskflow/src/lib/sprint-empty-state.ts"
      provides: "Pure branching helper + shared copy"
      exports: ["resolveSprintScopeState", "NO_ACTIVE_SPRINT_TITLE"]
  key_links:
    - from: "taskflow/src/hooks/useActiveSprint.ts"
      to: "['jira-active-sprint', project, baseUrl, boardId] cache entry (Sidebar prefetch)"
      via: "activeSprintQueryKey used by both the hook and Sidebar prefetchQuery"
      pattern: "activeSprintQueryKey\\("
    - from: "MyIssuesCard / MyTasksPage / TodayColumn / SprintBoardTab"
      to: "useActiveSprint + resolveSprintScopeState"
      via: "import"
      pattern: "resolveSprintScopeState\\("
---

<objective>
Tell "the board has no active sprint" apart from "you have no tasks in the active sprint" on four surfaces: Dashboard MY ISSUES, My Tasks (Current Sprint), Standup Today, and Sprint Board. Use one shared hook built on the existing `['jira-active-sprint', …]` query, which the Sidebar already prefetches, so no page makes an extra request.

Purpose: today an empty `sprint in openSprints()` result always reads as "no tasks", and sprint-only stats show as zeros. That isn't true when there is simply no sprint running.
Output: `useActiveSprint` hook, pure `resolveSprintScopeState` helper, four surfaces wired, vitest coverage.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Repo layout: `.planning/` and git sit at the outer `/Users/mimo/Documents/Projects/taskflow`. App source, npm, vitest and biome live in the inner `/Users/mimo/Documents/Projects/taskflow/taskflow`. Run all npm/npx commands from the inner dir.

Existing pieces (read these, don't re-derive them):
- `taskflow/src/services/jira.ts` `fetchActiveSprint(baseUrl, token, projectKey, boardId?)` returns `JiraActiveSprint | null`. It NEVER throws: null means "no active sprint" OR "request failed". Use the legacy `@/services/jira` import (all consumers use jira.ts, not the jira/ modules).
- `taskflow/src/hooks/useBoardId.ts` returns `{ boardId, isLoading }`. It honours the stored per-project board choice.
- `taskflow/src/components/app/Sidebar.tsx` (~line 150) prefetches key `['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId]` with staleTime 5 min.
- `taskflow/src/routes/dashboard/index.tsx` (~line 121-152) runs the same query inline, enabled only when `boardId != null`, for the hero "Sprint day X of Y" clause.
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` (~line 1011-1022) runs it inline with `fetchActiveSprint` from `@/services/jira/sprints`, enabled even while boardId is null (wrong: it fetches under a `null` key).
- `taskflow/src/components/ui/empty-state.tsx` `EmptyState({ icon, title, subtitle?, compact? })`. Use it; no bespoke graphics.
- Memory rules: a disabled TanStack v5 query reports `isPending` forever, so always AND with `enabled`. Never put the Jira token in a queryKey. The pre-commit hook runs the full vitest suite + biome + tsc, so tests and implementation land in ONE commit per task. Commit with `git commit -- <paths>` and check `git log -1 --stat` (failed hooks leave files staged). Don't run `biome --write` on all of src; only check the touched files.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Shared useActiveSprint hook + pure resolveSprintScopeState helper</name>
  <files>taskflow/src/hooks/useActiveSprint.ts, taskflow/src/hooks/useActiveSprint.test.tsx, taskflow/src/lib/sprint-empty-state.ts, taskflow/src/lib/sprint-empty-state.test.ts, taskflow/src/components/app/Sidebar.tsx</files>
  <behavior>
    resolveSprintScopeState({ itemsLoading, hasItems, sprint: { noActiveSprint, isResolving } }) returns 'loading' | 'items' | 'no-sprint' | 'empty':
    - hasItems=true → 'items', even when noActiveSprint=true or isResolving=true (items always win)
    - hasItems=false, itemsLoading=true → 'loading'
    - hasItems=false, itemsLoading=false, isResolving=true → 'loading' (no flash)
    - hasItems=false, settled, noActiveSprint=true → 'no-sprint'
    - hasItems=false, settled, noActiveSprint=false → 'empty'
    useActiveSprint (renderHook with a real QueryClientProvider, retry:false; vi.mock '@/services/jira' fetchActiveSprint and '@/hooks/useBoardId'):
    - fetch resolves a sprint → activeSprint set, noActiveSprint=false, isResolving=false
    - fetch resolves null → noActiveSprint=true, isResolving=false
    - before the fetch settles → isResolving=true, noActiveSprint=false
    - token null (query disabled) → isResolving=false AND noActiveSprint=false (the disabled-isPending guard), fetchActiveSprint not called
    - useBoardId isLoading=true → isResolving=true; useBoardId resolved boardId=null → query disabled, isResolving=false, noActiveSprint=false
    - activeSprintQueryKey('P','https://j',7) deep-equals ['jira-active-sprint','P','https://j',7]
  </behavior>
  <action>
    Create `taskflow/src/lib/sprint-empty-state.ts`. Export type `SprintScopeState`, a pure `resolveSprintScopeState` with exactly the precedence in `<behavior>`, and the shared copy constant `NO_ACTIVE_SPRINT_TITLE = 'No active sprint'`. The icon is `CalendarOff` from lucide-react, imported per surface. Add a short doc comment: null from fetchActiveSprint can also mean a failed request, which is why hasItems always wins.

    Create `taskflow/src/hooks/useActiveSprint.ts`:
    - Export `activeSprintQueryKey(projectKey, jiraBaseUrl, boardId)` returning the tuple `['jira-active-sprint', projectKey, jiraBaseUrl, boardId] as const`. Keep the element order, since it must match the existing cache entry.
    - Export `useActiveSprint(jiraBaseUrl: string | null, jiraToken: string | null, projectKey: string | null)` returning `{ activeSprint: JiraActiveSprint | null; noActiveSprint: boolean; isResolving: boolean }`.
    - Internally call `useBoardId(jiraBaseUrl, jiraToken, projectKey)`, then `useQuery` with that key, `queryFn` fetchActiveSprint(base, token, project, boardId ?? undefined), `staleTime: 5 * 60_000`, and `enabled = !!jiraBaseUrl && !!jiraToken && !!projectKey && boardId != null`.
    - `isResolving = boardIsLoading || (enabled && query.isPending)`.
    - `noActiveSprint = query.isSuccess && query.data === null`.
    - `activeSprint = query.data ?? null`.
    - The token is never in the key.

    In `taskflow/src/components/app/Sidebar.tsx`, replace the literal prefetch key with `activeSprintQueryKey(activeJiraProject, jiraBaseUrl, boardId)`. Behaviour stays the same; this is only so the key can't drift.

    Write both test files first (RED), then implement (GREEN). Both go in one commit, because the hook runs the full suite.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/sprint-empty-state.test.ts src/hooks/useActiveSprint.test.tsx src/components/app && npx tsc --noEmit && npx biome check src/lib/sprint-empty-state.ts src/hooks/useActiveSprint.ts src/components/app/Sidebar.tsx</automated>
  </verify>
  <done>Helper + hook exported and tested (all behavior cases pass), Sidebar prefetch uses the shared key helper, tsc + biome clean on touched files, one commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Dashboard MY ISSUES card + My Tasks Current Sprint no-sprint state</name>
  <files>taskflow/src/routes/dashboard/MyIssuesCard.tsx, taskflow/src/routes/dashboard/MyIssuesCard.test.tsx, taskflow/src/routes/dashboard/index.tsx, taskflow/src/routes/dashboard/index.test.tsx, taskflow/src/routes/my-tasks/MyTasksPage.tsx, taskflow/src/routes/my-tasks/MyTasksPage.test.tsx</files>
  <behavior>
    - MyIssuesCard: 0 my issues + noActiveSprint → shows 'No active sprint' and NOT 'No issues assigned'; no segmented bar/legend
    - MyIssuesCard: 0 my issues + active sprint present → still 'No issues assigned' (existing D-05 test keeps passing)
    - MyIssuesCard: 0 issues + isResolving → neither empty-state title is shown
    - MyIssuesCard: issues present + noActiveSprint → data view renders (items win)
    - MyTasksPage Current Sprint: empty sprint data + noActiveSprint → 'No active sprint' EmptyState, no "You're all caught up", no stat tiles (no 'To Do' tile button), no 'pts done' donut, and subtitle has no '0 pts in flight'
    - MyTasksPage All Assigned scope: unaffected by noActiveSprint (existing all-assigned empty copy stays)
    - MyTasksPage Current Sprint with active sprint + no issues → still "You're all caught up"
  </behavior>
  <action>
    Dashboard index.tsx: replace the inline `['jira-active-sprint', …]` useQuery with `const { activeSprint } = useActiveSprint(jiraBaseUrl, jiraToken, activeJiraProject)`. Remove the `useBoardId` call and the `fetchActiveSprint` import if nothing else uses them. The sprintClause logic stays as it is (it already blanks without a sprint).

    MyIssuesCard.tsx: call `useActiveSprint(jiraBaseUrl || null, jiraToken || null, activeJiraProject || null)`. The props are '' when unset, so map '' to null. Compute `state = resolveSprintScopeState({ itemsLoading: isLoading, hasItems: total > 0, sprint })`. Feed `useDelayedLoading(state === 'loading')` to the skeleton. Keep the error branch first. On 'no-sprint', render `<EmptyState icon={CalendarOff} title={NO_ACTIVE_SPRINT_TITLE} subtitle="There's no open sprint on the board right now." />`. Keep the existing 'No issues assigned' for 'empty' and the data view for 'items'. This part is test-first.

    MyTasksPage.tsx: call `useActiveSprint(jiraBaseUrl ?? null, jiraToken, activeJiraProject ?? null)`. Then `const noSprint = scope === 'current-sprint' && resolveSprintScopeState({ itemsLoading: sprintLoading, hasItems: allIssues.length > 0, sprint }) === 'no-sprint'`. Also make `isLoading` for current-sprint true when that state is 'loading', so the skeleton shows instead of a no-tasks flash.
    - In renderMyDayList, before the bands check, if noSprint return `<EmptyState icon={CalendarOff} title={NO_ACTIVE_SPRINT_TITLE} subtitle="There's no open sprint right now. Switch to All Assigned to see the rest of your work." />`.
    - When noSprint, hide the sprint-only chrome: the stat tiles block ("Enriched stat tiles", ~line 838), the pts donut inside `actions`, and the open/done/pts subtitle. Replace the subtitle with plain muted text "No active sprint".
    - Keep the scope segmented control visible, so the user can switch scope.

    Tests: MyTasksPage.test and the dashboard index/MyIssuesCard tests mock useQuery or fetchActiveSprint globally. Add `vi.mock('@/hooks/useActiveSprint', …)` in each touched test file, defaulting to `{ activeSprint: null, noActiveSprint: false, isResolving: false }` so existing expectations are unchanged. Override per test for the new cases. Note that index.test currently mocks fetchActiveSprint to resolve null; with the hook mocked, its sprint-day test must provide activeSprint through the hook mock instead. Update it and keep the same assertion.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/MyIssuesCard.test.tsx src/routes/dashboard/index.test.tsx src/routes/my-tasks && npx tsc --noEmit && npx biome check src/routes/dashboard/MyIssuesCard.tsx src/routes/dashboard/index.tsx src/routes/my-tasks/MyTasksPage.tsx</automated>
  </verify>
  <done>All behavior cases covered by passing tests, existing tests unchanged in intent, no zero sprint stats shown in no-sprint state, one commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Standup Today column + Sprint Board no-sprint state</name>
  <files>taskflow/src/routes/standup-notes/TodayColumn.tsx, taskflow/src/routes/standup-notes/TodayColumn.test.tsx, taskflow/src/routes/dashboard/SprintBoardTab.tsx, taskflow/src/routes/dashboard/SprintBoardTab.test.tsx</files>
  <behavior>
    - TodayColumn: empty sprint data + noActiveSprint + MRs present → 'No active sprint' compact empty state shown, 'Up Next' header NOT rendered, MR sections still rendered, stat line shows the MR count but no 'in progress'/'up next' counts
    - TodayColumn: empty sprint data + noActiveSprint + no MRs → single full-column 'No active sprint' state (not 'Nothing planned for today')
    - TodayColumn: empty sprint + isResolving → neither 'No active sprint' nor 'Nothing planned for today'
    - TodayColumn: active sprint + nothing → existing 'Nothing planned for today' unchanged
    - SprintBoardTab: allData resolved with 0 issues + noActiveSprint → 'No active sprint' shown, 'No sprint issues' not shown
    - SprintBoardTab: 0 issues + active sprint → 'No sprint issues' unchanged
  </behavior>
  <action>
    TodayColumn.tsx: call `useActiveSprint(jiraBaseUrl ?? null, jiraToken, activeJiraProject ?? null)`. Compute `sprintState = resolveSprintScopeState({ itemsLoading: sprintQuery.isLoading, hasItems: inProgress.length + upNext.length > 0, sprint })`. The sprint is board-level, so a watched person makes no difference. Set `noSprint = sprintState === 'no-sprint'` and `sprintPending = sprintState === 'loading'`.
    - Pass `isLoading={sprintQuery.isLoading || sprintPending}` to both sprint sections.
    - Add `!sprintPending` to the `allSettledEmpty` conjuncts.
    - When noSprint and not allSettledEmpty, render `<EmptyState compact icon={CalendarOff} title={NO_ACTIVE_SPRINT_TITLE} subtitle="There's no open sprint on the board." />` in place of TodayInProgressSection and TodayUpNextSection. Don't render either of those; MR sections stay.
    - The summary stat line in noSprint renders only `{mrCount} MRs`.
    - The full-column EmptyState in noSprint uses icon CalendarOff, title NO_ACTIVE_SPRINT_TITLE, subtitle "No open sprint on the board and no MRs awaiting review." Otherwise keep the existing Clock/'Nothing planned for today'.
    - Leave generateTodayMarkdown untouched.

    SprintBoardTab.tsx: replace the inline activeSprint useQuery (~line 1011-1022) with `const sprint = useActiveSprint(jiraBaseUrl, jiraToken, activeJiraProject)` and `const activeSprint = sprint.activeSprint`. This also fixes the inline query firing under a null boardId key. Drop the now-unused `fetchActiveSprint` import from `@/services/jira/sprints`. Compute `boardState = resolveSprintScopeState({ itemsLoading: isLoading, hasItems: (data?.length ?? 0) > 0, sprint })`.
    - In the "Empty" branch (~line 1836), render `<EmptyState icon={CalendarOff} title={NO_ACTIVE_SPRINT_TITLE} subtitle="Start a sprint in Jira and its issues will appear here." />` when boardState is 'no-sprint'.
    - Render the existing 'No sprint issues' only when boardState is 'empty'.
    - Render neither while 'loading'.
    - When 'no-sprint', also skip QuickFilterChipRow and UnifiedFilterBar, and hide the `({count})` span in the column headers, so no zero sprint counts show.

    Tests: TodayColumn.test and SprintBoardTab.test mock useQuery and services. Add `vi.mock('@/hooks/useActiveSprint', …)` defaulting to `{ activeSprint: null, noActiveSprint: false, isResolving: false }` so existing cases are unchanged. Override per new case. SprintBoardTab.test's `@/services/jira/sprints` fetchActiveSprint mock can stay if other symbols need it. Write the new cases first, then implement, in one commit.

    Afterwards, run the full suite once. Per memory, FindBar.test can be flaky under the full suite; re-run it alone before treating it as a regression.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/standup-notes src/routes/dashboard/SprintBoardTab.test.tsx && npx tsc --noEmit && npx biome check src/routes/standup-notes/TodayColumn.tsx src/routes/dashboard/SprintBoardTab.tsx && npx vitest run</automated>
  </verify>
  <done>Standup and Sprint Board distinguish no-sprint from empty, no flash while pending, all new and existing tests pass, full suite green, one commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app → Jira Agile REST | Existing GET /board/{id}/sprint?state=active; no new endpoint |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-uao-01 | Information Disclosure | useActiveSprint queryKey | mitigate | Token passed only to queryFn/enabled; activeSprintQueryKey takes project, baseUrl, boardId only |
| T-uao-02 | Spoofing (misleading UI) | null = failure conflation | accept | fetchActiveSprint returns null on errors too; items-always-win precedence means a failed lookup never hides real sprint issues, and the issue query's own error state takes precedence |
</threat_model>

<verification>
- `npx vitest run` (inner dir) green; `npx tsc --noEmit` clean; `biome check` clean on touched files.
- grep: `grep -rn "'jira-active-sprint'" taskflow/src --include='*.ts' --include='*.tsx' | grep -v test` shows only `useActiveSprint.ts`.
- grep: `resolveSprintScopeState(` appears in MyIssuesCard, MyTasksPage, TodayColumn, SprintBoardTab.
</verification>

<success_criteria>
All four surfaces show 'No active sprint' (CalendarOff, compact EmptyState) only once both the sprint lookup and the issues have settled with no issues and no active sprint. Sprint-only zero stats are hidden in that state. The existing no-tasks copy is unchanged when a sprint exists. No new network request: everything reads the Sidebar-prefetched `jira-active-sprint` cache entry.

Explicitly not built: naming the board or the next future sprint in the copy. The board name isn't fetched anywhere, and the next sprint needs a `state=future` request that no page makes today, so both would mean a new request per page.
</success_criteria>

<output>
Create `.planning/quick/261111-uao-distinguish-no-active-sprint-from-no-tas/261111-uao-SUMMARY.md` when done
</output>
