# Architecture Research

**Domain:** Tempo Timesheets integration + dashboard redesign in existing Tauri/React app
**Researched:** 2026-05-20
**Confidence:** HIGH (based on direct codebase inspection + official Tempo DC documentation)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Route Layer                               │
│  ┌───────────────┐  ┌───────────────────────────────────────┐   │
│  │ /dashboard    │  │ /tempo                                 │   │
│  │ (new static)  │  │ TempoPage.tsx — table + filter bar    │   │
│  └───────┬───────┘  └──────────────────┬────────────────────┘   │
│          │                             │                         │
│  ┌───────┴──────────┐    ┌────────────┴───────────────────┐     │
│  │ SprintHealthPanel│    │ useTempoWorklogs                │     │
│  │ MyInProgressPanel│    │ (TanStack Query hook)           │     │
│  │ NextReleasePanel │    └────────────┬───────────────────┘     │
│  └──────────────────┘                │                          │
├───────────────────────────────────────┼──────────────────────────┤
│                  Service Layer        │                          │
│  ┌────────────────┐  ┌───────────────┴──────────────────────┐   │
│  │ src/services/  │  │ src/services/tempo/                   │   │
│  │ jira/ (14 mods)│  │   client.ts   (tempoFetch wrapper)   │   │
│  │ sprints.ts     │  │   worklogs.ts (fetchWorklogs)        │   │
│  │ versions.ts    │  │   users.ts    (fetchTempoUsers)      │   │
│  │ worklogs.ts    │  │   types.ts                           │   │
│  └────────┬───────┘  │   index.ts    (barrel export)       │   │
│           │          └──────────────────────────────────────┘   │
├───────────┴──────────────────────────────────────────────────────┤
│                  Data / State Layer                               │
│  ┌──────────────────┐  ┌─────────────────────────────────────┐  │
│  │ TanStack Query   │  │ Zustand Stores                       │  │
│  │ cache            │  │  settings.store (tempoEnabled,       │  │
│  │ ['tempo', ...]   │  │    savedTempoFilters via Tauri Store)│  │
│  │ ['jira-issues',  │  │  session-only active filter state    │  │
│  │   'sprint-board']│  │    (local component state only)      │  │
│  └──────────────────┘  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `src/services/tempo/client.ts` | tempoFetch wrapper — auth, base path, apiFetch delegation | Same pattern as `aio/client.ts`: exports `tempoFetch(baseUrl, token, path, operation, params?)` |
| `src/services/tempo/worklogs.ts` | `fetchWorklogs(baseUrl, token, params)` — date range + user filter | Calls `/rest/timesheet-gadget/1.0/raw-timesheet.json` |
| `src/services/tempo/users.ts` | `fetchTempoUsers(baseUrl, token)` — people list for filter picker | Delegates to Jira `/rest/api/2/user/search?username=.` |
| `src/services/tempo/types.ts` | `TempoWorklog`, `TempoSavedFilter`, `TempoRawTimesheetResponse` TypeScript interfaces | Mirrors Tempo raw-timesheet JSON shape |
| `src/routes/dashboard/TempoPage.tsx` | Full-page worklog viewer route component | Lazy-loaded, owns filter bar + table |
| `src/routes/dashboard/TempoTable.tsx` | Scrollable day-column table | Receives flat `TempoWorklog[]`, renders hierarchy |
| `src/routes/dashboard/TempoFilterBar.tsx` | People picker + date preset chips + saved filters | Reads/writes settings store savedTempoFilters |
| `src/routes/dashboard/index.tsx` (new) | Static dashboard: SprintHealth + MyInProgress + NextRelease | Replaces widget-grid Dashboard |

---

## Recommended Project Structure

