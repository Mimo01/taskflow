# Architecture Research

**Domain:** Jira Parity features — Issue Detail, Backlog, Epics, Create/Edit, Drag-and-Drop Board
**Researched:** 2026-03-13
**Confidence:** HIGH (existing codebase read directly; Jira DC API verified against official Agile 9.14 docs)

---

## How New Features Map to the Existing Architecture

This document answers the six integration questions for v1.2, anchored to the actual codebase as read on 2026-03-13.

---

## Question 1: Issue Detail View — Route vs Slide-Over

**Verdict: Use a shadcn `<Sheet>` slide-over panel, not a new standalone route.**

### Rationale

`createHashRouter` supports parameterised child routes (e.g., `/issue/:key`) without issue — hash routing
does not break parameterised segments. However, a full-page route is the wrong UX choice here because:

1. The existing app opens detail inline (accordion on notifications, inline comment on dashboard). The
   established pattern is contextual overlay, not navigation away from the triggering view.
2. The sprint board redesign (drag-and-drop) requires the board to remain mounted while a card is open
   for detail. A route navigation destroys the board's in-flight drag state and DndContext.
3. The backlog view similarly needs to keep the list mounted while the user reads or edits a selected issue.
4. `shadcn/ui` already ships a `<Sheet>` component (Radix Dialog variant) that slides from the right with
   correct focus management and ARIA roles. Zero additional dependency.

**Integration point:** Each list/board view (`SprintBoardTab`, `BacklogTab`, `MyTasksTab`) holds a
`selectedIssueKey: string | null` in local state. Card/row clicks set it, which opens
`<IssueDetailSheet issueKey={key} onClose={() => setSelectedIssueKey(null)} />`.

**When a standalone route IS appropriate:** Navigating to an issue from search results or a notification
click, where no board context exists in the background. Add `/issue/:key` as a thin route that renders
the same `<IssueDetailPanel>` component full-page. Both entry points share one component tree.

```
/issue/:key    →  <IssueDetailPanel>  (full-page, no board context)
<Sheet>        →  <IssueDetailPanel>  (slide-over, board stays mounted)
```

**Route addition to main.tsx (single line):**
```typescript
{ path: '/issue/:key', element: <IssueDetailPage /> },
```

---

## Question 2: Backlog JQL — Fetching Non-Sprint Issues on Jira DC v10.3.15

**Confirmed JQL** (verified against Atlassian official KB and Agile 9.14 docs):

```
project = {PROJECT_KEY}
AND issuetype not in subtaskIssueTypes()
AND statusCategory != Done
AND (sprint is EMPTY OR sprint not in openSprints())
ORDER BY updated DESC
```

**Why this exact form:**

- `sprint is EMPTY` catches issues never assigned to any sprint.
- `sprint not in openSprints()` catches issues from completed sprints that were returned to the backlog.
  These have a non-empty sprint field pointing to a closed sprint.
- Both clauses are required. Using only `sprint is EMPTY` misses the "returned from closed sprint" case.
  Using only `sprint not in openSprints()` fails when the sprint field is null/empty on Jira DC.
- `statusCategory != Done` uses the stable category key (not instance-specific status names).
- Subtasks excluded at the backlog level — they are surfaced under their parent story in the detail sheet.
- Use `fetchAllSearchPages` (already implemented, fully paginated) via `/rest/api/2/search`.

**Do NOT use** `GET /rest/agile/1.0/board/{boardId}/backlog` for the backlog view. The board's saved
filter is outside the app's control and may exclude issue types unexpectedly. The JQL approach via
`/rest/api/2/search` is consistent with the rest of the codebase and fully controllable.

**New service function:** `fetchBacklogIssues(baseUrl, token, projectKey, storyPointsFieldKey, epicLinkFieldKey): Promise<JiraIssue[]>`
Lives in `jira.ts`, follows the same pattern as `fetchSprintIssues`.

**TanStack Query key:** `['jira-issues', 'backlog', activeJiraProject, storyPointsFieldKey]`

---

## Question 3: Epic Data on Jira DC — Fields and API

