# Phase 63: Tempo Saved Filters + Test Pass - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 5 (3 new, 2 modified)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/stores/tempo-filters.store.ts` | store | CRUD | `taskflow/src/stores/pinned-tabs.store.ts` | exact |
| `taskflow/src/stores/tempo-filters.store.test.ts` | test | CRUD | `taskflow/src/stores/pinned-tabs.store.test.ts` | exact |
| `taskflow/src/routes/worklogs/WorklogsPage.tsx` | component | request-response | `taskflow/src/routes/worklogs/WorklogsPage.tsx` (self — extend) | self |
| `taskflow/src/routes/worklogs/WorklogsPage.test.tsx` | test | request-response | `taskflow/src/routes/worklogs/WorklogsPage.test.tsx` (self — extend) | self |
| `taskflow/src/services/jira.test.ts` | test | request-response | `taskflow/src/services/jira.test.ts` (self — one-line fix) | self |

---

## Pattern Assignments

### `taskflow/src/stores/tempo-filters.store.ts` (store, CRUD)

**Analog:** `taskflow/src/stores/pinned-tabs.store.ts`

**Imports pattern** (pinned-tabs.store.ts lines 1–3):
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';
```

**Interface pattern** (pinned-tabs.store.ts lines 5–14):
```typescript
// Model the interface after PinnedTabsState — typed state + typed actions, no optional fields
interface PinnedTabsState {
  pinnedKeys: string[];
  pinnedCycleMeta: Record<string, { name: string; projectKey: string }>;
  togglePin: (key: string) => void;
  removePin: (key: string) => void;
  // ... actions typed inline
}
```
Apply to tempo-filters.store.ts as:
```typescript
export interface TempoFilter {
  id: string;
  name: string;
  preset: DatePreset;         // export DatePreset from WorklogsPage.tsx first (Option A from RESEARCH)
  username: string | null;
  displayName: string | null;
  // customFrom/customTo intentionally absent — D-02
}

interface TempoFiltersState {
  savedFilters: TempoFilter[];
  addFilter: (filter: TempoFilter) => void;
  removeFilter: (id: string) => void;
  renameFilter: (id: string, name: string) => void;
}
```

**Core persist pattern** (pinned-tabs.store.ts lines 16–61):
```typescript
export const usePinnedTabsStore = create<PinnedTabsState>()(
  persist(
    (set, get) => ({
      pinnedKeys: [],
      pinnedCycleMeta: {},
      togglePin: (key) =>
        set((s) => ({
          pinnedKeys: s.pinnedKeys.includes(key)
            ? s.pinnedKeys.filter((k) => k !== key)
            : [...s.pinnedKeys, key],
        })),
      removePin: (key) =>
        set((s) => ({
          pinnedKeys: s.pinnedKeys.filter((k) => k !== key),
        })),
      // ...
    }),
    {
      name: 'pinned-tabs-store',
      storage: createTauriStorage('pinned-tabs.json'),
      version: 1,
      migrate: (persisted, version) => {
        const s = persisted as PinnedTabsState;
        if (version < 1) {
          s.pinnedCycleMeta = {};
        }
        return s;
      },
    },
  ),
);
```
Apply to tempo-filters.store.ts as:
```typescript
export const useTempoFiltersStore = create<TempoFiltersState>()(
  persist(
    (set) => ({
      savedFilters: [],
      addFilter: (filter) =>
        set((s) => ({ savedFilters: [...s.savedFilters, filter] })),
      removeFilter: (id) =>
        set((s) => ({ savedFilters: s.savedFilters.filter((f) => f.id !== id) })),
      renameFilter: (id, name) =>
        set((s) => ({
          savedFilters: s.savedFilters.map((f) => (f.id === id ? { ...f, name } : f)),
        })),
    }),
    {
      name: 'tempo-filters-store',
      storage: createTauriStorage('tempo-filters.json'),
      version: 1,
      migrate: (persisted, _version) => persisted as TempoFiltersState,
    },
  ),
);
```

**Secondary shape reference** (`taskflow/src/stores/saved-filter.store.ts` lines 10–38):
Use `useSavedFilterStore` for naming convention alignment (`addSavedFilter` → `addFilter`, `removeSavedFilter` → `removeFilter`). Key difference: Jira saved filters use NO persist middleware (session-only). Tempo filters MUST use persist.

---

### `taskflow/src/stores/tempo-filters.store.test.ts` (test, CRUD)

**Analog:** `taskflow/src/stores/pinned-tabs.store.test.ts`

**Inline LazyStore mock + import pattern** (pinned-tabs.store.test.ts lines 1–15):
```typescript
import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Tauri plugin-store so LazyStore doesn't attempt IPC calls in jsdom
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});

