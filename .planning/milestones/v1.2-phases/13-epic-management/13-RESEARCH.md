# Phase 13: Epic Management - Research

**Researched:** 2026-03-14
**Domain:** Jira Epic API + React component patterns (full-page route, slide-over sheet, filter bar, create dialog)
**Confidence:** HIGH

## Summary

Phase 13 adds the last major surface in the v1.2 Jira Parity milestone: a dedicated epics page, epic detail slide-over, cross-view filtering on the sprint board, and a create-epic dialog. Every decision is locked in CONTEXT.md and the architecture maps directly onto patterns already established in phases 9-12. No new libraries are needed.

The epics list fetches via JQL (`issuetype = Epic ORDER BY updated DESC`), then enriches per-epic with a second JQL to get child story counts and points — the same two-query enrichment pattern used by `fetchBacklogView`. The epic detail sheet follows the exact component pattern of `IssueDetailSheet`. The sprint board epic filter is a subset of `BacklogFilterBar`. The create-epic dialog uses `createIssue()` with `{ issuetype: 'Epic', [epicNameFieldKey]: epicName }` — no createmeta call required since the field set is fixed and instance-specific.

**Primary recommendation:** Build in four plans — (1) jira.ts service functions + types, (2) EpicsPage route + sidebar link, (3) EpicDetailSheet + AppLayout wiring, (4) SprintBoardEpicFilter + CreateEpicDialog. Each plan is independently testable and maps one-to-one to requirement groups.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Epic list surface**
- Full-page `/epics` route, same pattern as `/backlog`
- Sidebar: shared section above role-specific links — visible to both Developer and PM (not inside either role section)
- Each row shows: epic name + status badge + story count + total story points + completion progress bar (done stories / total) + assignee avatars of contributors
- Data loading: fetch epics first via JQL (`issuetype = Epic ORDER BY updated DESC`), then enrich per-epic to get story counts and points

**Epic detail view**
- Opens as a wide sheet slide-over (same pattern as IssueDetailSheet, ~85vw)
- Internal layout is two-column: left column = stories list, right sidebar = epic metadata (status, description, dates)
- Stories list rows: issue key + summary + status badge + assignee avatar + story points
- Clicking a story row opens IssueDetailSheet for that story (reuses existing infrastructure at AppLayout level)
- Opened from: clicking the epic name row on the `/epics` list

**Sprint board epic filter (EPIC-02)**
- Filter bar at the top of the sprint board — epic-only combobox, same visual style as BacklogFilterBar
- When an epic filter is active: hide story header rows whose epic link doesn't match (and their subtask cards). Stories with no epic are hidden when any filter is active.
- Per-view local state — independent from the backlog's epic filter. Each view has its own controls.

**Create epic (EPIC-04)**
- Entry point: "+ Create Epic" button in the `/epics` page header
- Separate simpler dialog — not the existing CreateEditIssueModal (avoids createmeta complexity for Epic type)
- Fields: Epic Name (required, uses instance-specific epic name custom field) + Description (optional) + Assignee (optional) + Priority (optional)
- On success: invalidate epics list cache

### Claude's Discretion
- Epic badge click behavior in backlog rows and sprint board cards (currently calls `onIssueClick(epicKey)` which opens IssueDetailSheet for the epic as a raw issue) — Claude decides whether to repurpose to open the new EpicDetailSheet or keep current behavior
- Exact epic name field ID submission on create (use the `epicNameFieldKey` from settings store, discovered via `com.pyxis.greenhopper.jira:gh-epic-label` — same discovery as other custom fields)
- Progress bar visual design (simple filled bar or segmented by status category)
- Assignee avatar overlap/count display on epic list rows (how many avatars to show before "+N" overflow)
- Animation and transition for the epic detail sheet
- Empty state for epic list and epic detail stories list

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EPIC-01 | User can view a list of all epics with name, status, story count, and point totals | `fetchEpicsWithEnrichment()` in jira.ts + `EpicsPage` route; two-query pattern established in `fetchBacklogView` |
| EPIC-02 | User can filter the sprint board and backlog by a selected epic | SprintBoardTab gets an epic filter bar; backlog filter already complete (BACK-04); `epicLinkFieldKey` available in settings store |
| EPIC-03 | User can open an epic detail view showing all stories under that epic | `EpicDetailSheet` as sibling to `IssueDetailSheet` in AppLayout; stories fetched via JQL `"Epic Link" = {epicKey}` |
| EPIC-04 | User can create a new epic from within the app | `createIssue()` with `issuetype: 'Epic'` + `epicNameFieldKey` — no createmeta needed for fixed Epic fields |
</phase_requirements>