### How Jira DC Handles Epics

On Jira Data Center (confirmed via official Agile 9.14 REST docs and Atlassian developer documentation):

**Epics are regular Jira issues** with `issuetype.name === "Epic"`. They have two special custom fields
that vary by instance:

| Field Purpose | Common Field Key | What It Contains |
|---------------|-----------------|-----------------|
| Epic Name (short label shown on the epic card) | varies — often `customfield_10011` | Plain string — the epic's display name |
| Epic Link (on a story/task: which epic it belongs to) | varies — often `customfield_10014` | The epic issue key (e.g., "PROJ-42") |

These field IDs are not guaranteed — they are configurable per Jira instance. Field discovery is required,
exactly as done for story points.

### Discovery Pattern — Consolidate into `discoverCustomFields()`

Replace the existing `discoverStoryPointsField()` with a single function that discovers all custom
field keys in one API call:

```typescript
export async function discoverCustomFields(baseUrl: string, token: string): Promise<{
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  epicNameFieldKey: string;
  accountFieldKey: string | null;
}> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/field`;
  const defaults = {
    storyPointsFieldKey: 'customfield_10016',
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10011',
    accountFieldKey: null,
  };
  try {
    const response = await apiFetch('jira', url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) return defaults;
    const fields: Array<{ id: string; name: string }> = await response.json();
    return {
      storyPointsFieldKey:
        fields.find((f) => f.name === 'Story Points' || f.id === 'customfield_10028')?.id
        ?? 'customfield_10016',
      epicLinkFieldKey: fields.find((f) => f.name === 'Epic Link')?.id ?? 'customfield_10014',
      epicNameFieldKey: fields.find((f) => f.name === 'Epic Name')?.id ?? 'customfield_10011',
      accountFieldKey: fields.find((f) => f.name === 'Account')?.id ?? null,
    };
  } catch {
    return defaults;
  }
}
```

Cache all four values in `settingsStore`. Replace `storyPointsFieldKey: string` with a `customFields`
object. The discovery hook in `main.tsx` (`useStoryPointsFieldDiscovery`) becomes `useCustomFieldDiscovery`
calling `discoverCustomFields()` once at startup.

### Agile API Endpoints for Epics

The Jira Agile REST API (already used for board/sprint discovery in `fetchActiveSprint`) exposes:

| Endpoint | Method | Use Case |
|----------|--------|----------|
| `/rest/agile/1.0/board/{boardId}/epic` | GET | List epics for the board (paginated, supports `done` filter) |
| `/rest/agile/1.0/epic/{epicIdOrKey}/issue` | GET | All issues belonging to an epic (paginated, supports JQL) |
| `/rest/agile/1.0/epic/{epicIdOrKey}/issue` | POST | Move issues into an epic |
| `/rest/agile/1.0/epic/none/issue` | POST | Remove issues from epic |

The board ID is already discovered and cached by `fetchActiveSprint` — reuse it.

**Use the Agile API for:** Fetching the epic list and fetching issues under a specific epic.
**Use REST API v2 for:** Reading/writing the epic link field on individual issues (PUT with the discovered
`epicLinkFieldKey`).

### JQL for Filtering Sprint/Backlog by Epic

```
project = {PROJECT_KEY}
AND "Epic Link" = {EPIC_KEY}
AND sprint in openSprints()
AND issuetype not in subtaskIssueTypes()
```

The JQL field name `"Epic Link"` is resolved by name in Jira DC's JQL engine even when the underlying
custom field key varies — consistent with how Story Points JQL works.

---

## Question 4: Create/Edit Issue — Optimistic vs Refetch Strategy

**Verdict: Optimistic for field edits (status, assignee, story points, epic link). Refetch-on-settle for create.**

### Edit: Optimistic Update Pattern

The existing `StatusPopover` already uses optimistic updates for status transitions. Extend this pattern
to all other editable fields in `IssueDetailPanel`.

**TanStack Query mutation pattern for editing:**

```typescript
const mutation = useMutation({
  mutationFn: (fields: Record<string, unknown>) =>
    updateIssueFields(jiraBaseUrl!, token!, issueKey, fields),
  onMutate: async (fields) => {
    await queryClient.cancelQueries({ queryKey: ['jira-issue', issueKey] });
    const previous = queryClient.getQueryData(['jira-issue', issueKey]);
    queryClient.setQueryData(['jira-issue', issueKey], (old: JiraIssue) => ({
      ...old,
      fields: { ...old.fields, ...fields },
    }));
    return { previous };
  },
  onError: (_err, _vars, context) => {
    queryClient.setQueryData(['jira-issue', issueKey], context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['jira-issue', issueKey] });
    queryClient.invalidateQueries({ queryKey: ['jira-issues'] });
  },
});
```

**API call for edit:** `PUT /rest/api/2/issue/{issueKey}` with `{ fields: { [fieldKey]: value } }`.
For status transitions, continue using the existing `postTransition` path (transitions require an ID,
not a direct status name — the field edit path does not work for status).

**New service function:** `updateIssueFields(baseUrl, token, issueKey, fields: Record<string, unknown>): Promise<void>`

### Create: Refetch Pattern

Creating a new issue is not idempotent. Do not optimistically insert a fake entry:

1. `POST /rest/api/2/issue` with all fields.
2. On success, `queryClient.invalidateQueries({ queryKey: ['jira-issues'] })` — all sprint board and
   backlog views refetch automatically and include the new issue.
3. Show a loading spinner in the create form during the POST. On error, show inline error — no toast.

**New service function:** `createIssue(baseUrl, token, projectKey, fields: Record<string, unknown>): Promise<{ key: string }>`

### Issue Links: Serial POST, Invalidate on Complete

`POST /rest/api/2/issueLink` — one link per API call (Jira does not batch link creation). After the
issue is created, post each link. Invalidate all issue queries on completion.

---

## Question 5: Drag-and-Drop Board — TanStack Query Cache Integration

**Verdict: Use dnd-kit with TanStack Query optimistic `setQueryData`. Pause refetch interval during drag.**

### Library Choice: dnd-kit

- ~10KB, zero dependencies, TypeScript-first, active maintenance (HIGH confidence — official docs verified,
  multiple 2025 tutorials confirm active adoption).
- Modular: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`.
- Works with shadcn/ui + Tailwind — no style conflicts, no Radix dependency overlap.
- `react-beautiful-dnd` is deprecated and unmaintained — do not use.

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Optimistic Column Move Flow