```
src/
├── services/
│   ├── jira/               # unchanged — 14 modules
│   ├── aio/                # unchanged
│   ├── gitlab.ts           # unchanged
│   └── tempo/              # NEW — follows aio/ pattern exactly
│       ├── client.ts       # tempoFetch wrapper (NOT re-exported from index)
│       ├── worklogs.ts     # fetchWorklogs — primary data function
│       ├── users.ts        # fetchTempoUsers — people for filter dropdown
│       ├── types.ts        # TempoWorklog, TempoRawTimesheetResponse, TempoSavedFilter
│       ├── index.ts        # barrel: export * from './worklogs'; export * from './types'
│       ├── worklogs.test.ts
│       └── users.test.ts
│
├── stores/
│   ├── settings.store.ts   # MODIFIED — add tempoEnabled, savedTempoFilters[], version 19
│   └── ...                 # rest unchanged
│
└── routes/
    └── dashboard/
        ├── index.tsx           # REPLACED — static 3-panel dashboard (no WidgetGrid)
        ├── MyInProgressPanel.tsx  # NEW — in-progress subtasks for current user
        ├── NextReleasePanel.tsx   # NEW — nearest unreleased fix version + countdown
        ├── SprintHealthPanel.tsx  # UNCHANGED — already exists, reused directly
        ├── TempoPage.tsx       # NEW — worklog viewer route
        ├── TempoTable.tsx      # NEW — day-column table component
        ├── TempoFilterBar.tsx  # NEW — people picker + date presets + saved filters
        ├── TempoSkeleton.tsx   # NEW — skeleton for loading state
        │
        │   # DELETE — widget system (14 files)
        ├── WidgetCard.tsx      # DELETE
        ├── WidgetGrid.tsx      # DELETE
        ├── WidgetPicker.tsx    # DELETE
        ├── WorkloadTab.tsx     # DELETE
        ├── WorkloadSkeleton.tsx# DELETE
        ├── WorkloadTab.test.tsx# DELETE
        └── widgets/            # DELETE entire folder
            ├── registry.ts
            ├── SubtasksWidget.tsx
            ├── MrHealthWidget.tsx
            ├── SprintHealthWidget.tsx
            ├── NotificationsWidget.tsx
            ├── SprintProgressWidget.tsx
            ├── ReleasesWidget.tsx
            ├── WorkloadWidget.tsx
            ├── SavedFiltersWidget.tsx
            ├── PinnedIssuesWidget.tsx
            └── CustomJqlWidget.tsx
```

### Structure Rationale

- **`tempo/` follows `aio/` exactly:** `client.ts` internal-only, domain modules re-exported from `index.ts`, `types.ts` in same folder.
- **Route at `/tempo`:** New first-class route, lazy-loaded like AIO pages. Workload is `/workload` (deleted), Tempo is `/tempo` (new) — no collision.
- **Static dashboard replaces `index.tsx` in-place:** Route registration in `routes.tsx` stays `{ path: '/dashboard', element: <Dashboard /> }` — no change needed there.
- **Widget folder fully deleted:** Nothing in `widgets/` survives. All 10 widget wrapper files are thin shells around panels that either already exist as standalone components or are deleted (WorkloadWidget).

---

## New vs. Modified Components

| File | Status | Notes |
|------|--------|-------|
| `src/services/tempo/` (entire folder) | NEW | 7 files: client, worklogs, users, types, index, 2 test files |
| `src/routes/dashboard/index.tsx` | REPLACED | Static 3-panel; all widget system code removed |
| `src/routes/dashboard/MyInProgressPanel.tsx` | NEW | In-progress subtasks for current user |
| `src/routes/dashboard/NextReleasePanel.tsx` | NEW | Nearest unreleased fix version with countdown |
| `src/routes/dashboard/TempoPage.tsx` | NEW | Route component; owns filter + table |
| `src/routes/dashboard/TempoTable.tsx` | NEW | Day-column table rendering |
| `src/routes/dashboard/TempoFilterBar.tsx` | NEW | People picker + date presets + saved filter management |
| `src/routes/dashboard/TempoSkeleton.tsx` | NEW | Skeleton for loading state |
| `src/routes/routes.tsx` | MODIFIED | Add `/tempo` route, remove `/workload` route |
| `src/stores/settings.store.ts` | MODIFIED | Add `tempoEnabled`, `savedTempoFilters`, bump to version 19; remove all widget state |
| `src/components/app/sidebar-items.ts` | MODIFIED | Replace `workload` entry with `tempo`; update presets |
| `src/main.tsx` | MODIFIED | Replace `/workload` pathname label with `/tempo` |
| `src/routes/dashboard/WikiRenderer.tsx` | MODIFIED | Replace `/workload` label with `/tempo` in route name map |
| `src/routes/dashboard/DiscussionThreads.tsx` | MODIFIED | Replace `/workload` label with `/tempo` in route name map |
| `src/components/app/Sidebar.test.tsx` | MODIFIED | Update preset fixtures (workload → tempo) |

