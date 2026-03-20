# Phase 28: Test Coverage, Performance & Accessibility - Research

**Researched:** 2026-03-20
**Domain:** Unit testing (Vitest), list virtualization (@tanstack/react-virtual), ARIA accessibility
**Confidence:** HIGH

## Summary

Phase 28 covers three distinct workstreams: (1) comprehensive unit tests for 12 Jira service modules and 6 Zustand stores, (2) virtualizing three long-scrolling lists with @tanstack/react-virtual, and (3) adding ARIA labels to form inputs and proper roles to custom dropdowns.

The project already has strong test conventions established in Phase 26 -- `vi.mock('@tauri-apps/plugin-http')` for service tests, `vi.mock('@tauri-apps/plugin-store')` for store tests, and `renderHook` with `act` for Zustand state testing. All 12 Jira modules follow an identical pattern (apiFetch wrapper, error handling with ApiError, response parsing) making the test templates highly repeatable. The 6 stores divide into persisted (auth, pinned-tabs) and transient (breadcrumb, debug-log, filter, onboarding), with persistence round-trip testing only needed for the two that use `createTauriStorage`.

For virtualization, @tanstack/react-virtual v3.13.23 is the current release. The three target components (BacklogPage, SprintBoardTab, NotificationPopover) all use `.map()` to render item lists, making the integration points clear. The sprint board is the most complex case due to DndContext + swimlane structure.

**Primary recommendation:** Sequence as tests -> virtualization -> accessibility. Tests validate pre-change behavior, virtualization modifies rendering, accessibility is additive.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Library: **@tanstack/react-virtual** for virtualization (consistent with TanStack Query ecosystem)
- Lists to virtualize: notification list, backlog list, sprint board columns
- All 6 requirements (TEST-01, TEST-02, PERF-01, PERF-02, A11Y-01, A11Y-02) are required -- no deprioritization
- Coverage depth: happy path + at least one error case per module (matches success criteria exactly)
- All 12 Jira modules tested equally -- no prioritization by size
- 6 untested stores: auth, breadcrumb, debug-log, filter, onboarding, pinned-tabs
- 12 untested Jira modules: backlog, client, comments, epics, fields, issues, links, projects, sprints, transitions, versions, worklogs

### Claude's Discretion
- Old jira.test.ts migration strategy
- Test file organization (colocated vs centralized)
- Sprint board virtualization architecture
- Notification list virtualization scope (page only vs page + popover)
- PERF-02 memoization pattern
- A11y scope beyond the two specified components
- Automated a11y testing tooling
- Sequencing of tests -> perf -> a11y work
- Plan count and boundaries
- Commit structure

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | All service modules (jira, gitlab, notifications) have unit tests covering happy path and error cases | Existing test patterns in gitlab.test.ts and notifications.test.ts; 12 new Jira module test files needed following identical apiFetch mock pattern |
| TEST-02 | All Zustand stores have unit tests covering state transitions and persistence | Existing patterns in notifications.store.test.ts and recent-items.store.test.ts; 6 new store test files; persistence round-trips for auth + pinned-tabs |
| PERF-01 | Notification list, backlog list, and sprint board use virtualization for 100+ items | @tanstack/react-virtual v3.13.23; three components identified with clear .map() integration points |
| PERF-02 | Unread count selectors memoized (no Set creation on every render) | useUnreadCount creates new Set(readIds) on every call; needs Zustand equality function or cached derived state |
| A11Y-01 | All form inputs in CreateEditIssueModal and ConnectionsSection have proper aria labels | Currently 4 aria-labels across both components; inputs for summary, description, assignee, story points, time estimate, parent key, epic filter all missing aria-label or htmlFor association |
| A11Y-02 | Custom dropdowns use semantic HTML or proper ARIA roles | Epic link picker and assignee picker are hand-built dropdowns without listbox/option roles; @base-ui/react Select components already have proper ARIA |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.0.18 | Test runner | Already installed and configured; all 489 existing tests use it |
| @testing-library/react | 16.3.2 | Component testing | Already installed; used by all existing component tests |
| @tanstack/react-virtual | 3.13.23 | List virtualization | Locked decision; consistent with TanStack Query ecosystem already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/jest-dom | 6.9.1 | DOM matchers | Already installed; provides toBeInTheDocument, toHaveAttribute etc. |
| @testing-library/user-event | 14.6.1 | User interaction simulation | Already installed; for a11y interaction tests if needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vitest-axe | Manual aria assertions | vitest-axe v0.1.0 is very new (low adoption); manual RTL assertions (toHaveAttribute('aria-label', ...)) are more reliable and already established in this codebase |
| react-window | @tanstack/react-virtual | Locked decision; react-window is older and less maintained |

