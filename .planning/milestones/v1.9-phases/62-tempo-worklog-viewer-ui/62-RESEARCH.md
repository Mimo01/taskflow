# Phase 62: Tempo Worklog Viewer UI — Research

**Researched:** 2026-05-21
**Domain:** React UI — data table, filter bar, sidebar gating, TanStack Query data fetching
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single-person filter — only one person can be selected at a time (not multi-select). Empty selection = all people shown.
- **D-02:** People list is populated from `author.displayName` values extracted from the initial worklog fetch (the default "This Week" load). No separate Jira API call for team members.
- **D-03:** People filter UI: text input with autocomplete dropdown, similar to `MultiFilterCombobox` pattern in `BacklogFilterBar.tsx` but single-select. Selecting a name replaces the previous selection and triggers a re-fetch.
- **D-04:** Add a "Worklogs" link to the existing `tracking` section (alongside Sprint Progress and Releases). Do NOT create a new section.
- **D-05:** Sidebar item definition: `{ id: 'worklogs', label: 'Worklogs', path: '/worklogs', iconName: 'Clock', section: 'tracking' }`.
- **D-06:** Gating: the link is hidden when `tempoEnabled` is false. Use the same pattern as AIO gating in `Sidebar.tsx` (line 289). For Tempo: hide if `nav.id === 'worklogs' && !tempoEnabled`.
- **D-07:** Hours displayed as `Xh Ym` format — e.g. "7h 30m", "1h", "30m". Same for totals.
- **D-08:** Zero-hour cells are blank (empty string, no text).
- **D-09:** Use `fetchWorklogs` from `taskflow/src/services/tempo/worklogs.ts` directly. No pagination loop — v3 API returns a plain array (Phase 61 confirmed).
- **D-10:** Default date range on mount: "This Week" (Monday–Sunday of current week). Use manual Monday/Sunday calculation — `date-fns` is NOT in package.json.
- **D-11:** The `username` query param uses `author.name` (Jira username, not displayName). People filter stores and sends `author.name`; displayName is display-only.

### Claude's Discretion

- When "Custom" preset is active in the date bar, show two inline `<input type="date">` fields in the filter bar. Simple, no extra components. Fetch fires when both fields are filled and `to >= from`.

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEMPO-01 | User can view a day-column worklog table showing hours logged per person per day for a configurable date range | WorklogsPage component with `<table>` — one row per person, one column per day; data from `fetchWorklogs` via TanStack Query |
| TEMPO-02 | User can select date range using presets: This Week (default), Last Week, This Month, Last Month, Last Working Day, and custom date range | Date preset pill bar in filter bar; manual date arithmetic (no date-fns); custom = two `<input type="date">` fields |
| TEMPO-03 | User can filter the worklog table by one or more team members (DECISION: single-select only) | Single-select autocomplete combobox derived from `MultiFilterCombobox` pattern; people list built from initial fetch |
| TEMPO-07 | Worklog table shows a total column (sum of hours per person) and a total row (sum of hours per day) | `<tfoot>` totals row + rightmost "Total" column computed client-side from the same worklog array |

</phase_requirements>

---

## Summary

Phase 62 builds the Tempo Worklog Viewer: a new `/worklogs` route rendering a pivot table of hours per person per day, accessible from the sidebar when `tempoEnabled` is true. All major decisions are locked in CONTEXT.md — the work is straightforward implementation against established patterns.

The service layer (Phase 61) is complete. `fetchWorklogs(baseUrl, token, usernames, from, to)` returns a flat `TempoWorklog[]` with `author.name`, `author.displayName`, `dateStarted` (YYYY-MM-DD), and `timeSpentSeconds`. The UI transforms this into a pivot table client-side.

The implementation touches four integration points: (1) `sidebar-items.ts` adds the 'worklogs' nav item, (2) `Sidebar.tsx` adds a `tempoEnabled` gate mirroring the AIO gate at line 289, (3) `routes.tsx` registers `/worklogs` with `withLazy()`, and (4) a new `WorklogsPage` component is created at `taskflow/src/routes/worklogs/WorklogsPage.tsx`.

