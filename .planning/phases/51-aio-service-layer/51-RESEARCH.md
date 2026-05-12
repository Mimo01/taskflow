# Phase 51: AIO Service Layer - Research

**Researched:** 2026-05-12
**Domain:** Tauri + Zustand store migration / TypeScript service module / vitest unit tests
**Confidence:** HIGH (all findings verified against live codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Probe is external (curl/Postman). Developer runs probe during Phase 51 and records the working base path and auth scheme as Key Decisions in this CONTEXT.md (not in settings.store, not auto-detected at runtime).
- **D-02:** Plan must include specific curl commands for all 3 known base path variants: `/rest/aio-tcms/1.0/`, `/rest/aio-tcms-api/1.0/`, `/plugins/servlet/aio/`. Auth: `Authorization: Bearer <jiraPat>`. Test both GET `/project` and GET `/testrun?issueKey=<key>`.
- **D-03:** Probe findings (working base path, confirmed auth scheme, whether `issueKey` query param works on `/testrun`) are recorded as Key Decisions in CONTEXT.md — NOT in runtime app config.
- **D-04:** Keep an explicit `aioEnabled` boolean toggle (gates all AIO API calls).
- **D-05:** Toggle lives in a new 'Integrations' section added to the Settings sidebar (5th entry after Connections, Appearance, Notifications, Workflow... actually 6th entry — see Settings.tsx: connections, appearance, sidebar, notifications, workflow, updates, advanced — insert after workflow, before updates).
- **D-06:** `aioEnabled: boolean` stored in `useSettingsStore` with version bump v14 → v15. Default: `false`. Migration: `if (version < 15) { s.aioEnabled = false; }`.
- **D-07:** No separate AIO URL input field. AIO is on same Jira host; base path is derived as `jiraBaseUrl + AIO_API_PATH`.
- **D-08:** Working base path hard-coded as `AIO_API_PATH` constant in `src/services/aio/client.ts`, set from probe findings before any code is written.
- **D-09:** All AIO calls use `apiFetch('jira', url, { headers })` — same Bearer PAT from Stronghold key `'jira-pat'`, `source: 'jira'`. No changes to `apiFetch`.
- **D-10:** No global mapping Jira project key → AIO project ID. Resolution is lazy per feature.
- **D-11:** Probe must confirm `GET /testrun?issueKey=PROJ-123` works without project ID.
- **D-12:** `GET /project` returns all AIO projects directly — no Jira mapping needed.

### Claude's Discretion

- Domain module file names inside `src/services/aio/` (Phase 51 scope: `client.ts`, `types.ts`, `projects.ts`, `issue-runs.ts`, `index.ts` — `cycles.ts` and `runs.ts` deferred to Phase 52+).
- Test file structure and specific assertion patterns.
- Exact TypeScript interface shapes for AIO response types (to be finalized after probe confirms actual response shapes).

### Deferred Ideas (OUT OF SCOPE)

- Auto-detect AIO availability on startup.
- Separate `aioBaseUrl` input in Settings.
- In-app 'Test AIO Connection' button.
- `cycles.ts` and `runs.ts` service modules (Phase 52+).
- Any UI pages, sidebar routing, or query hooks for AIO data.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AION-05 | User can enable/disable AIO integration from Settings (aioEnabled toggle) | Settings store migration pattern verified (v14→v15), WorkflowSection.tsx checkbox pattern verified, Settings.tsx SECTIONS array verified |
</phase_requirements>

---

## Summary

Phase 51 is a foundation phase with three independent deliverables: (1) an external curl probe to confirm the live AIO instance's auth scheme and base path, (2) the `src/services/aio/` service module mirroring the `jira/` directory structure, and (3) an `aioEnabled` toggle in a new Settings → Integrations section backed by a Zustand store migration.

All three areas have clear existing patterns to mirror. The settings store migration is a well-established sequential `if (version < N)` guard pattern — currently at v14, adding v15 for `aioEnabled`. The service module structure mirrors `src/services/jira/` exactly: `client.ts` (internal only, not barrel-exported), `types.ts`, domain modules, and `index.ts`. Test files follow `vi.mock('../../lib/apiFetch', ...)` + `vi.mocked(apiFetch).mockResolvedValue(...)` vitest patterns with `beforeEach(() => vi.clearAllMocks())`.

The hard blocker is the curl probe: `AIO_API_PATH` constant in `aio/client.ts` must be set from probe findings before any TypeScript service code is written. The plan must sequence probe → record Key Decisions → write service code.

**Primary recommendation:** Sequence the plan as three waves: (1) probe + record findings, (2) store migration + IntegrationsSection UI, (3) AIO service module + unit tests. Waves 2 and 3 can run in parallel after wave 1 completes.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AIO toggle preference storage | Frontend (Zustand persist) | — | Local user preference, Tauri Store backed, no server component |
| AIO toggle UI (IntegrationsSection) | Frontend component | — | Pure settings UI, synchronous store write |
| AIO API calls (projects, issue-runs) | Service module (`src/services/aio/`) | — | Mirrors jira/ pattern; functions receive baseUrl + token as params |
| Bearer PAT retrieval | Stronghold (Tauri) | — | PAT never stored in Zustand; read via `readSecret('jira-pat')` at call time |
| Base path constant | Static code (`aio/client.ts`) | — | Hard-coded from probe findings; not configurable at runtime |
| Curl probe | Developer machine (external) | — | D-01: Not an in-app feature |

---

## Standard Stack

### Core (all already installed — no new dependencies for Phase 51)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | (existing) | Settings store migration | Already used for all app state |
| @tauri-apps/plugin-store | (existing) | Persist settings to disk | Already used by `settings.store.ts` |
| @tauri-apps/plugin-stronghold | (existing) | PAT retrieval via `readSecret('jira-pat')` | All PATs stored here |
| vitest | (existing) | Unit tests | Project standard |
| lucide-react | (existing) | `<Plug>` icon for Settings nav entry | Project icon library |

**No new npm dependencies required for Phase 51.** [VERIFIED: package.json]

---

## Architecture Patterns

### System Architecture Diagram

```
Developer curl probe
       |
       v
Probe results (base path, auth scheme)
       |
       v (recorded as Key Decisions in CONTEXT.md)
       |
aio/client.ts ← AIO_API_PATH constant (hard-coded)
       |
       +──────────────────────────────────+
       |                                  |
aio/projects.ts                  aio/issue-runs.ts
fetchAioProjects(baseUrl, token)  fetchAioRunsForIssue(baseUrl, token, issueKey)
       |                                  |
       +──────────────────────────────────+
       |
apiFetch('jira', url, { headers: { Authorization: `Bearer ${token}` } })
       |
       v
Live AIO REST API (same Jira host)
```

Settings toggle flow:
```
Settings.tsx → SECTIONS array → 'integrations' nav entry
       |
       v
IntegrationsSection.tsx
  useSettingsStore().aioEnabled
  useSettingsStore().setAioEnabled
       |
       v
settings.store.ts (Zustand persist v15, Tauri Store 'settings.json')
```

### Recommended Project Structure

```
src/services/aio/
├── client.ts        # internal: aioFetch() wrapper, AIO_API_PATH constant — NOT in barrel
├── types.ts         # AioProject, AioTestRun, AioIssueRun interfaces
├── projects.ts      # fetchAioProjects(baseUrl, token): Promise<AioProject[]>
├── issue-runs.ts    # fetchAioRunsForIssue(baseUrl, token, issueKey): Promise<AioIssueRun[]>
└── index.ts         # barrel: export * from './types'; export * from './projects'; export * from './issue-runs';

src/routes/settings/
└── IntegrationsSection.tsx   # new component — mirrors WorkflowSection.tsx

src/stores/
└── settings.store.ts         # modified: add aioEnabled, bump version 14→15
```

### Pattern 1: Zustand Store Version Migration

**What:** Sequential `if (version < N)` guards in the `migrate` callback, each guard initializing new fields.
**When to use:** Any time a new field is added to the persisted settings state.

```typescript
// Source: taskflow/src/stores/settings.store.ts (verified live)
// Inside persist({ ... }, { version: 15, migrate: (persisted, version) => {
//   const s = persisted as Record<string, unknown>;
//   ...existing guards...
//   if (version < 15) {
//     if (s.aioEnabled === undefined) s.aioEnabled = false;
//   }
//   return persisted as SettingsState;
// }})
```

Key implementation details [VERIFIED: settings.store.ts]:
- `version` field on the persist config object is set to the NEW version (15).
- The `migrate` function receives the OLD version number in its second parameter.
- Each guard uses `if (version < N)` not `if (version === N-1)`.
- Always check `=== undefined` before setting the default, so re-migration is idempotent.
- The new field must also be added to the `SettingsState` interface and the initial state object.

### Pattern 2: Settings Sidebar Section

**What:** `SECTIONS` array drives the Settings nav. `SettingsSection` union type is the TypeScript discriminant.
**When to use:** Adding any new Settings top-level section.

Current SECTIONS order in `Settings.tsx` [VERIFIED: live code]:
1. connections (`<Link2>`)
2. appearance (`<Palette>`)
3. sidebar (`<PanelLeft>`)
4. notifications (`<Bell>`)
5. workflow (`<GitBranch>`)
6. updates (`<RefreshCw>`)
7. advanced (`<Settings2>`)

D-05 specifies 'integrations' goes after 'workflow', before 'updates'. That makes it 6th.

```typescript
// Source: taskflow/src/routes/settings/Settings.tsx (verified live)

// 1. Extend the union type:
type SettingsSection =
  | 'connections' | 'appearance' | 'sidebar' | 'notifications'
  | 'workflow' | 'integrations' | 'updates' | 'advanced';

// 2. Add SECTIONS entry (after workflow, before updates):
{ id: 'integrations', label: 'Integrations', icon: <Plug className="h-4 w-4" /> }

// 3. Add import at top:
import { Bell, GitBranch, Link2, Palette, PanelLeft, Plug, RefreshCw, Settings2 } from 'lucide-react';

// 4. Add to content area render:
{activeSection === 'integrations' && <IntegrationsSection />}

// 5. Add import:
import IntegrationsSection from './IntegrationsSection';
```

### Pattern 3: Settings Section Component (checkbox toggle)

**What:** Each Settings section is a standalone component that reads directly from the store.
**When to use:** Any new Settings section with toggle controls.

```typescript
// Source: taskflow/src/routes/settings/WorkflowSection.tsx (verified live)
// IntegrationsSection.tsx mirrors this pattern exactly:

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

### Pattern 4: AIO Client Module

**What:** Internal module that wraps `apiFetch` with the AIO-specific base URL construction. Not exported from `index.ts` barrel.
**When to use:** Always accessed only from within `src/services/aio/` domain modules.

```typescript
// src/services/aio/client.ts
import { apiFetch } from '../../lib/apiFetch';

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

### Pattern 5: AIO Domain Module

**What:** Domain functions receive `baseUrl` and `token` as params. They throw `ApiError` on 401/403, return typed data on success, and throw or return null/empty on other failures — matching the jira/ module pattern.

```typescript
// src/services/aio/projects.ts (example — verified against jira/projects.ts pattern)
import { ApiError } from '../../lib/api-error';
import { aioFetch } from './client';
import type { AioProject } from './types';

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

### Pattern 6: Service Module Test

**What:** Mock `apiFetch` at the top of the test file using `vi.mock`, then use `vi.mocked(apiFetch).mockResolvedValue(...)` for each test case. `beforeEach(() => vi.clearAllMocks())`.
**When to use:** All AIO service module tests.

```typescript
// src/services/aio/projects.test.ts (verified against jira/projects.test.ts)
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
});
```

**Critical detail:** The `vi.mock(...)` call must appear BEFORE the import of the module under test. Vitest hoists `vi.mock` calls but the import order in the file matters for readability and convention — see all existing `*.test.ts` files for the exact pattern. [VERIFIED: jira/projects.test.ts, jira/sprints.test.ts]

### Anti-Patterns to Avoid

- **Exporting `aioFetch` from `index.ts` barrel:** `client.ts` is internal-only. Only types and domain functions go in the barrel. [VERIFIED: jira/index.ts does NOT export from client.ts]
- **Storing `aioEnabled` in auth.store:** Goes in `settings.store` — it is a user preference, not a connection state.
- **Writing AIO TypeScript before probe:** `AIO_API_PATH` is a hard dependency of `aio/client.ts`. Without it, the constant is a placeholder that cannot be tested against reality.
- **Using `vi.mock` after imports:** Must appear before the module under test import. Vitest hoists but ordering convention matters.
- **Adding new fields to `apiFetch` source union:** D-09 explicitly forbids this. AIO uses `source: 'jira'` unchanged.

---

## Curl Probe Commands

D-02 specifies that the plan must include curl commands for all 3 base path variants × 2 endpoints.

The probe uses the same Bearer PAT stored for Jira. The developer substitutes:
- `JIRA_BASE` = their Jira instance base URL (e.g., `https://jira.example.com`)
- `PAT` = the Jira Personal Access Token

