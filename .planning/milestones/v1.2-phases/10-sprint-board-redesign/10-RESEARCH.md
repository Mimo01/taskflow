# Phase 10: Sprint Board Redesign - Research

**Researched:** 2026-03-14
**Domain:** dnd-kit drag-and-drop, Jira workflow statuses API, grouped kanban layout, optimistic update pattern
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Board layout:**
- Grouped kanban (not swimlane): columns = statuses, story headers appear as non-draggable section dividers within each column grouping their subtasks
- A story with subtasks in 3 columns appears as a minimal header row in each of those columns
- Story headers are minimal: issue key + summary (truncated), muted background, clickable to open issue detail sheet
- Stories with NO subtasks appear as regular draggable TaskCards in their own status column — they are not hidden
- Only subtask cards are draggable (stories serve only as headers unless they have no subtasks)

**Drag behavior:**
- Full card is the drag surface (no dedicated drag handle) — click = open detail, drag = move; dnd-kit distinguishes by movement threshold
- Pre-validate using Jira transitions API: fetch valid transitions per issue before rendering; columns that cannot receive a given card are visually indicated as invalid drop targets (disabled highlight)
- On failed transition (Jira API rejection after drop): card snaps back to original column + inline error on card (same pattern as StatusPopover rollback — consistent with existing app UX)

**Create from board (BOARD-04):**
- Inline quick-create: each status column has a small '+ Add' button at the bottom
- Clicking opens an inline text input at the bottom of that column — summary only (just a text field, press Enter to create)
- Created issue defaults to that column's Jira status
- Issue type defaults to Story (no subtasks context) — assignee, points, epic set via issue detail after creation
- No modal, no navigation away from board

**Column definition:**
- Columns come from the Jira workflow statuses API (not derived from current sprint cards) — ensures all valid transition targets are always shown, including empty columns
- Empty columns always shown (valid drag targets — real Jira behavior)
- Column order: status category first (To Do → In Progress → Done), then alphabetical within each category
- This requires one extra API call (`GET /rest/api/2/project/{key}/statuses`) but gives reliable, stable column set

### Claude's Discretion
- Exact visual treatment of invalid drop target columns (e.g., muted/striped overlay, reduced opacity)
- Exact story header card design within the Tailwind/shadcn system
- Drag overlay/ghost card appearance while dragging
- Transition loading indicator while Jira API call is in flight

### Deferred Ideas (OUT OF SCOPE)
- Full create/edit form with all fields (assignee, points, epic, description) — Phase 11
- Story drag-to-reorder within a column (rank reorder) — out of scope per PROJECT.md (Jira rank API unreliable on DC)
- Subtask-to-story reassignment by dragging across story groups — not in BOARD requirements; own phase if needed
- Board filters (filter by assignee, epic, label) — EPIC-02 covers epic filter in Phase 13; assignee/label filter not yet scoped
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOARD-01 | Sprint board shows subtasks as kanban cards grouped under collapsible parent story headers (Jira-like layout) | GroupedBoard layout pattern, StoryHeader component design, boardGroups useMemo rework |
| BOARD-02 | Sprint board shows all team members' tasks (board-wide view, not filtered to current user only) | Already supported by `fetchSprintIssues(assignedToMe=false)` — existing call in SprintBoardTab, no change needed |
| BOARD-03 | User can drag subtask/story cards between status columns to transition status (optimistic update + rollback on failure) | dnd-kit DndContext + useDraggable + useDroppable, pre-fetched transitions map, optimistic useState rollback |
| BOARD-04 | User can create a new story or subtask directly from the sprint board without leaving the board view | Inline QuickCreate component, POST /rest/api/2/issue minimal body, TanStack Query invalidation on success |
| BOARD-05 | User can open the issue detail panel from any sprint board card | Already wired from Phase 9 — `setSelectedIssueKey` on card onClick; IssueDetailSheet lives in AppLayout AND SprintBoardTab (see pitfalls) |
</phase_requirements>

