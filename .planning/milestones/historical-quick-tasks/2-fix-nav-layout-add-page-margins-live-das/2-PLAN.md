---
phase: quick-2
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/app/Sidebar.tsx
  - taskflow/src/routes/dashboard/index.tsx
  - taskflow/src/routes/dashboard/MyTasksTab.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/routes/dashboard/MrAttentionTab.tsx
  - taskflow/src/routes/dashboard/SprintProgressTab.tsx
  - taskflow/src/routes/dashboard/WorkloadTab.tsx
  - taskflow/src/routes/dashboard/ReleasesTab.tsx
autonomous: true
requirements: [QUICK-2]

must_haves:
  truths:
    - "All 6 route tab pages have consistent p-4 page margins"
    - "Dashboard overview cards show live counts instead of static dashes"
    - "Dashboard cards show a loading state while data fetches"
    - "Dashboard cards show a muted error fallback if a fetch fails"
    - "Sidebar Work section label groups role-specific links between Dashboard and Settings"
  artifacts:
    - path: "taskflow/src/routes/dashboard/index.tsx"
      provides: "Live data dashboard with useQuery hooks for all 6 card values"
      contains: "useQuery"
    - path: "taskflow/src/components/app/Sidebar.tsx"
      provides: "Grouped sidebar: Dashboard, Work section, Settings"
      contains: "Work"
  key_links:
    - from: "taskflow/src/routes/dashboard/index.tsx"
      to: "fetchSprintIssues / fetchAssignedMRs / fetchReviewerMRs"
      via: "useQuery with same query keys as tab components"
      pattern: "queryKey.*jira-issues|queryKey.*gitlab-mrs"
    - from: "taskflow/src/routes/dashboard/index.tsx"
      to: "taskflow/src/services/stronghold.ts"
      via: "readSecret('jira-pat') / readSecret('gitlab-pat') in useEffect"
      pattern: "readSecret"
---

<objective>
Three polish fixes following quick task 1 (navigation restructure): add p-4 page margins to 6 route tab components, replace static "—" dashboard card values with live React Query data, and add a "Work" section label to the sidebar to group role-specific links.

Purpose: Route pages currently render flush against the viewport with no padding, the Dashboard overview is inert (all dashes), and the sidebar flat list gives no visual hierarchy.
Output: Consistent page margins across all pages, live dashboard metrics, sectioned sidebar.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<interfaces>
<!-- Key types and service signatures the executor needs. -->

From taskflow/src/services/jira.ts:
```typescript
export async function fetchSprintIssues(
  baseUrl: string,
  token: string,
  projectKey: string,
  assignedToMe = true,
): Promise<JiraIssue[]>

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory?: { key: string } };
    assignee: { displayName: string } | null;
    customfield_10016: number | null;  // story points
  };
}
```

From taskflow/src/services/gitlab.ts:
```typescript
export async function fetchAssignedMRs(baseUrl: string, token: string): Promise<GitLabMR[]>
export async function fetchReviewerMRs(baseUrl: string, token: string, userId: number): Promise<GitLabMR[]>
export async function validateGitLab(baseUrl: string, token: string): Promise<GitLabUser>

export interface GitLabUser { id: number; username: string; name: string; }
export interface GitLabMR { iid: number; title: string; state: string; /* ... */ }
```

From taskflow/src/services/jira.ts:
```typescript
export async function fetchFixVersions(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<{ values: JiraFixVersion[] }>

export interface JiraFixVersion {
  id: string;
  name: string;
  releaseDate?: string;  // ISO date string "YYYY-MM-DD"
  released: boolean;
}
```

Query keys used by tab components (for cache sharing):
- ['jira-issues', 'my-tasks', activeJiraProject]    — MyTasksTab (assignedToMe=true)
- ['jira-issues', 'sprint-board', activeJiraProject] — SprintProgressTab / WorkloadTab / SprintBoardTab (assignedToMe=false)
- ['gitlab-mrs', gitlabBaseUrl]                      — MrAttentionTab (assigned + reviewer MRs)
- ['gitlab-current-user', gitlabBaseUrl]             — MrAttentionTab (staleTime: Infinity)
- ['jira-fix-versions', activeJiraProject]           — ReleasesTab

