---
phase: quick-261109-mmg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/issue-detail-refresh.ts
  - taskflow/src/lib/issue-detail-refresh.test.ts
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.test.tsx
  - taskflow/src/routes/dashboard/IssueDetailView.tsx
autonomous: true
requirements: [QUICK-261109-mmg]

must_haves:
  truths:
    - "Issue detail (full page /issue/:key AND the peek panel) shows a Refresh icon button in the action row, immediately left of Pin"
    - "The button looks exactly like the Release detail / AIO cycle detail refresh button (bare muted RefreshCw size-3, hover:text-foreground, spins while refreshing, disabled while refreshing)"
    - "Clicking it refetches the issue first, then every issue-detail section (comments, changelog, worklogs, subtasks, parent, epic stories/progress, transitions, AIO test runs, linked MRs)"
    - "Dependent sections are refreshed only after the upstream issue query has resolved (no stale-upstream no-op)"
  artifacts:
    - path: "taskflow/src/lib/issue-detail-refresh.ts"
      provides: "refreshIssueDetail(queryClient, { issueKey, jiraBaseUrl }) two-stage invalidation"
      exports: ["refreshIssueDetail"]
    - path: "taskflow/src/lib/issue-detail-refresh.test.ts"
      provides: "stage-ordering + key coverage test"
    - path: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      provides: "Refresh button in action row (onRefresh / refreshing props)"
      contains: "Refresh issue"
  key_links:
    - from: "taskflow/src/routes/dashboard/IssueDetailView.tsx"
      to: "taskflow/src/lib/issue-detail-refresh.ts"
      via: "handleRefresh calls refreshIssueDetail, toggles refreshing state"
      pattern: "refreshIssueDetail\\("
    - from: "taskflow/src/routes/dashboard/IssueDetailView.tsx"
      to: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      via: "onRefresh + refreshing props on <IssueDetailContent>"
      pattern: "onRefresh=\\{"
---

<objective>
Add a Refresh button to issue detail that matches the refresh button used on the other detail
pages, and make it refetch all data for that issue.

Purpose: the user wants to force-reload an issue without leaving the page, and the button has
to look like the refresh buttons elsewhere in the app.
Output: a `refreshIssueDetail` helper (with a test), and the button wired into the shared
IssueDetailContent action row. IssueDetailView renders that row for both the full page and the
peek panel.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Repo layout: .planning/ and git live at the outer taskflow/; src, npm, vitest and biome run from
the inner taskflow/taskflow/ (all commands below cd there).

Reference pattern to copy. Do NOT invent a new style or use the PageHeader refresh classes.
Issue detail has no PageHeader. Its closest analogues are the detail-page headers:
- taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx lines ~183-192: a bare
  `<button type="button">` with className
  `inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground`,
  `onClick={onRefresh}`, `disabled={refreshing}`, `aria-label="Refresh release"`,
  `title="Refresh release"`, and child `<RefreshCw className={refreshing ? 'size-3 animate-spin' : 'size-3'} />`.
  It sits directly before the Pin button.
- taskflow/src/routes/dashboard/aio-cycle/CycleHeader.tsx lines ~139-148: the same markup ("Refresh cycle").
- taskflow/src/lib/release-refresh.ts + release-refresh.test.ts: the upstream-first two-stage
  invalidation helper and its harness test (mock `invalidateQueries` returning held promises).
- taskflow/src/routes/dashboard/ReleaseDetailPage.tsx lines ~249-257: `handleRefresh` sets
  `refreshing` true, awaits the helper, then `.finally(() => setRefreshing(false))`.

Issue detail surfaces:
- taskflow/src/routes/dashboard/IssueDetailView.tsx owns every issue-detail query and renders
  `<IssueDetailContent>` (around line 510) for both layouts. IssueDetailPage (two-column) and
  PeekPanel (single-column) both render IssueDetailView, so wiring it here covers both surfaces.
- taskflow/src/routes/dashboard/IssueDetailContent.tsx line ~392: the action row
  `<div className="flex justify-end gap-2">` with Pin, LogWork, Edit, Clone, Open in Jira + Copy.

