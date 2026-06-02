# Architecture Research

**Domain:** v1.12 Jira Experience Improvements — integration with existing Tauri 2 / React 18 / TypeScript codebase
**Researched:** 2026-06-02
**Confidence:** HIGH — all claims drawn directly from reading the live source files

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  AppLayout (main.tsx)                                             │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────────────────┐   │
│  │ Sidebar │  │  TopBar  │  │  PinnedTabStrip                │   │
│  └─────────┘  └──────────┘  └───────────────────────────────┘   │
│  handleIssueClick → navigate('/issue/:key')                       │
│  Outlet context: { onIssueClick, openEdit, openClone,             │
│                    openAddSubtask, openCreateStory }              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  <main> — route Outlet                                       │ │
│  │  /sprint-board → SprintBoardTab                              │ │
│  │  /backlog      → BacklogPage                                 │ │
│  │  /issue/:key   → IssueDetailPage                             │ │
│  │  /dashboard    → Dashboard (cards: Sprint/InProgress/Release)│ │
│  │  /standup-notes→ StandupNotesPage                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  Global overlays: CommandPalette, CreateEditIssueModal,           │
│                   KeyboardShortcutsPanel, IssueDetailSheet (on    │
│                   disk, unused as peek — v1.12 reactivates it),   │
│                   UpdateDialog, WhatsNewDialog                    │
└──────────────────────────────────────────────────────────────────┘

Data layer:
  GreenHopper API  → useGhAllData(boardId)   → allData.json  (board)
                   → useGhBacklogData(boardId)→ data.json     (backlog)
  Transitions cache→ useGhTransitions(projectId, issueTypeId) (per-project)
  REST v2 API      → fetchIssueDetail, fetchComments, createIssue, etc.

Persistence layer:
  Zustand persist + createTauriStorage('*.json')
  → tempo-filters.store.ts, pinned-tabs.store.ts (pattern for v1.12 subtask-templates store)
```

---

## Feature Integration Points

### Feature 1: Drag-to-Rank (Backlog active-sprint list)

**Integration target:** `BacklogPage.tsx` — specifically the `VirtualizedBacklogTable` inner component and the active-sprint `sprintSections[0]` section.

**What changes:**

`BacklogPage` is already managing `sprintSections` (ACTIVE + FUTURE) via the `useGhBacklogData` hook and the `issueIdToSprintId` reverse index. The active sprint's issues are an ordered `JiraIssue[]` derived from `adaptedIssues`. Rank re-ordering needs to:

1. Wrap the active-sprint `VirtualizedBacklogTable` in a `DndContext` + `SortableContext` from `@dnd-kit/core` + `@dnd-kit/sortable`. These packages are NOT currently installed (they were removed in v1.10 Phase 67 from the sidebar reorder feature). They must be re-added.
2. On `onDragEnd`, call the GreenHopper rank API (`PUT /rest/agile/1.0/issue/rank` with `{ rankCustomFieldId, issues: [dragged], rankBeforeIssue or rankAfterIssue }`) via a new `rankIssue()` function in `services/jira/` (or `services/jira/greenhopper/`).
3. Apply an optimistic reorder directly on the `['gh-backlog', boardId]` cache using `queryClient.setQueryData<GhBacklogResponse>`. The backlog cache stores `sprints[n].issuesIds[]` (numeric IDs); the optimistic update reorders those IDs, which flows through the existing `issueIdToSprintId` reverse index to reorder the rendered `adaptedIssues`.
4. On error, roll back via the `previous` snapshot pattern (exactly as `confirmMoveToSprint` does already in `BacklogPage`).
5. On settle, call `invalidateGhBacklogData(queryClient, boardId)` to refetch the authoritative order.

**DnD context provider placement:** The `DndContext` wraps only the active-sprint `VirtualizedBacklogTable` subtree, not the full `BacklogPage`. Place it inside `renderSection()` when `sectionId` is the active sprint. The `SortableContext` wraps the `<tbody>` rows.

**New service function:** `rankIssue(baseUrl, token, issueKey, rankBeforeIssue | rankAfterIssue, rankCustomFieldId)` — calls `PUT /rest/agile/1.0/issue/rank`. The `rankCustomFieldId` is discovered via `discoverCustomFields()` (already runs at app start in `main.tsx`) and stored in `settings.store.ts` as a new `rankFieldKey` field (persist version bump to 24).

**New vs modified components:**
- MODIFIED: `BacklogPage.tsx` — add DnD context, optimistic reorder, rank API call
- MODIFIED: `BacklogRow.tsx` — add `useSortable` drag handle affordance
- NEW: `services/jira/rank.ts` — `rankIssue()` function
- MODIFIED: `services/jira.ts` barrel — re-export `rankIssue`
- MODIFIED: `stores/settings.store.ts` — add `rankFieldKey` field; bump persist version to 24
- MODIFIED: `main.tsx` `useCustomFieldDiscovery` — populate `rankFieldKey`
- ADDED DEPENDENCY: `@dnd-kit/core`, `@dnd-kit/sortable`

**Data flow:**
```
User drags BacklogRow
  → onDragEnd in BacklogPage
    → optimistic: queryClient.setQueryData(['gh-backlog', boardId], reorder issuesIds)
    → rankIssue(PUT /rest/agile/1.0/issue/rank)
      → success: invalidateGhBacklogData
      → error: queryClient.setQueryData(previous snapshot)
