# Phase 61: Tempo Probe + Service Layer - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/services/tempo/client.ts` | service/utility | request-response | `taskflow/src/services/aio/client.ts` | exact |
| `taskflow/src/services/tempo/types.ts` | model | — | `taskflow/src/services/aio/types.ts` | exact |
| `taskflow/src/services/tempo/worklogs.ts` | service | CRUD/paginated | `taskflow/src/services/aio/cycles.ts` | exact |
| `taskflow/src/services/tempo/index.ts` | config/barrel | — | `taskflow/src/services/aio/index.ts` | exact |
| `taskflow/src/services/tempo/client.test.ts` | test | request-response | `taskflow/src/services/aio/client.test.ts` | exact |
| `taskflow/src/services/tempo/worklogs.test.ts` | test | CRUD/paginated | `taskflow/src/services/aio/cycles.test.ts` | exact |
| `taskflow/src/stores/settings.store.ts` | store (modify) | CRUD | `taskflow/src/stores/settings.store.ts` | self (additive edit) |
| `taskflow/src/routes/settings/IntegrationsSection.tsx` | component (modify) | request-response | `taskflow/src/routes/settings/IntegrationsSection.tsx` | self (additive edit) |
| `taskflow/src/routes/settings/IntegrationsSection.test.tsx` | test (modify) | — | `taskflow/src/routes/settings/IntegrationsSection.test.tsx` | self (additive edit) |

---

## Pattern Assignments

### `taskflow/src/services/tempo/client.ts` (service/utility, request-response)

**Analog:** `taskflow/src/services/aio/client.ts`

**File header/doc-block pattern** (lines 1–18):
```typescript
/**
 * Shared AIO TCMS API client helpers — fetch wrapper, base path constants.
 *
 * This module is imported by domain modules (projects, cycles, runs) but is NOT
 * re-exported from the barrel index.ts. Its exports are internal to aio/.
 *
 * Two base paths are exported (D-13: Phase 51 probe confirmed both are needed):
 *   AIO_PROJECTS_API_PATH — project listing endpoints only
 *   AIO_API_PATH           — all other endpoints (cycles, test runs, test cases)
 */
```
Adapt: single `TEMPO_API_PATH` constant (D-06), probe-confirmation comment replacing the dual-path note.

**Imports pattern** (line 12):
```typescript
import { apiFetch } from '../../lib/apiFetch';
```
Identical — `tempoFetch` uses the same `apiFetch` wrapper.

**API path constant and probe comment** (lines 14–17):
```typescript
// KEY DECISION (Phase 51 probe): confirmed against live AIO instance — see .planning/phases/51-aio-service-layer/51-CONTEXT.md D-13
// Two base paths required — not one. Project listing uses a different servlet than cycles/runs.
export const AIO_PROJECTS_API_PATH = '/rest/aio-tcms/1.0';
export const AIO_API_PATH = '/rest/aio-tcms-api/1.0';
```
Adapt to:
```typescript
// KEY DECISION (Phase 61 probe): confirmed against live Jira DC instance — see .planning/phases/61-tempo-probe-service-layer/61-CONTEXT.md D-06
// Probe result: /rest/tempo-timesheets/4/ returned <STATUS>; /rest/tempo-timesheets/3/ returned <STATUS>
export const TEMPO_API_PATH = '/rest/tempo-timesheets/4'; // set from probe result
```

**Core fetch function** (lines 36–58):
```typescript
export async function aioFetch(
  baseUrl: string,
  token: string,
  path: string,
  operation: string,
  apiPath: string = AIO_API_PATH,
  init?: { method?: string; body?: string },
): Promise<Response> {
  const url = `${baseUrl.replace(/\/$/, '')}${apiPath}${path}`;
  return apiFetch(
    'aio',
    url,
    {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      ...(init?.body !== undefined ? { body: init.body } : {}),
    },
    operation,
  );
}
```
Adapt: rename `aioFetch` → `tempoFetch`, `AIO_API_PATH` → `TEMPO_API_PATH`. Source label stays `'aio'` (critical — see Shared Patterns: apiFetch Source Label).

