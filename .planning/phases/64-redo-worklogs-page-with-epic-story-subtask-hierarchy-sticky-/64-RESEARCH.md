# Phase 64: Redo Worklogs Page with Hierarchy — Research

**Researched:** 2026-05-22
**Domain:** React/TanStack Query, Jira REST API enrichment, sticky CSS table, Radix UI Popover mutations
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Tasks-only rows — no person column. Primary row dimension is Jira issue hierarchy: Epic header row → Story row (indented) → Subtask row (further indented).
- **D-02:** All hierarchy levels always expanded — no collapse/expand state needed.
- **D-03:** Cells aggregate all worklog entries for that issue+day (sum of `timeSpentSeconds`). Zero cells render blank. No entry-count badge.
- **D-04:** Person filter remains. Default = current user (me). Filter still sends `author.name` to `fetchWorklogs`. With no person selected, table shows all people's hours aggregated.
- **D-05:** Batch JQL after worklogs load. After `fetchWorklogs` returns, collect all unique `w.issue.key` values, fire ONE Jira search: `key in (KEY-1, KEY-2, ...)` fetching `summary`, `issuetype`, `parent` fields. Single dependent `useQuery` that fires only when worklogs data is ready.
- **D-06:** 3-level hierarchy: Epic → Story → Subtask. Worklogs logged on a story appear under that story row. Worklogs logged on a subtask appear under subtask → story → epic. Worklogs logged on an epic appear directly under the epic row.
- **D-07:** Unresolvable `issueKey` (deleted or inaccessible): render the key as the row label with muted/strikethrough style. Hours included in totals.
- **D-08:** Clicking a task row calls `onIssueClick(issueKey)` via `useOutletContext`. Same as BacklogPage and SprintBoardTab.
- **D-09:** Breadcrumbs handled automatically by `handleIssueClick` (called with `resetTrail = false`). No custom breadcrumb UI needed.
- **D-10:** Only leaf rows trigger `onIssueClick`. Epic and Story header rows are also clickable (Claude's discretion).
- **D-11:** Clicking a non-zero cell opens a popover showing individual worklog entries for that issue+day pair. Each entry shows time spent, author display name, comment, with edit (pencil) and delete (trash) icons.
- **D-12:** "Add entry" button inside the popover to create a new worklog for that issue+date. Reuses `LogWorkPopover`.
- **D-13:** Uses existing `updateWorklog`, `deleteWorklog`, `createWorklog` from `taskflow/src/services/jira/worklogs.ts`. No new Tempo write API.
- **D-14:** After any mutation, invalidate TanStack Query cache key `['tempo', 'worklogs', ...]` so the table refetches automatically.
- **D-15:** Sticky table via CSS: header row `sticky top-0 z-20`, first column `sticky left-0 z-10`, corner `sticky top-0 left-0 z-30`, all sticky cells `bg-background`.

### Claude's Discretion

- Epic rows also clickable via `onIssueClick(epicKey)` (D-10).
- Component extraction decisions (HierarchyTable, WorklogCellPopover, WorklogEntryRow, EditWorklogForm) — can be inline in WorklogsPage.tsx or extracted to sibling files.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEMPO-08 | Worklog table supports grouping by epic/story/subtask row hierarchy | D-05/D-06: batch JQL enrichment + hierarchy useMemo; existing `fetchAllSearchPages` pattern in `jira.ts` |
| TEMPO-09 | Cell drill-down showing individual worklogs for a person/day cell | D-11/D-12: WorklogCellPopover using existing Radix Popover; `LogWorkPopover` reuse |
| (implicit) | Log entry editing via cell click popover | D-13/D-14: `updateWorklog`/`deleteWorklog`/`createWorklog` + cache invalidation pattern |
</phase_requirements>

---

## Summary

Phase 64 replaces the flat person×day pivot table in WorklogsPage with a 3-level Jira issue hierarchy (Epic → Story → Subtask). The filter bar and all state from Phases 62–63 are kept unchanged. The primary new technical work is: (1) a second dependent TanStack Query that batch-enriches unique issue keys from Tempo worklogs with Jira issue metadata (summary, issuetype, parent), (2) replacing the `pivot` useMemo with a `hierarchy` useMemo that builds a nested Epic → Story → Subtask structure, (3) a sticky CSS table (first column + header row, both sticky, corner cell at z-30), (4) a `WorklogCellPopover` component that shows individual worklog entries with edit/delete/add actions using the existing Jira worklog CRUD service.

The key architectural constraint is that `TempoWorklog` uses `w.issue.key` (not a top-level `issueKey` field) to identify issues. The batch Jira enrichment query follows an established pattern already in `jira.ts` (the `issuekey in (...)` JQL used in `fetchBacklogView` and `fetchIssueDetail`). Issue navigation uses `useOutletContext` to get `onIssueClick` — the same pattern as BacklogPage and SprintBoardTab, but WorklogsPage currently does NOT use this pattern and will need to be wired up.

**Primary recommendation:** Build the phase as a single modified `WorklogsPage.tsx` that imports `useOutletContext`, adds a second dependent `useQuery` for Jira enrichment, replaces the `pivot` useMemo with a `hierarchy` useMemo, and adds the 3 new sub-components (WorklogCellPopover, WorklogEntryRow, EditWorklogForm) either inline or extracted to sibling files in `routes/worklogs/`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tempo worklog data fetch | Frontend (TanStack Query) | Tempo service (tempo/worklogs.ts) | Already built; unchanged |
| Jira issue enrichment batch | Frontend (TanStack Query) | Jira service (jira.ts fetchAllSearchPages) | New dependent query; follows existing batch enrichment pattern |
| Hierarchy tree computation | Frontend (useMemo) | — | Pure derivation from two query results |
| Sticky table rendering | Browser (CSS) | — | `position: sticky` CSS; no JS scroll logic |
| Cell popover + worklog CRUD | Frontend (Popover + useMutation) | Jira service (jira/worklogs.ts) | Existing create/update/delete functions; new UI layer only |
| Issue navigation | Frontend (Outlet context) | main.tsx handleIssueClick | useOutletContext pattern — already used by BacklogPage, SprintBoardTab |
| Filter state (person + date preset) | Frontend (useState + store) | Zustand persist | Unchanged from Phase 63 |

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ≥5.x | Two dependent queries + mutations | Already used throughout codebase |
| `react-router-dom` | ≥6.x | `useOutletContext` for `onIssueClick` | Already used by BacklogPage, SprintBoardTab |
| `@radix-ui/react-popover` (via shadcn) | installed | WorklogCellPopover | Already installed — `Popover`, `PopoverContent`, `PopoverTrigger` in `@/components/ui/popover` |
| `lucide-react` | installed | `Pencil`, `Trash2`, `Plus`, `Layers`, `BookOpen`, `GitBranch` icons | Already used in WorklogsPage |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn `Button` | installed | "Add entry", "Save Changes", "Discard Changes" in popovers | Form action buttons |
| shadcn `Input` | installed | Duration + date fields in EditWorklogForm | Form inputs |
| shadcn `Textarea` | installed | Comment field | Multi-line text |
| shadcn `Skeleton` | installed | Loading state in hierarchy table | Placeholder rows |
| shadcn `Alert` | installed | Jira enrichment error inline banner | Non-blocking error state |

### No new packages needed
All required libraries are already installed. This phase requires **zero new npm packages**. [VERIFIED: codebase inspection]

---

## Package Legitimacy Audit

No new packages to install in this phase. Audit not required.

---

## Architecture Patterns

### System Architecture Diagram

```
fetchWorklogs(Tempo API)
        |
        v
  worklogs: TempoWorklog[]
        |
        +-- collect unique w.issue.key values
        |
        v
  fetchJiraEnrichment(key in (...), fields=summary,issuetype,parent)
        |
        v
  enrichMap: Map<issueKey, { summary, issuetype, parent }>
        |
        v
  hierarchy useMemo
  ┌─────────────────────────────────────┐
  │  Map<epicKey, {                     │
  │    summary, stories: Map<storyKey,  │
  │      { summary, subtasks: Map<      │
  │        subtaskKey, { summary,       │
  │          dayMap: Map<date, secs> }  │
  │      }> }                           │
  │  }>                                 │
  └─────────────────────────────────────┘
        |
        v
  HierarchyTable (sticky thead + sticky first column)
  ┌─ Epic row (bg-muted/40, font-semibold) ─┐
  │  ├─ Story row (pl-4) ─────────────────  │
  │  │    └─ Subtask row (pl-8, muted) ──   │
  │  └─ "No Epic" group (synthetic)         │
  └──────────────────────────────────────────┘
        |
    cell click (non-zero)
        |
        v
  WorklogCellPopover
  ├── WorklogEntryRow (per entry)
  │     ├── Pencil → EditWorklogForm (inline replace)
  │     └── Trash2 → deleteWorklog mutation → invalidate tempo cache
  └── "Add entry" → LogWorkPopover (existing component)
```

### Recommended Project Structure
```
src/routes/worklogs/
├── WorklogsPage.tsx          # modified — add hierarchy, outlet context, enrichment
├── WorklogsPage.test.tsx     # modified — update tests for hierarchy table
├── WorklogCellPopover.tsx    # new — cell drill-down popover (or inline in WorklogsPage)
├── WorklogEntryRow.tsx       # new — single entry row (or inline in WorklogsPage)
└── EditWorklogForm.tsx       # new — inline edit form (or inline in WorklogsPage)
```

Extraction decision is Claude's discretion. Inline in WorklogsPage avoids extra imports but will make the file long (~800+ lines). Extracting to sibling files is cleaner and matches the pattern used in `issue-detail/` (e.g., `LogWorkPopover.tsx`, `DurationInput.tsx`).

### Pattern 1: Dependent Query (Jira enrichment after worklogs)

```typescript
// Source: TanStack Query docs — dependent queries; also used throughout codebase
const uniqueKeys = useMemo(
  () => [...new Set((data ?? []).map((w) => w.issue.key))],
  [data]
);

const { data: enrichData, isError: isEnrichError } = useQuery({
  queryKey: ['jira', 'worklog-enrich', jiraBaseUrl, uniqueKeys],
  queryFn: async () => {
    if (!uniqueKeys.length) return [];
    const jql = `key in (${uniqueKeys.join(',')})`;
    const base = jiraBaseUrl!.replace(/\/$/, '');
    const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,issuetype,parent&maxResults=${uniqueKeys.length}`;
    const res = await apiFetch('jira', url, {
      headers: { Authorization: `Bearer ${jiraToken!}`, 'Content-Type': 'application/json' },
    }, 'Enrich Worklog Issues');
    if (!res.ok) throw new Error(`Enrichment failed: ${res.status}`);
    const d = await res.json();
    return d.issues as Array<{
      key: string;
      fields: {
        summary: string;
        issuetype: { name: string; subtask: boolean };
        parent?: { key: string; fields: { summary: string } };
      };
    }>;
  },
  enabled: !!jiraBaseUrl && !!jiraToken && !!data && uniqueKeys.length > 0,
  staleTime: 5 * 60 * 1000, // 5 min — issue metadata rarely changes
});
```

[VERIFIED: codebase — `jira.ts` lines 2244–2248 use identical `issuekey in (...)` pattern; TanStack Query `enabled` dependent query pattern used throughout codebase]

### Pattern 2: Hierarchy useMemo

```typescript
// Source: 64-CONTEXT.md §Specific Ideas
const { hierarchy, days, dayTotals, grandTotal } = useMemo(() => {
  const enrichMap = new Map(
    (enrichData ?? []).map((i) => [i.key, i])
  );

  // Map<epicKey, { summary, stories: Map<storyKey, { summary, subtasks: Map<subtaskKey, { summary, dayMap }> }> }>
  const epicMap = new Map<string, { summary: string; stories: Map<string, { summary: string; subtasks: Map<string, { summary: string; dayMap: Map<string, number> }> }> }>();
  const NO_EPIC = '__NO_EPIC__';

  for (const w of data ?? []) {
    const issueKey = w.issue.key;
    const enriched = enrichMap.get(issueKey);
    const isSubtask = enriched?.fields.issuetype.subtask ?? false;

    let epicKey: string;
    let storyKey: string;
    let subtaskKey: string | null = null;

    if (isSubtask) {
      const storyEnriched = enriched?.fields.parent ? enrichMap.get(enriched.fields.parent.key) : undefined;
      storyKey = enriched?.fields.parent?.key ?? NO_EPIC;
      epicKey = storyEnriched?.fields.parent?.key ?? NO_EPIC;
      subtaskKey = issueKey;
    } else {
      // Could be epic or story; check if it has a parent (story) or not (epic)
      const parentKey = enriched?.fields.parent?.key;
      if (parentKey) {
        // Story with epic parent
        epicKey = parentKey;
        storyKey = issueKey;
      } else {
        // Epic or orphan
        epicKey = issueKey;
        storyKey = issueKey; // logged directly on epic
      }
    }

    // Build nested maps and accumulate hours...
  }

  // ...
}, [data, enrichData, from, to]);
```

[VERIFIED: codebase — `w.issue.key` confirmed from `TempoWorklog` type in `tempo/types.ts` line 22 and test fixture line 113]

**Important subtlety:** Distinguish epics from stories using `enriched?.fields.issuetype.subtask` (false for both epics and stories) combined with whether the issue has a `parent` field. Issues without a parent and without `issuetype.subtask = true` are treated as epics. This is the correct approach per `jira.ts` line 153: "Use this — NOT name comparison. Admins can rename issue types."

### Pattern 3: Mutation + Cache Invalidation

```typescript
// Source: IssueDetailPage.tsx lines 270–291 — established pattern
const queryClient = useQueryClient();

