---
phase: quick-260323-gog
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/gitlab.ts
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
autonomous: true
requirements: [MATCH-JIRA-MR, MISSING-MR-BADGE, UNMATCHED-MR-SECTION, JIRA-PROGRESS]

must_haves:
  truths:
    - "Release detail page shows a table of Jira issues for this fix version"
    - "Each Jira issue row shows its matched GitLab MR (from milestone) or an orange warning badge if missing"
    - "A separate bottom section lists MRs in the milestone that are not linked to any Jira issue"
    - "Progress bar is driven by Jira issue status categories (done/total)"
  artifacts:
    - path: "taskflow/src/services/gitlab.ts"
      provides: "fetchMilestoneMRs function to get MRs by milestone title"
      exports: ["fetchMilestoneMRs"]
    - path: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      provides: "Jira issues table with MR matching, missing MR badges, unmatched MR section"
      min_lines: 200
  key_links:
    - from: "ReleaseDetailPage.tsx"
      to: "gitlab.ts fetchMilestoneMRs"
      via: "useQuery fetching MRs for matched milestone"
      pattern: "fetchMilestoneMRs"
    - from: "ReleaseDetailPage.tsx"
      to: "linkEngine.ts linkMRToTask"
      via: "matching MRs to Jira issue keys"
      pattern: "linkMRToTask"
    - from: "ReleaseDetailPage.tsx"
      to: "jira.ts (search API)"
      via: "useQuery fetching issues with fixVersion JQL"
      pattern: "fixVersion.*versionId"
---

<objective>
Add Jira issue list with GitLab MR matching to the Release Detail Page. Each Jira issue in the fix version is shown in a table, matched against MRs from the linked GitLab milestone using linkEngine. Tasks missing MRs get orange warning badges; MRs not linked to any Jira task appear in a separate bottom section with blue info badges. Progress bar remains Jira-driven (done/total).

Purpose: Let developers see at a glance which Jira tasks have MRs and which don't, plus any orphan MRs in the milestone.
Output: Updated ReleaseDetailPage with issue-MR matching UI.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
@taskflow/src/services/linkEngine.ts
@taskflow/src/services/releaseLinker.ts
@taskflow/src/services/gitlab.ts
@taskflow/src/services/jira.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From taskflow/src/services/jira.ts:
```typescript
export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: {
      id: string;
      name: string;
      statusCategory?: { key: 'new' | 'indeterminate' | 'done' };
    };
    assignee: { displayName: string; avatarUrls: { '48x48': string } } | null;
    issuetype: { name: string; subtask: boolean; };
    // ... other fields
  };
}

export interface JiraFixVersion {
  id: string;
  name: string;
  releaseDate?: string;
  released: boolean;
  description?: string;
}
```

From taskflow/src/services/gitlab.ts:
```typescript
export interface GitLabMR {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  source_branch: string;
  state: 'opened' | 'closed' | 'merged' | 'locked';
  author: { id: number; name: string; username: string; avatar_url: string };
  web_url: string;
  milestone: { id: number; title: string } | null;
}

export interface GitLabMilestone {
  id: number;
  iid: number;
  title: string;
  due_date: string | null;
  web_url: string;
}

// Existing: fetchProjectMRs(baseUrl, token, projectId, state) — fetches all MRs, no milestone filter
```

From taskflow/src/services/linkEngine.ts:
```typescript
export function extractTicketKeys(text: string): string[];
export function linkMRToTask(mr: GitLabMR, sprintIssueKeys: Set<string>): string | null;
```

From taskflow/src/services/releaseLinker.ts:
```typescript
export type ReleaseMatchType = 'exact' | 'fuzzy' | 'none';
export interface ReleaseMatch {
  type: ReleaseMatchType;
  candidateName: string;
  candidateUrl: string;
}
```

