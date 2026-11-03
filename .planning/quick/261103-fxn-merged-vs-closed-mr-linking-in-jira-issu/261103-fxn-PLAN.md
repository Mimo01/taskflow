---
phase: quick-261103-fxn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/gitlab.ts
  - taskflow/src/services/gitlab.test.ts
  - taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.ts
  - taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/MergeRequestsSection.tsx
  - taskflow/src/routes/dashboard/IssueDetailView.tsx
autonomous: true
requirements: [QUICK-261103-fxn]

must_haves:
  truths:
    - "Jira issue detail lists every MR linked to the issue (key in title or source branch) whatever its state: opened, merged and closed"
    - "Whether an MR shows no longer depends on it being one of the project's 20 most recently updated MRs"
    - "A closed MR's badge reads 'Closed' (capitalised), merged reads 'Merged', opened reads 'Open'"
    - "Opening an issue costs one GitLab request (no project-wide fetch, no per-branch fan-out)"
    - "An MR for ABC-123 does not show on ABC-12 (exact key match is kept)"
  artifacts:
    - path: "taskflow/src/services/gitlab.ts"
      provides: "fetchIssueLinkedMRs server-side per-issue search"
      exports: ["fetchIssueLinkedMRs"]
    - path: "taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.ts"
      provides: "per-issue query key + exact-key filter, same return shape"
    - path: "taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.test.tsx"
      provides: "hook regression test: merged + closed + opened returned, false positive dropped"
  key_links:
    - from: "taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.ts"
      to: "fetchIssueLinkedMRs"
      via: "useQuery queryFn"
      pattern: "fetchIssueLinkedMRs\\("
    - from: "fetchIssueLinkedMRs"
      to: "/projects/:id/merge_requests"
      via: "state=all&search=KEY&in=title,description"
      pattern: "state=all.*search=.*in=title,description"
---

<objective>
Fix: in Jira issue detail, closed MRs show as linked but older merged ones don't. Root cause (orchestrator-verified) is NOT a state filter — `useLinkedMRs` fetches one page of the project's 20 most recently updated MRs (all states) and filters by issue key client-side, so visibility depends on recency (the "fetch-once page-cap pitfall" recurring in this repo). Locked decision: ALL linked MRs show regardless of state.

Approach (performance-first): replace the project-wide capped fetch with ONE per-issue server-side query `GET /projects/:id/merge_requests?state=all&search=<KEY>&in=title,description&per_page=100`, then keep the existing exact-key client filter (title OR source_branch via `extractTicketKeys`) to drop substring false positives.

Purpose: consistent, correct linking at one request per opened issue.
Output: `fetchIssueLinkedMRs` in services/gitlab.ts, rewritten `useLinkedMRs`, 'Closed' badge label, tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/STATE.md
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.ts
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/issue-detail/MergeRequestsSection.tsx

Repo layout: `.planning` + git at outer `/Users/mimo/Documents/Projects/taskflow`; src/npm/vitest/biome run in inner `/Users/mimo/Documents/Projects/taskflow/taskflow`.