const deleteEntryMutation = useMutation({
  mutationFn: async ({ issueKey, worklogId }: { issueKey: string; worklogId: string }) => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) throw new Error('No token');
    return deleteWorklog(jiraBaseUrl!, token, issueKey, worklogId);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ['tempo', 'worklogs', jiraBaseUrl, from, to],
    });
  },
});
```

[VERIFIED: codebase — `IssueDetailPage.tsx` lines 287–296 and WorklogsPage.tsx line 225 queryKey `['tempo', 'worklogs', jiraBaseUrl, from, to, selectedUsername ?? '']`]

**Cache invalidation key:** The exact key from WorklogsPage line 225 is `['tempo', 'worklogs', jiraBaseUrl, from, to, selectedUsername ?? '']`. Invalidate with prefix `['tempo', 'worklogs']` to catch all variations:

```typescript
queryClient.invalidateQueries({ queryKey: ['tempo', 'worklogs'] });
```

### Pattern 4: onIssueClick via useOutletContext

```typescript
// Source: BacklogPage.tsx line 191 — established pattern
import { useOutletContext } from 'react-router-dom';

const { onIssueClick } = useOutletContext<{
  onIssueClick: (issueKey: string, resetTrail?: boolean) => void;
}>();
```

WorklogsPage currently does NOT use `useOutletContext` at all. This is the primary new wiring needed. Compare with BacklogPage (line 191) and SprintBoardTab (line 516).

[VERIFIED: codebase — `main.tsx` line 546 passes `onIssueClick: handleIssueClick` via `Outlet context`; BacklogPage line 191 uses `useOutletContext`; WorklogsPage has no such pattern currently]

### Pattern 5: Sticky Table CSS

```typescript
// Source: 64-UI-SPEC.md §Layout Contracts; 64-CONTEXT.md D-15
// Also cross-referenced with MergeRequestListPage.tsx overflow containment pattern