---

## Files to Delete

**Widget system (14 files):**
- `src/routes/dashboard/WidgetCard.tsx`
- `src/routes/dashboard/WidgetGrid.tsx`
- `src/routes/dashboard/WidgetPicker.tsx`
- `src/routes/dashboard/widgets/registry.ts`
- `src/routes/dashboard/widgets/SubtasksWidget.tsx`
- `src/routes/dashboard/widgets/MrHealthWidget.tsx`
- `src/routes/dashboard/widgets/SprintHealthWidget.tsx`
- `src/routes/dashboard/widgets/NotificationsWidget.tsx`
- `src/routes/dashboard/widgets/SprintProgressWidget.tsx`
- `src/routes/dashboard/widgets/ReleasesWidget.tsx`
- `src/routes/dashboard/widgets/WorkloadWidget.tsx`
- `src/routes/dashboard/widgets/SavedFiltersWidget.tsx`
- `src/routes/dashboard/widgets/PinnedIssuesWidget.tsx`
- `src/routes/dashboard/widgets/CustomJqlWidget.tsx`

**Workload page (3 files):**
- `src/routes/dashboard/WorkloadTab.tsx`
- `src/routes/dashboard/WorkloadSkeleton.tsx`
- `src/routes/dashboard/WorkloadTab.test.tsx`

**Dead code in `settings.store.ts` to remove:**
- `DashboardLayoutItem` interface export
- `dashboardLayout` state field
- `setDashboardLayout`, `addDashboardWidget`, `removeDashboardWidget`, `updateWidgetConfig` actions
- Import of `getDefaultDashboardLayout`, `WIDGET_REGISTRY` from `widgets/registry`
- `dashboardLayout` initialization and migrate blocks (versions < 9)
- `applyPreset` call to `getDefaultDashboardLayout`

**`sidebar-items.ts` changes:**
- Remove `workload` entry from `SIDEBAR_NAV_ITEMS`
- Remove `workload` from `pmVisible` set in `getDefaultSidebarItems`
- Add `tempo` to both `devVisible` and `pmVisible`

---

## Architectural Patterns

### Pattern 1: Service Module with Internal Client

**What:** `client.ts` exports the fetch wrapper privately to the service folder. Domain modules import directly from `./client`. Barrel `index.ts` re-exports only domain functions and types — never `client.ts`.

**When to use:** Every new integration service. Established by `aio/` in v1.8.

```typescript
// src/services/tempo/client.ts  — NOT in index.ts exports
export async function tempoFetch(
  baseUrl: string,
  token: string,
  path: string,
  operation: string,
  params?: Record<string, string>,
): Promise<Response> {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/rest/timesheet-gadget/1.0${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return apiFetch('jira', url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  }, operation);
}
```

**Note on auth:** Tempo on Jira DC uses the same Jira host and the same PAT Bearer auth. No separate credential. `source: 'jira'` in `apiFetch` is correct — confirmed by `fields.ts` line 77 which already calls `/rest/tempo-accounts/1/account/search` using the Jira token.

### Pattern 2: Tempo API Endpoint — raw-timesheet

**What:** `/rest/timesheet-gadget/1.0/raw-timesheet.json` is the correct DC endpoint for bulk worklog retrieval by date range and user.

