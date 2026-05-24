# Phase 65: Tech Debt Cleanup - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 7 (files to modify in phase 65; tauri-storage.ts excluded per D-07)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/routes/worklogs/WorklogsPage.tsx` | component | request-response | `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` | role-match |
| `taskflow/src/lib/aioUtils.ts` | utility | request-response | `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` (lines 32–41) | pattern-match |
| `taskflow/src/services/aio/cycles.ts` | service | request-response | self (line 335 map, line 435 fetch function) | self-edit |
| `taskflow/src/services/tempo/types.ts` | model (types) | — | self (existing TempoWorklog export pattern) | self-edit |
| `taskflow/src/stores/tempo-filters.store.ts` | store | CRUD | self (line 4 import to fix) | self-edit |
| `taskflow/src/components/app/Sidebar.test.tsx` | test | — | self (line 79 mock to remove) | self-edit |
| `taskflow/src/lib/aioUtils.test.ts` | test | — | `taskflow/src/lib/aioUtils.test.ts` (existing, needs describe-block replacement) | self-edit |

---

## Pattern Assignments

### `taskflow/src/routes/worklogs/WorklogsPage.tsx` — CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04

**Analog:** self (all changes are in-place surgical edits)

#### CLEAN-01: useEffect cleanup for closeTimer

**Current closeTimer declaration** (line 306):
```typescript
const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**Current set/clear pattern** (lines 658–667):
```typescript
function handleComboboxFocus() {
  if (closeTimer.current) clearTimeout(closeTimer.current);
  setQuery('');
  setOpen(true);
}

function handleComboboxBlur() {
  closeTimer.current = setTimeout(() => setOpen(false), 150);
}
```

**Pattern to add — cleanup useEffect** (insert after existing useEffects near line 327):
```typescript
useEffect(() => {
  return () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
  };
}, []);
```

**Analog reference:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` uses `useEffect` with empty deps and cleanup return (lines 3–4 show `useEffect` import; React docs pattern — zero external deps).

---

#### CLEAN-02: Error state condition

**Current condition** (line 951):
```tsx
{isError && !data ? (
  <ErrorState error={error} onRetry={refetch} viewName="worklogs" />
```

**Target condition** (replace `isError && !data` with `isError`):
```tsx
{isError ? (
  <ErrorState error={error} onRetry={refetch} viewName="worklogs" />
```

**Context — ErrorState already imported** (line 40):
```typescript
import { ErrorState } from '@/components/ui/error-state';
```

---

#### CLEAN-03: Keyed fragments

**Site 1 — line 1050** (epic iterator outer return):
```tsx
// BEFORE:
return (
  <>
    {/* Epic row */}
    <tr key={`epic-${epicKey}`} ...>
```

```tsx
// AFTER:
return (
  <React.Fragment key={epicKey}>
    {/* Epic row */}
    <tr ...>
```

**Site 2 — line 1129** (story iterator return inside epic map):
```tsx
// BEFORE:
return (
  <>
    <tr key={`story-${storyKey}`} className="cursor-pointer group/row">
```

```tsx
// AFTER:
return (
  <React.Fragment key={storyKey}>
    <tr className="cursor-pointer group/row">
```

**Site 3 — line 1238** (closing `</>` of the story-level fragment that wraps the story `<tr>` and subtask rows — key = `storyKey`):
```tsx
// BEFORE:
        </>
      );
    })}
  </>    {/* ← this is the epic-level closing from site 1 */}
```

```tsx
// AFTER:
        </React.Fragment>   {/* story-level, key=storyKey, closes site 2 */}
      );
    })}
  </React.Fragment>          {/* epic-level, key=epicKey, closes site 1 */}
```

Note: `React` must already be in scope. Verify line 29 import — current import is `import { useEffect, useMemo, useRef, useState } from 'react'`. If `React` namespace is not separately imported, add `import React from 'react'` or change to `import React, { useEffect, useMemo, useRef, useState } from 'react'`.

---

#### CLEAN-04: DatePreset type move (remove export from this file, add import)

**Current declaration** (lines 53–59):
```typescript
export type DatePreset =
  | 'this-week'
  | 'last-week'
  | 'this-month'
  | 'last-month'
  | 'last-working-day'
  | 'custom';
```

**After move — replace the `export type` block with an import**:
```typescript
import type { DatePreset } from '@/services/tempo/types';
```

---

### `taskflow/src/services/tempo/types.ts` — CLEAN-04 (add DatePreset)

**Analog:** self — existing `TempoWorklog` export sets the pattern (lines 1–44).

