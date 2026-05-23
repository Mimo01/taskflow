# Phase 65: Tech Debt Cleanup - Research

**Researched:** 2026-05-23
**Domain:** React cleanup, TypeScript type architecture, AIO dynamic status mapping
**Confidence:** HIGH

## Summary

Phase 65 is a pure debt-payment phase targeting 7 specific, line-addressable items across 6 files. No new UI surfaces, no new routes, no new dependencies. Every fix is surgical — the largest change (CLEAN-07) is a refactor of `aioUtils.ts` plus one call-site update in `AioCycleDetailPage.tsx`.

The items fall into three clusters: (1) React correctness bugs in `WorklogsPage.tsx` (CLEAN-01, CLEAN-02, CLEAN-03), (2) a type-architecture inversion where a store imports from a route file (CLEAN-04), and (3) AIO-related fixes in `cycles.ts` and `aioUtils.ts` (CLEAN-05 sidebar test, CLEAN-06 status map entry, CLEAN-07 dynamic config).

A pre-condition must be completed before any phase-65 tasks run: commit the pending `tauri-storage.ts` + `tauri-storage.test.ts` changes as a standalone commit. These files are already modified in the working tree (confirmed in git status) and must not be mixed into phase-65 commits.

**Primary recommendation:** One plan, ~7 atomic tasks in dependency order. No external packages needed. Build verification is `npm run build` (not just `tsc`) per STATE.md mandate.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**CLEAN-02: WorklogsPage error state condition**
- D-01: Replace `isError && !data` with `isError` alone. Show `ErrorState` whenever a fetch fails, regardless of what's in React Query's cache. No separate error banner — replace the view entirely.

**CLEAN-07: AIO status map — fully dynamic**
- D-02: Remove the hardcoded `AIO_STATUS_MAP` constant entirely. Do not keep a static seed map.
- D-03: When AIO integration activates, call the existing `/config` endpoint (`GET /rest/aio-tcms/1.0/project/{jiraProjectId}/config`) and build the status map at runtime from the response.
- D-04: Cache the built map at module scope in `aioUtils.ts` (a module-level `let` variable). `normalizeStatusById` reads the runtime map.
- D-05: If `/config` fails or is unavailable, the map is empty — all IDs fall back to `'notRun'` via the existing unknown-ID fallback in `normalizeStatusById`. No crash, no hardcoded entries.
- D-06: The existing `/config` fetch function in `cycles.ts` (line ~430) should be used or adapted as the source. Do not duplicate the HTTP call.

**Pending tauri-storage.ts fix**
- D-07: Commit the uncommitted `tauri-storage.ts` + `tauri-storage.test.ts` changes as a standalone commit BEFORE phase 65 work begins. Phase 65 plans must NOT include these files.

### Claude's Discretion

- CLEAN-01 (useEffect cleanup for closeTimer), CLEAN-03 (keyed fragments), CLEAN-04 (DatePreset move), CLEAN-05 (stale test mock removal), CLEAN-06 (TESTCASE_STATUS_MAP entries) — all clear-cut from requirements; no implementation choice needed beyond what REQUIREMENTS.md specifies.
- The AIO integration activation hook (where to call `initializeAioStatusMap`) should use whatever the existing AIO initialization pathway is — the planner should identify the call site.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLEAN-01 | Add `useEffect` cleanup for `closeTimer.current` setTimeout in `WorklogsPage.tsx` | Line 306 `closeTimer` ref; lines 658/667 set/clear pattern confirmed; needs return cleanup in a new `useEffect` |
| CLEAN-02 | Show `ErrorState` on network errors after a cached-empty result (replace `isError && !data` with `isError`) | Line 951 confirmed; `ErrorState` already imported; one-line change |
| CLEAN-03 | Replace unkeyed `<></>` fragments at lines 1050/1129/~1240 with `<React.Fragment key={...}>` | All three sites confirmed; epic key, story key, implicit (subtask-level wrapper) |
| CLEAN-04 | Move `DatePreset` type from `WorklogsPage.tsx:53` to `src/services/tempo/types.ts`; update all imports | `tempo-filters.store.ts` line 4 imports from route file (architectural inversion confirmed); `types.ts` has no DatePreset yet |
| CLEAN-05 | Remove stale `{ id: 'workload', visible: true }` mock entry at `Sidebar.test.tsx:79` | Line 79 confirmed; 11 items in mock array; workload is the stale item to remove |
| CLEAN-06 | Add IDs 51 (NOT_EXECUTED) and 52 (IN_PROGRESS) to `TESTCASE_STATUS_MAP` in `cycles.ts:335` | Line 335 confirmed; map currently has 53/901/54/55 only; chipStatusFromId falls back to 'NOT_EXECUTED' for missing IDs |
| CLEAN-07 | Make `AIO_STATUS_MAP` dynamic — fetch from `/config` at activation time, cache at module scope | Full plan in Locked Decisions above; `fetchAioProjectConfig` already exists in `cycles.ts:435`; call site identified as AIO activation path |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| closeTimer cleanup (CLEAN-01) | Frontend component | — | Side-effect lifecycle owned by the React component that sets the timer |
| Error state rendering (CLEAN-02) | Frontend component | — | UI state derived from React Query result; no API layer change |
| Fragment keying (CLEAN-03) | Frontend component | — | React reconciler concern in JSX map callbacks |
| Type export location (CLEAN-04) | Service types layer | Store | `stores/` must import from `services/*/types.ts`; never from route components |
| Stale test mock (CLEAN-05) | Test file | — | Test infrastructure cleanup only |
| TESTCASE_STATUS_MAP (CLEAN-06) | Service layer | — | `cycles.ts` owns the AIO test-case mapping |
| Dynamic AIO status map (CLEAN-07) | Lib utilities (`aioUtils.ts`) | Service layer (`cycles.ts`) | Shared utility reads from module cache; `cycles.ts` provides the fetch function |