**Key parameters:**
- `targetUser` — Jira username (single user filter; omit for current authenticated user)
- `startDate` / `endDate` — format `YYYY-MM-DD`
- `projectid` — numeric Jira project ID (optional scope filter)
- `moreFields` — additional issue fields to include (e.g. `issuetype`, `status`)

**Response shape (confirmed from Tempo DC documentation):**
```typescript
// src/services/tempo/types.ts
export interface TempoRawTimesheetResponse {
  worklog: TempoWorklogGroup[];
}
export interface TempoWorklogGroup {
  key: string;        // Jira issue key, e.g. "PROJ-123"
  summary: string;    // issue summary
  entries: TempoWorklogEntry[];
  fields?: Array<{ label: string; value: string }>;  // moreFields content
}
export interface TempoWorklogEntry {
  id: number;
  comment: string;
  timeSpent: number;       // seconds
  author: string;          // Jira username
  authorFullName: string;  // display name
  startDate: number;       // UNIX milliseconds
  created: number;         // UNIX milliseconds
}
export interface TempoWorklog {
  id: number;
  issueKey: string;
  issueSummary: string;
  comment: string;
  timeSpentSeconds: number;
  authorUsername: string;
  authorDisplayName: string;
  startDate: Date;         // parsed from UNIX ms
}
export interface TempoSavedFilter {
  id: string;
  name: string;
  usernames: string[];
  datePreset: 'this-week' | 'last-week' | 'this-month' | 'custom';
  customFrom?: string;   // ISO date string
  customTo?: string;
}
```

**Important probe requirement:** The raw-timesheet endpoint behavior (single-user vs. multi-user, max results per issue) should be verified against the actual Jira instance before building the UI. The endpoint documentation states it "returns only the first 20 worklogs per issue" for the gadget view — confirm whether this applies to the REST JSON endpoint too. Plan a probe step in Phase 1.

### Pattern 3: Jira Issue Enrichment via Cache Reads

**What:** Tempo worklogs return issue keys and summaries from the raw-timesheet endpoint but no epic, issue type, or other Jira metadata. Rather than N+1 fetches, read the TanStack Query cache for sprint-board data already loaded, and fall back to individual `fetchIssue(key)` calls only for cache misses.

**Implementation:**
```typescript
// In TempoPage.tsx
const queryClient = useQueryClient();
const sprintIssues = queryClient.getQueryData<JiraIssue[]>(
  ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]
) ?? [];
const issueMap = new Map(sprintIssues.map(i => [i.key, i]));

// Cache misses: backlog/closed/epic issues not in sprint
const missedKeys = worklogIssueKeys.filter(k => !issueMap.has(k));
// useQueries for cache-deduped individual fetches — TanStack deduplicates by key
const individualResults = useQueries({
  queries: missedKeys.map(key => ({
    queryKey: ['jira-issue', key, jiraBaseUrl],
    queryFn: () => fetchIssue(jiraBaseUrl!, jiraToken!, key),
    staleTime: 5 * 60_000,
  }))
});
```

**Note:** The raw-timesheet endpoint already returns `summary` for each issue group. Epic/issue type enrichment is "nice to have" for issue type icons — mark it as optional enhancement, not required for v1 of Tempo view.

### Pattern 4: Saved Tempo Filters via settings.store Persistence

**What:** Tempo filters (saved people + date presets) persist across restarts via `settings.store` Tauri Store. Active session filter state lives in local component state (not a Zustand store) because it doesn't need cross-component sharing.

**Decision rationale:** Jira saved filters are session-only because they mirror server state. Tempo filters are app-local user preferences — no server equivalent. Use `settings.store` persist (same as `aioEnabled`, `selectedAioProjectKey`). A separate store file is not warranted for a small filter array.

**settings.store additions:**
```typescript
// Interface additions
tempoEnabled: boolean;
savedTempoFilters: TempoSavedFilter[];
addTempoFilter: (f: TempoSavedFilter) => void;
removeTempoFilter: (id: string) => void;
updateTempoFilter: (id: string, f: TempoSavedFilter) => void;

// Initializer defaults
tempoEnabled: false,
savedTempoFilters: [],

// migrate() — version bump to 19
if (version < 19) {
  if (s.tempoEnabled === undefined) s.tempoEnabled = false;
  if (s.savedTempoFilters === undefined) s.savedTempoFilters = [];
  // Remove dead widget state from persisted store
  delete s.dashboardLayout;
}
```