**Current file** ends at `export interface TempoWorklog { ... }` (line 44). The existing export pattern:
```typescript
/**
 * A single Tempo Timesheets worklog entry.
 * ...
 */
export interface TempoWorklog {
  ...
}
```

**Addition to append to the file**:
```typescript
/**
 * Date preset options for the Worklogs page date range picker.
 * Moved from WorklogsPage.tsx (CLEAN-04) — stores must import from service types,
 * not from route components.
 */
export type DatePreset =
  | 'this-week'
  | 'last-week'
  | 'this-month'
  | 'last-month'
  | 'last-working-day'
  | 'custom';
```

---

### `taskflow/src/stores/tempo-filters.store.ts` — CLEAN-04 (fix import path)

**Current import** (line 4):
```typescript
import type { DatePreset } from '../routes/worklogs/WorklogsPage';
```

**Target import**:
```typescript
import type { DatePreset } from '../services/tempo/types';
```

No other changes to this file.

---

### `taskflow/src/components/app/Sidebar.test.tsx` — CLEAN-05 (remove stale mock entry)

**Current mock array** (lines 71–83, 11 items):
```typescript
sidebarItems: [
  { id: 'dashboard', visible: true },
  { id: 'my-tasks', visible: true },
  { id: 'sprint-board', visible: true },
  { id: 'backlog', visible: true },
  { id: 'epics', visible: true },
  { id: 'merge-requests', visible: true },
  { id: 'sprint-progress', visible: true },
  { id: 'workload', visible: true },      // ← line 79: REMOVE THIS ENTRY
  { id: 'releases', visible: true },
  { id: 'worklogs', visible: true },
  { id: 'aio-projects', visible: true },
],
```

**Target** (10 items, `workload` entry removed):
```typescript
sidebarItems: [
  { id: 'dashboard', visible: true },
  { id: 'my-tasks', visible: true },
  { id: 'sprint-board', visible: true },
  { id: 'backlog', visible: true },
  { id: 'epics', visible: true },
  { id: 'merge-requests', visible: true },
  { id: 'sprint-progress', visible: true },
  { id: 'releases', visible: true },
  { id: 'worklogs', visible: true },
  { id: 'aio-projects', visible: true },
],
```

---

### `taskflow/src/services/aio/cycles.ts` — CLEAN-06, CLEAN-07 (fetchAioProjectConfig reuse)

**Analog:** self

#### CLEAN-06: TESTCASE_STATUS_MAP additions

**Current map** (lines 335–340):
```typescript
const TESTCASE_STATUS_MAP: Record<number, string> = {
  53: 'PASS',
  901: 'PASS',
  54: 'FAIL',
  55: 'BLOCKED',
};
```

**Target map** (add IDs 51 and 52 at the top):
```typescript
const TESTCASE_STATUS_MAP: Record<number, string> = {
  51: 'NOT_EXECUTED',
  52: 'IN_PROGRESS',
  53: 'PASS',
  901: 'PASS',
  54: 'FAIL',
  55: 'BLOCKED',
};
```

Note: `TESTCASE_STATUS_MAP` is file-private (no export). `chipStatusFromId` at line 342 already falls back to `'NOT_EXECUTED'` for unknown IDs — the new entries make explicit what was previously fallback behavior.

#### CLEAN-07: fetchAioProjectConfig — no change needed, just reuse

The function already exists and is already exported (line 435):
```typescript
export async function fetchAioProjectConfig(
  baseUrl: string,
  token: string,
  jiraProjectId: number,
): Promise<AioTestRunStatusConfig[]> {
  const path = `/project/${jiraProjectId}/config?c_pId=${jiraProjectId}&t=${Date.now()}`;
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path, 'Load AIO Cycles', AIO_PROJECTS_API_PATH);
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    const data = (await response.json()) as { testRunStatus?: AioTestRunStatusConfig[] };
    return data.testRunStatus ?? [];
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    return [];
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}
```

`aioUtils.ts` must import this function from `@/services/aio` (or `@/services/aio/cycles`) rather than duplicating the HTTP call.

---

### `taskflow/src/lib/aioUtils.ts` — CLEAN-07 (dynamic map)

**Analog:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` lines 32–41 — the `STATUS_TYPE_MAP` + `buildStatusMap` pattern already established there:

```typescript
// AioProjectOverviewPage.tsx lines 32–41 (ANALOG TO COPY):
type StatusKey = 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress';
const STATUS_TYPE_MAP: Record<string, StatusKey> = {
  PASSED: 'pass',
  FAILED: 'fail',
  BLOCKED: 'blocked',
  NOT_RUN: 'notRun',
  IN_PROGRESS: 'inProgress',
};