Query keys to refresh (all verified in source):
- Upstream: `['jira-issue-detail', issueKey, jiraBaseUrl]` (IssueDetailView:121). Subtask list,
  parentKey and isEpic are all derived from it.
- Dependents: `['jira-issue-comments', issueKey, jiraBaseUrl]`, `['jira-issue-changelog', issueKey, jiraBaseUrl]`,
  `['jira-worklogs', issueKey, jiraBaseUrl]`, `['jira-subtask-enrichment', issueKey, jiraBaseUrl]` (prefix;
  the real key adds a subtaskSignature), `['jira-epic-stories', issueKey, jiraBaseUrl]`,
  `['jira-parent-detail']` (prefix; parentKey is derived and may change after stage 1, and
  invalidateQueries only refetches active queries), `['jira-epic-worklogs', issueKey]`,
  `['jira-epic-status-history', issueKey]` (useEpicProgressQueries, epicKey = issueKey),
  `['jira-issue-transitions-fields', issueKey]` (transitionsWithFieldsKey prefix),
  `['aio', jiraBaseUrl, 'issue-steps', issueKey]` (AioTestRunsSection:416),
  and linked MRs `['gitlab-issue-linked-mrs', gitlabBaseUrl, activeGitlabProject, issueKey]`
  (useLinkedMRs:23). Match the linked-MR key with a `predicate` (`key[0] === 'gitlab-issue-linked-mrs' && key[3] === issueKey`)
  so other issues' MR queries are not refetched.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: refreshIssueDetail two-stage helper + test</name>
  <files>taskflow/src/lib/issue-detail-refresh.ts, taskflow/src/lib/issue-detail-refresh.test.ts</files>
  <behavior>
    - Stage 1: the first and only call before resolving is invalidateQueries({ queryKey: ['jira-issue-detail', 'PROJ-1', 'https://jira.example'] }).
    - No dependent invalidation happens until the stage-1 promise resolves (assert the call count stays at 1 after a microtask).
    - After stage 1 resolves, stage 2 invalidates every dependent key listed in context: comments, changelog, worklogs, subtask-enrichment prefix, epic-stories, parent-detail prefix, epic-worklogs, epic-status-history, transitions-fields prefix, AIO issue-steps. It also makes one predicate-based call for linked MRs.
    - The linked-MR predicate returns true for { queryKey: ['gitlab-issue-linked-mrs', 'https://gl', 7, 'PROJ-1'] } and false for the same key ending in 'PROJ-2' and for ['jira-issue-detail', ...].
    - The returned promise resolves only after every stage-2 promise resolves.
  </behavior>
  <action>
    Create taskflow/src/lib/issue-detail-refresh.ts and export `async function refreshIssueDetail(queryClient: QueryClient, args: { issueKey: string; jiraBaseUrl: string | null | undefined }): Promise<void>`.
    Model it on refreshReleaseDetail in src/lib/release-refresh.ts, including a JSDoc that explains the upstream-first reason. Subtask enrichment builds its key from the issue's subtask list, and its fetch reads parent data, so refreshing dependents in parallel with the issue would refetch against a stale upstream. See the MEMORY note "Enrichment invalidation no-op".
    Stage 1 awaits the single jira-issue-detail invalidation. Stage 2 runs `Promise.all` over the dependent keys listed in context, plus one `invalidateQueries({ predicate })` call for gitlab-issue-linked-mrs matched at index 3 on issueKey.
    Use plain `invalidateQueries`, not `refetchQueries`. Its default refetchType 'active' refetches only the sections that are mounted, and marks the others stale.
    Write the test in src/lib/issue-detail-refresh.test.ts with the same harness shape as release-refresh.test.ts (a vi.fn invalidateQueries returning held promises collected in a resolvers array, cast to QueryClient). Cover each behavior bullet. For the predicate bullet, find the call whose argument has a `predicate` and call it with fake `{ queryKey }` objects.
    Commit the test and the implementation together in one commit. The pre-commit hook runs the full vitest suite, so a commit with only the failing (RED) test is blocked.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/issue-detail-refresh.test.ts</automated>
  </verify>
  <done>Helper exported; test passes; stage ordering and linked-MR predicate proven.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Refresh button in IssueDetailContent action row, wired from IssueDetailView</name>
  <files>taskflow/src/routes/dashboard/IssueDetailContent.tsx, taskflow/src/routes/dashboard/IssueDetailContent.test.tsx, taskflow/src/routes/dashboard/IssueDetailView.tsx</files>
  <behavior>
    - With onRefresh passed, a button with accessible name "Refresh issue" renders in the action row, before the Pin button in DOM order.
    - Clicking it calls onRefresh once.
    - With refreshing=true the button is disabled and its svg has the animate-spin class. With refreshing=false the svg has no animate-spin.
    - Without onRefresh, no "Refresh issue" button renders, so existing callers and tests are unaffected.
  </behavior>
  <action>
    IssueDetailContent.tsx: add optional props `onRefresh?: () => void` and `refreshing?: boolean`, each with a one-line doc comment, and add `RefreshCw` to the lucide import.
    At the start of the action row (line ~392, before the Pin Button), render the button only when onRefresh is set. Copy the ReleaseHeader/CycleHeader markup exactly: a bare `<button type="button">` with className `inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground`, `disabled={refreshing}`, `aria-label="Refresh issue"`, `title="Refresh issue"`, and child `<RefreshCw className={refreshing ? 'size-3 animate-spin' : 'size-3'} />`.
    The row is `justify-end` around h-8 outline buttons, so the bare icon has to sit vertically centred: change the row div to `flex items-center justify-end gap-2`. Make no other style changes.
    Add no "Refreshed: HH:MM" timestamp. The action row is already full in the narrow peek panel, and ReleaseHeader hides its timestamp at narrow widths anyway.
    Update the row comment to "Refresh + Pin + Edit + ...".
    IssueDetailView.tsx: add `const [refreshing, setRefreshing] = useState(false)` and a `handleRefresh` copied from the ReleaseDetailPage pattern. It sets refreshing to true, calls `void refreshIssueDetail(queryClient, { issueKey, jiraBaseUrl }).finally(() => setRefreshing(false))`, and returns early when issueKey is missing.
    Pass `onRefresh={handleRefresh}` and `refreshing={refreshing}` to the shared `<IssueDetailContent>` node. Place `queryClient` (line ~311) before its use if needed; do not create a second useQueryClient.
    Add tests to IssueDetailContent.test.tsx in a new `describe('refresh button')`. Reuse the file's existing props fixture and wrapper; userEvent or fireEvent, whichever the file already uses. Cover each behavior bullet.
    Run biome only on the touched files (never `biome --write` on all of src). Commit tests and implementation together.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/IssueDetailSheet.test.tsx src/routes/dashboard/IssueDetailPage.progressive.test.tsx src/lib/issue-detail-refresh.test.ts && npx biome check src/lib/issue-detail-refresh.ts src/lib/issue-detail-refresh.test.ts src/routes/dashboard/IssueDetailContent.tsx src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/IssueDetailView.tsx && npx tsc --noEmit -p .</automated>
  </verify>
  <done>Refresh button visible on the full page and in the peek, styled like the Release/Cycle detail buttons, spinning while refreshIssueDetail runs. New and existing issue-detail tests pass; biome is clean on the touched files; tsc is clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client -> Jira/GitLab/AIO REST | the refresh re-issues existing authenticated GETs; no new endpoints or inputs |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-mmg-01 | Denial of Service | Refresh button spam | mitigate | button `disabled={refreshing}` until the two-stage promise settles; invalidateQueries refetches only active queries |
| T-mmg-02 | Information Disclosure | linked-MR invalidation | accept | predicate scopes to this issueKey; same data the user already sees, no new disclosure |
</threat_model>

<verification>
- Unit tests above pass; the full suite passes via the pre-commit hook.
- Manual check: open /issue/KEY and a peek panel. The muted refresh icon sits left of Pin, spins on
  click, and comments, changelog and subtasks reload.
</verification>

<success_criteria>
- One refresh control, the same markup as the Release and AIO cycle detail headers, on both issue-detail surfaces.
- Refresh order is upstream-first (issue, then all dependent sections), proven by test.
- No new style primitives; no unrelated file edits.
</success_criteria>

<output>
Create `.planning/quick/261109-mmg-issue-detail-refresh-button/261109-mmg-SUMMARY.md` when done
</output>