import { usePinnedTabsStore } from './pinned-tabs.store';
```

**IMPORTANT NOTE:** The global `setup.ts` already mocks `@tauri-apps/plugin-store` with the shared-Map implementation (setup.ts lines 14–46). The inline mock in `pinned-tabs.store.test.ts` (lines 5–13) overrides it with a simpler, non-shared stub. For `tempo-filters.store.test.ts`, use the inline mock pattern identical to `pinned-tabs.store.test.ts` to avoid shared-state bleed between test files (Pitfall 5 from RESEARCH).

**State reset pattern** (pinned-tabs.store.test.ts lines 18–21):
```typescript
beforeEach(() => {
  act(() => {
    usePinnedTabsStore.setState({ pinnedKeys: [] });
  });
});
```
Apply as:
```typescript
beforeEach(() => {
  act(() => {
    useTempoFiltersStore.setState({ savedFilters: [] });
  });
});
```

**Action test pattern** (pinned-tabs.store.test.ts lines 24–28):
```typescript
it('togglePin adds a key', () => {
  act(() => {
    usePinnedTabsStore.getState().togglePin('PROJ-1');
  });
  expect(usePinnedTabsStore.getState().pinnedKeys).toEqual(['PROJ-1']);
});
```
Apply per action: `addFilter`, `removeFilter`, `renameFilter`. Also test empty-name guard (Pitfall 4): the guard is in `WorklogsPage` not the store, but test `addFilter({ name: '' })` is valid — the store accepts it, the UI prevents it.

**Secondary action test reference** (`taskflow/src/stores/saved-filter.store.test.ts` lines 1–104):
Use fixture constants (`const FILTER_A = { id: 'f1', ... }`) and verify that `removeFilter` does NOT need to clear `activeFilterId` (tracked in component state only — Pitfall 1 from RESEARCH).

---

### `taskflow/src/routes/worklogs/WorklogsPage.tsx` (component, request-response) — MODIFY

**Self-analog** — extending the existing file.

**Filter state pattern** (WorklogsPage.tsx lines 145–150):
```typescript
const [jiraToken, setJiraToken] = useState<string | null>(null);
const [preset, setPreset] = useState<DatePreset>('this-week');
const [customFrom, setCustomFrom] = useState('');
const [customTo, setCustomTo] = useState('');
const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
const [selectedDisplayName, setSelectedDisplayName] = useState<string | null>(null);
```
Add alongside these:
```typescript
const [savingOpen, setSavingOpen] = useState(false);
const [saveName, setSaveName] = useState('');
const [activeFilterId, setActiveFilterId] = useState<string | null>(null); // local only — Pitfall 1
const [renamingId, setRenamingId] = useState<string | null>(null);
```

**DatePreset type — export required** (WorklogsPage.tsx line 27):
```typescript
// BEFORE (file-local):
type DatePreset = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'last-working-day' | 'custom';

// AFTER (exported — needed by tempo-filters.store.ts):
export type DatePreset = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'last-working-day' | 'custom';
```

**Filter bar container pattern** (WorklogsPage.tsx lines 296–384):
The existing filter bar is a single `<div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-background flex-wrap">`. The saved-filters row is a SEPARATE `<div>` directly above this existing div (D-03 — not inside it):
```typescript
{/* Saved filter row — only rendered when savedFilters.length > 0 */}
{savedFilters.length > 0 && (
  <div className="flex items-center gap-2 px-6 py-2 border-b border-border flex-wrap">
    {savedFilters.map((filter) => (
      // ... pill with hover-delete + double-click rename (see Pattern 3 in RESEARCH)
    ))}
  </div>
)}

{/* Existing filter bar — unchanged structure */}
<div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-background flex-wrap">
  {/* DATE_PRESETS.map ... */}
  {/* ... rest of existing bar ... */}
  {/* Save button appended at end of this div */}
  {savingOpen ? (
    <> {/* inline input + Check + X buttons */} </>
  ) : (
    <button type="button" onClick={() => setSavingOpen(true)} ...>Save filter</button>
  )}
</div>
```

**Combobox aria pattern** (WorklogsPage.tsx lines 352–383) — reference for consistency:
```typescript
<input
  id="people-filter"
  role="combobox"
  aria-label="Filter by person"
  aria-autocomplete="list"
  aria-expanded={open}
  className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-36"
/>
```
Use `focus:ring-ring` and `border-border` consistently in the new save `<input>` and rename `<input>`.

**Active pill class pattern** (WorklogsPage.tsx lines 302–309):
```typescript
className={
  preset === p.id
    ? 'bg-accent text-accent-foreground font-semibold border border-border rounded-md px-3 h-7 text-xs'
    : 'hover:bg-accent text-foreground rounded-md px-3 h-7 text-xs'
}
```
Use the same `bg-accent text-accent-foreground` class for the active saved filter pill (D-06 active state).

