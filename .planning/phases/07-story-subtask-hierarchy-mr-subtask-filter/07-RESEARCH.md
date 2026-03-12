# Phase 7: Story/Subtask Hierarchy + MR Subtask Filter - Research

**Researched:** 2026-03-13
**Domain:** React UI component restructuring, TanStack Query cache sharing, Jira issue hierarchy
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sprint Board: cross-column layout**
- All subtasks nest under their parent story card in the parent's column, regardless of subtask status
- Story card is the anchor — subtasks always appear under the story, not scattered across columns
- Story cards always appear even if unassigned (subtasks can only nest under them)
- Column issue count shows stories only (not subtasks), consistent with pre-hierarchy view
- Story cards that have subtasks show a subtle subtask count chip (e.g. "3 subtasks")
- Story cards with no subtasks look the same as before (no chip)

**Sprint Board: collapse behavior**
- Subtask groups default to collapsed on load — board stays clean, story cards with count chip signal hidden content
- Collapse is per-story — each story card independently expands/collapses; no global toggle
- Subtask count chip always visible (collapsed and expanded) — acts as a persistent summary
- Expand/collapse triggered by a chevron button on the card next to the subtask count chip — avoids conflict with future card-click behavior

**Orphan subtasks (parent not in current sprint)**
- Hidden entirely — no badge, no separate orphan list
- If a subtask's parent story is not in the current sprint, it does not appear anywhere: not in My Tasks, not on Sprint Board
- Overrides HIER-03 requirement (which said "show parent badge") — user preference is to hide rather than badge
- `groupedData.orphans` in MyTasksTab should render nothing (or be filtered upstream in `fetchMyTasksHierarchy`)

**MRAT-02: subtask-linked story MRs**
- MrAttentionTab must include MRs linked to stories where the current user has at least one assigned subtask
- Data source: Claude's discretion — can reuse `fetchMyTasksHierarchy` TanStack Query cache if populated, but must also work when the cache is empty (e.g. user navigates to MR Attention first). A dedicated minimal query or fallback fetch is acceptable.
- Subtask-linked MRs always appear unconditionally (no unresolved-discussion filter applied to them)
- These MRs show a subtle "via [subtask key]" label in MrRow so user understands why the MR appears

### Claude's Discretion
- How orphan filtering is applied (upstream in `fetchMyTasksHierarchy` return, or downstream in groupedData logic)
- Exact subtask count chip styling on TaskCard
- Chevron animation/transition for expand/collapse
- Which subtask key to show in the "via" label when multiple subtasks link to the same story

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HIER-01 | My Tasks groups all assigned subtasks under their parent story header | `groupedData` already exists in MyTasksTab; orphan rendering must be removed (render nothing for `groupedData.orphans`) |
| HIER-02 | Sprint Board groups subtask cards under parent story card in each column (collapsible) | SprintBoardTab currently renders flat list; needs re-grouping logic mirroring MyTasksTab's `groupedData`, plus per-story `useState` collapse map |
| HIER-03 | Subtasks whose parent story is not in the current sprint display a parent story badge | **Overridden by user decision** — orphans hidden entirely, not badged |
| MRAT-01 | MR Attention shows only open (`state=opened`) merge requests | APIF-04 already implemented (fetchAssignedMRs/fetchReviewerMRs filter to opened); verify MrAttentionTab does not re-filter or drop this |
| MRAT-02 | MR Attention includes MRs linked to stories where current user has at least one assigned subtask | Requires deriving "story keys with my subtasks" set and extending the MR query result; "via [key]" label in MrRow |
</phase_requirements>

---

## Summary

Phase 7 is primarily a UI restructuring phase with no new API design needed. The Jira data layer (two-query strategy, `fetchMyTasksHierarchy`, `JiraIssue.fields.parent`) is fully built from Phase 5. The work divides into three independent streams:

1. **MyTasksTab orphan suppression** — trivial: stop rendering `groupedData.orphans` (currently renders them as indented TaskRows). Either render nothing in the JSX or filter orphans upstream before they enter groupedData.