**Installation:**
```bash
cd taskflow && npm install @tanstack/react-virtual
```

**Version verification:** @tanstack/react-virtual 3.13.23 confirmed via npm registry 2026-03-20.

## Architecture Patterns

### Recommended Test File Organization
```
src/
  services/
    jira/
      backlog.ts
      backlog.test.ts        # Colocated with module
      comments.ts
      comments.test.ts
      ...
    jira.test.ts             # Archive: rename to jira.legacy.test.ts or delete
  stores/
    auth.store.ts
    auth.store.test.ts       # Colocated with store
    ...
```

**Recommendation:** Colocate test files next to source files. This matches the existing pattern for store tests (notifications.store.test.ts, settings.store.test.ts, recent-items.store.test.ts) and is the Vitest convention.

### Pattern 1: Jira Module Service Test
**What:** Mock @tauri-apps/plugin-http, test happy path + error case for each exported function
**When to use:** All 12 Jira modules + client.ts

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchComments, postComment } from './comments';

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

// IMPORTANT: import mock AFTER vi.mock declaration
import { fetch as mockFetch } from '@tauri-apps/plugin-http';

// Also mock apiFetch since modules use it (which wraps plugin-http fetch)
vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));
import { apiFetch as mockApiFetch } from '../../lib/apiFetch';

describe('comments module', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('fetchComments returns comments array on success', async () => {
    vi.mocked(mockApiFetch).mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ comments: [{ id: '1', body: 'test' }] }),
    } as unknown as Response);

    const result = await fetchComments('https://jira.example.com', 'token', 'PROJ-1');
    expect(result).toEqual([{ id: '1', body: 'test' }]);
  });

  it('fetchComments throws on 401', async () => {
    vi.mocked(mockApiFetch).mockResolvedValue({
      ok: false, status: 401,
    } as unknown as Response);

    await expect(fetchComments('https://jira.example.com', 'token', 'PROJ-1'))
      .rejects.toThrow();
  });
});
```

**Key insight:** The Jira modules use `apiFetch` (from `../../lib/apiFetch`), not `@tauri-apps/plugin-http` directly. The mock target is `apiFetch`, not `fetch`. The existing `jira.test.ts` mocks `@tauri-apps/plugin-http` because the old monolith jira.ts imported fetch directly. After Phase 27 decomposition, each module imports `apiFetch` instead.

### Pattern 2: Zustand Store Test (Persisted)
**What:** Test state transitions via getState/setState + persistence round-trip via LazyStore mock
**When to use:** auth.store, pinned-tabs.store (both use createTauriStorage)

```typescript
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    private data = new Map<string, unknown>();
    get = vi.fn(async (key: string) => this.data.get(key) ?? null);
    set = vi.fn(async (key: string, value: unknown) => { this.data.set(key, value); });
    save = vi.fn(async () => {});
    delete = vi.fn(async (key: string) => { this.data.delete(key); });
  }
  return { LazyStore };
});

import { useAuthStore } from './auth.store';