## Standard Stack

No new packages in this phase. All work uses existing dependencies.

### Existing Stack (relevant to this phase)
| Library | Purpose | Relevance |
|---------|---------|-----------|
| React 18 (`useEffect`, `useRef`) | Component lifecycle | CLEAN-01 timer cleanup |
| `@tanstack/react-query` | Server state | CLEAN-02 `isError`/`data` flags |
| `React.Fragment` with `key` prop | List rendering | CLEAN-03 keyed fragments |
| Vitest | Test framework | CLEAN-05 test cleanup, CLEAN-07 test update |
| TypeScript | Type safety | CLEAN-04 type move, build verification |

**Installation:** No new packages required.

## Package Legitimacy Audit

No external packages being added in this phase. Section not applicable.

## Architecture Patterns

### Data Flow: CLEAN-07 Dynamic AIO Status Map

```
AIO activation (settings toggle ON + project selected)
       |
       v
initializeAioStatusMap(jiraBaseUrl, token, jiraProjectId)
  — calls fetchAioProjectConfig (already in cycles.ts:435)
  — receives AioTestRunStatusConfig[]
  — maps: ID → STATUS_TYPE_MAP[statusType] ?? 'notRun'
  — writes to module-level cache: runtimeAioStatusMap
       |
       v
normalizeStatusById(id)
  reads runtimeAioStatusMap[id] ?? 'notRun'
       |
       v
AioCycleDetailPage (line 454)
  AIO_STATUS_MAP[Number(idStr)] → must be migrated to normalizeStatusById(Number(idStr))
```

### Recommended Project Structure (no changes to structure)

All modifications are in-place edits to existing files:

```
taskflow/src/
├── routes/worklogs/WorklogsPage.tsx     # CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04 (remove export)
├── services/tempo/types.ts              # CLEAN-04 (add DatePreset export)
├── stores/tempo-filters.store.ts        # CLEAN-04 (update import path)
├── components/app/Sidebar.test.tsx      # CLEAN-05 (remove workload mock entry)
├── services/aio/cycles.ts              # CLEAN-06 (TESTCASE_STATUS_MAP)
└── lib/aioUtils.ts                      # CLEAN-07 (remove static map, add runtime cache + init)
```

### Pattern 1: useEffect Cleanup for setTimeout (CLEAN-01)
**What:** Return a cleanup function from `useEffect` to clear pending timers when the component unmounts.
**When to use:** Whenever a `useRef<ReturnType<typeof setTimeout>>` is set inside an event handler — the handler may fire after unmount.

```typescript
// Source: [ASSUMED] — React docs pattern; confirmed applicable by code inspection
useEffect(() => {
  return () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
  };
}, []);
```

Note: `closeTimer.current` is set in `handleComboboxBlur` (line 667). The cleanup effect needs no dependencies — it only runs the cleanup on unmount.

