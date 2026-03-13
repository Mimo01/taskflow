---
phase: quick-12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/gitlab.ts
  - taskflow/src/routes/dashboard/MyTasksTab.tsx
  - taskflow/src/routes/dashboard/MrAttentionTab.tsx
  - taskflow/src/routes/dashboard/MyTasksTab.test.tsx
autonomous: true
requirements: [QUICK-12]
must_haves:
  truths:
    - "MRs whose title/commits reference a user's Jira sprint issue key appear in MyTasksTab even when user is not a GitLab assignee or reviewer"
    - "MyTasksTab uses the authenticated user's real GitLab ID (not hardcoded 0) when fetching reviewer MRs"
    - "MyTasksTab and MrAttentionTab share the same gitlab-mrs TanStack cache entry"
    - "MrAttentionTab also picks up project-level MRs linked to the user's Jira issues"
  artifacts:
    - path: "taskflow/src/services/gitlab.ts"
      provides: "fetchProjectMRs function — GET /api/v4/projects/{id}/merge_requests?state=opened"
      exports: ["fetchProjectMRs"]
    - path: "taskflow/src/routes/dashboard/MyTasksTab.tsx"
      provides: "Correct userId resolution, updated query key, project MR inclusion"
    - path: "taskflow/src/routes/dashboard/MrAttentionTab.tsx"
      provides: "Project MR pool merged into the base fetch"
  key_links:
    - from: "MyTasksTab gitlab-mrs query"
      to: "MrAttentionTab gitlab-mrs query"
      via: "Shared queryKey ['gitlab-mrs', gitlabBaseUrl, userId]"
    - from: "fetchProjectMRs"
      to: "fullLinkMap in MyTasksTab"
      via: "Project MRs added to gitlabMrs pool; linkMRToTask filters to only those matching sprint keys"
---

<objective>
Fix two related bugs in the MR-to-Jira-task mapping:

1. **Empty array on first fetch:** `MyTasksTab` calls `fetchReviewerMRs` with hardcoded `userId=0` instead of the authenticated user's real GitLab ID. It also uses a different TanStack query key (`['gitlab-mrs', gitlabBaseUrl]`) than `MrAttentionTab` (`['gitlab-mrs', gitlabBaseUrl, userId]`), so they never share cache — causing duplicate fetches and the first fetch returning an empty/wrong reviewer list.

2. **Assignee not required:** Both tabs only fetch MRs where the user is a GitLab assignee or reviewer. An MR that references a user's Jira ticket key (in title or commits) should appear even if the user is not a GitLab assignee. Fix: also fetch all open MRs for the active GitLab project and include any whose title/commits match a sprint issue key already in the user's task list.