## Standard Stack

### Core (all already installed — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + TypeScript | 18 / 5 | Component layer | Project baseline |
| @tanstack/react-query | v5 | Server state caching | Used everywhere in project |
| shadcn `Sheet` | existing | Slide-over panel | IssueDetailSheet already uses this |
| @base-ui/react/dialog | existing | Centered modal | CreateEditIssueModal already uses this |
| lucide-react | existing | Icons | Project standard |
| Tailwind CSS | existing | Styling | Project standard |

### No New Dependencies
Phase 13 reuses every library already in the project. No `npm install` step needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── routes/dashboard/
│   ├── EpicsPage.tsx              # NEW — full-page /epics route
│   ├── EpicsPage.test.tsx         # NEW — EPIC-01 tests
│   ├── EpicDetailSheet.tsx        # NEW — slide-over for epic detail (EPIC-03)
│   ├── EpicDetailSheet.test.tsx   # NEW — EPIC-03 tests
│   ├── CreateEpicDialog.tsx       # NEW — create epic modal (EPIC-04)
│   ├── CreateEpicDialog.test.tsx  # NEW — EPIC-04 tests
│   ├── SprintBoardTab.tsx         # MODIFY — add epic filter bar (EPIC-02)
│   └── SprintBoardTab.test.tsx    # MODIFY — add EPIC-02 filter tests
├── components/app/
│   └── Sidebar.tsx                # MODIFY — add /epics NavLink in shared section
├── services/
│   └── jira.ts                    # MODIFY — add fetchEpicsWithEnrichment()
└── main.tsx                       # MODIFY — add /epics route, mount EpicDetailSheet
```

### Pattern 1: Epic List Data Fetch (two-query enrichment)
**What:** Fetch epics list first, then batch-fetch child stories to compute counts/points.
**When to use:** Epic list page load. The JQL `issuetype = Epic` returns epic issues; a second JQL `"Epic Link" in (EPIC-1, EPIC-2, ...)` returns all stories to aggregate per-epic.

```typescript
// Source: established in fetchBacklogView() (jira.ts ~line 1455)
// Step 1: fetch epics
const epicJql = `project = ${projectKey} AND issuetype = Epic ORDER BY updated DESC`
const epics = await fetchAllSearchPages(`${base}/rest/api/2/search?jql=${epicJql}&fields=summary,status,assignee,priority,description,created,updated`, headers)

// Step 2: batch-fetch all stories linked to those epics
const epicKeys = epics.map(e => e.key)
if (epicKeys.length > 0) {
  const storiesJql = `project = ${projectKey} AND "Epic Link" in (${epicKeys.join(',')}) AND issuetype != Sub-task`
  const stories = await fetchAllSearchPages(`${base}/rest/api/2/search?jql=${storiesJql}&fields=status,${storyPointsFieldKey},${epicLinkFieldKey}`, headers)
  // aggregate per epicKey: count, totalPoints, doneCount
}
```

**Confidence:** HIGH — mirrors the working pattern in `fetchBacklogView` Step 4.

### Pattern 2: EpicDetailSheet — sibling to IssueDetailSheet
**What:** AppLayout-level state + Sheet component. Same mounting pattern as IssueDetailSheet.
**When to use:** User clicks an epic row on `/epics`.

```typescript
// Source: main.tsx AppLayout (existing pattern)
// In AppLayout:
const [selectedEpicKey, setSelectedEpicKey] = useState<string | null>(null)