### Pattern 2: React.Fragment with key (CLEAN-03)
**What:** The shorthand `<></>` cannot receive a `key` prop. Use `<React.Fragment key={...}>` when the fragment is the outermost return of a `.map()` callback.
**When to use:** Any `.map()` where two or more sibling elements are returned inside a wrapper.

```tsx
// Source: [ASSUMED] — React documentation; standard fix for this warning
// BEFORE (generates key warning):
return (
  <>
    <EpicRow key={...} />
    {storyRows}
  </>
);

// AFTER:
return (
  <React.Fragment key={epicKey}>
    <EpicRow />
    {storyRows}
  </React.Fragment>
);
```

The three sites in WorklogsPage:
- Line 1050: outer epic iterator — key = `epicKey`
- Line 1129: inner story iterator — key = `storyKey`
- Line ~1238: subtask wrapper inside story iterator — this is the `</>` at line 1238 wrapping the story `<tr>` and the subtask rows map; key = `storyKey` (same as the story row level)

### Pattern 3: Type export from service layer (CLEAN-04)
**What:** Types used across the store layer must live in `services/*/types.ts`, not route components.
**When to use:** Any type that a store imports from a route file (architectural inversion).

```typescript
// Source: [ASSUMED] — established project convention (STATE.md, CONTEXT.md)
// In src/services/tempo/types.ts — ADD:
export type DatePreset =
  | 'this-week'
  | 'last-week'
  | 'this-month'
  | 'last-month'
  | 'last-working-day'
  | 'custom';

// In WorklogsPage.tsx — CHANGE export to import:
import type { DatePreset } from '@/services/tempo/types';
// Remove the local `export type DatePreset = ...` block

// In tempo-filters.store.ts — UPDATE import:
import type { DatePreset } from '../services/tempo/types';
// Was: import type { DatePreset } from '../routes/worklogs/WorklogsPage';
```

### Pattern 4: Module-level runtime cache (CLEAN-07)
**What:** A module-level `let` variable serves as a singleton cache for the AIO status map, populated by an exported init function called at integration activation.
**When to use:** When a value is fetched once at startup and read by multiple consumers synchronously.

```typescript
// Source: [ASSUMED] — per D-02 through D-06 in CONTEXT.md; AioProjectOverviewPage.tsx
//   already demonstrates the build-status-map pattern at lines 40-42.

// In aioUtils.ts:

// Module-level cache (replaces AIO_STATUS_MAP constant)
let runtimeAioStatusMap: Record<number, 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress'> = {};

const STATUS_TYPE_MAP: Record<string, 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress'> = {
  PASSED: 'pass',
  FAILED: 'fail',
  BLOCKED: 'blocked',
  NOT_RUN: 'notRun',
  IN_PROGRESS: 'inProgress',
};

/**
 * Initialize AIO status map from live /config endpoint.
 * Call once when AIO integration activates (credentials confirmed, project selected).
 * Silently no-ops on failure — normalizeStatusById falls back to 'notRun'.
 */
export async function initializeAioStatusMap(
  baseUrl: string,
  token: string,
  jiraProjectId: number,
): Promise<void> {
  try {
    const statuses = await fetchAioProjectConfig(baseUrl, token, jiraProjectId);
    runtimeAioStatusMap = Object.fromEntries(
      statuses.map((s) => [s.ID, STATUS_TYPE_MAP[s.statusType] ?? 'notRun'])
    );
  } catch {
    // Fail silently — normalizeStatusById falls back to 'notRun'
    runtimeAioStatusMap = {};
  }
}

export function normalizeStatusById(
  id: number,
): 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress' {
  return runtimeAioStatusMap[id] ?? 'notRun';
}
```

**Call site:** The planner must identify where AIO is activated. Based on code inspection, `IntegrationsSection.tsx` calls `setAioEnabled` when the toggle is checked. However, `initializeAioStatusMap` needs credentials (token, jiraProjectId). The most robust call site is `AioProjectOverviewPage.tsx` — it already fetches from `/config` via a React Query call (line 294–299). The planner has two options:
1. Call `initializeAioStatusMap` as a side-effect inside `AioProjectOverviewPage`'s config query `onSuccess` (or in a `useEffect` watching `configQuery.data`).
2. Keep `AioProjectOverviewPage` using its local `buildStatusMap` for its own rendering, and separately call `initializeAioStatusMap` — but this double-fetches `/config`.

