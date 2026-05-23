# Phase 51: AIO Service Layer - Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 10 (5 new service/component files + 2 modified files + 3 test counterparts for analogs)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/services/aio/client.ts` | service / internal utility | request-response | `taskflow/src/services/jira/client.ts` | role-match (simpler — no pagination helpers) |
| `taskflow/src/services/aio/types.ts` | model / type definitions | — | `taskflow/src/services/jira/types.ts` | exact role |
| `taskflow/src/services/aio/projects.ts` | service | CRUD / request-response | `taskflow/src/services/jira/projects.ts` | exact |
| `taskflow/src/services/aio/issue-runs.ts` | service | CRUD / request-response | `taskflow/src/services/jira/projects.ts` | exact (same pattern, different endpoint) |
| `taskflow/src/services/aio/index.ts` | barrel | — | `taskflow/src/services/jira/index.ts` | exact |
| `taskflow/src/stores/settings.store.ts` | store (modify) | — | self | — (modification, not new) |
| `taskflow/src/routes/settings/Settings.tsx` | component (modify) | — | self | — (modification, not new) |
| `taskflow/src/routes/settings/IntegrationsSection.tsx` | component | request-response (store read/write) | `taskflow/src/routes/settings/WorkflowSection.tsx` | exact |
| `taskflow/src/services/aio/*.test.ts` (3 files) | test | — | `taskflow/src/services/jira/projects.test.ts`, `client.test.ts` | exact |
| `taskflow/src/stores/settings.store.test.ts` (extend) | test | — | self (existing file, add new describe block) | exact |
| `taskflow/src/routes/settings/IntegrationsSection.test.tsx` | test | — | `taskflow/src/routes/settings/Settings.test.tsx` (WorkflowSection describe block) | exact |

---

## Pattern Assignments

### `taskflow/src/services/aio/client.ts` (service, internal)

**Analog:** `taskflow/src/services/jira/client.ts`

**Key difference from analog:** `aio/client.ts` is much simpler — no pagination helpers, no `isResponseLikeError`. It exports only `AIO_API_PATH` (constant) and `aioFetch()` (wrapper). The analog shows the file-level structure and doc comment convention; the actual implementation shape comes from the RESEARCH.md Pattern 4.

**Imports pattern** (analog lines 1-11):
```typescript
/**
 * Shared AIO API client helpers — fetch wrapper, base path constant.
 *
 * This module is imported by domain modules (projects, issue-runs) but is NOT
 * re-exported from the barrel index.ts. Its exports are internal to aio/.
 */
import { apiFetch } from '../../lib/apiFetch';
```

**Core pattern** (from RESEARCH.md Pattern 4, verified against analog):
```typescript
// KEY DECISION (Phase 51 probe): confirmed against live AIO instance on <date>
// Set this from probe findings before writing any other code in this file.
export const AIO_API_PATH = '/rest/aio-tcms/1.0'; // placeholder — set from probe

export async function aioFetch(
  baseUrl: string,
  token: string,
  path: string,
): Promise<Response> {
  const url = `${baseUrl.replace(/\/$/, '')}${AIO_API_PATH}${path}`;
  return apiFetch('jira', url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}
```

**Anti-pattern to avoid:** Do NOT add `getJiraLimit()`, `fetchAllSearchPages`, or `isResponseLikeError` — those are jira-specific. AIO calls are simple single-response fetches.

---

### `taskflow/src/services/aio/types.ts` (model)

**Analog:** `taskflow/src/services/jira/types.ts` (lines 1-9, 11-21)

**File-header convention** (analog lines 1-9):
```typescript
/**
 * Shared AIO TCMS type definitions used across all domain modules.
 *
 * This file is the single source of truth for all AIO REST API response
 * shapes. Domain modules import from here; they never define their own
 * interfaces for AIO entities.
 *
 * Interfaces are drafted from Phase 51 probe response bodies — update after probe.
 */
```

**Interface shape pattern** (analog lines 17-21 — JiraProject as reference):
```typescript
export interface JiraProject {
  id: string;
  key: string;
  name: string;
}
```

Applied to AIO (placeholder — finalize from probe output):
```typescript
// [ASSUMED] — update field names after probe captures actual /project response body
export interface AioProject {
  id: string;      // AIO project ID (used by cycles/runs endpoints in Phase 52+)
  name: string;    // Display name
  key?: string;    // May or may not exist — confirm from probe
}

// [ASSUMED] — update field names after probe captures actual /testrun?issueKey= response body
export interface AioIssueRun {
  id: string;
  name: string;
  status: string;  // e.g. 'PASS', 'FAIL', 'NOT_EXECUTED' — exact values from probe
  issueKey?: string;
}
```