// Mount alongside IssueDetailSheet:
<EpicDetailSheet
  epicKey={selectedEpicKey}
  onClose={() => setSelectedEpicKey(null)}
  onOpenIssue={setSelectedIssueKey}   // stories click through to IssueDetailSheet
/>

// Route context gets onEpicClick:
<Outlet context={{ ..., onEpicClick: setSelectedEpicKey }} />
```

```typescript
// EpicDetailSheet shell — mirrors IssueDetailSheet exactly
// Source: IssueDetailSheet.tsx (existing)
<Sheet open={epicKey !== null} onOpenChange={(open) => { if (!open) onClose() }}>
  <SheetContent side="right" className="p-0 flex flex-col overflow-hidden" style={{ width: '85vw', maxWidth: '85vw' }}>
    {epicKey && <EpicDetailBody epicKey={epicKey} onOpenIssue={onOpenIssue} />}
  </SheetContent>
</Sheet>
```

**Confidence:** HIGH — direct pattern clone.

### Pattern 3: Sprint Board Epic Filter
**What:** Local `useState<string | null>` for selected epic name. Filters `swimlanes` in the `useMemo` before rendering.
**When to use:** Top of SprintBoardTab, above the sticky column header bar.

```typescript
// Source: SprintBoardTab.tsx (existing swimlanes useMemo ~line 265)
// EXTEND the swimlanes memo — or add a derived filteredSwimlanes:
const filteredSwimlanes = useMemo(() => {
  if (!activeEpicFilter) return swimlanes
  return swimlanes.filter(({ story }) => {
    const epicKey = story.fields[epicLinkFieldKey] as string | null
    if (!epicKey) return false   // hide no-epic stories when filter active
    return epicNames.get(epicKey) === activeEpicFilter || epicKey === activeEpicFilter
  })
}, [swimlanes, activeEpicFilter, epicLinkFieldKey, epicNames])
```

**SprintBoardTab needs `epicLinkFieldKey` from settings store** — currently uses only `storyPointsFieldKey`. This is a one-line addition to the destructure.

**Confidence:** HIGH — exact same filter logic as `applyFilters()` in BacklogPage.

### Pattern 4: Create Epic Dialog (simple, no createmeta)
**What:** `@base-ui/react/dialog`-based modal with fixed fields. Calls `createIssue()` with `issuetype: 'Epic'` and the `epicNameFieldKey`.
**When to use:** "+ Create Epic" button on EpicsPage header.

```typescript
// Source: CreateEditIssueModal.tsx (existing createIssue usage)
// Epic creation — fields are instance-specific but fixed (no createmeta survey needed):
await createIssue(jiraBaseUrl!, token, projectKey, epicNameValue, {
  issuetype: 'Epic',
  description: descriptionValue || undefined,
  assignee: assigneeName ? { name: assigneeName } : undefined,
  priority: priorityName ? { name: priorityName } : undefined,
  [epicNameFieldKey]: epicNameValue,   // com.pyxis.greenhopper.jira:gh-epic-label field
})
// On success:
queryClient.invalidateQueries({ queryKey: ['jira-epics'] })
```

**CRITICAL:** The `epicNameFieldKey` field is the display label for the epic (the "Epic Name" custom field distinct from the issue `summary`). Pass both `summary` (issue title) and `epicNameFieldKey` (display label) — many Jira Server instances require both, and using the same value for both is the safest approach.

**Confidence:** MEDIUM — `epicNameFieldKey` behavior on DC verified via settings store discovery (`gh-epic-label`). The dual `summary` + `epicNameFieldKey` pattern is established project practice (BacklogRow reads from epicNameFieldKey for display).

### Pattern 5: Sidebar Shared Section
**What:** Add `/epics` NavLink above the role-specific `<div className="mt-2">` section.
**When to use:** Always visible regardless of role.

```typescript
// Source: Sidebar.tsx (existing navLinkClass pattern)
// Insert after the "Create Issue" button, before the role-conditional section:
<NavLink to="/epics" className={navLinkClass}>
  <BookOpen className="h-4 w-4 shrink-0" />
  <span className="hidden md:block">Epics</span>