---

## Summary

This phase rebuilds `SprintBoardTab.tsx` from a simple grouped list into a full Jira-like kanban board. The three major new capabilities are: (1) workflow-API-driven columns instead of deriving columns from card status names, (2) drag-and-drop status transitions using `@dnd-kit/core` v6 with pre-fetched valid transitions and optimistic rollback, and (3) an inline quick-create input at the bottom of each column.

The existing codebase already provides the key building blocks: `fetchTransitions` and `postTransition` in `jira.ts`, the `StatusPopover` rollback pattern, `TaskCard.tsx` for card rendering, and the `IssueDetailSheet` for detail view. The main work is wiring these together with a new drag context, reworking the board layout algorithm to use the workflow statuses API, and adding the QuickCreate component.

`@dnd-kit/core` is not yet installed — it must be added as a dependency. The `@dnd-kit/utilities` package is needed for the `CSS.Transform.toString` helper used in draggable style transforms.

**Primary recommendation:** Install `@dnd-kit/core @dnd-kit/utilities`, add `fetchProjectStatuses` to `jira.ts`, rework `SprintBoardTab` in focused waves: (0) install + API, (1) layout with workflow columns, (2) drag-and-drop, (3) quick-create.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | ^6.x (currently v6.1.0) | DndContext, useDraggable, useDroppable, DragOverlay, sensors | Locked by CONTEXT.md; confirmed production-ready as of Nov 2025 in STATE.md |
| @dnd-kit/utilities | ^3.x | CSS.Transform.toString utility for draggable transform style | Companion to core; provides the transform-to-style conversion |
| @tanstack/react-query | ^5.90.21 (already installed) | Caching workflow statuses, transitions, optimistic updates | Already in use throughout app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.577.0 (already installed) | Plus icon for "+ Add" button, spinner icon for drag-in-flight | Already in use |
| tailwind-merge / clsx | already installed | Dynamic class names for invalid-drop-target styling | Already in use via cn() |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/core v6 | @dnd-kit/react (new API) | @dnd-kit/react is not production-ready — locked decision, do not use |
| Pre-fetching transitions | Try-and-rollback | Pre-fetch gives UX feedback before drag — locked decision |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/utilities
```

---

## Architecture Patterns

### Recommended Project Structure

No new directories needed. All new files live in the existing dashboard route:

```
src/routes/dashboard/
├── SprintBoardTab.tsx        # Rebuilt: DndContext, workflow columns, grouped layout
├── BoardColumn.tsx           # NEW: column shell (header + droppable zone + QuickCreate)
├── DraggableCard.tsx         # NEW: wraps TaskCard with useDraggable + transition validation
├── StoryHeaderRow.tsx        # NEW: non-draggable story section divider inside a column
├── QuickCreateInput.tsx      # NEW: inline text input for + Add
├── TaskCard.tsx              # UNCHANGED: reused for subtask cards and bare story cards
├── IssueDetailSheet.tsx      # UNCHANGED
├── StatusPopover.tsx         # UNCHANGED (reference pattern for rollback)
src/services/
├── jira.ts                   # ADD: fetchProjectStatuses(), createIssue()
```

### Pattern 1: Workflow-API Column Derivation

**What:** Fetch all valid workflow statuses for the project from `GET /rest/api/2/project/{key}/statuses`, deduplicate across issue types, sort by category (new → indeterminate → done), then alphabetical within category.

**When to use:** On board mount, when `activeJiraProject` changes. Cache with `staleTime: Infinity` (statuses rarely change).

**Response structure:** The endpoint returns an array of objects — one per issue type — each containing a `statuses` array. Flatten and deduplicate by `id` to get the full column set.

```typescript
// Source: Atlassian REST API docs (verified via web research)
// GET /rest/api/2/project/{projectKey}/statuses
// Returns: Array<{ id: string, name: string, statuses: JiraStatus[] }>
// Where JiraStatus: { id, name, statusCategory: { key: 'new'|'indeterminate'|'done' } }