// Table wrapper (already exists in WorklogsPage):
<div className="flex-1 overflow-auto px-6 py-4">
  <table className="w-full text-xs border-collapse">
    <thead>  {/* Note: do NOT add sticky class to thead — add to individual <th> cells */}
      <tr>
        {/* Corner cell: sticky both axes */}
        <th className="sticky top-0 left-0 z-30 bg-background text-left px-4 py-3 border border-border min-w-48 font-semibold text-muted-foreground">
          Issue
        </th>
        {/* Date headers: sticky top only */}
        <th className="sticky top-0 z-20 bg-background text-right px-4 py-3 border border-border min-w-14 font-semibold text-muted-foreground">
          {formatDayHeader(day)}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr>
        {/* Issue name column: sticky left only */}
        <td className="sticky left-0 z-10 bg-background px-4 py-3 border border-border">
          {issueName}
        </td>
        {/* Data cells */}
        <td className="text-right px-4 py-3 border border-border">
          {formatSeconds(secs)}
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

[VERIFIED: codebase — UI-SPEC.md §Layout Contracts confirmed; `overflow-auto` wrapper already exists in WorklogsPage.tsx line 564; `MergeRequestListPage.tsx` uses overflow-hidden + overflow-auto containment as reference]

### Pattern 6: WorklogCellPopover (issue + day)