Purpose: Developers can see all relevant MRs linked to their Jira tasks without needing to be GitLab assignees.
Output: Updated `gitlab.ts`, `MyTasksTab.tsx`, `MrAttentionTab.tsx`, updated tests.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add fetchProjectMRs to gitlab.ts and fix MyTasksTab userId + query key</name>
  <files>taskflow/src/services/gitlab.ts, taskflow/src/routes/dashboard/MyTasksTab.tsx, taskflow/src/routes/dashboard/MyTasksTab.test.tsx</files>
  <behavior>
    - fetchProjectMRs(baseUrl, token, projectId): returns GitLabMR[] for GET /api/v4/projects/{projectId}/merge_requests?state=opened&per_page=100. Same error-handling pattern as fetchAssignedMRs.
    - MyTasksTab: resolve userId via validateGitLab (same useQuery pattern as MrAttentionTab — queryKey ['gitlab-current-user', gitlabBaseUrl], staleTime: Infinity). Add userId to enabled guard and to gitlabMrs queryKey: ['gitlab-mrs', gitlabBaseUrl, userId] (matches MrAttentionTab so both tabs share cache).
    - MyTasksTab: pass userId (not 0) to fetchReviewerMRs. Guard: `userId ? fetchReviewerMRs(..., userId) : Promise.resolve([])`.
    - MyTasksTab gitlabMrs queryFn: additionally call fetchProjectMRs(gitlabBaseUrl!, token, activeGitlabProject!) when activeGitlabProject is set, deduplicate merged result by iid. Project MRs are included in the pool; the existing linkMRToTask / fullLinkMap logic already filters to only those matching sprint issue keys — so unrelated project MRs won't appear.
    - New test in MyTasksTab.test.tsx: "includes project-level MR linked to user sprint task even when user is not assignee/reviewer" — mock fetchProjectMRs returning an MR with title containing a sprint issue key; verify it appears as a linked MR on that task row.
  </behavior>
  <action>
    **gitlab.ts** — add after fetchReviewerMRs (before the comments block):

    ```ts
    export async function fetchProjectMRs(
      baseUrl: string,
      token: string,
      projectId: number,
    ): Promise<GitLabMR[]> {
      const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/merge_requests?state=opened&per_page=100`;
      let response: Response;
      try {
        response = await apiFetch('gitlab', url, {
          headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        });
      } catch {
        throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch project MRs: status ${response.status}`);
      }
      const data = await response.json();
      return data as GitLabMR[];
    }
    ```

    **MyTasksTab.tsx** — changes:
    1. Import `validateGitLab` and `fetchProjectMRs` from `@/services/gitlab`.
    2. Add `activeGitlabProject` to the `useAuthStore` destructure.
    3. Add `currentUser` query (identical to MrAttentionTab): `useQuery({ queryKey: ['gitlab-current-user', gitlabBaseUrl], queryFn: () => validateGitLab(gitlabBaseUrl!, gitlabToken!), staleTime: Infinity, enabled: !!gitlabBaseUrl && !!gitlabToken })`. Derive `const userId = currentUser?.id`.
    4. Update gitlabMrs query: change `queryKey` to `['gitlab-mrs', gitlabBaseUrl, userId]`; change `enabled` to `!!gitlabBaseUrl && !!gitlabToken && !!userId`; inside queryFn replace the hardcoded `0` with `userId` and add `fetchProjectMRs` call — the Promise.all becomes three entries when `activeGitlabProject` is set:
       ```ts
       const [assigned, reviewer, projectMrs] = await Promise.all([
         fetchAssignedMRs(gitlabBaseUrl!, token),
         fetchReviewerMRs(gitlabBaseUrl!, token, userId!),
         activeGitlabProject
           ? fetchProjectMRs(gitlabBaseUrl!, token, activeGitlabProject)
           : Promise.resolve([]),
       ])
       const seen = new Set<number>()
       return [...assigned, ...reviewer, ...projectMrs].filter(
         (mr) => !seen.has(mr.iid) && seen.add(mr.iid),
       )
       ```
       Note: the fullLinkMap memo already only includes MRs whose title/commit keys match sprint issue keys — project MRs with no Jira reference are silently ignored.

    **MyTasksTab.test.tsx** — add mock for `fetchProjectMRs` in the gitlab mock (return `[]` by default). Add test:
    ```
    it('includes project-level MR in link map when MR title references a sprint task', async () => {
      // fetchAssignedMRs/fetchReviewerMRs return empty; fetchProjectMRs returns MR with PROJ-1 in title
      // sprint issue PROJ-1 in jira; linkMRToTask returns PROJ-1 for that MR
      // expect "MR !99" to appear on the PROJ-1 task row
    })
    ```
    Also update existing test mocks: add `fetchProjectMRs: vi.fn().mockResolvedValue([])` and `validateGitLab: vi.fn().mockResolvedValue({ id: 42, name: 'Test User', username: 'testuser' })` (it's already mocked for gitlab service).
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/MyTasksTab.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>
    - fetchProjectMRs exported from gitlab.ts
    - MyTasksTab uses userId (not 0) in reviewer fetch
    - MyTasksTab query key is ['gitlab-mrs', gitlabBaseUrl, userId] — matches MrAttentionTab
    - MyTasksTab fetches project MRs and merges into pool
    - All existing MyTasksTab tests pass
    - New test for project-level MR linking passes
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend MrAttentionTab with project-level MR pool</name>
  <files>taskflow/src/routes/dashboard/MrAttentionTab.tsx, taskflow/src/routes/dashboard/MrAttentionTab.test.tsx</files>
  <action>
    MrAttentionTab already resolves userId correctly and uses the right queryKey. Only change: add project MRs to the merged pool so Jira-linked MRs that don't have the user as reviewer/assignee still appear.

    In the gitlab-mrs queryFn, add `activeGitlabProject` to the destructure from `useAuthStore`. Import `fetchProjectMRs` from `@/services/gitlab`. Inside the queryFn's Promise.all, add:
    ```ts
    activeGitlabProject
      ? fetchProjectMRs(gitlabBaseUrl!, token, activeGitlabProject)
      : Promise.resolve([]),
    ```
    Rename the destructure to `[assigned, reviewer, projectMrs]`. Include `...projectMrs` in the merged dedup array before the `assigned/reviewer` distinction (so assignedIids check still works — project MRs not in `assigned` will be subject to the reviewer discussion filter unless they link via subtask path).

    Wait — to keep the behavior consistent: project MRs that aren't assigned to the user go through the same `filteredMrs` discussion check (only included if unresolved discussions exist or subtask-linked). This is correct — we don't want to flood the attention tab with all project MRs. The subtask path in `data` useMemo already handles the bypass for Jira-linked ones.

    Actually, for MrAttentionTab the goal is: show MRs that need the developer's attention. A project MR that references their Jira ticket is relevant — they should see it. These should bypass the discussion filter the same way subtask-linked MRs do. Add a third bypass: project MRs that link (via title) to a sprint issue key from `sprintIssueKeySet` or a task key in `myIssueKeys` are included unconditionally.

    Implementation: After building `merged` (assigned + reviewer + projectMrs deduped), determine `sprintLinkedKeys` from `sprintIssueKeySet` (available after `sprintIssues` query). For the `filteredMrs` Promise.all, add a third condition alongside `assignedIids.has(mr.iid)`:
    ```ts
    if (assignedIids.has(mr.iid)) return mr // always include assigned
    // Include unconditionally if MR title references a sprint issue key
    if (linkMRToTask(mr, sprintIssueKeySet) !== null) return mr
    ```
    Note: `sprintIssueKeySet` is derived from `sprintIssues` which is a separate query. To use it inside the `queryFn`, we need to pass it as a parameter or read from queryClient. Simpler: do the sprint-link inclusion outside the queryFn in the `data` useMemo (similar to how subtask extras are added). Add a separate filter step that adds project MRs linked to sprint keys that weren't already included. This keeps the queryFn pure.

    Concrete approach: Inside the `data` useMemo, after building `[...base, ...extras]` (subtask path), add another pass for project MRs:
    - The `mrQueryData.merged` already contains project MRs (after Task 1's queryFn change mirrors here)
    - For each mr in `merged` not already in the list, check `linkMRToTask(mr, sprintIssueKeySet) !== null` → include

    Update MrAttentionTab.test.tsx: add `fetchProjectMRs: vi.fn().mockResolvedValue([])` to the gitlab mock. Add a test: "includes project MR linked to sprint issue key even without GitLab assignment" — mock fetchProjectMRs returning an MR with a sprint key in the title; mock fetchSprintIssues returning that issue; verify MR appears.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/MrAttentionTab.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>
    - MrAttentionTab fetches project MRs in its queryFn
    - Project MRs linked to sprint issue keys appear in the MR list (bypassing the discussion filter)
    - All existing MrAttentionTab tests pass
    - New test for project-level sprint-linked MR passes
  </done>
</task>

<task type="auto">
  <name>Task 3: Full test suite pass</name>
  <files></files>
  <action>
    Run the complete vitest suite to confirm no regressions across linkEngine, jira, gitlab, and all dashboard tabs. Fix any TypeScript compilation errors that surface (e.g., missing import of fetchProjectMRs or unused variable warnings).
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run --reporter=verbose 2>&1 | tail -40</automated>
  </verify>
  <done>All tests pass. No TypeScript errors in the modified files.</done>
</task>

</tasks>

<verification>
- `fetchProjectMRs` is exported from gitlab.ts and follows the same auth/error pattern as other fetch functions
- MyTasksTab query key `['gitlab-mrs', gitlabBaseUrl, userId]` matches MrAttentionTab — TanStack deduplicates concurrent fetches between tabs
- MyTasksTab calls `fetchReviewerMRs` with `userId` (not `0`) — reviewer MRs for the correct user are fetched
- Both tabs include project-level MRs in their pool; link filtering ensures only Jira-key-matched MRs surface to users
- Full vitest suite passes
</verification>

<success_criteria>
- An MR with a sprint issue key in its title appears in MyTasksTab even when the user is not the GitLab assignee or reviewer
- The first fetch in MyTasksTab returns the correct reviewer MRs (not an empty list due to userId=0)
- No duplicate API calls between MyTasksTab and MrAttentionTab when both are mounted (shared TanStack cache entry)
- All existing tests continue to pass
</success_criteria>

<output>
After completion, create `.planning/quick/12-fix-mr-to-jira-task-mapping-empty-array-/12-SUMMARY.md`
</output>