const CATEGORY_ORDER: Record<string, number> = { new: 0, indeterminate: 1, done: 2 }

function sortStatuses(statuses: JiraStatus[]): JiraStatus[] {
  // Deduplicate by id first
  const seen = new Set<string>()
  const unique = statuses.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true })
  return unique.sort((a, b) => {
    const ca = CATEGORY_ORDER[a.statusCategory.key] ?? 3
    const cb = CATEGORY_ORDER[b.statusCategory.key] ?? 3
    if (ca !== cb) return ca - cb
    return a.name.localeCompare(b.name)
  })
}
```

### Pattern 2: dnd-kit DndContext + useDraggable + useDroppable

**What:** Wrap the board in a single `DndContext`. Each status column is a droppable zone. Each subtask card (and bare story card) is a draggable element. `DragOverlay` renders the ghost card during drag.

**Key architecture decisions for this board:**
- `DndContext` wraps only the column area, NOT the `IssueDetailSheet` (confirmed from Phase 9: sheet lives outside DndContext)
- `PointerSensor` with `activationConstraint: { distance: 5 }` distinguishes click (opens detail) from drag
- Pre-fetched valid transition targets stored in `Map<issueKey, Set<statusName>>` — column's `useDroppable` receives `disabled` prop when that column's status is not a valid target for the active draggable
- `onDragEnd` executes the optimistic update immediately, then calls `postTransition`

```typescript
// Source: dndkit.com/api-documentation (verified March 2026)
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'

const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 5 }, // 5px before drag activates; click fires normally
  })
)

// In DndContext:
// onDragStart: record activeId → show DragOverlay
// onDragEnd: if over valid column → optimistic update → postTransition; if rejected → rollback
// onDragCancel: clear activeId
```

```typescript
// Source: dndkit.com/api-documentation (verified March 2026)
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

function DraggableCard({ issue, canDropInto, onOpenDetail }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: issue.key,
    data: { issueKey: issue.key, currentStatus: issue.fields.status.name },
  })
  const style = { transform: CSS.Transform.toString(transform), opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TaskCard issue={issue} onClick={onOpenDetail} />
    </div>
  )
}
```

```typescript
// Source: dndkit.com/api-documentation (verified March 2026)
import { useDroppable } from '@dnd-kit/core'