The cell popover needs to show individual Tempo worklog entries for a specific `(issueKey, date)` pair. These are available from the raw `data` array — no additional API call needed:

```typescript
// Filter from raw worklogs data (available in scope)
const cellEntries = (data ?? []).filter(
  (w) => w.issue.key === issueKey && w.dateStarted === date
);
```

Each `TempoWorklog` entry has `tempoWorklogId` and `jiraWorklogId` — use `jiraWorklogId` as the string id for `updateWorklog`/`deleteWorklog` calls (these APIs take Jira worklog ID). If `jiraWorklogId` is undefined, fallback to `tempoWorklogId?.toString()`.

[VERIFIED: codebase — `TempoWorklog` type in `tempo/types.ts` lines 19–20; `updateWorklog` signature in `jira/worklogs.ts` line 106 takes `worklogId: string`]

### Anti-Patterns to Avoid

- **Iterating worklogs to build hierarchy by issuetype name:** Jira admins can rename issue types. Always use `issuetype.subtask` boolean to detect subtasks. For epic vs story distinction, use presence/absence of `parent` field on the enriched issue.
- **Using `toLocaleDateString()` for date bucketing:** WorklogsPage already uses `.slice(0, 10)` per Phase 62 rule. Never revert this.
- **Putting `jiraToken` in the enrichment query key:** WorklogsPage comment T-62-06 explicitly forbids this. Token goes in `enabled` guard, not queryKey.
- **Forgetting `bg-background` on sticky cells:** Without explicit background, scrolled content shows through sticky cells (bleed-through). All sticky `<th>` and `<td>` in the first column must have `bg-background`.
- **Opening LogWorkPopover inside WorklogCellPopover as a nested Radix Popover:** Nested Radix Popovers can conflict in focus management. Use LogWorkPopover's internal open state or pass an `open` prop. Alternatively, render LogWorkPopover's form inline (without its own Popover wrapper) inside WorklogCellPopover.
- **Closing WorklogCellPopover immediately on mutation:** UI-SPEC.md says keep popover open until `onSuccess`. Do not close on `mutate()` call.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worklog create form | Custom duration + date form | `LogWorkPopover` from `issue-detail/LogWorkPopover.tsx` | Already handles duration parsing, date formatting, token fetch, error display |
| Duration parsing | `"2h 30m"` parser | `parseDuration` from `@/services/jira/duration` | Already handles all formats; imported by LogWorkPopover |
| Popover trigger/portal | Custom absolute-positioned div | `Popover`/`PopoverContent`/`PopoverTrigger` from shadcn | Focus management, portal, z-index, accessibility all handled |
| Worklog CRUD API calls | Custom fetch | `createWorklog`, `updateWorklog`, `deleteWorklog` from `@/services/jira/worklogs` | Auth, error handling, ApiError typed exceptions all done |
| Jira issue batch fetch | Loop over individual issue fetches | `apiFetch` with `key in (...)` JQL (single request) | N individual fetches would be N×RTT vs 1 batch call |