Existing patterns in ReleaseDetailPage.tsx:
- Uses `readSecret('jira-pat')` and `readSecret('gitlab-pat')` for auth
- Uses `useAuthStore()` for `jiraBaseUrl`, `activeJiraProject`, `gitlabBaseUrl`, `activeGitlabProject`
- Uses `@tauri-apps/plugin-http` `fetch` for direct Jira calls (see `fetchVersionIssueCounts`)
- Uses `apiFetch` in service modules for instrumented calls
- Already has `gitlabMatch` with milestone name/URL from releaseLinker
- Already has `issueCounts` with done/total from `fetchVersionIssueCounts`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add fetchMilestoneMRs to gitlab.ts and fetchFixVersionIssues to ReleaseDetailPage</name>
  <files>taskflow/src/services/gitlab.ts, taskflow/src/routes/dashboard/ReleaseDetailPage.tsx</files>
  <action>
**gitlab.ts — add fetchMilestoneMRs:**

Add a new exported function after `fetchProjectMRs` (~line 767):

```typescript
export async function fetchMilestoneMRs(
  baseUrl: string,
  token: string,
  projectId: number,
  milestoneTitle: string,
): Promise<GitLabMR[]> {
```

Use the GitLab API `GET /projects/:id/merge_requests?milestone=:title&state=all&per_page=100` (the milestone param accepts the milestone title string). Use `apiFetch('gitlab', ...)` with `PRIVATE-TOKEN` header, same pattern as `fetchProjectMRs`. Return `GitLabMR[]`. Include label color enrichment same as `fetchProjectMRs` does (copy the label enrichment block). Handle pagination if needed (check `data.length < perPage`).

**ReleaseDetailPage.tsx — add fetchFixVersionIssues helper:**

Add a module-level async helper (similar to `fetchVersionIssueCounts`) that fetches Jira issues for a fix version:

```typescript
async function fetchFixVersionIssues(
  baseUrl: string,
  token: string,
  versionId: string,
): Promise<JiraIssue[]> {
```

Use JQL: `fixVersion = ${versionId} AND issuetype not in subtaskIssueTypes() ORDER BY rank ASC`. Fields: `summary,status,assignee,issuetype`. Use `@tauri-apps/plugin-http` `fetch` directly (matching existing `fetchVersionIssueCounts` pattern in this file — NOT `apiFetch` since the page currently uses direct fetch for its Jira calls). Import `JiraIssue` type from `@/services/jira`. Paginate using `startAt` + `maxResults=200` pattern, collecting all issues. Return `JiraIssue[]`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>fetchMilestoneMRs exported from gitlab.ts; fetchFixVersionIssues helper in ReleaseDetailPage.tsx; TypeScript compiles clean</done>
</task>

<task type="auto">
  <name>Task 2: Build issue-MR matching table with missing/unmatched sections in ReleaseDetailPage</name>
  <files>taskflow/src/routes/dashboard/ReleaseDetailPage.tsx</files>
  <action>
**Add imports:** Import `linkMRToTask` from `@/services/linkEngine`, `fetchMilestoneMRs` from `@/services/gitlab`, and `AlertTriangle`, `Info`, `GitMerge` from `lucide-react`.

**Add two new useQuery hooks inside the component:**

1. `fixVersionIssues` query — enabled when `jiraBaseUrl && versionId`. queryKey: `['jira-fixversion-issues', versionId]`. Calls `fetchFixVersionIssues`. staleTime: 5min.

2. `milestoneMRs` query — enabled when `gitlabBaseUrl && activeGitlabProject && gitlabToken && gitlabMatch.type !== 'none'`. queryKey: `['gitlab-milestone-mrs', activeGitlabProject, gitlabMatch.candidateName]`. Calls `fetchMilestoneMRs(gitlabBaseUrl, gitlabToken, activeGitlabProject, gitlabMatch.candidateName)`. staleTime: 5min.

**Add useMemo for matching logic:**