function BoardColumn({ status, isDisabledForActive }) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.name,
    disabled: isDisabledForActive,
    data: { statusName: status.name },
  })
  // Visual: isDisabledForActive → muted overlay; isOver → highlight ring
}
```

### Pattern 3: Pre-Fetched Transitions Map

**What:** When the board data loads, fetch transitions for every issue in parallel (using `useQueries` or `Promise.all`). Store as `Map<issueKey, Set<statusName>>`. Pass to each `DraggableCard` so columns can know before drag starts which targets are valid.

**Performance concern:** A large sprint (50+ issues) = 50+ transition API calls. Mitigate with:
- TanStack Query caching (queryKey: `['transitions', issueKey]`) — same cache used by `StatusPopover`
- Only fetch for draggable items (subtasks + bare stories), not story headers

**When to trigger:** After board data loads, batch fetch in a `useEffect` keyed on the issue list.

```typescript
// Reuses existing fetchTransitions from jira.ts (already handles transitions endpoint)
// Cache key: ['transitions', issueKey] — same as StatusPopover, no duplication
const validTargets = useMemo<Map<string, Set<string>>>(() => {
  const map = new Map<string, Set<string>>()
  for (const issue of draggableIssues) {
    const cached = queryClient.getQueryData<JiraTransition[]>(['transitions', issue.key])
    if (cached) {
      map.set(issue.key, new Set(cached.map(t => t.to.name)))
    }
  }
  return map
}, [draggableIssues, queryClient, transitionsFetchedAt])
```

### Pattern 4: Optimistic Update + Rollback for Drag Transitions

**What:** On `onDragEnd`, immediately update local state (issue moves to new column), then call `postTransition`. On error, revert local state and show inline error on the card.

**Source of truth:** `localIssues` state (derived from React Query data on mount, then mutated locally for optimistic updates). This is the existing pattern from STATE.md: "maintain localOrder in component useState as drag source of truth; rollback on mutation error".

```typescript
// Pattern: optimistic update + rollback (mirrors StatusPopover pattern)
async function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return

  const issueKey = active.id as string
  const targetStatus = over.id as string // column id = status name

  // 1. Optimistic: update localIssues state
  setLocalIssues(prev => prev.map(i =>
    i.key === issueKey
      ? { ...i, fields: { ...i.fields, status: { ...i.fields.status, name: targetStatus } } }
      : i
  ))
  setActiveId(null)

  // 2. Find transition id for this status change
  const transitions = queryClient.getQueryData<JiraTransition[]>(['transitions', issueKey])
  const transition = transitions?.find(t => t.to.name === targetStatus)
  if (!transition) { /* revert + show error */ return }

  try {
    await postTransition(jiraBaseUrl, jiraToken, issueKey, transition.id)
    // Invalidate sprint board cache to resync with Jira
    queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] })
  } catch {
    // Rollback: revert local state
    setLocalIssues(prev => prev.map(i =>
      i.key === issueKey
        ? { ...i, fields: { ...i.fields, status: { ...i.fields.status, name: originalStatus } } }
        : i
    ))
    setCardErrors(prev => new Map(prev).set(issueKey, 'Transition failed'))
  }
}
```

### Pattern 5: Inline QuickCreate

**What:** A text input at the bottom of each column. Pressing Enter calls `POST /rest/api/2/issue` with `{ project: { key }, summary, issuetype: { name: 'Story' } }`. Status cannot be set during creation — after creation, call `postTransition` to move the issue to the column's status.

**Important:** `POST /rest/api/2/issue` creates issues in the project's default status (typically the first "To Do" status). To create an issue in a specific column status, a second `postTransition` call is needed if the target column is not the default status.

```typescript
// Source: developer.atlassian.com/server/jira/platform/jira-rest-api-example-create-issue-7897248
// POST /rest/api/2/issue
// Response: { id: "39000", key: "PROJ-101", self: "..." }

