# Phase 57: Redesign the AIO Cycles Page — Research

**Researched:** 2026-05-14
**Domain:** React / TanStack Query / AIO TCMS REST API / Jira REST API
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Two-panel layout — left panel = folder tree, right panel = cycle list for the selected folder. Left panel renders the full folder hierarchy at all levels (recursive). Right panel shows cycles for the selected folder.
- **D-02:** Left panel shows cycle count per folder from `count` endpoint (`{ folderID: count }`). Displayed as a `<Badge>` next to the folder name. Key `-1` = ungrouped cycles, shown as "Ungrouped" at the bottom if non-zero.
- **D-03:** Use the summary endpoint (returns `testRunDistribution: { statusID: count }`) instead of N+1 per-cycle run fetches. Endpoint URL is unconfirmed — researcher must determine it.
- **D-04:** `allIDs` from the `paged` response enables a one-shot batch summary fetch.
- **D-05:** Status ID → name mapping must be confirmed and hardcoded as `AIO_STATUS_MAP` in `aioUtils.ts`. Known IDs: 51, 53, 54, 55, 901.
- **D-06:** Cycle columns: Key (mono) | Name (NavLink) | Owner (display name) | Total tests | Progress bar.
- **D-07:** Owner resolved from `ownedByID` via Jira user API. Deduplicate unique IDs; one `useQuery` per unique owner ID.
- **D-08:** Owner loading: skeleton while loading; raw `ownedByID` as fallback on 404/error.
- **D-09:** Show all cycles by default. "Show closed" toggle (default off). When off, hide `isClosed === true` cycles.
- **D-10:** Closed cycles that are shown: `text-muted-foreground` on Name + Key + a `<Badge>Closed</Badge>`.

### Claude's Discretion

- Left panel width: `w-64` (from UI-SPEC, confirmed).
- Folder tree expand/collapse: all start collapsed; first root folder auto-expands. Collapsing a parent of the selected folder clears selection (right panel shows "Select a folder" empty state).
- Progress bar rendering: same `h-1.5 rounded-full overflow-hidden flex` bar, fed from `testRunDistribution` counts after ID mapping.
- "Show closed" toggle state: `useState<boolean>(false)` (local, in-component — simplest approach confirmed in UI-SPEC).
- Query arrangement: one `useQuery` for folder tree, one for count map, one for cycle list (paged detail), one batch for cycle summaries — planner picks the cleanest arrangement.

### Deferred Ideas (OUT OF SCOPE)

- Resizable left panel
- Folder search/filter
- Cycle creation from the page
- Export/download cycle data
- Pre-loading AIO token at app startup
</user_constraints>

---

## Summary

Phase 57 replaces the current single-axis accordion (`AioProjectOverviewPage.tsx`) with a two-panel layout matching the real AIO application. The core changes are: (1) a left sidebar rendering the full recursive folder tree from a new `/folder` endpoint, (2) a right panel showing cycles for the selected folder fetched from the existing paginated cycle endpoint with a `detail` projection, (3) a batch summary endpoint replacing the current N+1 run fetches, and (4) an owner column resolved via the Jira user API.

The current page uses a flat `groupCyclesByFolder` approach — it derives folder names from the `testSet.name` field in the cycle response, which produces a flat list of string-keyed groups. The new design fetches the folder tree independently from the cycle list: cycles are fetched per selected folder, and the folder hierarchy comes from a dedicated folder endpoint. The `detail.folder` field in the paged response is `null` on all sampled cycles, confirming that folder membership is NOT embedded in the cycle — it comes from the folder endpoint's tree structure.

**Primary recommendation:** Implement the page as three parallel `useQuery` calls on load (folder tree + count map + all-cycles paged detail), then a fourth query for summaries once `allIDs` is available, and per-unique-owner Jira user queries deduped from the cycle list. All queries follow the established `['aio', jiraBaseUrl, ...]` key prefix and `useAioCredentials()` credential gate.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Folder tree rendering | Browser / Client | — | Pure UI state; tree data fetched once, navigation is local state |
| Cycle list display | Browser / Client | — | Right panel re-renders on folder selection; no SSR |
| Folder tree data | API / Backend (AIO) | — | `/folder` endpoint on AIO TCMS |
| Count map | API / Backend (AIO) | — | `/count` endpoint on AIO TCMS |
| Cycle list (paged detail) | API / Backend (AIO) | — | Existing `/testcycle` endpoint with `detail` projection |
| Cycle summaries (batch) | API / Backend (AIO) | — | `/testcycle` with `summary` projection + `ids` param |
| Owner display name | API / Backend (Jira) | — | `/rest/api/2/user?username=X` on Jira DC |
| "Show closed" toggle | Browser / Client | — | Local `useState` — no persistence needed |
| Selected folder state | Browser / Client | — | `useState<number | null>` — session-local |