---

### `taskflow/src/services/tempo/types.ts` (model)

**Analog:** `taskflow/src/services/aio/types.ts`

**File structure/doc-block pattern** (lines 1–11):
```typescript
/**
 * Shared AIO TCMS type definitions used across all domain modules.
 *
 * This file is the single source of truth for all AIO REST API response
 * shapes. Domain modules import from here; they never define their own
 * interfaces for AIO entities.
 *
 * Interface field names are derived from AIO REST API docs:
 * ...
 * and from D-16/D-17 probe findings in ...
 */
```
Adapt: reference Phase 61 probe findings and CONTEXT.md D-09.

**Paginated envelope pattern** (lines 69–74):
```typescript
export interface AioPage<T> {
  items: T[];
  startAt: number;
  maxResults: number;
  isLast: boolean;
}
```
Tempo equivalent must be written after probe confirms envelope shape. Defensive union (per RESEARCH.md):
```typescript
export interface TempoPaginatedResponse {
  worklogs?: TempoWorklog[];   // DC v4 shape (likely)
  results?: TempoWorklog[];    // alternative field name
  metadata?: {
    count: number;
    offset: number;
    limit: number;
  };
  // AioPage-style alternative
  items?: TempoWorklog[];
  isLast?: boolean;
}
```

**Entity interface pattern** (lines 18–22, AioProject as structural model):
```typescript
export interface AioProject {
  id: number;
  projectKey: string;
  name: string;
}
```
Adapt to `TempoWorklog` with probe-confirmed fields (minimum per D-09):
```typescript
export interface TempoWorklog {
  tempoWorklogId: number;
  jiraWorklogId: number;
  issue: { key: string };
  author: { name: string } | string;  // confirm from probe — DC may return plain string
  timeSpentSeconds: number;
  startDate: string;   // YYYY-MM-DD — always .slice(0, 10), never new Date()
  description?: string;
  startTime?: string;
}
```

---

### `taskflow/src/services/tempo/worklogs.ts` (service, CRUD/paginated)

**Analog:** `taskflow/src/services/aio/cycles.ts`

**Imports pattern** (lines 10–19 of cycles.ts):
```typescript
import { ApiError } from '../../lib/api-error';
import { AIO_PROJECTS_API_PATH, aioFetch } from './client';
import type {
  AioCycle,
  AioCycleDetailPagedResponse,
  ...
  AioPage,
} from './types';
```
Adapt:
```typescript
import { ApiError } from '../../lib/api-error';
import { TEMPO_API_PATH, tempoFetch } from './client';
import type { TempoPaginatedResponse, TempoWorklog } from './types';
```