async function createIssue(
  baseUrl: string, token: string, projectKey: string, summary: string
): Promise<{ id: string; key: string }> {
  const response = await apiFetch('jira', `${baseUrl}/rest/api/2/issue`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: { project: { key: projectKey }, summary, issuetype: { name: 'Story' } }
    }),
  })
  if (!response.ok) throw new Error(`Create issue failed: ${response.status}`)
  return response.json()
}
```

### GroupedBoard Layout Algorithm

The new `boardGroups` computation must:
1. Use `localIssues` (not raw query data) as the source to reflect optimistic updates
2. Columns come from workflow statuses API, not from issue status names
3. For each column (status), collect stories whose status matches AND subtasks whose status matches
4. Subtask cards render directly in the column at their actual status — not under the story's column
5. Story headers are non-draggable dividers inserted into the column where the story's status matches; ALSO appear in other columns if any of their subtasks are in that column

**Key insight:** In the new design, a story header appears in a column if: (a) the story's own status is that column, OR (b) any of the story's subtasks are in that column. Subtask cards are the primary cards; story headers are purely organizational.

```
Column: "In Progress"
├── PROJ-5 header (story in "To Do" but has subtasks here)
│   ├── PROJ-6 subtask card (draggable)
│   └── PROJ-7 subtask card (draggable)
├── PROJ-8 header (story in "In Progress" — its own status matches)
│   └── PROJ-9 subtask card (draggable)
└── PROJ-10 card (bare story, no subtasks, its status = "In Progress", draggable)
```

### Anti-Patterns to Avoid

- **Deriving columns from issue statuses:** The old `Array.from(new Set(stories.map(s => s.fields.status.name)))` pattern misses empty valid columns and is unstable across sprints. Use the workflow API instead.
- **Wrapping IssueDetailSheet inside DndContext:** Phase 9 established it must live outside DndContext to keep DndContext mounted while the sheet is open. In `SprintBoardTab`, the sheet should remain a sibling of the DndContext, not a child.
- **Calling `postTransition` before updating local state:** Always update local state first (optimistic), then call API, then rollback on error.
- **Using `@dnd-kit/react` (new API):** Not production-ready. Use `@dnd-kit/core` v6.
- **Fetching transitions on drag start:** Creates visible lag. Pre-fetch on board load using existing `fetchTransitions` + TanStack Query cache.
- **Setting status during issue creation:** The create API does not accept a status field. Create first, then transition if the column is not the default status.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop | Custom mouse/touch event handlers | @dnd-kit/core | Collision detection, accessibility, sensor abstraction, multi-container support are all complex |
| Click vs drag disambiguation | Manual pointer event tracking | PointerSensor activationConstraint distance: 5 | dnd-kit handles this correctly across mouse, touch, pen |
| Drag ghost/preview | Cloned DOM element | DragOverlay component | Handles scrollable containers, z-index, drop animations correctly |
| Transform-to-style | `translate3d(${x}px, ${y}px, 0)` | `CSS.Transform.toString(transform)` from @dnd-kit/utilities | Handles scale values correctly, not just x/y |
| Status reachability | Custom workflow graph | Pre-fetched transitions map via existing `fetchTransitions` | Jira's transition API already encodes the workflow graph |

---

## Common Pitfalls

### Pitfall 1: IssueDetailSheet Double-Mount

**What goes wrong:** `SprintBoardTab` renders its own `<IssueDetailSheet>` (from Phase 9), AND `AppLayout` in `main.tsx` renders a global `<IssueDetailSheet>`. Two sheets will be mounted simultaneously. BOARD-05 is technically satisfied by either, but having two causes double rendering and potential z-index conflicts.

**Why it happens:** Phase 9 wired the sheet at both the route level (SprintBoardTab) and the app level (AppLayout). The SprintBoardTab local sheet is still there.

**How to avoid:** Remove the local `<IssueDetailSheet>` from `SprintBoardTab` and rely on the global one in `AppLayout`. However, this requires threading `onIssueClick` from AppLayout down to SprintBoardTab (the same prop-threading pattern used for Dashboard). Alternatively, keep the local sheet if the global one is not accessible — verify the current state before deciding.

**Warning signs:** Two sheets visible at once, or sheet opening twice.

### Pitfall 2: localIssues State Sync on Re-Fetch

**What goes wrong:** Board polls every 60 seconds. When a new fetch completes, `localIssues` (the optimistic state) must be reset to the fresh server data. If the reset happens mid-drag, the board jumps.

**Why it happens:** `useEffect(() => setLocalIssues(data ?? []), [data])` will fire whenever the query re-fetches, potentially during an active drag.

**How to avoid:** Gate the sync on `!isDragging` — only sync `localIssues` from server data when no drag is active.

```typescript
useEffect(() => {
  if (!isDragging) setLocalIssues(data ?? [])
}, [data, isDragging])
```

### Pitfall 3: Transitions Pre-Fetch Race Condition

**What goes wrong:** Board renders before transitions are fetched. If user drags immediately, valid targets map is empty, all columns show as valid (or all disabled).

**Why it happens:** Transitions are fetched asynchronously after board data loads.

**How to avoid:** Show cards as non-draggable (or disable PointerSensor) until transitions are loaded. A simpler approach: allow drag always but show "loading transitions" when transitions are not yet cached. The pre-fetch is a best-effort UX enhancement, not a hard gate.

### Pitfall 4: Column ID Collision

**What goes wrong:** Column `id` used for `useDroppable` is the status name (e.g., "In Progress"). If two columns have the same status name (shouldn't happen but Jira allows it with different IDs), drop events will route incorrectly.

**Why it happens:** Status names are used as display labels AND as droppable IDs.

**How to avoid:** Use status `id` (not name) as the droppable `id`. Map from droppable id back to status name for display and for finding the transition.

### Pitfall 5: getBoundingClientRect in jsdom Tests

**What goes wrong:** dnd-kit relies on `getBoundingClientRect` which returns all zeros in jsdom. Tests that attempt to simulate drag events will not work.

**Why it happens:** jsdom does not implement layout engine.

**How to avoid:** Per dnd-kit maintainers, do not unit test drag interactions in jsdom. Test the board layout (columns render, cards render, story headers appear), click handlers (card click opens detail), and QuickCreate form submission separately. Mock the `onDragEnd` callback for any drag-result tests.

### Pitfall 6: Issue Creation → Status Mismatch

**What goes wrong:** User clicks "+ Add" in the "In Progress" column, types summary, presses Enter. The issue is created in the project's default status (e.g., "To Do"), not "In Progress". The board query refetch shows the issue in the wrong column.

**Why it happens:** `POST /rest/api/2/issue` does not accept a status field.

**How to avoid:** After creating the issue, immediately call `postTransition` to move it to the target column's status. The QuickCreate flow is: (1) create → get `{ key }` → (2) fetch transitions for new key → (3) find transition to target status → (4) call postTransition. If step 3 fails (no valid transition to target status from default), show an error and leave the issue where it landed. In all cases, invalidate `['jira-issues', 'sprint-board']` to trigger a re-fetch.

---

## Code Examples

### New Service Functions to Add to jira.ts

```typescript
// fetchProjectStatuses — new function for workflow column derivation
export interface JiraProjectStatus {
  id: string
  name: string
  statusCategory: { key: 'new' | 'indeterminate' | 'done' | string }
}