### Pattern 5: Static Dashboard — Props-Down Thin Index

**What:** The new `/dashboard` follows the existing codebase decision: "Dashboard panels receive props from thin index.tsx — token loading centralized; panels own their queries." No WidgetGrid, no edit mode, no layout persistence. Three fixed panels in a CSS grid.

**SprintHealthPanel already exists** — reuse directly with no modifications. `MyInProgressPanel` and `NextReleasePanel` are new but each roughly 80 lines.

```typescript
// src/routes/dashboard/index.tsx — new version
export default function Dashboard() {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  useEffect(() => {
    readSecret('jira-pat').then(setJiraToken).catch(() => setJiraToken(null));
  }, [jiraBaseUrl]);

  if (!jiraBaseUrl || !activeJiraProject || !jiraToken) return null;
  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <h1 className="text-xl font-semibold">Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SprintHealthPanel jiraBaseUrl={jiraBaseUrl} jiraToken={jiraToken} activeJiraProject={activeJiraProject} />
        <MyInProgressPanel jiraBaseUrl={jiraBaseUrl} jiraToken={jiraToken} activeJiraProject={activeJiraProject} />
        <NextReleasePanel jiraBaseUrl={jiraBaseUrl} jiraToken={jiraToken} activeJiraProject={activeJiraProject} />
      </div>
    </div>
  );
}
```

---

## Data Flow

### Tempo Worklog Request Flow

```
User selects date range + people in TempoFilterBar
    ↓
useQuery({ queryKey: ['tempo', jiraBaseUrl, from, to, ...usernames] })
    ↓ (parallel per user, or omit targetUser for current user only)
tempoFetch(baseUrl, token, '/raw-timesheet.json', 'Load Tempo Worklogs', { startDate, endDate, targetUser })
    ↓
apiFetch('jira', url, { Authorization: Bearer }, 'Load Tempo Worklogs')
    ↓
raw-timesheet.json: { worklog: [{ key, summary, entries: [...] }] }
    ↓
Transform: flatten groups → TempoWorklog[], sort by date
    ↓
TempoTable renders day-column hierarchy (epic → story → subtask rows)
```

### Jira Issue Enrichment Flow

```
TempoPage: worklog data loaded
    ↓
Extract unique issue keys from worklogs
    ↓
queryClient.getQueryData(['jira-issues', 'sprint-board', ...]) → issueMap (zero cost)
    ↓
missedKeys = worklogKeys not in issueMap
    ↓
useQueries for missed keys → ['jira-issue', key, jiraBaseUrl]
    → TanStack deduplicates identical keys automatically
    ↓
Merge issueMap + individual fetches → enriched rows (epic, issue type)
```

### Static Dashboard Flow

```
Dashboard mounts
    ↓ (parallel — all cache-warm if user has visited those routes)
SprintHealthPanel  → ['jira-issues', 'sprint-board', project, spField]
                   → ['jira-active-sprint', project]
MyInProgressPanel  → ['jira-issues', 'my-tasks', project, spField]
NextReleasePanel   → ['jira-fix-versions', project]
    ↓
stale-while-revalidate from gcTime: Infinity — instant on repeat visits
```

### State Management

```
settings.store (Tauri persist)
    savedTempoFilters → TempoFilterBar (load/save presets)
    tempoEnabled      → gates Tempo sidebar item visibility

TanStack Query cache
    ['tempo', jiraBaseUrl, from, to, ...usernames] → TempoWorklog[]
    ['jira-issues', 'sprint-board', project, spField] → JiraIssue[] (shared)
    ['jira-issue', key, jiraBaseUrl] → JiraIssue (individual enrichment)
```

---

## Query Key Strategy