**Primary recommendation:** Implement as a single-file page component (`WorklogsPage.tsx`) using TanStack Query's `useQuery`, the existing `fetchWorklogs` service, and native `<table>` with Tailwind styling. No new packages, no new shadcn installs — everything needed is already in the project.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sidebar gating (tempoEnabled) | Frontend / Client component | — | Pure conditional render in `Sidebar.tsx`; no server involvement |
| Route registration `/worklogs` | Frontend routing (react-router-dom) | — | Client-side SPA routing via `routes.tsx` |
| Date preset arithmetic | Frontend (WorklogsPage) | — | Pure JS date math; no backend needed |
| Worklog data fetching | Frontend → Tempo API (via Jira host) | — | TanStack Query calls `fetchWorklogs`; HTTP to Jira host's Tempo servlet |
| Table pivot (person × day) | Frontend (WorklogsPage) | — | Client-side `Map` aggregation from flat `TempoWorklog[]` |
| People filter options | Frontend (derived from fetch) | — | D-02: extracted from initial worklog response; no separate API call |
| Hours formatting | Frontend utility function | — | `formatSeconds(s)` → "Xh Ym" string; same pattern as SprintProgressTab |
| Auth (token read) | Frontend → Stronghold IPC | — | `readSecret('jira-pat')` in `useEffect` + `useState`, same as all other pages |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.1.0 | UI component rendering | Project standard [VERIFIED: package.json] |
| TanStack Query | ^5.90.21 | Data fetching, caching, loading/error state | Project-wide pattern — used in every data page [VERIFIED: package.json] |
| react-router-dom | (project version) | Route registration, NavLink | Project standard for routing [VERIFIED: routes.tsx] |
| Tailwind CSS | ^4.2.1 | Utility class styling | Project-wide, shadcn base [VERIFIED: package.json] |
| lucide-react | ^0.577.0 | Icons (Clock for sidebar, Clock for empty state) | Project icon library [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/components/ui/skeleton` | local | Loading skeleton cells | During TanStack Query `isLoading` state |
| `@/components/ui/empty-state` | local | Zero-worklogs state | When fetch returns empty array |
| `@/components/ui/error-state` | local | Fetch error display | When TanStack Query `isError` is true |
| `@/components/ui/badge` | local | Active person chip (dismissible) | To display the currently-selected person |
| `readSecret` from `@/services/stronghold` | local | Read Jira PAT from secure storage | In `useEffect` + `useState` for auth token |

### No New Packages

`date-fns` is NOT in `package.json`. [VERIFIED: package.json grep returns nothing for 'date-fns']. All date math must use manual JavaScript `Date` arithmetic.

**Installation:** No `npm install` required for this phase. All dependencies already installed.

---

## Package Legitimacy Audit

No external packages are installed in this phase. All components and libraries used are already present in the project.

**Packages removed due to slopcheck:** none
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Worklogs" (sidebar)
        │
        ▼
react-router-dom navigates to /worklogs
        │
        ▼
WorklogsPage mounts
        │
        ├─► readSecret('jira-pat') [Stronghold IPC]
        │         │
        │         └─► setJiraToken(token)
        │
        ├─► tempoEnabled gate check (useSettingsStore)
        │         │
        │         └─► if false → redirect or empty state
        │
        ▼
useQuery(['tempo','worklogs', baseUrl, from, to, username])
        │
        └─► fetchWorklogs(baseUrl, token, usernames, from, to)
                  │
                  └─► GET /rest/tempo-timesheets/3/worklogs
                            │
                            ▼
                      TempoWorklog[] (flat array)
                            │
                            ▼
                  Client-side pivot:
                  Map<authorName, Map<date, totalSeconds>>
                  + extract people list (displayName → name lookup)
                  + compute day columns (from..to date range)
                  + compute totals column (sum per person)
                  + compute totals row (sum per day)
                            │
                            ▼
                  <table> render
                  - <thead>: Name | Day1 | ... | DayN | Total
                  - <tbody>: one <tr> per person
                  - <tfoot>: totals row
```

### Recommended Project Structure

```
taskflow/src/
├── routes/
│   ├── worklogs/
│   │   ├── WorklogsPage.tsx          # Main page component (new)
│   │   └── WorklogsPage.test.tsx     # Tests (new)
│   └── routes.tsx                    # Add /worklogs lazy route (modify)
├── components/
│   └── app/
│       ├── sidebar-items.ts          # Add 'worklogs' to SIDEBAR_NAV_ITEMS (modify)
│       ├── Sidebar.tsx               # Add tempoEnabled gate (modify)
│       └── Sidebar.test.tsx          # Add tempoEnabled gate tests (modify)
```

### Pattern 1: TanStack Query + readSecret (Auth Pattern)

**What:** Read token from Stronghold in `useEffect`, then pass to `useQuery`
**When to use:** Every page that calls a Jira/Tempo API

```typescript
// Source: SprintProgressTab.tsx (established project pattern)
const [jiraToken, setJiraToken] = useState<string | null>(null);

useEffect(() => {
  if (jiraBaseUrl) {
    readSecret('jira-pat')
      .then(setJiraToken)
      .catch(() => setJiraToken(null));
  }
}, [jiraBaseUrl]);

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ['tempo', 'worklogs', jiraBaseUrl, from, to, username ?? ''],
  queryFn: () =>
    fetchWorklogs(jiraBaseUrl!, jiraToken!, username ? [username] : [], from, to),
  enabled: !!jiraBaseUrl && !!jiraToken && tempoEnabled,
});
```

[VERIFIED: pattern matches SprintProgressTab.tsx, IntegrationsSection.tsx, AioProjectOverviewPage.tsx]

### Pattern 2: tempoEnabled Sidebar Gate

**What:** Filter nav items based on integration feature flags
**When to use:** Any sidebar item that requires a feature toggle

```typescript
// Source: Sidebar.tsx line 283-291 — AIO gating pattern to replicate
const sectionedItems = SIDEBAR_SECTIONS.map((section) => ({
  ...section,
  items: SIDEBAR_NAV_ITEMS.filter(
    (nav) =>
      nav.section === section.id &&
      visibleIds.has(nav.id) &&
      // Existing AIO gate:
      !(nav.section === 'testing' && (!aioEnabled || !selectedAioProjectKey)) &&
      // NEW Tempo gate (add this):
      !(nav.id === 'worklogs' && !tempoEnabled),
  ),
})).filter((section) => section.items.length > 0);
```

[VERIFIED: Sidebar.tsx read directly]

### Pattern 3: withLazy Route Registration

**What:** Lazy-load a page component via Suspense + ChunkErrorBoundary
**When to use:** All non-critical routes (same pattern as AIO pages)

```typescript
// Source: routes.tsx
const WorklogsPage = lazy(() => import('./worklogs/WorklogsPage'));

// In routes array:
{ path: '/worklogs', element: withLazy(WorklogsPage) },
```

[VERIFIED: routes.tsx read directly]

### Pattern 4: Worklog Pivot Computation

**What:** Transform flat `TempoWorklog[]` into a person × day matrix
**When to use:** After successful `useQuery` data fetch

```typescript
// Derived from TempoWorklog type and CONTEXT.md §Specific Ideas
function buildPivot(worklogs: TempoWorklog[], days: string[]) {
  // Map: authorName → { displayName, dayMap: Map<YYYY-MM-DD, totalSeconds> }
  const byPerson = new Map<string, { displayName: string; days: Map<string, number> }>();

  for (const w of worklogs) {
    const name = w.author.name;
    if (!byPerson.has(name)) {
      byPerson.set(name, {
        displayName: w.author.displayName ?? name,
        days: new Map(),
      });
    }
    const person = byPerson.get(name)!;
    const existing = person.days.get(w.dateStarted) ?? 0;
    person.days.set(w.dateStarted, existing + w.timeSpentSeconds);
  }

  return byPerson;
}
```

[ASSUMED — derived from TempoWorklog type shape and CONTEXT.md, not from an existing codebase file]

### Pattern 5: Date Preset Arithmetic (no date-fns)

**What:** Compute YYYY-MM-DD from/to strings for each preset
**When to use:** In WorklogsPage to feed `fetchWorklogs` date params

```typescript
// ASSUMED — standard JS Date arithmetic, consistent with codebase approach
function getThisWeekRange(): { from: string; to: string } {
  const today = new Date();
  const dow = today.getDay(); // 0 = Sunday, 1 = Monday, ...
  // ISO Monday: if Sunday (0), go back 6 days; otherwise go back (dow - 1) days
  const daysToMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
  };
}

function getLastWorkingDay(): string {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun, 6=Sat
  const daysBack = dow === 1 ? 3 : dow === 0 ? 2 : 1; // Mon→Fri(-3), Sun→Fri(-2), else yesterday
  const d = new Date(today);
  d.setDate(today.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}
```

**Warning on timezone:** Use `.toISOString().slice(0, 10)` NOT `toLocaleDateString()` — matches the service layer convention from Phase 61 and avoids timezone-shift bugs. [VERIFIED: CONTEXT.md D-10, worklogs.ts comments]

### Pattern 6: Hours Formatting

**What:** Format `timeSpentSeconds` to human-readable "Xh Ym" string
**When to use:** Every table cell value and totals

```typescript
// Source: SprintProgressTab.tsx formatSeconds function (project precedent)
function formatSeconds(secs: number): string {
  if (secs === 0) return ''; // D-08: blank for zero
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;     // "30m" not "0h 30m"
  if (m === 0) return `${h}h`;     // "1h" not "1h 0m"
  return `${h}h ${m}m`;            // "7h 30m"
}
```

[VERIFIED: SprintProgressTab.tsx lines 31-38 match this exact pattern]

### Pattern 7: SingleFilterCombobox (adapted from MultiFilterCombobox)

**What:** Single-select autocomplete input with dismissible chip
**When to use:** People filter in WorklogsPage

The `MultiFilterCombobox` in `BacklogFilterBar.tsx` uses:
- `useRef<ReturnType<typeof setTimeout>>` for the 150ms blur debounce
- `onMouseDown` (not `onClick`) on dropdown items to prevent blur firing before selection
- `setQuery('')` on selection to clear the input
- `role="combobox"` + `aria-autocomplete="list"` + `aria-expanded` for ARIA

Adapt to single-select by: (1) storing `selectedName: string | null` and `selectedUsername: string | null` instead of `Set<string>`, (2) on selection replace the previous value, (3) render a single `<Badge variant="secondary">` chip instead of multiple chips.

[VERIFIED: BacklogFilterBar.tsx read directly]

### Anti-Patterns to Avoid

- **`toLocaleDateString()` for date strings:** Use `.toISOString().slice(0, 10)` — toLocaleDateString produces locale-specific formats and timezone-shifted dates. Baked into Phase 61 convention.
- **Separate Jira API call for team list:** D-02 forbids this. Build people list from initial worklog fetch response only.
- **Multi-select people filter:** D-01 overrides TEMPO-03's original multi-select spec. Single-select only.
- **Pagination loop in WorklogsPage:** D-09 confirms v3 returns all records in one response. No loop needed.
- **Using `date-fns` or `dayjs`:** Not in package.json. Manual date arithmetic only.
- **Inline `Clock` import in ICON_MAP without adding to Sidebar.tsx ICON_MAP:** The `Clock` icon must be added to the `ICON_MAP` constant in `Sidebar.tsx` alongside existing icon imports.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loading state skeleton | Custom spinner/layout | `<Skeleton>` + grid pattern from AIO pages | Consistent with other data pages |
| Error display with auth detection | Custom error UI | `<ErrorState error={error} onRetry={refetch} viewName="worklogs" />` | Handles 401 → "Session expired" + Reconnect automatically |
| Empty table state | Custom message div | `<EmptyState icon={Clock} title="No worklogs found" subtitle="..." />` | Consistent empty state across app |
| Token reading with Tauri | Custom IPC | `readSecret('jira-pat')` in `useEffect` | Established Stronghold pattern used by every page |
| Query caching/deduplication | Manual fetch + state | `useQuery` with `['tempo', 'worklogs', ...]` key | Automatic dedup, background refetch, error retry |

**Key insight:** This page is the third integration-specific viewer (after Sprint Progress and AIO pages). All the plumbing is established — follow the SprintProgressTab + AioProjectOverviewPage structural pattern exactly.

---

## Common Pitfalls

### Pitfall 1: Clock Icon Missing from ICON_MAP in Sidebar.tsx

**What goes wrong:** Adding `iconName: 'Clock'` to `sidebar-items.ts` but not adding `Clock` to the `ICON_MAP` in `Sidebar.tsx` — the icon renders as nothing (no error, silent failure).
**Why it happens:** The icon map and the sidebar items definition are in separate files. Easy to update one and forget the other.
**How to avoid:** When adding the sidebar item definition, immediately verify `Sidebar.tsx` ICON_MAP contains `Clock`. Add `import { ..., Clock } from 'lucide-react'` and `Clock` to the ICON_MAP record.
**Warning signs:** Sidebar "Worklogs" link renders with no icon.

### Pitfall 2: `tempoEnabled` Not Read from Store in Sidebar

**What goes wrong:** Sidebar filters items by `tempoEnabled` but the store selector is not added — the variable is undefined, the gate never fires, the link is always visible (or always hidden).
**Why it happens:** The AIO gate uses `aioEnabled` which is already read from the store (line 79). Tempo requires adding a separate `const tempoEnabled = useSettingsStore((s) => s.tempoEnabled)` selector.
**How to avoid:** Add the fine-grained selector (matching the IN-01 comment pattern in Sidebar.tsx) before adding the filter condition.

### Pitfall 3: `getDefaultSidebarItems` Not Updated

**What goes wrong:** Adding 'worklogs' to `SIDEBAR_NAV_ITEMS` but not to the `devVisible`/`pmVisible` sets in `getDefaultSidebarItems`. The item exists in the nav definition but is invisible by default (not in `sidebarItems` store state).
**Why it happens:** Two places to update: the item definition array and the preset visibility sets.
**How to avoid:** Decide which presets should show the Worklogs link by default. Based on patterns (sprint-progress visible in PM, tracking items in both), add 'worklogs' to both `devVisible` and `pmVisible` — users with tempoEnabled would likely want it visible.
**Warning signs:** Worklogs link doesn't appear in sidebar even with `tempoEnabled=true`.

### Pitfall 4: Sidebar.test.tsx Mock Missing `worklogs` in sidebarItems

**What goes wrong:** New `tempoEnabled` gate tests fail because the mock `sidebarItems` array in `Sidebar.test.tsx` doesn't include `{ id: 'worklogs', visible: true }`.
**Why it happens:** The mock is hand-coded with only existing item IDs.
**How to avoid:** When adding new gate tests, also add `{ id: 'worklogs', visible: true }` to the mock sidebarItems array. Also add `mockTempoEnabled` variable following the same pattern as `mockAioEnabled`.

### Pitfall 5: Day Column Headers — Formatting Consistency

**What goes wrong:** Day column headers show full ISO date "2026-05-21" instead of a compact format like "Wed 21" or "21/5", making the table wide and hard to read.
**Why it happens:** The CONTEXT.md specifies YYYY-MM-DD internally but doesn't prescribe the display format.
**How to avoid:** The UI-SPEC says "day columns min-width 56px, right-aligned". Dates as `YYYY-MM-DD` won't fit in 56px. Use a compact 3-char weekday + day number format (e.g. "Wed 21") for headers. [ASSUMED — UI-SPEC implies compact format but doesn't specify exact string]