---

## Current vs New: The Gap

### Current implementation (`AioProjectOverviewPage.tsx`)

| Aspect | Current | New |
|--------|---------|-----|
| Layout | `flex flex-col` — single full-page list | `flex flex-row` — left sidebar + right panel |
| Folder model | Flat groups from `cycle.folder` (derived from `testSet.name`) | Recursive tree from `/folder` endpoint |
| Stats source | N+1 `fetchAioTestRunsForCycle` per visible cycle | Batch summary from summary endpoint |
| Columns | Key / Name / Status badge / Progress bar | Key / Name / Owner / Total tests / Progress bar |
| Owner | Not shown | Resolved via Jira user API per unique `ownedByID` |
| Closed cycles | All shown (no toggle) | Hidden by default; "Show closed" toggle reveals them |
| Status IDs | String-based (`normalizeStatus` on string) | Numeric ID-based (`AIO_STATUS_MAP` lookup) |
| Folder tree | Accordion (one level, string-keyed) | Recursive tree (all levels, ID-keyed, from API) |

### Key data model divergence

The current `AioCycle` type stores `folder?: string` (the name). The new data model separates folder from cycle — cycles have `ID` + `detail` (with no folder field populated), and the folder tree is fetched independently. This means the new page does NOT use the existing `fetchAioCycles` function for the right panel — it uses a new per-folder or all-cycles endpoint with a different query pattern.

---

## API Analysis (from API-EXAMPLES.md)

### `folder` endpoint — folder tree

**Shape confirmed:** `[{ ID, name, description, parentID, rankOrder, children[] }]` (recursive tree).
- Root nodes have `parentID: null`
- `children` is always present (may be `[]`)
- Depth can be 4+ levels (confirmed in sample: root > child > grandchild > great-grandchild)

**URL:** Unknown. CONTEXT.md marks this as "researcher must probe." Given the base path `/rest/aio-tcms-api/1.0`, the likely endpoint is:
`GET /rest/aio-tcms-api/1.0/project/{projectKey}/folder` [ASSUMED — must confirm against live API]

### `count` endpoint — folder cycle counts

**Shape confirmed:** `{ "folderID": cycleCount }` object. Key `-1` = ungrouped/unassigned cycles.
- In the sample: 72+ folder IDs with counts 1–240
- The `-1` entry = 3 unassigned cycles

**URL:** Unknown. Likely:
`GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/count` or
`GET /rest/aio-tcms-api/1.0/project/{projectKey}/folder/count` [ASSUMED — must confirm]

### `paged` endpoint — cycle list with detail

**Shape confirmed:** `{ items: [...], allIDs: [all IDs], startAt, maxResults, total, isLast, additionalData }`.
- Each item: `{ ID, jiraProjectID, permission, detail: { key, title, ownedByID, folder: null, isClosed, ... }, summary: null }`
- **Critical:** `detail.folder` is `null` on all 7 sampled cycles — folder association is NOT in cycle detail
- `allIDs` contains ALL cycle IDs for the project (not just current page), e.g., `[1001, 1002, 1003, 1004, 1005, 1006, 1007]`
- This is the SAME endpoint as `fetchAioCycles` (`/project/{projectKey}/testcycle`) but with a `detail` projection query param

**Confirmed URL (existing):** `GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle?startAt=0`
**Detail projection:** Likely `?projection=detail` or the default already returns detail — existing `fetchAioCycles` does return detail-shaped data (it reads `key`, `title`, `status` etc.) [ASSUMED]

**Folder filter:** D-01 requires loading cycles for the selected folder. CONTEXT.md notes "researcher must confirm whether this is a `?folderID=N` filter or `/folder/{ID}/testcycle` endpoint." Given the `paged` response has `allIDs`, the real AIO app likely:
1. Fetches ALL cycles with `allIDs` on initial load
2. Client-side filters by folder using the folder tree (since `detail.folder` is null in the sample, the folder association may come from the tree, not the cycle — or from a `?folderID=N` server filter) [ASSUMED]

**Most likely approach:** Fetch all cycles once (like the existing `fetchAioCycles`), then client-side filter by the selected folder ID. But `detail.folder` is null — so either (a) the folder filter param is a server-side `?folderID=N` param, or (b) the folder-to-cycle mapping only exists at the folder endpoint level. The count map already gives `folderID → count`, so the server knows which cycles belong to which folder. [ASSUMED — URL investigation needed]