The DRY approach: `AioCycleDetailPage.tsx` line 454 uses `AIO_STATUS_MAP` directly (static). After CLEAN-07, it must call `normalizeStatusById` instead. The init still needs a call site. The planner should note that `AioProjectOverviewPage` has `jiraProjectId` and the token in scope at query time and is the natural place to call `initializeAioStatusMap` as a side-effect when `configQuery.data` resolves. This avoids a duplicate HTTP call.

### Anti-Patterns to Avoid

- **Not cleaning up timers:** Do not rely on component teardown alone — `closeTimer.current = setTimeout(...)` in an event handler will fire after unmount if not explicitly cleared. (CLEAN-01)
- **`isError && !data` over-filtering:** React Query caches stale data. If a retry fails after a previously-successful empty response, `data` is `[]` (truthy empty array), not `undefined`. The old condition suppresses the error display. (CLEAN-02)
- **Shorthand fragments in keyed lists:** `<></>` does not accept `key`. React will log a key warning for every render cycle. (CLEAN-03)
- **Store importing from route file:** `stores/` → `routes/` import direction is an architectural inversion that creates circular dependency risk and violates the service-layer boundary. (CLEAN-04)
- **Hardcoded AIO status IDs:** Different AIO plugin versions or instances may use different numeric IDs. Only `statusType` (string, stable across versions) is safe to rely on. (CLEAN-07)
- **Double-fetching `/config`:** `AioProjectOverviewPage` already fetches `/config`. `initializeAioStatusMap` should reuse that data (via side-effect on query result) rather than making a second independent call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timer cleanup | Custom cleanup queue | `useEffect` return function | Standard React pattern; runs synchronously on unmount |
| Status type normalization | Additional switch/case | `STATUS_TYPE_MAP` lookup (already in `AioProjectOverviewPage.tsx:32-38`) | Pattern already established in the codebase |

## Runtime State Inventory

> Not applicable — this is a code-only cleanup phase with no renames, data migrations, or stored string changes.

None — verified by phase scope inspection. CLEAN-07 changes behavior of `normalizeStatusById` at runtime but stores no strings externally.

## Common Pitfalls

### Pitfall 1: Forgetting `AIO_STATUS_MAP` usages in `AioCycleDetailPage.tsx`
**What goes wrong:** `aioUtils.ts` no longer exports `AIO_STATUS_MAP` after CLEAN-07, but `AioCycleDetailPage.tsx` line 26 imports it and line 454 uses it directly.
**Why it happens:** The static map is exported and consumed in two places — removing it without updating all consumers breaks the build.
**How to avoid:** After removing `AIO_STATUS_MAP` from `aioUtils.ts`, update `AioCycleDetailPage.tsx` to use `normalizeStatusById(Number(idStr))` at line 454 and remove the `AIO_STATUS_MAP` named import.
**Warning signs:** TypeScript error `Module '"@/lib/aioUtils"' has no exported member 'AIO_STATUS_MAP'`.

### Pitfall 2: `aioUtils.test.ts` tests reference the static `AIO_STATUS_MAP`
**What goes wrong:** `aioUtils.test.ts` has 6 tests in the `AIO_STATUS_MAP` describe block (lines 63–87) and 8 tests in the `normalizeStatusById` describe block (lines 89–121). After removing the static constant, all `AIO_STATUS_MAP` tests will fail (the export no longer exists), and the `normalizeStatusById` tests will fail because the runtime map is empty until `initializeAioStatusMap` is called.
**Why it happens:** The test file was written against a static constant.
**How to avoid:** Replace `AIO_STATUS_MAP` describe block tests with tests for `initializeAioStatusMap` (mock `fetchAioProjectConfig`, call init, then assert `normalizeStatusById` returns correct values). Keep the "unknown ID falls back to notRun" tests — they remain valid.
**Warning signs:** `vitest run` failures on `aioUtils.test.ts` after the CLEAN-07 code change.

### Pitfall 3: CLEAN-03 fragment key scope — subtask level
**What goes wrong:** Lines 1050 and 1129 are clear (epic and story map callbacks). The third fragment at line ~1238 is the closing `</>` inside the story map callback that wraps the story `<tr>` and the subtask rows. This is keyed at the story level, so `storyKey` is the correct key — not `subtaskKey`.
**Why it happens:** Nested maps — the subtask rows are inside the story fragment, which needs the key.
**How to avoid:** Key the fragment returned by the story `.map()` with `storyKey` (same key that appears on the `<tr key={story-${storyKey}}>` inside it).