Token + auth pattern (all tab components follow this):
```typescript
const { jiraBaseUrl, activeJiraProject, gitlabBaseUrl } = useAuthStore()
const [jiraToken, setJiraToken] = useState<string | null>(null)
useEffect(() => {
  if (jiraBaseUrl) readSecret('jira-pat').then(t => setJiraToken(t)).catch(() => setJiraToken(null))
}, [jiraBaseUrl])
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add p-4 margins to 6 route tab components and add Sidebar Work section</name>
  <files>
    taskflow/src/routes/dashboard/MyTasksTab.tsx,
    taskflow/src/routes/dashboard/SprintBoardTab.tsx,
    taskflow/src/routes/dashboard/MrAttentionTab.tsx,
    taskflow/src/routes/dashboard/SprintProgressTab.tsx,
    taskflow/src/routes/dashboard/WorkloadTab.tsx,
    taskflow/src/routes/dashboard/ReleasesTab.tsx,
    taskflow/src/components/app/Sidebar.tsx
  </files>
  <action>
**Tab margin changes (6 files):**

In each of the 6 tab components, find the outermost `return (` div (the root `<div className="flex flex-col ...">`) and add `p-4` to its className. Specific changes:

- MyTasksTab.tsx line 236: `<div className="flex flex-col gap-2">` → `<div className="flex flex-col gap-2 p-4">`
- SprintBoardTab.tsx line 107: `<div className="flex flex-col gap-2">` → `<div className="flex flex-col gap-2 p-4">`
- MrAttentionTab.tsx line 169: `<div className="flex flex-col gap-2">` → `<div className="flex flex-col gap-2 p-4">`
- SprintProgressTab.tsx line 87: `<div className="flex flex-col gap-3 pt-2">` → `<div className="flex flex-col gap-3 p-4">` (replace pt-2 with p-4)
- WorkloadTab.tsx line 66: `<div className="flex flex-col gap-3 pt-2">` → `<div className="flex flex-col gap-3 p-4">` (replace pt-2 with p-4)
- ReleasesTab.tsx line 192: `<div className="flex flex-col gap-3 pt-2">` → `<div className="flex flex-col gap-3 p-4">` (replace pt-2 with p-4)

**Sidebar Work section:**

In `Sidebar.tsx`, wrap the role-conditional developer and PM link blocks in a "Work" section. Replace the current `{/* Developer-only links */}` and `{/* PM-only links */}` fragments with:

```tsx
{/* Work section (role-specific) */}
{(role === 'developer' || role === 'pm') && (
  <div className="mt-2">
    <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:block">
      Work
    </p>
    {role === 'developer' && (
      <>
        <Link to="/my-tasks" className={NAV_LINK_CLASS}>
          <CheckSquare className="h-4 w-4 shrink-0" />
          <span className="hidden md:block">My Tasks</span>
        </Link>
        <Link to="/sprint-board" className={NAV_LINK_CLASS}>
          <KanbanSquare className="h-4 w-4 shrink-0" />
          <span className="hidden md:block">Sprint Board</span>
        </Link>
        <Link to="/mr-attention" className={NAV_LINK_CLASS}>
          <GitMerge className="h-4 w-4 shrink-0" />
          <span className="hidden md:block">MR Attention</span>
        </Link>
      </>
    )}
    {role === 'pm' && (
      <>
        <Link to="/sprint-progress" className={NAV_LINK_CLASS}>
          <BarChart2 className="h-4 w-4 shrink-0" />
          <span className="hidden md:block">Sprint Progress</span>
        </Link>
        <Link to="/workload" className={NAV_LINK_CLASS}>
          <Users className="h-4 w-4 shrink-0" />
          <span className="hidden md:block">Workload</span>
        </Link>
        <Link to="/releases" className={NAV_LINK_CLASS}>
          <Tag className="h-4 w-4 shrink-0" />
          <span className="hidden md:block">Releases</span>
        </Link>
      </>
    )}
  </div>
)}
```

The Work label is hidden on narrow sidebar (md:block) so it stays clean at w-16. A `mt-2` spacer gives visual separation from the Dashboard link above. No divider line needed — spacing + label is sufficient.
  </action>
  <verify>npx tsc --noEmit --project /Users/mimo/Desktop/Tasker/taskflow/tsconfig.app.json 2>&1 | grep -v "SearchOverlay.test\|GitLabStep\|JiraStep" | grep -c "error TS" || echo "0 new errors"</verify>
  <done>All 6 tab root divs have p-4, Sidebar renders a "Work" section label above role-specific links, TypeScript compiles clean.</done>
</task>

<task type="auto">
  <name>Task 2: Wire live data into Dashboard overview cards</name>
  <files>taskflow/src/routes/dashboard/index.tsx</files>
  <action>
Rewrite `dashboard/index.tsx` to fetch live data for each card using React Query. The static `DEVELOPER_CARDS` / `PM_CARDS` arrays are replaced with dynamic values derived from queries.

**Imports to add:**
```typescript
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { fetchSprintIssues, fetchFixVersions } from '@/services/jira';
import { fetchAssignedMRs, fetchReviewerMRs, validateGitLab } from '@/services/gitlab';
import { readSecret } from '@/services/stronghold';
```

Keep `import { useSettingsStore } from '@/stores/settings.store'` for role.

**Component structure:**

```tsx
export default function Dashboard() {
  const role = useSettingsStore((s) => s.role);
  const { jiraBaseUrl, activeJiraProject, gitlabBaseUrl } = useAuthStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const [gitlabToken, setGitlabToken] = useState<string | null>(null);

  useEffect(() => {
    if (jiraBaseUrl) readSecret('jira-pat').then(t => setJiraToken(t)).catch(() => setJiraToken(null));
  }, [jiraBaseUrl]);

  useEffect(() => {
    if (gitlabBaseUrl) readSecret('gitlab-pat').then(t => setGitlabToken(t)).catch(() => setGitlabToken(null));
  }, [gitlabBaseUrl]);

  // Developer cards queries
  // Card 1: Active Sprint Tasks — assigned to me
  const { data: myTasks, isLoading: loadingMyTasks, isError: errorMyTasks } = useQuery({
    queryKey: ['jira-issues', 'my-tasks', activeJiraProject],
    queryFn: () => fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, true),
    enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken && role !== 'pm',
    staleTime: 30_000,
  });

  // Card 2: Open MRs (authored by user) — use fetchAssignedMRs which returns scope=assigned_to_me state=opened
  // Note: "Open MRs" in context means MRs authored/assigned to me. fetchAssignedMRs returns scope=assigned_to_me
  const { data: assignedMrs, isLoading: loadingAssignedMrs, isError: errorAssignedMrs } = useQuery({
    queryKey: ['gitlab-mrs', gitlabBaseUrl],
    queryFn: async () => {
      const [assigned] = await Promise.all([fetchAssignedMRs(gitlabBaseUrl!, gitlabToken!)]);
      return assigned;
    },
    enabled: !!gitlabBaseUrl && !!gitlabToken && role !== 'pm',
    staleTime: 30_000,
  });

  // Card 3: MRs Needing Attention (reviewer MRs) — need current user ID
  const { data: currentUser } = useQuery({
    queryKey: ['gitlab-current-user', gitlabBaseUrl],
    queryFn: () => validateGitLab(gitlabBaseUrl!, gitlabToken!),
    staleTime: Infinity,
    enabled: !!gitlabBaseUrl && !!gitlabToken && role !== 'pm',
  });
  const { data: reviewerMrs, isLoading: loadingReviewerMrs, isError: errorReviewerMrs } = useQuery({
    queryKey: ['gitlab-reviewer-mrs-dashboard', gitlabBaseUrl, currentUser?.id],
    queryFn: () => fetchReviewerMRs(gitlabBaseUrl!, gitlabToken!, currentUser!.id),
    enabled: !!gitlabBaseUrl && !!gitlabToken && !!currentUser?.id && role !== 'pm',
    staleTime: 30_000,
  });

  // PM cards queries
  // Card 1: Sprint Completion % — share cache with SprintProgressTab
  const { data: sprintIssues, isLoading: loadingSprintIssues, isError: errorSprintIssues } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject],
    queryFn: () => fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false),
    enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken && role === 'pm',
    staleTime: 30_000,
  });

  // Card 3: Next Release — share cache with ReleasesTab
  const { data: fixVersions, isLoading: loadingFixVersions, isError: errorFixVersions } = useQuery({
    queryKey: ['jira-fix-versions', activeJiraProject],
    queryFn: () => fetchFixVersions(jiraBaseUrl!, jiraToken!, activeJiraProject!),
    enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken && role === 'pm',
    staleTime: 5 * 60_000,
  });

  // Derived values
  const activeTasksCount = myTasks?.length ?? null;
  const openMrCount = assignedMrs?.length ?? null;
  const attentionMrCount = reviewerMrs?.length ?? null;

  const sprintDone = sprintIssues?.filter(i => i.fields.status.statusCategory?.key === 'done').length ?? 0;
  const sprintTotal = sprintIssues?.length ?? 0;
  const sprintCompletionStr = sprintTotal > 0 ? `${Math.round((sprintDone / sprintTotal) * 100)}%` : null;

  const inProgressCount = sprintIssues?.filter(i => i.fields.status.statusCategory?.key === 'indeterminate').length ?? null;

  const versions = (fixVersions as { values?: Array<{ releaseDate?: string; name: string; released: boolean }> })?.values ?? [];
  const nextRelease = versions
    .filter(v => !v.released && v.releaseDate)
    .sort((a, b) => new Date(a.releaseDate!).getTime() - new Date(b.releaseDate!).getTime())[0];
  const nextReleaseStr = nextRelease ? `${nextRelease.name} · ${nextRelease.releaseDate}` : null;

  // Card render helper
  function cardValue(loading: boolean, error: boolean, value: number | string | null): React.ReactNode {
    if (loading) return <span className="animate-pulse text-muted-foreground">—</span>;
    if (error) return <span className="text-destructive text-sm">Error</span>;
    if (value === null) return <span className="text-muted-foreground">—</span>;
    return <>{value}</>;
  }

  // Card definitions
  const devCards = [
    {
      label: 'Active Sprint Tasks',
      loading: loadingMyTasks,
      error: errorMyTasks,
      value: activeTasksCount,
    },
    {
      label: 'Open MRs',
      loading: loadingAssignedMrs,
      error: errorAssignedMrs,
      value: openMrCount,
    },
    {
      label: 'MRs Needing Attention',
      loading: loadingReviewerMrs,
      error: errorReviewerMrs,
      value: attentionMrCount,
    },
  ];

  const pmCards = [
    {
      label: 'Sprint Completion',
      loading: loadingSprintIssues,
      error: errorSprintIssues,
      value: sprintCompletionStr,
    },
    {
      label: 'Team Workload',
      loading: loadingSprintIssues,
      error: errorSprintIssues,
      value: inProgressCount,
    },
    {
      label: 'Next Release',
      loading: loadingFixVersions,
      error: errorFixVersions,
      value: nextReleaseStr,
    },
  ];

  const cards = role === 'pm' ? pmCards : devCards;

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <h1 className="text-xl font-semibold">Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-bold mt-1">
              {cardValue(card.loading, card.error, card.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Remove the old `SummaryCard` interface and `DEVELOPER_CARDS` / `PM_CARDS` static arrays — they are no longer used.

The `fetchFixVersions` return type is `{ values: JiraFixVersion[] }` but since the service already has the type, cast via `as` only if TypeScript cannot infer — use `(fixVersions as { values?: Array<...> })?.values ?? []` pattern as shown above to be defensive (same pattern as the ReleasesTab).
  </action>
  <verify>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep -v "SearchOverlay.test\|GitLabStep\|JiraStep" | grep "error TS" || echo "clean"</verify>
  <done>Dashboard/index.tsx imports React Query hooks and service functions, fetches live data for all 6 cards, shows animated "—" while loading and "Error" text in destructive color on failure, TypeScript compiles clean (pre-existing 3 errors unchanged).</done>
</task>

</tasks>

<verification>
Run TypeScript: `cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep "error TS"` — should show only the 3 pre-existing errors (SearchOverlay.test.tsx, GitLabStep.tsx, JiraStep.tsx) with zero new errors introduced by this task.

Visual check: Navigate to each of the 6 route pages and confirm all content has visible padding on all sides. Navigate to Dashboard and confirm cards show loading animation then real counts.
</verification>

<success_criteria>
- All 6 tab route pages (MyTasksTab, SprintBoardTab, MrAttentionTab, SprintProgressTab, WorkloadTab, ReleasesTab) have `p-4` on their root div
- Sidebar renders "Work" section label (uppercase, muted, small) above role-specific links
- Dashboard cards fetch and display live numbers: active sprint tasks, open MRs, reviewer MRs (developer); sprint completion %, in-progress count, next release name+date (PM)
- Dashboard cards show pulsing "—" while loading, and "Error" on failure
- Zero new TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/2-fix-nav-layout-add-page-margins-live-das/2-SUMMARY.md`
</output>