**Variant 1: `/rest/aio-tcms/1.0/`**
```bash
# GET /project
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $PAT" \
  "$JIRA_BASE/rest/aio-tcms/1.0/project"

# GET /testrun?issueKey=
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $PAT" \
  "$JIRA_BASE/rest/aio-tcms/1.0/testrun?issueKey=PROJ-1"
```

**Variant 2: `/rest/aio-tcms-api/1.0/`**
```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $PAT" \
  "$JIRA_BASE/rest/aio-tcms-api/1.0/project"

curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $PAT" \
  "$JIRA_BASE/rest/aio-tcms-api/1.0/testrun?issueKey=PROJ-1"
```

**Variant 3: `/plugins/servlet/aio/`**
```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $PAT" \
  "$JIRA_BASE/plugins/servlet/aio/project"

curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $PAT" \
  "$JIRA_BASE/plugins/servlet/aio/testrun?issueKey=PROJ-1"
```

**For the working variant, also capture the full response body to understand shape:**
```bash
curl -s \
  -H "Authorization: Bearer $PAT" \
  "$JIRA_BASE/<working-base-path>/project" | python3 -m json.tool

curl -s \
  -H "Authorization: Bearer $PAT" \
  "$JIRA_BASE/<working-base-path>/testrun?issueKey=PROJ-1" | python3 -m json.tool
```