All Tempo queries use the `['tempo', ...]` prefix, following the established `['aio', ...]` pattern:

```typescript
// Tempo worklogs — one entry per unique filter combination
['tempo', jiraBaseUrl, 'worklogs', from, to, ...usernames.sort()]

// Tempo users list — for people picker
['tempo', jiraBaseUrl, 'users']
```

This is isolated from:
- `['jira-issues', ...]` — Jira issue data
- `['aio', ...]` — AIO test data

`queryClient.invalidateQueries({ queryKey: ['jira-issues'] })` will NOT clear Tempo cache. Established pattern from PROJECT.md Key Decisions: "AIO query keys use `['aio', jiraBaseUrl, ...]` prefix — prevents Jira invalidation sweeps from clearing AIO cache."

---

## Build Order

```
Phase 1: Deletion + cleanup
  Delete WorkloadTab, WorkloadSkeleton, WorkloadTab.test
  Delete widgets/ folder (10 files)
  Delete WidgetCard, WidgetGrid, WidgetPicker
  Remove widget state from settings.store (+ migrate version 19)
  Remove /workload from routes.tsx, sidebar-items.ts, main.tsx,
    WikiRenderer.tsx, DiscussionThreads.tsx
  Rationale: Clean break before building new code; reduces noise
             in tests and imports

Phase 2: Service layer (src/services/tempo/)
  types.ts → client.ts → worklogs.ts → users.ts → index.ts
  + worklogs.test.ts, users.test.ts
  Rationale: UI components depend on service types and functions

Phase 3: settings.store + sidebar
  Add tempoEnabled, savedTempoFilters, version 19 migration
  Add tempo entry to sidebar-items.ts
  Rationale: TempoFilterBar reads saved filters from store;
             sidebar must know about tempo item

Phase 4: New static dashboard
  Replace src/routes/dashboard/index.tsx with static 3-panel version
  Add MyInProgressPanel.tsx, NextReleasePanel.tsx
  (SprintHealthPanel.tsx already exists — no changes)
  Rationale: Dashboard replaces in-place; route registration unchanged

Phase 5: Tempo route UI
  TempoPage.tsx, TempoTable.tsx, TempoFilterBar.tsx, TempoSkeleton.tsx
  Add /tempo route to routes.tsx
  Add tempo item to sidebar
  Rationale: Depends on Phase 2 (service) + Phase 3 (store)

Phase 6: Test + cleanup pass
  Update settings.store.test.ts for new fields
  Update Sidebar.test.tsx for preset changes
  New TempoPage smoke test
  Dead code sweep, unused imports
```

---

## Anti-Patterns

### Anti-Pattern 1: Separate Tempo Credential

**What people do:** Create a new `tempo-pat` Stronghold key and a separate Tempo auth flow.

**Why it's wrong:** Tempo on Jira DC lives on the same Jira host and accepts the same PAT. Evidence: `fields.ts` line 77 already calls `/rest/tempo-accounts/1/account/search` using the Jira Bearer token with no separate auth.

**Do this instead:** Use `readSecret('jira-pat')` in Tempo pages as-is. Use `source: 'jira'` in `apiFetch`.

### Anti-Pattern 2: Per-User Sequential Worklog Fetches

**What people do:** Loop through selected users, firing one `raw-timesheet.json?targetUser=X` request at a time.

**Why it's wrong:** 5 team members = 5 sequential requests. Perceived latency 5x worse than parallel.

**Do this instead:** Use `Promise.all` for parallel per-user fetches. Reuse `getJiraLimit()` from `src/lib/concurrency.ts` for the concurrency guard. If the endpoint supports omitting `targetUser` to get all users' data at once, probe that first.

### Anti-Pattern 3: Leaving Dead Widget State in settings.store

**What people do:** Keep `dashboardLayout`, `DashboardLayoutItem`, and widget actions in the store interface after deleting the widget system.

**Why it's wrong:** The store imports `WIDGET_REGISTRY` from `widgets/registry.ts` (a route file, not a lib). After deletion, this import becomes a broken reference. Additionally, dead persisted state accumulates in users' `settings.json` files.