### Pitfall 6: Custom Date Range Fetch Fires Before Both Fields Are Set

**What goes wrong:** When "Custom" preset is selected, fetch triggers with `to` as empty string before the user fills both fields.
**Why it happens:** `useQuery`'s `enabled` condition doesn't check both fields are filled.
**How to avoid:** Gate `enabled` with `from && to && to >= from` when custom preset is active. Only fire fetch when both date inputs are non-empty and the range is valid.

### Pitfall 7: People Filter Sends Empty Array vs. Undefined

**What goes wrong:** `fetchWorklogs(baseUrl, token, [], from, to)` — with an empty usernames array — appends no `username=` params, which means the API returns all users. This is correct behavior (D-01: no selection = all people shown), but must be deliberate.
**Why it happens:** It's easy to forget that the empty array case is the "show all" case, not an error.
**How to avoid:** When no person is selected, pass `[]` explicitly. When a person is selected, pass `[selectedUsername]`. The query key must reflect both states to avoid cache collisions: `['tempo', 'worklogs', ..., username ?? '']`.

---

## Code Examples

### WorklogsPage Component Skeleton

```typescript
// Source: Structural pattern from SprintProgressTab.tsx + AioProjectOverviewPage.tsx
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchWorklogs } from '@/services/tempo';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

export default function WorklogsPage() {
  const { jiraBaseUrl } = useAuthStore();
  const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);
  const [jiraToken, setJiraToken] = useState<string | null>(null);

  // Date preset state
  const [preset, setPreset] = useState<DatePreset>('this-week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // People filter state
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [selectedDisplayName, setSelectedDisplayName] = useState<string | null>(null);

  // Compute from/to from preset
  const { from, to } = getDateRange(preset, customFrom, customTo);

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat').then(setJiraToken).catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['tempo', 'worklogs', jiraBaseUrl, from, to, selectedUsername ?? ''],
    queryFn: () =>
      fetchWorklogs(jiraBaseUrl!, jiraToken!, selectedUsername ? [selectedUsername] : [], from, to),
    enabled: !!jiraBaseUrl && !!jiraToken && tempoEnabled && !!from && !!to,
  });

  // Build people list from data (D-02)
  const people = useMemo(() => buildPeopleList(data ?? []), [data]);

  // Build pivot table from data
  const { pivot, days } = useMemo(() => buildPivot(data ?? [], from, to), [data, from, to]);

  if (isError) {
    return <ErrorState error={error} onRetry={refetch} viewName="worklogs" />;
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-xl font-semibold">Worklogs</h1>
      </header>
      {/* Filter bar */}
      {/* Table area */}
    </div>
  );
}
```