export async function fetchProjectStatuses(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<JiraProjectStatus[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/project/${projectKey}/statuses`
  const response = await apiFetch('jira', url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!response.ok) throw new Error(`Failed to fetch project statuses: ${response.status}`)
  const data: Array<{ statuses: JiraProjectStatus[] }> = await response.json()
  // Flatten across issue types, deduplicate by id
  const seen = new Set<string>()
  const all: JiraProjectStatus[] = []
  for (const issueType of data) {
    for (const s of issueType.statuses) {
      if (!seen.has(s.id)) { seen.add(s.id); all.push(s) }
    }
  }
  return all
}

// createIssue — for inline QuickCreate (BOARD-04)
export async function createIssue(
  baseUrl: string,
  token: string,
  projectKey: string,
  summary: string,
): Promise<{ id: string; key: string }> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue`
  const response = await apiFetch('jira', url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: { project: { key: projectKey }, summary, issuetype: { name: 'Story' } },
    }),
  })
  if (!response.ok) throw new Error(`Failed to create issue: ${response.status}`)
  return response.json()
}
```

### DndContext Setup in SprintBoardTab

```typescript
// Source: dndkit.com/api-documentation (verified March 2026)
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'

// In component:
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
)
const [activeIssue, setActiveIssue] = useState<JiraIssue | null>(null)

function handleDragStart(event: DragStartEvent) {
  const issue = localIssues.find(i => i.key === event.active.id)
  if (issue) setActiveIssue(issue)
}

// Return:
<DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveIssue(null)}>
  {/* columns here */}
  <DragOverlay>
    {activeIssue ? <TaskCard issue={activeIssue} /> : null}
  </DragOverlay>