**Note:** All `[ASSUMED]` fields must be replaced with probe-verified field names before implementation is complete. Types.ts cannot be finalized until the curl probe has run and response bodies have been captured.

---

### `taskflow/src/services/aio/projects.ts` (service, CRUD)

**Analog:** `taskflow/src/services/jira/projects.ts`

**Imports pattern** (analog lines 1-8):
```typescript
import { ApiError } from '../../lib/api-error';
import { aioFetch } from './client';
import type { AioProject } from './types';
```

**Core domain function pattern** (analog lines 64-98 — `listJiraProjects`):
```typescript
export async function fetchAioProjects(
  baseUrl: string,
  token: string,
): Promise<AioProject[]> {
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, '/project');
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    return response.json() as Promise<AioProject[]>;
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    return []; // AIO not installed or wrong base path
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}
```

**Error message strings:** The exact strings `'Invalid token or token has expired'` and `'Cannot reach AIO at ${baseUrl}'` must match — `ApiError` consumers (ErrorState component) detect by message pattern.

**Difference from analog:** No 403 handler needed unless probe confirms AIO uses 403 for insufficient permissions. The analog has it; AIO may not. Add if probe reveals 403 responses.

---

### `taskflow/src/services/aio/issue-runs.ts` (service, CRUD)

**Analog:** `taskflow/src/services/jira/projects.ts` (same pattern, different endpoint and return type)

**Core domain function pattern:**
```typescript
import { ApiError } from '../../lib/api-error';
import { aioFetch } from './client';
import type { AioIssueRun } from './types';

export async function fetchAioRunsForIssue(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<AioIssueRun[]> {
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, `/testrun?issueKey=${encodeURIComponent(issueKey)}`);
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    const data = await response.json();
    // Probe D-11: confirm whether response is an array or a paginated wrapper
    return Array.isArray(data) ? data : (data.values ?? data.runs ?? []);
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    return []; // endpoint missing OR no runs for this issue
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}
```

**Note on response shape:** The `Array.isArray(data) ? data : (data.values ?? data.runs ?? [])` guard handles both a direct array response and a paginated wrapper until probe confirms the exact shape. Simplify after probe.

---

### `taskflow/src/services/aio/index.ts` (barrel)

**Analog:** `taskflow/src/services/jira/index.ts`

**Exact pattern** (analog lines 1-14):
```typescript
/**
 * AIO TCMS service submodules barrel export.
 *
 * client.ts is intentionally NOT exported — it is internal to aio/.
 */

export * from './types';
export * from './projects';
export * from './issue-runs';
```

**Critical constraint:** Do NOT add `export * from './client'`. The analog (`jira/index.ts`) proves this — it exports from `attachments`, `duration`, `filters`, `types`, `users`, `worklogs` but not from `client.ts`.

---

### `taskflow/src/stores/settings.store.ts` (modify — add aioEnabled)

**Analog:** Self — extend the existing file at `/Users/user/Documents/Projects/taskflow/taskflow/src/stores/settings.store.ts`

**Three insertion points:**

**1. SettingsState interface** — add after `releaseDetailPanelWidth` field (line 114), before `quickFilters` (line 116):
```typescript
/** Enable AIO Test Management integration. Default: false. Gates all AIO API calls. */
aioEnabled: boolean;
setAioEnabled: (v: boolean) => void;
```

**2. Initial state object** — add after `releaseDetailPanelWidth: 288,` (line 224), before `quickFilters: [],` (line 225):
```typescript
aioEnabled: false,
setAioEnabled: (v) => set({ aioEnabled: v }),
```

**3. migrate callback** — add after the `version < 14` block (lines 417-422), before `return persisted` (line 423). Also bump `version: 14` → `version: 15` on the persist options object (line 355):
```typescript
if (version < 15) {
  if (s.aioEnabled === undefined) s.aioEnabled = false;
}
```

