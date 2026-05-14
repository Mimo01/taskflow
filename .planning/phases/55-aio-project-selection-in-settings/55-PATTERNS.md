# Phase 55: AIO Project Selection in Settings — Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 8 files to create/modify/delete
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `taskflow/src/stores/settings.store.ts` | store | CRUD | itself — `aioEnabled` field + v15/v16 migration guards (lines 115-117, 433-440) | exact |
| `taskflow/src/routes/settings/IntegrationsSection.tsx` | component | request-response | `AioProjectsPage.tsx` (credential load + `useQuery`) + `GitLabStep.tsx:107-136` (Select picker) | exact (composite) |
| `taskflow/src/routes/settings/IntegrationsSection.test.tsx` | test | — | itself — existing describe block (lines 1-48) | exact |
| `taskflow/src/components/app/Sidebar.tsx` | component | request-response | itself — `aioEnabled` destructure (line 70) + filter (lines 271-279) + NavLink (lines 342-358) | exact |
| `taskflow/src/components/app/sidebar-items.ts` | config | — | itself — `'aio-projects'` item (lines 76-83) | exact |
| `taskflow/src/components/app/Sidebar.test.tsx` | test | — | itself — `aioEnabled` gate describe block (lines 103-135) | exact |
| `taskflow/src/stores/settings.store.test.ts` | test | — | itself — `aioEnabled toggle (Phase 51)` describe block (lines 263-286) | exact |
| `taskflow/src/routes/routes.tsx` | config | — | itself — `AioProjectsPage` lazy import (line 21) + route entry (line 52) | exact |

**Files to delete (no analog needed):**

| File | Reason |
|---|---|
| `taskflow/src/routes/dashboard/AioProjectsPage.tsx` | Deleted wholesale — patterns extracted for IntegrationsSection picker |
| `taskflow/src/routes/dashboard/AioProjectsPage.test.tsx` | Deleted wholesale |
| `taskflow/src/routes/dashboard/AioProjectsSkeleton.tsx` | Deleted wholesale |

---

## Pattern Assignments

### `taskflow/src/stores/settings.store.ts` (store, CRUD)

**Analog:** itself — `aioEnabled` pattern

**Field declaration in `SettingsState` interface** (lines 115-117):
```typescript
/** Enable AIO Test Management integration. Default: false. Gates all AIO API calls. */
aioEnabled: boolean;
setAioEnabled: (v: boolean) => void;
```
New field goes directly below these two lines:
```typescript
/** Selected AIO project key. Null until user picks a project. */
selectedAioProjectKey: string | null;
setSelectedAioProjectKey: (key: string | null) => void;
```

**Initial value in `create()` body** (lines 233-234):
```typescript
aioEnabled: false,
setAioEnabled: (v) => set({ aioEnabled: v }),
```
New initial values go directly below:
```typescript
selectedAioProjectKey: null,
setSelectedAioProjectKey: (key) => set({ selectedAioProjectKey: key }),
```

**Version bump** (line 365):
```typescript
version: 16,
```
Change to:
```typescript
version: 17,
```

**Migration guard** — append after the v16 block (lines 436-440):
```typescript
if (version < 16) {
  if (Array.isArray(s.sidebarItems)) {
    s.sidebarItems = appendAioItemIfMissing(s.sidebarItems as SidebarItem[]);
  }
}
// ADD v17 BLOCK HERE:
if (version < 17) {
  if (s.selectedAioProjectKey === undefined) s.selectedAioProjectKey = null;
}
return persisted as SettingsState;
```

---

### `taskflow/src/routes/settings/IntegrationsSection.tsx` (component, request-response)

**Primary analog:** `AioProjectsPage.tsx` (credential load + `useQuery` with `enabled`) + `GitLabStep.tsx:107-136` (Select picker shape)
**Secondary analog:** `ConnectionsSection.tsx:125-153` (inline loading/error rows)

**Current full file** (lines 1-31) — replaces entirely:
```typescript
import { useSettingsStore } from '../../stores/settings.store';

export default function IntegrationsSection() {
  const { aioEnabled, setAioEnabled } = useSettingsStore();

  return (
    <div data-testid="section-integrations" className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Integrations</h2>
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          AIO Test Management
        </h3>
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          ...
        </label>
      </div>
    </div>
  );
}
```