</DndContext>
// IssueDetailSheet is a sibling of DndContext (not inside it)
```

### Column Count Badge Pattern

```typescript
// Column header: show count of draggable cards in column (not story headers)
// Subtask cards + bare story cards = draggable items
const draggableCount = column.subtasks.length + column.bareStories.length
// Story headers are not counted
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Derive columns from `new Set(stories.map(s.status.name))` | Fetch from workflow statuses API | Phase 10 | Empty columns always visible; stable column set |
| Stories in their own status column, subtasks hidden | Subtasks as primary cards grouped under story headers | Phase 10 | Jira-like board view |
| No drag-and-drop | dnd-kit PointerSensor with pre-validated transitions | Phase 10 | Status transitions without leaving board |
| No issue creation from board | Inline QuickCreate at column bottom | Phase 10 | BOARD-04 fulfilled without navigation |

**Deprecated/outdated in this phase:**
- `boardGroups` useMemo current implementation: grouping by story status → reworked to group by column with subtask-first layout
- Column derivation from issue data: replaced by workflow API call

---

## Open Questions

1. **IssueDetailSheet ownership in SprintBoardTab**
   - What we know: `AppLayout` (main.tsx:108) mounts a global `IssueDetailSheet`. `SprintBoardTab` also mounts its own local one (SprintBoardTab.tsx:229). Both are currently active.
   - What's unclear: Should the Phase 10 rebuild remove the local sheet and rely on the global one? Or keep the local one? The global sheet receives `setSelectedIssueKey` from AppLayout, but SprintBoardTab is a route-level component that does not receive that prop.
   - Recommendation: Keep the local `IssueDetailSheet` in SprintBoardTab for Phase 10 (it already works). The global one in AppLayout handles other entry points. Consolidation is a future cleanup task.

2. **Transitions pre-fetch cost on large sprints**
   - What we know: Each issue requires one `GET /rest/api/2/issue/{key}/transitions` call. A sprint with 40 issues = 40 calls.
   - What's unclear: Whether this is acceptable on the Orange instance given its response times.
   - Recommendation: Pre-fetch all in parallel using `Promise.allSettled` after board data loads. TanStack Query caches results — subsequent renders reuse cache. Fail silently: if transitions are not yet cached for a card, allow drop to any column (degrade gracefully).

3. **Default status for newly created issues**
   - What we know: Jira creates issues in the project's "default" status (the starting status of the default workflow — usually the first "To Do"-category status). The post-create transition is needed for non-default columns.
   - What's unclear: Whether every column status is reachable from the default status in one transition on the Orange instance.
   - Recommendation: After create, attempt `postTransition`. If no valid transition exists (target column not reachable from default), display the issue in whichever column it landed in and show a brief informational message. Do not block the create.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + React Testing Library 16.3.2 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOARD-01 | Subtasks render as cards grouped under story header rows, not as independent column cards | unit | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ✅ (tests exist, all passing — verify they cover new layout) |
| BOARD-01 | Story header with subtasks in multiple columns appears in each column | unit | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ❌ Wave 0 |
| BOARD-02 | Board shows all team members (fetchSprintIssues called with assignedToMe=false) | unit | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ✅ (already satisfied — no new test needed) |
| BOARD-03 | Card click opens detail (not drag), drag moves card optimistically | unit | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ❌ Wave 0 — mock onDragEnd callback |
| BOARD-03 | Drag rollback: when postTransition rejects, card reverts to original column | unit | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ❌ Wave 0 |
| BOARD-04 | "+" button in column reveals text input | unit | `npx vitest run src/routes/dashboard/QuickCreateInput.test.tsx` | ❌ Wave 0 |
| BOARD-04 | Pressing Enter calls createIssue with correct summary and project key | unit | `npx vitest run src/routes/dashboard/QuickCreateInput.test.tsx` | ❌ Wave 0 |
| BOARD-05 | Clicking TaskCard calls onOpenIssue with the issue key | unit | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ✅ (onClick test in existing TaskCard tests) |
| (service) | fetchProjectStatuses flattens and deduplicates statuses across issue types | unit | `npx vitest run src/services/jira.test.ts` | ❌ Wave 0 |
| (service) | createIssue sends correct POST body and returns { id, key } | unit | `npx vitest run src/services/jira.test.ts` | ❌ Wave 0 |

### Drag Interaction Test Strategy