2. **SprintBoardTab hierarchy** — the largest change. The current flat `colIssues.map(...)` must be restructured into story groups with collapsible subtask sections. The grouping logic mirrors what already exists in MyTasksTab's `groupedData` memo. The new requirement is per-story expand/collapse state (a `Map<string, boolean>` in useState), a chevron button on TaskCard, and a subtask count chip using the existing `Badge` component.

3. **MrAttentionTab MRAT-02** — extend the MR list to include MRs linked to stories where the current user has at least one assigned subtask. The cleanest approach is to read `['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey]` from the TanStack Query cache in MrAttentionTab (populated by MyTasksTab if visited) and derive the story key set from it; when the cache is empty, fire a minimal `useQuery` for it. Then `linkMRToTask` is applied against an extended key set (sprint stories + subtask-parent stories).

**Primary recommendation:** Implement the three streams in dependency order: orphan suppression first (touches only MyTasksTab JSX), then SprintBoard hierarchy (touches TaskCard and SprintBoardTab), then MRAT-02 (touches MrAttentionTab and MrRow).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React `useState` | (project React version) | Per-story collapse map | Built-in, zero deps, sufficient for UI toggle state |
| TanStack Query `useQueryClient` / `useQuery` | (project version) | Cache sharing + optional fallback fetch | Already used throughout; cache-first pattern established |
| `lucide-react` `ChevronDown`/`ChevronRight` | (project version) | Chevron icon for expand/collapse | Already imported in SprintBoardTab (`RefreshCw`); consistent icon library |
| `Badge` (shadcn/ui) | (project version) | Subtask count chip on TaskCard | Already used in ReleasesTab; `variant="secondary"` or `variant="outline"` fits muted styling |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cn` (clsx/tailwind-merge) | (project version) | Conditional className for chevron rotation | Already imported in TaskCard |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useState` Map for collapse | `useReducer` | No benefit at this scale; useState simpler |
| Cache-first + fallback `useQuery` for subtask data in MrAttentionTab | Always fire fresh `fetchMyTasksHierarchy` | Cache-first avoids duplicate network call when MyTasksTab was already visited |

**Installation:** No new packages required. All dependencies already present.

## Architecture Patterns

### Recommended Project Structure
No new files/folders required. All changes are in-place edits to existing files:

```
taskflow/src/
├── routes/dashboard/
│   ├── TaskCard.tsx          # Add: chevron button, subtask count chip, collapsible subtask slot
│   ├── SprintBoardTab.tsx    # Add: grouping logic, per-story collapse state, render subtask sections
│   ├── MyTasksTab.tsx        # Remove: orphan rendering section
│   └── MrAttentionTab.tsx    # Add: subtask-story key derivation, extended MR set, pass viaSubtaskKey
└── routes/dashboard/
    └── MrRow.tsx             # Add: optional viaSubtaskKey prop + muted label
```

### Pattern 1: Per-story collapse state in SprintBoardTab
**What:** A `useState<Set<string>>` of expanded story keys (collapsed by default = empty set on init)
**When to use:** Every story card render checks `expandedStories.has(storyKey)` to decide whether to show subtask section

```typescript
// Collapsed by default — empty set means all collapsed
const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set())

function toggleStory(key: string) {
  setExpandedStories(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })
}

// In render:
const isExpanded = expandedStories.has(story.key)
```

### Pattern 2: Sprint board grouping (mirrors MyTasksTab groupedData)
**What:** Partition `data` (all sprint issues) into stories vs subtasks, then bucket subtasks by parent key. Story cards appear in their own column (by story status), subtasks always render below their parent regardless of subtask status.

```typescript
const boardGroups = useMemo(() => {
  const issues = data ?? []
  const stories = issues.filter(i => !i.fields.issuetype.subtask)
  const subtasks = issues.filter(i => i.fields.issuetype.subtask)
  const storyKeySet = new Set(stories.map(s => s.key))
  const subtasksByParent = new Map<string, JiraIssue[]>()
  for (const s of subtasks) {
    const parentKey = s.fields.parent?.key
    // orphans (parent not in sprint) are silently dropped
    if (parentKey && storyKeySet.has(parentKey)) {
      const existing = subtasksByParent.get(parentKey) ?? []
      subtasksByParent.set(parentKey, [...existing, s])
    }
  }
  return { stories, subtasksByParent }
}, [data])
```