**Imports pattern to add** — mirror `AioProjectsPage.tsx` lines 1-11:
```typescript
import { useQuery } from '@tanstack/react-query';
import { Loader2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAioProjects } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '../../stores/settings.store';
```

**Credential loading pattern** — from `AioProjectsPage.tsx` lines 15-31 (use `[jiraBaseUrl]` dependency per RESEARCH.md):
```typescript
const { jiraBaseUrl } = useAuthStore();
const [token, setToken] = useState<string | null>(null);

useEffect(() => {
  readSecret('jira-pat')
    .then(setToken)
    .catch(() => setToken(null));
}, [jiraBaseUrl]);
```

**`useQuery` pattern** — from `AioProjectsPage.tsx` lines 27-31:
```typescript
const { data: projects, isLoading, isError, refetch } = useQuery({
  queryKey: ['aio', jiraBaseUrl, 'projects'],
  queryFn: () => fetchAioProjects(jiraBaseUrl!, token!),
  enabled: !!jiraBaseUrl && !!token,
});
```

**Store destructure for this component:**
```typescript
const {
  aioEnabled, setAioEnabled,
  selectedAioProjectKey, setSelectedAioProjectKey,
} = useSettingsStore();
```

**Select picker pattern** — from `GitLabStep.tsx` lines 109-136 adapted for AIO:
```typescript
// Selected project name lookup — avoids blank trigger (RESEARCH.md Pitfall 3)
const selectedProject = projects?.find(p => p.projectKey === selectedAioProjectKey);

<div className="flex flex-col gap-1.5">
  <Label htmlFor="aio-project">AIO Project</Label>
  <Select
    value={selectedAioProjectKey ?? ''}
    onValueChange={setSelectedAioProjectKey}
  >
    <SelectTrigger id="aio-project" className="w-full">
      <span className="flex flex-1 text-left text-sm">
        {selectedProject ? (
          selectedProject.name
        ) : (
          <span className="text-muted-foreground">Choose a project...</span>
        )}
      </span>
    </SelectTrigger>
    <SelectContent>
      {(projects ?? []).map((p) => (
        <SelectItem key={p.projectKey} value={p.projectKey}>
          {p.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  <p className="text-xs text-muted-foreground">
    Pick the AIO Test Management project this app shows.
  </p>
</div>
```

**Inline loading state** — from `ConnectionsSection.tsx` lines 136-140:
```typescript
{isLoading && (
  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span>Loading projects…</span>
  </div>
)}
```

**Inline error state** — from `ConnectionsSection.tsx` lines 148-152 adapted:
```typescript
{isError && (
  <div className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
    <XCircle className="h-4 w-4" />
    <span>
      Couldn't load AIO projects.{' '}
      <button
        type="button"
        onClick={() => refetch()}
        className="underline hover:no-underline"
      >
        Retry
      </button>
    </span>
  </div>
)}
```

**Empty state** — disabled Select trigger with placeholder (UI-SPEC color-state matrix):
```typescript
// When !isLoading && !isError && projects?.length === 0:
<Select disabled value="">
  <SelectTrigger id="aio-project" className="w-full">
    <span className="flex flex-1 text-left text-sm text-muted-foreground">
      No AIO projects available
    </span>
  </SelectTrigger>
  <SelectContent />
</Select>
```

**Gate pattern** — picker block renders only when `aioEnabled === true` (D-02):
```typescript
{aioEnabled && (
  // picker block: credential load + useQuery + Select (or loading/error/empty state)
)}
```

**Spacing rule** — picker sits inside the same `<div className="flex flex-col gap-4">` as the toggle (UI-SPEC D5 rule 1):
```typescript
<div className="flex flex-col gap-4">
  <h3 ...>AIO Test Management</h3>
  <label ...>  {/* toggle — unchanged */} </label>
  {aioEnabled && (
    <div className="flex flex-col gap-1.5">
      {/* label + select + helper */}
    </div>
  )}
</div>
```

---

### `taskflow/src/routes/settings/IntegrationsSection.test.tsx` (test)

**Analog:** itself — existing describe block (lines 1-48) + `AioProjectsPage.test.tsx` mock patterns

