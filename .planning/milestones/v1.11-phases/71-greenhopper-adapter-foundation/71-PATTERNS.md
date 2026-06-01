# Phase 71: GreenHopper Adapter Foundation - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 19 (10 source + 8 colocated tests + 1 script + 1 re-export edit + 4 fixtures)
**Analogs found:** 17 / 19 (2 flagged as "no in-tree analog — net-new")

> Note on D-04 path: CONTEXT.md and RESEARCH.md both lock new code at `src/services/jira/greenhopper/` (under the legacy `jira/` folder), even though the tempo/aio analogs live one level up at `src/services/{tempo,aio}/`. The pattern is the same (private `client.ts` + barrel + colocated tests); only the parent folder differs. All excerpts below are repo-relative (`taskflow/src/...`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/services/jira/greenhopper/client.ts` | service (private fetch wrapper) | request-response | `src/services/tempo/client.ts` | exact |
| `src/services/jira/greenhopper/client.test.ts` | test | request-response | `src/services/tempo/client.test.ts` | exact |
| `src/services/jira/greenhopper/types.ts` | model (response types) | n/a (pure types) | `src/services/aio/types.ts` | exact |
| `src/services/jira/greenhopper/allData.ts` | service (typed fetcher) | request-response | `src/services/aio/projects.ts` (fetchAioProjects) | exact |
| `src/services/jira/greenhopper/data.ts` | service (typed fetcher) | request-response | `src/services/aio/projects.ts` | exact |
| `src/services/jira/greenhopper/details.ts` | service (typed fetcher) | request-response | `src/services/aio/projects.ts` | exact |
| `src/services/jira/greenhopper/transitions.ts` | service (typed fetcher) | request-response | `src/services/jira/transitions.ts` (fetchTransitions) | role-match (REST vs GH endpoint) |
| `src/services/jira/greenhopper/allData.test.ts` | test | request-response | `src/services/aio/projects.test.ts` (mocking pattern) | exact |
| `src/services/jira/greenhopper/data.test.ts` | test | request-response | `src/services/aio/projects.test.ts` | exact |
| `src/services/jira/greenhopper/details.test.ts` | test | request-response | `src/services/aio/projects.test.ts` | exact |
| `src/services/jira/greenhopper/transitions.test.ts` | test | request-response | `src/services/aio/projects.test.ts` | exact |
| `src/services/jira/greenhopper/entityMaps.ts` | utility (pure resolvers + builder) | transform | — | **no analog — net-new pattern** |
| `src/services/jira/greenhopper/entityMaps.test.ts` | test | transform | `src/services/aio/projects.test.ts` (vitest skeleton only) | role-match |
| `src/services/jira/greenhopper/adapter.ts` | utility (pure transform) | transform | — | **no analog — net-new pattern** |
| `src/services/jira/greenhopper/adapter.test.ts` | test (fixture-driven) | transform | `src/services/aio/projects.test.ts` (vitest skeleton only) | role-match |
| `src/services/jira/greenhopper/index.ts` | config (barrel) | n/a | `src/services/aio/index.ts` | exact |
| `src/services/jira/greenhopper/__fixtures__/*.real.json` | data (committed fixtures) | n/a | — | **no in-tree precedent — first __fixtures__/ dir** |
| `src/services/jira.ts` (modify — re-export block) | config (legacy barrel) | n/a | `src/services/jira.ts` lines 23-28 (existing re-export style) | exact |
| `scripts/capture-greenhopper.mjs` | script (Node CLI, dev-only) | request-response (capture) | `scripts/bump-version.mjs` (CLI skeleton only) | role-match (no capture-script precedent) |

## Pattern Assignments

---

### `src/services/jira/greenhopper/client.ts` (private fetch wrapper, request-response)

**Analog:** `taskflow/src/services/tempo/client.ts` (lines 13–55)

**Copy verbatim, swap names + path + `source`.** Per D-04 + RESEARCH.md Pitfall 8, `source` MUST be `'jira'` (not a new `'greenhopper'` — would force `apiFetch` union widening, see `src/lib/apiFetch.ts:23`). Per D-06 this file is NOT re-exported from the barrel.

**Module doc-comment pattern** (tempo/client.ts:1–11) — mirror this exactly, replacing the Tempo-specific D-13/Phase-61 lines with a 2-line GH note ("source='jira' because GH shares the Jira PAT + 401 semantics; client is private to greenhopper/, not in index.ts").

**Imports** (tempo/client.ts:13):
```ts
import { apiFetch } from '../../lib/apiFetch';
```
Path is identical from `src/services/jira/greenhopper/` — two levels up to `src/lib/apiFetch`.

**Base-path constant + fetch signature** (tempo/client.ts:15, 33–55):
```ts
export const TEMPO_API_PATH = '/rest/tempo-timesheets/3';

export async function tempoFetch(
  baseUrl: string,
  token: string,
  path: string,
  operation: string,
  apiPath: string = TEMPO_API_PATH,
  init?: { method?: string; body?: string },
): Promise<Response> {
  const url = `${baseUrl.replace(/\/$/, '')}${apiPath}${path}`;
  return apiFetch(
    'tempo',
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

**Rename for GH:**
- `TEMPO_API_PATH` → `GREENHOPPER_API_PATH = '/rest/greenhopper/1.0/xboard'`
- `tempoFetch` → `greenhopperFetch`
- `'tempo'` → `'jira'` (D-04 + Pitfall 8)

**Deviation:** None — keep the optional-init-with-method+body shape; GH is GET-only in Phase 71 but the same shape future-proofs Phase 72-75.

---

### `src/services/jira/greenhopper/client.test.ts` (test)

**Analog:** `taskflow/src/services/tempo/client.test.ts` (entire file, 96 lines)

**Copy structure verbatim.** Replace `tempoFetch`/`TEMPO_API_PATH`/`'tempo'` with greenhopper equivalents. The 6 test cases map 1:1 — URL construction, trailing-slash strip, source string, Auth header, Content-Type header, operation label, custom apiPath override.

**Critical assertion to retain** (tempo/client.test.ts:42–50, adapted):
```ts
it('calls apiFetch with source "jira" (shares Jira PAT + 401 semantics)', async () => {
  await greenhopperFetch(BASE, TOKEN, PATH, 'Load Sprint Board (allData)');
  expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
    'jira',                       // ← differs from tempo: GH wants 'jira' (D-04)
    expect.any(String),
    expect.anything(),
    expect.any(String),
  );
});
```

**Mock setup** (tempo/client.test.ts:1–6):
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));
import { apiFetch } from '../../lib/apiFetch';
import { GREENHOPPER_API_PATH, greenhopperFetch } from './client';
```

---

### `src/services/jira/greenhopper/types.ts` (response types)

**Analog:** `taskflow/src/services/aio/types.ts` (lines 1–11 doc-comment + per-interface JSDoc pattern)

**Doc-comment header pattern** (aio/types.ts:1–11):
```ts
/**
 * Shared GreenHopper type definitions used across all domain modules.
 *
 * This file is the single source of truth for all GreenHopper REST API response
 * shapes. Domain modules import from here; they never define their own
 * interfaces for GH entities.
 *
 * Field names derived from `.planning/research/GREENHOPPER-API.md` (in-repo) and
 * captured fixtures under `__fixtures__/*.real.json`.
 */
```

**Per-interface JSDoc style** (aio/types.ts:13–22, 28–36) — short purpose line + endpoint reference + provenance note ("D-XX probe confirmed" / "Phase 71 capture confirmed"):
```ts
/**
 * A single AIO test management project.
 * Returned by GET /rest/aio-tcms/1.0/project (direct array, not paginated — D-16).
 * Field names derived from AIO REST API docs and D-16 probe findings.
 */
export interface AioProject { ... }
```

**Body content:** Lift verbatim from RESEARCH.md §"API Response Shapes (TypeScript Types)" (lines 106–246). The 12 interfaces (`GhIssue`, `GhBoardIssue`, `GhStatusEntity`, `GhPriorityEntity`, `GhTypeEntity`, `GhEpicEntity`, `GhAllDataResponse`, `GhBacklogResponse`, `GhTransition`, `GhTransitionsResponse`, `GhDetailsResponse`, `EntityMaps`) are pre-typed in research.

**Deviation:** `EntityMaps` lives here per RESEARCH (not in `entityMaps.ts`) — keeps all shapes in one place, matching aio/types.ts which holds `AioPage<T>` envelope alongside entity types.

---

### `src/services/jira/greenhopper/allData.ts` (typed fetcher, request-response)

**Analog:** `taskflow/src/services/aio/projects.ts` (`fetchAioProjects`, lines 112–140) — for the error-handling + cast pattern. RESEARCH.md §"Common Operation 1" gives the leaner happy-path skeleton.

**Imports + body — leaner GH version** (matches RESEARCH §Code Examples ll. 676–693):
```ts
import { greenhopperFetch } from './client';
import type { GhAllDataResponse } from './types';

export async function fetchAllData(
  baseUrl: string,
  token: string,
  boardId: number,
): Promise<GhAllDataResponse> {
  const response = await greenhopperFetch(
    baseUrl,
    token,
    `/work/allData.json?rapidViewId=${boardId}`,
    'Load Sprint Board (allData)',
  );
  if (!response.ok) throw response;
  return (await response.json()) as GhAllDataResponse;
}
```

**Error-handling envelope to copy from aio/projects.ts** (lines 112–140): 401 → `ApiError(..., 401, 'jira')`, 404 → empty/sensible default, network → wrapped `Error`. For GH `allData.json`:
```ts
// Pattern from aio/projects.ts:113-139 — adapt to GH semantics
let response: Response;
try {
  response = await greenhopperFetch(baseUrl, token, path, 'Load Sprint Board (allData)');
} catch {
  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}
if (response.ok) return (await response.json()) as GhAllDataResponse;
if (response.status === 401) {
  throw new ApiError('Invalid token or token has expired', 401, 'jira');
}
throw new Error(`GreenHopper allData request failed with status ${response.status}`);
```

**Decision for planner:** RESEARCH offers both the lean throw-Response (`if (!response.ok) throw response;`) and the aio richer envelope. Recommend the aio-style envelope (401 → `ApiError`, network → wrapped `Error`) for parity with the rest of `src/services/jira/*` — the same `jira/transitions.ts:36-41` pattern below uses this too.

---

### `src/services/jira/greenhopper/data.ts`, `details.ts`

**Analog:** Same as `allData.ts` — `taskflow/src/services/aio/projects.ts` (fetchAioProjects). Only path + return type differ.

**`data.ts`:**
- Path: `/plan/backlog/data.json?rapidViewId={boardId}`
- Return: `Promise<GhBacklogResponse>`
- Operation label: `'Load Backlog (data)'`

**`details.ts`:**
- Path: `/issue/details.json?rapidViewId=${boardId}&issueIdOrKey=${issueKey}&loadSubtasks=${loadSubtasks}`
- Return: `Promise<GhDetailsResponse>`
- Operation label: `'Load Issue Details'`
- Extra args: `issueKey: string`, `loadSubtasks: boolean`

---

### `src/services/jira/greenhopper/transitions.ts` (typed fetcher)

**Analog:** `taskflow/src/services/jira/transitions.ts` (`fetchTransitions`, lines 12–45) — closest in role (also a transitions fetcher) plus shares the 401/403 → `ApiError` envelope.

**Error envelope pattern** (jira/transitions.ts:19–41):
```ts
let response: Response;
try {
  response = await apiFetch(
    'jira',
    url,
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    'Issue Transition',
  );
} catch {
  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}

if (!response.ok) {
  if (response.status === 401 || response.status === 403) {
    throw new ApiError(`Failed to fetch transitions for ${issueKey}`, response.status, 'jira');
  }
  throw new Error(`Failed to fetch transitions for ${issueKey}: status ${response.status}`);
}

const data = await response.json();
return data.transitions as JiraTransition[];
```

**Adapt for GH:**
- Use `greenhopperFetch` (auth header already injected; drop the explicit `headers` arg)
- Path: `/work/transitions.json?projectId=${projectId}`
- Operation label: `'Load Workflow Transitions'`
- Return: `Promise<GhTransitionsResponse>` (cast `await response.json()` directly — no `.transitions` unwrap; the GH response is `{ projectAndIssueTypeToWorkflow, workflowToTransitions }`)
- Function name: `fetchGhTransitions` (D-05 names the export)

**Deviation:** No `data.transitions` unwrap — GH `transitions.json` returns the whole envelope (see RESEARCH ll. 211–214).

---

### `src/services/jira/greenhopper/{allData,data,details,transitions}.test.ts`

**Analog:** `taskflow/src/services/aio/projects.test.ts` (entire file structure)

**Mock setup pattern** (projects.test.ts:1–11):
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));
vi.mock('./client', () => ({
  greenhopperFetch: vi.fn(),
  GREENHOPPER_API_PATH: '/rest/greenhopper/1.0/xboard',
}));

import { greenhopperFetch } from './client';
import { fetchAllData } from './allData';

const mockedGhFetch = vi.mocked(greenhopperFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
```

**Per-test happy/401/404/network pattern** (projects.test.ts:18–54):
```ts
describe('fetchAllData', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns parsed response on 200', async () => {
    mockedGhFetch.mockResolvedValue({
      ok: true, status: 200, json: async () => ({ /* fixture-shaped */ }),
    } as unknown as Response);
    const result = await fetchAllData(BASE, TOKEN, 42);
    expect(result.rapidViewId).toBeDefined();
  });

  it('throws ApiError "Invalid token..." on 401', async () => {
    mockedGhFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAllData(BASE, TOKEN, 42)).rejects.toThrow('Invalid token');
  });

  it('throws "Cannot reach" on network error', async () => {
    mockedGhFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchAllData(BASE, TOKEN, 42)).rejects.toThrow('Cannot reach');
  });
});
```

**Coverage per fetcher test:** happy 200, 401 → `ApiError`, network → wrapped `Error`. `details.test.ts` adds an extra case that issueKey + loadSubtasks are forwarded into the URL (`expect(mockedGhFetch).toHaveBeenCalledWith(..., expect.stringContaining('issueIdOrKey=PROJ-1'), ...)`).

---

### `src/services/jira/greenhopper/entityMaps.ts` (resolvers + builder + warnOnce)

**Analog:** None in-tree — first map/resolver helper of this kind. RESEARCH §"Entity Map Shape" (ll. 287–346) is the canonical spec.

**Doc-comment pattern** — borrow the aio/types.ts §1–11 header style (purpose + provenance).

**Body — lift verbatim from RESEARCH ll. 296–303 (builder) + 337–346 (warnOnce):**
```ts
// buildEntityMaps — pure (D-09)
export function buildEntityMaps(allData: GhAllDataResponse): EntityMaps {
  return {
    statuses:   allData.entityData.statuses,
    priorities: allData.entityData.priorities,
    types:      allData.entityData.types,
    epics:      allData.entityData.epics,
  };
}