Key facts gathered during planning (no need to re-explore):
- `searchGitLabMRs` (services/gitlab.ts ~2301) is the model for a never-throw fetcher: `apiFetch('gitlab', url, { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } }, 'Load Merge Requests')`, returns `[]` on transport error / non-ok, then maps string labels to `{ name, color: '#6b7280', text_color: '#FFFFFF' }`. Copy that label mapping; do NOT add the project-labels colour-enrichment request from `fetchProjectMRs` — MergeRequestsSection renders no labels, so it would be a wasted second request.
- `fetchSourceBranchMRs` (~1926) shows `encodeURIComponent` on user-controlled query values and the WR-05 pattern (own try around `response.json()` + `Array.isArray` guard). Apply both, but return `[]` instead of throwing (callers in the sidebar must never error).
- `GitLabMR` has `title`, `source_branch`, `state: 'opened'|'closed'|'merged'|'locked'`; no `description` field — do not add one.
- `useLinkedMRs` is called from both `IssueDetailSidebar.tsx:50` and `IssueDetailView.tsx:110` with the same issueKey; TanStack still dedupes them because the new key is identical for both calls.
- `MergeRequestListPage.tsx:80` uses `['gitlab-project-mrs', projectId, stateFilter]` — the new key must NOT start with `'gitlab-project-mrs'`.
- gitlab.test.ts mocks `@tauri-apps/plugin-http` `fetch` (see the `searchGitLabMRs` / `fetchSourceBranchMRs` describe blocks for URL-assertion style). Hook-test pattern: `useEpicProgressQueries.test.tsx` (renderHook + QueryClientProvider retry:false, `vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => authState }))`, `vi.mock('@/services/stronghold', ...)`).
- Pre-commit hook runs the full vitest suite: write tests and implementation together, ONE commit per task (no separate RED commit). Never run `biome --write` on all of src — only on the touched files.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add fetchIssueLinkedMRs server-side per-issue fetcher</name>
  <files>taskflow/src/services/gitlab.ts, taskflow/src/services/gitlab.test.ts</files>
  <behavior>
    - Requests exactly one URL: `{base}/api/v4/projects/{projectId}/merge_requests?state=all&search={encodeURIComponent(issueKey)}&in=title,description&per_page=100` (trailing slash on baseUrl stripped)
    - Returns the parsed MR array with string labels mapped to gray GitLabLabel objects
    - Returns [] on: apiFetch rejection, non-ok status (incl. 401/403), json() rejection, non-array body (e.g. `{ message: '...' }`)
    - Does not apply any state filter of its own: opened, merged, closed all pass through
  </behavior>
  <action>
    Add an exported `fetchIssueLinkedMRs(baseUrl: string, token: string, projectId: number | string, issueKey: string): Promise<GitLabMR[]>` directly after `searchGitLabMRs`, with a JSDoc that states: why it exists (replaces the 20-most-recent capped fetch in useLinkedMRs — fetch-once page-cap pitfall; do not revert to a project-wide page + client filter), that `state=all` is deliberate (locked decision: all linked MRs show regardless of state), that GitLab's `search` with `in=title,description` does NOT cover source_branch so an MR whose key appears ONLY in its branch name (not title or description) is not found — accepted trade-off to keep one request per issue (a branch lookup would need repository/branches?search plus one source_branch query per hit, and merged MRs' branches are usually deleted so it would not even help the merged case this fix targets), and that the caller must still exact-match keys because GitLab search is a substring match (ABC-12 matches ABC-123). per_page=100 single page is acceptable here because the result set is already scoped to one issue key; mention that in the JSDoc so a reviewer does not flag it as the page-cap pitfall. Implementation follows the searchGitLabMRs never-throw shape plus the fetchSourceBranchMRs WR-05 json/array guard, returning [] on every failure path; normalise string labels with the gray default exactly as searchGitLabMRs does. Encode issueKey with encodeURIComponent. Add a `describe('fetchIssueLinkedMRs (261103-fxn)')` block in gitlab.test.ts covering every behavior bullet (assert the full URL string, label mapping, merged+closed+opened passthrough, and each [] failure path); add the import to the existing import list.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/services/gitlab.test.ts -t fetchIssueLinkedMRs && npx tsc --noEmit -p . && npx biome check src/services/gitlab.ts src/services/gitlab.test.ts</automated>
  </verify>
  <done>fetchIssueLinkedMRs exported, URL contains state=all, search=KEY, in=title,description, per_page=100; all new tests pass; tsc and biome clean on the two files; one commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Switch useLinkedMRs to the per-issue query, add 'Closed' label, fix stale comments</name>
  <files>taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.ts, taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.test.tsx, taskflow/src/routes/dashboard/issue-detail/MergeRequestsSection.tsx, taskflow/src/routes/dashboard/IssueDetailView.tsx</files>
  <behavior>
    - With fetchIssueLinkedMRs mocked to return an opened, a merged and a closed MR all titled/branched with 'ABC-123', plus one titled 'ABC-1234 something' and one with key only in description (title/branch without ABC-123): hook for 'ABC-123' returns exactly the opened, merged and closed MRs
    - An MR whose key is only in source_branch (e.g. 'feature/ABC-123-x') and that the server returned is kept
    - fetchIssueLinkedMRs is called once with (gitlabBaseUrl, 'tok', activeGitlabProject, 'ABC-123')
    - Two hook instances for the same issueKey in one QueryClient trigger one fetch (dedupe preserved)
    - No fetch when gitlabConnected is false or activeGitlabProject is unset; linkedMRs is [] then
    - Return shape unchanged: { linkedMRs, mrsLoading, gitlabConnected, gitlabBaseUrl }
  </behavior>
  <action>
    In useLinkedMRs.ts: remove the inline apiFetch URL build and the apiFetch import; queryFn reads the 'gitlab-pat' secret as today (return [] when token/baseUrl/project missing) and calls `fetchIssueLinkedMRs(gitlabBaseUrl, token, activeGitlabProject, issueKey)`. New query key `['gitlab-issue-linked-mrs', gitlabBaseUrl, activeGitlabProject, issueKey]` (must not start with 'gitlab-project-mrs', which MergeRequestListPage uses with a different shape). Keep `staleTime: 60_000`; add `!!issueKey` to `enabled`. Keep the existing exact-key client filter (extractTicketKeys on title OR source_branch) — it now removes substring false positives from GitLab search and description-only mentions; comment it as such. Rewrite the hook's JSDoc: one server-side request per issue (state=all, so opened/merged/closed all show — 261103-fxn locked decision), the key includes issueKey and TanStack dedupes the sidebar + single-column-layout calls because both pass the same issueKey, and the branch-only limitation (point to fetchIssueLinkedMRs JSDoc). In IssueDetailView.tsx ~lines 108-109, replace the stale comment that cites `['gitlab-project-mrs', ...]` with one saying it dedupes with IssueDetailSidebar via the shared per-issue key `['gitlab-issue-linked-mrs', ..., issueKey]`; no code change there. In MergeRequestsSection.tsx line ~46, make the badge text render 'Closed' for state 'closed' (keep 'Merged' / 'Open'; any other state such as 'locked' falls back to capitalising the first letter rather than raw lowercase). Create useLinkedMRs.test.tsx following the useEpicProgressQueries.test.tsx pattern (mock '@/stores/auth.store' with a mutable authState containing gitlabBaseUrl, gitlabConnected, activeGitlabProject; mock '@/services/stronghold' readSecret → 'tok'; vi.mock '@/services/gitlab' fetchIssueLinkedMRs) covering every behavior bullet. Use placeholder keys/names only (ABC-123, example.com) — no customer data. Run biome check only on the four touched files.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail/useLinkedMRs.test.tsx src/services/gitlab.test.ts && npx tsc --noEmit -p . && npx biome check src/routes/dashboard/issue-detail/useLinkedMRs.ts src/routes/dashboard/issue-detail/useLinkedMRs.test.tsx src/routes/dashboard/issue-detail/MergeRequestsSection.tsx src/routes/dashboard/IssueDetailView.tsx && ! grep -n "gitlab-project-mrs\|per_page=20" src/routes/dashboard/issue-detail/useLinkedMRs.ts src/routes/dashboard/IssueDetailView.tsx</automated>
  </verify>
  <done>Hook uses fetchIssueLinkedMRs under the per-issue key; merged, closed and opened linked MRs all returned; ABC-1234 false positive excluded; 'Closed' badge label; stale dedupe comments updated; no 'gitlab-project-mrs' / per_page=20 left in the hook or IssueDetailView; tests, tsc, biome (touched files) clean; one commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira issue key → GitLab URL query string | issueKey comes from route/Jira data and is interpolated into a GitLab request |