The sprint board's TanStack Query key is `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]`.
Dragging a card to a new column triggers a status transition.

```
onDragStart (dnd-kit event)
  → isDragging = true  (switches refetchInterval: 60_000 to false)

onDragEnd (dnd-kit event)
  1. queryClient.cancelQueries(['jira-issues', 'sprint-board', ...])
  2. snapshot = queryClient.getQueryData(...)
  3. queryClient.setQueryData(..., (old) => moveIssueToStatus(old, issueKey, targetStatusName))
     Board re-renders immediately with new column assignment.
  4. Resolve transition ID: queryClient.getQueryData(['transitions', issueKey])
     — already cached if StatusPopover was opened, or fetch lazily now.
  5. postTransition(issueKey, transitionId)
  6. on success → queryClient.invalidateQueries(['jira-issues', 'sprint-board', ...])
                   isDragging = false
  7. on error   → queryClient.setQueryData(..., snapshot)  // rollback
                   isDragging = false
                   show inline error on the card
```

**Transition ID resolution:** Each column maps to a status name. The transition ID for that status
is obtained from `fetchTransitions`. Pre-fetch transitions lazily on `onDragStart` for the dragged
issue key, or reuse the `['transitions', issueKey]` cache entry if already present from a
`StatusPopover` interaction. Never pre-fetch all transitions for all issues upfront.

**Preventing mid-drag refetch:** Pass `refetchInterval: isDragging ? false : 60_000` to the sprint
board query. Drag operations are short (< 2 seconds) — the 60s poll simply skips one cycle.