describe('auth.store', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.setState({
        jiraConnected: false,
        gitlabConnected: false,
        jiraBaseUrl: null,
        // ... reset all fields
      });
    });
  });

  it('setJiraConnected toggles jiraConnected and updates baseUrl', () => {
    act(() => { useAuthStore.getState().setJiraConnected(true, 'https://jira.example.com'); });
    const s = useAuthStore.getState();
    expect(s.jiraConnected).toBe(true);
    expect(s.jiraBaseUrl).toBe('https://jira.example.com');
  });
});
```

### Pattern 3: Zustand Store Test (Transient / No Persist)
**What:** Test state transitions only (no persistence round-trip needed)
**When to use:** breadcrumb.store, debug-log.store, filter.store, onboarding.store

```typescript
import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useBreadcrumbStore } from './breadcrumb.store';

describe('breadcrumb.store', () => {
  beforeEach(() => {
    act(() => { useBreadcrumbStore.setState({ trail: [] }); });
  });

  it('push appends entry to trail', () => {
    act(() => { useBreadcrumbStore.getState().push({ path: '/dashboard', label: 'Dashboard' }); });
    expect(useBreadcrumbStore.getState().trail).toHaveLength(1);
  });
});
```

### Pattern 4: @tanstack/react-virtual Integration
**What:** Replace `.map()` rendering with useVirtualizer
**When to use:** BacklogPage, NotificationPopover, SprintBoardTab columns

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

function VirtualizedList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // estimated row height in px
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ overflow: 'auto', height: '100%' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
              height: `${virtualItem.size}px`,
            }}
          >
            <ItemRow item={items[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Pattern 5: PERF-02 Memoized Selector with Zustand Equality
**What:** Prevent new Set creation on every render in useUnreadCount
**Recommendation:** Use Zustand's `useStore(selector, equalityFn)` with shallow equality, or cache the derived count inside the store itself.

**Option A: Cached derived state (recommended)**
```typescript
// Inside notifications.store.ts -- add a computed unreadCount field
// that updates only when items or readIds change:
interface NotificationsState {
  // ... existing fields
  _unreadCount: number; // cached derived value
}

// Update _unreadCount in setItems, prependItems, markAsRead, markAllRead
// Then the selector is trivial: (s) => s._unreadCount
```

**Option B: Zustand shallow equality**
```typescript
import { useShallow } from 'zustand/react/shallow';

export const useUnreadCount = () =>
  useNotificationsStore(
    useShallow((s) => {
      const readSet = new Set(s.readIds);
      return s.items.filter((i) => !readSet.has(i.id)).length;
    })
  );