---

## Common Pitfalls

### Pitfall 1: `w.issue.key` not `w.issueKey`
**What goes wrong:** CONTEXT.md and discussion shorthand uses `issueKey` as an accessor, but the actual `TempoWorklog` type has `issue: { key: string }`. Accessing `w.issueKey` returns `undefined`.
**Why it happens:** CONTEXT.md describes the value semantically, not the access path.
**How to avoid:** Always access as `w.issue.key`. Confirmed in `tempo/types.ts` line 22 and test fixture line 113.
**Warning signs:** TypeScript will catch this — `w.issueKey` is `never` on `TempoWorklog`.

### Pitfall 2: Enrichment query key stability
**What goes wrong:** If `uniqueKeys` is recomputed as a new array reference on every render (e.g., `data?.map(...)` inline in `enabled`), TanStack Query fires a new request on every render.
**Why it happens:** Array identity changes on every `.map()` call.
**How to avoid:** Compute `uniqueKeys` in a stable `useMemo`. Stringify the array or sort it before using as queryKey: `queryKey: ['jira', 'worklog-enrich', jiraBaseUrl, [...uniqueKeys].sort().join(',')]`.
**Warning signs:** Excessive network requests observed in DevTools.

### Pitfall 3: Epic vs Story detection without issuetype.name
**What goes wrong:** Using `issuetype.name === 'Epic'` to classify issues fails when admin has renamed the issue type.
**Why it happens:** Jira allows renaming issue types.
**How to avoid:** Use `issuetype.subtask === true` for subtasks. For epic vs story: an issue without `parent` field and without `issuetype.subtask` is treated as an epic (top of hierarchy). An issue with a `parent` field and `issuetype.subtask === false` is a story.
**Warning signs:** Issues not appearing in correct hierarchy tier.