### Component Structure

```
SprintBoardTab (redesigned)
├── DndContext (dnd-kit root — handles all pointer/touch/keyboard events)
│   ├── SortableContext per column (vertical list strategy)
│   │   └── TaskCard (useSortable hook — each card is draggable)
│   └── DragOverlay (floating clone card shown while dragging)
├── IssueDetailSheet (conditional, mounted when selectedIssueKey != null)
└── useQuery: ['jira-issues', 'sprint-board', ...]
```

---

## Question 6: Custom Field Discovery — Extend discoverStoryPointsField() Pattern

The `discoverStoryPointsField()` pattern is already proven. Consolidate all field discovery into a
single `discoverCustomFields()` function (shown in Question 3) that calls `/rest/api/2/field` once
and extracts all four field IDs from the response.

**Account field specifics:** There is no standard key for the "Account" field — it is a completely
instance-specific custom field. `discoverCustomFields()` searches by `name === 'Account'`. If not
found, `accountFieldKey` is `null` and the create/edit form hides the Account field. This is the same
graceful-hide pattern used for time tracking columns (hidden when admin-disabled on the instance).

**settingsStore change:** Replace `storyPointsFieldKey: string` with:
```typescript
customFields: {
  storyPointsFieldKey: string;   // default: 'customfield_10016'
  epicLinkFieldKey: string;      // default: 'customfield_10014'
  epicNameFieldKey: string;      // default: 'customfield_10011'
  accountFieldKey: string | null; // null = field not present on this instance
}
```

All existing references to `settings.storyPointsFieldKey` update to `settings.customFields.storyPointsFieldKey`.

---

## System Overview — v1.2 Layer Additions

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Routes (createHashRouter children — new entries marked NEW)              │
│  ┌──────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────┐   │
│  │ /sprint-board│ │  /backlog  │ │  /epics    │ │  /issue/:key       │   │
│  │ (REDESIGNED) │ │  (NEW)     │ │  (NEW)     │ │  (NEW, thin wrap)  │   │
│  └──────┬───────┘ └─────┬──────┘ └─────┬──────┘ └────────┬───────────┘  │
│         │               │              │                  │               │
│  IssueDetailSheet (shared Sheet overlay — used from board, backlog, tasks)│
│  IssueCreateSheet (shared Sheet overlay — create / edit form)             │
├──────────────────────────────────────────────────────────────────────────┤
│  TanStack Query Cache — New Keys                                          │
│  ┌──────────────────────┐  ┌─────────────────────────────────────────┐   │
│  │ ['jira-issues',      │  │ ['jira-issue', issueKey]                │   │
│  │  'backlog', proj]    │  │ — single issue detail (lazy, on-demand) │   │
│  └──────────────────────┘  └─────────────────────────────────────────┘   │
│  ┌──────────────────────┐  ┌─────────────────────────────────────────┐   │
│  │ ['jira-epics',       │  │ ['jira-issue-link-types']               │   │
│  │  boardId]            │  │ — cached for create/edit form           │   │
│  └──────────────────────┘  └─────────────────────────────────────────┘   │
│  Existing keys unchanged: ['jira-issues','sprint-board'], ['transitions'] │
├──────────────────────────────────────────────────────────────────────────┤
│  jira.ts — New Service Functions                                          │
│  fetchBacklogIssues()    fetchIssueDetail()    discoverCustomFields()     │
│  fetchEpics()            createIssue()         updateIssueFields()        │
│  fetchEpicIssues()       fetchIssueLinkTypes() postIssueLink()            │
│  moveIssuesToSprint()    searchUsers()                                    │
├──────────────────────────────────────────────────────────────────────────┤
│  settingsStore — Extended                                                 │
│  customFields: { storyPointsFieldKey, epicLinkFieldKey,                  │
│                  epicNameFieldKey, accountFieldKey | null }               │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## New Components Inventory