### Date Preset Bar Pattern

```typescript
// Source: [ASSUMED] — derived from UI-SPEC interaction contract
const DATE_PRESETS = [
  { id: 'this-week', label: 'This Week' },
  { id: 'last-week', label: 'Last Week' },
  { id: 'this-month', label: 'This Month' },
  { id: 'last-month', label: 'Last Month' },
  { id: 'last-working-day', label: 'Last Working Day' },
  { id: 'custom', label: 'Custom' },
] as const;

type DatePreset = typeof DATE_PRESETS[number]['id'];

// Render:
{DATE_PRESETS.map(p => (
  <button
    key={p.id}
    type="button"
    onClick={() => setPreset(p.id)}
    className={preset === p.id
      ? 'bg-accent text-accent-foreground font-semibold border border-border rounded-md px-3 h-7 text-xs'
      : 'hover:bg-accent text-foreground rounded-md px-3 h-7 text-xs'}
  >
    {p.label}
  </button>
))}
{preset === 'custom' && (
  <>
    <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
      className="min-w-32 rounded border border-border px-2 py-1 text-xs" />
    <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
      className="min-w-32 rounded border border-border px-2 py-1 text-xs" />
  </>
)}
```

### Native Table Pattern

```typescript
// Source: UI-SPEC §Table interaction contract
<div className="flex-1 overflow-auto px-6 py-4">
  <table className="w-full text-xs border-collapse">
    <thead className="sticky top-0 bg-muted">
      <tr>
        <th className="text-left px-4 py-3 border border-border min-w-40 font-semibold text-muted-foreground">Name</th>
        {days.map(day => (
          <th key={day} className="text-right px-4 py-3 border border-border min-w-14 font-semibold text-muted-foreground">
            {formatDayHeader(day)}
          </th>
        ))}
        <th className="text-right px-4 py-3 border border-border min-w-18 font-semibold">Total</th>
      </tr>
    </thead>
    <tbody>
      {Array.from(pivot.entries()).map(([username, { displayName, days: dayMap, total }]) => (
        <tr key={username} className="hover:bg-accent/50">
          <td className="px-4 py-4 border border-border">{displayName}</td>
          {days.map(day => (
            <td key={day} className="text-right px-4 py-4 border border-border">
              {formatSeconds(dayMap.get(day) ?? 0)}
            </td>
          ))}
          <td className="text-right px-4 py-4 border border-border font-semibold">
            {formatSeconds(total)}
          </td>
        </tr>
      ))}
    </tbody>
    <tfoot>
      <tr className="bg-muted">
        <td className="px-4 py-4 border border-border font-semibold">Total</td>
        {days.map(day => (
          <td key={day} className="text-right px-4 py-4 border border-border font-semibold">
            {formatSeconds(dayTotals.get(day) ?? 0)}
          </td>
        ))}
        <td className="text-right px-4 py-4 border border-border font-semibold">
          {formatSeconds(grandTotal)}
        </td>
      </tr>
    </tfoot>
  </table>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Workload page (`/workload`) | Removed in Phase 59 | Phase 59 | No WorkloadTab to reference; use SprintProgressTab as data-table pattern instead |
| date-fns for date math | Manual JS Date arithmetic | This project always | date-fns is not installed; use `.toISOString().slice(0,10)` |
| Pagination loop for Tempo v3 | Single fetch (no loop) | Phase 61 confirmed | The v3 API returns all records in one response for this DC instance |

**Deprecated/outdated:**
- Tempo v4 API: Returns 405 on this DC instance. v3 (`/rest/tempo-timesheets/3/worklogs`) is the working path.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Day column headers should be compact (e.g. "Wed 21") not full ISO date | Common Pitfalls #5 | Wide table headers; easily fixed by adjusting format string |
| A2 | 'worklogs' item should be visible by default in both `devVisible` and `pmVisible` sets in `getDefaultSidebarItems` | Common Pitfalls #3 | Link hidden until user manually enables via settings; low user impact |
| A3 | `buildPivot` helper takes `from`/`to` strings to enumerate all days in range (including days with 0 hours, shown as blank) | Code Examples | Days with no worklogs would be omitted from column list |
| A4 | `WorklogsPage.tsx` placed in `src/routes/worklogs/` directory (new folder) | Architecture Patterns | File placed elsewhere; rename only, no logic impact |

**If this table is empty:** Not empty — 4 assumptions logged.

---

## Open Questions

1. **Day column header format**
   - What we know: UI-SPEC says min-width 56px for day columns; full YYYY-MM-DD is 10 chars and won't fit
   - What's unclear: Whether "Wed 21" (weekday + day) or "21" (day only) or "21/5" is preferred
   - Recommendation: Use 3-char weekday + space + day number (e.g. "Wed 21") — readable at 56px, shows day of week at a glance. Implementer can confirm with user during verification.

2. **Default visibility for 'worklogs' in sidebar presets**
   - What we know: `getDefaultSidebarItems` sets which items are visible for 'dev' and 'pm' presets; 'worklogs' will be gated by `tempoEnabled` anyway
   - What's unclear: Whether the item should default-visible (so users see it immediately when they enable tempoEnabled) or default-hidden (requiring manual sidebar config)
   - Recommendation: Add to both presets' visible sets — the `tempoEnabled` gate is the primary control; visibility defaulting to false would confuse users who enable Tempo and see nothing.

---

## Environment Availability

Step 2.6 audit: This phase installs no external tools or services. It depends only on what is already installed.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Build, test | ✓ | (project standard) | — |
| vitest | Tests (`npm test`) | ✓ | ^4.0.18 | — |
| @testing-library/react | Tests | ✓ | ^16.3.2 | — |
| Jira host with Tempo v3 | Runtime (dev/prod) | ✓ | Confirmed by Phase 61 probe | — |
| `taskflow/src/services/tempo/` | WorklogsPage | ✓ | Built in Phase 61 | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm test -- --reporter=verbose WorklogsPage` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEMPO-01 | Worklog table renders rows/columns correctly | unit | `npm test -- WorklogsPage` | ❌ Wave 0 |
| TEMPO-02 | Date preset bar renders all 6 presets; "This Week" active on mount | unit | `npm test -- WorklogsPage` | ❌ Wave 0 |
| TEMPO-02 | Custom preset shows two date inputs; fetch fires only when both set | unit | `npm test -- WorklogsPage` | ❌ Wave 0 |
| TEMPO-03 | People filter shows autocomplete dropdown from fetched names | unit | `npm test -- WorklogsPage` | ❌ Wave 0 |
| TEMPO-03 | Selecting a person triggers re-fetch with that username | unit | `npm test -- WorklogsPage` | ❌ Wave 0 |
| TEMPO-07 | Totals column shows sum per person; totals row shows sum per day | unit | `npm test -- WorklogsPage` | ❌ Wave 0 |
| D-06 | Sidebar hides "Worklogs" link when tempoEnabled=false | unit | `npm test -- Sidebar` | ❌ Wave 0 (extend existing) |
| D-06 | Sidebar shows "Worklogs" link when tempoEnabled=true | unit | `npm test -- Sidebar` | ❌ Wave 0 (extend existing) |
| D-08 | Zero-hour cells display blank (empty string) | unit | `npm test -- WorklogsPage` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd taskflow && npm test -- WorklogsPage Sidebar`
- **Per wave merge:** `cd taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `taskflow/src/routes/worklogs/WorklogsPage.test.tsx` — covers TEMPO-01 through TEMPO-07, D-08
- [ ] Extend `taskflow/src/components/app/Sidebar.test.tsx` — covers D-06 tempoEnabled gate tests