```
Note: `useShallow` compares the return value shallowly. Since the return is a number, this means it will only re-render when the count changes, but will still create the Set on every store update. For true memoization, Option A (cached derived state) avoids Set creation entirely.

### Anti-Patterns to Avoid
- **Mocking the wrong layer:** Jira modules import `apiFetch`, not `@tauri-apps/plugin-http` directly. Mock `../../lib/apiFetch` for module tests.
- **Not resetting store state between tests:** Always `setState` to defaults in `beforeEach`. Zustand stores are singletons -- state leaks between tests without explicit reset.
- **Fixed height assumptions in virtualizer:** Use `estimateSize` with a reasonable default but allow dynamic measurement via `measureElement` for variable-height rows.
- **Breaking DnD with virtualization:** Sprint board uses @dnd-kit. Virtualizing removes DOM nodes not in viewport, which can break drag overlays. Use `overscan` generously and ensure DragOverlay renders outside the virtualized container.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| List virtualization | Custom windowing/IntersectionObserver | @tanstack/react-virtual | Edge cases: dynamic heights, scroll restoration, momentum scrolling, overscan tuning |
| ARIA for Select/Dropdown | Manual role attributes on custom selects | @base-ui/react Select primitives | @base-ui/react already provides proper listbox/option roles, keyboard navigation, focus management |
| Test mock for LazyStore | Ad-hoc per-test mocking | Global mock in setup.ts | Already solved in Phase 26; reuse the in-memory Map-based mock |
| Scroll performance testing | Manual FPS measurement | Browser DevTools + visual inspection | Success criteria says "no visible scroll jank" -- subjective, not automatable |

**Key insight:** The @base-ui/react Select component already includes ARIA roles (listbox, option, combobox). Only the hand-built epic link picker and assignee autocomplete in CreateEditIssueModal need manual ARIA role additions. The ConnectionsSection uses standard `<input>` elements that just need aria-label attributes.

## Common Pitfalls

### Pitfall 1: Mocking apiFetch vs plugin-http
**What goes wrong:** Tests mock `@tauri-apps/plugin-http` but Jira modules import `apiFetch` from `../../lib/apiFetch`, which wraps plugin-http. The mock never intercepts.
**Why it happens:** The old monolith jira.ts imported fetch directly. After Phase 27 decomposition, the import chain changed.
**How to avoid:** Mock `../../lib/apiFetch` for Jira module tests. Check each module's import to confirm.
**Warning signs:** Tests pass but never actually exercise the module code (mock resolves but function behavior isn't tested).

### Pitfall 2: Zustand Singleton State Leaking Between Tests
**What goes wrong:** Test A modifies store state, Test B inherits that state and gets unexpected results.
**Why it happens:** Zustand stores are module-level singletons. `vi.mock` does not create fresh instances per test.
**How to avoid:** Always `useXStore.setState(defaultState)` in `beforeEach`. For persisted stores, the mock LazyStore should also be fresh.
**Warning signs:** Tests pass individually (`vitest run path/to/file`) but fail when run as part of full suite.

### Pitfall 3: Virtualizer Breaking DnD on Sprint Board
**What goes wrong:** Dragging a card scrolls the column, virtualizer removes the drag source from DOM, DnD context loses track.
**Why it happens:** Virtualization unmounts items outside viewport. @dnd-kit expects drag source to remain mounted.
**How to avoid:** Use DragOverlay (already present in SprintBoardTab) to render dragged item independently. Set adequate `overscan` (5-10 items). Consider virtualizing within each column independently rather than the whole board.
**Warning signs:** Drag works for visible items but breaks when dragging from items near viewport edge.

### Pitfall 4: htmlFor vs aria-label Confusion
**What goes wrong:** Labels exist visually but aren't programmatically associated with inputs.
**Why it happens:** `<label>` without `htmlFor` and `<input>` without `id` creates a visual label with no a11y association.
**How to avoid:** Use `<label htmlFor="unique-id">` + `<input id="unique-id">` OR wrap input inside label. For inputs without visible labels, use `aria-label`.
**Warning signs:** Biome a11y warnings (already at warn level since Phase 25).

### Pitfall 5: Variable Row Heights with Virtualizer
**What goes wrong:** Items with different content heights overlap or leave gaps.
**Why it happens:** `estimateSize` provides a static guess. If actual sizes vary significantly, layout breaks.
**How to avoid:** Pass `measureElement` callback to `useVirtualizer` for dynamic measurement. Use `virtualItem.measureElement` ref on each rendered item.
**Warning signs:** Sprint board cards with long titles overlap shorter ones.

## Code Examples

### Virtualizing BacklogPage Issue List
```typescript
// In BacklogPage section rendering, replace:
//   {filteredIssues.map((issue) => <BacklogRow ... />)}
// With:

import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);
const rowVirtualizer = useVirtualizer({
  count: filteredIssues.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 44, // BacklogRow approximate height
  overscan: 10,
});

// Render:
<div ref={parentRef} className="overflow-auto" style={{ height: 'calc(100vh - offset)' }}>
  <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
      const issue = filteredIssues[virtualRow.index];
      return (
        <div
          key={issue.key}
          ref={virtualRow.measureElement}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualRow.start}px)`,
          }}
        >
          <BacklogRow issue={issue} ... />
        </div>
      );
    })}
  </div>
</div>
```