| Component | Type | Location | What It Does |
|-----------|------|----------|--------------|
| `IssueDetailSheet` | Sheet overlay | `routes/issue/IssueDetailSheet.tsx` | Wraps IssueDetailPanel in shadcn Sheet; handles open/close |
| `IssueDetailPage` | Route wrapper | `routes/issue/index.tsx` | Renders IssueDetailPanel full-page for `/issue/:key` |
| `IssueDetailPanel` | Shared content | `routes/issue/IssueDetailPanel.tsx` | Description, editable fields, subtasks, comments, linked issues |
| `IssueCreateSheet` | Sheet overlay | `routes/issue/IssueCreateSheet.tsx` | Create/edit form: summary, description, assignee, SP, epic link, account, issue type, links |
| `BacklogTab` | Full route | `routes/backlog/index.tsx` | Non-sprint issues list, filter by epic/label, move to sprint |
| `EpicsTab` | Full route | `routes/epics/index.tsx` | Epic list, create epic, click for detail |
| `EpicDetailSheet` | Sheet overlay | `routes/epics/EpicDetailSheet.tsx` | Issues under epic, progress bar |

---

## Modified Components

| Component | Change | Why |
|-----------|--------|-----|
| `SprintBoardTab` | Add dnd-kit DndContext + DragOverlay; add IssueDetailSheet trigger on card click | Sprint board redesign with drag-to-move and inline detail |
| `TaskCard` | Add `useSortable` hook from dnd-kit; add click handler to open IssueDetailSheet | Cards become draggable and clickable for detail |
| `Sidebar` | Add `/backlog` and `/epics` nav links | New sections |
| `main.tsx` | Add `/backlog`, `/epics`, `/issue/:key` to router; replace `useStoryPointsFieldDiscovery` with `useCustomFieldDiscovery` | New routes + consolidated field discovery |
| `jira.ts` | Add ~10 new service functions; `discoverCustomFields` replaces `discoverStoryPointsField` | New API endpoints |
| `settings.store.ts` | Replace `storyPointsFieldKey: string` with `customFields` object | Consolidate all discovered field keys |

---

## New Jira API Endpoints Required

| Endpoint | Method | Used For |
|----------|--------|----------|
| `/rest/api/2/issue/{key}` | GET | Single issue detail (description, comments, links) |
| `/rest/api/2/issue/{key}` | PUT | Update issue fields (summary, description, assignee, SP, epic link, account) |
| `/rest/api/2/issue` | POST | Create new issue |
| `/rest/api/2/issueLink` | POST | Create issue link |
| `/rest/api/2/issueLinkType` | GET | Fetch available link types (blocks, duplicates, relates to, etc.) |
| `/rest/api/2/user/search?username=` | GET | Assignee typeahead search in create/edit form |
| `/rest/agile/1.0/board/{boardId}/epic` | GET | Fetch epic list for board |
| `/rest/agile/1.0/sprint/{sprintId}/issue` | POST | Move issues from backlog to sprint |
| `/rest/agile/1.0/backlog/issue` | POST | Move issues from sprint back to backlog |
| Existing: `/rest/api/2/issue/{key}/comment` | GET/POST | Already implemented; reused by IssueDetailPanel |
| Existing: `/rest/api/2/issue/{key}/transitions` | GET/POST | Already implemented; reused by drag-to-move |

---

## Data Flow Patterns

### Issue Detail Load

```
User clicks card (board/backlog/tasks) or navigates to /issue/:key
    ↓
IssueDetailPanel mounts with issueKey prop
    ↓
useQuery(['jira-issue', issueKey], enabled: !!issueKey)
    → GET /rest/api/2/issue/{key}?fields=summary,description,status,assignee,
                                    issuetype,subtasks,issuelinks,comment,
                                    customfield_10016,{epicLinkFieldKey},{epicNameFieldKey}
    ↓
Renders:
  - description via adfToPlainText (already handles null/string/ADF)
  - editable fields via inline inputs + useMutation (optimistic)
  - subtask list (link to each sub issue detail)
  - linked issues list
  - comments + post comment form
```

### Drag-and-Drop Column Move