**Migration pattern** (analog lines 356-423 — existing `migrate` function):
```typescript
migrate: (persisted, version) => {
  const s = persisted as Record<string, unknown>;
  // ... existing guards ...
  if (version < 14) {
    if (s.sidebarWidth === undefined) s.sidebarWidth = 224;
    // ...
  }
  if (version < 15) {
    if (s.aioEnabled === undefined) s.aioEnabled = false;
  }
  return persisted as SettingsState;
},
```

**Pitfall (from RESEARCH.md Pitfall 3):** The `version:` field on the `persist({...}, { version: 14, ... })` options object (line 355) MUST be changed to `version: 15`. Forgetting this means the migrate callback is never invoked for existing users — they get `aioEnabled: undefined` at runtime.

---

### `taskflow/src/routes/settings/Settings.tsx` (modify — add integrations)

**Analog:** Self — extend the existing file at `/Users/user/Documents/Projects/taskflow/taskflow/src/routes/settings/Settings.tsx`

**Four insertion points:**

**1. lucide-react import** (line 15) — add `Plug`:
```typescript
import { Bell, GitBranch, Link2, Palette, PanelLeft, Plug, RefreshCw, Settings2 } from 'lucide-react';
```

**2. SettingsSection union type** (lines 26-33) — add `'integrations'` between `'workflow'` and `'updates'`:
```typescript
type SettingsSection =
  | 'connections'
  | 'appearance'
  | 'sidebar'
  | 'notifications'
  | 'workflow'
  | 'integrations'
  | 'updates'
  | 'advanced';
```

**3. SECTIONS array** (lines 35-43) — insert after workflow entry, before updates:
```typescript
{ id: 'integrations', label: 'Integrations', icon: <Plug className="h-4 w-4" /> },
```

**4. Content area render** (lines 73-83) — add after workflow render, before updates render:
```typescript
{activeSection === 'integrations' && <IntegrationsSection />}
```

Plus add the import at the top with the other section imports:
```typescript
import IntegrationsSection from './IntegrationsSection';
```

**Note on icon availability (RESEARCH.md Assumption A1):** `Plug` is in lucide-react (installed). If TypeScript raises an error at import, fall back to `Cable` or `Link2` — both are already imported or available.

---

### `taskflow/src/routes/settings/IntegrationsSection.tsx` (new component)

**Analog:** `taskflow/src/routes/settings/WorkflowSection.tsx`

**Imports pattern** (analog line 9):
```typescript
import { useSettingsStore } from '../../stores/settings.store';
```

**Component structure pattern** (analog lines 12-86 — outer div, h2, subsection div, label, checkbox):
```typescript
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
      </div>
    </div>
  );
}
```

**Exact class names to copy from analog** (WorkflowSection.tsx):
- Outer div: `"flex flex-col gap-8"` (line 23)
- h2: `"text-lg font-semibold"` (line 24)
- h3: `"text-sm font-semibold text-muted-foreground uppercase tracking-wide"` (line 29)
- label: `"flex items-center justify-between gap-4 cursor-pointer"` (line 32)
- checkbox: `"h-4 w-4 accent-primary"` (line 40)
- `data-testid` on outer div: use `"section-integrations"` to match Settings.test.tsx pattern for other sections

---

## Test File Assignments

### `taskflow/src/services/aio/projects.test.ts` (new)

**Analog:** `taskflow/src/services/jira/projects.test.ts`

**Full test structure pattern** (analog lines 1-73):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { fetchAioProjects } from './projects';

const mockedApiFetch = vi.mocked(apiFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';

describe('fetchAioProjects', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns project list on 200', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => [{ id: '1', name: 'Project Alpha' }],
    } as unknown as Response);
    const result = await fetchAioProjects(BASE, TOKEN);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Project Alpha');
  });

  it('throws ApiError on 401', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAioProjects(BASE, TOKEN)).rejects.toThrow('Invalid token');
  });

  it('returns empty array on 404', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const result = await fetchAioProjects(BASE, TOKEN);
    expect(result).toEqual([]);
  });

  it('throws on network error', async () => {
    mockedApiFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchAioProjects(BASE, TOKEN)).rejects.toThrow('Cannot reach AIO');
  });
});
```

**Critical ordering rule** (RESEARCH.md Pitfall 5, verified in analog line 3): `vi.mock(...)` MUST appear before the `import { apiFetch }` statement. Vitest hoists `vi.mock` calls, but the convention in all existing `*.test.ts` files is mock declaration → then imports of the mocked module.

---

### `taskflow/src/services/aio/issue-runs.test.ts` (new)

**Analog:** `taskflow/src/services/jira/projects.test.ts` (same structure)

Test cases to cover:
- 200 with array response → returns typed array
- 200 with empty array → returns `[]`
- 401 → throws `ApiError` with `'Invalid token or token has expired'`
- 404 → returns `[]`
- network throw → throws `'Cannot reach AIO'`

Follow identical `vi.mock` → `beforeEach(vi.clearAllMocks)` → `mockedApiFetch.mockResolvedValue({ ok: true/false, status: N, json: async () => ... } as unknown as Response)` pattern from analog.

---

### `taskflow/src/services/aio/client.test.ts` (new)

**Analog:** `taskflow/src/services/jira/client.test.ts`

**Full file structure** (analog lines 1-18):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aioFetch, AIO_API_PATH } from './client';

vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../lib/apiFetch';
```