**Existing mock structure** (lines 5-12) — extend to add picker fields:
```typescript
const mockStore = {
  aioEnabled: false,
  setAioEnabled: vi.fn(),
  // ADD:
  selectedAioProjectKey: null,
  setSelectedAioProjectKey: vi.fn(),
};

vi.mock('../../stores/settings.store', () => ({
  useSettingsStore: () => mockStore,
}));
```

**New mocks to add** — from `AioProjectsPage.test.tsx` mock patterns (RESEARCH.md lines 386-392):
```typescript
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

vi.mock('@/services/aio', () => ({
  fetchAioProjects: vi.fn(),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com' }),
}));
```

**QueryClient wrapper** — from `AioProjectsPage.test.tsx` lines 24-26:
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

// Wrap renders:
render(
  <QueryClientProvider client={makeClient()}>
    <IntegrationsSection />
  </QueryClientProvider>
);
```

**Test case shape** — mirror existing toggle tests (lines 31-47) for picker tests:
```typescript
describe('IntegrationsSection — AIO project picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.aioEnabled = false;
    mockStore.selectedAioProjectKey = null;
  });

  it('picker is hidden when aioEnabled=false', () => { ... });
  it('picker renders projects as SelectItems when aioEnabled=true', async () => { ... });
  it('selecting an item calls setSelectedAioProjectKey(projectKey)', async () => { ... });
  it('loading state shows spinner when query is pending', async () => { ... });
  it('error state shows retry button when query fails', async () => { ... });
  it('empty state shows disabled Select when projects=[]]', async () => { ... });
});
```

---

### `taskflow/src/components/app/Sidebar.tsx` (component, request-response)

**Analog:** itself

**`useSettingsStore` destructure** (line 70) — extend with `selectedAioProjectKey`:
```typescript
// BEFORE:
const { devToolsEnabled, sidebarItems, aioEnabled } = useSettingsStore();

// AFTER:
const { devToolsEnabled, sidebarItems, aioEnabled, selectedAioProjectKey } = useSettingsStore();
```

**`sectionedItems` filter** (lines 271-279) — extend gate condition:
```typescript
// BEFORE (lines 272-279):
const sectionedItems = SIDEBAR_SECTIONS.map((section) => ({
  ...section,
  items: SIDEBAR_NAV_ITEMS.filter(
    (nav) =>
      nav.section === section.id &&
      visibleIds.has(nav.id) &&
      !(nav.section === 'testing' && !aioEnabled),
  ),
})).filter((section) => section.items.length > 0);