</NavLink>
```

`BookOpen` from `lucide-react` is the appropriate icon (not yet used in Sidebar — no conflict).

**Confidence:** HIGH — direct NavLink pattern from existing code.

### Pattern 6: Epic List Row with Progress Bar
**What:** Each row in the epics table: name (button to open detail) + status badge + story count + points + progress bar + contributor avatars.
**When to use:** EpicsPage table body rows.

```typescript
// Progress bar (simple filled, Claude's discretion for segmented)
// Reuse epicColorClass() from BacklogRow.tsx
const pct = totalStories > 0 ? Math.round((doneStories / totalStories) * 100) : 0
// Render:
<div className="w-20 h-1.5 rounded-full bg-muted">
  <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${pct}%` }} />
</div>
```

**Confidence:** HIGH — Tailwind utility pattern, no library needed.

### Anti-Patterns to Avoid

- **Calling createmeta for Epic creation:** Locked decision is to use a simple dialog. Createmeta adds 2+ round-trips and may return unexpected required fields. Use `createIssue()` directly with fixed Epic fields.
- **Using IssueDetailSheet to display epics:** The locked decision is to open EpicDetailSheet (a new component), not the generic issue sheet. This enables the two-column stories/metadata layout specific to epics.
- **Nesting EpicDetailSheet inside EpicsPage:** Must mount at AppLayout level, same as IssueDetailSheet — otherwise cannot be triggered from other views (if ever needed) and breaks the single-sheet pattern.
- **Hardcoding epicNameFieldKey:** Must read from settings store (`epicNameFieldKey`) — never hardcode `customfield_10015`.
- **One query for all epic data:** Jira JQL `issuetype = Epic` does not return child story counts or points. A second query (`"Epic Link" in (...)`) is mandatory.
- **Fetching stories one epic at a time:** Batch the child stories fetch into a single JQL `"Epic Link" in (K1,K2,...)` to avoid N+1 API calls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slide-over sheet | Custom drawer | shadcn `Sheet` | Already used by IssueDetailSheet; consistent sizing/animation |
| Centered create dialog | Custom overlay | `@base-ui/react/dialog` | Already used by CreateEditIssueModal; proven in project |
| Combobox filter | Custom dropdown | `MultiFilterCombobox` inline component (from BacklogFilterBar) | Already built, no new dep needed — can extract or inline |
| Epic color coding | Custom hash logic | `epicColorClass()` from BacklogRow.tsx | Already written, stable hash |
| Story points display | Custom field read | `storyPointsFieldKey` from settings store | Instance-specific; already discovered |

## Common Pitfalls

### Pitfall 1: SprintBoardTab Missing epicLinkFieldKey
**What goes wrong:** Epic filter cannot match issues because `epicLinkFieldKey` is never read from settings store.
**Why it happens:** SprintBoardTab currently only destructures `storyPointsFieldKey` from `useSettingsStore()`. Epic link key is not imported.
**How to avoid:** Add `epicLinkFieldKey` (and optionally `epicNameFieldKey`) to the `useSettingsStore()` destructure in SprintBoardTab before writing filter logic.
**Warning signs:** Filter shows 0 results even when epics exist on board stories.

### Pitfall 2: Epic Name vs. Epic Summary Confusion
**What goes wrong:** Epic rows show the issue `key` or `summary` instead of the human-readable epic name from `epicNameFieldKey`.
**Why it happens:** Jira Server stores epic display labels in a custom field (`com.pyxis.greenhopper.jira:gh-epic-label`) separate from the issue summary. `epicNameFieldKey` in the settings store points to this field.
**How to avoid:** For epic list rows, use `epic.fields[epicNameFieldKey]` as the display label, falling back to `epic.fields.summary`. This mirrors how `BacklogRow` falls back through the chain.
**Warning signs:** Epic names show as issue keys (e.g. "PROJ-42") or raw summaries that don't match what Jira shows.