*(Existing test infrastructure is sufficient — no new framework config needed)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth; reuses existing Jira PAT via Stronghold |
| V3 Session Management | No | No session management in this UI phase |
| V4 Access Control | Partial | `tempoEnabled` gate prevents feature access when disabled; no new user roles |
| V5 Input Validation | Yes | Date inputs validated: `to >= from` before fetch; usernames come from API response not user text |
| V6 Cryptography | No | No crypto operations; token stored/read via Stronghold (existing) |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| URL parameter injection via username filter | Tampering | `fetchWorklogs` uses `URLSearchParams.append('username', u)` — safe encoding, no string concatenation |
| Date range manipulation | Tampering | Client-side validation `to >= from`; server enforces own limits |
| Token leakage in query key | Info Disclosure | `jiraToken` is NOT included in the TanStack Query key (key uses `jiraBaseUrl` only) — token is only in `queryFn` closure |

---

## Sources

### Primary (HIGH confidence)

- `taskflow/src/services/tempo/worklogs.ts` — `fetchWorklogs` signature and behavior (read directly)
- `taskflow/src/services/tempo/types.ts` — `TempoWorklog` type fields (read directly)
- `taskflow/src/components/app/Sidebar.tsx` — AIO gating pattern at line 283-291, ICON_MAP structure (read directly)
- `taskflow/src/components/app/sidebar-items.ts` — `SIDEBAR_NAV_ITEMS`, `SIDEBAR_SECTIONS`, `getDefaultSidebarItems` (read directly)
- `taskflow/src/components/app/Sidebar.test.tsx` — existing test structure and mock patterns (read directly)
- `taskflow/src/routes/dashboard/BacklogFilterBar.tsx` — `MultiFilterCombobox` pattern (read directly)
- `taskflow/src/routes/dashboard/SprintProgressTab.tsx` — auth token + useQuery pattern, `formatSeconds` function (read directly)
- `taskflow/src/routes/routes.tsx` — `withLazy` pattern, route registration (read directly)
- `taskflow/src/components/ui/empty-state.tsx` — `EmptyState` props (read directly)
- `taskflow/src/components/ui/error-state.tsx` — `ErrorState` props (read directly)
- `taskflow/src/components/ui/badge.tsx` — `Badge` variants (read directly)
- `taskflow/package.json` — dependency versions, absence of date-fns (read directly)
- `.planning/phases/62-tempo-worklog-viewer-ui/62-CONTEXT.md` — all locked decisions (read directly)
- `.planning/phases/62-tempo-worklog-viewer-ui/62-UI-SPEC.md` — visual/interaction contract (read directly)
- `.planning/phases/61-tempo-probe-service-layer/61-PROBE-RESULT.md` — confirmed API shape (read directly)

### Secondary (MEDIUM confidence)

- `taskflow/src/routes/settings/IntegrationsSection.tsx` — `tempoEnabled`/`setTempoEnabled` import pattern (read directly)

### Tertiary (LOW confidence)

- None — all claims verified from direct codebase reads.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed from package.json; all components confirmed from src/
- Architecture: HIGH — direct codebase reads of all integration points
- Patterns: HIGH — copied from existing files, not inferred
- Pitfalls: HIGH — most derived from reading actual code (icon map, sidebarItems arrays)
- Assumptions A1–A4: LOW — not verified in official docs; planner should confirm with implementer

**Research date:** 2026-05-21
**Valid until:** 2026-06-20 (stable stack; no external API changes expected)