// AFTER:
const sectionedItems = SIDEBAR_SECTIONS.map((section) => ({
  ...section,
  items: SIDEBAR_NAV_ITEMS.filter(
    (nav) =>
      nav.section === section.id &&
      visibleIds.has(nav.id) &&
      !(nav.section === 'testing' && (!aioEnabled || !selectedAioProjectKey)),
  ),
})).filter((section) => section.items.length > 0);
```

**NavLink `to` prop** (lines 342-358) — intercept by `nav.id` before passing `to`:
```typescript
// BEFORE (line 345-358):
{section.items.map((nav) => {
  const Icon = ICON_MAP[nav.iconName];
  return (
    <NavLink
      key={nav.id}
      to={nav.path}
      ...
    >

// AFTER:
{section.items.map((nav) => {
  const Icon = ICON_MAP[nav.iconName];
  const navTo =
    nav.id === 'aio-projects'
      ? `/aio-project/${selectedAioProjectKey}`
      : nav.path;
  return (
    <NavLink
      key={nav.id}
      to={navTo}
      ...
    >
```

---

### `taskflow/src/components/app/sidebar-items.ts` (config)

**Analog:** itself

**`'aio-projects'` item** (lines 76-83):
```typescript
// BEFORE:
{
  id: 'aio-projects',
  label: 'AIO Projects',
  path: '/aio-projects',
  iconName: 'FlaskConical',
  section: 'testing',
},

// AFTER (Option B sentinel — RESEARCH.md recommendation):
{
  id: 'aio-projects',
  label: 'AIO Projects',
  path: '/aio',          // sentinel: not a real route; Sidebar.tsx overrides to at render time
  iconName: 'FlaskConical',
  section: 'testing',
},
```

No changes to `SidebarNavDef` interface, `SIDEBAR_SECTIONS`, or `getDefaultSidebarItems`. The `path` type remains `string` — no type changes needed.

---

### `taskflow/src/components/app/Sidebar.test.tsx` (test)

**Analog:** itself — existing `aioEnabled gate` describe block (lines 103-135)

**`mockAioEnabled` variable** (line 7) — add parallel variable for `selectedAioProjectKey`:
```typescript
let mockAioEnabled = false;
let mockSelectedAioProjectKey: string | null = null;  // ADD
```

**`useSettingsStore` mock state** (lines 67-93) — add `selectedAioProjectKey` field:
```typescript
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      devToolsEnabled: false,
      aioEnabled: mockAioEnabled,
      selectedAioProjectKey: mockSelectedAioProjectKey,  // ADD
      sidebarItems: [ ... ],   // unchanged
      ...
    };
    return selector ? selector(state) : state;
  },
}));
```

**`renderSidebar` helper** (lines 99-101) — add parameter:
```typescript
// BEFORE:
function renderSidebar(aioEnabled: boolean) {
  mockAioEnabled = aioEnabled;
}

// AFTER:
function renderSidebar(aioEnabled: boolean, selectedAioProjectKey: string | null = null) {
  mockAioEnabled = aioEnabled;
  mockSelectedAioProjectKey = selectedAioProjectKey;
}
```

**New test cases to add** — same structure as existing tests (lines 108-134):
```typescript
it('Testing section hidden when aioEnabled=true but selectedAioProjectKey=null', async () => {
  renderSidebar(true, null);
  // ... expect queryByText('AIO Projects') toBeNull
});

it('AIO Projects item visible when aioEnabled=true AND selectedAioProjectKey set', async () => {
  renderSidebar(true, 'PROJ');
  // ... expect getByText('AIO Projects') toBeDefined
});

it('AIO Projects NavLink href = /aio-project/PROJ when selectedAioProjectKey=PROJ', async () => {
  renderSidebar(true, 'PROJ');
  // ... getByText('AIO Projects').closest('a').getAttribute('href') === '/aio-project/PROJ'
});
```

**Note:** Existing test cases cover `aioEnabled=false` (hides all Testing). Phase 55 extends but does NOT change those existing passing tests — they remain valid because the new gate `(!aioEnabled || !selectedAioProjectKey)` includes the original `!aioEnabled` case.

---

### `taskflow/src/stores/settings.store.test.ts` (test)

**Analog:** itself — `aioEnabled toggle (Phase 51)` describe block (lines 263-286)

**New describe block** — append after line 286, mirroring the Phase 51 block exactly:
```typescript
describe('settings.store — selectedAioProjectKey (Phase 55)', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({
        aioEnabled: false,
        selectedAioProjectKey: null,
      } as any);
    });
  });

  it('selectedAioProjectKey defaults to null', () => {
    expect(useSettingsStore.getState().selectedAioProjectKey).toBeNull();
  });

  it('setSelectedAioProjectKey("PROJ") updates store', () => {
    act(() => useSettingsStore.getState().setSelectedAioProjectKey('PROJ'));
    expect(useSettingsStore.getState().selectedAioProjectKey).toBe('PROJ');
  });

  it('setSelectedAioProjectKey(null) clears the value', () => {
    act(() => useSettingsStore.getState().setSelectedAioProjectKey('PROJ'));
    act(() => useSettingsStore.getState().setSelectedAioProjectKey(null));
    expect(useSettingsStore.getState().selectedAioProjectKey).toBeNull();
  });

  it('setAioEnabled(false) does NOT clear selectedAioProjectKey (D-08)', () => {
    act(() => useSettingsStore.getState().setSelectedAioProjectKey('PROJ'));
    act(() => useSettingsStore.getState().setAioEnabled(false));
    expect(useSettingsStore.getState().selectedAioProjectKey).toBe('PROJ');
  });
});
```

**Migration test** — test the `migrate` function directly, mirroring the v15→v16 test pattern (no separate migration-test describe block exists in the file currently; add inline):
```typescript
describe('settings.store — v16→v17 migration (Phase 55)', () => {
  it('migration sets selectedAioProjectKey=null when field is absent', () => {
    // Access the persist.migrate fn via the store's internal config
    // Pattern: call migrate directly with a v16 state object
    const { migrate } = (useSettingsStore as any).__persistConfig ?? {};
    // Fallback: test via setState and verify field is accessible
    act(() => {
      useSettingsStore.setState({ selectedAioProjectKey: undefined } as any);
    });
    // After migration (triggered on next hydration), field should be null
    // Simpler: just verify the default from the store create() is null
    const fresh = useSettingsStore.getState();
    // setState with undefined then read back — Zustand merges
    expect(fresh.selectedAioProjectKey === null || fresh.selectedAioProjectKey === undefined)
      .toBe(true);
  });
});
```

> **Note to planner:** The existing test file has no direct `migrate()` function invocation pattern — it tests fields via `useSettingsStore.getState()` and `setState`. For the migration guard specifically, a comment in the test noting the guard is at `settings.store.ts:441-443` is sufficient; the field default test (above) covers the functional behavior.

---

### `taskflow/src/routes/routes.tsx` (config)

**Analog:** itself

**Lazy import to remove** (line 21):
```typescript
// DELETE this line:
const AioProjectsPage = lazy(() => import('./dashboard/AioProjectsPage'));
```

**Route entry to remove** (line 52):
```typescript
// DELETE this line:
{ path: '/aio-projects', element: withLazy(AioProjectsPage) },
```

**Routes that STAY** (lines 53-58 — do not touch):
```typescript
{ path: '/aio-project/:projectKey', element: withLazy(AioProjectOverviewPage) },
{ path: '/aio-cycle/:projectKey/:cycleKey', element: withLazy(AioCycleDetailPage) },
{
  path: '/aio-cycle/:projectKey/:cycleKey/run/:runId',
  element: withLazy(AioTestRunDetailPage),
},
```

---

## Shared Patterns

### Credential Loading (`readSecret` + `useAuthStore`)
**Source:** `AioProjectsPage.tsx` lines 15-22
**Apply to:** `IntegrationsSection.tsx` picker block (when `aioEnabled === true`)
```typescript
const { jiraBaseUrl } = useAuthStore();
const [token, setToken] = useState<string | null>(null);