```
User drags card from column A to column B
    ↓
onDragStart → isDragging = true → refetchInterval switches to false
onDragEnd →
  1. cancelQueries(sprint-board key)
  2. snapshot = getQueryData(sprint-board key)
  3. setQueryData → optimistically move issue to new status in cache
     (board re-renders immediately)
  4. resolve transitionId from cache or lazy fetch
  5. postTransition(issueKey, transitionId)
  6. success → invalidateQueries(sprint-board) + isDragging = false
  7. error   → setQueryData(snapshot) rollback + isDragging = false + inline card error
```

### Backlog to Sprint Move

```
User selects issues in BacklogTab and clicks "Move to Sprint"
    ↓
POST /rest/agile/1.0/sprint/{activeSprintId}/issue { issues: [issueKeys] }
    ↓
success → invalidateQueries(['jira-issues', 'backlog'])
        + invalidateQueries(['jira-issues', 'sprint-board'])
    ↓
Both views refetch automatically; moved issues disappear from backlog, appear on board
```

### Create Issue

```
User submits IssueCreateSheet form
    ↓
POST /rest/api/2/issue { fields: { project, summary, description, issuetype,
                                    assignee, customfield_storyPoints,
                                    epicLinkFieldKey, accountFieldKey } }
    ↓
success → invalidateQueries(['jira-issues'])
        → if issue links → POST /rest/api/2/issueLink per link (serial)
        → close sheet
    ↓
All list views (backlog/sprint board) refetch and include new issue
```

---

## Build Order Recommendation

Dependencies drive this order — each step unblocks the next:

**Step 1 — Custom field discovery consolidation (preparatory)**
Replace `storyPointsFieldKey` in `settingsStore` with the `customFields` object. Replace
`discoverStoryPointsField` with `discoverCustomFields` in `jira.ts` and `main.tsx`. Zero UI change.
Everything else depends on `epicLinkFieldKey` and `accountFieldKey` being available.

**Step 2 — `fetchIssueDetail` + `IssueDetailPanel` + `IssueDetailSheet`**
The issue detail panel is consumed by the sheet overlay (from board/backlog/tasks), the full-page
route (from search/notifications), and the edit form. Build it first. Establishes the optimistic
edit mutation pattern that all later features reuse.

**Step 3 — Sprint board drag-and-drop**
Depends on `IssueDetailSheet` (card click triggers it). Add dnd-kit, wire `DndContext`,
implement optimistic cache update for column moves. Highest user-visible impact item.

**Step 4 — `fetchBacklogIssues` + `BacklogTab`**
Self-contained. Depends on `customFields` (step 1) for epic link filtering in JQL. Backlog-to-sprint
move requires the active sprint ID from `fetchActiveSprint` (already cached).

**Step 5 — `fetchEpics` + `EpicsTab` + Epic filtering on board/backlog**
Depends on board ID (already cached by `fetchActiveSprint`). Epic filter added to sprint board and
backlog views after both are stable.

**Step 6 — `createIssue` + `IssueCreateSheet`**
Most complex: depends on field discovery (account, epic link options), user search, issue link types,
and issue type list. Add last to avoid blocking earlier deliverables.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Route Navigation for Issue Detail from Sprint Board

**What people do:** Add `/issue/:key` as the only entry point; navigate away from the board on card click.
**Why it's wrong:** Destroys the board's DndContext, loses drag state, forces full data refetch on return.
Users lose board scroll position. The DndContext must remain mounted.
**Do this instead:** Sheet overlay keeps the board mounted. `/issue/:key` is only for standalone navigation
(search results, notification links).

### Anti-Pattern 2: Optimistic Insert on Create

**What people do:** Insert a fake issue object into the sprint board or backlog cache before the POST completes.
**Why it's wrong:** No client-side ID exists before the server responds. The fake entry conflicts with the real
entry on invalidation. Rollback requires identifying and removing the fake object.
**Do this instead:** Loading state in the create form. On success, `invalidateQueries` — list is small
enough on a local network that a refetch is instant (< 200ms).

### Anti-Pattern 3: Fetching Full Detail Fields on Every Sprint Board Poll