function buildStatusMap(statuses: AioTestRunStatusConfig[]): Record<number, StatusKey> {
  return Object.fromEntries(statuses.map((s) => [s.ID, STATUS_TYPE_MAP[s.statusType] ?? 'notRun']));
}
```

**Target state for `aioUtils.ts`** — replace the static `AIO_STATUS_MAP` constant (lines 55–63) with:

```typescript
import { fetchAioProjectConfig } from '@/services/aio/cycles';
import type { AioTestRunStatusConfig } from '@/services/aio/types';

// Module-level runtime cache — populated by initializeAioStatusMap()
// Replaces the removed static AIO_STATUS_MAP constant.
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
      statuses.map((s) => [s.ID, STATUS_TYPE_MAP[s.statusType] ?? 'notRun']),
    );
  } catch {
    // Fail silently — normalizeStatusById falls back to 'notRun'
    runtimeAioStatusMap = {};
  }
}
```

**`normalizeStatusById` updated** (line 70 currently reads `AIO_STATUS_MAP[id]`):
```typescript
export function normalizeStatusById(
  id: number,
): 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress' {
  return runtimeAioStatusMap[id] ?? 'notRun';
}
```

**Call site — `AioProjectOverviewPage.tsx`** (add side-effect to `configQuery` when data resolves):

Analog: `AioProjectOverviewPage.tsx` lines 294–301 already fetches `/config` and builds a local `statusMap` via `useMemo`. The `initializeAioStatusMap` call should be a `useEffect` watching `configQuery.data`, co-located immediately after the `statusMap` memo:

```typescript
// After line 301 (statusMap memo) in AioProjectOverviewPage.tsx:
useEffect(() => {
  if (configQuery.data && jiraBaseUrl && token && jiraProjectId) {
    void initializeAioStatusMap(jiraBaseUrl, token, jiraProjectId);
  }
}, [configQuery.data, jiraBaseUrl, token, jiraProjectId]);
```

This avoids a duplicate HTTP call because `initializeAioStatusMap` calls `fetchAioProjectConfig` independently, but React Query caches the result — the network call will be served from React Query's cache (same `queryKey`). Alternatively, the planner may choose to pass `configQuery.data` directly into a synchronous init helper instead of re-fetching. The simplest correct approach is calling `initializeAioStatusMap` directly and letting React Query handle deduplication.

**`AioCycleDetailPage.tsx` — consumer migration** (line 26 import + line 454 usage):

```typescript
// BEFORE (line 26):
import { AIO_STATUS_MAP, normalizeStatus, normalizeStatusLabel } from '@/lib/aioUtils';

// AFTER:
import { normalizeStatus, normalizeStatusLabel, normalizeStatusById } from '@/lib/aioUtils';
```

```typescript
// BEFORE (line 454):
const statusKey = AIO_STATUS_MAP[Number(idStr)] ?? 'notRun';

// AFTER:
const statusKey = normalizeStatusById(Number(idStr));
```

---

### `taskflow/src/lib/aioUtils.test.ts` — CLEAN-07 test update

**Analog:** existing file structure (lines 1–121) — keep `normalizeStatus` and `normalizeStatusLabel` describe blocks unchanged; replace the `AIO_STATUS_MAP` describe block (lines 63–87) and update the `normalizeStatusById` describe block (lines 89–121).

**Current broken describe block** (lines 63–87, tests a constant that will be removed):
```typescript
describe('AIO_STATUS_MAP', () => {
  it('maps status ID 51 to "notRun"', () => {
    expect(AIO_STATUS_MAP[51]).toBe('notRun');
  });
  // ... 5 more tests
});
```

**Target replacement — test `initializeAioStatusMap`**:
```typescript
import { vi } from 'vitest';
// mock fetchAioProjectConfig so tests don't make HTTP calls
vi.mock('@/services/aio/cycles', () => ({
  fetchAioProjectConfig: vi.fn(),
}));
import { fetchAioProjectConfig } from '@/services/aio/cycles';

