---
phase: 260518-jbe
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira/issues.ts
  - taskflow/src/services/jira/types.ts
  - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx
autonomous: true
requirements: [JBE-01]

must_haves:
  truths:
    - "AIO cycle detail Defects tab shows a Reporter column with avatar + display name"
    - "AIO cycle detail Defects tab shows a Priority column with priority name (and icon if available)"
    - "AIO cycle detail Defects tab shows a Severity column with the severity value"
    - "Each new column gracefully renders an em-dash when the underlying field is null/absent"
    - "Existing columns (Key, Title, Status, Assignee, Triggered By) remain unchanged"
    - "Defects tab tests still pass"
  artifacts:
    - path: "taskflow/src/services/jira/issues.ts"
      provides: "fetchJiraIssueByKey requesting priority + reporter + severity fields"
      contains: "fields=summary,status,assignee,reporter,priority,customfield_10016,issuetype"
    - path: "taskflow/src/services/jira/types.ts"
      provides: "JiraIssue.fields optional reporter, priority, severity"
      contains: "reporter?:"
    - path: "taskflow/src/routes/dashboard/AioCycleDetailPage.tsx"
      provides: "Defects table headers + DefectRow cells for Reporter, Priority, Severity"
      contains: "Reporter"
  key_links:
    - from: "AioCycleDetailPage.tsx (DefectRow)"
      to: "issueQuery.data.fields.reporter / priority / severity"
      via: "rendered cells"
      pattern: "fields\\.(reporter|priority|severity)"
    - from: "fetchJiraIssueByKey"
      to: "Jira REST /issue/{key}?fields=..."
      via: "query string"
      pattern: "fields=.*reporter.*priority"
---

<objective>
Add Reporter, Priority, and Severity columns to the Defects table on the AIO cycle detail page, building on the redesign just shipped in quick task 260518-j1c (which added type icon, Jira key, colored status, assignee).

Purpose: Triagers need full Jira metadata at a glance when reviewing defects linked to a cycle — Reporter (who filed it), Priority (Highest / High / Medium / Low / Lowest), and Severity (custom field on Jira Service Management projects) — so they can prioritise without click-through.

Output:
- Defects table renders three new columns: Reporter, Priority, Severity
- `fetchJiraIssueByKey` extended to request `reporter`, `priority`, and severity-bearing fields
- `JiraIssue.fields` type extended with optional `reporter`, `priority`, and `severity`
- Existing tests still green; new render-coverage tests added for the three columns
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260518-j1c-on-aio-cycle-detail-defects-page-i-want-/260518-j1c-SUMMARY.md
@taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
@taskflow/src/services/jira/issues.ts
@taskflow/src/services/jira/types.ts
@taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx

<interfaces>
<!-- Key types and contracts the executor needs. Use these directly — no codebase exploration. -->