// warnOnce helper — D-07; module-level Set guard (RESEARCH ll. 337-346)
const seenMissing = new Set<string>();
function warnOnce(kind: string, id: string) {
  const key = `${kind}:${id}`;
  if (seenMissing.has(key)) return;
  seenMissing.add(key);
  console.warn(`[greenhopper] missing ${kind} id="${id}" — using Unknown fallback`);
}
```

**Resolver signatures** (RESEARCH ll. 306–326) — copy verbatim. Required resolvers (D-07) call `warnOnce(kind, id)` before returning the shim; optional resolvers (D-08) just return `undefined`.

**Deviation flag:** the `warnOnce` Set is module-level state — test must clear it (export a `__resetWarnOnce()` test-only helper, or use `vi.spyOn(console, 'warn')` and assert called-once across two `resolveStatus` calls with the same missing id).

---

### `src/services/jira/greenhopper/entityMaps.test.ts`

**Analog:** `aio/projects.test.ts` (skeleton only — vitest imports + `describe`/`it` structure)

**Coverage matrix (from D-07/D-08 + RESEARCH §Validation Architecture):**
- `buildEntityMaps` returns all four maps populated from `allData.real.json` (real-capture fixture)
- `resolveStatus` returns named status on hit
- `resolveStatus` returns `{ name: 'Unknown', statusCategory: { key: 'indeterminate' } }` shim on miss + `console.warn` fired (D-07)
- Two consecutive `resolveStatus(missingId)` calls produce ONE warn, not two (warnOnce)
- `resolveEpic(undefined, maps)` → `undefined` (D-08)
- `resolveEpic(99999, maps)` (missing entry) → `undefined` (D-08)
- `resolveParent(undefined, undefined)` → `undefined`; `resolveParent(123, 'PROJ-1')` → `{id:'123', key:'PROJ-1'}`

**Console spy pattern** (no exact in-tree analog — Vitest stdlib):
```ts
const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
afterEach(() => warnSpy.mockClear());
```

---

### `src/services/jira/greenhopper/adapter.ts` (`adaptIssue`)

**Analog:** None in-tree — there are no GH→app-shape transformers anywhere. RESEARCH §"Adapter Mapping Table" (ll. 254–283) is the authoritative source.

**Required imports:**
```ts
import { resolveStatus, resolveType /* etc */ } from './entityMaps';
import type { EntityMaps, GhBoardIssue, GhIssue } from './types';
import type { JiraIssue } from '../../jira'; // legacy dual-file — JiraIssue lives in jira.ts:139
```
**Note:** Importing `JiraIssue` from `'../../jira'` (the legacy `src/services/jira.ts`) honors the dual-file gotcha (memory `project_jira_ts_dual_file.md`). Do NOT re-define `JiraIssue` locally.

**Body skeleton** (RESEARCH §Pattern 2 ll. 587–604):
```ts
export function adaptIssue(
  gh: GhIssue | GhBoardIssue,
  entityMaps: EntityMaps,
  storyPointsFieldKey: string,
): JiraIssue & {
  timeInColumn?: GhBoardIssue['timeInColumn'];
  color: string; flagged: boolean; done: boolean;
} {
  const status = resolveStatus(gh.statusId, entityMaps);
  // D-03 override: gh.done wins over resolved category
  const categoryKey: 'new' | 'indeterminate' | 'done' =
    gh.done && status.statusCategory.key !== 'done' ? 'done' : status.statusCategory.key;
  // D-02 gate: only synthesize customfield_10016 if statFieldId matches
  const storyPoints =
    gh.estimateStatistic.statFieldId === storyPointsFieldKey
      ? gh.estimateStatistic.statFieldValue.value ?? null
      : null;
  // ... assemble JiraIssue per Adapter Mapping Table (RESEARCH ll. 257-278)
}
```

**Field-by-field mapping:** RESEARCH §"Adapter Mapping Table" (ll. 254–283) is exhaustive. Every cell has source + target + edge note. Planner should embed the relevant row as a JSDoc comment above each assignment so the table travels with the code.

**Ambiguity defaults (RESEARCH ll. 279–283):**
1. `fields.parent.fields.summary` → `''` (parent summary not in GH child row; comment required)
2. `assignee.avatarUrls['48x48']` → `gh.avatarUrl ?? ''` (GH has single URL)
3. No top-level `epic` field on `fields` in Phase 71 (epic consumption is Phase 73 via entityMaps)

---

### `src/services/jira/greenhopper/adapter.test.ts` (fixture-driven)

**Analog:** RESEARCH §"Common Operation 2" (ll. 695–719) gives the import-fixture-as-JSON skeleton.

**Skeleton from RESEARCH ll. 698–719:**
```ts
import { describe, it, expect } from 'vitest';
import allData from './__fixtures__/allData.real.json';
import { buildEntityMaps } from './entityMaps';
import { adaptIssue } from './adapter';
import type { GhAllDataResponse } from './types';