```

---

### Feature 2: Drag-to-Transition (Sprint Board)

**Integration target:** `SprintBoardTab.tsx` — specifically the column cells inside `renderSwimlane()`.

**What changes:**

The sprint board currently shows three fixed `CATEGORY_COLUMNS` cells per swimlane. During a drag:

1. The dragged `TaskCard` becomes the drag overlay (via `DragOverlay` from `@dnd-kit/core`).
2. Each column cell that maps to multiple workflow statuses expands into per-status drop zones ("Transition Columns"). The available transitions for the dragged card are sourced from `getTransitions(card)` (already available in the render scope via the `peekGhTransitions` mechanism).
3. On `onDragEnd`, if the card was dropped on a different status zone, call the existing `handleTransition()` function directly — this already does the optimistic update + rollback + `invalidateGhAllData` pattern.

**DnD context provider placement:** `DndContext` wraps the entire board scrollable area (`<div ref={scrollContainerRef}>`), not just one swimlane. `SortableContext` is not needed (cards don't sort within columns; they only transition between columns). `DragOverlay` renders inside `SprintBoardTab` as a sibling to the scroll container but inside the `boardRef` wrapper — same z-level as `stickyOverlayRef`.

**Drop zone strategy:** Each column cell that covers multiple workflow statuses renders a visible expanded drop-zone list of status names during drag (only the statuses reachable from the dragged card's current status, using `filterTransitionsForStatus` — already available). When not dragging, columns collapse back to the normal CATEGORY_COLUMNS view.

**New vs modified components:**
- MODIFIED: `SprintBoardTab.tsx` — add `DndContext`, `DragOverlay`, `useDraggable` on cards, `useDroppable` on column cells, per-status drop zone expansion during drag
- MODIFIED: `TaskCard.tsx` — add `useDraggable` hook integration; card becomes a drag source (the existing `onClick` must be protected with `e.defaultPrevented` / drag-distance guard so a click that was a failed drag doesn't open the issue)
- ADDED DEPENDENCY: `@dnd-kit/core` (shared with Feature 1)

**Data flow:**
```
User drag-starts TaskCard
  → DragOverlay renders clone of card
  → Column cells expand to per-transition drop zones
User drops on status drop zone
  → onDragEnd fires with overId = transitionId
    → calls existing handleTransition(cardKey, transitionId, toStatusName, toStatusId)
      → optimistic localIssues update
      → postTransition REST call
      → invalidateGhAllData on settle