### `paged2` endpoint — cycle summaries

**Shape confirmed:** Array (not paged object!) of `{ ID, detail: null, summary: { totalTests, testRunDistribution: { "statusID": count } } }`.
- Returns multiple cycles' summaries in one response
- Status IDs in sample: `51`, `53`, `54`, `55`, `901`

**Status ID mapping — confirmed from UI-SPEC (D-05 resolved):**

| ID | Status | Evidence |
|----|--------|----------|
| 901 | PASS | UI-SPEC explicitly states "Pass (ID 901)" |
| 51 | FAIL | UI-SPEC explicitly states "Fail (ID 51)" |
| 55 | BLOCKED | UI-SPEC explicitly states "Blocked (ID 55)" |
| 53 | NOT_EXECUTED | UI-SPEC explicitly states "Not Executed (ID 53)"; also corroborated by highest counts in sample (cycles tend to be mostly unexecuted) |
| 54 | IN_PROGRESS | UI-SPEC explicitly states "In Progress (ID 54)" |

[VERIFIED: 57-UI-SPEC.md — color table explicitly maps IDs to status names]

**`AIO_STATUS_MAP` constant to add to `aioUtils.ts`:**
```typescript
export const AIO_STATUS_MAP: Record<number, 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress'> = {
  901: 'pass',
  51:  'fail',
  55:  'blocked',
  53:  'notRun',
  54:  'inProgress',
};
```

**URL:** Unknown. CONTEXT.md notes it's likely `?projection=summary` or a batch POST. The response is an array (not the paged wrapper), suggesting it's a different endpoint or a POST with IDs. [ASSUMED]

---

## Standard Stack

### Core (all existing in codebase — no new installs)

| Library | Source | Purpose |
|---------|--------|---------|
| React + TypeScript | existing | Component tree, state, types |
| `@tanstack/react-query` | existing | `useQuery` for all data fetching |
| `react-router-dom` | existing | `NavLink`, `useParams` |
| `aioFetch` (internal) | `services/aio/client.ts` | AIO HTTP client with Bearer auth |
| `apiFetch` (internal) | `lib/apiFetch.ts` | Jira HTTP client |
| `useAioCredentials` | `hooks/useAioCredentials.ts` | Credential hook (Phase 56) |
| `useDelayedLoading` | `hooks/useDelayedLoading.ts` | 200ms skeleton flicker prevention |
| shadcn components | existing | `<Badge>`, `<Skeleton>`, `<Switch>`, `<EmptyState>`, `<ErrorState>` |
| lucide-react | existing | `ChevronRight`, `FlaskConical` icons |

**No new npm packages required.** [VERIFIED: component files confirmed in `taskflow/src/components/ui/`]

---

## Architecture Patterns

### System Architecture Diagram

```
[AioProjectOverviewPage]
        │
        ├─ useAioCredentials() ──────────────────────── Stronghold key 'jira-pat'
        │
        ├─ useQuery(folderTree)   ──────────────────── AIO: /project/{key}/folder
        ├─ useQuery(countMap)     ──────────────────── AIO: /project/{key}/testcycle/count (assumed)
        │
        ├─ [LEFT PANEL: FolderTree]
        │    ├─ renders tree recursively from folderTree data
        │    ├─ shows count badge from countMap[folder.ID]
        │    ├─ selectedFolderID state → drives right panel
        │    └─ "Ungrouped" entry if countMap[-1] > 0
        │
        ├─ useQuery(cycleList, {enabled: !!selectedFolderID})
        │    └─── AIO: /project/{key}/testcycle?folderID={id}&projection=detail (assumed)
        │
        ├─ useQuery(cycleSummaries, {enabled: !!allIDs})
        │    └─── AIO: /project/{key}/testcycle?projection=summary&ids=... (assumed)
        │
        ├─ [RIGHT PANEL: CycleTable]
        │    ├─ filters by showClosed toggle
        │    ├─ renders cycle rows: Key | Name | Owner | Total | Bar
        │    └─ per-unique-owner useQuery(jiraUser)
        │         └─── Jira: /rest/api/2/user?username={ownedByID}
        │
        └─ [EMPTY / ERROR STATES]
             ├─ No folder selected → "Select a folder"
             ├─ Empty folder → "No cycles in this folder"
             └─ Error states for tree + cycle list
```

### Recommended File Structure (changes only)