### Pitfall 4: Nested Radix Popover focus conflict
**What goes wrong:** Rendering `LogWorkPopover` (which has its own `<Popover>` wrapper) inside `WorklogCellPopover` (also a `<Popover>`) creates nested Radix Popover state, causing one to close the other.
**Why it happens:** Radix Popover uses a context provider that manages `open` state; nesting them requires careful prop control.
**How to avoid:** Import `LogWorkPopover`'s form content directly (without its outer `<Popover>` wrapper), or use `LogWorkPopover`'s `open` prop (if exposed) to control it from the parent. Alternatively, render the add-entry form inline in `WorklogCellPopover` using the same fields/logic as `LogWorkPopover`.
**Warning signs:** "Add entry" click causes cell popover to close immediately.

### Pitfall 5: Cache invalidation key mismatch
**What goes wrong:** After mutation, table does not refresh because the invalidated key doesn't match the actual query key.
**Why it happens:** WorklogsPage queryKey is `['tempo', 'worklogs', jiraBaseUrl, from, to, selectedUsername ?? '']` — the username is the last element. Invalidating just `['tempo', 'worklogs']` as prefix does match (TanStack Query prefix matching).
**How to avoid:** Use prefix invalidation: `queryClient.invalidateQueries({ queryKey: ['tempo', 'worklogs'] })`. This catches all Tempo worklog queries regardless of the username/date suffix.
**Warning signs:** Table shows stale data after edit/delete/add; need to manually refresh.

### Pitfall 6: `overflow-auto` on wrong container
**What goes wrong:** Sticky columns don't stick if `overflow-auto` is on an ancestor element above the table wrapper, or if the table wrapper doesn't have explicit height.
**Why it happens:** CSS sticky requires the scroll container to be the immediate overflow parent.
**How to avoid:** Keep `overflow-auto` on the `.flex-1 overflow-auto px-6 py-4` div (line 564 of current WorklogsPage) — this div is already the correct scroll container. The `flex-1` gives it a bounded height.
**Warning signs:** Columns scroll away instead of sticking.

### Pitfall 7: Enrichment query fires with empty key list
**What goes wrong:** When `data` is an empty array (no worklogs), `uniqueKeys` is `[]`. The enrichment query might fire with `key in ()` which is invalid JQL.
**Why it happens:** `enabled` check only looks at `data` being defined, not at length.
**How to avoid:** Guard `enabled` with `uniqueKeys.length > 0`. Return early in `queryFn` if array is empty.
**Warning signs:** Jira API returns 400 for `key in ()`.

---

## Code Examples

### Hierarchy useMemo Structure

```typescript
// Source: 64-CONTEXT.md §Specific Ideas

type DayMap = Map<string, number>; // date -> seconds
type SubtaskNode = { summary: string; dayMap: DayMap; entries: TempoWorklog[] };
type StoryNode = { summary: string; dayMap: DayMap; entries: TempoWorklog[]; subtasks: Map<string, SubtaskNode> };
type EpicNode = { summary: string; dayMap: DayMap; entries: TempoWorklog[]; stories: Map<string, StoryNode> };

// Top-level map uses epicKey or '__NO_EPIC__' for orphaned stories
type HierarchyMap = Map<string, EpicNode>;
```

### WorklogCellPopover Trigger