### Pattern 3: Column rendering with story-anchored subtasks
**What:** Column iteration filters on story status only; within each story card, renders collapsible subtask mini-cards below.

```typescript
// Column count: stories only
const colStories = boardGroups.stories.filter(s => s.fields.status.name === col)

// Render each story + its subtask section
{colStories.map(story => {
  const subtasks = boardGroups.subtasksByParent.get(story.key) ?? []
  const isExpanded = expandedStories.has(story.key)
  return (
    <div key={story.id}>
      <TaskCard
        issue={story}
        healthDot={taskHealthMap.get(story.key)}
        subtaskCount={subtasks.length}
        isExpanded={isExpanded}
        onToggle={() => toggleStory(story.key)}
      />
      {isExpanded && subtasks.map(sub => (
        <TaskCard key={sub.id} issue={sub} healthDot={taskHealthMap.get(sub.key)} isSubtask />
      ))}
    </div>
  )
})}
```

### Pattern 4: MRAT-02 — extending MR set with subtask-linked story MRs
**What:** MrAttentionTab derives a set of story keys where current user has subtasks. It tries the TanStack cache first, falls back to a useQuery. Those story keys are added to `sprintIssueKeySet` used in `linkMRToTask`. MRs that match only via this extended set get a `viaSubtaskKey` label.

```typescript
// In MrAttentionTab — cache-first pattern
const cachedMyTasks = queryClient.getQueryData<{ issues: JiraIssue[]; myIssueKeys: Set<string> }>(
  ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey]
)

// Fallback query when cache is empty
const { data: myTasksFallback } = useQuery({
  queryKey: ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
  queryFn: () => fetchMyTasksHierarchy(jiraBaseUrl!, jiraToken!, activeJiraProject!, storyPointsFieldKey),
  staleTime: 30_000,
  enabled: !cachedMyTasks && !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
})

const myTasksData = cachedMyTasks ?? myTasksFallback

// Derive story keys where current user has at least one subtask
const subtaskStoryKeys = useMemo(() => {
  if (!myTasksData) return new Set<string>()
  const { issues, myIssueKeys } = myTasksData
  const result = new Set<string>()
  for (const issue of issues) {
    if (issue.fields.issuetype.subtask && myIssueKeys.has(issue.key)) {
      const parentKey = issue.fields.parent?.key
      if (parentKey) result.add(parentKey)
    }
  }
  return result
}, [myTasksData])
```

### Pattern 5: "via [key]" label in MrRow
**What:** Optional `viaSubtaskKey?: string` prop on MrRow. Rendered as a muted text element when present. Distinct from the existing `linkedTask` badge (which shows the matched story key/status).

```typescript
// MrRowProps extension
interface MrRowProps {
  mr: GitLabMR
  linkedTask: JiraIssue | null
  staleMrThresholdDays: number
  reviewHealth?: ReviewHealth
  viaSubtaskKey?: string  // new: "via PROJ-101"
}

// Render: muted/small, after linked task badge
{viaSubtaskKey && (
  <span className="text-xs text-muted-foreground whitespace-nowrap">
    via {viaSubtaskKey}
  </span>
)}
```

### Pattern 6: TaskCard chevron + subtask count chip
**What:** When `subtaskCount > 0`, render a `<Badge variant="secondary">` and a `<button>` with `ChevronDown`/`ChevronRight`. When `subtaskCount === 0`, render neither.

```typescript
// TaskCard extended props
interface TaskCardProps {
  issue: JiraIssue
  healthDot?: ReviewHealth
  subtaskCount?: number      // new
  isExpanded?: boolean       // new
  onToggle?: () => void      // new
  isSubtask?: boolean        // new: slight visual indent or muted border
}
```