**Expected outcomes to record as Key Decisions:**
1. Which base path variant returns 200 (the others should return 404 or redirect).
2. Whether Bearer PAT is the correct auth scheme (200 = confirmed; 401 = wrong auth).
3. Whether `/testrun?issueKey=PROJ-1` returns runs without requiring a project ID (D-11).
4. The actual JSON shape of `/project` and `/testrun` responses — drives `types.ts` interfaces.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP fetch with auth | Custom fetch | `apiFetch('jira', url, { headers })` | Already handles timeout (15s), dev tools logging, 401 disconnect detection |
| Store persistence | Custom localStorage | `createTauriStorage('settings.json')` in existing persist config | Already set up; all settings go through the same Tauri Store file |
| PAT retrieval | Store PAT in state | `readSecret('jira-pat')` from `stronghold.ts` | Security requirement — PATs never in Zustand |
| Error types | Custom error class | `ApiError` from `lib/api-error.ts` | Existing consumers (ErrorState component) detect ApiError by shape |

---

## Common Pitfalls

### Pitfall 1: Writing service code before probe confirms base path
**What goes wrong:** `AIO_API_PATH` is a placeholder; all tests pass locally but every real API call 404s.
**Why it happens:** Optimistic assumption about which AIO REST base path the live instance uses.
**How to avoid:** The plan must gate service code on a probe task that runs first and records findings as Key Decisions.
**Warning signs:** If a developer proposes writing `aio/client.ts` before curl probe results are recorded, reject the task ordering.