```typescript
const { matchedRows, unmatchedMRs } = useMemo(() => {
  const issues = fixVersionIssues ?? [];
  const mrs = milestoneMRs ?? [];
  const issueKeySet = new Set(issues.map(i => i.key));

  // Map: issueKey -> GitLabMR
  const mrByIssue = new Map<string, GitLabMR>();
  const unmatched: GitLabMR[] = [];

  for (const mr of mrs) {
    const matchedKey = linkMRToTask(mr, issueKeySet);
    if (matchedKey) {
      mrByIssue.set(matchedKey, mr);
    } else {
      unmatched.push(mr);
    }
  }

  const rows = issues.map(issue => ({
    issue,
    mr: mrByIssue.get(issue.key) ?? null,
  }));

  return { matchedRows: rows, unmatchedMRs: unmatched };
}, [fixVersionIssues, milestoneMRs]);
```

Import `type JiraIssue` from `@/services/jira` and `type GitLabMR` from `@/services/gitlab`.

**Replace the existing "Issues" section** (the `<section>` at ~line 354-376 that shows issue counts + progress bar) with an expanded section containing:

1. **Header row:** "Issues" heading with count badge `{issueCounts?.issuesFixed ?? 0} / {issueCounts?.issuesTotal ?? 0} done`

2. **Progress bar** (keep existing progress bar code as-is, driven by issueCounts)

3. **Issues table** — a compact table with columns: Key, Summary, Status, MR. Use `<table className="w-full text-sm">` with subtle borders.
   - Key column: `issue.key` as monospace text
   - Summary column: `issue.fields.summary` truncated with `line-clamp-1`
   - Status column: colored badge — green bg for `statusCategory.key === 'done'`, blue for `indeterminate`, gray for `new`
   - MR column: if `row.mr` exists, show a link (`<button onClick={() => openUrl(row.mr.web_url)}>`) with `GitMerge` icon + MR `!{iid}` text, colored by MR state (green for merged, orange for opened, gray for closed). If `row.mr` is null, show an orange `AlertTriangle` icon with `size-3.5` and tooltip-style `title="No merge request found"` plus text "Missing MR" in orange.

4. **Unmatched MRs section** — only rendered when `unmatchedMRs.length > 0`. Appears below the issues table separated by a border-top.
   - Header: `<Info className="size-3.5 text-blue-500" />` + "Unmatched MRs" + count badge `({unmatchedMRs.length})`
   - Subtitle text: `text-xs text-muted-foreground` "MRs in milestone not linked to any Jira task"
   - List each unmatched MR as a compact row: `GitMerge` icon + `!{mr.iid}` link + `mr.title` truncated + state badge (merged/opened/closed)

5. **Loading state:** While `fixVersionIssues` is loading, show a simple "Loading issues..." text with `Loader2` spinner.

6. **Empty state:** If issues array is empty after loading, show "No issues in this fix version" in muted text.

**Styling notes:**
- Table uses `border-separate border-spacing-0` with `border-b border-border/50` on rows
- Table header row uses `text-xs text-muted-foreground font-medium` with `bg-muted/30`
- Keep the existing two-column layout (left content + right sidebar) intact
- The new table goes in the left column, replacing the simple issue counts section
- Keep the sidebar issue counts MetaRow as-is (it shows the summary)
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Release detail page shows Jira issues in a table with matched MR links or orange "Missing MR" badges; unmatched MRs section appears below with blue info styling; progress bar still Jira-driven; TypeScript compiles clean</done>
</task>

</tasks>

<verification>
1. TypeScript compiles: `cd taskflow && npx tsc --noEmit`
2. Visual check: Navigate to a release detail page — issues table visible with MR matching
3. Missing MR badges: Issues without MRs show orange warning indicator
4. Unmatched MRs: MRs in milestone but not linked to Jira appear in separate section
5. Progress bar: Still shows done/total from Jira status categories
</verification>

<success_criteria>
- Release detail page displays all Jira issues for the fix version in a table
- Each issue row shows its matched GitLab MR or an orange "Missing MR" badge
- Unmatched MRs (in milestone but not linked to Jira) appear in a separate blue-badged section below
- Progress bar reflects Jira done/total counts
- No TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/260323-gog-release-detail-page-match-jira-tasks-wit/260323-gog-SUMMARY.md`
</output>