### Anti-Patterns to Avoid
- **Filtering subtasks by status column:** Subtasks always nest under their parent regardless of status. Never scatter them across columns.
- **Name-based issuetype detection:** Always use `issue.fields.issuetype.subtask === true`, never compare `issuetype.name`.
- **Re-fetching for MRAT-02 when cache already hot:** Always check TanStack cache before firing a new query — avoids a duplicate network round-trip when user visits MyTasksTab first.
- **Global expand/collapse toggle:** Decided against; each story is independently collapsible.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Muted chip/badge styling | Custom span with manual padding/colors | `<Badge variant="secondary">` or `variant="outline"` | Already imported, theme-aware, dark-mode compatible |
| Chevron icon | SVG inline | `lucide-react` `ChevronDown` / `ChevronRight` | Same source as existing icons in the file |
| Key set derivation | Rolling your own dedup | ES6 `Set` | Already used throughout the codebase |

**Key insight:** All the hard data infrastructure (two-query strategy, `JiraIssue.fields.parent`, `myIssueKeys`, `groupedData`) was built in Phase 5. This phase is almost entirely presentation logic.

## Common Pitfalls

### Pitfall 1: Column count includes subtasks
**What goes wrong:** If `colIssues.length` is used for the column header count after grouping, subtasks inflate the number.
**Why it happens:** `data` contains both stories and subtasks; naively filtering by status.name counts both.
**How to avoid:** Count column stories only: `boardGroups.stories.filter(s => s.fields.status.name === col).length`
**Warning signs:** Column header shows "5" when only 3 stories are in the column.

### Pitfall 2: Orphan subtasks appear in board under wrong story
**What goes wrong:** A subtask whose parent is not in the sprint silently ends up in no story group, then falls through to a bare render.
**Why it happens:** Forgetting to gate on `storyKeySet.has(parentKey)` during grouping.
**How to avoid:** The grouping memo must only add a subtask to `subtasksByParent` when `parentKey && storyKeySet.has(parentKey)`. All others are dropped silently.
**Warning signs:** Subtask cards appear outside any story section.

### Pitfall 3: Expand/collapse state lost on re-render caused by data refetch
**What goes wrong:** Every 60s refetch causes `expandedStories` to reset to empty Set (collapsed).
**Why it happens:** If collapse state is derived from data instead of being independent useState, it resets with data.
**How to avoid:** `expandedStories` must be a standalone `useState<Set<string>>` — never derived from query data. TanStack Query data updates don't touch component state.
**Warning signs:** Board collapses every minute on the polling interval.

### Pitfall 4: MRAT-02 MRs subject to unresolved-discussion filter
**What goes wrong:** Subtask-linked story MRs get filtered out by the reviewer-MR unresolved-discussion check.
**Why it happens:** The existing reviewer filter runs on all non-assigned MRs: `if (!assignedIids.has(mr.iid)) check discussions`.
**How to avoid:** Subtask-linked MRs must be included unconditionally, same as assigned MRs. In the queryFn, treat subtask-story-linked MRs as a third "always include" category, or inject them after the filter.
**Warning signs:** User has a subtask on STORY-10 with an MR, but MR doesn't appear because it has no unresolved discussions.

### Pitfall 5: `viaSubtaskKey` shown on MRs that are already linked via title scan
**What goes wrong:** An MR linked by title scan (e.g. "PROJ-50 fix thing") also gets a "via PROJ-101" label because PROJ-50 is a story with the current user's subtask.
**Why it happens:** Both conditions independently trigger.
**How to avoid:** `viaSubtaskKey` should only be set when the MR would NOT have appeared without the subtask-story extension. Track which MRs entered the list "only via subtask path" vs "already included via assignment/reviewer path".
**Warning signs:** MRs show both a linked task badge and a redundant "via" label.