### Pitfall 4: Build verification must use `npm run build`, not `tsc --noEmit`
**What goes wrong:** `npm run build` = `tsc && vite build`. Vite build catches CSS import failures and certain module resolution issues that `tsc --noEmit` misses. STATE.md records this lesson explicitly from Phase 59.
**Why it happens:** `tsc` only type-checks; Vite's bundler enforces actual module resolution.
**How to avoid:** Final verification step is always `npm run build` inside `/taskflow/`.

### Pitfall 5: CLEAN-04 — `WorklogsPage.tsx` still needs to use `DatePreset` locally
**What goes wrong:** After moving the type to `types.ts`, the `export type DatePreset = ...` block in `WorklogsPage.tsx` is removed and replaced with an import. Forgetting the import leaves `DatePreset` undefined in the component file.
**Why it happens:** Copy-move refactor — delete old, add import, easy to forget one step.
**How to avoid:** The plan task should explicitly: (1) add export to `types.ts`, (2) add import to `WorklogsPage.tsx`, (3) remove local type declaration from `WorklogsPage.tsx`, (4) update import in `tempo-filters.store.ts`.

### Pitfall 6: CLEAN-06 — clarifying `TESTCASE_STATUS_MAP` vs `AIO_STATUS_MAP`
**What goes wrong:** Confusing the two maps. `TESTCASE_STATUS_MAP` in `cycles.ts` maps IDs to raw string labels like `'PASS'`, `'FAIL'`. `AIO_STATUS_MAP` in `aioUtils.ts` maps IDs to canonical status keys like `'pass'`, `'fail'`. These are different representations.
**Why it happens:** Similar purpose, different file, different output format.
**How to avoid:** CLEAN-06 adds to `TESTCASE_STATUS_MAP` in `cycles.ts`: `51: 'NOT_EXECUTED'` and `52: 'IN_PROGRESS'`. These are raw string labels matching the `chipStatusFromId` return convention (NOT the `aioUtils.ts` canonical format).

## Code Examples

### CLEAN-01: useEffect cleanup
```typescript
// Source: React docs pattern [ASSUMED]; line 306 WorklogsPage.tsx for ref declaration
// Add after the existing useEffect blocks in WorklogsPage:
useEffect(() => {
  return () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
  };
}, []);
```

### CLEAN-02: Error state condition
```typescript
// Source: Line 951 WorklogsPage.tsx [VERIFIED by code inspection]
// BEFORE:
{isError && !data ? (
  <ErrorState error={error} onRetry={refetch} viewName="worklogs" />
// AFTER:
{isError ? (
  <ErrorState error={error} onRetry={refetch} viewName="worklogs" />
```

### CLEAN-06: TESTCASE_STATUS_MAP additions
```typescript
// Source: Lines 335-340 cycles.ts [VERIFIED by code inspection]
// BEFORE:
const TESTCASE_STATUS_MAP: Record<number, string> = {
  53: 'PASS',
  901: 'PASS',
  54: 'FAIL',
  55: 'BLOCKED',
};

// AFTER:
const TESTCASE_STATUS_MAP: Record<number, string> = {
  51: 'NOT_EXECUTED',
  52: 'IN_PROGRESS',
  53: 'PASS',
  901: 'PASS',
  54: 'FAIL',
  55: 'BLOCKED',
};
```