**Pagination loop pattern** (lines 84–113 of cycles.ts):
```typescript
for (;;) {
  const path = `${basePath}?startAt=${startAt}`;
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path, 'Load AIO Cycles');
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    const data = (await response.json()) as AioPage<AioCycle> | AioCycle[];
    // ... accumulate items
    if (data.isLast || data.maxResults <= 0) return allCycles;
    startAt += data.maxResults;
    continue;
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
Adapt to `while(true)` with `offset`/`limit` and `items.length < limit` stop condition (probe determines exact sentinel). Keep identical error handling (`ApiError` 401, return `[]` on 404). Username loop uses `params.append('username', u)` for multi-value query param.

**Function signature pattern** (lines 75–79 of cycles.ts):
```typescript
export async function fetchAioCycles(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<AioCycle[]>
```
Adapt:
```typescript
export async function fetchWorklogs(
  baseUrl: string,
  token: string,
  usernames: string[],
  from: string,   // YYYY-MM-DD
  to: string,     // YYYY-MM-DD
): Promise<TempoWorklog[]>
```

---

### `taskflow/src/services/tempo/index.ts` (barrel)

**Analog:** `taskflow/src/services/aio/index.ts`

**Full barrel pattern** (lines 1–12):
```typescript
/**
 * AIO TCMS service submodules barrel export.
 *
 * client.ts is intentionally NOT exported — it is internal to aio/.
 * Domain modules (projects, issue-runs) import aioFetch directly from './client'.
 */

export * from './cycles';
export * from './issue-runs';
export * from './issue-steps';
export * from './projects';
export * from './types';
```
Adapt:
```typescript
/**
 * Tempo Timesheets service barrel export.
 *
 * client.ts is intentionally NOT exported — it is internal to tempo/.
 * Domain modules import tempoFetch directly from './client'.
 */

export * from './worklogs';
export * from './types';
```

---

### `taskflow/src/services/tempo/client.test.ts` (test)

**Analog:** `taskflow/src/services/aio/client.test.ts`

**Mock setup + import order** (lines 1–8 of client.test.ts):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../lib/apiFetch';
import { AIO_API_PATH, AIO_PROJECTS_API_PATH, aioFetch } from './client';
```
Adapt: import `TEMPO_API_PATH, tempoFetch` from `'./client'`.

**Test cases to replicate** (lines 14–98 of client.test.ts): URL construction, trailing-slash stripping, source `'aio'`, Bearer header, Content-Type header, operation label forwarding, `apiPath` override. All 6 test cases map 1-to-1 with `aioFetch` → `tempoFetch` substitution.

**beforeEach mock reset** (lines 15–18):
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiFetch).mockResolvedValue(new Response() as unknown as Response);
});
```

---

### `taskflow/src/services/tempo/worklogs.test.ts` (test)

**Analog:** `taskflow/src/services/aio/cycles.test.ts`

**Mock setup pattern** (lines 1–16 of cycles.test.ts):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import {
  fetchAioCycles,
  ...
} from './cycles';

const mockedApiFetch = vi.mocked(apiFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
```
Adapt: mock `'../../lib/apiFetch'` at module level; import `fetchWorklogs` from `'./worklogs'`. D-10 mandates mocking at the `apiFetch` level (not `tempoFetch`) to exercise the full call chain.

**Pagination exhaustion test pattern** (lines 48–71 of cycles.test.ts):
```typescript
it('accumulates items across multiple pages until isLast is true', async () => {
  mockedApiFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [...],
        startAt: 0,
        maxResults: 1,
        isLast: false,
      }),
    } as unknown as Response)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [...],
        startAt: 1,
        maxResults: 1,
        isLast: true,
      }),
    } as unknown as Response);
  const result = await fetchAioCycles(BASE, TOKEN, PROJECT_KEY);
  expect(result).toHaveLength(2);
});
```
Adapt: cover pagination exhaustion (two pages then empty array / `items.length < limit`). Add second test: timezone date bucketing — that `startDate.slice(0, 10)` returns the correct date key regardless of input.

**Error path pattern** (lines 74–79 of cycles.test.ts):
```typescript
it('throws ApiError with source "jira" on 401', async () => {
  mockedApiFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
  await expect(fetchAioCycles(BASE, TOKEN, PROJECT_KEY)).rejects.toMatchObject({
    status: 401,
    source: 'jira',
  });
});
```

---

### `taskflow/src/stores/settings.store.ts` (store, additive modify)

**Analog:** Self — existing `aioEnabled`/`setAioEnabled` pattern.

**Interface insertion point** (lines 102–104):
```typescript
  /** Enable AIO Test Management integration. Default: false. Gates all AIO API calls. */
  aioEnabled: boolean;
  setAioEnabled: (v: boolean) => void;
```
Add immediately after line 104:
```typescript
  /** Enable Tempo Timesheets integration. Default: false. Gates all Tempo API calls. */
  tempoEnabled: boolean;
  setTempoEnabled: (v: boolean) => void;
```

**Initial state insertion point** (lines 219–220):
```typescript
      aioEnabled: false,
      setAioEnabled: (v) => set({ aioEnabled: v }),
```
Add immediately after line 220:
```typescript
      tempoEnabled: false,
      setTempoEnabled: (v) => set({ tempoEnabled: v }),
```

**Version bump** (line 322):
```typescript
      version: 19,
```
Change to:
```typescript
      version: 20,
```