### Adding ARIA to Epic Link Custom Dropdown
```typescript
// The epic picker in CreateEditIssueModal is a hand-built dropdown.
// Add listbox/option roles:

{state.epicOpen && (
  <div className="rounded-md border shadow-sm">
    <input
      value={state.epicFilter}
      onChange={...}
      placeholder="Filter epics..."
      role="combobox"
      aria-expanded={true}
      aria-controls="epic-listbox"
      aria-label="Filter epics"
    />
    <div role="listbox" id="epic-listbox" className="max-h-48 overflow-y-auto">
      <button role="option" ...>None</button>
      {filteredEpics.map((epic) => (
        <button key={epic.key} role="option" aria-selected={state.epicLinkKey === epic.key} ...>
          {epic.key} {epic.fields.summary}
        </button>
      ))}
    </div>
  </div>
)}
```

### Adding aria-label to Form Inputs
```typescript
// Summary input -- already has a visible <label>, needs htmlFor/id association:
<label htmlFor="issue-summary" className="text-sm font-medium">Summary</label>
<Input id="issue-summary" value={state.summary} ... />

// Or for inputs where label is implied by context, use aria-label:
<Input aria-label="Issue summary" value={state.summary} ... />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-virtualized | @tanstack/react-virtual | 2022+ | Smaller bundle, hooks-based, framework-agnostic core |
| react-window | @tanstack/react-virtual | 2023+ | More flexible API, better TypeScript support, active maintenance |
| jest-axe | vitest-axe or manual assertions | 2024+ | vitest-axe exists but v0.1.0; manual RTL assertions are more reliable |
| aria-role on every element | Semantic HTML + library primitives | Always | @base-ui/react handles ARIA for Select; only hand-built widgets need manual roles |

## Open Questions

1. **Sprint board virtualization depth**
   - What we know: SprintBoardTab has DndContext wrapping the entire board, with swimlanes containing cards in three columns. Each column is a droppable zone.
   - What's unclear: Whether virtualizing within columns works smoothly with @dnd-kit's droppable zones, or if the entire swimlane row needs to be the virtualization unit.
   - Recommendation: Start by virtualizing the swimlane rows (story groups), keeping all cards within a visible swimlane fully rendered. This preserves DnD within a swimlane and only virtualizes across swimlanes. Simpler and less risky than per-column virtualization.

2. **Notification virtualization scope**
   - What we know: NotificationPopover renders inside a popover (fixed max-height) and also used in a full-page context.
   - What's unclear: Whether the popover's content area is tall enough to benefit from virtualization, or if only the full-page view needs it.
   - Recommendation: Virtualize the full list rendering (shared between popover and page). The popover has max-height constraints that may show 10-20 items; virtualization still helps if the user has 200+ notifications because DOM node count stays constant.

3. **Old jira.test.ts handling**
   - What we know: 489 tests pass across 42 files, with jira.test.ts being the monolith from pre-Phase-27.
   - What's unclear: How many of those 489 tests live in jira.test.ts specifically and whether they'll be redundant with the new per-module tests.
   - Recommendation: Keep jira.test.ts as-is initially. Write new per-module tests. After all new tests pass, assess overlap and archive/remove jira.test.ts if fully covered.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | taskflow/vitest.config.ts |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | Jira service modules have unit tests (happy + error) | unit | `cd taskflow && npx vitest run src/services/jira/ -x` | No -- 12 new files needed in Wave 0 |
| TEST-01 | GitLab service has tests | unit | `cd taskflow && npx vitest run src/services/gitlab.test.ts -x` | Yes -- already exists |
| TEST-01 | Notifications service has tests | unit | `cd taskflow && npx vitest run src/services/notifications.test.ts -x` | Yes -- already exists |
| TEST-02 | 6 stores have unit tests (state + persistence) | unit | `cd taskflow && npx vitest run src/stores/ -x` | Partial -- 3 exist, 6 new files needed |
| PERF-01 | Virtualized lists render 200+ items without jank | manual-only | Visual inspection with 200+ items in dev | N/A -- manual verification |
| PERF-02 | Selectors memoized (no Set per render) | unit | `cd taskflow && npx vitest run src/stores/notifications.store.test.ts -x` | Yes -- extend existing |
| A11Y-01 | Form inputs have aria labels | unit | `cd taskflow && npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx src/routes/settings/ConnectionsSection.test.tsx -x` | Yes -- extend existing |
| A11Y-02 | Custom dropdowns have ARIA roles | unit | `cd taskflow && npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx -x` | Yes -- extend existing |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green + all 5 success criteria verified before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/services/jira/backlog.test.ts` -- covers TEST-01 (backlog module)
- [ ] `src/services/jira/client.test.ts` -- covers TEST-01 (client module)
- [ ] `src/services/jira/comments.test.ts` -- covers TEST-01 (comments module)
- [ ] `src/services/jira/epics.test.ts` -- covers TEST-01 (epics module)
- [ ] `src/services/jira/fields.test.ts` -- covers TEST-01 (fields module)
- [ ] `src/services/jira/issues.test.ts` -- covers TEST-01 (issues module)
- [ ] `src/services/jira/links.test.ts` -- covers TEST-01 (links module)
- [ ] `src/services/jira/projects.test.ts` -- covers TEST-01 (projects module)
- [ ] `src/services/jira/sprints.test.ts` -- covers TEST-01 (sprints module)
- [ ] `src/services/jira/transitions.test.ts` -- covers TEST-01 (transitions module)
- [ ] `src/services/jira/versions.test.ts` -- covers TEST-01 (versions module)
- [ ] `src/services/jira/worklogs.test.ts` -- covers TEST-01 (worklogs module)
- [ ] `src/stores/auth.store.test.ts` -- covers TEST-02 (auth store + persistence)
- [ ] `src/stores/breadcrumb.store.test.ts` -- covers TEST-02 (breadcrumb store)
- [ ] `src/stores/debug-log.store.test.ts` -- covers TEST-02 (debug-log store)
- [ ] `src/stores/filter.store.test.ts` -- covers TEST-02 (filter store)
- [ ] `src/stores/onboarding.store.test.ts` -- covers TEST-02 (onboarding store)
- [ ] `src/stores/pinned-tabs.store.test.ts` -- covers TEST-02 (pinned-tabs store + persistence)
- [ ] `@tanstack/react-virtual` package install -- needed for PERF-01