### Pitfall 3: epicNames Map Not Populated for Sprint Board Filter
**What goes wrong:** SprintBoardTab's epic filter combobox options are empty because the sprint issues' `epicNameFieldKey` fields are null on Jira Server.
**Why it happens:** `fetchSprintIssues` currently fetches `storyPointsFieldKey` but does not batch-fetch epic summaries from the epic issues themselves (unlike `fetchBacklogView`).
**How to avoid:** The sprint board filter can use epic keys as option values (not names) for matching, OR the epic names query from the epics list can be shared. Simplest: build filter options from `issue.fields[epicLinkFieldKey]` keys and display them — the `/epics` page already has the names map if mounted. Since filter state is local to each view, matching by epicKey (not epicName) is more reliable.
**Warning signs:** Filter combobox shows raw `customfield_10014` values or empty strings.

### Pitfall 4: EpicDetailSheet Stories Fetch Excludes Subtasks
**What goes wrong:** Stories list under an epic is empty or shows subtasks mixed in.
**Why it happens:** JQL `"Epic Link" = PROJ-42` returns all issue types linked to the epic, including subtasks. Subtasks have a parent story, not a direct epic link — but some Jira configurations do return them.
**How to avoid:** Add `AND issuetype != Sub-task` to the epic stories JQL. The locked design shows only story-level issues in the detail view.
**Warning signs:** Stories list count doesn't match sprint board counts; subtask keys appear in the list.

### Pitfall 5: Cache Invalidation After Epic Create
**What goes wrong:** EpicsPage doesn't refresh after creating a new epic.
**Why it happens:** `queryClient.invalidateQueries` must use the same query key prefix as the epics list query (`['jira-epics', projectKey, jiraBaseUrl]`).
**How to avoid:** Define the query key as a constant or use prefix-only invalidation: `queryClient.invalidateQueries({ queryKey: ['jira-epics'] })`. This is the same pattern used for backlog invalidation after story create.
**Warning signs:** Created epic appears only after manual page refresh.

### Pitfall 6: Outlet Context Missing onEpicClick
**What goes wrong:** EpicsPage cannot trigger EpicDetailSheet because `onEpicClick` is not threaded through the Outlet context.
**Why it happens:** AppLayout's `<Outlet context={...}>` in main.tsx currently provides `{ onIssueClick, openEdit, openAddSubtask, openCreateStory }` — `onEpicClick` is not yet in the spread.
**How to avoid:** Add `onEpicClick: setSelectedEpicKey` to the context object in the `<Outlet context={...}>` call. EpicsPage reads it via `useOutletContext`.
**Warning signs:** TypeScript error on `useOutletContext` destructure in EpicsPage; clicking epic rows has no effect.

## Code Examples

Verified patterns from existing codebase:

### Epic List Fetch (new jira.ts function)
```typescript
// Mirrors fetchBacklogView two-query enrichment (jira.ts ~line 1455)
export interface EpicEnriched {
  key: string
  epicName: string        // from epicNameFieldKey (custom field) or summary fallback
  summary: string         // issue summary
  status: JiraIssue['fields']['status']
  assignee: JiraIssue['fields']['assignee']
  totalStories: number
  doneStories: number
  totalPoints: number
}

export async function fetchEpicsWithEnrichment(
  baseUrl: string,
  token: string,
  projectKey: string,
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
  epicNameFieldKey = 'customfield_10015',
): Promise<EpicEnriched[]> {
  const base = baseUrl.replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // 1. Fetch epics
  const epicFields = [...new Set([
    'summary', 'status', 'assignee', 'priority', 'description', 'created', 'updated',
    epicNameFieldKey,
  ])].join(',')
  const epicJql = encodeURIComponent(`project = ${projectKey} AND issuetype = Epic ORDER BY updated DESC`)
  const epicIssues = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${epicJql}&fields=${epicFields}`, headers
  )
  if (epicIssues.length === 0) return []

  // 2. Batch-fetch child stories
  const epicKeys = epicIssues.map(e => e.key)
  const storyFields = [...new Set(['status', storyPointsFieldKey, epicLinkFieldKey, 'customfield_10016'])].join(',')
  const storiesJql = encodeURIComponent(
    `"Epic Link" in (${epicKeys.join(',')}) AND issuetype != Sub-task`
  )
  const stories = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${storiesJql}&fields=${storyFields}`, headers
  ).catch(() => [] as JiraIssue[])

  // 3. Aggregate per epic
  const countMap = new Map<string, { total: number; done: number; points: number }>()
  for (const story of stories) {
    const ek = story.fields[epicLinkFieldKey] as string | null
    if (!ek) continue
    const entry = countMap.get(ek) ?? { total: 0, done: 0, points: 0 }
    entry.total++
    if (story.fields.status.statusCategory?.key === 'done') entry.done++
    entry.points += (story.fields[storyPointsFieldKey] as number | null) ?? 0
    countMap.set(ek, entry)
  }

  return epicIssues.map(epic => ({
    key: epic.key,
    epicName: (epic.fields[epicNameFieldKey] as string | null) ?? epic.fields.summary,
    summary: epic.fields.summary,
    status: epic.fields.status,
    assignee: epic.fields.assignee,
    ...( countMap.get(epic.key) ?? { totalStories: 0, doneStories: 0, totalPoints: 0 }),
  }))
}
```