**Migration guard insertion point** (after `if (version < 19)` block, lines 403–406):
```typescript
        if (version < 19) {
          // No new fields to initialize. Version bump drops dashboardLayout from
          // persisted shape implicitly — Zustand LazyStore ignores extra keys.
        }
        return persisted as SettingsState;
```
Insert before the `return` statement:
```typescript
        if (version < 20) {
          if (s.tempoEnabled === undefined) s.tempoEnabled = false;
        }
```

---

### `taskflow/src/routes/settings/IntegrationsSection.tsx` (component, additive modify)

**Analog:** Self — existing AIO toggle block (lines 62–80).

**Selector imports to add** (lines 14–15):
```typescript
  const aioEnabled = useSettingsStore((s) => s.aioEnabled);
  const setAioEnabled = useSettingsStore((s) => s.setAioEnabled);
```
Add:
```typescript
  const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);
  const setTempoEnabled = useSettingsStore((s) => s.setTempoEnabled);
```

**Toggle block pattern to copy** (lines 62–80):
```tsx
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          AIO Test Management
        </h3>
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-medium">Enable AIO Test Management</p>
            <p className="text-xs text-muted-foreground">
              Show test execution data from AIO TCMS. Requires AIO plugin on your Jira instance.
            </p>
          </div>
          <input
            type="checkbox"
            aria-label="Enable AIO Test Management"
            checked={aioEnabled}
            onChange={(e) => setAioEnabled(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
        </label>
        {aioEnabled && ( ... )}
      </div>
```
Add below the closing `</div>` of the AIO block (before the outer `</div>` at line 146):
```tsx
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Tempo Timesheets
        </h3>
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-semibold">Enable Tempo Timesheets</p>
            <p className="text-xs text-muted-foreground">
              Show worklog data from Jira Tempo Timesheets. Requires Tempo plugin on your Jira instance.
            </p>
          </div>
          <input
            type="checkbox"
            aria-label="Enable Tempo Timesheets"
            checked={tempoEnabled}
            onChange={(e) => setTempoEnabled(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
        </label>
      </div>
```
Note: No sub-UI on enable (D-11). No `{tempoEnabled && (...)}` conditional block.

---

### `taskflow/src/routes/settings/IntegrationsSection.test.tsx` (test, additive modify)

**Analog:** Self — existing `mockStore` and checkbox test pattern.

**mockStore extension** (lines 9–19):
```typescript
const mockStore: {
  aioEnabled: boolean;
  setAioEnabled: ReturnType<typeof vi.fn>;
  selectedAioProjectKey: string | null;
  setSelectedAioProjectKey: ReturnType<typeof vi.fn>;
} = {
  aioEnabled: false,
  setAioEnabled: vi.fn(),
  selectedAioProjectKey: null,
  setSelectedAioProjectKey: vi.fn(),
};
```
Add `tempoEnabled` and `setTempoEnabled` fields to both the type annotation and the object literal:
```typescript
const mockStore: {
  aioEnabled: boolean;
  setAioEnabled: ReturnType<typeof vi.fn>;
  selectedAioProjectKey: string | null;
  setSelectedAioProjectKey: ReturnType<typeof vi.fn>;
  tempoEnabled: boolean;
  setTempoEnabled: ReturnType<typeof vi.fn>;
} = {
  aioEnabled: false,
  setAioEnabled: vi.fn(),
  selectedAioProjectKey: null,
  setSelectedAioProjectKey: vi.fn(),
  tempoEnabled: false,
  setTempoEnabled: vi.fn(),
};
```

**`beforeEach` reset extension** (lines 110–118): Add `mockStore.tempoEnabled = false;` alongside the existing resets.