### Pitfall 2: Version migration guard not applied to `migrate` function
**What goes wrong:** Existing users on v14 store get `aioEnabled: undefined` in their persisted state, causing TypeScript runtime errors.
**Why it happens:** Adding the field to the initial state object but forgetting the `if (version < 15)` guard in `migrate`.
**How to avoid:** Every new field must have both: (a) a default in the initial state, and (b) a `if (version < 15) { if (s.aioEnabled === undefined) s.aioEnabled = false; }` guard. [VERIFIED: settings.store.ts migration pattern]

### Pitfall 3: Version number not bumped on persist config
**What goes wrong:** Migration guard runs but Zustand never calls `migrate` because the stored version equals the config version.
**Why it happens:** Updating the `migrate` function but forgetting to change `version: 14` → `version: 15` in the persist options object.
**How to avoid:** Bump the `version:` field on the `persist` options object (not just inside the migrate function). [VERIFIED: settings.store.ts]

### Pitfall 4: Exporting aio/client.ts internals from barrel
**What goes wrong:** Phase 52+ code imports `aioFetch` directly, bypassing the domain module abstraction layer.
**Why it happens:** Developer adds `export * from './client'` to `index.ts` for convenience.
**How to avoid:** `index.ts` should only export from `./types`, `./projects`, `./issue-runs` — not `./client`. [VERIFIED: jira/index.ts follows this exactly]

