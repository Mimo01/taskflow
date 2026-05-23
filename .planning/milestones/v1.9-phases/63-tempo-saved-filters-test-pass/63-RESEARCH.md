# Phase 63: Tempo Saved Filters + Test Pass - Research

**Researched:** 2026-05-21
**Domain:** Zustand persist stores, inline filter UX, Vitest/React Testing Library
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** New dedicated `tempo-filters.store.ts` using `createTauriStorage('tempo-filters.json')` + Zustand `persist` middleware. Same pattern as `pinned-tabs.store.ts`. No settings store version bump.
- **D-02:** Saved filter record shape: `{ id: string, name: string, preset: DatePreset, username: string | null, displayName: string | null }`. Custom dates are NOT persisted — if a "custom" preset is saved, date inputs start empty on load.
- **D-03:** Saved filters shown as a separate row ABOVE the existing preset pills row. Row is only rendered when `savedFilters.length > 0`.
- **D-04:** Save interaction: "Save filter" button at the end of the main filter bar; clicking toggles a small inline text input + confirm/cancel in the same row. No popover.
- **D-05:** Edit interactions on saved filter pills: × button on hover for delete; double-click on pill label to rename inline. Matches existing Jira saved filter inline delete from v1.5.
- **D-06:** Clicking a saved filter pill applies it: sets `preset` and `selectedUsername`/`selectedDisplayName` in WorklogsPage component state, triggering a re-fetch.
- **D-07:** The 2 jira.test.ts failures are caused by `discoverCustomFields` tests not expecting `flaggedFieldKey`. Fix = add `flaggedFieldKey: 'customfield_10021'` to the two `toEqual` expectations (lines 912 and 929).
- **D-08:** Phase 62 tests all pass (24/24). No Phase 62 audit needed. After Phase 63 additions, run the full suite to verify QUAL-01.
- **D-09 (Claude's Discretion):** Dead code sweep scope: unused imports referencing deleted widget/workload files, stale `widget` or `workload` mentions in non-deleted source files, and any unused imports introduced by Phase 62. Leave unrelated cleanup to a future pass.

### Claude's Discretion

- Store `id` generation: `crypto.randomUUID()` or timestamp-based ID.
- Save button: icon vs text ("Save filter" — UI-SPEC locked as text).
- Store version: start at `version: 1` with identity migrate.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEMPO-04 | User can save a named filter combining a people selection and date preset | D-01, D-02 store + D-04 UI pattern; Zustand persist + createTauriStorage is the verified approach |
| TEMPO-05 | User can load, rename, and delete saved Tempo filters | D-05/D-06 UI interactions; inline rename + × delete + pill click-to-load |
| QUAL-01 | All tests pass with zero failures after all removals and additions | D-07 fixes the 2 known jira.test.ts failures; confirmed by live test run |
| QUAL-02 | Dead code, unused imports, stale components from removed features eliminated | D-09 scope; grep audit confirms no remaining widget/workload import references |
</phase_requirements>

---

## Summary

Phase 63 has three distinct work streams: (1) build a new Zustand persist store for saved Tempo filters, (2) add the saved-filter UX to WorklogsPage, and (3) a test fix plus dead code sweep.

The persistence pattern is fully established in the codebase. `pinned-tabs.store.ts` is a direct 1:1 template — Zustand `create` + `persist` middleware + `createTauriStorage('filename.json')`. The `LazyStore` mock in `src/test/setup.ts` already supports the pattern globally, so the new `tempo-filters.store.ts` will work in unit tests without any setup changes.

The UI additions are well-specified in the UI-SPEC. No new shadcn components are needed. All elements (pills, inline inputs, × buttons) reuse the existing WorklogsPage primitive patterns. The saved-filters row sits above the preset pills and is conditionally rendered.

The test fix is a one-line (×2) change: both "returns all N defaults when X" tests in `discoverCustomFields` assert against a 5-key object, but the implementation now returns 6 keys including `flaggedFieldKey: 'customfield_10021'`. Adding that key to both `toEqual` expectations restores the 1300 passing test count.

**Primary recommendation:** Implement in three sequential tasks: (1) new store, (2) WorklogsPage UI extensions, (3) test fix + dead code sweep. The store must exist before WorklogsPage can import it.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Saved filter persistence | Browser/Client (Tauri LazyStore) | — | All persistence is via Tauri plugin-store (no backend API); LazyStore writes to the app data directory |
| Saved filter CRUD state | Browser/Client (Zustand) | — | In-memory store layer synchronized to LazyStore via persist middleware |
| Save/load/rename/delete UX | Frontend component (WorklogsPage) | Zustand store | Component reads/writes store; store serializes to disk |
| Test fix | Test layer | — | Expectation update in jira.test.ts only; no production code change |
| Dead code sweep | Source files | — | Import cleanup; no runtime behavior change |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5.0.11 | State management + persist middleware | Already used for all stores in this codebase |
| @tauri-apps/plugin-store | ^2.4.2 | LazyStore — the backing persistence for Zustand | Already used by all persisted stores |
| vitest | ^4.0.18 | Test runner | Project standard |
| @testing-library/react | ^16.3.2 | Component testing | Project standard |

[VERIFIED: package.json in taskflow/]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | (project version) | `Check` and `X` icons for save confirm/cancel buttons | UI-SPEC specifies lucide icons |
| crypto.randomUUID() | Web API (built-in) | ID generation for saved filters | Available globally in modern browsers and Tauri WebView |

---

## Package Legitimacy Audit

No new packages are installed in this phase. All libraries used (`zustand`, `@tauri-apps/plugin-store`, `vitest`, `@testing-library/react`, `lucide-react`) are already in `package.json` and are production dependencies.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
WorklogsPage (component state)
  ├── reads: preset, selectedUsername, selectedDisplayName
  ├── writes to: useTempoFiltersStore (save action)
  └── reads from: useTempoFiltersStore (load, list)

useTempoFiltersStore (Zustand + persist)
  ├── state: savedFilters: TempoFilter[]
  ├── actions: addFilter, removeFilter, renameFilter
  └── storage: createTauriStorage('tempo-filters.json')
                    └── LazyStore → [app data dir]/tempo-filters.json

jira.test.ts (test fix, no production flow)
  └── discoverCustomFields expectations updated to include flaggedFieldKey
```

### Recommended Project Structure

```
taskflow/src/
├── stores/
│   └── tempo-filters.store.ts    (NEW — mirrors pinned-tabs.store.ts structure)
├── routes/worklogs/
│   ├── WorklogsPage.tsx           (MODIFY — add saved-filters row + save button)
│   └── WorklogsPage.test.tsx      (MODIFY — extend with TEMPO-04/05 tests)
└── services/
    └── jira.test.ts               (MODIFY — add flaggedFieldKey to 2 toEqual expectations)
```

### Pattern 1: Zustand Persist Store (createTauriStorage)

**What:** A Zustand store using the `persist` middleware with `createTauriStorage` as the storage backend. The LazyStore writes to a named JSON file in the Tauri app data directory.

**When to use:** Any store that must survive app restarts. Used by `pinned-tabs.store.ts` and `recent-items.store.ts`.

**Example (from `pinned-tabs.store.ts`):**
```typescript
// Source: taskflow/src/stores/pinned-tabs.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

export const useTempoFiltersStore = create<TempoFiltersState>()(
  persist(
    (set, get) => ({
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
      migrate: (persisted, _version) => {
        return persisted as TempoFiltersState;
      },
    },
  ),
);
```

### Pattern 2: Inline Save Input (same-row toggle)

**What:** A text button ("Save filter") that, when clicked, replaces itself with an inline `<input>` + confirm/cancel icon buttons in the same `flex` row.

**When to use:** D-04 — no popover, same row as the filter bar.

**Example (from UI-SPEC and WorklogsPage.tsx filter bar pattern):**
```typescript
// Source: taskflow/.planning/phases/63-tempo-saved-filters-test-pass/63-UI-SPEC.md
{savingOpen ? (
  <>
    <input
      type="text"
      value={saveName}
      onChange={(e) => setSaveName(e.target.value)}
      placeholder="Filter name"
      aria-label="Filter name"
      className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-36"
    />
    <button type="button" aria-label="Confirm save" onClick={handleConfirmSave}>
      <Check size={16} />
    </button>
    <button type="button" aria-label="Cancel" onClick={() => setSavingOpen(false)}>
      <X size={16} />
    </button>
  </>
) : (
  <button
    type="button"
    onClick={() => setSavingOpen(true)}
    className="text-xs text-muted-foreground hover:text-foreground px-2 h-7 rounded-md hover:bg-accent transition-colors"
  >
    Save filter
  </button>
)}
```

### Pattern 3: Saved Filter Pill (hover-delete + double-click rename)

**What:** A pill button displaying the filter name; × delete button appears on hover; double-click on the label switches to an inline rename input.

**When to use:** D-05 — matches Jira saved filter inline delete (v1.5 pattern, `SavedFilterList.tsx`).

**Example:**
```typescript
// Source: taskflow/.planning/phases/63-tempo-saved-filters-test-pass/63-UI-SPEC.md
<div className="group relative flex items-center">
  {renamingId === filter.id ? (
    <input
      type="text"
      defaultValue={filter.name}
      aria-label="Rename filter"
      onBlur={(e) => handleRename(filter.id, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleRename(filter.id, e.currentTarget.value);
        if (e.key === 'Escape') setRenamingId(null);
      }}
      autoFocus
      className="h-5 text-xs border border-ring rounded px-1 focus:outline-none"
    />
  ) : (
    <button
      type="button"
      onDoubleClick={() => setRenamingId(filter.id)}
      onClick={() => handleLoadFilter(filter)}
      className={filter.id === activeFilterId
        ? 'bg-accent text-accent-foreground font-semibold border border-border rounded-md px-3 h-7 text-xs'
        : 'border border-border rounded-md px-3 h-7 text-xs hover:bg-accent cursor-pointer'}
    >
      {filter.name}
    </button>
  )}
  <button
    type="button"
    aria-label={`Delete ${filter.name} filter`}
    onClick={() => handleDeleteFilter(filter.id)}
    className="ml-1 w-6 h-6 p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-colors"
  >
    ×
  </button>
</div>
```

### Pattern 4: discoverCustomFields Test Fix

**What:** Two `toEqual` assertions in `jira.test.ts` that enumerate all 5 default keys from `discoverCustomFields`; they fail because the implementation now returns 6 keys (added `flaggedFieldKey: 'customfield_10021'`).

**Fix — line 912 area (throws case) and line 929 area (not-ok case):**
```typescript
// Source: taskflow/src/services/jira.test.ts lines 908-936 (current failing state)
// Before (fails):
expect(result).toEqual({
  storyPointsFieldKey: 'customfield_10016',
  epicLinkFieldKey: 'customfield_10014',
  epicNameFieldKey: 'customfield_10015',
  sprintFieldKey: 'customfield_10020',
  epicColorFieldKey: 'customfield_10013',
});

// After (passes):
expect(result).toEqual({
  storyPointsFieldKey: 'customfield_10016',
  epicLinkFieldKey: 'customfield_10014',
  epicNameFieldKey: 'customfield_10015',
  sprintFieldKey: 'customfield_10020',
  epicColorFieldKey: 'customfield_10013',
  flaggedFieldKey: 'customfield_10021',
});
```

Both failing tests ("returns all N defaults when API call throws" and "returns all N defaults when response is not ok") receive the identical fix.

### Anti-Patterns to Avoid

- **Putting the saved-filter row inside the main filter bar `<div>`:** It must be a separate `<div>` above the existing filter bar, not appended inside the flex row of preset pills. D-03 mandates a distinct row.
- **Persisting `customFrom`/`customTo`:** D-02 explicitly excludes custom dates. If `preset === 'custom'` is saved, date inputs start empty on load.
- **Using a dialog/popover for save input:** D-04 mandates an inline inline toggle in the same row. No Radix Popover or Dialog.
- **Confirming delete with a modal:** D-05 mandates immediate × delete on hover (no confirmation dialog). Matches the v1.5 Jira pattern.
- **Using `toLocaleDateString()` for date keys:** Pre-existing Phase 62 prohibition — always `.slice(0, 10)` on ISO strings for data keys. Not relevant to Phase 63 new code, but do not introduce it in WorklogsPage edits.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File persistence across restarts | Custom file I/O or localStorage | `createTauriStorage('tempo-filters.json')` + Zustand `persist` | LazyStore handles Tauri IPC; already mocked in test setup; pattern proven in pinned-tabs.store.ts |
| Store mock in tests | Manual mock of `@tauri-apps/plugin-store` | Global mock in `src/test/setup.ts` | Already covers all `LazyStore` instances automatically — no per-test setup needed |

**Key insight:** The Tauri LazyStore mock in `setup.ts` is instance-shared by filename. Creating `new LazyStore('tempo-filters.json')` in tests will automatically use the in-memory Map backing — the new store works in tests with zero additional mock configuration.

---

## Common Pitfalls

### Pitfall 1: Active Filter Tracking — Where to Store It

**What goes wrong:** Developer adds `activeFilterId: string | null` to `tempo-filters.store.ts` (persisted). After restart, the active filter ID is restored but the page state (preset/username) is NOT automatically re-applied.

**Why it happens:** Persisting `activeFilterId` implies the active filter survives restart, but WorklogsPage initializes from `useState` defaults, not from the store. The pill would appear highlighted but the table would show "This Week / all users".

**How to avoid:** Track `activeFilterId` as local component state in `WorklogsPage`, not in the persisted store. On mount, WorklogsPage starts with no active filter — user must click a pill to load it. This is consistent with D-06 (clicking applies).

**Warning signs:** If `activeFilterId` appears in the Zustand store interface, remove it.

### Pitfall 2: Rename Input Focus Race

**What goes wrong:** Double-click sets `renamingId`, the input renders, but the `autoFocus` attribute does not fire reliably in jsdom tests.

**Why it happens:** jsdom does not fully simulate focus events triggered by `autoFocus`.

**How to avoid:** In tests, use `fireEvent.dblClick` on the pill and then `getByRole('textbox', { name: /rename filter/i })` — the input is accessible by aria-label regardless of focus state. Do not test focus in unit tests.

### Pitfall 3: `group-hover` Requires Tailwind CSS `group` on Parent

**What goes wrong:** The × delete button uses `group-hover:opacity-100` but the parent `<div>` does not have the `group` class, so the button is permanently hidden.

**Why it happens:** Tailwind's `group-hover` variant only works when an ancestor has the `group` utility.

**How to avoid:** The pill wrapper `<div>` must have `className="group relative flex items-center"`. Verify in tests by checking `opacity-0 group-hover:opacity-100` classes are on the × button and `group` is on its parent.

### Pitfall 4: Empty-Name Guard on Save

**What goes wrong:** User clicks Confirm with empty input — an unnamed filter `{ id: ..., name: '' }` is saved to the store.

**Why it happens:** No guard around the `addFilter` call.

**How to avoid:** `handleConfirmSave` must guard: `if (!saveName.trim()) return;`. UI-SPEC explicitly specifies this: "If the input is empty on confirm, do nothing."

### Pitfall 5: Test Isolation — LazyStore Shared State

**What goes wrong:** Store tests bleed state between test cases because the global `stores` Map in the setup mock persists across tests in the same file.

**Why it happens:** The `LazyStore` mock shares backing Maps across instances with the same filename within a test run.

**How to avoid:** In `tempo-filters.store.test.ts`, call `LazyStore.clearStore('tempo-filters.json')` (or the equivalent `stores.delete` approach) in `beforeEach`, or use `vi.resetModules()` to reset the Zustand store between tests. Pattern: check how `pinned-tabs.store.test.ts` handles this.

---

## Code Examples

### TempoFilter Type

```typescript
// Source: CONTEXT.md D-02
import type { DatePreset } from '../routes/worklogs/WorklogsPage';
// DatePreset is currently defined locally in WorklogsPage.tsx — either
// export it from WorklogsPage or re-declare it in the store.

export interface TempoFilter {
  id: string;
  name: string;
  preset: DatePreset;
  username: string | null;
  displayName: string | null;
}
// Note: customFrom/customTo intentionally omitted (D-02)
```

### ID Generation

```typescript
// Source: CONTEXT.md specifics — crypto.randomUUID() is available in Tauri WebView
const id = crypto.randomUUID();
```

The `window.crypto.getRandomValues` polyfill is already in `src/test/setup.ts` — `crypto.randomUUID()` is also available via the same `window.crypto` object in jsdom 20+.

### DatePreset Export

The `DatePreset` type is currently declared locally inside `WorklogsPage.tsx` as a module-level type (line 27). To use it in `tempo-filters.store.ts`, either:
- Option A: Add `export` keyword to the type in `WorklogsPage.tsx` and import it in the store.
- Option B: Re-declare the identical union type in the store (duplication risk — prefer Option A).

**Recommendation:** Export from `WorklogsPage.tsx`. The type is the same 6-member union in both files.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jira saved filters: session-only, reload from API on each launch | Tempo saved filters: persist via LazyStore, no API round-trip | Phase 63 (new feature) | Simpler — no API save/load; filters are local to the app |
| discoverCustomFields: returns 5 fields | discoverCustomFields: returns 6 fields (added flaggedFieldKey) | Phase 62/63 boundary | Test expectations must include flaggedFieldKey |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `crypto.randomUUID()` is available in the Tauri WebView without polyfill | Code Examples | ID generation fails silently; use `Date.now() + Math.random()` fallback instead |
| A2 | `DatePreset` can be exported from WorklogsPage.tsx without creating circular imports | Code Examples | Store cannot import the type; must re-declare it locally in the store |

**Note:** The LazyStore mock availability in tests is VERIFIED — confirmed by reading `src/test/setup.ts` directly. The `window.crypto.getRandomValues` polyfill is in setup.ts but `crypto.randomUUID()` availability is ASSUMED (it delegates to `node:crypto`'s `randomFillSync`, not `randomUUID`).

---

## Open Questions

1. **`crypto.randomUUID()` in jsdom/setup.ts**
   - What we know: `setup.ts` polyfills `window.crypto.getRandomValues` using Node's `randomFillSync`. `crypto.randomUUID()` may not be on the same patched object.
   - What's unclear: Whether `crypto.randomUUID()` works in the test environment.
   - Recommendation: Use `Date.now().toString(36) + Math.random().toString(36).slice(2)` as ID if `crypto.randomUUID()` is unavailable, or test it first. The vitest config uses `environment: 'jsdom'` — jsdom 21+ includes `crypto.randomUUID()`.

2. **DatePreset export impact**
   - What we know: `DatePreset` is currently file-local in `WorklogsPage.tsx`. The store needs it.
   - What's unclear: Whether there are other files importing WorklogsPage that would be affected.
   - Recommendation: Export it — it's a simple string union type, no side effects.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 63 is a pure code/store/test change. No new external tools, services, CLIs, runtimes, or databases are introduced.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm test -- --reporter=verbose` |
| Full suite command | `cd taskflow && npm test -- --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEMPO-04 | Save a named filter combining preset + person | unit | `npm test -- WorklogsPage` | ✅ (extend WorklogsPage.test.tsx) |
| TEMPO-04 | Store addFilter persists to LazyStore | unit | `npm test -- tempo-filters` | ❌ Wave 0 — create tempo-filters.store.test.ts |
| TEMPO-05 | Load a saved filter applies preset + username to page state | unit | `npm test -- WorklogsPage` | ✅ (extend WorklogsPage.test.tsx) |
| TEMPO-05 | Rename: double-click pill → inline input → commit | unit | `npm test -- WorklogsPage` | ✅ (extend WorklogsPage.test.tsx) |
| TEMPO-05 | Delete: × button removes filter from store | unit | `npm test -- WorklogsPage` | ✅ (extend WorklogsPage.test.tsx) |
| QUAL-01 | Full test suite passes zero failures | suite | `npm test` | ✅ (confirmed 1300 tests, 2 currently failing) |
| QUAL-02 | No widget/workload dead imports remain | manual+grep | `grep -rn "widget\|workload" src/` | N/A — grep audit confirmed clean |

### Sampling Rate
- **Per task commit:** `cd taskflow && npm test -- --reporter=verbose` (full suite, 7–10 sec)
- **Per wave merge:** `cd taskflow && npm test -- --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/stores/tempo-filters.store.test.ts` — covers TEMPO-04 store-level (addFilter, removeFilter, renameFilter, persist behavior)

*(All other test coverage is built by extending existing files)*

---

## Security Domain

Security enforcement is not applicable to this phase. The changes are:
- A Zustand store writing user-chosen filter names to a local Tauri app-data file.
- WorklogsPage UI additions (no new network calls, no auth changes).
- Test expectation updates (no production code).
- Dead code sweep (deletions only).

No new attack surface is introduced. The `tempo-filters.json` file is written to the Tauri app data directory (sandboxed by the OS), not to a network endpoint.

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/stores/pinned-tabs.store.ts` — direct structural template for `tempo-filters.store.ts`
- `taskflow/src/lib/tauri-storage.ts` — `createTauriStorage` factory implementation
- `taskflow/src/test/setup.ts` — LazyStore mock implementation (confirms zero setup needed for new store)
- `taskflow/src/routes/worklogs/WorklogsPage.tsx` — existing component state and filter bar structure
- `taskflow/src/routes/worklogs/WorklogsPage.test.tsx` — existing test file to extend
- `taskflow/src/services/jira.test.ts` lines 908–936 — the 2 failing tests (confirmed by live run)
- `taskflow/src/services/jira.ts` lines 1309–1359 — `discoverCustomFields` implementation returning 6-key object
- `.planning/phases/63-tempo-saved-filters-test-pass/63-UI-SPEC.md` — design contract for all new UI elements
- `.planning/phases/63-tempo-saved-filters-test-pass/63-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- `taskflow/src/stores/saved-filter.store.ts` — Jira saved filter store shape (reference for naming conventions)
- `taskflow/src/components/SavedFilterList.tsx` — inline delete pattern (v1.5, × on hover without modal)

### Tertiary (LOW confidence)
- A1 (crypto.randomUUID jsdom availability) — ASSUMED; confirmed `getRandomValues` polyfill exists but `randomUUID` availability not checked against jsdom version

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in package.json, versions verified
- Architecture: HIGH — store pattern verified from source, UI-SPEC approved, test structure confirmed
- Pitfalls: HIGH — most pitfalls discovered by direct code reading (LazyStore mock, missing `group` class, empty-name guard)
- Test fix: HIGH — confirmed by running `npm test` and observing exact failure output

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable domain — Zustand/Tauri APIs not in active churn)
