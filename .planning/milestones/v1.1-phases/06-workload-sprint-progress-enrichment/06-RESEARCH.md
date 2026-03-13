# Phase 6: Workload + Sprint Progress Enrichment - Research

**Researched:** 2026-03-12
**Domain:** React/TypeScript UI enrichment — data aggregation, expandable table rows, stacked bar, time formatting
**Confidence:** HIGH

## Summary

Phase 6 is a pure UI-layer phase. No new API calls are required. The `fetchSprintIssues` result already includes subtask issues (from Phase 5's two-query strategy) and the `timetracking` field is already in the `JiraIssue` type. Both tabs share the `['jira-issues', 'sprint-board', activeJiraProject]` TanStack cache — all work is in the `useMemo` data-shaping layer and the JSX render layer.

The three central risks are: (1) correctly filtering subtasks vs stories in the aggregate loop using `issue.fields.issuetype.subtask === true`, (2) graceful-hiding the time columns when all `originalEstimateSeconds` / `timeSpentSeconds` / `remainingEstimateSeconds` values are zero or undefined, and (3) reading story points via `issue.fields[storyPointsFieldKey]` from `useSettingsStore` rather than the hardcoded `customfield_10016`.

`@base-ui/react` is already installed and exports a `Collapsible` component; no new dependency is needed for expand/collapse. The existing tests for both tabs must be updated — the test factory functions (`makeIssue`) will need new fields and the expected DOM assertions will change significantly.

**Primary recommendation:** Reshape both tabs' `useMemo` blocks first (pure logic, fully testable), then replace the JSX render layer in a second pass.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full table with column headers: Assignee / Tasks / Pts / Est / Spent / Remaining
- Replaces the current flat inline row layout
- Rows sorted by open task count descending (existing behavior kept)
- Hide Est / Spent / Remaining columns entirely if no issues in the sprint have time tracking data (fields null/zero). Do NOT show dashes or a notice — columns simply don't appear when time tracking is admin-disabled
- Aggregate row per assignee shows totals (Tasks / Pts / Est / Spent / Remaining)
- Expand arrow reveals per-story rows below the assignee row (story key + name + pts + time columns)
- All assignee rows default to collapsed on load
- Story points field comes from `discoverStoryPointsField()` result cached in settings store (not hardcoded `customfield_10016`)
- Story points → parent stories only; subtasks are excluded from point totals (WORK-01 fix)
- Time tracking (Est / Spent / Remaining) → aggregate from both stories and their subtasks under the assignee
- Issue count (Tasks column) → non-done issues only, stories only (no subtasks)
- Stacked bar replaces existing single-colour progress bar; three-segment: gray = To Do, blue = In Progress, green = Done (by issue count proportions)
- Inline label below bar: "27% to do · 20% in progress · 53% done" (muted small text, always visible)
- Bar only shown when sprint has issues (same guard as existing progress bar)
- Existing To Do / In Progress / Done count rows kept as-is; stories only (subtasks excluded from counts)
- Percentages in inline label below stacked bar, not repeated next to each count row
- Sprint Time summary row above per-assignee table: "Sprint Time  Total Est: 80h · Spent: 45h · Remaining: 35h"
- Time totals aggregate from both stories and subtasks in the sprint
- Hidden entirely if no time tracking data exists (same graceful-hide rule as Workload)
- Per-assignee breakdown table: Assignee / To Do pts / In Progress pts / Done pts
- Points use parent story values only; story status drives which bucket the points fall in
- No time tracking columns in Sprint Progress per-assignee table

### Claude's Discretion
- Expand/collapse toggle icon and animation
- Exact time formatting (e.g. "4h 30m" vs "4.5h" — pick what's readable)
- Per-story row indent depth and styling within expandable section
- Stacked bar segment colors (stay in dark/light theme range)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WORK-01 | User sees correct story points per assignee (subtasks excluded from point totals) | Filter `issue.fields.issuetype.subtask === true`; only accumulate pts for stories |
| WORK-02 | User sees original estimate, time spent, and remaining estimate columns per assignee | Read `timetracking.originalEstimateSeconds` / `timeSpentSeconds` / `remainingEstimateSeconds` from JiraIssue; aggregate stories + subtasks; convert seconds → "Xh Ym"; graceful-hide when all zero |
| WORK-03 | User sees time tracking aggregated at story level under each assignee | Expandable rows via `@base-ui/react` Collapsible; per-story rows show key + summary + pts + time; subtask time rolled into parent row display |
| SPPG-01 | User sees story points broken down by status bucket (To Do / In Progress / Done with counts and %) | Extend existing `useMemo`; filter to stories only; accumulate pts by `statusCategory.key`; stacked bar CSS; percentage label |
| SPPG-02 | User sees sprint-wide time totals (total estimate vs total time logged) | Sum `originalEstimateSeconds` / `timeSpentSeconds` / `remainingEstimateSeconds` across all issues (stories + subtasks); graceful-hide when zero |
| SPPG-03 | User sees per-assignee breakdown table with point counts and time tracking | Build `Map<assignee, { todo: number, inProgress: number, done: number }>` in same `useMemo`; render as table below time summary |
</phase_requirements>

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + TypeScript | 18.x | Component rendering | Project baseline |
| `@tanstack/react-query` | 5.x | Cache shared with SprintBoard | Already in use; `queryKey` must match exactly |
| `@base-ui/react` | installed | Collapsible expand/collapse rows | Already installed; has `Collapsible` export |
| Tailwind CSS | 3.x | Styling | Project baseline |
| Zustand `useSettingsStore` | — | Read `storyPointsFieldKey` | Established in Phase 5 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | installed | Toggle icon (e.g. `ChevronRight` rotated on expand) | Already used in both tabs for RefreshCw |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@base-ui/react` Collapsible | Manual `useState` open set + conditional render | Manual state is simpler and fine here — no animation requirement from locked decisions. Either works; Collapsible gives accessible markup for free |
| CSS flex stacked bar | `<progress>` multi-segment | CSS flex is simpler and theme-consistent; `<progress>` has cross-browser styling limitations |

**Installation:** No new installs needed.

---

## Architecture Patterns

### Data Flow (both tabs)

```
fetchSprintIssues result (cached)
  ↓ [includes both stories and subtasks from Phase 5 two-query strategy]
useMemo (partition + aggregate)
  ├── filter: issuetype.subtask === true → subtask pool
  ├── filter: issuetype.subtask === false → story pool
  ├── read storyPointsFieldKey from useSettingsStore
  └── build row structures
        ↓
JSX render layer
```

### Pattern 1: Subtask Partitioning

**What:** In any `useMemo` that receives the raw issue array from the sprint-board cache, partition into stories and subtasks before any counting.

**When to use:** Both WorkloadTab and SprintProgressTab. Mandatory for WORK-01 and SPPG-01 correctness.

**Example:**
```typescript
// Source: CONTEXT.md code_context + jira.ts JiraIssue type
const issues = data ?? [];
const stories = issues.filter((i) => !i.fields.issuetype.subtask);
const subtasks = issues.filter((i) => i.fields.issuetype.subtask);
// Always use .subtask boolean — NOT name comparison. Admin can rename issue types.
```

### Pattern 2: Story Points via Discovered Field Key

**What:** Read the story points field key from `useSettingsStore` and use index access with the `[key: string]: unknown` escape hatch on `JiraIssue.fields`.

**When to use:** Every place `customfield_10016` was previously hardcoded.

**Example:**
```typescript
// Source: settings.store.ts + jira.ts JiraIssue interface
const { storyPointsFieldKey } = useSettingsStore();

// Inside useMemo (storyPointsFieldKey in closure):
const pts = (issue.fields[storyPointsFieldKey] as number | null) ?? 0;
```

Note: `useSettingsStore` must be called at the component level (React hook rule), then passed into or closed over by `useMemo`.

### Pattern 3: Graceful-Hide for Time Tracking Columns

**What:** After aggregating all time values, check if the sprint has any non-zero time data at all. If not, omit the time columns from the table header and all rows.

**When to use:** WorkloadTab time columns (Est / Spent / Remaining). Sprint Progress time totals row.

**Example:**
```typescript
const hasTimeData = issues.some(
  (i) =>
    (i.fields.timetracking?.originalEstimateSeconds ?? 0) > 0 ||
    (i.fields.timetracking?.timeSpentSeconds ?? 0) > 0 ||
    (i.fields.timetracking?.remainingEstimateSeconds ?? 0) > 0,
);
```

### Pattern 4: Seconds-to-Hours Formatting

**What:** Convert Jira's `originalEstimateSeconds` (integer) to a readable duration string.

**When to use:** All time display in WorkloadTab and SprintProgressTab time summary.

**Recommendation (Claude's discretion):** Use `"Xh Ym"` format (e.g. `"4h 30m"`). This matches Jira's own time display convention and is more readable than decimal `"4.5h"`. Zero minutes are omitted: `"8h"` not `"8h 0m"`.

**Example:**
```typescript
function formatSeconds(secs: number): string {
  if (secs === 0) return '0h';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
```

### Pattern 5: WorkloadTab Expand/Collapse

**What:** Each assignee row is a `@base-ui/react` Collapsible wrapper. The trigger is the assignee row itself (or a chevron button). Content panel renders per-story sub-rows.

**When to use:** WorkloadTab only. All rows default collapsed on mount.

**`@base-ui/react` Collapsible structure:**
```typescript
// Source: @base-ui/react package exports './collapsible'
import { Collapsible } from '@base-ui-components/react/collapsible';

<Collapsible.Root defaultOpen={false}>
  <Collapsible.Trigger>
    {/* assignee summary row */}
  </Collapsible.Trigger>
  <Collapsible.Panel>
    {/* per-story rows */}
  </Collapsible.Panel>
</Collapsible.Root>
```

**Alternative (simpler, no animation):** Use local `useState<Set<string>>` in WorkloadTab to track which assignee names are expanded. Toggle on click. Render per-story rows conditionally. This avoids `@base-ui/react` API surface area in tests and is fully adequate since animations are at Claude's discretion.

**Recommendation:** Use the simple `useState` open-set pattern for testability and simplicity. Reserve `@base-ui/react` Collapsible if animation is needed later.

### Pattern 6: Stacked Bar (SprintProgressTab)

**What:** Three `div` segments inside a shared flex container, widths set via inline `style={{ width: '${pct}%' }}`.

**When to use:** Replaces existing single-color progress bar.

**Example:**
```tsx
// Three-segment stacked bar
<div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
  <div style={{ width: `${todoPct}%` }}   className="bg-slate-400" />
  <div style={{ width: `${inProgPct}%` }} className="bg-blue-500" />
  <div style={{ width: `${donePct}%` }}   className="bg-green-500" />
</div>
<p className="text-xs text-muted-foreground">
  {todoPct}% to do · {inProgPct}% in progress · {donePct}% done
</p>
```

Percentages based on issue count (not points). Guard: only show when `total > 0`.

### Anti-Patterns to Avoid

- **Name comparison for subtask detection:** `issue.fields.issuetype.name === 'Sub-task'` — WRONG. Admin can rename. Always use `issue.fields.issuetype.subtask === true`.
- **Hardcoded `customfield_10016` for points:** Must use `storyPointsFieldKey` from settings store.
- **Showing dashes when time tracking is disabled:** Locked decision is to hide the columns entirely, not show zeros or dashes.
- **useSettingsStore inside useMemo:** Hook calls must be at component level. Pass the key as a dependency to `useMemo`.
- **Per-story time rows showing subtask-level detail:** The expand reveals per-story rows (story key + name + pts + time); subtask time is already rolled into the story's aggregated time display — individual subtask rows are NOT shown.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Expand/collapse row | Custom animation with CSS transitions | Simple `useState` open set | Sufficient; animations at Claude's discretion; avoids Collapsible API surface in tests |
| Time conversion | Custom duration library | `formatSeconds()` inline utility | Domain is seconds → "Xh Ym"; a 5-line function is correct and complete |
| Stacked bar | Chart library | Three `div`s in a `flex` container | No chart library installed; CSS is sufficient and theme-aware |

---

## Common Pitfalls

### Pitfall 1: Double-Counting When Subtasks Are in the Array

**What goes wrong:** Phase 5 now returns both stories AND subtasks in the same array from `fetchSprintIssues`. The old loop counted every issue, so adding subtasks to the array doubles the count.

**Why it happens:** The two-query strategy was added in Phase 5; the consuming tabs haven't been updated to filter.

**How to avoid:** Always partition into `stories` and `subtasks` arrays at the top of `useMemo` using `issuetype.subtask`. Only count stories for points/task-counts.

**Warning signs:** Point totals that are 2x or higher than expected; task counts exceeding the number of stories.

### Pitfall 2: storyPointsFieldKey Read Outside useMemo Dependency Array

**What goes wrong:** The story points field key is read inside `useMemo` but not listed as a dependency. If the key changes after mount (rare but possible), stale values are used.

**How to avoid:** Call `useSettingsStore` at the component level, destructure `storyPointsFieldKey`, and include it in the `useMemo` dependency array.

### Pitfall 3: Time Tracking Fields Absent vs Zero

**What goes wrong:** `timetracking` field is `undefined` when Jira admin has disabled time tracking. Accessing `.originalEstimateSeconds` directly throws. Using `?.` correctly returns `undefined`, which coerces to `NaN` in arithmetic.

**How to avoid:** Use `?? 0` at each access: `issue.fields.timetracking?.originalEstimateSeconds ?? 0`.

### Pitfall 4: Sprint Progress Per-Assignee Table — Points Bucketing

**What goes wrong:** Using the subtask's status instead of the parent story's status to assign points to a bucket. Subtasks don't have story points in Jira — only stories do.

**How to avoid:** Build the per-assignee breakdown from the `stories` array only. Use `story.fields.status.statusCategory?.key` to determine the bucket. Subtasks are never referenced here.

### Pitfall 5: Existing Tests Break on makeIssue Shape Change

**What goes wrong:** Both test files use a `makeIssue` factory that lacks `timetracking`, `parent`, and the correct `issuetype.subtask` field. After Phase 6, the component code reads these fields and the tests fail with wrong counts/assertions.

**How to avoid:** Update `makeIssue` in both test files to include `timetracking: null` (or a valid object) and ensure `subtask: false` is set for story fixtures. Add new test cases for subtask-excluded counting.

---

## Code Examples

### WorkloadTab — New WorkloadRow Interface

```typescript
// Source: CONTEXT.md decisions + jira.ts timetracking type
interface WorkloadStoryRow {
  key: string;
  summary: string;
  points: number;
  estSecs: number;
  spentSecs: number;
  remainSecs: number;
}

interface WorkloadRow {
  name: string;
  count: number;         // non-done story count only
  points: number;        // story points only (no subtasks)
  estSecs: number;       // stories + subtasks aggregated
  spentSecs: number;
  remainSecs: number;
  stories: WorkloadStoryRow[];  // for expandable detail
}
```

### WorkloadTab — useMemo Aggregation Skeleton

```typescript
const { storyPointsFieldKey } = useSettingsStore();

const { rows, hasTimeData } = useMemo(() => {
  const issues = data ?? [];
  const stories = issues.filter((i) => !i.fields.issuetype.subtask);
  const subtasks = issues.filter((i) => i.fields.issuetype.subtask);

  const map = new Map<string, WorkloadRow>();

  // Accumulate story-level data
  for (const story of stories) {
    const cat = story.fields.status.statusCategory?.key ?? 'new';
    const name = story.fields.assignee?.displayName ?? 'Unassigned';
    const pts = (story.fields[storyPointsFieldKey] as number | null) ?? 0;
    const tt = story.fields.timetracking;
    const existing = map.get(name) ?? { name, count: 0, points: 0, estSecs: 0, spentSecs: 0, remainSecs: 0, stories: [] };

    existing.points += pts;
    existing.estSecs += tt?.originalEstimateSeconds ?? 0;
    existing.spentSecs += tt?.timeSpentSeconds ?? 0;
    existing.remainSecs += tt?.remainingEstimateSeconds ?? 0;
    if (cat !== 'done') existing.count += 1;
    existing.stories.push({ key: story.key, summary: story.fields.summary, points: pts, estSecs: tt?.originalEstimateSeconds ?? 0, spentSecs: tt?.timeSpentSeconds ?? 0, remainSecs: tt?.remainingEstimateSeconds ?? 0 });
    map.set(name, existing);
  }

  // Accumulate subtask time into assignee bucket (no points, no count)
  for (const sub of subtasks) {
    const name = sub.fields.assignee?.displayName ?? 'Unassigned';
    const tt = sub.fields.timetracking;
    const existing = map.get(name);
    if (!existing) continue; // subtask assignee not in any story — skip
    existing.estSecs += tt?.originalEstimateSeconds ?? 0;
    existing.spentSecs += tt?.timeSpentSeconds ?? 0;
    existing.remainSecs += tt?.remainingEstimateSeconds ?? 0;
  }

  const rows = Array.from(map.values()).sort((a, b) => b.count - a.count);
  const hasTimeData = rows.some((r) => r.estSecs > 0 || r.spentSecs > 0 || r.remainSecs > 0);
  return { rows, hasTimeData };
}, [data, storyPointsFieldKey]);
```

### SprintProgressTab — Extended useMemo Skeleton

```typescript
const { storyPointsFieldKey } = useSettingsStore();

const computed = useMemo(() => {
  const issues = data ?? [];
  const stories = issues.filter((i) => !i.fields.issuetype.subtask);

  let todo = 0, inProgress = 0, done = 0;
  let ptsTodo = 0, ptsInProgress = 0, ptsDone = 0;
  const assigneeMap = new Map<string, { todo: number; inProgress: number; done: number }>();

  for (const story of stories) {
    const cat = story.fields.status.statusCategory?.key ?? 'new';
    const pts = (story.fields[storyPointsFieldKey] as number | null) ?? 0;
    const assignee = story.fields.assignee?.displayName ?? 'Unassigned';
    const bucket = assigneeMap.get(assignee) ?? { todo: 0, inProgress: 0, done: 0 };

    if (cat === 'done') { done++; ptsDone += pts; bucket.done += pts; }
    else if (cat === 'indeterminate') { inProgress++; ptsInProgress += pts; bucket.inProgress += pts; }
    else { todo++; ptsTodo += pts; bucket.todo += pts; }
    assigneeMap.set(assignee, bucket);
  }

  const total = todo + inProgress + done;
  const todoPct = total > 0 ? Math.round((todo / total) * 100) : 0;
  const inProgPct = total > 0 ? Math.round((inProgress / total) * 100) : 0;
  const donePct = total > 0 ? 100 - todoPct - inProgPct : 0; // avoid rounding gap

  // Time totals: stories + subtasks
  let totalEstSecs = 0, totalSpentSecs = 0, totalRemainSecs = 0;
  for (const issue of issues) {
    const tt = issue.fields.timetracking;
    totalEstSecs += tt?.originalEstimateSeconds ?? 0;
    totalSpentSecs += tt?.timeSpentSeconds ?? 0;
    totalRemainSecs += tt?.remainingEstimateSeconds ?? 0;
  }
  const hasTimeData = totalEstSecs > 0 || totalSpentSecs > 0 || totalRemainSecs > 0;
  const hasPoints = stories.some((s) => ((s.fields[storyPointsFieldKey] as number | null) ?? 0) > 0);

  return { todo, inProgress, done, ptsTodo, ptsInProgress, ptsDone, todoPct, inProgPct, donePct, total, totalEstSecs, totalSpentSecs, totalRemainSecs, hasTimeData, hasPoints, assigneeRows: Array.from(assigneeMap.entries()) };
}, [data, storyPointsFieldKey]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `customfield_10016` for points | `storyPointsFieldKey` from settings store | Phase 5 | All point reads must use discovered key |
| Sprint issues = stories only | Sprint issues = stories + subtasks | Phase 5 | Every aggregation loop must partition first |
| Single-color progress bar | Three-segment stacked bar | Phase 6 (this phase) | Replaces existing `data-testid="progress-bar"` — test assertions must be updated |
| Flat `div` row layout | Table with column headers | Phase 6 (this phase) | `data-testid="workload-row"` shape changes — test assertions must be updated |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run src/routes/dashboard/WorkloadTab.test.tsx src/routes/dashboard/SprintProgressTab.test.tsx` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WORK-01 | Subtasks excluded from assignee story point totals | unit | `npx vitest run src/routes/dashboard/WorkloadTab.test.tsx` | ✅ (needs new test case) |
| WORK-02 | Est / Spent / Remaining columns present when time data exists; absent when all zero | unit | `npx vitest run src/routes/dashboard/WorkloadTab.test.tsx` | ✅ (needs new test cases) |
| WORK-03 | Expand arrow shows per-story rows; collapsed by default | unit | `npx vitest run src/routes/dashboard/WorkloadTab.test.tsx` | ✅ (needs new test cases) |
| SPPG-01 | Stacked bar shows three segments with correct percentages; stories only in bucket counts | unit | `npx vitest run src/routes/dashboard/SprintProgressTab.test.tsx` | ✅ (needs updated assertions) |
| SPPG-02 | Time totals row shown when time data exists; hidden when all zero | unit | `npx vitest run src/routes/dashboard/SprintProgressTab.test.tsx` | ✅ (needs new test cases) |
| SPPG-03 | Per-assignee breakdown table shows correct To Do / In Progress / Done pts per assignee | unit | `npx vitest run src/routes/dashboard/SprintProgressTab.test.tsx` | ✅ (needs new test cases) |

### Sampling Rate

- **Per task commit:** `cd taskflow && npx vitest run src/routes/dashboard/WorkloadTab.test.tsx src/routes/dashboard/SprintProgressTab.test.tsx`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. Both test files exist and use the established `renderWithQuery` + `vi.mock` pattern. The `makeIssue` factory functions in each test file need new fields (`timetracking`, subtask flag set to `true` for subtask fixtures) but the files themselves are present and runnable.

---

## Open Questions

1. **Subtask time attribution strategy in WorkloadTab**
   - What we know: Locked decision says "aggregate subtask time under the assignee". The current implementation aggregates subtask time by the subtask's own assignee field.
   - What's unclear: If a subtask assignee is different from the parent story assignee, the time gets attributed to the subtask assignee's row — not the story assignee's row. This seems correct (the subtask assignee did the work), but no explicit decision was made.
   - Recommendation: Attribute subtask time to the subtask's own assignee. This is the natural reading of "aggregate from both stories and their subtasks under the assignee."

2. **Stacked bar rounding gap**
   - What we know: Three percentages computed independently via `Math.round` can sum to 99% or 101%.
   - What's unclear: Whether the user cares about the gap.
   - Recommendation: Compute `todoPct` and `inProgPct` via `Math.round`; set `donePct = 100 - todoPct - inProgPct`. This ensures bar segments always sum to 100%.

3. **Time data on the Orange Jira DC instance**
   - What we know: State.md notes "Verify time tracking admin status on Orange Jira instance — graceful-hide may be the only visible result."
   - What's unclear: Whether any time tracking data will actually appear.
   - Recommendation: The graceful-hide path is already the primary design. Both columns and time totals are hidden when all values are zero. This means the phase will appear "correct" even if time tracking is disabled on the real instance.

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `taskflow/src/routes/dashboard/WorkloadTab.tsx` — current implementation baseline
- Direct code inspection: `taskflow/src/routes/dashboard/SprintProgressTab.tsx` — current implementation baseline
- Direct code inspection: `taskflow/src/services/jira.ts` — `JiraIssue` type with `timetracking`, `issuetype.subtask`, `[key: string]: unknown` index signature; `fetchSprintIssues` two-query strategy
- Direct code inspection: `taskflow/src/stores/settings.store.ts` — `storyPointsFieldKey: string` confirmed present with default `'customfield_10016'`
- Direct code inspection: `taskflow/src/routes/dashboard/WorkloadTab.test.tsx` — existing test structure, `makeIssue` factory
- Direct code inspection: `taskflow/src/routes/dashboard/SprintProgressTab.test.tsx` — existing test structure
- `@base-ui/react` package exports — `./collapsible` confirmed present in installed package

### Secondary (MEDIUM confidence)

- `.planning/phases/06-workload-sprint-progress-enrichment/06-CONTEXT.md` — all locked decisions; code context section specifies exact field names and integration points
- `.planning/STATE.md` — accumulated decisions confirming two-query strategy, `issuetype.subtask` usage, graceful-hide rule

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed via `node_modules` inspection and `package.json`
- Architecture: HIGH — all patterns derived directly from existing code and locked decisions; no external dependencies
- Pitfalls: HIGH — each pitfall derived from the concrete diff between Phase 5 output and current tab code

**Research date:** 2026-03-12
**Valid until:** Stable — no external dependencies being introduced; valid until Phase 7