```typescript
// Source: 64-UI-SPEC.md §Cell Click Popover
// Non-zero cell wraps content in a button for accessibility
{secs > 0 ? (
  <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button
        type="button"
        className="w-full text-right"
        aria-label={`View worklogs for ${issueKey} on ${date}`}
      >
        {formatSeconds(secs)}
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-72 p-4">
      {/* WorklogCellPopover content */}
    </PopoverContent>
  </Popover>
) : null}
```

### EditWorklogForm Interaction

```typescript
// Source: 64-UI-SPEC.md §EditWorklogForm
// IssueDetailPage.tsx lines 260–285 — direct model

// Duration is pre-populated using formatSeconds (or DurationInput format)
// The `started` field must use the worklog's existing started date
// Jira worklog API requires "+0000" not "Z" (per LogWorkPopover.tsx line 75)
const started = new Date(`${date}T12:00:00`).toISOString().replace('Z', '+0000');
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Person×day pivot table | Issue hierarchy table | Phase 64 | Rows are now issues, not people |
| No issue enrichment | Batch JQL `key in (...)` | Phase 64 | Single dependent query; N+1 avoided |
| No cell editing | WorklogCellPopover with CRUD | Phase 64 | Jira worklog API (already exists) wired to table |
| No issue navigation from table | onIssueClick via outlet context | Phase 64 | Same pattern as BacklogPage |

**Deprecated/outdated in this phase:**
- `pivot` useMemo in WorklogsPage — replaced by `hierarchy` useMemo
- `pivot` pivot table render (person rows) — replaced by epic/story/subtask row tree

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `jiraWorklogId` on `TempoWorklog` is the correct ID to pass to `updateWorklog`/`deleteWorklog` | Code Examples §WorklogCellPopover | Mutations would fail with 404; fallback to `tempoWorklogId?.toString()` |
| A2 | Stories can be identified as "has parent, issuetype.subtask === false"; epics as "no parent, issuetype.subtask === false" | Architecture Patterns §Pattern 2 | Issues might be mis-classified into wrong hierarchy tier |
| A3 | The enrichment query with `key in (...)` JQL will handle up to ~200 keys in a single call without hitting Jira query length limits | Don't Hand-Roll | For very large date ranges, might need to batch in chunks of 100 |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.
*All three assumptions are LOW-MEDIUM risk; A1 can be verified at runtime in dev; A2 is the established pattern; A3 is a graceful degradation concern only.*

---

## Open Questions

1. **LogWorkPopover nesting inside WorklogCellPopover**
   - What we know: `LogWorkPopover` has its own `<Popover>` wrapper and manages its own `open` state. Radix Popovers can be nested but focus/dismiss behavior may conflict.
   - What's unclear: Whether importing LogWorkPopover as-is inside another Popover works without modification.
   - Recommendation: Render the "add entry" form fields inline in WorklogCellPopover (duplicating LogWorkPopover's form), OR extract a `LogWorkForm` (form without Popover wrapper) and use it in both places. The inline approach is simpler for a single phase.

2. **jiraWorklogId vs tempoWorklogId for edit/delete**
   - What we know: `TempoWorklog` has both `jiraWorklogId?: number` and `tempoWorklogId?: number`. The Jira worklog API requires the Jira-native worklog ID.
   - What's unclear: Whether the Tempo v3 API always populates `jiraWorklogId`.
   - Recommendation: Use `w.jiraWorklogId?.toString()` with a runtime guard. If null/undefined, show a warning and disable edit/delete for that entry.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is code-only changes. No external tools, CLIs, databases, or services beyond the existing Jira + Tempo integration (already confirmed working in Phase 61).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library |
| Config file | `taskflow/vite.config.ts` |
| Quick run command | `cd taskflow && npx vitest run src/routes/worklogs/WorklogsPage.test.tsx` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEMPO-08 | Table renders epic/story/subtask row hierarchy | unit | `npx vitest run WorklogsPage.test.tsx` | ✅ (update existing) |
| TEMPO-08 | Epic rows shown with bold + bg-muted/40 | unit | `npx vitest run WorklogsPage.test.tsx` | ✅ (new test) |
| TEMPO-08 | Story rows indented (pl-4), subtask rows (pl-8) | unit | `npx vitest run WorklogsPage.test.tsx` | ✅ (new test) |
| TEMPO-08 | Unresolvable issue key shown with strikethrough | unit | `npx vitest run WorklogsPage.test.tsx` | ✅ (new test) |
| TEMPO-08 | "No Epic" group for orphaned stories | unit | `npx vitest run WorklogsPage.test.tsx` | ✅ (new test) |
| TEMPO-09 | Non-zero cell click opens popover | unit | `npx vitest run WorklogsPage.test.tsx` | ✅ (new test) |
| TEMPO-09 | Popover shows individual entry rows | unit | `npx vitest run WorklogsPage.test.tsx` | ✅ (new test) |
| (implicit) | Delete entry calls deleteWorklog + invalidates cache | unit | `npx vitest run WorklogsPage.test.tsx` | ✅ (new test) |
| (implicit) | Clicking issue row calls onIssueClick | unit | `npx vitest run WorklogsPage.test.tsx` | ✅ (new test) |
| D-08 | Zero cells blank | unit | `npx vitest run WorklogsPage.test.tsx` | ✅ (existing, keep) |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run src/routes/worklogs/WorklogsPage.test.tsx`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
The existing `WorklogsPage.test.tsx` tests the old pivot table structure (person rows). Many existing tests will break when the table structure changes. The test file must be updated in Wave 0 / first plan before implementation:
- [ ] Mock `fetchJiraEnrichment` (new dependent query function) in `WorklogsPage.test.tsx`
- [ ] Mock `useOutletContext` for `onIssueClick` in `WorklogsPage.test.tsx`
- [ ] Mock `updateWorklog`/`deleteWorklog` for mutation tests
- [ ] Update `makeWorklog` fixture to include issue enrichment data