describe('adaptIssue (real capture)', () => {
  const typed = allData as unknown as GhAllDataResponse;
  const maps = buildEntityMaps(typed);

  it('produces a JiraIssue-shaped object for every issue', () => {
    for (const gh of typed.issuesData.issues) {
      const out = adaptIssue(gh, maps, 'customfield_10016');
      expect(out.id).toBe(String(gh.id));
      expect(out.key).toBe(gh.key);
      expect(out.fields.status.id).toBe(gh.statusId);
      expect(out.fields.issuetype.subtask).toBe(gh.parentId !== undefined);
      expect(out.done).toBe(gh.done);
    }
  });
});
```

**Required edge-fixture tests (D-11) — handwritten inline TS literals next to the test, no separate file needed:**
- subtask with `parentId` → `fields.issuetype.subtask === true` AND `fields.parent.id === String(parentId)`
- issue with valid `epicId` resolved via `resolveEpic`
- issue with `statusId` NOT in entityMaps → output `status.name === 'Unknown'`, `console.warn` fired (D-07)
- `estimateStatistic.statFieldValue.value` absent → `customfield_10016 === null`
- `estimateStatistic.statFieldId !== storyPointsFieldKey` → `customfield_10016 === null` (D-02 gate)
- `flagged: true` → `out.flagged === true`; absent → `false`
- `done: true` + `statusCategory.key === 'indeterminate'` → `out.fields.status.statusCategory.key === 'done'` (D-03 override)
- `columnsData` with multi-column-per-status — fixture-only structural assertion (RESEARCH Pitfall 6)

---

### `src/services/jira/greenhopper/index.ts` (barrel)

**Analog:** `taskflow/src/services/aio/index.ts` (entire file, 13 lines)

**Copy verbatim:**
```ts
/**
 * GreenHopper service submodules barrel export.
 *
 * client.ts is intentionally NOT exported — it is internal to greenhopper/ (D-06).
 * Domain modules import greenhopperFetch directly from './client'.
 */