**Do not simulate drag events in jsdom.** Per dnd-kit maintainers and confirmed via research: jsdom's `getBoundingClientRect` returns all zeros, breaking dnd-kit collision detection. Instead:

1. Test board layout (column rendering, card placement) without drag
2. Test the `onDragEnd` handler logic directly by calling it with mock `DragEndEvent` objects
3. Test `postTransition` call and rollback by mocking the service and asserting `setLocalIssues` state

```typescript
// Pattern: test drag result handler without simulating drag
// Mock DragEndEvent and call the handler directly
const mockDragEnd: DragEndEvent = {
  active: { id: 'PROJ-2', data: { current: { issueKey: 'PROJ-2', currentStatus: 'To Do' } } },
  over: { id: 'status-id-2', data: { current: { statusName: 'In Progress' } } },
  // ... other required fields
} as unknown as DragEndEvent
```

### Sampling Rate
- **Per task commit:** `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx src/services/jira.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/routes/dashboard/SprintBoardTab.test.tsx` — add tests for: story-in-multiple-columns, drag rollback via mocked onDragEnd, column-from-workflow-API
- [ ] `src/routes/dashboard/QuickCreateInput.test.tsx` — new file; covers BOARD-04 (show input on click, submit on Enter, hide on Escape)
- [ ] `src/services/jira.test.ts` — add tests for `fetchProjectStatuses` (flatten/dedup) and `createIssue` (body format, response parse)
- [ ] Framework install: `npm install @dnd-kit/core @dnd-kit/utilities` — not yet installed

*(Existing test infrastructure (Vitest + RTL + jsdom) is sufficient — no new framework needed)*

---

## Sources

### Primary (HIGH confidence)
- `dndkit.com/api-documentation/draggable/usedraggable` — useDraggable API, arguments, return values
- `dndkit.com/api-documentation/droppable/usedroppable` — useDroppable API, disabled prop, data attribute
- `dndkit.com/api-documentation/draggable/drag-overlay` — DragOverlay usage, component tree placement, onDragStart pattern
- `developer.atlassian.com/server/jira/platform/jira-rest-api-example-create-issue-7897248` — POST /rest/api/2/issue minimal body, response format
- Codebase: `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — existing board implementation
- Codebase: `taskflow/src/routes/dashboard/StatusPopover.tsx` — rollback pattern reference
- Codebase: `taskflow/src/services/jira.ts` — existing `fetchTransitions`, `postTransition`, `fetchSprintIssues`
- Codebase: `taskflow/src/main.tsx` — AppLayout global IssueDetailSheet, prop-threading pattern
- Codebase: `taskflow/package.json` — confirmed @dnd-kit/core NOT installed

### Secondary (MEDIUM confidence)
- `dndkit.com/api-documentation/sensors/pointer` — PointerSensor activationConstraint distance property
- `github.com/clauderic/dnd-kit/discussions/476` — click vs drag disambiguation patterns
- `github.com/clauderic/dnd-kit/issues/261` — jsdom testing limitations, recommendation to test interface not mechanism
- Atlassian REST API search results — `GET /rest/api/2/project/{key}/statuses` returns array of issue types each containing `statuses` array; `statusCategory.key` values are `new`/`indeterminate`/`done`

### Tertiary (LOW confidence)
- `github.com/pycontribs/jira/pull/1267` — confirmation that /project/statuses returns issue types with nested statuses (inferred from PR discussion)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — @dnd-kit/core v6 locked by existing project decision; verified via official docs
- Architecture: HIGH — patterns derived from existing codebase + official dnd-kit docs
- Jira statuses API: MEDIUM — response structure (nested by issue type) confirmed from multiple indirect sources; exact field names verified against status objects from Atlassian docs
- Pitfalls: HIGH — double-sheet issue directly observed in codebase; other pitfalls verified from official sources

**Research date:** 2026-03-14
**Valid until:** 2026-06-14 (dnd-kit v6 is stable; Jira REST API v2 is stable)