*(Existing tests for TEMPO-01/02/03/04/05/07 must still pass — filter bar is unchanged.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Token already handled by existing readSecret / apiFetch pattern |
| V3 Session Management | no | No new session management |
| V4 Access Control | no | Jira enforces access control server-side; deleteWorklog/updateWorklog return 403 for unauthorized |
| V5 Input Validation | yes | Duration input — use `parseDuration` (existing validated parser); no raw user input goes to API without parsing |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious JQL injection via issueKey | Tampering | `w.issue.key` values come from Tempo API response, not user input; safe to interpolate in `key in (...)` JQL |
| Unauthorized worklog delete | Elevation | Jira REST API enforces permissions; `deleteWorklog` returns 403 for unauthorized — caught by `ApiError` |
| XSS in worklog comment display | Tampering | React renders comment as text node — no `dangerouslySetInnerHTML` |

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/routes/worklogs/WorklogsPage.tsx` — current implementation, all state/query patterns
- `taskflow/src/services/tempo/types.ts` — `TempoWorklog` type (w.issue.key confirmed)
- `taskflow/src/services/jira/worklogs.ts` — `createWorklog`, `updateWorklog`, `deleteWorklog` signatures
- `taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx` — reusable form component
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` lines 260–291 — mutation + invalidation pattern
- `taskflow/src/main.tsx` lines 314, 544–553 — `handleIssueClick` + Outlet context
- `taskflow/src/routes/dashboard/BacklogPage.tsx` line 191 — `useOutletContext` pattern
- `taskflow/src/services/jira.ts` lines 2244–2248 — batch `issuekey in (...)` JQL pattern
- `.planning/phases/64-redo-worklogs-page-with-epic-story-subtask-hierarchy-sticky-/64-CONTEXT.md`
- `.planning/phases/64-redo-worklogs-page-with-epic-story-subtask-hierarchy-sticky-/64-UI-SPEC.md`

### Secondary (MEDIUM confidence)
- `taskflow/src/routes/routes.tsx` — WorklogsPage lazy route (no onIssueClick prop — must switch to useOutletContext)
- `taskflow/src/routes/worklogs/WorklogsPage.test.tsx` — test structure to update

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified by codebase inspection
- Architecture: HIGH — all patterns verified against existing codebase implementations
- Pitfalls: HIGH — derived from code inspection of actual types and existing patterns
- Test map: HIGH — existing test file structure verified

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable — no external dependencies changing)