```

**Key constraint:** The board uses a custom JS-driven sticky header system that overlays content via absolute positioning (`stickyOverlayRef`). The `DragOverlay` must render outside the virtualizer scroll flow — mount it inside `boardRef` at the same level as `stickyOverlayRef`, not inside the `scrollContainerRef`.

---

### Feature 3: Universal Non-Blocking Peek Slideover

**Mounting decision:** App-level, inside `AppLayout` in `main.tsx` — exactly where `IssueDetailSheet` would belong per the Key Decisions table: "Global IssueDetailSheet lifted to AppLayout (not Dashboard) — Search and notifications live in TopBar (global shell), not inside a route — sheet must be at the same level." The peek slideover is reachable from any view (board, backlog, standup, dashboard, search) because it lives above the `<main>` Outlet, the same way `CommandPalette` and `CreateEditIssueModal` do.

**State:** A single `useState<string | null>` called `peekIssueKey` in `AppLayout` — analogous to `createModalOpen`. This state is NOT in a Zustand store (the existing pattern for pop-over and modal state is local to `AppLayout`). It is threaded down via the Outlet context.

**Distinguishing peek vs full-page click:**
The existing `handleIssueClick(key)` in `main.tsx` always navigates to `/issue/:key`. The peek is triggered by a separate handler `handleIssuePeek(key)` that sets `peekIssueKey` instead of navigating. Consumer components (board, backlog, standup rows) call `onIssueClick` for the issue key text and `onIssuePeek` for the rest of the row or card body. The Outlet context gains an `onIssuePeek` field alongside the existing `onIssueClick`.

**Explicit "open full page" affordance:** The slideover header has an "Open full page" button (`ExternalLink` icon) that calls `handleIssueClick(peekIssueKey, true)` and then `setPeekIssueKey(null)`.

**Click-to-swap:** When the underlying view is interactive (the slideover has no backdrop), clicking a different row triggers `handleIssuePeek(newKey)` which just updates `peekIssueKey`. TanStack Query caches the fetched issue detail; the new key causes `fetchIssueDetail` to run with its existing 30s staleTime — the previously-fetched issue stays in cache.

**IssueDetailSheet.tsx reuse decision:** `IssueDetailSheet.tsx` is already on disk and is functionally complete — it renders `IssueDetailContent` + `IssueDetailSidebar` inside a `Sheet` from shadcn/ui. Reuse it. The only necessary changes are:
- Add a close button / explicit "open full page" button in a thin header strip rendered at the top of `SheetContent`
- Add `modal={false}` prop on the `Sheet` component to suppress the backdrop and allow interaction with the underlying view
- Ensure `onOpenIssue` inside the sheet calls `handleIssuePeek` (swap within peek) except for the issue key text span which calls `handleIssueClick` (full page)

Do not create a new component. `IssueDetailSheet` already encapsulates the query (`fetchIssueDetail`), loading skeleton, `IssueDetailContent`, and `IssueDetailSidebar`. Its `EpicDetailSheet` branch (isEpic=true) works automatically.

**Outlet context delta:**
```typescript
// existing
{ onIssueClick, onEpicClick, onMRClick, openEdit, openClone, openAddSubtask, openCreateStory }
// v1.12 addition
{ ..., onIssuePeek }
```

**New vs modified components:**
- MODIFIED: `IssueDetailSheet.tsx` — add thin peek-header with close + "Open full page" button; add `modal={false}` on `Sheet`
- MODIFIED: `main.tsx` AppLayout — add `peekIssueKey` state, `handleIssuePeek`, mount `IssueDetailSheet` as global peek overlay, add `onIssuePeek` to Outlet context
- MODIFIED: `SprintBoardTab.tsx` — read `onIssuePeek` from Outlet context; card body click → `onIssuePeek`; issue key text span → `onIssueClick`
- MODIFIED: `BacklogPage.tsx` — same split: row body click → `onIssuePeek`; issue key cell → `onIssueClick`
- MODIFIED: `BacklogRow.tsx` — split click handler on issue key span vs row body
- MODIFIED: `TaskCard.tsx` — split click handler on `issue.key` span vs card body
- MODIFIED: `TodayInProgressSection.tsx`, `TodayUpNextSection.tsx` (standup) — pass `onIssuePeek` for row-body click; issue key → full page
- MODIFIED: `DashboardInProgressCard.tsx` — split click for peek
- MODIFIED: `StandupNotesPage.tsx` — thread `onIssuePeek` via `useOutletContext`

**Non-blocking behavior:** shadcn `Sheet` with `modal={false}` (no overlay/backdrop) allows interaction with the underlying view. The `peekIssueKey` state update that re-renders the sheet is cheap — the query result is already cached for recently-viewed issues.

---

### Feature 4: Done-State Strikethrough

**Integration target:** `BacklogRow.tsx`, `DashboardSprintCard.tsx`, `DashboardInProgressCard.tsx`, `TodayInProgressSection.tsx`, `TodayUpNextSection.tsx`.

**Pattern:** The sprint board's `TaskCard` already has the strikethrough pattern on the issue key text (line 115-119 of `TaskCard.tsx`). Extract this into a shared utility to avoid duplication across surfaces.

Extract `lib/issueDisplayUtils.ts` exporting:
```typescript
export function isDoneStatus(issue: JiraIssue): boolean {
  return issue.fields.status.statusCategory?.key === 'done';
}
// Returns Tailwind class string for summary text when issue is done
export function doneSummaryClass(issue: JiraIssue): string {
  return isDoneStatus(issue) ? 'line-through opacity-60' : '';
}
```

**New vs modified components:**
- NEW: `lib/issueDisplayUtils.ts` — `isDoneStatus()`, `doneSummaryClass()`, `priorityStripeClass()` (shared by Features 4 and 5)
- MODIFIED: `BacklogRow.tsx` — apply `doneSummaryClass(issue)` to the summary `<td>`
- MODIFIED: `DashboardSprintCard.tsx` — apply to story rows
- MODIFIED: `DashboardInProgressCard.tsx` — apply to task rows
- MODIFIED: `TodayInProgressSection.tsx` — apply to subtask/story rows
- MODIFIED: `TodayUpNextSection.tsx` — apply to rows
- NOT CHANGED: `TaskCard.tsx` — already has the pattern inline; optionally migrate to the shared util but not required for v1.12

---

### Feature 5: Card Colors (Left-Edge Stripe)

**Integration targets:** `TaskCard.tsx` (sprint board cards) is the primary surface. `BacklogRow.tsx` is a secondary surface (small priority pip or stripe).

**Pattern:** A 3px left border on the card driven by `issue.fields.priority?.name`. The `priorityStripeClass` helper lives in `lib/issueDisplayUtils.ts` (created for Feature 4):

```typescript
export function priorityStripeClass(priority: string | undefined): string {
  switch (priority) {
    case 'Highest': return 'border-l-[3px] border-l-red-500';
    case 'High':    return 'border-l-[3px] border-l-orange-500';
    case 'Medium':  return 'border-l-[3px] border-l-yellow-400';
    case 'Low':     return 'border-l-[3px] border-l-blue-400';
    case 'Lowest':  return 'border-l-[3px] border-l-slate-400';
    default:        return 'border-l-[3px] border-l-transparent';
  }
}
```

The existing `isSubtask` prop on `TaskCard` applies `border-l-2 border-l-muted`. Card colors replace this — the dynamic stripe covers all cases.

**New vs modified components:**
- MODIFIED: `lib/issueDisplayUtils.ts` — add `priorityStripeClass()` (part of Feature 4's new file)
- MODIFIED: `TaskCard.tsx` — replace `isSubtask && 'border-l-2 border-l-muted'` with `priorityStripeClass(issue.fields.priority?.name)` in the card wrapper `cn()` call
- MODIFIED: `BacklogRow.tsx` — optionally add a small color dot or left border in the leftmost column cell

---

### Feature 6: Issue Detail Refinements

**Subtask parent moved from sidebar to main content:**

Currently `FieldsSection.tsx` renders `{isSubtask && f.parent && <MetaRow label="Parent">...}` in the sidebar (inside `IssueDetailSidebar` → `FieldsSection`). Moving it to `IssueDetailContent.tsx` puts it in the main left column, matching Jira's own layout.

`IssueDetailContent.tsx` already receives the `issue` prop which contains `issue.fields.parent` and already renders the subtask list for stories. For subtasks, add a "Parent" section directly below the issue summary/header. Call `onOpenIssue(f.parent.key)` on click — `onOpenIssue` is already wired as a prop to `IssueDetailContent`.

**New vs modified components:**
- MODIFIED: `IssueDetailContent.tsx` — add parent story link section (rendered only when `issue.fields.issuetype.subtask && issue.fields.parent`) below the header row or as a breadcrumb; call `onOpenIssue(f.parent.key)` on click
- MODIFIED: `issue-detail/FieldsSection.tsx` — remove the `isSubtask && f.parent` MetaRow block to avoid duplication

**cursor-pointer fixes:** A sweep of `IssueDetailContent.tsx` and `FieldsSection.tsx` for click-handling elements lacking `cursor-pointer`. This is a QA pass within the existing files, not a new component.

---

### Feature 7: Subtask Templates and Bulk Creation

**Store (mirror tempo-filters.store.ts exactly):**
```typescript
// stores/subtask-templates.store.ts
interface SubtaskTemplate {
  id: string;         // nanoid or crypto.randomUUID()
  name: string;       // display name for the template
  fields: {
    summary: string;  // required
    description?: string;
    assignee?: { name: string };
    priority?: { name: string };
    labels?: string[];
    [fieldKey: string]: unknown; // original estimate, story points, due date, components, custom fields
  };
}