Test cases for `aioFetch`:
- Constructs URL as `baseUrl + AIO_API_PATH + path` (no trailing slash on baseUrl, correct join)
- Trailing slash on baseUrl is stripped: `'https://jira.example.com/'` → same URL as without slash
- Calls `apiFetch('jira', ...)` (never `'gitlab'`)
- Passes `Authorization: Bearer ${token}` header
- Passes `Content-Type: application/json` header

Use `vi.mocked(apiFetch).mockResolvedValue(...)` and assert on `expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(...)`.

---

### `taskflow/src/stores/settings.store.test.ts` (extend existing file)

**Analog:** Self — the existing file already has three `describe` blocks. Add a fourth.

**Pattern for the new describe block** (analog lines 214-261 — Phase 50 block is the most recent):
```typescript
describe('settings.store — aioEnabled toggle (Phase 51)', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({
        aioEnabled: false,
      } as any);
    });
  });

  it('aioEnabled defaults to false', () => {
    expect(useSettingsStore.getState().aioEnabled).toBe(false);
  });

  it('setAioEnabled(true) updates store', () => {
    act(() => useSettingsStore.getState().setAioEnabled(true));
    expect(useSettingsStore.getState().aioEnabled).toBe(true);
  });

  it('setAioEnabled(false) updates store', () => {
    act(() => useSettingsStore.getState().setAioEnabled(true));
    act(() => useSettingsStore.getState().setAioEnabled(false));
    expect(useSettingsStore.getState().aioEnabled).toBe(false);
  });
});
```

**vi.mock pattern** (analog lines 8-16): The file already has its `vi.mock('@tauri-apps/plugin-store', ...)` at the top — do NOT add a second one. The new describe block uses the existing mock.

**Import order rule** (analog lines 18-25 biome-ignore comment): The existing file uses `// biome-ignore assist/source/organizeImports` comments to preserve the post-vi.mock import order. New imports for the new describe block follow the same existing imports — no new imports needed since `useSettingsStore` is already imported at line 19.

---

### `taskflow/src/routes/settings/IntegrationsSection.test.tsx` (new)

**Analog:** `taskflow/src/routes/settings/Settings.test.tsx` (WorkflowSection describe block, lines 241-297)

**Mock pattern** (analog lines 91-146 — mock `useSettingsStore`):
```typescript
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IntegrationsSection from './IntegrationsSection';

const mockStore = {
  aioEnabled: false,
  setAioEnabled: vi.fn(),
};

vi.mock('../../stores/settings.store', () => ({
  useSettingsStore: () => mockStore,
}));

describe('IntegrationsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.aioEnabled = false;
  });

  it('renders Integrations heading', () => {
    render(<IntegrationsSection />);
    expect(screen.getByRole('heading', { name: /integrations/i })).toBeInTheDocument();
  });

  it('renders AIO Test Management checkbox', () => {
    render(<IntegrationsSection />);
    expect(screen.getByRole('checkbox', { name: /enable aio test management/i })).toBeInTheDocument();
  });

  it('checkbox is unchecked when aioEnabled=false', () => {
    render(<IntegrationsSection />);
    expect(screen.getByRole('checkbox', { name: /enable aio test management/i })).not.toBeChecked();
  });

  it('checkbox is checked when aioEnabled=true', () => {
    mockStore.aioEnabled = true;
    render(<IntegrationsSection />);
    expect(screen.getByRole('checkbox', { name: /enable aio test management/i })).toBeChecked();
  });

  it('toggling checkbox calls setAioEnabled(true)', () => {
    render(<IntegrationsSection />);
    fireEvent.click(screen.getByRole('checkbox', { name: /enable aio test management/i }));
    expect(mockStore.setAioEnabled).toHaveBeenCalledWith(true);
  });
});
```