### Pitfall 6: `onMutate` in MyTasksTab uses wrong cache shape
**What goes wrong:** After orphan suppression, `transitionMutation.onMutate` calls `queryClient.setQueryData<JiraIssue[]>` but the cache now holds `{ issues: JiraIssue[], myIssueKeys: Set<string> }`.
**Why it happens:** The cache key `['jira-issues', 'my-tasks', ...]` holds the `fetchMyTasksHierarchy` return shape, not a plain array. The existing optimistic update in MyTasksTab already reads `taskData?.issues` — check it handles the shape correctly.
**How to avoid:** Verify `onMutate` uses the full shape: `queryClient.setQueryData<{ issues: JiraIssue[]; myIssueKeys: Set<string> }>`. Looking at the existing code: it currently reads `JiraIssue[]` which is wrong shape — this is a pre-existing bug to fix in the same plan.
**Warning signs:** Optimistic status update fails silently on transition.

## Code Examples

### Verified: existing groupedData pattern in MyTasksTab
```typescript
// Source: taskflow/src/routes/dashboard/MyTasksTab.tsx lines 238-255
const groupedData = useMemo(() => {
  const issues = data ?? []
  const parents = issues.filter((i) => !i.fields.issuetype.subtask)
  const subtasks = issues.filter((i) => i.fields.issuetype.subtask)
  const parentKeySet = new Set(parents.map((p) => p.key))
  const subtasksByParent = new Map<string, JiraIssue[]>()
  const orphans: JiraIssue[] = []
  for (const s of subtasks) {
    const parentKey = s.fields.parent?.key
    if (parentKey && parentKeySet.has(parentKey)) {
      const existing = subtasksByParent.get(parentKey) ?? []
      subtasksByParent.set(parentKey, [...existing, s])
    } else {
      orphans.push(s)
    }
  }
  return { groups: parents.map((p) => ({ parent: p, subtasks: subtasksByParent.get(p.key) ?? [] })), orphans }
}, [data])
```
SprintBoardTab's grouping is identical except it drops the orphans array (not needed).

### Verified: JiraIssue.fields.parent shape
```typescript
// Source: taskflow/src/services/jira.ts line 129
parent?: { id: string; key: string; fields: { summary: string } };
```
`issue.fields.parent?.key` is the safe access pattern.

### Verified: Badge component usage
```typescript
// Source: taskflow/src/components/ui/badge.tsx
import { Badge } from '@/components/ui/badge'
// Already used in ReleasesTab.tsx with variant="secondary"
<Badge variant="secondary">{subtaskCount} subtasks</Badge>
<Badge variant="outline">{subtaskCount} subtasks</Badge>
```

### Verified: TanStack cache-first read pattern (existing in SprintBoardTab)
```typescript
// Source: taskflow/src/routes/dashboard/SprintBoardTab.tsx lines 70-72
const gitlabMrs = useMemo(() => {
  return queryClient.getQueryData<GitLabMR[]>(['gitlab-mrs', gitlabBaseUrl]) ?? []
}, [queryClient, gitlabBaseUrl, data])
```
Same pattern applies for reading `['jira-issues', 'my-tasks', ...]` in MrAttentionTab.

### Verified: lucide-react already in project (RefreshCw used in SprintBoardTab)
```typescript
// Source: taskflow/src/routes/dashboard/SprintBoardTab.tsx line 16
import { RefreshCw } from 'lucide-react'
// Add ChevronDown, ChevronRight to same import
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat colIssues.map in SprintBoardTab | Story-grouped with collapsible subtasks | Phase 7 | Board goes from flat list to nested hierarchy |
| Orphans rendered as indented TaskRows | Orphans silently dropped | Phase 7 | Cleaner My Tasks view |
| MrAttentionTab only shows assigned+reviewer MRs | Also shows MRs linked to subtask-parent stories | Phase 7 | Developer sees MRs relevant to their subtask work |

**Deprecated/outdated:**
- `groupedData.orphans` rendering in MyTasksTab: phase 7 makes this render nothing

## Open Questions

1. **Optimistic update shape in MyTasksTab**
   - What we know: `transitionMutation.onMutate` currently calls `queryClient.setQueryData<JiraIssue[]>` but the cache value is `{ issues: JiraIssue[]; myIssueKeys: Set<string> }`
   - What's unclear: whether this is a silent no-op (no crash) or actually breaks optimistic updates today
   - Recommendation: Fix the type and shape in the same plan that touches MyTasksTab; use `queryClient.setQueryData<{ issues: JiraIssue[]; myIssueKeys: Set<string> }>` and update both `issues` array within

2. **MRAT-02: which `viaSubtaskKey` to show when multiple subtasks link to the same story**
   - What we know: user said Claude's discretion; "via [subtask key]" label needed
   - Recommendation: show the current user's first (or only) subtask key assigned to them under that story. If multiple, pick the first alphabetically or by array order.

3. **storyPointsFieldKey in MRAT-02 fallback query**
   - What we know: `fetchMyTasksHierarchy` takes `storyPointsFieldKey` — MrAttentionTab doesn't currently read it from settings
   - Recommendation: MrAttentionTab should read `storyPointsFieldKey` from `useSettingsStore` to match the cache key used by MyTasksTab exactly. Otherwise cache miss guaranteed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run` |