**Test cases to add** (mirror lines 125–148 of existing test, substituting Tempo names):
```typescript
it('renders Tempo Timesheets checkbox', () => {
  renderWithClient(<IntegrationsSection />);
  expect(screen.getByRole('checkbox', { name: /enable tempo timesheets/i })).toBeInTheDocument();
});

it('checkbox is unchecked when tempoEnabled=false', () => {
  renderWithClient(<IntegrationsSection />);
  expect(screen.getByRole('checkbox', { name: /enable tempo timesheets/i })).not.toBeChecked();
});

it('checkbox is checked when tempoEnabled=true', () => {
  mockStore.tempoEnabled = true;
  renderWithClient(<IntegrationsSection />);
  expect(screen.getByRole('checkbox', { name: /enable tempo timesheets/i })).toBeChecked();
});

it('toggling checkbox calls setTempoEnabled(true)', () => {
  renderWithClient(<IntegrationsSection />);
  fireEvent.click(screen.getByRole('checkbox', { name: /enable tempo timesheets/i }));
  expect(mockStore.setTempoEnabled).toHaveBeenCalledWith(true);
});
```

---

## Shared Patterns

### apiFetch Source Label (`'aio'` not `'jira'`)
**Source:** `taskflow/src/lib/apiFetch.ts` lines 23–27
**Apply to:** `tempo/client.ts` — the `tempoFetch` function
```typescript
function markDisconnected(source: 'jira' | 'gitlab' | 'aio' | 'updater') {
  if (source === 'aio' || source === 'updater') return;
  // ...
}
```
Tempo must pass `'aio'` as the source to `apiFetch`. Passing `'jira'` would cause a Tempo 401 to call `setJiraConnected(false)`, falsely disconnecting the primary Jira integration.

### Error Handling
**Source:** `taskflow/src/services/aio/cycles.ts` lines 106–113
**Apply to:** `tempo/worklogs.ts`
```typescript
if (response.status === 401) {
  throw new ApiError('Invalid token or token has expired', 401, 'jira');
}
if (response.status === 404) {
  return [];
}
throw new Error(`AIO request failed with status ${response.status}`);
```
Import `ApiError` from `'../../lib/api-error'`.

### Zustand Store Migration Guard (additive only)
**Source:** `taskflow/src/stores/settings.store.ts` lines 389–391
**Apply to:** `settings.store.ts` v19 → v20 bump
```typescript
if (version < 15) {
  if (s.aioEnabled === undefined) s.aioEnabled = false;
}
```
Pattern: `if (version < N) { if (s.field === undefined) s.field = defaultValue; }`. Never delete fields. Version number in `persist({...})` config (line 322) MUST be bumped in the same edit.

### Settings Store Fine-Grained Selector
**Source:** `taskflow/src/routes/settings/IntegrationsSection.tsx` lines 14–17
**Apply to:** `IntegrationsSection.tsx` — new Tempo selector lines
```typescript
const aioEnabled = useSettingsStore((s) => s.aioEnabled);
const setAioEnabled = useSettingsStore((s) => s.setAioEnabled);
```
Use fine-grained selectors (one per field), not `useSettingsStore()` with destructuring. Comment in source: "IN-01: fine-grained selectors avoid re-rendering this component on every unrelated settings-store mutation".

### vi.mock Placement (top-level, before imports)
**Source:** `taskflow/src/services/aio/cycles.test.ts` line 3 and `client.test.ts` lines 3–5
**Apply to:** `tempo/worklogs.test.ts`, `tempo/client.test.ts`
```typescript
vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));
```
`vi.mock` calls must appear before the `import` statements that use the mocked module. The `// biome-ignore assist/source/organizeImports:` comment is used in `settings.store.test.ts` when this ordering conflicts with the linter.

### Barrel: client.ts NOT re-exported
**Source:** `taskflow/src/services/aio/index.ts` lines 1–12
**Apply to:** `tempo/index.ts`
`tempoFetch` and `TEMPO_API_PATH` are internal to `tempo/`. Only `fetchWorklogs` and type exports go in `index.ts`.

---

## No Analog Found

None. All files in Phase 61 have direct analogs in the AIO service layer.

---

## Metadata

**Analog search scope:** `taskflow/src/services/aio/`, `taskflow/src/stores/`, `taskflow/src/routes/settings/`, `taskflow/src/lib/`
**Files scanned:** 9 analog files read in full
**Key constraint:** All service code is gated on the Wave 0 probe result. `client.ts` must include the probe comment block (working path + any failed paths) before `worklogs.ts` is written, per D-02/D-03.