**Hover chip dismiss pattern** (WorklogsPage.tsx lines 336–348):
```typescript
{selectedDisplayName !== null && (
  <Badge variant="secondary" className="gap-1">
    {selectedDisplayName}
    <button
      type="button"
      aria-label={`Remove ${selectedDisplayName} filter`}
      onClick={clearPersonFilter}
      className="ml-0.5 hover:text-destructive transition-colors"
    >
      ×
    </button>
  </Badge>
)}
```
The saved filter pill × delete uses the same `hover:text-destructive transition-colors` + `aria-label` pattern, but with `group`/`group-hover:opacity-100` for opacity-based reveal (Pitfall 3 from RESEARCH — parent `<div>` must have `group` class).

**Store import pattern** — add alongside existing store imports (lines 22–23):
```typescript
import { useTempoFiltersStore } from '@/stores/tempo-filters.store';
```
Then destructure:
```typescript
const { savedFilters, addFilter, removeFilter, renameFilter } = useTempoFiltersStore();
```

**handleConfirmSave — empty-name guard** (Pitfall 4 from RESEARCH):
```typescript
function handleConfirmSave() {
  if (!saveName.trim()) return; // Pitfall 4 guard — must be present
  addFilter({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2), // See RESEARCH open Q1 re: crypto.randomUUID
    name: saveName.trim(),
    preset,
    username: selectedUsername,
    displayName: selectedDisplayName,
  });
  setSaveName('');
  setSavingOpen(false);
}
```

**handleLoadFilter** (D-06):
```typescript
function handleLoadFilter(filter: TempoFilter) {
  setPreset(filter.preset);
  setSelectedUsername(filter.username);
  setSelectedDisplayName(filter.displayName);
  setActiveFilterId(filter.id);
}
```

---

### `taskflow/src/routes/worklogs/WorklogsPage.test.tsx` (test, request-response) — MODIFY

**Self-analog** — extending the existing test file.

**Module-level mock variable pattern** (WorklogsPage.test.tsx lines 19–22):
```typescript
let mockTempoEnabled = true;
let mockFetchWorklogsResult: TempoWorklog[] = [];
let mockAssignableUsersResult: { name: string; displayName: string }[] = [];
```
Add alongside these:
```typescript
let mockSavedFilters: TempoFilter[] = [];
let mockAddFilter = vi.fn();
let mockRemoveFilter = vi.fn();
let mockRenameFilter = vi.fn();
```

**vi.mock hoisted pattern** (WorklogsPage.test.tsx lines 26–59):
```typescript
vi.mock('@/stores/auth.store', () => ({ ... }));
vi.mock('@/stores/settings.store', () => ({ ... }));
```
Add:
```typescript
vi.mock('@/stores/tempo-filters.store', () => ({
  useTempoFiltersStore: () => ({
    savedFilters: mockSavedFilters,
    addFilter: mockAddFilter,
    removeFilter: mockRemoveFilter,
    renameFilter: mockRenameFilter,
  }),
}));
```

**beforeEach reset pattern** (WorklogsPage.test.tsx lines 97–102):
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  mockFetchWorklogsResult = [];
  mockTempoEnabled = true;
});
```
Add to the same `beforeEach`:
```typescript
  mockSavedFilters = [];
  mockAddFilter = vi.fn();
  mockRemoveFilter = vi.fn();
  mockRenameFilter = vi.fn();
```

**renderPage + waitFor pattern** (WorklogsPage.test.tsx lines 67–79):
All new TEMPO-04/05 tests use the same `renderPage()` helper and `await waitFor(...)` to assert after async state settles. No new render helper needed.

**fireEvent interaction pattern** (WorklogsPage.test.tsx lines 187–191):
```typescript
fireEvent.click(getByText('Custom'));
expect(container.querySelectorAll('input[type="date"]').length).toBe(2);
```
Apply for saved filter interactions:
```typescript
// Save button opens inline input
fireEvent.click(getByText('Save filter'));
expect(getByRole('textbox', { name: /filter name/i })).toBeTruthy();

// Double-click opens rename
fireEvent.dblClick(getByText('My Filter'));
expect(getByRole('textbox', { name: /rename filter/i })).toBeTruthy();
// Do NOT test focus (Pitfall 2 from RESEARCH — jsdom autoFocus unreliable)
```

---

### `taskflow/src/services/jira.test.ts` (test) — MINIMAL FIX

**Location of failing tests** (jira.test.ts lines 908–936):

**Before (fails — 5-key object, missing flaggedFieldKey):**
```typescript
// Line 908 test: 'returns all four defaults when API call throws'
expect(result).toEqual({
  storyPointsFieldKey: 'customfield_10016',
  epicLinkFieldKey: 'customfield_10014',
  epicNameFieldKey: 'customfield_10015',
  sprintFieldKey: 'customfield_10020',
  epicColorFieldKey: 'customfield_10013',
});