### Epic Detail Stories Fetch (new jira.ts function)
```typescript
// Used by EpicDetailSheet to load stories under a specific epic
export async function fetchEpicStories(
  baseUrl: string,
  token: string,
  epicKey: string,
  projectKey: string,
  storyPointsFieldKey = 'customfield_10016',
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const fields = [...new Set(['summary', 'status', 'assignee', 'issuetype', storyPointsFieldKey, 'customfield_10016'])].join(',')
  const jql = encodeURIComponent(
    `"Epic Link" = ${epicKey} AND issuetype != Sub-task ORDER BY rank ASC`
  )
  return fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${jql}&fields=${fields}`, headers
  ).catch(() => [] as JiraIssue[])
}
```

### AppLayout Wiring (main.tsx additions)
```typescript
// New state alongside selectedIssueKey:
const [selectedEpicKey, setSelectedEpicKey] = useState<string | null>(null)

// In Outlet context (extend existing spread):
<Outlet context={{ onIssueClick: setSelectedIssueKey, onEpicClick: setSelectedEpicKey, ... }} />

// New mount after IssueDetailSheet:
<EpicDetailSheet
  epicKey={selectedEpicKey}
  onClose={() => setSelectedEpicKey(null)}
  onOpenIssue={setSelectedIssueKey}
/>
```

### SprintBoardTab Filter (adding to existing)
```typescript
// In SprintBoardTab — add to useSettingsStore destructure:
const { storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey } = useSettingsStore()

// New local state:
const [activeEpicFilter, setActiveEpicFilter] = useState<string | null>(null)

// Derived filtered swimlanes (after existing swimlanes useMemo):
const filteredSwimlanes = useMemo(() => {
  if (!activeEpicFilter) return swimlanes
  return swimlanes.filter(({ story }) => {
    const epicKey = story.fields[epicLinkFieldKey] as string | null
    return !!epicKey && epicKey === activeEpicFilter
  })
}, [swimlanes, activeEpicFilter, epicLinkFieldKey])