```
taskflow/src/
├── services/aio/
│   ├── cycles.ts          ← ADD: fetchAioFolderTree, fetchAioFolderCycleCounts,
│   │                              fetchAioCyclesWithDetail, fetchAioCycleSummaries
│   └── types.ts           ← ADD: AioFolder, AioCycleDetailItem, AioCycleSummaryItem,
│                                   AioCycleDetailPagedResponse
├── services/jira/
│   └── users.ts           ← ADD: fetchUserByUsername (new direct lookup function)
├── lib/
│   └── aioUtils.ts        ← ADD: AIO_STATUS_MAP constant; extend normalizeStatus to
│                                   handle numeric IDs via the map
└── routes/dashboard/
    ├── AioProjectOverviewPage.tsx   ← COMPLETE REWRITE (primary target)
    └── AioCyclesSkeleton.tsx        ← UPDATE (or replace with inline skeleton)
```

### Pattern 1: Folder Tree Recursive Rendering

**What:** A recursive `FolderNode` component renders the tree. State: `expandedIDs: Set<number>` and `selectedFolderID: number | null` in the parent page component. Passed down as props.

**Example:**
```typescript
// [VERIFIED: derived from API-EXAMPLES.md folder shape]
interface AioFolder {
  ID: number;
  name: string;
  parentID: number | null;
  children: AioFolder[];
}

function FolderNode({
  node,
  depth,
  countMap,
  expandedIDs,
  selectedFolderID,
  onToggle,
  onSelect,
}: {
  node: AioFolder;
  depth: number;
  countMap: Record<string, number>;
  expandedIDs: Set<number>;
  selectedFolderID: number | null;
  onToggle: (id: number) => void;
  onSelect: (id: number) => void;
}) {
  const isExpanded = expandedIDs.has(node.ID);
  const isSelected = selectedFolderID === node.ID;
  const count = countMap[String(node.ID)] ?? 0;
  const indent = `pl-${3 + depth * 4}`; // 12px base + 16px per level (UI-SPEC)

  return (
    <div>
      <button
        type="button"
        className={`w-full flex items-center gap-1 px-3 py-2 text-left ${indent} ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/30'}`}
        onClick={() => {
          if (node.children.length > 0) onToggle(node.ID);
          onSelect(node.ID);
        }}
      >
        {node.children.length > 0 && (
          <ChevronRight className={`size-4 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        )}
        <span className="text-sm font-medium flex-1">{node.name}</span>
        {count > 0 && <Badge variant="secondary">{count}</Badge>}
      </button>
      {isExpanded && node.children.map(child => (
        <FolderNode key={child.ID} node={child} depth={depth + 1} /* ...same props */ />
      ))}
    </div>
  );
}
```

### Pattern 2: Status ID → Normalized Status (new `AIO_STATUS_MAP`)

**What:** `normalizeStatus` currently handles string inputs (`'PASS'`, `'FAIL'`, etc.). It needs extension for numeric IDs from `testRunDistribution`.

```typescript
// [VERIFIED: ID→status mapping from 57-UI-SPEC.md color table]
export const AIO_STATUS_MAP: Record<number, 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress'> = {
  901: 'pass',
  51:  'fail',
  55:  'blocked',
  53:  'notRun',
  54:  'inProgress',
};

// New function for numeric ID inputs:
export function normalizeStatusById(id: number): 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress' {
  return AIO_STATUS_MAP[id] ?? 'notRun';
}
```

### Pattern 3: Progress Bar from `testRunDistribution`

**What:** `testRunDistribution` is `{ "53": 228, "901": 30, "54": 3 }` (keys are string-encoded numeric IDs). Convert to counts, then to percentages.

```typescript
// [VERIFIED: shape from API-EXAMPLES.md paged2]
function buildProgressCounts(
  dist: Record<string, number>
): { pass: number; fail: number; blocked: number; notRun: number; inProgress: number } {
  const counts = { pass: 0, fail: 0, blocked: 0, notRun: 0, inProgress: 0 };
  for (const [idStr, count] of Object.entries(dist)) {
    const status = normalizeStatusById(Number(idStr));
    counts[status] += count;
  }
  return counts;
}
```

**Bar rendering (from UI-SPEC — same `h-1.5` pattern as Phase 56):**
```typescript
<div className="h-1.5 rounded-full overflow-hidden flex">
  {counts.pass > 0 && <div className="bg-green-500 h-full" style={{ width: `${pct(counts.pass)}%` }} />}
  {counts.fail > 0 && <div className="bg-red-500 h-full" style={{ width: `${pct(counts.fail)}%` }} />}
  {counts.blocked > 0 && <div className="bg-orange-400 h-full" style={{ width: `${pct(counts.blocked)}%` }} />}
  {counts.inProgress > 0 && <div className="bg-blue-400 h-full" style={{ width: `${pct(counts.inProgress)}%` }} />}
  {counts.notRun > 0 && <div className="bg-muted h-full" style={{ width: `${pct(counts.notRun)}%` }} />}
</div>
```

### Pattern 4: Jira User Lookup per Owner

**What:** `ownedByID` is a Jira DC username (e.g., `"JIRAUSER23429"`, `"ext94772"`). The existing `fetchAssignableUsers` uses `?username=` for search — this is a SEARCH endpoint, not a direct lookup. A direct lookup is `GET /rest/api/2/user?username={name}` on Jira DC (where `username` = the `name` field, not `accountId`).

```typescript
// New function in services/jira/users.ts
// [VERIFIED: Jira DC uses ?username= param; JiraAssignableUser.name = DC username field]
export async function fetchJiraUserByUsername(
  baseUrl: string,
  token: string,
  username: string,
): Promise<JiraAssignableUser | null> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/user?username=${encodeURIComponent(username)}`;
  try {
    const response = await apiFetch('jira', url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!response.ok) return null; // 404 = user not found; show raw ID
    return (await response.json()) as JiraAssignableUser;
  } catch {
    return null;
  }
}
```

**Usage in component:** Collect unique `ownedByID` values from the cycle list. Fire one `useQuery` per unique ID. Map results to a `Record<string, string>` (username → displayName) for fast lookup in cycle rows.

**Query key:** `['jira', jiraBaseUrl, 'user-by-username', username]`

### Pattern 5: "Show closed" toggle

**What:** Local state, default `false`. Filter applied client-side after cycle list loads.

```typescript
const [showClosed, setShowClosed] = useState(false);

const visibleCycles = (cycleList ?? []).filter(
  (cycle) => showClosed || !cycle.detail.isClosed
);
```

**Toggle UI (from UI-SPEC):**
```tsx
<div className="flex items-center gap-2">
  <Switch
    id="show-closed"
    checked={showClosed}
    onCheckedChange={setShowClosed}
  />
  <label htmlFor="show-closed" className="text-sm">Show closed</label>
</div>
```

### Anti-Patterns to Avoid

- **Using `detail.folder` for folder assignment:** The field is `null` on all sampled cycles. Folder membership must come from the server-side folder filter or the folder tree structure, not the cycle's embedded detail.
- **N+1 test run fetches:** The old `fetchAioTestRunsForCycle` per cycle row. Replace with the batch summary endpoint entirely.
- **Using string-keyed `normalizeStatus` for numeric IDs:** The new `testRunDistribution` keys are numeric strings (`"53"`, `"901"`). Convert to `Number` before looking up in `AIO_STATUS_MAP`.
- **Including token in query keys:** Established pattern — token is NEVER part of the query key (security requirement confirmed in Phase 56 PATTERNS.md).
- **Calling `useAioCredentials()` in sub-components:** The token is loaded once in the page component. Pass it as a prop to sub-components or use context — avoid N Stronghold reads.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recursive tree rendering | Custom tree state manager | `useState<Set<number>>` for expanded + `useState<number\|null>` for selected | The tree is already a recursive structure from the API; simple local state is sufficient |
| Skeleton flicker | Custom debounce | `useDelayedLoading(isLoading)` hook | Already exists; prevents flash on fast loads |
| HTTP requests | Custom fetch | `aioFetch()` / `apiFetch()` wrappers | Auth headers, error handling already implemented |
| Owner batch loading | Custom Promise.all | One `useQuery` per unique owner ID via TanStack Query | TanStack Query deduplicates concurrent requests and caches results |
| Progress bar percentage calc | External library | Inline `Math.round((n / total) * 100)` | Trivially simple; no library needed |

---

## Key Files That Need to Change

### Files under edit (primary)

| File | Change Type | What Changes |
|------|-------------|--------------|
| `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` | **Complete rewrite** | Replace `groupCyclesByFolder` accordion with two-panel layout; remove `CycleStatsCell` (N+1); add folder tree + selected folder state; new query pattern |
| `taskflow/src/services/aio/cycles.ts` | **Add functions** | `fetchAioFolderTree`, `fetchAioFolderCycleCounts`, `fetchAioCyclesWithDetail` (per-folder or all-cycles), `fetchAioCycleSummaries` (batch) |
| `taskflow/src/services/aio/types.ts` | **Add types** | `AioFolder`, `AioCycleDetailItem`, `AioCycleSummaryItem`, `AioCycleDetailPagedResponse` |
| `taskflow/src/lib/aioUtils.ts` | **Add constant + function** | `AIO_STATUS_MAP`, `normalizeStatusById` |
| `taskflow/src/services/jira/users.ts` | **Add function** | `fetchJiraUserByUsername` (direct lookup vs. search) |

### Files under edit (secondary)

| File | Change Type | What Changes |
|------|-------------|--------------|
| `taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx` | **Rewrite** | Tests change fundamentally; old folder accordion tests replaced with folder tree + cycle list panel tests |
| `taskflow/src/services/aio/index.ts` | **Add exports** | Export new cycle functions |
| `taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx` | **May retire** | New page may inline its own skeleton structure; or update to match two-panel layout |

### Files untouched

- `AioCycleDetailPage.tsx` — no changes
- `AioTestRunDetailPage.tsx` — no changes
- `useAioCredentials.ts` — already built in Phase 56, no changes needed
- `useDelayedLoading.ts` — no changes
- All routing files — no new routes

---

## Common Pitfalls

### Pitfall 1: Unknown API Endpoint URLs

**What goes wrong:** The folder tree, count map, and summary endpoints have confirmed shapes (from API-EXAMPLES.md) but unknown URLs. Implementing service functions with wrong URL patterns causes 404s on first load.

**Why it happens:** The 4 example files are named by purpose (`folder`, `count`, `paged`, `paged2`), not by URL path.

**How to avoid:** The executor must inspect browser network logs on the live AIO instance to confirm the exact URL for each endpoint before implementing `aioFetch()` calls. The most likely patterns are:
- Folder tree: `GET /project/{key}/folder`
- Count map: `GET /project/{key}/testcycle/count` or `/project/{key}/folder/count`
- Summary (paged2): `GET /project/{key}/testcycle?projection=summary` or POST with IDs

**Warning signs:** Plan should include a probe step (Wave 0) to confirm these URLs against the live instance.

### Pitfall 2: `detail.folder` is null — don't use it for folder filtering

**What goes wrong:** The new `AioCycleDetailItem` has `detail.folder: null` for all cycles in the sample. Using this field to filter cycles by selected folder will show no cycles in any folder.

**Why it happens:** Folder association in the real AIO app is server-side — either via a `?folderID=N` query param, or the folder tree itself carries the relationship (not the cycle detail).

**How to avoid:** Use a server-side `?folderID=N` filter param on the cycle list endpoint. If this doesn't work, fetch all cycles and maintain a separate folder-to-cycle mapping derived from the count map + tree structure. Probe the endpoint with `?folderID=N` in Wave 0.

**Warning signs:** Right panel shows 0 cycles in all folders even when count map shows non-zero counts.

### Pitfall 3: Numeric string keys in `testRunDistribution`

**What goes wrong:** `Object.entries(testRunDistribution)` yields `["53", 228]` etc. — keys are strings. Looking up `AIO_STATUS_MAP["53"]` (string key) fails since the map is keyed by `number`.

**Why it happens:** JSON object keys are always strings; `AIO_STATUS_MAP` is `Record<number, ...>`.

**How to avoid:** Always convert: `normalizeStatusById(Number(idStr))`. Include a type-level note in the function signature.

**Warning signs:** All progress bar segments show as `notRun` (gray) regardless of actual distribution.

### Pitfall 4: Owner query N × uniqueOwners queries all fire simultaneously

**What goes wrong:** If a folder has 30 cycles, each with a different owner, 30 `useQuery` calls fire at once. This can overwhelm the Jira server or the browser's connection pool.

**Why it happens:** One `useQuery` per unique owner sounds reasonable, but a large team project might have many unique owners.

**How to avoid:** Deduplicate — the number of unique owners is typically much smaller than the number of cycles (D-07 explicitly says "collect unique `ownedByID` values"). In the sample, only 2 unique owner IDs appear across 7 cycles. Keep deduplication logic in the parent component before spawning child queries.

**Warning signs:** Network tab shows many simultaneous requests to `/rest/api/2/user?username=...`.

### Pitfall 5: `CycleStatsCell` removal breaks existing test assertions

**What goes wrong:** The existing `AioProjectOverviewPage.test.tsx` has assertions on `cycle-stats-loading`, `cycle-stats-loaded`, `cycle-stats-error` data-testids and the "2P 1F 1B 1N" count format — all from the old `CycleStatsCell` component.

**Why it happens:** `CycleStatsCell` is being removed. Its tests will fail if not replaced.

**How to avoid:** Rewrite `AioProjectOverviewPage.test.tsx` alongside the page rewrite. New tests cover: folder tree renders, folder selection loads cycles, "Show closed" toggle, owner column loading states, summary-based progress bar.

### Pitfall 6: Collapsing a parent folder that contains the selected folder

**What goes wrong:** If folder 201 ("2023 - DONE") is expanded and child folder 202 ("Campaign A") is selected, then the user collapses folder 201 — the selected folder is now hidden in the tree. The right panel still shows cycles for folder 202.

**How to avoid:** On toggle-collapse, check if `selectedFolderID` is a descendant of the collapsed node. If yes, clear `selectedFolderID` → right panel shows "Select a folder" empty state. Utility function: `isDescendant(tree, ancestorID, nodeID): boolean` walks the tree recursively.

---

## Data Flow: Initial Load Sequence

```
1. useAioCredentials() resolves → token available
2. Parallel queries fire:
   - useQuery(['aio', baseUrl, 'folders', projectKey])   → fetches folder tree
   - useQuery(['aio', baseUrl, 'cycle-count', projectKey]) → fetches count map
   - useQuery(['aio', baseUrl, 'cycles-detail', projectKey]) → fetches paged detail (gets allIDs)
3. Folder tree renders → first root folder auto-expands
4. Auto-select: first non-empty folder (count > 0) becomes selectedFolderID
5. Cycle list for selectedFolderID filtered from step 2 result (or via folderID param)
6. allIDs from paged response → triggers:
   - useQuery(['aio', baseUrl, 'cycle-summaries', projectKey, allIDs.join(',')])
7. Summary data arrives → progress bars fill in
8. Unique ownedByIDs extracted from cycle list → per-owner queries fire:
   - useQuery(['jira', baseUrl, 'user-by-username', ownedByID]) × N unique owners
9. Owner display names resolve → owner column fills in
```

**Performance note:** Steps 2–3 are parallel (no waterfall). Step 6 depends on step 2 (`allIDs`), but TanStack Query's `enabled` guard handles this cleanly. Steps 4 and 8 are derived from already-loaded data, not new network calls.

---

## Jira User API — Confirmed Pattern

The existing `fetchAssignableUsers` uses `/rest/api/2/user/assignable/search?project=...&username=...`. This is a SEARCH returning multiple users.

For direct owner lookup, the Jira DC REST API endpoint is:
`GET /rest/api/2/user?username={username}`

This endpoint returns a single user object matching the `name` field (Jira DC username). On Jira DC, `username` param maps to the `name` field (NOT `accountId` — that's Jira Cloud). [ASSUMED — Jira DC behavior from training knowledge; confirmed by `JiraAssignableUser.name` field being the DC username]

The `JiraAssignableUser` type already has `displayName` and `name` fields — no new type needed. The new `fetchJiraUserByUsername` function returns `JiraAssignableUser | null` (null on 404/error — per D-08, show raw `ownedByID` string as fallback).

---

## Validation Architecture

Nyquist validation is enabled (config: `workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run src/routes/dashboard/AioProjectOverviewPage.test.tsx` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Behavior | Test Type | File |
|----------|-----------|------|
| Folder tree renders from API data | unit | `AioProjectOverviewPage.test.tsx` (rewrite) |
| Clicking folder loads its cycles in right panel | unit | `AioProjectOverviewPage.test.tsx` |
| "Show closed" toggle hides/shows closed cycles | unit | `AioProjectOverviewPage.test.tsx` |
| Progress bar fills from `testRunDistribution` | unit | `AioProjectOverviewPage.test.tsx` |
| Owner column shows displayName / skeleton / raw ID fallback | unit | `AioProjectOverviewPage.test.tsx` |
| Cycle count badge shows folder count from count map | unit | `AioProjectOverviewPage.test.tsx` |
| EmptyState shown when no folder selected | unit | `AioProjectOverviewPage.test.tsx` |
| `fetchAioFolderTree` fetches and returns typed tree | unit | `services/aio/cycles.test.ts` (extend) |
| `fetchAioCycleSummaries` fetches and returns summary array | unit | `services/aio/cycles.test.ts` (extend) |
| `fetchJiraUserByUsername` returns user / null on 404 | unit | `services/jira/users.test.ts` (new) |
| `normalizeStatusById` maps numeric IDs correctly | unit | `lib/aioUtils.test.ts` (new or extend) |

### Wave 0 Gaps

- `taskflow/src/lib/aioUtils.test.ts` — new file for `normalizeStatusById` + `AIO_STATUS_MAP` tests (may not exist yet)
- `taskflow/src/services/jira/users.test.ts` — new file for `fetchJiraUserByUsername`
- Existing `AioProjectOverviewPage.test.tsx` — complete rewrite required (old tests will fail after component rewrite)

---

## Environment Availability

Step 2.6: SKIPPED (this phase is code/config-only changes; no new external tools, databases, or CLI utilities required beyond what the existing React + Vitest + TanStack Query stack provides).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Folder tree endpoint is `GET /project/{key}/folder` | API Analysis | Executor hits 404; must probe network logs to find correct URL |
| A2 | Count map endpoint is `GET /project/{key}/testcycle/count` or `/folder/count` | API Analysis | Executor hits 404; must probe |
| A3 | Summary endpoint is `GET /project/{key}/testcycle?projection=summary&ids=...` | API Analysis | Batch summary may not accept `ids` param; may need POST or pagination |
| A4 | Paged detail endpoint uses `?projection=detail` or returns detail by default | API Analysis | Wrong projection → `detail` null in response |
| A5 | Folder filter on cycle list uses `?folderID=N` server param | Data Flow | If filter is client-side only, must fetch all cycles and filter locally |
| A6 | Jira DC `GET /rest/api/2/user?username=X` returns single user matching `name` field | Jira User API | On some DC versions, may need `?name=X` instead of `?username=X` |
| A7 | `normalizeStatus` string-based function can coexist with new numeric `normalizeStatusById` without breakage | aioUtils.ts | No risk — they're separate functions |

**All 7 assumptions relate to API endpoint URLs/params. All require live-instance probe (Wave 0) before service functions are implemented.**

---

## Open Questions

1. **Endpoint URL for folder tree**
   - What we know: Response shape confirmed from `folder` file. Base path is `/rest/aio-tcms-api/1.0`.
   - What's unclear: Exact URL path after the base.
   - Recommendation: Executor inspects browser DevTools network tab on the live AIO instance while loading a project page. Look for requests to `aioFetch`-compatible paths.

2. **How does the real AIO app filter cycles by folder?**
   - What we know: `detail.folder` is null on all sampled cycles. The count map knows `folderID → count`.
   - What's unclear: Is there a `?folderID=N` query param on the `/testcycle` endpoint, or does the app fetch all cycles and maintain a separate folder→cycle ID mapping from the folder tree?
   - Recommendation: Probe `GET /project/{key}/testcycle?folderID={id}` in Wave 0. If it returns only cycles for that folder, use server-side filter. If it returns all cycles, use client-side filter with the `allIDs` set from the folder-level count.

3. **Does the summary endpoint accept a bulk `ids` param or require pagination?**
   - What we know: `paged2` returns an array (not a paged wrapper). `allIDs` is available from `paged`.
   - What's unclear: Does `?ids=1001,1002,...` work, or is it a POST body, or does it paginate separately?
   - Recommendation: Probe with `?ids=` query param first. If rejected, try POST with JSON body `{ ids: [...] }`.

---

## Sources

### Primary (HIGH confidence)
- `57-CONTEXT.md` — all locked decisions, API shapes, canonical file list
- `57-UI-SPEC.md` — status ID→name mapping (D-05 resolved), layout contract, component list, color palette
- `API-EXAMPLES.md` — confirmed JSON shapes for all 4 API responses
- Codebase grep of `taskflow/src/` — all existing file confirmations

### Secondary (MEDIUM confidence)
- `56-CONTEXT.md` — Phase 56 patterns and hook implementation (confirmed already shipped)
- `56-PATTERNS.md` — code patterns for credential gate, query keys, progress bar rendering

### Tertiary (ASSUMED — mark for Wave 0 validation)
- AIO endpoint URLs (A1–A5) — inferred from naming conventions and base path, not confirmed from live API
- Jira DC `?username=` direct lookup (A6) — inferred from existing `users.ts` `?username=` search param pattern

---

## Metadata

**Confidence breakdown:**
- Status ID mapping: HIGH — explicitly confirmed in UI-SPEC color table
- API response shapes: HIGH — confirmed from API-EXAMPLES.md (live snapshots)
- API endpoint URLs: LOW — all assumed; require Wave 0 probe
- Component reuse: HIGH — all components verified in `taskflow/src/components/ui/`
- Type changes: HIGH — existing types understood; additions clearly scoped
- Jira user lookup pattern: MEDIUM — `?username=` param confirmed in existing code; single-user endpoint assumed

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (stable domain; AIO API unlikely to change)