// Line 921 test: 'returns all four defaults when response is not ok'
expect(result).toEqual({
  storyPointsFieldKey: 'customfield_10016',
  epicLinkFieldKey: 'customfield_10014',
  epicNameFieldKey: 'customfield_10015',
  sprintFieldKey: 'customfield_10020',
  epicColorFieldKey: 'customfield_10013',
});
```

**After (passes — 6-key object, flaggedFieldKey added at end):**
```typescript
// Both toEqual blocks receive the identical fix:
expect(result).toEqual({
  storyPointsFieldKey: 'customfield_10016',
  epicLinkFieldKey: 'customfield_10014',
  epicNameFieldKey: 'customfield_10015',
  sprintFieldKey: 'customfield_10020',
  epicColorFieldKey: 'customfield_10013',
  flaggedFieldKey: 'customfield_10021',
});
```

The test description strings ("returns all four defaults when...") should be updated to "returns all five defaults when..." or "returns all N defaults when..." to reflect the 6-key reality. Alternatively, leave the description unchanged — the important change is the `toEqual` object.

No other changes to `jira.test.ts`.

---

## Shared Patterns

### Zustand persist + createTauriStorage
**Source:** `taskflow/src/stores/pinned-tabs.store.ts` (full file — 61 lines)
**Apply to:** `tempo-filters.store.ts`
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

// ... interface ...

export const useTempoFiltersStore = create<TempoFiltersState>()(
  persist(
    (set) => ({ /* actions */ }),
    {
      name: 'tempo-filters-store',
      storage: createTauriStorage('tempo-filters.json'),
      version: 1,
      migrate: (persisted, _version) => persisted as TempoFiltersState,
    },
  ),
);
```

### LazyStore mock in store tests (inline per-file)
**Source:** `taskflow/src/stores/pinned-tabs.store.test.ts` lines 5–13
**Apply to:** `tempo-filters.store.test.ts`
```typescript
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});
```
This overrides the shared-Map global mock from `setup.ts` and prevents test bleed (Pitfall 5).

### LazyStore clearStore (global mock — for component tests)
**Source:** `taskflow/src/test/setup.ts` line 41
```typescript
/** Test helper: clear backing store (simulates app reinstall / fresh state) */
static clearStore(filename: string): void {
  stores.delete(filename);
}
```
Not needed for `tempo-filters.store.test.ts` (uses inline mock). Available for `WorklogsPage.test.tsx` if the store mock leaks between describe blocks.

### Tailwind active pill class
**Source:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` lines 302–309
**Apply to:** saved filter pill active state (D-06)
```typescript
'bg-accent text-accent-foreground font-semibold border border-border rounded-md px-3 h-7 text-xs'
// vs inactive:
'border border-border rounded-md px-3 h-7 text-xs hover:bg-accent cursor-pointer'
```

### Hover dismiss × button
**Source:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` lines 338–347
**Apply to:** saved filter pill × delete (Pitfall 3 — parent needs `group` class)
```typescript
// Parent pill wrapper:
<div className="group relative flex items-center">
  {/* ... pill button ... */}
  <button
    type="button"
    aria-label={`Delete ${filter.name} filter`}
    onClick={() => removeFilter(filter.id)}
    className="ml-1 w-6 h-6 p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-colors"
  >
    ×
  </button>
</div>
```

### Input class for inline text fields
**Source:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` line 366
**Apply to:** save-name input + rename input
```typescript
className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-36"
```

### Zustand store test state reset
**Source:** `taskflow/src/stores/pinned-tabs.store.test.ts` lines 18–21 and `taskflow/src/stores/saved-filter.store.test.ts` lines 9–17
**Apply to:** `tempo-filters.store.test.ts` beforeEach
```typescript
beforeEach(() => {
  act(() => {
    useTempoFiltersStore.setState({ savedFilters: [] });
  });
});
```

---

## No Analog Found

No files in this phase lack an analog. All 5 files have direct pattern matches in the codebase.

---

## Metadata

**Analog search scope:** `taskflow/src/stores/`, `taskflow/src/routes/worklogs/`, `taskflow/src/services/`, `taskflow/src/lib/`, `taskflow/src/test/`
**Files scanned:** 8 (pinned-tabs.store.ts, pinned-tabs.store.test.ts, saved-filter.store.ts, saved-filter.store.test.ts, tauri-storage.ts, WorklogsPage.tsx, WorklogsPage.test.tsx, setup.ts)
**Pattern extraction date:** 2026-05-21