| Full suite command | `cd taskflow && npx vitest run` |

### Pre-existing Test Failures (Out of Scope)
Two tests fail before this phase starts:
- `MyTasksTab.test.tsx > renders skeleton when isLoading` — pre-existing skeleton rendering timing issue
- `ReleasesTab.test.tsx > shows task count and completion status per fix version row` — pre-existing

Phase 7 must not make these worse but is not responsible for fixing them.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HIER-01 | My Tasks renders no orphan subtasks | unit | `cd taskflow && npx vitest run --reporter=verbose src/routes/dashboard/MyTasksTab.test.tsx` | ✅ (extend existing) |
| HIER-02 | Sprint Board renders subtask cards under parent story, collapsible | unit | `cd taskflow && npx vitest run --reporter=verbose src/routes/dashboard/SprintBoardTab.test.tsx` | ❌ Wave 0 |
| HIER-03 | (overridden — hidden, not badged) | — | covered by HIER-01/02 orphan-drop assertions | — |
| MRAT-01 | MR Attention only shows opened MRs | unit | `cd taskflow && npx vitest run --reporter=verbose src/routes/dashboard/MrAttentionTab.test.tsx` | ✅ (verify existing) |
| MRAT-02 | MR Attention includes subtask-story MRs with "via" label | unit | `cd taskflow && npx vitest run --reporter=verbose src/routes/dashboard/MrAttentionTab.test.tsx` | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green (modulo pre-existing 2 failures) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` — covers HIER-02 (subtask grouping, column count, collapse toggle)

*(All other required test infrastructure exists)*

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — current rendering loop, health map, cache read pattern
- Direct code inspection: `taskflow/src/routes/dashboard/MyTasksTab.tsx` — groupedData memo, orphan render, cache key shape
- Direct code inspection: `taskflow/src/routes/dashboard/MrAttentionTab.tsx` — MR dedup, reviewer filter, sprint issue query
- Direct code inspection: `taskflow/src/routes/dashboard/MrRow.tsx` — existing props, linked task badge
- Direct code inspection: `taskflow/src/routes/dashboard/TaskCard.tsx` — current props interface
- Direct code inspection: `taskflow/src/services/jira.ts` — `fetchMyTasksHierarchy` implementation, `JiraIssue` type, `parent` field shape
- Direct code inspection: `taskflow/src/components/ui/badge.tsx` — Badge variants available
- Direct code inspection: `taskflow/src/routes/dashboard/MyTasksTab.test.tsx` — test patterns, mock patterns, `renderWithQuery` helper
- Direct code inspection: `taskflow/src/routes/dashboard/MrAttentionTab.test.tsx` — existing test coverage
- Direct code inspection: `taskflow/vitest.config.ts` — test runner config

### Secondary (MEDIUM confidence)
- Test run output: 2 pre-existing failures identified (MyTasksTab skeleton, ReleasesTab task count)
- CONTEXT.md: all implementation decisions locked by user in prior discussion session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no new dependencies
- Architecture: HIGH — all patterns derived from reading the actual source files
- Pitfalls: HIGH — derived from code inspection (onMutate shape bug confirmed by reading MyTasksTab.tsx lines 207-208)

**Research date:** 2026-03-13
**Valid until:** Stable — no fast-moving external dependencies; only internal code patterns