interface SubtaskTemplatesState {
  templates: SubtaskTemplate[];
  addTemplate: (t: SubtaskTemplate) => void;
  updateTemplate: (id: string, patch: Partial<SubtaskTemplate>) => void;
  removeTemplate: (id: string) => void;
  reorderTemplate: (id: string, direction: 'up' | 'down') => void;
}

export const useSubtaskTemplatesStore = create<SubtaskTemplatesState>()(
  persist(..., {
    name: 'subtask-templates-store',
    storage: createTauriStorage('subtask-templates.json'),
    version: 1,
    migrate: (persisted, _version) => persisted as SubtaskTemplatesState,
  }),
);
```

**Settings page entry:** A new `SubtaskTemplatesSection.tsx` in `routes/settings/` — a CRUD list where users create, edit, rename, reorder, and delete named templates. Registered as a new sidebar item in `Settings.tsx`.

**Bulk create flow from a parent issue:**

The entry point is `IssueDetailContent.tsx` for a story/epic. A "Bulk Create Subtasks" button (visible only when `issue.fields.issuetype.name !== 'Subtask'`) opens `BulkCreateSubtasksModal.tsx`. The flow:

1. **Pick/build list:** User selects saved templates and/or adds ad-hoc subtask definitions. Each row shows the template name + inline-editable title. Parent-inheritance placeholders (`{{parent.assignee}}`, `{{parent.summary}}`) are resolved at submit time.
2. **createmeta-driven optional fields:** `useCreateEditQueries` already fetches createmeta for the Subtask issue type. `BulkCreateSubtasksModal` reuses `useCreateEditQueries({ open: true, selectedIssueType: 'Subtask', parentKey: issueKey })` to discover available optional fields per Jira instance. Per-row optional fields are shown in a collapsible "Advanced" section per row.
3. **Create all at once:** Submit calls `createIssue()` sequentially in a `for` loop (not `Promise.all`, to preserve order). Each call passes `{ parent: { key: issueKey }, issuetype: 'Subtask', ...resolvedTemplateFields }`.
4. **Partial failure handling:** Track per-row result state `{ status: 'pending' | 'success' | 'error'; error?: string }`. After the loop, show a summary: "X of Y created successfully." Failures show inline error per row with a retry button. On any success, call `invalidateGhAllData` and `queryClient.invalidateQueries(['jira-issue-detail', parentKey])` and `queryClient.invalidateQueries(['jira-subtask-enrichment', parentKey])`.

**Parent-key propagation:** `BulkCreateSubtasksModal` receives `parentKey` as a prop from `IssueDetailContent`, which already receives `issueKey`. The modal state (open/closed) is local to `IssueDetailPage` / `IssueDetailContent`, not AppLayout-level — bulk creation is only triggered from within a parent issue detail.

**New vs modified components:**
- NEW: `stores/subtask-templates.store.ts`
- NEW: `stores/subtask-templates.store.test.ts`
- NEW: `routes/settings/SubtaskTemplatesSection.tsx` — CRUD UI for named templates
- NEW: `routes/dashboard/BulkCreateSubtasksModal.tsx` — pick list + preview + sequential create with per-row feedback
- MODIFIED: `routes/settings/Settings.tsx` — add "Subtask Templates" sidebar link
- MODIFIED: `routes/dashboard/IssueDetailContent.tsx` — add "Bulk Create Subtasks" button; wire modal open state (local useState)

---

## Architectural Patterns

### Pattern 1: Optimistic Update with GH Cache Mutation

**What:** Mutate `['gh-backlog', boardId]` or `['gh-all-data', boardId]` cache directly via `queryClient.setQueryData`, execute API call, roll back on error via saved snapshot, then `invalidateGh*Data` on settle.

**When to use:** Any mutation that changes data visible in the board or backlog — rank, transition, flag, sprint move.

**Example (rank reorder):**
```typescript
const cacheKey = ['gh-backlog', boardId] as const;
const previous = queryClient.getQueryData<GhBacklogResponse>(cacheKey);
queryClient.setQueryData<GhBacklogResponse>(cacheKey, (old) => {
  if (!old) return old;
  return {
    ...old,
    sprints: old.sprints.map(s =>
      s.id === activeSprint.id
        ? { ...s, issuesIds: reorderedIds }
        : s
    ),
  };
});
try {
  await rankIssue(baseUrl, token, issueKey, rankBeforeIssue);
  invalidateGhBacklogData(queryClient, boardId);
} catch {
  if (previous) queryClient.setQueryData(cacheKey, previous);
}
```

### Pattern 2: Outlet Context Prop Threading

**What:** Pass new handlers via the `Outlet context` object in `AppLayout`, consumed via `useOutletContext<{...}>()` in route components. No React context / createContext is used anywhere in the codebase.

**When to use:** For any AppLayout-level handler needed by route components — `onIssuePeek` follows this pattern exactly like `onIssueClick`.

### Pattern 3: Zustand Persist with createTauriStorage

**What:** `create<State>()(persist(..., { storage: createTauriStorage('filename.json'), version: N }))`.

**When to use:** Any client-side persistent state that must survive app restarts. The subtask-templates store is a direct structural copy of `tempo-filters.store.ts`.

### Pattern 4: createmeta-Driven Field Discovery

**What:** `useCreateEditQueries({ open, projectKey, jiraBaseUrl, selectedIssueType: 'Subtask', parentKey })` returns `customFields: CreatemetaField[]` for the Subtask issue type on this Jira instance. The `BulkCreateSubtasksModal` calls this hook to discover optional fields without hardcoding field IDs.

---

## Data Flow

### Issue Click Routing (existing + peek extension)

```
User clicks issue key text
  → onIssueClick(key) [existing]
    → handleIssueClick in AppLayout
      → breadcrumb push + navigate('/issue/:key')