From taskflow/src/services/jira/types.ts (current shape, lines 23-57):
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
    description?: string | null;
    parent?: { id: string; key: string; fields: { summary: string } };
    subtasks?: Array<...>;
    timetracking?: ...;
    [key: string]: unknown;
  };
}
```

The richer `JiraIssueDetail` already models the desired field shapes at lines 118-120 of types.ts:
```typescript
priority: { name: string; iconUrl?: string } | null;
reporter: { displayName: string; name?: string; avatarUrls: { '48x48': string } } | null;
```
Mirror those exact shapes when extending `JiraIssue.fields`.

From taskflow/src/services/jira/issues.ts (line 640-670, `fetchJiraIssueByKey`):
```typescript
const url = `${base}/rest/api/2/issue/${issueKey}?fields=summary,status,assignee,customfield_10016,issuetype`;
```
This is the only call site we need to widen. Returns `JiraIssue | null` (silent failure on 404/auth/network).

From taskflow/src/routes/dashboard/AioCycleDetailPage.tsx (DefectRow at lines 81-155, Defects table headers at lines 660-680):
- Existing columns: Key | Title | Status | Assignee | Triggered By
- DefectRow already calls `useQuery(fetchJiraIssueByKey)` — same query feeds the new cells, no new request.

From taskflow/src/components/ui/cached-avatar.tsx (used by existing AssigneeCell):
```typescript
<CachedAvatar url={...} name={...} size={20} />
```
Reuse the same pattern + sizing for the Reporter cell.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend Jira issue fetch + types to include reporter, priority, severity</name>
  <files>taskflow/src/services/jira/issues.ts, taskflow/src/services/jira/types.ts</files>
  <behavior>
    - `fetchJiraIssueByKey` requests `reporter`, `priority`, and severity-bearing fields in addition to current fields
    - `JiraIssue.fields` type gains optional `reporter`, `priority`, `severity` properties mirroring `JiraIssueDetail` shapes
    - Existing call sites of `fetchJiraIssueByKey` continue to work unchanged (additive only)
    - When the underlying Jira instance does not return a field (e.g. severity not configured), reading `fields.severity` is safely `undefined` — no type error, no runtime crash
  </behavior>
  <action>
    1. In `taskflow/src/services/jira/issues.ts` at line 646, widen the `url` query string for `fetchJiraIssueByKey` so `fields=` includes `reporter`, `priority`, `severity` alongside the existing `summary,status,assignee,customfield_10016,issuetype`. Final string: `fields=summary,status,assignee,reporter,priority,severity,customfield_10016,issuetype`. (Severity is requested by its semantic name; Jira REST accepts either system field names or custom field ids and silently omits unknowns — exactly the graceful degradation we want.)

    2. In `taskflow/src/services/jira/types.ts`, extend the `JiraIssue.fields` shape (lines 26-56) with three new optional fields, mirroring the shapes already used by `JiraIssueDetail` at lines 118-120:
       - `priority?: { name: string; iconUrl?: string } | null;`
       - `reporter?: { displayName: string; name?: string; avatarUrls: { '48x48': string } } | null;`
       - `severity?: { value?: string; name?: string } | null;` (Jira severity custom fields are typically single-select option objects exposing `value`; some configurations use `name`. Both keys are optional so the renderer can fall back gracefully.)

       Place the additions inside the existing inline `fields` object, before the `[key: string]: unknown;` index signature. Do not touch `JiraIssueDetail` — it already has its own copies.

    3. Do not change any other callers, signatures, or behaviour.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow &amp;&amp; npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>
    - `issues.ts` URL contains `reporter`, `priority`, and `severity` segments
    - `types.ts` `JiraIssue.fields` exposes optional `priority`, `reporter`, `severity` with the shapes above
    - `npx tsc --noEmit` is clean across the project
    - No existing tests are altered
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Render Reporter, Priority, Severity columns in the Defects table</name>
  <files>taskflow/src/routes/dashboard/AioCycleDetailPage.tsx, taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx</files>
  <behavior>
    - Defects table header row contains a `Reporter`, `Priority`, and `Severity` `<th>` in that order, inserted between `Assignee` and `Triggered By`
    - For each `DefectRow`:
      - Reporter cell: when `issueQuery.data.fields.reporter` exists, renders `CachedAvatar` + truncated `displayName` (same visual treatment as the existing Assignee cell at lines 139-150); otherwise renders an em-dash `—`. While `issueQuery.isLoading`, renders the same `Skeleton` placeholder used by the assignee cell.
      - Priority cell: when `issueQuery.data.fields.priority` exists, renders the priority name (e.g. `High`) as plain text with `text-xs text-muted-foreground`. If `priority.iconUrl` is present, render a small `<img src={iconUrl} alt="" className="w-3.5 h-3.5 shrink-0" />` to the left of the name. Otherwise em-dash. Loading → `Skeleton`.
      - Severity cell: read severity value via `issueQuery.data.fields.severity?.value ?? issueQuery.data.fields.severity?.name`. Render the resolved string with `text-xs text-muted-foreground`; em-dash when the value is `undefined`/empty. Loading → `Skeleton`.
    - Existing Key, Title, Status, Assignee, Triggered By columns are preserved exactly as they are today (no width/class/order regressions).
    - New render-coverage tests in `AioCycleDetailPage.test.tsx` verify:
      - All five existing column headers plus the three new headers (`Reporter`, `Priority`, `Severity`) are present in the Defects tab
      - When `fetchJiraIssueByKey` resolves an issue with populated `reporter` + `priority` + `severity`, the row shows the reporter `displayName`, priority `name`, and severity `value`
      - When those fields are `null`/missing in the mocked issue, the row renders three em-dashes for those cells (assertion: at least three `—` characters within the defect row, OR scoped queries against the row testid)
  </behavior>
  <action>
    1. In `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` `DefectRow` component (lines 81-155):
       a. After the existing Assignee `<td>` (currently ending at line 151) and **before** the Triggered By `<td>` (line 152), insert three new `<td>` cells:
          - Reporter cell (mirrors the Assignee cell pattern at lines 136-151 but reads `issueQuery.data?.fields.reporter`; reuse `CachedAvatar` with `size={20}` and `truncate max-w-[120px]`).
          - Priority cell (loading → `<Skeleton className="h-4 w-16" />`; populated → optional `<img>` icon at `w-3.5 h-3.5 shrink-0` followed by `{priority.name}`; missing → `<span className="text-muted-foreground">—</span>`). Wrapping `<td>` uses `px-3 py-3 text-xs text-muted-foreground`.
          - Severity cell (same loading/missing fallback pattern; populated value computed as `severity?.value ?? severity?.name ?? null`). Same `<td>` class as Priority.
       b. In the table `<thead>` (lines 661-680), insert matching `<th>` headers `Reporter`, `Priority`, `Severity` between the existing `Assignee` `<th>` (line 673-675) and `Triggered By` `<th>` (line 676-678). Use the same `font-medium text-muted-foreground text-xs` styling as the existing headers. Suggested widths: `w-36` for Reporter, `w-24` for Priority, `w-24` for Severity.
       c. Do not change the prop signature of `DefectRow`. All three new pieces of data come from the existing `issueQuery` — no new query, no new prop.

    2. In `taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx` add tests inside the existing `describe('Defects tab', …)` block (around line 299):
       a. **Header presence test** — after navigating to the Defects tab with at least one defect-bearing run, assert `screen.getByRole('columnheader', { name: 'Reporter' })`, `…'Priority'`, `…'Severity'` are defined alongside the existing five.
       b. **Populated row test** — mock `fetchJiraIssueByKey` to resolve a `JiraIssue` whose `fields` includes `reporter: { displayName: 'Alice Reporter', avatarUrls: { '48x48': '' } }`, `priority: { name: 'High' }`, `severity: { value: 'Major' }`. Navigate to Defects tab. Assert `screen.findByText('Alice Reporter')`, `…'High'`, `…'Major'` all resolve.
       c. **Missing-fields test** — mock `fetchJiraIssueByKey` to resolve an issue whose `fields` has `reporter: null, priority: null, severity: null`. Navigate to Defects tab. Inside the defect row (use the existing row-scoping pattern in the file, e.g. `within(screen.getByTestId(...))` or text-scoped queries), assert that at least three em-dashes appear in the Reporter/Priority/Severity cells (do not over-constrain to exact DOM structure).

    3. Keep the test file's existing mocks and `vi.mock('@/services/jira', …)` intact; reuse the existing `(fetchJiraIssueByKey as ReturnType&lt;typeof vi.fn&gt;).mockResolvedValue(...)` pattern already used elsewhere in the suite.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow &amp;&amp; npx vitest run src/routes/dashboard/AioCycleDetailPage.test.tsx</automated>
  </verify>
  <done>
    - Defects table renders 8 columns: Key | Title | Status | Assignee | Reporter | Priority | Severity | Triggered By
    - Reporter cell shows avatar + display name when present, em-dash when null, Skeleton while loading
    - Priority cell shows name (and icon when iconUrl present), em-dash when null, Skeleton while loading
    - Severity cell shows the resolved value (`value` or `name`), em-dash when null, Skeleton while loading
    - All Defects tab tests pass; the three new tests (headers, populated, missing) pass
    - `npx tsc --noEmit` still clean
    - No regression to the Executions tab or any other existing test
  </done>
</task>

</tasks>

<verification>
- `cd taskflow && npx tsc --noEmit -p tsconfig.json` clean
- `cd taskflow && npx vitest run src/routes/dashboard/AioCycleDetailPage.test.tsx` all green (existing 27 tests + 3 new tests)
- Manual visual sanity (developer): open an AIO cycle that has defects → Defects tab → confirm Reporter avatar/name, Priority name+icon, Severity text are all visible; defects from issues missing any of those fields show em-dashes in the corresponding cells.
</verification>

<success_criteria>
- All three new columns (Reporter, Priority, Severity) appear in the Defects tab header and body
- Cells degrade gracefully (em-dash) when the underlying Jira fields are null or absent on the source issue
- No new network calls — all data sourced from the existing `fetchJiraIssueByKey` query already issued per defect
- All `AioCycleDetailPage.test.tsx` tests pass, including 3 new render-coverage tests
- TypeScript build clean
</success_criteria>

<output>
Create `.planning/quick/260518-jbe-on-aio-cycle-detail-defects-page-also-sh/260518-jbe-SUMMARY.md` when done, following the template at `@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md`.
</output>