**What people do:** Add `description`, `comment`, `issuelinks` to the `fetchSprintIssues` fields list.
**Why it's wrong:** Description fields are ADF blobs. Fetching them for 50+ issues on every 60s poll
inflates payload 10-20x with data that is rarely needed.
**Do this instead:** Sprint board queries fetch `summary,status,assignee,issuetype,parent,subtasks` only.
`IssueDetailPanel` fetches full detail lazily via `['jira-issue', key]` on demand.

### Anti-Pattern 4: Three Separate Field Discovery Calls

**What people do:** Keep `discoverStoryPointsField()` and add separate `discoverEpicLinkField()` and
`discoverEpicNameField()` functions, each calling `/rest/api/2/field`.
**Why it's wrong:** Three identical HTTP calls on startup for one response payload.
**Do this instead:** Single `discoverCustomFields()` call, parse all four field IDs from one response.

### Anti-Pattern 5: Agile Board Backlog API for the Backlog View

**What people do:** Use `GET /rest/agile/1.0/board/{boardId}/backlog` as the data source for the backlog tab.
**Why it's wrong:** The board's saved filter (set by a Jira admin) may exclude issue types or add project
restrictions that are outside the app's control. Result depends on board configuration.
**Do this instead:** JQL via `/rest/api/2/search` with the explicit clauses from Question 2. Fully
predictable, consistent with the rest of the codebase.

### Anti-Pattern 6: Pre-fetching Transitions for All Issues at Board Load

**What people do:** On board mount, fire `fetchTransitions` for every sprint issue to pre-populate the cache.
**Why it's wrong:** A sprint with 40 issues fires 40 parallel API calls at load time.
**Do this instead:** Fetch transitions lazily — `onDragStart` for the specific issue being dragged. Cache
entry `['transitions', issueKey]` is shared with `StatusPopover`, so if the user already opened the
status popover for an issue, the transition data is already cached for free.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Route vs sheet decision | HIGH | createHashRouter source read; Sheet pattern proven in shadcn/ui; board-stays-mounted requirement is clear |
| Backlog JQL | HIGH | Verified against Atlassian official KB and Agile 9.14 docs; both clauses required |
| Epic field discovery | HIGH | `/rest/api/2/field` endpoint confirmed; field names documented in official API examples |
| Agile API epic/sprint/backlog move endpoints | HIGH | Verified against Agile 9.14 official docs |
| TanStack Query optimistic mutation pattern | HIGH | Official v5 docs verified; existing StatusPopover confirms pattern works in codebase |
| dnd-kit for drag-and-drop | HIGH | Official docs + multiple 2025 tutorials; no competing maintained alternative |
| Account field discovery | MEDIUM | Field name `"Account"` is instance-specific; null fallback handles unknown name; graceful-hide is the established pattern for instance-variable features |

---

## Sources

- Jira Agile Data Center 9.14.0 REST API: https://docs.atlassian.com/jira-software/REST/9.14.0/
- Atlassian KB — JQL for backlog: https://support.atlassian.com/jira/kb/jql-to-fetch-issues-in-scrum-board-backlog-and-not-part-of-sprint/
- Atlassian KB — Update Epic Link via REST: https://support.atlassian.com/jira/kb/update-epic-link-via-rest-api/
- Atlassian Server — Updating issues via REST: https://developer.atlassian.com/server/jira/platform/updating-an-issue-via-the-jira-rest-apis-6848604/
- Atlassian Server — REST API examples: https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/
- TanStack Query v5 Optimistic Updates: https://tanstack.com/query/v5/docs/react/guides/optimistic-updates
- dnd-kit overview: https://dndkit.com/
- shadcn/ui Sheet component: https://ui.shadcn.com/docs/components/radix/sheet
- Existing codebase: `/Users/mimo/Desktop/Tasker/taskflow/src/` (read directly on 2026-03-13)

---

*Architecture research for: Taskflow v1.2 Jira Parity — integration with existing Tauri 2 / React 18 / TanStack Query app*
*Researched: 2026-03-13*