User clicks issue row body / card body (new)
  → onIssuePeek(key) [new]
    → handleIssuePeek in AppLayout
      → setPeekIssueKey(key)
        → IssueDetailSheet opens (peekIssueKey !== null)
          → fetchIssueDetail(key) via ['jira-issue-detail', key, baseUrl]
          → renders IssueDetailContent + IssueDetailSidebar

User clicks "Open full page" in peek header
  → handleIssueClick(peekIssueKey, resetTrail=true)
  → setPeekIssueKey(null)
```

### Drag-to-Rank Data Flow

```
useGhBacklogData(boardId) → GhBacklogResponse
  → adaptedIssues (useMemo chain)
    → sprintSections[0].issues (active sprint, ordered by issuesIds[])

User drag-ends
  → optimistic: setQueryData reorders issuesIds[]
  → adaptedIssues re-derives (useMemo)
  → sprintSections[0].issues renders in new order
  → rankIssue() API call
    → settle: invalidateGhBacklogData → refetch canonical order
```

### Drag-to-Transition Data Flow

```
useGhAllData(boardId) → adaptedIssues → localIssues (useState)
getTransitions(card) → peekGhTransitions → filterTransitionsForStatus

User drag-ends on transition drop zone
  → handleTransition(cardKey, transitionId, toStatusName, toStatusId)
    → setLocalIssues optimistic update (existing path)
    → postTransition REST call
    → invalidateGhAllData on settle