**Do this instead:** Full removal — type, state fields, actions, import. Add a migrate step that `delete s.dashboardLayout` on version < 19 upgrade.

### Anti-Pattern 4: Enriching All Issue Keys via Individual Fetches

**What people do:** After loading worklogs, fire `fetchIssue(key)` for every unique issue key.

**Why it's wrong:** Sprint board cache already contains most current-sprint issues. Firing N fetches for already-cached data defeats stale-while-revalidate.

**Do this instead:** Read sprint-board cache via `queryClient.getQueryData` first. Fire individual `useQuery` calls only for cache misses. Note: the raw-timesheet endpoint already provides `summary` per issue — individual enrichment fetches are optional (only needed for epic/issue type metadata).

---

## Integration Points

### Sidebar Integration

Add to `SIDEBAR_NAV_ITEMS` in `sidebar-items.ts`:
```typescript
{
  id: 'tempo',
  label: 'Timesheets',
  path: '/tempo',
  iconName: 'Clock',   // lucide-react Clock icon
  section: 'tracking',
}
```

Remove the `workload` entry. Add `'tempo'` to both `devVisible` and `pmVisible` sets (timesheets are relevant to both roles). The settings.store version 19 migration replaces `workload` with `tempo` in any persisted `sidebarItems` arrays:

```typescript
if (version < 19) {
  if (Array.isArray(s.sidebarItems)) {
    s.sidebarItems = (s.sidebarItems as Array<{ id: string; visible: boolean }>)
      .filter(item => item.id !== 'workload')
      .concat([{ id: 'tempo', visible: true }]);
  }
}
```

### tempoEnabled Toggle

Mirror the `aioEnabled` pattern exactly:
- `tempoEnabled: boolean` in settings.store, default `false`
- Gates sidebar item visibility and all Tempo API calls
- Settings → Integrations section (alongside `aioEnabled`)

This ensures users without Tempo installed see no Tempo UI and fire zero Tempo requests.

---

## Probes Required Before Phase 5 Implementation

The Tempo `raw-timesheet.json` endpoint behavior on this specific Jira DC instance needs verification:

1. **Multi-user support:** Does omitting `targetUser` return all users' worklogs, or only the authenticated user's?
2. **Result truncation:** The documentation mentions 20 worklogs/issue for the gadget. Does the REST JSON endpoint have the same limit?
3. **Date format:** Confirm `YYYY-MM-DD` is accepted (vs. `DD/Mon/YYYY`).
4. **Authentication:** Confirm Bearer PAT works (vs. Basic Auth) — very likely yes given Tempo accounts endpoint already works.

Probe in a Phase 5 pre-implementation task using the same probe-first approach as v1.8 Phase 51 (AIO base path discovery).

---

## Sources

- Codebase: `src/services/aio/client.ts`, `src/services/jira/client.ts`, `src/services/jira/fields.ts`, `src/stores/settings.store.ts`, `src/routes/dashboard/index.tsx`, `src/routes/routes.tsx`, `src/components/app/sidebar-items.ts` — HIGH confidence
- PROJECT.md Key Decisions table — HIGH confidence (authoritative for this codebase)
- [Tempo REST API Integrations for DC](https://help.tempo.io/trg-dc/latest/rest-api-integrations) — raw-timesheet.json endpoint confirmed — MEDIUM confidence
- [Tempo raw-timesheet response shape from community sources](https://help.tempo.io/timesheet-reports-and-gadgets/en/timesheet-reports-and-gadgets-for-jira-server-and-data-center/timesheet-reports-and-gadgets/rest-api-integrations.html) — MEDIUM confidence (response fields cross-referenced from multiple sources)
- Existing `jira/fields.ts` line 77: `/rest/tempo-accounts/1/account/search` using Bearer PAT — HIGH confidence that Tempo endpoints accept same auth

---
*Architecture research for: Tempo integration + dashboard redesign in Tauri/React app*
*Researched: 2026-05-20*