| GitLab response → UI | JSON body from GitLab (or an SSO/proxy interstitial) is rendered in the sidebar |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-fxn-01 | Tampering | fetchIssueLinkedMRs URL build | mitigate | encodeURIComponent(issueKey) so '&'/'#'/'/' cannot inject extra query params |
| T-fxn-02 | Information disclosure / DoS | fetchIssueLinkedMRs response parse | mitigate | own try around response.json() + Array.isArray guard; return [] so an HTML or {message} body never spreads into MR list or surfaces body text |
| T-fxn-03 | Spoofing | MR list display | accept | exact-key filter via extractTicketKeys prevents substring matches; MR content is from the user's own authenticated GitLab |
</threat_model>

<verification>
- `npx vitest run src/services/gitlab.test.ts src/routes/dashboard/issue-detail/useLinkedMRs.test.tsx` passes
- `npx tsc --noEmit -p .` clean
- Manual (UAT by orchestrator/user): open a Jira issue with an older merged MR and a closed MR — both appear, closed badge reads 'Closed'
</verification>

<success_criteria>
- All linked MRs (opened, merged, closed) show in issue detail regardless of project-wide recency
- One GitLab request per opened issue; sidebar + single-column layout share it
- No regression in exact-key matching; hook return shape unchanged
</success_criteria>

<output>
Create `/Users/mimo/Documents/Projects/taskflow/.planning/quick/261103-fxn-merged-vs-closed-mr-linking-in-jira-issu/261103-fxn-SUMMARY.md` when done
</output>