export * from './adapter';
export * from './allData';
export * from './data';
export * from './details';
export * from './entityMaps';
export * from './transitions';
export * from './types';
```

**Deviation:** None. The doc-comment line ("client.ts is intentionally NOT exported") is mandatory per D-06.

---

### `src/services/jira.ts` (legacy dual-file — APPEND re-export block per D-05)

**Analog:** `src/services/jira.ts` lines 23–28 (existing re-export style at the top of the file):

```ts
import { isResponseLikeError } from './jira/client';

export { addIssuesToSprint } from './jira/sprints';
// Re-export changelog and watcher modules for barrel access via '@/services/jira'
export * from './jira-changelog';
export * from './jira-watchers';
```

**Action:** Add a new block (location: near the other re-export block at the top, OR at the bottom — match whatever the existing additions did most recently). RESEARCH ll. 484–506 has the exact block to paste:

```ts
export {
  fetchAllData,
  fetchBacklogData,
  fetchIssueDetails,
  fetchGhTransitions,
  adaptIssue,
  buildEntityMaps,
  resolveStatus,
  resolvePriority,
  resolveType,
  resolveEpic,
  resolveParent,
} from './jira/greenhopper';

export type {
  GhIssue, GhBoardIssue, GhAllDataResponse, GhBacklogResponse,
  GhDetailsResponse, GhTransitionsResponse, GhTransition,
  EntityMaps,
} from './jira/greenhopper';
```

**Verification grep (RESEARCH Pitfall 1):**
```bash
grep -n "from './jira/greenhopper'" taskflow/src/services/jira.ts
# must show two matches (value re-export + type re-export blocks)
```

**Deviation:** None. This is the single integration point the consumers in Phases 72-75 import from.

---

### `src/services/jira/greenhopper/__fixtures__/{allData,data,details,transitions}.real.json`

**Analog:** None in-tree (no existing `__fixtures__/` directory anywhere — confirmed via `find src -type d -name __fixtures__`).

**Convention to establish (new):**
- One JSON file per endpoint, named `{endpoint}.real.json`
- Committed (not gitignored)
- Imported in tests via `import x from './__fixtures__/x.real.json'` (vitest 4 handles JSON natively per `resolveJsonModule`)
- Redacted per D-10 + RESEARCH §"Capture Script" redaction table (ll. 360–373)

**No code excerpt — these are data files produced by the capture script.**

---

### `scripts/capture-greenhopper.mjs` (Node CLI, dev-only)

**Analog:** `taskflow/scripts/bump-version.mjs` (lines 1–40) — closest in role (Node CLI, env-driven, writes files to repo). No precedent for HTTP capture; this is the first.

**File-extension choice:** `.mjs` (not `.ts`) because `tsx` is not in devDependencies (verified: `grep '"tsx"' package.json` → no match). Adding a dev-dep for a one-shot tool is not justified (RESEARCH Open Question 3).

**Shebang + header doc + arg-parse pattern** (bump-version.mjs:1–30):
```js
#!/usr/bin/env node
// capture-greenhopper.mjs — One-shot capture of GreenHopper API responses with redaction.
// Usage: JIRA_BASE_URL=... JIRA_PAT=... BOARD_ID=... ISSUE_KEY=... PROJECT_ID=... \
//        node scripts/capture-greenhopper.mjs
//
// Writes redacted JSON fixtures into src/services/jira/greenhopper/__fixtures__/.
// Re-run when GH response shape may have drifted; commit the updated fixtures.

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TASKFLOW_ROOT = resolve(__dirname, '..');
```

**Env validation pattern (mirror bump-version.mjs:21–30):**
```js
const required = ['JIRA_BASE_URL', 'JIRA_PAT', 'BOARD_ID', 'ISSUE_KEY', 'PROJECT_ID'];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`Error: ${k} env var is required.`);
    process.exit(1);
  }
}
```

**HTTP — Node 18+ global `fetch` (NOT `apiFetch`)** — RESEARCH Pitfall 8 + ll. 379–381 explain why (apiFetch lives in the Tauri renderer, touches auth store on 401):
```js
async function get(path) {
  const res = await fetch(`${process.env.JIRA_BASE_URL.replace(/\/$/, '')}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.JIRA_PAT}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}
```

**Endpoints (RESEARCH ll. 350–354):**
1. `/rest/greenhopper/1.0/xboard/work/allData.json?rapidViewId={BOARD_ID}`
2. `/rest/greenhopper/1.0/xboard/plan/backlog/data.json?rapidViewId={BOARD_ID}`
3. `/rest/greenhopper/1.0/xboard/issue/details.json?rapidViewId={BOARD_ID}&issueIdOrKey={ISSUE_KEY}&loadSubtasks=true`
4. `/rest/greenhopper/1.0/xboard/work/transitions.json?projectId={PROJECT_ID}`

**Redaction map (RESEARCH ll. 360–373) — mandatory.** A shared `keyMap: Map<string, string>` produces stable `PROJ-{n}` numbering across all four output files. Per-field replacements per the table; `details.json` HTML/editHtml fields → literal placeholder string (NOT regex redaction — RESEARCH Pitfall 7).

**Output paths:**
```js
const FIX_DIR = resolve(TASKFLOW_ROOT, 'src/services/jira/greenhopper/__fixtures__');
writeFileSync(resolve(FIX_DIR, 'allData.real.json'), JSON.stringify(redactedAllData, null, 2));
// ... three more
```

**Deviation:** This is a new script type — keep the shebang + header pattern from bump-version.mjs but the body is largely net-new. Add a "Why we don't use `apiFetch`" comment block referencing RESEARCH Pitfall 8.

---

## Shared Patterns

### Authentication
**Source:** `taskflow/src/services/tempo/client.ts:42–52` (and aio/client.ts:45–56 — identical)
**Apply to:** `greenhopper/client.ts` only (all domain modules call `greenhopperFetch`, which carries the header)
```ts
return apiFetch(
  'jira',  // ← differs from tempo's 'tempo' and aio's 'aio' (D-04 + Pitfall 8)
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
```

### Error Handling Envelope
**Source:** `taskflow/src/services/jira/transitions.ts:19–41`
**Apply to:** All four greenhopper fetchers (`allData.ts`, `data.ts`, `details.ts`, `transitions.ts`)
```ts
let response: Response;
try {
  response = await greenhopperFetch(baseUrl, token, path, operation);
} catch {
  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}
if (!response.ok) {
  if (response.status === 401 || response.status === 403) {
    throw new ApiError('<message>', response.status, 'jira');
  }
  throw new Error(`<endpoint> failed: status ${response.status}`);
}
return (await response.json()) as <TypedResponse>;
```

### Test Mock Setup
**Source:** `taskflow/src/services/aio/projects.test.ts:1–15`
**Apply to:** All five fetcher tests + entityMaps + adapter tests
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));
vi.mock('./client', () => ({
  greenhopperFetch: vi.fn(),
  GREENHOPPER_API_PATH: '/rest/greenhopper/1.0/xboard',
}));
import { apiFetch } from '../../lib/apiFetch';
import { greenhopperFetch } from './client';
// ... import SUT
const mockedGhFetch = vi.mocked(greenhopperFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
beforeEach(() => { vi.clearAllMocks(); });
```

### Doc-Comment Header (Module Purpose + Provenance)
**Source:** `taskflow/src/services/aio/client.ts:1–11`, `aio/types.ts:1–11`
**Apply to:** Every new `.ts` file in `greenhopper/`
- Line 1: one-sentence purpose
- Lines 2–3: scope (what this file owns vs. delegates)
- Lines 4–N: provenance — phase + decision IDs (e.g., "D-04: lives under jira/greenhopper/", "Phase 71 RESEARCH §Adapter Mapping Table")

### Barrel-Export Convention (no client.ts)
**Source:** `taskflow/src/services/aio/index.ts:1–13`, `tempo/index.ts:1–10`
**Apply to:** `greenhopper/index.ts`
- Doc-comment must state "client.ts is intentionally NOT exported" (D-06)

## No Analog Found

| File | Role | Data Flow | Reason | Mitigation |
|------|------|-----------|--------|------------|
| `src/services/jira/greenhopper/entityMaps.ts` | utility (pure resolvers + warnOnce) | transform | No existing map/resolver helper in `src/services/` — none of the existing fetchers translate ids to display objects via a passed-in map | Use RESEARCH §Entity Map Shape (ll. 287–346) as canonical spec; the helper body is pre-written there |
| `src/services/jira/greenhopper/adapter.ts` | utility (pure transformer) | transform | No GH→app-shape transformer exists; existing services either return raw API shapes or already-app-shape via direct construction | Use RESEARCH §Adapter Mapping Table (ll. 254–283) as authoritative field-by-field reference; embed table rows as JSDoc above each assignment |
| `src/services/jira/greenhopper/__fixtures__/*.real.json` | data | n/a | No `__fixtures__/` directory anywhere under `src/` (verified via find) | First-time pattern; D-10 redaction map + capture script produce them; commit policy: yes |
| `scripts/capture-greenhopper.mjs` (HTTP-capture portion) | script | request-response | No existing capture/probe script in `scripts/` — v1.8 and v1.9 probes were ad-hoc and not committed | Use `scripts/bump-version.mjs` for the Node CLI skeleton (shebang, env validation, file I/O); the HTTP + redaction body is net-new |

## Metadata

**Analog search scope:**
- `taskflow/src/services/jira/` (16 modules)
- `taskflow/src/services/tempo/` (3 modules + client)
- `taskflow/src/services/aio/` (4 modules + client + types)
- `taskflow/scripts/` (3 files)
- `taskflow/src/services/jira.ts` (legacy dual-file)

**Files scanned:** 21 source files + 4 scripts + 1 package.json

**Pattern extraction date:** 2026-05-28

**Key decisions confirmed against codebase:**
- `apiFetch` source union is `'jira' | 'gitlab' | 'aio' | 'updater' | 'tempo'` — greenhopper passes `'jira'` (D-04 + Pitfall 8)
- `tsx` is NOT in devDependencies → capture script is `.mjs` (RESEARCH Open Q 3 resolved)
- No `__fixtures__/` directory exists → greenhopper is the first
- `src/services/jira.ts:139` houses `JiraIssue` (target for D-01 superset) and `src/services/jira.ts:183` houses `JiraTransition`
- Existing jira.ts re-export style (lines 23–28) is the template for the D-05 block