### CLEAN-07: AioCycleDetailPage migration
```typescript
// Source: Line 454 AioCycleDetailPage.tsx [VERIFIED by code inspection]
// BEFORE:
import { AIO_STATUS_MAP, normalizeStatus, normalizeStatusLabel } from '@/lib/aioUtils';
// ...
const statusKey = AIO_STATUS_MAP[Number(idStr)] ?? 'notRun';

// AFTER:
import { normalizeStatus, normalizeStatusLabel, normalizeStatusById } from '@/lib/aioUtils';
// ...
const statusKey = normalizeStatusById(Number(idStr));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static `AIO_STATUS_MAP` with hardcoded IDs | Runtime map from `/config` endpoint | Phase 65 (CLEAN-07) | Handles non-standard AIO instances; eliminates version-drift bug where 52 rendered as notRun |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `useEffect(() => { return () => cleanup }, [])` is the correct pattern for timer cleanup on unmount | Code Examples: CLEAN-01 | Low risk — this is fundamental React; no API change in React 18 |
| A2 | `initializeAioStatusMap` should be called from `AioProjectOverviewPage` side-effect on configQuery.data | Pattern 4 call site | Medium — if the planner chooses a different call site, behavior is equivalent but the init may be called less often |
| A3 | CLEAN-03 third fragment (line ~1238) uses `storyKey` as the key | Anti-Patterns | Low — verified by reading nested map structure; storyKey is the enclosing map variable |

## Open Questions

1. **Where exactly to call `initializeAioStatusMap` (CLEAN-07)**
   - What we know: `AioProjectOverviewPage` already fetches `/config` via React Query (line 294); `AioCycleDetailPage` uses `AIO_STATUS_MAP` directly
   - What's unclear: Whether calling init as a `useEffect` side-effect on `configQuery.data` in `AioProjectOverviewPage` is the right home, or whether it should live in a more central initialization path
   - Recommendation: The planner should use the `AioProjectOverviewPage` `configQuery.data` `useEffect` approach — it avoids a duplicate HTTP call, runs when credentials and projectId are confirmed, and is co-located with the existing `/config` consumer. The module cache persists for the session.

2. **Whether `AIO_STATUS_MAP` tests in `aioUtils.test.ts` should be updated or deleted**
   - What we know: Tests at lines 63–87 test a constant that will be removed; tests at lines 89–121 test `normalizeStatusById` which will now return `'notRun'` for all IDs until init runs
   - What's unclear: Whether planner expects the executor to update the test file as part of CLEAN-07 or leave it for a separate test cleanup
   - Recommendation: CLEAN-07 task should include updating `aioUtils.test.ts` — replace the `AIO_STATUS_MAP` describe block with tests for `initializeAioStatusMap` (mock the fetch, verify the resulting `normalizeStatusById` behavior). This keeps the test suite green.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — code-only cleanup, no new tools or services required).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `taskflow/vite.config.ts` (or implicit) |
| Quick run command | `cd taskflow && npm test` |
| Full suite command | `cd taskflow && npm test && npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLEAN-01 | closeTimer cleared on unmount | unit | `cd taskflow && npm test -- WorklogsPage` | ✅ `WorklogsPage.test.tsx` |
| CLEAN-02 | ErrorState renders when isError regardless of data | unit | `cd taskflow && npm test -- WorklogsPage` | ✅ `WorklogsPage.test.tsx` |
| CLEAN-03 | No React fragment key warnings in hierarchy table | unit (render) | `cd taskflow && npm test -- WorklogsPage` | ✅ `WorklogsPage.test.tsx` |
| CLEAN-04 | `tsc` and `npm run build` pass with updated imports | build | `cd taskflow && npm run build` | ✅ (no new test needed) |
| CLEAN-05 | `Sidebar.test.tsx` has no `workload` reference; test count unchanged | unit | `cd taskflow && npm test -- Sidebar` | ✅ `Sidebar.test.tsx` |
| CLEAN-06 | testRunStatusID 52 maps to IN_PROGRESS chip | unit | `cd taskflow && npm test -- aioUtils` | ✅ `aioUtils.test.ts` (needs update) |
| CLEAN-07 | `normalizeStatusById` returns correct values after `initializeAioStatusMap` | unit | `cd taskflow && npm test -- aioUtils` | ✅ `aioUtils.test.ts` (needs update) |

### Sampling Rate
- **Per task commit:** `cd taskflow && npm test`
- **Per wave merge:** `cd taskflow && npm test && npm run build`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- `aioUtils.test.ts` exists but needs its `AIO_STATUS_MAP` describe block replaced with `initializeAioStatusMap` tests (CLEAN-07). This is part of the CLEAN-07 task, not a pre-existing gap.

## Security Domain

No security-relevant changes in this phase. All changes are: timer cleanup, error state condition, fragment keying, type import path, test mock removal, status map entries, and dynamic fetch initialization. No auth, session, cryptography, or input validation changes.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of all 7 target files and their test counterparts — line numbers confirmed
- `65-CONTEXT.md` — all locked decisions verified against actual code
- `REQUIREMENTS.md` — acceptance criteria cross-referenced with code

### Secondary (MEDIUM confidence)
- `STATE.md` — `npm run build` mandate (Phase 59 decision)
- `aioUtils.test.ts` — identified tests that will break under CLEAN-07 and must be updated

### Tertiary (LOW confidence)
- A1, A2, A3 in Assumptions Log — React patterns from training data, not verified via Context7 for this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing
- Architecture: HIGH — every file and line number verified by direct code inspection
- Pitfalls: HIGH — derived from actual code reading, not speculation

**Research date:** 2026-05-23
**Valid until:** 2026-06-23 (stable codebase; no external API dependencies)
