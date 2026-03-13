---
phase: quick-16
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/WorkloadTab.tsx
  - taskflow/src/routes/dashboard/WorkloadTab.test.tsx
autonomous: true
requirements:
  - WORK-SUBTASK-01
  - WORK-TIMELOG-01

must_haves:
  truths:
    - "Expanding an assignee row shows their assigned subtasks nested under each parent story"
    - "A person who logged time on any sprint issue (but is not the assignee) appears as a workload row"
    - "Tasks count and story points totals are unchanged (count non-done stories only, subtasks excluded)"
    - "Existing expand/collapse behavior is not regressed"
  artifacts:
    - path: "taskflow/src/services/jira.ts"
      provides: "fetchIssueWorklogs function returning worklog author displayNames"
      exports: ["fetchIssueWorklogs"]
    - path: "taskflow/src/routes/dashboard/WorkloadTab.tsx"
      provides: "Updated workload table with subtask nesting and worklog-based attribution"
      contains: "worklog-row"
    - path: "taskflow/src/routes/dashboard/WorkloadTab.test.tsx"
      provides: "Tests for subtask nesting and worklog attribution"
  key_links:
    - from: "taskflow/src/routes/dashboard/WorkloadTab.tsx"
      to: "taskflow/src/services/jira.ts"
      via: "fetchIssueWorklogs called in separate useQuery per sprint load"
      pattern: "fetchIssueWorklogs"
    - from: "WorkloadTab useMemo"
      to: "subtask.fields.parent?.key"
      via: "parent key lookup maps subtasks under story rows"
      pattern: "parent\\.key"
---

<objective>
Enhance WorkloadTab with two new capabilities:
1. Subtasks shown nested under their parent story in expanded rows (three-level hierarchy: Assignee → Story → Subtask)
2. People who logged time on sprint issues appear in the workload even when not assigned to any story

Purpose: Devs mostly log time on subtasks — workload attribution is currently blind to actual work done.
Output: Updated WorkloadTab.tsx + jira.ts worklog helper + passing tests.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<interfaces>
<!-- Key types from taskflow/src/services/jira.ts -->

```typescript
export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { id: string; name: string; statusCategory?: { key: 'new' | 'indeterminate' | 'done' } };
    assignee: { displayName: string; avatarUrls: { '48x48': string } } | null;
    customfield_10016: number | null;
    issuetype: { name: string; subtask: boolean };
    parent?: { id: string; key: string; fields: { summary: string } };
    subtasks?: Array<{ id: string; key: string; fields: { summary: string; status: { name: string } } }>;
    timetracking?: {
      originalEstimateSeconds?: number;
      remainingEstimateSeconds?: number;
      timeSpentSeconds?: number;
    };
    [key: string]: unknown;
  };
}
```

Current WorkloadTab data flow:
- useQuery → fetchSprintIssues → JiraIssue[] (stories + subtasks already included via two-query strategy)
- useMemo partitions into stories/subtasks, builds assignee map
- WorkloadStoryRow: { key, summary, points, estSecs, spentSecs, remainSecs }
- WorkloadRow: { name, count, points, estSecs, spentSecs, remainSecs, stories: WorkloadStoryRow[] }
- Subtasks currently aggregate time into assignee bucket but are NOT rendered in expanded rows
- Line 129: subtask assignee not in story map → skipped (worklog-only contributors are invisible)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add fetchIssueWorklogs to jira.ts</name>
  <files>taskflow/src/services/jira.ts</files>
  <behavior>
    - fetchIssueWorklogs('https://jira.example.com', 'token', 'PROJ-1') returns string[] of unique author displayNames who logged time on that issue
    - Returns [] if the response is not ok (silent failure)
    - Returns [] if the response body has no worklogs property
    - Deduplicates authors (same person logging multiple times still appears once)
  </behavior>
  <action>
Add `fetchIssueWorklogs` near the bottom of jira.ts (after `discoverStoryPointsField`).