describe('initializeAioStatusMap + normalizeStatusById', () => {
  it('populates the runtime map from config response', async () => {
    vi.mocked(fetchAioProjectConfig).mockResolvedValue([
      { ID: 53, statusType: 'PASSED', name: 'Pass' },
      { ID: 54, statusType: 'FAILED', name: 'Fail' },
      { ID: 55, statusType: 'BLOCKED', name: 'Blocked' },
      { ID: 51, statusType: 'NOT_RUN', name: 'Not Run' },
      { ID: 52, statusType: 'IN_PROGRESS', name: 'In Progress' },
    ]);
    await initializeAioStatusMap('https://jira.example.com', 'token', 10000);
    expect(normalizeStatusById(53)).toBe('pass');
    expect(normalizeStatusById(54)).toBe('fail');
    expect(normalizeStatusById(55)).toBe('blocked');
    expect(normalizeStatusById(51)).toBe('notRun');
    expect(normalizeStatusById(52)).toBe('inProgress');
  });

  it('falls back to "notRun" for unknown ID after init', async () => {
    expect(normalizeStatusById(999)).toBe('notRun');
  });

  it('falls back to empty map (all notRun) when fetchAioProjectConfig throws', async () => {
    vi.mocked(fetchAioProjectConfig).mockRejectedValue(new Error('network'));
    await initializeAioStatusMap('https://jira.example.com', 'token', 10000);
    expect(normalizeStatusById(53)).toBe('notRun');
  });
});
```

Import line to update at top of test file — remove `AIO_STATUS_MAP`, add `initializeAioStatusMap`:
```typescript
// BEFORE (lines 1–7):
import { describe, expect, it } from 'vitest';
import {
  AIO_STATUS_MAP,
  normalizeStatus,
  normalizeStatusById,
  normalizeStatusLabel,
} from './aioUtils';

// AFTER:
import { describe, expect, it, vi } from 'vitest';
import {
  initializeAioStatusMap,
  normalizeStatus,
  normalizeStatusById,
  normalizeStatusLabel,
} from './aioUtils';
```

---

## Shared Patterns

### AIO HTTP fetch pattern
**Source:** `taskflow/src/services/aio/cycles.ts` lines 435–458
**Apply to:** `initializeAioStatusMap` in `aioUtils.ts` (via reuse of `fetchAioProjectConfig` — do not duplicate)
```typescript
export async function fetchAioProjectConfig(
  baseUrl: string,
  token: string,
  jiraProjectId: number,
): Promise<AioTestRunStatusConfig[]> {
  // ... aioFetch call with Bearer PAT, AIO_PROJECTS_API_PATH base
  // Returns [] on 404, throws ApiError on 401, throws Error on other failures
}
```

### Status-type-to-canonical-key mapping
**Source:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` lines 32–41
**Apply to:** `aioUtils.ts` module-level `STATUS_TYPE_MAP` constant
```typescript
const STATUS_TYPE_MAP: Record<string, StatusKey> = {
  PASSED: 'pass',
  FAILED: 'fail',
  BLOCKED: 'blocked',
  NOT_RUN: 'notRun',
  IN_PROGRESS: 'inProgress',
};
```

### React Query + useEffect side-effect pattern
**Source:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` lines 294–301
**Apply to:** Call site for `initializeAioStatusMap` in `AioProjectOverviewPage.tsx`
```typescript
const configQuery = useQuery({
  queryKey: ['aio', jiraBaseUrl, 'project-config', projectKey],
  queryFn: () => fetchAioProjectConfig(jiraBaseUrl!, token!, jiraProjectId!),
  enabled: aioGate,
  staleTime: 60 * 60 * 1000,
});

const statusMap = useMemo(() => buildStatusMap(configQuery.data ?? []), [configQuery.data]);
// Add initializeAioStatusMap side-effect here, watching configQuery.data
```

### Service types export pattern
**Source:** `taskflow/src/services/tempo/types.ts` lines 1–44
**Apply to:** `DatePreset` addition to `types.ts`
```typescript
/**
 * [JSDoc description]
 */
export type TypeName = ...;
```

### Store import from service types (not route files)
**Source:** `taskflow/src/stores/tempo-filters.store.ts` lines 1–4 (the inversion to fix)
**Apply to:** All future store files — import types from `../services/*/types`, never from `../routes/**/*`
```typescript
// Correct pattern (target state after CLEAN-04):
import type { DatePreset } from '../services/tempo/types';
```

---

## No Analog Found

All files have close analogs or are self-edits. No files require falling back to RESEARCH.md patterns exclusively.

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| — | — | — | All covered |

---

## Metadata

**Analog search scope:** `taskflow/src/routes/`, `taskflow/src/lib/`, `taskflow/src/services/aio/`, `taskflow/src/stores/`, `taskflow/src/components/`
**Files scanned:** 10 (WorklogsPage.tsx, aioUtils.ts, aioUtils.test.ts, cycles.ts, AioProjectOverviewPage.tsx, AioCycleDetailPage.tsx, types.ts, tempo-filters.store.ts, Sidebar.test.tsx, aioUtils.test.ts)
**Pattern extraction date:** 2026-05-23