// Epic options for filter combobox (keys from board issues):
const epicOptions = useMemo(() => {
  const seen = new Set<string>()
  for (const { story } of swimlanes) {
    const ek = story.fields[epicLinkFieldKey] as string | null
    if (ek) seen.add(ek)
  }
  return Array.from(seen)
}, [swimlanes, epicLinkFieldKey])
```

**Note on epic names in sprint board filter:** Sprint issues don't have batch-fetched epic summaries in `fetchSprintIssues`. Filter options can display epic keys (e.g. "PROJ-42") unless the planner adds an epic name enrichment step to the sprint board query. Claude's discretion: displaying epic keys is acceptable for MVP since the `/epics` page is the authoritative epic surface.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate epic tab inside Dashboard | Full-page `/epics` route at AppLayout level | Phase 13 decision | Same flat route pattern as `/backlog` |
| Epic link opens IssueDetailSheet raw | Epic click opens EpicDetailSheet (two-column) | Phase 13 decision | Dedicated epic UI, stories list primary |
| No epic filter on sprint board | Per-view epic combobox filter bar | Phase 13 decision | Independent from backlog filter |

## Open Questions

1. **Epic name enrichment in sprint board filter options**
   - What we know: `fetchSprintIssues` does not return epic summaries — only `epicLinkFieldKey` values (keys like "PROJ-42")
   - What's unclear: Should the sprint board combobox show epic names (requires extra fetch) or epic keys (no extra fetch)?
   - Recommendation: Display epic keys in the filter for MVP. Once the `/epics` page loads the epics list, the user knows the mapping. A second query to fetch epic names can be added if feedback demands it.

2. **Epic badge click behavior (Claude's discretion)**
   - What we know: `BacklogRow.tsx` currently calls `onIssueClick(epicKey)` which opens IssueDetailSheet for the epic. `StoryHeaderRow`/`TaskCard` do similar.
   - Recommendation: Repurpose the epic badge click to call `onEpicClick(epicKey)` (the new outlet context function) to open `EpicDetailSheet` instead. This is the more natural behavior now that a dedicated epic surface exists. Requires threading `onEpicClick` through BacklogRow and TaskCard/StoryHeaderRow props.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.x + @testing-library/react |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose` |
| Full suite command | `cd taskflow && npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EPIC-01 | Epics list renders with name, status, story count, points, progress bar | unit | `cd taskflow && npx vitest run --reporter=verbose EpicsPage` | ❌ Wave 0 |
| EPIC-02 | Sprint board filters swimlanes by selected epic; stories with no epic are hidden | unit | `cd taskflow && npx vitest run --reporter=verbose SprintBoardTab` | ✅ exists (needs new tests) |
| EPIC-03 | Epic detail sheet opens with stories list and metadata panel | unit | `cd taskflow && npx vitest run --reporter=verbose EpicDetailSheet` | ❌ Wave 0 |
| EPIC-04 | Create epic dialog submits with epicNameFieldKey and invalidates cache | unit | `cd taskflow && npx vitest run --reporter=verbose CreateEpicDialog` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd taskflow && npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green (351+ tests passing) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/routes/dashboard/EpicsPage.test.tsx` — covers EPIC-01
- [ ] `taskflow/src/routes/dashboard/EpicDetailSheet.test.tsx` — covers EPIC-03
- [ ] `taskflow/src/routes/dashboard/CreateEpicDialog.test.tsx` — covers EPIC-04
- [ ] `SprintBoardTab.test.tsx` needs new test cases for EPIC-02 filter behavior (file exists, tests added in Wave 0 of that plan)

## Sources

### Primary (HIGH confidence)
- Direct codebase audit — `jira.ts`, `BacklogPage.tsx`, `BacklogRow.tsx`, `IssueDetailSheet.tsx`, `SprintBoardTab.tsx`, `CreateEditIssueModal.tsx`, `Sidebar.tsx`, `main.tsx`, `settings.store.ts`
- `13-CONTEXT.md` — locked decisions from user discussion session
- `vitest.config.ts` — confirmed test framework and config

### Secondary (MEDIUM confidence)
- Jira DC REST API v2 `"Epic Link"` JQL field name — standard field name for Jira Software Server; consistent with how backlog already uses `epicLinkFieldKey` for field reads
- `createIssue()` with `issuetype: 'Epic'` + `epicNameFieldKey` — derived from settings store field discovery pattern (`gh-epic-label`)

### Tertiary (LOW confidence)
- None — all claims are verifiable from existing project code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all existing
- Architecture: HIGH — direct clones of established patterns (IssueDetailSheet, BacklogPage, BacklogFilterBar, CreateEditIssueModal)
- Pitfalls: HIGH — derived from actual code (SprintBoardTab missing epicLinkFieldKey, epicName null on DC server)
- Service functions: MEDIUM — `fetchEpicsWithEnrichment` is a new function but follows existing `fetchBacklogView` pattern exactly

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable patterns; only risk is Jira instance-specific field behavior)