```typescript
/**
 * Returns the unique displayNames of all authors who logged work on an issue.
 * Silently returns [] on any error — callers use this for attribution enrichment only.
 */
export async function fetchIssueWorklogs(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/rest/api/2/issue/${issueKey}/worklog`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const worklogs: Array<{ author?: { displayName?: string } }> = data.worklogs ?? [];
    const names = new Set<string>();
    for (const wl of worklogs) {
      const name = wl.author?.displayName;
      if (name) names.add(name);
    }
    return Array.from(names);
  } catch {
    return [];
  }
}
```

Write the test in jira.ts's co-located test file if one exists, otherwise add to a new `jira.worklog.test.ts`. Check for an existing test file first:
- If `taskflow/src/services/jira.test.ts` exists, add a `describe('fetchIssueWorklogs')` block there
- Otherwise create `taskflow/src/services/jira.worklog.test.ts`

Test cases (RED first, then GREEN):
1. Happy path: 200 response with two worklogs from same author → returns ['Alice'] (deduplicated)
2. Two different authors → returns both names
3. Non-ok response (401) → returns []
4. Empty worklogs array → returns []
5. fetch throws → returns []
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run --reporter=verbose src/services/jira.worklog.test.ts 2>&1 || npx vitest run --reporter=verbose src/services/jira.test.ts 2>&1 | grep -A 5 "fetchIssueWorklogs"</automated>
  </verify>
  <done>fetchIssueWorklogs exported from jira.ts, all 5 test cases pass, no regressions in existing jira service tests.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Update WorkloadTab — subtask nesting + worklog attribution</name>
  <files>taskflow/src/routes/dashboard/WorkloadTab.tsx, taskflow/src/routes/dashboard/WorkloadTab.test.tsx</files>
  <behavior>
    - Expanded assignee row shows story rows, and each story row has its subtasks nested beneath (indented further, data-testid="workload-subtask-row")
    - A person who appears only in worklogs (not assigned to any story/subtask) gets their own assignee row with count=0, points=0, but non-zero spentSecs from those worklogs
    - Tasks column: count and points unchanged (non-done stories only; subtasks do not increment)
    - All existing tests continue to pass
    - Subtask rows show: key, summary, time columns (no pts column — subtasks excluded from pts)
    - Worklogs are fetched in parallel for all sprint issues using a single secondary useQuery; on error the workload renders without worklog attribution (graceful degradation)
    - Subtasks without a parent in the current sprint issue list are attached under an "Unknown parent" story row for the subtask's assignee — or silently dropped if no assignee (per Claude's discretion: silently drop orphan subtasks whose parent is not in the sprint data)
  </behavior>
  <action>
**Data model changes:**

Add `WorkloadSubtaskRow` interface:
```typescript
interface WorkloadSubtaskRow {
  key: string;
  summary: string;
  estSecs: number;
  spentSecs: number;
  remainSecs: number;
}
```

Update `WorkloadStoryRow`:
```typescript
interface WorkloadStoryRow {
  key: string;
  summary: string;
  points: number;
  estSecs: number;
  spentSecs: number;
  remainSecs: number;
  subtasks: WorkloadSubtaskRow[];   // ADD THIS
}
```

**Secondary worklog query:**

Add a second `useQuery` that fetches worklogs for all sprint issues in parallel:

```typescript
const sprintIssues = data ?? [];

