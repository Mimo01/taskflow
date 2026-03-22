# Architecture Research: v1.5 Feature Integration

**Domain:** Desktop Jira/GitLab client -- new feature integration into existing Tauri 2 + React 18 architecture
**Researched:** 2026-03-22
**Confidence:** HIGH (based on full codebase audit + Jira DC REST API v2 verification)

## System Overview: Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          AppLayout (main.tsx)                       │
│  ┌──────────┐  ┌──────────────────────────────────────────────────┐ │
│  │ Sidebar  │  │  TopBar + PinnedTabStrip + ReAuthBanner         │ │
│  │ (static  │  ├──────────────────────────────────────────────────┤ │
│  │  role-   │  │  <Outlet> (route content)                       │ │
│  │  based)  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │ │
│  │          │  │  │Dashboard │ │SprintBoard│ │IssueDetailPage  │ │ │
│  │          │  │  │(panels)  │ │(kanban)   │ │(full-page)      │ │ │
│  │          │  │  └──────────┘ └──────────┘ └──────────────────┘ │ │
│  └──────────┘  └──────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  Overlays: CommandPalette | CreateEditIssueModal | KeyboardShorts  │
├─────────────────────────────────────────────────────────────────────┤
│  Stores (Zustand)           │  Data Layer (TanStack Query)         │
│  auth, settings, filter,    │  queryKey-based caching, 5min stale  │
│  notifications, pinned-tabs │  60s poll (notifications: 30s)       │
│  recent-items, breadcrumb   │                                      │
├─────────────────────────────┤──────────────────────────────────────┤
│  Services: jira/ (14 modules) + gitlab.ts + notifications.ts      │
│  Transport: apiFetch() -> @tauri-apps/plugin-http (CORS-free)     │
└─────────────────────────────────────────────────────────────────────┘
```

## Feature-by-Feature Integration Analysis

### 1. Customizable Sidebar

**Current state:** `Sidebar.tsx` renders hardcoded NavLink lists based on `role` from settings store. Role is `'developer' | 'pm' | 'tech-lead' | null`. Links are grouped into sections ("Work") with role-conditional rendering.

**Integration approach:** MODIFY existing code

| What Changes | File | Nature |
|---|---|---|
| Sidebar component | `components/app/Sidebar.tsx` | **Major rewrite** -- replace hardcoded NavLinks with data-driven rendering from sidebar config |
| Settings store | `stores/settings.store.ts` | **Extend** -- add `sidebarItems: SidebarItem[]` and role presets |
| Settings UI | `routes/settings/` | **New section** -- sidebar customization panel |

**New types needed:**
```typescript
interface SidebarItem {
  id: string;        // e.g. 'my-tasks', 'sprint-board'
  route: string;     // e.g. '/my-tasks'
  label: string;
  icon: string;      // lucide icon name
  section?: string;  // optional grouping
}
```

**Key design decision:** Roles become presets that populate `sidebarItems[]` on first selection. Users can then add/remove/reorder items. The `role` field remains for dashboard panel defaults, but sidebar is independently customizable.

**Data flow:** `settings.store.sidebarItems` -> `Sidebar.tsx` renders via `.map()` -> Drag-and-drop reorder uses existing `@dnd-kit/core` dependency.

---

### 2. Configurable Widget-Based Dashboard

**Current state:** `routes/dashboard/index.tsx` renders a fixed 2-column grid with `SubtasksPanel`, `MrHealthPanel`, `SprintHealthPanel` (dev role) or single `SprintHealthPanel` (PM role). Panels receive credentials as props and manage own queries.

**Integration approach:** REPLACE current dashboard with widget system

| What Changes | File | Nature |
|---|---|---|
| Dashboard page | `routes/dashboard/index.tsx` | **Major rewrite** -- widget grid layout engine |
| Widget registry | `routes/dashboard/widgets/registry.ts` | **Net-new** -- maps widget IDs to components |
| Individual widgets | `routes/dashboard/widgets/*.tsx` | **Net-new** -- wrap existing panels + new widgets |
| Dashboard store | `stores/dashboard.store.ts` | **Net-new** -- persisted widget layout config |
| Settings store | `stores/settings.store.ts` | **Extend** -- version bump for migration |

**New store: `dashboard.store.ts`**
```typescript
interface WidgetConfig {
  id: string;           // unique instance ID
  type: string;         // 'subtasks' | 'mr-health' | 'sprint-health' | 'recent-activity' | ...
  position: { col: number; row: number };
  size: { w: number; h: number };  // grid units
}

interface DashboardState {
  widgets: WidgetConfig[];
  addWidget: (type: string) => void;
  removeWidget: (id: string) => void;
  moveWidget: (id: string, position: { col: number; row: number }) => void;
  resizeWidget: (id: string, size: { w: number; h: number }) => void;
  resetToPreset: (role: 'developer' | 'pm') => void;
}
```

**Pattern:** Each widget is a self-contained component that receives credentials from a shared context (or reads from auth store directly). This matches the existing pattern where "panels manage their own queries." The dashboard page becomes a layout engine, not a data orchestrator.

**Widget candidates (existing panels wrapped):**
- `SubtasksPanel` -> `subtasks-widget`
- `MrHealthPanel` -> `mr-health-widget`
- `SprintHealthPanel` -> `sprint-health-widget`

**Widget candidates (net-new):**
- `recent-activity-widget` (latest notifications)
- `quick-filters-widget` (saved filter shortcuts)
- `time-tracking-widget` (my worklogs today/this week)

**Grid library decision:** Use CSS Grid with manual positioning (no external library). The dashboard has a fixed number of widgets (not hundreds), and @dnd-kit already handles drag. Adding react-grid-layout would be a new dependency for minimal benefit.

---

### 3. Issue Activity History Timeline

**Current state:** `IssueDetailPage.tsx` shows issue detail with content + sidebar + comments. The `fetchIssueDetail` function already requests fields including `created` and `updated`. Comments are displayed in a thread. No changelog/history is fetched.

**Integration approach:** ADD new tab/section to issue detail

| What Changes | File | Nature |
|---|---|---|
| Jira changelog service | `services/jira/changelog.ts` | **Net-new** -- fetch issue changelog |
| Activity timeline component | `routes/dashboard/issue-detail/ActivityTimeline.tsx` | **Net-new** |
| Issue detail page | `routes/dashboard/IssueDetailPage.tsx` | **Extend** -- add Activity tab |
| Jira barrel export | `services/jira/index.ts` | **Extend** -- add `export * from './changelog'` |
| Jira types | `services/jira/types.ts` | **Extend** -- add changelog types |

**Jira DC API:** `GET /rest/api/2/issue/{issueKey}?expand=changelog` returns changelog in the response. For issues with >100 changes, use the dedicated endpoint: `GET /rest/api/2/issue/{issueKey}/changelog?startAt=0&maxResults=100` (paginated). **Confidence: HIGH** -- verified via Atlassian community docs and API reference.

**New types:**
```typescript
interface ChangelogEntry {
  id: string;
  author: { displayName: string; name: string };
  created: string;  // ISO 8601
  items: ChangelogItem[];
}

interface ChangelogItem {
  field: string;
  fieldtype: string;
  from: string | null;
  fromString: string | null;
  to: string | null;
  toString: string | null;
}
```

**Data flow:** New TanStack Query hook with queryKey `['jira-issue-changelog', issueKey]`. Displayed as a unified timeline interleaving changelog entries + comments, sorted by timestamp. Tab-based switching (Comments | History | All Activity) on the issue detail page.

**Important caveat:** The `expand=changelog` approach on the issue endpoint is limited to the 100 most recent changes. For completeness, use the dedicated `/changelog` endpoint with pagination. This follows the same `fetchAllSearchPages` pattern already in `client.ts`.

---

### 4. Time Tracking / Work Log Support

**Current state:** `services/jira/worklogs.ts` exists but only fetches author display names (used for attribution enrichment). `JiraIssue.fields.timetracking` type already exists in `types.ts`. `fetchIssueDetail` already requests the `timetracking` field. The issue detail sidebar does not display time tracking info.

**Integration approach:** EXTEND existing worklog service + ADD UI components

| What Changes | File | Nature |
|---|---|---|
| Worklogs service | `services/jira/worklogs.ts` | **Major extend** -- add full CRUD (list with details, add, update, delete) |
| Worklog types | `services/jira/types.ts` | **Extend** -- add `JiraWorklog` interface |
| Time tracking display | `routes/dashboard/issue-detail/TimeTrackingSection.tsx` | **Net-new** |
| Worklog dialog | `routes/dashboard/issue-detail/WorklogDialog.tsx` | **Net-new** |
| Issue detail sidebar | `routes/dashboard/issue-detail/IssueDetailSidebar.tsx` | **Extend** -- add time tracking section |

**Jira DC API endpoints:**
- `GET /rest/api/2/issue/{issueKey}/worklog` -- list worklogs (paginated)
- `POST /rest/api/2/issue/{issueKey}/worklog` -- add worklog
- `PUT /rest/api/2/issue/{issueKey}/worklog/{id}` -- update worklog
- `DELETE /rest/api/2/issue/{issueKey}/worklog/{id}` -- delete worklog

**Confidence: HIGH** -- `fetchAllWorklogPages` already exists in `client.ts`, proving the pagination pattern works. The existing service just needs to return full worklog objects instead of extracting author names.

**New type:**
```typescript
interface JiraWorklog {
  id: string;
  author: { displayName: string; name: string };
  comment?: string;
  started: string;       // ISO 8601
  timeSpent: string;     // e.g. "2h 30m"
  timeSpentSeconds: number;
  created: string;
  updated: string;
}
```

---

### 5. Watchers and Starring

**Current state:** No watcher/starring functionality exists. The `JiraIssueDetail` type does not include watchers. The issue detail page has no watch/star UI.

**Integration approach:** NET-NEW service + UI in issue detail

| What Changes | File | Nature |
|---|---|---|
| Watchers service | `services/jira/watchers.ts` | **Net-new** |
| Jira barrel export | `services/jira/index.ts` | **Extend** |
| Jira types | `services/jira/types.ts` | **Extend** -- add `JiraWatchers` |
| Issue detail header | `routes/dashboard/IssueDetailPage.tsx` | **Extend** -- add watch/star buttons |
| Starred issues store | `stores/starred.store.ts` | **Net-new** -- local-only starring (not Jira server-side) |

**Jira DC API endpoints:**
- `GET /rest/api/2/issue/{issueKey}/watchers` -- get watcher list + count
- `POST /rest/api/2/issue/{issueKey}/watchers` -- add current user as watcher (body: `"username"`)
- `DELETE /rest/api/2/issue/{issueKey}/watchers?username={name}` -- remove watcher

**Critical DC difference:** Jira Data Center uses `username` (the `name` field), NOT `accountId`. The POST body is a plain JSON string (e.g., `"jsmith"`), not an object. **Confidence: HIGH** -- consistent with all other DC API patterns in the codebase.

**Design decision: Watchers vs Starring.** Watchers is server-side (Jira API). Starring is client-side only (persisted in a local Zustand store, like pinned tabs). Both are useful: watchers triggers Jira notifications; starring is a personal bookmark. Implement both -- watch button calls Jira API, star button toggles local store.

---

### 6. Saved Filters

**Current state:** `filter.store.ts` has session-only filter state (Sets for epics, labels, assignees, statuses). `settings.store.ts` already has `quickFilters: QuickFilter[]` with full CRUD (add, remove, rename, reorder). `UnifiedFilterBar.tsx` renders quickfilter presets with context menu actions.

**Integration approach:** EXTEND existing system (partially already built)

| What Changes | File | Nature |
|---|---|---|
| Filter store | `stores/filter.store.ts` | **Extend** -- add view-scoping (which view a filter applies to) |
| Settings store | `stores/settings.store.ts` | **Minor extend** -- add view context to QuickFilter |
| Saved filters route | `routes/dashboard/SavedFiltersPage.tsx` | **Net-new** -- management UI for all saved filters |
| Sidebar | `components/app/Sidebar.tsx` | **Extend** -- add saved filters link (if customizable sidebar is done) |

**Key insight:** The quickfilter system is 80% built. What is missing:
1. **View scoping** -- filters should know which view they apply to (sprint board, backlog, or "all")
2. **A dedicated management page** -- currently filters are only managed via context menu on the filter bar
3. **Cross-view filter application** -- applying a saved filter should navigate to the correct view + apply the filter state

**Extended QuickFilter type:**
```typescript
interface QuickFilter {
  id: string;
  name: string;
  epics: string[];
  labels: string[];
  assignees: string[];
  statuses: string[];
  view?: 'sprint-board' | 'backlog' | 'all';  // NEW
}
```

---

### 7. Attachments Viewer

**Current state:** `JiraIssueDetail.fields.attachment` is typed as `JiraAttachment[]` (id, filename, content URL, thumbnail URL, mimeType). `fetchIssueDetail` already requests the `attachment` field. `IssueDetailContent.tsx` builds an `attachmentMap` for wiki `!image.png!` references but does NOT display a standalone attachment list. `ImageLightbox.tsx` exists for image viewing.

**Integration approach:** ADD component to issue detail page

| What Changes | File | Nature |
|---|---|---|
| Attachments section | `routes/dashboard/issue-detail/AttachmentsSection.tsx` | **Net-new** |
| Issue detail page | `routes/dashboard/IssueDetailPage.tsx` | **Extend** -- render AttachmentsSection |
| Image lightbox | `routes/dashboard/ImageLightbox.tsx` | **Extend** -- support gallery navigation |

**Data flow:** Attachments are already fetched with issue detail (no new API call needed). The new component just needs to:
1. List all attachments with filename, size, type icon
2. Inline preview for images (reuse `ImageLightbox`)
3. Download link for non-image files (opens `attachment.content` URL via `openUrl` from `@tauri-apps/plugin-opener`)
4. File type icons based on `mimeType`

**No new service module needed.** The data is already in `JiraIssueDetail`.

---

### 8. Mention Autocomplete in Comments

**Current state:** `CommentComposer.tsx` has a plain `<Textarea>` with wiki markup toolbar (bold, italic, code, list). Comment body is posted as wiki markup string via `postComment()`. No autocomplete exists.

**Integration approach:** ADD autocomplete overlay to CommentComposer

| What Changes | File | Nature |
|---|---|---|
| User search service | `services/jira/users.ts` | **Net-new** |
| Jira barrel export | `services/jira/index.ts` | **Extend** |
| Mention autocomplete | `routes/dashboard/MentionAutocomplete.tsx` | **Net-new** |
| Comment composer | `routes/dashboard/CommentComposer.tsx` | **Extend** -- integrate mention trigger |

**Jira DC API endpoint:** `GET /rest/api/2/user/picker?query={prefix}&maxResults=10` returns user suggestions. On DC, results include `name` (username) and `displayName`. **Confidence: HIGH** -- verified via Atlassian docs.

**Design pattern:** Monitor textarea for `@` character. On detection, show a positioned dropdown (similar to cmdk pattern) that queries the user picker API with debounce. On selection, insert `[~username]` (Jira wiki mention syntax). This is a contained enhancement to `CommentComposer.tsx` -- no other components affected.

**Implementation approach:** Build a custom hook `useMentionAutocomplete(textareaRef)` that:
1. Listens for `@` keystrokes
2. Tracks the mention query prefix (characters after `@`)
3. Returns `{ suggestions, isOpen, selectedIndex, insert(user) }`
4. Uses TanStack Query with a short staleTime for the user picker API

**No external library needed.** The autocomplete is scoped to a single textarea, not a rich text editor. A simple positioned popover (reusing shadcn `Popover`) is sufficient.

---

### 9. Bulk Operations on Issues

**Current state:** Issue mutations are single-issue: `updateIssueField()`, `bulkUpdateIssue()` (single issue, multiple fields), `transitionIssue()`. No multi-select UI exists on any list view. `SprintBoardTab` has drag-and-drop for single cards. `BacklogPage` has row-based list with filter bar.

**Integration approach:** ADD multi-select layer to list views + batch mutation

| What Changes | File | Nature |
|---|---|---|
| Selection store | `stores/selection.store.ts` | **Net-new** -- session-only multi-select state |
| Bulk operations bar | `components/app/BulkOperationsBar.tsx` | **Net-new** -- floating action bar |
| Bulk service | `services/jira/bulk.ts` | **Net-new** -- parallel issue updates |
| Backlog page | `routes/dashboard/BacklogPage.tsx` | **Extend** -- add checkbox column + selection |
| Sprint board | `routes/dashboard/SprintBoardTab.tsx` | **Extend** -- add multi-select mode |
| My Tasks | `routes/dashboard/MyTasksTab.tsx` | **Extend** -- add checkbox column |
| Jira barrel export | `services/jira/index.ts` | **Extend** |

**Critical constraint: No bulk API on Jira DC.** Jira Data Center REST API v2 has NO dedicated bulk edit endpoint (unlike Jira Cloud's v3 API). Bulk operations must be implemented as parallel `PUT /rest/api/2/issue/{key}` calls. Use `Promise.allSettled()` with concurrency limiting (max 5 parallel requests) to avoid overwhelming the Jira server.

**New store:**
```typescript
interface SelectionState {
  selectedKeys: Set<string>;
  toggle: (key: string) => void;
  selectRange: (keys: string[]) => void;  // shift+click range
  selectAll: (keys: string[]) => void;
  clearAll: () => void;
}
```

**Bulk operations to support:**
1. Transition (move to status) -- calls `transitionIssue()` per issue
2. Assign -- calls `updateIssueField()` per issue
3. Set priority -- calls `updateIssueField()` per issue
4. Add label -- calls `updateIssueField()` per issue

**UX pattern:** Checkbox appears on hover (like Jira web). When 1+ issues selected, a floating "Bulk Actions" bar appears at the bottom of the viewport with action buttons. Progress indicator shows N/M completed. Errors are collected and displayed after completion.

---

### 10. Board Quick Filters

**Current state:** `UnifiedFilterBar.tsx` provides multi-select filter dropdowns (epics, labels, assignees, statuses) with quickfilter presets. It is used on `BacklogPage` and `SprintBoardTab`. The filter store is session-only.

**Integration approach:** EXTEND existing filter bar for board-specific quick access

| What Changes | File | Nature |
|---|---|---|
| Board quick filter chips | `routes/dashboard/BoardQuickFilters.tsx` | **Net-new** -- compact one-click filter chips |
| Sprint board | `routes/dashboard/SprintBoardTab.tsx` | **Extend** -- render quick filter chips above columns |
| Filter store | `stores/filter.store.ts` | **Extend** -- add board-specific preset logic |

**Design:** Board quick filters are predefined one-click filter shortcuts that appear as chips above the sprint board columns. Unlike the full filter bar (which has dropdowns), these are instant toggles:
- "Only My Issues" -- filters to current user
- "Recently Updated" -- issues updated in last 24h
- Status category chips -- "To Do" / "In Progress" / "Done"
- Saved quickfilter presets (from settings store)

**This leverages the existing filter infrastructure.** Each chip simply calls the appropriate `toggleAssignee/toggleStatus` actions. The only new code is the chip UI component and the board-specific preset definitions.

---

## Component Responsibilities Summary

| Component | Responsibility | New/Modified |
|---|---|---|
| `Sidebar.tsx` | Data-driven nav rendering from sidebar config | **Modified** |
| `dashboard/index.tsx` | Widget grid layout engine | **Modified (rewrite)** |
| `dashboard/widgets/` | Self-contained dashboard widgets | **Net-new directory** |
| `issue-detail/ActivityTimeline.tsx` | Unified changelog + comments timeline | **Net-new** |
| `issue-detail/TimeTrackingSection.tsx` | Time tracking display + worklog CRUD | **Net-new** |
| `issue-detail/AttachmentsSection.tsx` | File list with inline preview | **Net-new** |
| `CommentComposer.tsx` | Comment input with mention autocomplete | **Modified** |
| `BulkOperationsBar.tsx` | Floating multi-select action bar | **Net-new** |
| `BoardQuickFilters.tsx` | One-click filter chips for sprint board | **Net-new** |
| `SavedFiltersPage.tsx` | Filter management UI | **Net-new** |

## New Stores

| Store | Persistence | Purpose |
|---|---|---|
| `dashboard.store.ts` | Tauri LazyStore | Widget layout config |
| `selection.store.ts` | None (session) | Multi-select state for bulk ops |
| `starred.store.ts` | Tauri LazyStore | Client-side issue starring |

## New Service Modules

| Module | Jira DC API Endpoints |
|---|---|
| `services/jira/changelog.ts` | `GET /issue/{key}/changelog` (paginated) |
| `services/jira/watchers.ts` | `GET/POST/DELETE /issue/{key}/watchers` |
| `services/jira/users.ts` | `GET /user/picker?query={prefix}` |
| `services/jira/bulk.ts` | Parallel `PUT /issue/{key}` with concurrency control |

**`services/jira/worklogs.ts`** -- already exists, needs major extension for full CRUD.

## Modified Existing Stores

| Store | Changes |
|---|---|
| `settings.store.ts` | Add `sidebarItems[]`, extend `QuickFilter` with view scope, version bump (9) |
| `filter.store.ts` | Add view context, board-specific preset logic |

## New Routes

| Route | Component | Sidebar Entry |
|---|---|---|
| None new required | Saved filters can be a settings sub-page or sidebar item | Optional |

**No new top-level routes needed.** All new features integrate into existing routes (issue detail page, dashboard, sprint board, backlog). If a dedicated saved filters page is desired, it would be a new route `/saved-filters`.

## Data Flow Patterns

### Widget Dashboard Data Flow
```
dashboard.store.ts (persisted widget config)
    |
    v
Dashboard index.tsx (layout engine)
    |
    v (renders each widget by type)
WidgetWrapper
    |
    v (each widget manages own data)
SubtasksWidget --> useQuery(['jira-issues', 'my-tasks', ...])
MrHealthWidget --> useQuery(['gitlab-mrs', ...])
SprintHealthWidget --> useQuery(['jira-sprint-issues', ...])
```

### Mention Autocomplete Data Flow
```
User types '@' in CommentComposer
    |
    v
useMentionAutocomplete hook detects trigger
    |
    v
useQuery(['jira-user-picker', prefix], { staleTime: 30s })
    |
    v
MentionAutocomplete popover renders suggestions
    |
    v
User selects -> insert [~username] at cursor position
```

### Bulk Operations Data Flow
```
User checks issues (checkbox on list rows)
    |
    v
selection.store.selectedKeys (Set<string>)
    |
    v
BulkOperationsBar renders (when selectedKeys.size > 0)
    |
    v
User picks action (e.g., "Transition to In Progress")
    |
    v
bulkTransition(keys[], targetStatusId) in services/jira/bulk.ts
    |
    v
Promise.allSettled(keys.map(k => transitionIssue(k, statusId)))
    |  (max 5 concurrent)
    v
Progress callback -> UI progress bar
    |
    v
queryClient.invalidateQueries(['jira-issues'])
selection.store.clearAll()
```

## Recommended Project Structure (New Files)

```
src/
├── components/app/
│   ├── Sidebar.tsx                    # MODIFIED: data-driven rendering
│   └── BulkOperationsBar.tsx          # NET-NEW
├── routes/dashboard/
│   ├── index.tsx                      # MODIFIED: widget grid layout
│   ├── widgets/
│   │   ├── registry.ts               # NET-NEW: widget type -> component map
│   │   ├── SubtasksWidget.tsx         # NET-NEW: wraps existing panel
│   │   ├── MrHealthWidget.tsx         # NET-NEW: wraps existing panel
│   │   ├── SprintHealthWidget.tsx     # NET-NEW: wraps existing panel
│   │   ├── RecentActivityWidget.tsx   # NET-NEW
│   │   └── TimeTrackingWidget.tsx     # NET-NEW
│   ├── issue-detail/
│   │   ├── ActivityTimeline.tsx       # NET-NEW
│   │   ├── TimeTrackingSection.tsx    # NET-NEW
│   │   ├── AttachmentsSection.tsx     # NET-NEW
│   │   └── WorklogDialog.tsx          # NET-NEW
│   ├── BoardQuickFilters.tsx          # NET-NEW
│   ├── MentionAutocomplete.tsx        # NET-NEW
│   └── CommentComposer.tsx            # MODIFIED: mention integration
├── services/jira/
│   ├── changelog.ts                   # NET-NEW
│   ├── watchers.ts                    # NET-NEW
│   ├── users.ts                       # NET-NEW
│   ├── bulk.ts                        # NET-NEW
│   ├── worklogs.ts                    # MODIFIED: full CRUD
│   ├── index.ts                       # MODIFIED: new exports
│   └── types.ts                       # MODIFIED: new interfaces
├── stores/
│   ├── dashboard.store.ts             # NET-NEW
│   ├── selection.store.ts             # NET-NEW
│   ├── starred.store.ts               # NET-NEW
│   ├── settings.store.ts              # MODIFIED: sidebar items, version bump
│   └── filter.store.ts               # MODIFIED: view scoping
└── hooks/
    └── useMentionAutocomplete.ts      # NET-NEW
```

## Build Order (Dependency-Aware)

Features have the following dependency graph:

```
Saved Filters (6) -- extends existing quickfilters, no deps
    |
Board Quick Filters (10) -- depends on filter store extensions from (6)

Attachments Viewer (7) -- no deps, data already fetched
Activity History (3) -- no deps, new service + UI
Time Tracking (4) -- no deps, extends existing service
Watchers/Starring (5) -- no deps, new service + UI
Mention Autocomplete (8) -- no deps, new service + hook

Customizable Sidebar (1) -- no deps, but affects navigation for all features
Widget Dashboard (2) -- depends on (1) for sidebar link; wraps existing panels

Bulk Operations (9) -- depends on list views being stable; most complex
```

**Recommended build order:**

| Phase | Features | Rationale |
|---|---|---|
| **Phase 1** | Attachments Viewer (7), Activity History (3), Time Tracking (4) | Zero dependencies on other new features. All integrate into existing issue detail page. Low risk. |
| **Phase 2** | Watchers/Starring (5), Mention Autocomplete (8) | Also issue detail page scope. Slightly more complex (new API endpoints, textarea integration). |
| **Phase 3** | Saved Filters (6), Board Quick Filters (10) | Filter system extensions. Board quick filters depends on saved filters store changes. |
| **Phase 4** | Customizable Sidebar (1) | Modifies global navigation. Should be done after issue-detail features are stable so sidebar items are finalized. |
| **Phase 5** | Widget Dashboard (2) | Most architecturally impactful. Wraps existing panels into widgets. Best done last when all other features are stable. |
| **Phase 6** | Bulk Operations (9) | Most complex (multi-select across views, progress tracking, error aggregation). Benefits from stable list views. |

**Phase ordering rationale:**
1. Start with contained, low-risk issue detail features (phases 1-2) to ship value early
2. Filter enhancements (phase 3) are self-contained and extend proven patterns
3. Sidebar customization (phase 4) changes global navigation -- do after feature set is known
4. Dashboard redesign (phase 5) wraps existing panels, best done when panels are stable
5. Bulk operations (phase 6) touches multiple views and is the most complex integration

## Anti-Patterns to Avoid

### Anti-Pattern 1: Prop-Threading Credentials to Widgets

**What people do:** Pass `jiraBaseUrl`, `jiraToken`, `gitlabBaseUrl`, `gitlabToken` through dashboard -> widget wrapper -> widget component (3+ levels).
**Why it's wrong:** Dashboard index.tsx already does this and it is the heaviest code in the file. With N widgets, the prop threading explodes.
**Do this instead:** Each widget reads credentials directly from `useAuthStore()` and `readSecret()`, matching the pattern used by every other route-level component. The dashboard page becomes a pure layout engine with zero prop threading.

### Anti-Pattern 2: Shared Selection State in Filter Store

**What people do:** Add `selectedIssueKeys` to the existing `filter.store.ts`.
**Why it's wrong:** Filter state is about what to show. Selection state is about what to act on. Mixing them makes clearing filters accidentally clear selections.
**Do this instead:** Create a separate `selection.store.ts` with its own lifecycle.

### Anti-Pattern 3: Fetching Changelog on Every Issue Load

**What people do:** Add `expand=changelog` to `fetchIssueDetail`.
**Why it's wrong:** Changelog can be large (100+ entries) and is only shown on the Activity tab. Loading it eagerly doubles the issue detail payload.
**Do this instead:** Fetch changelog lazily via a separate TanStack Query hook, only when the Activity tab is selected. Keep `fetchIssueDetail` lean.

### Anti-Pattern 4: Rich Text Editor for Mention Autocomplete

**What people do:** Replace the textarea with a rich text editor (ProseMirror, TipTap, Slate) to get mention support.
**Why it's wrong:** Jira DC expects wiki markup strings, not rich text. A WYSIWYG editor would need to serialize back to wiki markup, adding massive complexity and a new dependency.
**Do this instead:** Keep the plain textarea. Intercept `@` keystrokes, show a positioned popover, and insert `[~username]` wiki markup on selection. Simple, reliable, and consistent with DC's markup format.

## Integration Points

### Jira DC REST API v2 Endpoints (New)

| Endpoint | Feature | Auth | Notes |
|---|---|---|---|
| `GET /issue/{key}/changelog` | Activity History | Bearer PAT | Paginated, 100 per page |
| `GET /issue/{key}/watchers` | Watchers | Bearer PAT | Returns count + watcher list |
| `POST /issue/{key}/watchers` | Watchers | Bearer PAT | Body: `"username"` (plain string) |
| `DELETE /issue/{key}/watchers?username=X` | Watchers | Bearer PAT | DC uses `username`, not `accountId` |
| `GET /issue/{key}/worklog` | Time Tracking | Bearer PAT | Already paginated in `client.ts` |
| `POST /issue/{key}/worklog` | Time Tracking | Bearer PAT | Body: `{ timeSpent, started, comment }` |
| `PUT /issue/{key}/worklog/{id}` | Time Tracking | Bearer PAT | Same body as POST |
| `DELETE /issue/{key}/worklog/{id}` | Time Tracking | Bearer PAT | 204 on success |
| `GET /user/picker?query=X` | Mentions | Bearer PAT | Returns `{ users: [{ name, displayName }] }` |

### Internal Boundaries

| Boundary | Communication | Considerations |
|---|---|---|
| Dashboard <-> Widgets | Props (layout config only) | Widgets read auth/settings from stores directly |
| IssueDetailPage <-> New sections | Props (issue data) | Changelog fetched separately (lazy) |
| BulkOpsBar <-> List views | selection.store (Zustand) | Bar floats above content, reads from store |
| Sidebar <-> settings.store | Zustand subscription | Sidebar re-renders on sidebarItems change |
| CommentComposer <-> MentionAutocomplete | Hook return values | Hook manages popover state, composer manages text |

## Sources

- [Jira DC REST API v2 Reference (9.14.0)](https://docs.atlassian.com/software/jira/docs/api/REST/9.14.0/)
- [Jira DC Changelog via REST API](https://support.atlassian.com/jira/kb/how-to-analyze-the-history-or-changelog-of-an-issue-in-jira/)
- [Jira Changelog Pagination Limitation](https://community.atlassian.com/forums/Jira-questions/Rest-API-limiting-changelog-history-results-to-100-even-if/qaq-p/1466525)
- [Jira DC Bulk Update Approach](https://support.atlassian.com/jira/kb/update-issues-based-on-jql-with-rest-api-in-jira-data-center/)
- [Jira User Picker API](https://docs.atlassian.com/software/jira/docs/api/REST/9.14.0/)
- Full codebase audit of `/Users/mimo/Desktop/Tasker/taskflow/src/` (2026-03-22)

---
*Architecture research for: Taskflow v1.5 feature integration*
*Researched: 2026-03-22*