### Pitfall 5: `vi.mock` import order
**What goes wrong:** Mocked module is not hoisted, real `apiFetch` is called, tests fail with Tauri IPC errors.
**Why it happens:** `vi.mock` call placed after `import { apiFetch }` in the test file.
**How to avoid:** Always put `vi.mock(...)` before the module-under-test import. [VERIFIED: all jira/*.test.ts files]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Import Stronghold anywhere | Stronghold isolated to `stronghold.ts` | Phase 5 | Only `readSecret()` exported; no other file imports `@tauri-apps/plugin-stronghold` |
| Direct localStorage for settings | Zustand persist with Tauri Store adapter | Phase 1 | Settings survive app reinstall; works on all platforms |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (with jsdom environment) |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run src/services/aio/ --reporter=verbose` |
| Full suite command | `cd taskflow && npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AION-05 | `aioEnabled` defaults to false in store | unit | `npx vitest run src/stores/settings.store.test.ts -t "aioEnabled"` | ❌ Wave 0 |
| AION-05 | `aioEnabled` persists across store rehydration | unit | same | ❌ Wave 0 |
| AION-05 | `setAioEnabled(true/false)` updates store | unit | same | ❌ Wave 0 |
| AION-05 | `fetchAioProjects` returns list on 200 | unit | `npx vitest run src/services/aio/projects.test.ts` | ❌ Wave 0 |
| AION-05 | `fetchAioProjects` throws ApiError on 401 | unit | same | ❌ Wave 0 |
| AION-05 | `fetchAioProjects` returns [] on 404 | unit | same | ❌ Wave 0 |
| AION-05 | `fetchAioRunsForIssue` returns runs on 200 | unit | `npx vitest run src/services/aio/issue-runs.test.ts` | ❌ Wave 0 |
| AION-05 | `fetchAioRunsForIssue` throws ApiError on 401 | unit | same | ❌ Wave 0 |
| AION-05 | `fetchAioRunsForIssue` returns [] on 404 / empty response | unit | same | ❌ Wave 0 |
| AION-05 | IntegrationsSection renders checkbox | unit | `npx vitest run src/routes/settings/IntegrationsSection.test.tsx` | ❌ Wave 0 |
| AION-05 | IntegrationsSection toggle updates store | unit | same | ❌ Wave 0 |
| SC-2 | When aioEnabled=false, AIO store flag is false | unit | settings.store.test.ts | ❌ Wave 0 |

Note: SC-2 = Success Criterion 2 (when AIO disabled, no calls made). The service-level gate is that callers check `aioEnabled` before calling — this is verified by reading `aioEnabled` from store in Phase 54 components, not by the service module itself.

### Sampling Rate

- **Per task commit:** `cd taskflow && npx vitest run src/services/aio/ src/routes/settings/IntegrationsSection.test.tsx --reporter=verbose`
- **Per wave merge:** `cd taskflow && npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

All test files for this phase are new:
- [ ] `taskflow/src/services/aio/projects.test.ts` — covers fetchAioProjects happy path, 401, 404
- [ ] `taskflow/src/services/aio/issue-runs.test.ts` — covers fetchAioRunsForIssue happy path, 401, 404, empty list
- [ ] `taskflow/src/services/aio/client.test.ts` — covers aioFetch URL construction (AIO_API_PATH prepend, trailing slash handling)
- [ ] `taskflow/src/stores/settings.store.test.ts` — covers aioEnabled default, setAioEnabled, migration from v14
- [ ] `taskflow/src/routes/settings/IntegrationsSection.test.tsx` — covers render, checkbox toggle

No new test infrastructure required — vitest, jsdom, @testing-library/react, and the Tauri mocks in `src/test/setup.ts` are all already set up. [VERIFIED: vitest.config.ts, src/test/setup.ts]

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Bearer PAT via Stronghold; same scheme as Jira — no new auth mechanism |
| V3 Session Management | No | No sessions; stateless token per request |
| V4 Access Control | No | AIO is read-only in Phase 51; no write actions |
| V5 Input Validation | Yes | AIO API responses parsed with optional chaining; no raw string interpolation from response data into URLs |
| V6 Cryptography | No | PAT handled entirely by existing Stronghold infrastructure |

### Known Threat Patterns for AIO REST API

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PAT in Zustand state | Information Disclosure | `readSecret('jira-pat')` only — PAT never touches Zustand |
| SSRF via user-supplied base URL | Elevation of Privilege | No new URL inputs in Phase 51; `jiraBaseUrl` from auth store (already validated during Jira connection setup) |
| Response injection (XSS from API data) | Tampering | AIO data rendered in Phase 54 only; Phase 51 returns raw typed data, no DOM injection |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| curl | Curl probe (D-02) | ✓ | system curl | — |
| Jira PAT (developer's own) | Probe auth | — | n/a | Probe cannot run without it |
| Live AIO instance | Probe | — | unknown | None — probe is hard blocker |

**Missing dependencies with no fallback:**
- Live AIO instance access: the probe cannot be automated or mocked. If the developer does not have access to the AIO-enabled Jira instance, Phase 51 cannot complete the probe task. This is a known hard blocker (D-01 / Specifics).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Plug` icon from lucide-react is available (it is in the installed lucide-react package) | Standard Stack | Low — lucide-react is installed; if `Plug` doesn't exist, use `Cable` or `Link2` instead |
| A2 | AIO REST API returns JSON arrays (not paginated objects) for `/project` and `/testrun?issueKey=` | Code Examples / types.ts | Medium — if paginated, domain modules need a page-unwrap layer |
| A3 | Bearer PAT (not Basic auth) is the correct AIO auth scheme — same as Jira PAT | Curl Probe section | High — if Basic auth required, `aioFetch` auth header construction changes. **Confirmed by probe.** |
| A4 | `/testrun?issueKey=PROJ-1` works without a project ID | issue-runs.ts pattern | High (D-11 — probe must confirm). If project ID required, fallback logic needed |

---

## Open Questions

1. **Actual AIO response shapes**
   - What we know: AIO TCMS has `/project` and `/testrun?issueKey=` endpoints.
   - What's unclear: Exact field names in JSON responses (id, name, key? projectId? runId?).
   - Recommendation: Probe includes full response body capture (see curl commands above). TypeScript interfaces in `types.ts` are drafted from probe output, not assumed.

2. **Settings SECTIONS position note**
   - What we know: CONTEXT.md says "5th entry after Connections, Appearance, Notifications, Workflow". But live Settings.tsx has 7 sections; 'integrations' after 'workflow' is actually 6th.
   - What's unclear: Whether D-05 means "after Workflow" (positional) or "5th" (ordinal).
   - Recommendation: Follow the positional rule ("after workflow, before updates"). The live SECTIONS array is the truth.

---

## Sources

### Primary (HIGH confidence — verified against live codebase)

- `taskflow/src/stores/settings.store.ts` — complete migration pattern, version 14, all field types
- `taskflow/src/routes/settings/Settings.tsx` — SECTIONS array, SettingsSection union type, render pattern
- `taskflow/src/routes/settings/WorkflowSection.tsx` — checkbox toggle pattern (exact classes, aria-label, accent-primary)
- `taskflow/src/services/jira/client.ts` — internal client module pattern (not barrel-exported)
- `taskflow/src/services/jira/projects.ts` — domain function signature (baseUrl, token params), ApiError throwing
- `taskflow/src/services/jira/projects.test.ts` — vitest mock pattern, happy path + 401 + 403
- `taskflow/src/services/jira/sprints.test.ts` — mockResolvedValue pattern, clearAllMocks
- `taskflow/src/services/jira/client.test.ts` — vi.mock before import ordering
- `taskflow/src/services/jira/index.ts` — barrel exports (no client.ts)
- `taskflow/src/lib/apiFetch.ts` — source union type ('jira' | 'gitlab'), timeout, 401 detection
- `taskflow/src/lib/api-error.ts` — ApiError constructor and isAuthError
- `taskflow/src/services/stronghold.ts` — readSecret('jira-pat') export
- `taskflow/vitest.config.ts` — jsdom environment, setupFiles path
- `taskflow/src/test/setup.ts` — LazyStore mock, crypto mock, jest-dom import

### Secondary (MEDIUM confidence)

- AIO TCMS base path variants from CONTEXT.md D-02 (sourced from community knowledge; exact variant confirmed only by probe)

### Tertiary (LOW confidence)

- AIO REST API response shapes — unknown until probe. `[ASSUMED]` in types.ts placeholder.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, verified in package.json
- Architecture: HIGH — jira/ module pattern is live and fully readable
- Settings store migration: HIGH — v14 pattern with 14 sequential guards is directly readable
- Curl probe commands: MEDIUM — base path variants from context; exact working variant is LOW until probe runs
- AIO response types: LOW — unknown until probe; types.ts must be drafted from probe output

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (stable codebase; only risk is if Phase 50 changed service patterns)