const { data: worklogMap } = useQuery({
  queryKey: ['workload-worklogs', activeJiraProject, sprintIssues.map((i) => i.key).join(',')],
  queryFn: async () => {
    const entries = await Promise.all(
      sprintIssues.map(async (issue) => {
        const authors = await fetchIssueWorklogs(jiraBaseUrl!, jiraToken!, issue.key);
        return [issue.key, authors] as [string, string[]];
      }),
    );
    return new Map<string, string[]>(entries);
  },
  enabled: !!jiraBaseUrl && !!jiraToken && sprintIssues.length > 0,
  staleTime: 60_000,
});
```

Note: `worklogMap` is `Map<issueKey, authorDisplayNames[]> | undefined`. When undefined, worklog attribution is skipped gracefully.

**useMemo changes:**

1. Build `subtasksByParent: Map<string, WorkloadSubtaskRow[]>` from subtask issues keyed by `sub.fields.parent?.key`.

2. In the story accumulation loop, after pushing to `existing.stories`, look up `subtasksByParent.get(story.key) ?? []` and set it as `subtasks` on the story row.

3. After the story loop, process worklogs: for each entry in `worklogMap`, for each author name, ensure the author exists in the assignee map. If not, create a stub entry (count=0, points=0, stories=[]). Then add worklog time to the author's top-level spentSecs. Do NOT add to estSecs/remainSecs from worklogs (only timeSpentSeconds is available from worklog attribution).

4. The existing subtask time aggregation loop (lines 125-133) can be retained for assigned subtasks. For worklog attribution, only increment `spentSecs` on the assignee map entry.

**Render changes:**

In the per-story rows render block, after each story row, add subtask rows when expanded:

```tsx
{isOpen && row.stories.map((story) => (
  <React.Fragment key={story.key}>
    {/* Story row — existing */}
    <tr key={story.key} data-testid="workload-story-row" className="bg-muted/20">
      ...existing story row JSX...
    </tr>
    {/* Subtask rows — NEW, indented further */}
    {story.subtasks.map((sub) => (
      <tr key={sub.key} data-testid="workload-subtask-row" className="bg-muted/10">
        <td className="py-1 pl-12 pr-2 text-xs text-muted-foreground">
          <span className="font-mono">{sub.key}</span>
          <span className="ml-2 truncate">{sub.summary}</span>
        </td>
        <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">—</td>
        <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">—</td>
        {hasTimeData && <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">{formatSeconds(sub.estSecs)}</td>}
        {hasTimeData && <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">{formatSeconds(sub.spentSecs)}</td>}
        {hasTimeData && <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">{formatSeconds(sub.remainSecs)}</td>}
      </tr>
    ))}
  </React.Fragment>
))}
```

**Import:** Add `fetchIssueWorklogs` to the jira service import line.

**Tests to add in WorkloadTab.test.tsx:**

Mock `fetchIssueWorklogs` at top of file:
```typescript
vi.mock('@/services/jira', () => ({
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
  fetchIssueWorklogs: vi.fn().mockResolvedValue([]),
}));
```

In `beforeEach`, also reset `fetchIssueWorklogs` mock: `vi.mocked(fetchIssueWorklogs).mockResolvedValue([])`.

New test cases:
1. **Subtask nesting**: Given story P-1 with subtask P-1-1 (parent.key='P-1') assigned to Alice, expanding Alice row → story row P-1 visible → subtask row P-1-1 visible (`data-testid="workload-subtask-row"`).
2. **Worklog attribution**: Given story P-1 assigned to Alice, `fetchIssueWorklogs` returns ['Bob'] for P-1; Bob has no assigned issues. Bob appears as a workload row.
3. **Worklog does not inflate task count**: Bob from worklogs has count=0 and points=0.
4. **Graceful degradation**: `fetchIssueWorklogs` rejects for all issues → workload still renders with Alice's assigned rows, no crash.

Do NOT break existing tests — keep all existing mock shapes intact.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run --reporter=verbose src/routes/dashboard/WorkloadTab.test.tsx</automated>
  </verify>
  <done>All WorkloadTab tests pass (existing + new). Subtask rows render under parent story rows. Worklog-attributed people appear as rows. TypeScript compiles without new errors (`npx tsc --noEmit` from taskflow/).</done>
</task>

</tasks>

<verification>
Run full test suite for affected files:
```
cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/WorkloadTab.test.tsx src/services/jira.worklog.test.ts
```

TypeScript check:
```
cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | grep -v "error TS2307\|Cannot find module" | head -20
```
</verification>

<success_criteria>
- fetchIssueWorklogs exported from jira.ts, silently returns [] on any error
- WorkloadTab expanded rows show three-level hierarchy: Assignee → Story → Subtask (data-testid="workload-subtask-row")
- People appearing only in worklogs get a workload row with count=0, points=0, non-zero spentSecs
- Tasks/pts totals unchanged: non-done stories only, subtasks excluded
- All existing WorkloadTab tests pass
- 4 new tests pass (subtask nesting, worklog attribution, count isolation, graceful degradation)
</success_criteria>

<output>
After completion, create `.planning/quick/16-in-workload-tab-show-subtasks-and-time-l/16-SUMMARY.md`
</output>