## Sources

### Primary (HIGH confidence)
- Codebase inspection: all 42 existing test files, 12 Jira modules, 6 untested stores, vitest.config.ts, package.json
- Existing test patterns: gitlab.test.ts, notifications.test.ts, notifications.store.test.ts, recent-items.store.test.ts, settings.store.test.ts
- Component inspection: BacklogPage.tsx, SprintBoardTab.tsx, NotificationPopover.tsx, CreateEditIssueModal.tsx, ConnectionsSection.tsx

### Secondary (MEDIUM confidence)
- npm registry: @tanstack/react-virtual v3.13.23 (verified 2026-03-20)
- npm registry: vitest-axe v0.1.0 (verified but LOW adoption -- not recommended)
- @base-ui/react Select primitives include ARIA roles (verified via select.tsx wrapper code)

### Tertiary (LOW confidence)
- Sprint board + virtualization + DnD interaction: no verified documentation on this specific combination. Recommendation based on architectural reasoning.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use or verified on npm
- Architecture (testing): HIGH - existing patterns are clear and consistent
- Architecture (virtualization): MEDIUM - straightforward for lists, uncertain for sprint board + DnD
- Architecture (accessibility): HIGH - form inputs are standard; custom dropdowns identified
- Pitfalls: HIGH - drawn from codebase analysis and established testing patterns

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable domain, no fast-moving dependencies)