**Analog pattern note:** The Settings.test.tsx WorkflowSection tests (lines 272-296) show `fireEvent.click(checkbox)` asserting that the store setter was called with the new value. Follow exactly — do NOT use `userEvent` (the project uses `fireEvent` throughout settings tests).

---

## Shared Patterns

### apiFetch call signature
**Source:** `taskflow/src/lib/apiFetch.ts` lines 41-46
**Apply to:** `aio/client.ts`
```typescript
export async function apiFetch(
  source: 'jira' | 'gitlab',
  url: string,
  init?: RequestInit,
  operation?: string,
): Promise<Response>
```
AIO calls use `source: 'jira'`. The `operation` label (4th arg) is optional — omit for Phase 51 (Jira domain modules also sometimes omit it for simple single-purpose calls like `projects.ts`).

### ApiError construction
**Source:** `taskflow/src/lib/api-error.ts` lines 9-18
**Apply to:** `aio/projects.ts`, `aio/issue-runs.ts`
```typescript
throw new ApiError('Invalid token or token has expired', 401, 'jira');
```
- `source` is always `'jira'` for AIO (D-09: AIO uses same Jira PAT, same source)
- The 401 message string `'Invalid token or token has expired'` must match exactly — it is the string the analog jira/projects.ts uses and which downstream error-detection patterns may key on
- Import path: `'../../lib/api-error'`

### Zustand store setter pattern
**Source:** `taskflow/src/stores/settings.store.ts` lines 273-299
**Apply to:** `settings.store.ts` new `setAioEnabled` action
```typescript
setAioEnabled: (v) => set({ aioEnabled: v }),
```
Simple boolean toggle — no clamping or side effects needed (unlike `setJiraConcurrencyLimit` which also calls `setConcurrencyRuntime`).

### Settings section checkbox UI pattern
**Source:** `taskflow/src/routes/settings/WorkflowSection.tsx` lines 32-45
**Apply to:** `IntegrationsSection.tsx`
```typescript
<label className="flex items-center justify-between gap-4 cursor-pointer">
  <div>
    <p className="text-sm font-medium">{label text}</p>
    <p className="text-xs text-muted-foreground">{description}</p>
  </div>
  <input
    type="checkbox"
    aria-label="{accessible label matching the p text}"
    checked={storeValue}
    onChange={(e) => storeSetter(e.target.checked)}
    className="h-4 w-4 accent-primary"
  />
</label>
```

### vi.mock ordering in tests
**Source:** `taskflow/src/services/jira/projects.test.ts` lines 1-8
**Apply to:** All three `aio/*.test.ts` files
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { fetchAio... } from './...';  // module under test comes AFTER vi.mock
```

---

## No Analog Found

All Phase 51 files have clear analogs. No files require falling back to RESEARCH.md patterns exclusively — though `types.ts` interface field names cannot be finalized until the curl probe captures actual response bodies.

---

## Important Implementation Notes for Planner

1. **Probe is a hard blocker for `aio/client.ts`, `aio/types.ts`, `aio/projects.ts`, `aio/issue-runs.ts`:** The `AIO_API_PATH` constant must be set from probe findings. All four service files are gated behind probe completion.

2. **Settings.test.tsx will need updating:** The existing test at line 171 asserts `navButtons.length === 7`. After adding 'integrations', this becomes 8. The mock at line 91-146 also does not include `aioEnabled`/`setAioEnabled` — those must be added to `mockSettingsStore` when the settings test file is updated.

3. **biome-ignore comment required in settings.store.ts:** The existing file has `// biome-ignore assist/source/organizeImports: import order must match module init order` at line 8. Do not remove it when editing; the Biome linter would otherwise reorder imports and break TDZ initialization.

4. **`data` vs direct array in issue-runs:** Until the probe confirms the `/testrun?issueKey=` response shape (D-11), the implementation must guard for both direct array and wrapped object. Simplify post-probe.

---

## Metadata

**Analog search scope:** `taskflow/src/services/jira/`, `taskflow/src/routes/settings/`, `taskflow/src/stores/`, `taskflow/src/lib/`
**Files scanned:** 14 (all read in full)
**Pattern extraction date:** 2026-05-12