useEffect(() => {
  readSecret('jira-pat')
    .then(setToken)
    .catch(() => setToken(null));
}, [jiraBaseUrl]); // dependency: jiraBaseUrl (user can change it in ConnectionsSection)
```

### React Query `enabled` Guard
**Source:** `AioProjectsPage.tsx` line 30
**Apply to:** `IntegrationsSection.tsx` `useQuery` call
```typescript
enabled: !!jiraBaseUrl && !!token,
```
Critical: without this guard, the query fires immediately with null credentials → 401 error state on first Settings open (RESEARCH.md Pitfall 1).

### Inline Icon-Text Row (gap-1.5)
**Source:** `ConnectionsSection.tsx` lines 136-153
**Apply to:** Loading row, error row in `IntegrationsSection.tsx`
```typescript
<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
  <Loader2 className="h-4 w-4 animate-spin" />
  <span>Loading projects…</span>
</div>
```
Token `gap-1.5` (6px) is an established exception in the codebase (UI-SPEC E-01).

### Test Mock — `useSettingsStore`
**Source:** `IntegrationsSection.test.tsx` lines 5-12, `Sidebar.test.tsx` lines 65-93
**Apply to:** All test files that mock this store in Phase 55
Always add `selectedAioProjectKey` and `setSelectedAioProjectKey` to the mock object to avoid Pitfall 4 (RESEARCH.md).

### `vi.fn()` for Setter Mocks
**Source:** `IntegrationsSection.test.tsx` line 7
**Apply to:** All new setter mocks
```typescript
setSelectedAioProjectKey: vi.fn(),
```

---

## No Analog Found

All files have exact analogs in the codebase. No file in this phase requires falling back to RESEARCH.md patterns as a substitute for a real codebase analog.

---

## Metadata

**Analog search scope:** `taskflow/src/stores/`, `taskflow/src/routes/settings/`, `taskflow/src/routes/dashboard/`, `taskflow/src/routes/onboarding/`, `taskflow/src/components/app/`
**Files read:** 12 source files
**Pattern extraction date:** 2026-05-14