```

---

## Component Inventory

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `BulkCreateSubtasksModal.tsx` | `routes/dashboard/` | Pick templates + preview + create all subtasks |
| `SubtaskTemplatesSection.tsx` | `routes/settings/` | CRUD for named subtask templates in Settings |
| `subtask-templates.store.ts` | `stores/` | Persisted Zustand store for templates |
| `subtask-templates.store.test.ts` | `stores/` | Tests for the store |
| `services/jira/rank.ts` | `services/jira/` | `rankIssue()` API call to GH rank endpoint |
| `lib/issueDisplayUtils.ts` | `lib/` | `isDoneStatus()`, `doneSummaryClass()`, `priorityStripeClass()` |

### Modified Components

| Component | Change |
|-----------|--------|
| `main.tsx` (AppLayout) | Add `peekIssueKey` state, `handleIssuePeek`, `IssueDetailSheet` as peek overlay, `onIssuePeek` in Outlet context |
| `IssueDetailSheet.tsx` | Add thin peek-header (close + "Open full page"); add `modal={false}` on `Sheet` |
| `SprintBoardTab.tsx` | Add `DndContext`, `DragOverlay`, per-status drop zones during drag; read `onIssuePeek` from Outlet context |
| `BacklogPage.tsx` | Add `DndContext` + `SortableContext` for active-sprint section; rank optimistic update + API call; read `onIssuePeek` |
| `BacklogRow.tsx` | Add drag handle for rank; split row-body click (peek) vs issue-key click (full page); done strikethrough; optional color stripe |
| `TaskCard.tsx` | Add `useDraggable`; split card-body click (peek) vs issue-key span click (full page); `priorityStripeClass` left border |
| `IssueDetailContent.tsx` | Add parent story link for subtasks; add "Bulk Create Subtasks" button for stories/epics |
| `issue-detail/FieldsSection.tsx` | Remove `isSubtask && f.parent` MetaRow (moved to content); cursor-pointer sweep |
| `DashboardSprintCard.tsx` | Add done strikethrough on story rows |
| `DashboardInProgressCard.tsx` | Add done strikethrough; split peek vs full-page click |
| `TodayInProgressSection.tsx` | Add done strikethrough; split peek vs full-page click |
| `TodayUpNextSection.tsx` | Add done strikethrough; split peek vs full-page click |
| `StandupNotesPage.tsx` | Thread `onIssuePeek` from Outlet context to section components |
| `routes/settings/Settings.tsx` | Add "Subtask Templates" sidebar link |
| `stores/settings.store.ts` | Add `rankFieldKey` field; bump persist version to 24 |
| `services/jira.ts` barrel | Re-export `rankIssue` |
| `main.tsx` `useCustomFieldDiscovery` | Populate `rankFieldKey` from discovery result |

---

## Dependency-Aware Build Order

Dependencies flow: shared primitives → peek infrastructure → board/backlog DnD → issue detail features.

**Phase A — Shared primitives (no cross-feature dependencies, safe to build first)**
1. `lib/issueDisplayUtils.ts` — `isDoneStatus`, `doneSummaryClass`, `priorityStripeClass`
2. `stores/subtask-templates.store.ts` + tests
3. `services/jira/rank.ts` — `rankIssue()` + unit test
4. `stores/settings.store.ts` — add `rankFieldKey`; bump persist version to 24; update `useCustomFieldDiscovery` in `main.tsx`

**Phase B — Done strikethrough and card colors (depend only on Phase A utils)**
5. Apply `doneSummaryClass` to `BacklogRow.tsx`, `DashboardSprintCard.tsx`, `DashboardInProgressCard.tsx`, `TodayInProgressSection.tsx`, `TodayUpNextSection.tsx`
6. Apply `priorityStripeClass` to `TaskCard.tsx`, `BacklogRow.tsx` (replaces `isSubtask && 'border-l-2 border-l-muted'`)

**Phase C — Peek slideover (consumed by all list surfaces; must precede DnD which also splits click handlers)**
7. `IssueDetailSheet.tsx` — peek-header with close + "Open full page"; `modal={false}`
8. `main.tsx` AppLayout — add `peekIssueKey`, `handleIssuePeek`, mount `IssueDetailSheet` as global peek, add `onIssuePeek` to Outlet context
9. `BacklogRow.tsx` + `TaskCard.tsx` — split click handler (key → full page, body → peek)
10. `SprintBoardTab.tsx` — wire `onIssuePeek` on card body click; issue key text → `onIssueClick`
11. `BacklogPage.tsx` — wire `onIssuePeek` on row click
12. Standup + Dashboard surfaces — thread `onIssuePeek`; apply done strikethrough

**Phase D — Drag-to-rank (depends on Phase C for correct click/drag distinction on backlog rows)**
13. Install `@dnd-kit/core` + `@dnd-kit/sortable`
14. `BacklogPage.tsx` + `BacklogRow.tsx` — add rank DnD, optimistic reorder, `rankIssue` API call

**Phase E — Drag-to-transition (depends on @dnd-kit from Phase D)**
15. `SprintBoardTab.tsx` + `TaskCard.tsx` — add board drag-to-transition with per-status drop zones

**Phase F — Issue detail refinements**
16. `IssueDetailContent.tsx` — parent story link for subtasks; cursor-pointer sweep
17. `FieldsSection.tsx` — remove duplicate parent MetaRow

**Phase G — Subtask templates and bulk creation (depends on store from Phase A)**
18. `routes/settings/SubtaskTemplatesSection.tsx` + wire into `Settings.tsx`
19. `BulkCreateSubtasksModal.tsx` — full pick/preview/create flow with partial-failure handling

---

## Anti-Patterns

### Anti-Pattern 1: DndContext at the Wrong Level

**What people do:** Wrapping the entire `<main>` or `AppLayout` in a `DndContext`.

**Why it's wrong:** The board's custom JS-driven sticky header system uses `position: absolute` overlays that interfere with `DragOverlay` z-index and pointer events. The backlog rank DnD only needs to be active on the active-sprint section.

**Do this instead:** Scope `DndContext` to the individual feature surface — inside `SprintBoardTab` for transitions, inside `BacklogPage`'s active-sprint `renderSection` call for ranking.

### Anti-Pattern 2: Storing Peek State in Zustand

**What people do:** Creating a Zustand store for `peekIssueKey` so any component can open the peek directly.

**Why it's wrong:** The existing codebase uses zero `createContext/useContext` and threads handlers explicitly. Peek state is ephemeral UI state with no persistence requirement. A Zustand store breaks the prop-threading consistency documented in the Key Decisions table.

**Do this instead:** `useState` in `AppLayout`, threaded via Outlet context as `onIssuePeek`.

### Anti-Pattern 3: Parallel createIssue calls in bulk creation

**What people do:** `await Promise.all(subtasks.map(s => createIssue(...)))` to speed up bulk creation.

**Why it's wrong:** Jira DC rate limits parallel POSTs and the user wants order preserved (template order = subtask rank order). Parallel calls also make per-item failure tracking harder.

**Do this instead:** Sequential `for` loop with per-item status tracking. Total time for 5-10 subtasks is acceptable with a progress indicator.

### Anti-Pattern 4: Creating a new peek component instead of reusing IssueDetailSheet

**What people do:** Creating a new `IssuePeekSlideOver.tsx` that duplicates the query + loading skeleton + content layout from `IssueDetailSheet`.

**Why it's wrong:** `IssueDetailSheet.tsx` is functional and already on disk. It loads `IssueDetailContent` + `IssueDetailSidebar` which are the same components used in `IssueDetailPage`. A duplicate means two places to maintain the same query key and loading pattern.

**Do this instead:** Add the thin peek-header (close + open-full-page) to the existing `IssueDetailSheet.tsx`.

---

## Sources

- `taskflow/src/main.tsx` — AppLayout structure, Outlet context shape, `handleIssueClick`, `IssueDetailSheet` mounting decision (Key Decisions table entry)
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — `CATEGORY_COLUMNS`, `handleTransition`, `invalidateGhAllData` pattern, `stickyOverlayRef` / `DragOverlay` placement constraints
- `taskflow/src/routes/dashboard/BacklogPage.tsx` — `GhBacklogResponse` cache mutation pattern, `issueIdToSprintId` optimistic update, `sprintSections` ordering, `confirmMoveToSprint` rollback reference
- `taskflow/src/routes/dashboard/IssueDetailSheet.tsx` — existing sheet structure, queries, and layout
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` — full-page detail layout, Outlet context consumption
- `taskflow/src/routes/dashboard/TaskCard.tsx` — click handler shape, existing `border-l-2` pattern, done-state `line-through` at lines 115-119
- `taskflow/src/routes/dashboard/BacklogRow.tsx` — row click handler shape, epic color pattern
- `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` — parent MetaRow location (line 638-650), `transitionMutation.onSettled` invalidation chain
- `taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts` — createmeta discovery pattern
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — subtask list rendering location, `onOpenIssue` prop already threaded
- `taskflow/src/stores/tempo-filters.store.ts` — exact store pattern to mirror for subtask-templates
- `taskflow/src/services/jira.ts` — `createIssue()` signature (line 1588)
- `taskflow/package.json` — confirmed no `@dnd-kit/*` packages currently installed
- `.planning/PROJECT.md` — Key Decisions table, v1.11 architecture decisions, v1.12 requirements

---
*Architecture research for: v1.12 Jira Experience Improvements*
*Researched: 2026-06-02*
