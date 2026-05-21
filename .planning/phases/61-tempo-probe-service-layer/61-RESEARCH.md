# Phase 61: Tempo Probe + Service Layer - Research

**Researched:** 2026-05-21
**Domain:** Tempo Timesheets REST API (Data Center), TypeScript service module, Zustand settings store migration
**Confidence:** HIGH (codebase patterns); MEDIUM (Tempo DC API response shape — probe required to confirm)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Probe Strategy**
- D-01: Probe both `/rest/tempo-timesheets/4/` and `/rest/tempo-timesheets/3/` in that order against the live Jira DC instance. Try a simple GET to a worklogs or user endpoint on each path with `Authorization: Bearer <jira-pat>`.
- D-02: Document the working path (and any failed paths) in a `client.ts` comment, mirroring the AIO precedent from Phase 51.
- D-03: If Bearer PAT returns 401 on both paths, Phase 61 ends here — record failure in `client.ts` and CONTEXT.md, mark TEMPO-06 blocked. No service module files are built until auth is confirmed.

**Service Module Structure**
- D-04: `tempoFetch` mirrors `aioFetch` exactly: signature `(baseUrl, token, path, operation, apiPath, init?)`. Uses `apiFetch` wrapper.
- D-05: Tempo lives on the same host as Jira (`jiraBaseUrl`); same Jira PAT token (`readSecret('jira-pat')`).
- D-06: One `TEMPO_API_PATH` constant in `client.ts` (set to the probe-confirmed path).
- D-07: `worklogs.ts` implements fully paginated `fetchWorklogs(baseUrl, token, usernames, from, to)`, returns flat `TempoWorklog[]`.
- D-08: Primary filter axis: `usernames: string[]` + `from`/`to` date range (`YYYY-MM-DD` strings).
- D-09: `types.ts` defines: `TempoWorklog` (with at minimum: `tempoWorklogId`, `jiraWorklogId`, `issue.key`, `author.name`, `timeSpentSeconds`, `startDate` as `YYYY-MM-DD`), and the Tempo paginated response envelope.
- D-10: Unit tests cover: pagination exhaustion (mock API returns two pages then empty), and timezone date bucketing (`startDate.slice(0, 10)`).

**Settings Toggle**
- D-11: Plain checkbox toggle only — no sub-UI revealed when enabled. Same HTML pattern as AIO toggle.
- D-12: Section heading: "Tempo Timesheets". Description text: "Show worklog data from Jira Tempo Timesheets. Requires Tempo plugin on your Jira instance."

**Store Migration**
- D-13: Bump `settings.store.ts` from v19 to v20. Add `tempoEnabled: boolean` (default `false`) and `setTempoEnabled: (v: boolean) => void`. Migration guard: `if (version < 20) { if (s.tempoEnabled === undefined) s.tempoEnabled = false; }`.

### Claude's Discretion
- `YYYY-MM-DD` string format for `from`/`to` parameters (decided; matches Tempo API directly)
- Exact Tempo pagination API shape (offset/limit vs cursor) — Claude reads Tempo docs or adapts based on probe result
- Whether `client.ts` exports `TEMPO_API_PATH` as a single constant or leaves room for a fallback path constant

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEMPO-06 | User can enable/disable Tempo integration via Settings → Integrations toggle (same pattern as AIO; default off) | Settings store v19→v20 bump with `tempoEnabled`, IntegrationsSection.tsx toggle, zustand-persist migration guard, unit tests |

</phase_requirements>

---

## Summary

Phase 61 is a three-part task: (1) a live curl probe to confirm Tempo API auth, (2) building the `src/services/tempo/` module that mirrors `src/services/aio/`, and (3) wiring a `tempoEnabled` toggle in Settings → Integrations with a store v19→v20 bump. The entire service module is gated on probe success — if Bearer PAT returns 401, the phase ends at documentation of the failure.

The codebase already has a near-perfect template in `src/services/aio/`. Every pattern needed — `apiFetch` wrapper, `aioFetch` signature, `AioPage<T>` envelope, `isLast` pagination loop, `vi.mock('../../lib/apiFetch')` test pattern, settings store migration guard — is already proven and simply needs to be replicated with Tempo-specific names. The primary research unknown is the exact Tempo DC API response shape for worklogs (specifically whether `author` is a string or an object on Data Center), which the probe will resolve.

Tempo Timesheets on Data Center uses `Authorization: Bearer <token>`. Community evidence and official migration docs confirm Bearer auth works on the server REST API path (`/rest/tempo-timesheets/4/`). However, on Jira DC the `author` field in worklog responses is historically a plain username string (`"author": "jsmith"`), not an object. CONTEXT.md D-09 specifies `author.name` — the probe must confirm the actual field shape so `types.ts` is written correctly.

**Primary recommendation:** Treat the probe as Wave 0 output. Write `types.ts`, `client.ts`, `worklogs.ts` only after the probe returns 200 and the response JSON is captured. Document both the working path and exact `author` field shape in the `client.ts` comment block before writing type definitions.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Live API auth probe (curl) | Developer workstation | — | External verification step, not in-app; same precedent as Phase 51 AIO probe |
| Tempo API fetch wrapper (`tempoFetch`) | API service layer (`src/services/tempo/`) | — | All external HTTP calls live in services; never in components |
| Worklog pagination exhaustion | API service layer (`worklogs.ts`) | — | Pagination is a data layer concern, not UI |
| `tempoEnabled` persistence | Settings store (`settings.store.ts`) | — | All persisted preferences go through the Zustand/Tauri store |
| Store migration guard | Settings store (`settings.store.ts`) | — | `migrate` function in the store owns all version transitions |
| Settings toggle UI | Frontend component (`IntegrationsSection.tsx`) | Settings store | Component reads store state; store owns persistence |
| Unit test coverage | Test files (`.test.ts` siblings) | — | Every service module has a `.test.ts` sibling per project convention |

---

## Standard Stack

No new packages are installed in this phase. All libraries are already in the project.

### Core (Already Installed)

| Library | Version | Purpose | Role in Phase 61 |
|---------|---------|---------|-----------------|
| `zustand` | ^5.0.11 | State management + persistence | `settings.store.ts` v20 bump |
| `@tauri-apps/plugin-http` | (Tauri) | HTTP fetch in Tauri context | Used via `apiFetch` wrapper |
| `vitest` | ^4.0.18 | Test runner | Unit tests for `worklogs.ts` |
| `@testing-library/react` | ^16.3.2 | Component tests | `IntegrationsSection.test.tsx` extension |
| `jsdom` | ^29.0.0 | DOM environment for tests | Vitest environment (configured) |

**No `npm install` commands needed.** Phase 61 introduces zero new dependencies.

---

## Package Legitimacy Audit

> Not applicable. This phase installs no new packages.

---

## Architecture Patterns

### System Architecture Diagram

```
Developer workstation
       │
       │  curl probe (before any code)
       ▼
Jira DC host /rest/tempo-timesheets/{4|3}/worklogs
       │
       │  200 OK → capture response JSON shape
       │  401    → phase ends, document failure
       ▼
src/services/tempo/
  client.ts ──── TEMPO_API_PATH (probe-confirmed constant)
                 tempoFetch(baseUrl, token, path, operation, apiPath?, init?)
                    └── apiFetch('aio', url, headers, operation)   [source: 'aio']
  types.ts  ──── TempoWorklog, TempoPaginatedResponse
  worklogs.ts ── fetchWorklogs(baseUrl, token, usernames, from, to)
                    └── pagination loop: POST/GET until no more pages
  index.ts  ──── barrel: re-exports fetchWorklogs + types (NOT client.ts)

settings.store.ts (v19 → v20)
  ├── tempoEnabled: boolean (default false)
  ├── setTempoEnabled: (v: boolean) => void
  └── migrate: if (version < 20) { if (s.tempoEnabled === undefined) s.tempoEnabled = false; }

IntegrationsSection.tsx
  └── Tempo Timesheets section (below AIO block)
       <h3>Tempo Timesheets</h3>
       <label> ... <input type="checkbox" checked={tempoEnabled} onChange={...} /> </label>

IntegrationsSection.test.tsx (extended)
  └── tempoEnabled checkbox tests (render, toggle, persist)
```

### Recommended Project Structure

```
taskflow/src/services/tempo/
├── client.ts        # tempoFetch + TEMPO_API_PATH; NOT re-exported from index
├── types.ts         # TempoWorklog, TempoPaginatedResponse
├── worklogs.ts      # fetchWorklogs with pagination loop
└── index.ts         # barrel: exports from worklogs.ts + types.ts only
```

### Pattern 1: tempoFetch mirrors aioFetch exactly

**What:** A thin fetch wrapper that prepends the base URL + API path, adds Bearer auth header, delegates to `apiFetch`.
**When to use:** All Tempo HTTP calls go through `tempoFetch`; never call `apiFetch` or `fetch` directly from domain modules.

```typescript
// Source: taskflow/src/services/aio/client.ts (mirrored verbatim with AIO→Tempo substitution)
import { apiFetch } from '../../lib/apiFetch';

// KEY DECISION (Phase 61 probe): confirmed against live Jira DC instance on <date>
// Probe results: /rest/tempo-timesheets/4/ returned 200; /rest/tempo-timesheets/3/ returned <status>
export const TEMPO_API_PATH = '/rest/tempo-timesheets/4'; // set from probe result

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
    'aio',            // NOTE: 'aio' is the source label — apiFetch treats 'aio' as non-disconnecting
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

**Source:** `taskflow/src/services/aio/client.ts` [VERIFIED: codebase grep]

### Pattern 2: Pagination exhaustion loop (offset/limit)

**What:** Loop over paginated Tempo responses until the endpoint signals no more pages.
**When to use:** `fetchWorklogs` — Tempo DC paginates at 50 records by default; must loop to exhaustion.

The Tempo DC API uses `offset`/`limit` pagination with an `isLastPage: boolean` (or similar sentinel) on the response envelope. The exact field name must be confirmed by probe. Two candidate shapes from research:

- **Shape A (most likely for DC):** `{ worklogs: TempoWorklog[], metadata: { count: number, offset: number, limit: number } }` — no explicit `isLast`; loop while `offset + limit < count` OR while response returns a non-empty array.
- **Shape B (AioPage pattern):** `{ items: TempoWorklog[], startAt: number, maxResults: number, isLast: boolean }` — exact stop condition is `isLast === true`.

```typescript
// Source: taskflow/src/services/aio/cycles.ts pagination loop (adapted)
// Adapt stop condition to match actual Tempo response envelope from probe
export async function fetchWorklogs(
  baseUrl: string,
  token: string,
  usernames: string[],
  from: string,     // YYYY-MM-DD
  to: string,       // YYYY-MM-DD
): Promise<TempoWorklog[]> {
  const all: TempoWorklog[] = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    // Build query params — exact param names confirmed from probe
    // Candidate: dateFrom/dateTo + username (DC v4) or from/to + username (DC v3)
    const params = new URLSearchParams({
      dateFrom: from,
      dateTo: to,
      offset: String(offset),
      limit: String(limit),
    });
    for (const u of usernames) params.append('username', u);

    const res = await tempoFetch(baseUrl, token, `/worklogs?${params}`, 'Load Tempo Worklogs');
    if (!res.ok) throw new ApiError(`Tempo worklogs failed: ${res.status}`, res.status, 'jira');

    const page = await res.json() as TempoPaginatedResponse;
    const items = page.worklogs ?? page.results ?? [];
    all.push(...items);

    // Stop condition: adapt based on probe-confirmed envelope shape
    if (items.length < limit) break;
    offset += items.length;
  }
  return all;
}
```

**Source:** Pattern adapted from `taskflow/src/services/aio/cycles.ts` [VERIFIED: codebase grep]; pagination stop condition `items.length < limit` is defensive — works for both envelope shapes [ASSUMED]

### Pattern 3: Zustand settings store v19 → v20 migration

**What:** Additive migration: add `tempoEnabled: false` default if absent. Never delete fields.
**When to use:** Any time a new persisted field is added to `settings.store.ts`.

```typescript
// Source: taskflow/src/stores/settings.store.ts lines 388–391 (aioEnabled precedent)
if (version < 20) {
  if (s.tempoEnabled === undefined) s.tempoEnabled = false;
}
```

Also required:
1. Add `tempoEnabled: boolean` to `SettingsState` interface (after `aioEnabled` / `setAioEnabled`)
2. Add `setTempoEnabled: (v: boolean) => void` to the interface and implementation
3. Set initial value: `tempoEnabled: false` in the `create()(persist((set) => ({...})))` call
4. Bump `version: 19` → `version: 20` in the `persist(...)` config

**Source:** `taskflow/src/stores/settings.store.ts` [VERIFIED: codebase grep]

### Pattern 4: IntegrationsSection.tsx — Tempo toggle HTML

**What:** Plain checkbox block, no sub-UI. Below the AIO block, same structural wrapper.
**Source:** UI-SPEC.md + CONTEXT.md D-11, D-12 [VERIFIED: codebase read]

```tsx
{/* Below the AIO closing </div> — inside the outer flex flex-col gap-8 container */}
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

### Pattern 5: Service unit test — mock pattern

**What:** Mock `apiFetch` at module level; mock `./client` to expose `tempoFetch` and `TEMPO_API_PATH`; test pagination exhaustion and 401 error path.
**When to use:** `worklogs.test.ts` — same structure as `aio/cycles.test.ts`.

```typescript
// Source: taskflow/src/services/aio/cycles.test.ts (adapted)
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));
vi.mock('./client', () => ({
  tempoFetch: vi.fn(),
  TEMPO_API_PATH: '/rest/tempo-timesheets/4',
}));

import { tempoFetch } from './client';
import { fetchWorklogs } from './worklogs';

const mockedTempoFetch = vi.mocked(tempoFetch);
```

**Source:** `taskflow/src/services/aio/cycles.test.ts` [VERIFIED: codebase grep]

### Pattern 6: Timezone date bucketing

**What:** Always use `.slice(0, 10)` on the `startDate` string field from Tempo. Never use `new Date(...).toLocaleDateString()`.
**Why:** `startDate` is already a `YYYY-MM-DD` string from Tempo; passing it through `new Date()` introduces timezone-shift risk. `.slice(0, 10)` is a zero-cost identity extraction.

```typescript
// Source: CONTEXT.md D-10, STATE.md decision (Phase 62 locked)
const dateKey = worklog.startDate.slice(0, 10); // "2024-01-15"
```

### Anti-Patterns to Avoid

- **Writing service code before the probe:** D-03 is a hard gate. `client.ts` must include the probe comment before `worklogs.ts` is touched.
- **Re-exporting `client.ts` from `index.ts`:** `tempoFetch` and `TEMPO_API_PATH` are internal. Only `fetchWorklogs` and types go in the barrel. (AIO precedent: `index.ts` does NOT export `client.ts`.)
- **Using `source: 'jira'` in `apiFetch`:** AIO uses `'aio'` because `markDisconnected` skips the `'aio'` source. Tempo should follow the same pattern (`'aio'`) so a Tempo 401 does not falsely disconnect Jira.
- **Hardcoding `author.name`:** On Jira DC, the `author` field may be a plain string, not `{ name: string }`. The probe must confirm this — if it is a string, `types.ts` should use `author: string` and `worklogs.ts` should normalize to a consistent shape.
- **Using `new Date(worklog.startDate).toLocaleDateString()`:** Timezone-shifts the date. Use `.slice(0, 10)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP fetch with auth | Custom fetch wrapper | `tempoFetch` → `apiFetch` | Instrumentation, timeout, 401 detection all built-in |
| Pagination loop | Custom offset tracker | Standard `while(true)` with `items.length < limit` break | Proven pattern in `cycles.ts` |
| Settings persistence | Custom storage | `createTauriStorage` in zustand persist | Tauri store handles cross-restart persistence |
| Store migration | Custom migration script | `migrate` function in zustand persist config | Additive guards handle all version transitions |
| Test mocking | Custom spy setup | `vi.mock('../../lib/apiFetch')` pattern | Established project test convention |

**Key insight:** Every mechanism needed for this phase is already built and proven in the AIO service layer. This phase is a copy-and-adapt task, not a greenfield build.

---

## Common Pitfalls

### Pitfall 1: Bearer PAT vs. Tempo Integration Token on Data Center

**What goes wrong:** On some Jira DC Tempo installations, the Tempo plugin may require its own API token (generated in Tempo Settings → API Integration) rather than the standard Jira PAT.
**Why it happens:** Tempo on DC has two auth surfaces: the underlying Jira REST auth and its own plugin API token system. The probe endpoint `/rest/tempo-timesheets/4/worklogs` might accept Jira Bearer PAT on some versions and reject it on others.
**How to avoid:** The probe explicitly tests Bearer PAT first (D-01). If 401 is returned, CONTEXT.md D-03 applies — phase ends and the auth mechanism is documented as a blocker. A separate `tempo-api-token` Stronghold key would be needed.
**Warning signs:** 401 from both `/4/` and `/3/` with a valid Jira PAT that works on Jira REST API calls.

[ASSUMED — exact behavior varies by Tempo DC plugin version; must be confirmed by probe]

### Pitfall 2: author field shape — string vs. object on DC

**What goes wrong:** `TempoWorklog.author` is typed as `{ name: string }` but the live DC endpoint returns `author: "jsmith"` (a plain string). TypeScript would allow the wrong type through if types are inferred from Cloud docs.
**Why it happens:** Tempo Cloud returns `author: { accountId: string, displayName: string }`. Tempo DC older APIs returned `author: "username"` (plain string). The CONTEXT.md D-09 spec says `author.name` — this must be verified by probe.
**How to avoid:** Capture the actual probe response JSON before writing `types.ts`. If `author` is a string, type it as `author: string` and update D-09 accordingly. If it's an object `{ name: string }`, match that shape.
**Warning signs:** TypeScript `Cannot read properties of null (reading 'name')` at runtime, or `author.name` resolving to `undefined`.

[MEDIUM confidence — based on web research showing DC uses string; probe required to confirm]

### Pitfall 3: Pagination stop condition — wrong sentinel field

**What goes wrong:** Loop never terminates or stops too early because the wrong field is checked for "end of pages".
**Why it happens:** AIO uses `isLast: boolean`. Tempo DC may use a different convention — `metadata.count` vs items returned, or a `next` URL being absent, or simply an empty array response.
**How to avoid:** Check the probe response for a `metadata` object or `isLast` field. Default to `items.length < limit` as a safe stop condition (works regardless of envelope shape).
**Warning signs:** Infinite loop in `fetchWorklogs`, or early return missing the last page when record count is exactly divisible by `limit`.

### Pitfall 4: apiFetch source label — 'jira' vs 'aio'

**What goes wrong:** Using `apiFetch('jira', ...)` in `tempoFetch` causes a Tempo 401 to trigger `setJiraConnected(false)`, disconnecting the app's primary Jira integration.
**Why it happens:** `apiFetch`'s `markDisconnected` function calls `auth.setJiraConnected(false)` on 401 for source `'jira'`, but skips it for source `'aio'`. Tempo auth is independent of Jira auth — a bad Tempo token should not disconnect Jira.
**How to avoid:** Use `apiFetch('aio', ...)` in `tempoFetch`, exactly as AIO does. This is the correct pattern for any Jira-plugin API that shares the host but has independent auth.

[VERIFIED: codebase grep — `apiFetch.ts` line 23-27]

### Pitfall 5: Mock store shape incomplete in IntegrationsSection.test.tsx

**What goes wrong:** Extending `IntegrationsSection.test.tsx` with tempoEnabled tests fails because `mockStore` doesn't include `tempoEnabled`/`setTempoEnabled`, causing the selector to return `undefined`.
**Why it happens:** The existing `mockStore` object only covers AIO fields. Adding Tempo fields requires extending both the mock object and the type annotation.
**How to avoid:** Add `tempoEnabled: boolean` and `setTempoEnabled: vi.fn()` to the `mockStore` object and its type, mirroring the AIO fields already there.

[VERIFIED: codebase read — `IntegrationsSection.test.tsx` lines 9-18]

### Pitfall 6: Store version bump without updating the version constant

**What goes wrong:** `tempoEnabled` is added to the initial state and migration guard but `version: 19` is not changed to `version: 20`. Existing users never receive the migration — their store silently has `tempoEnabled: undefined`.
**Why it happens:** The version number is in the `persist({...})` config object, separated from the migration function.
**How to avoid:** `version: 19` appears at line ~322 of `settings.store.ts`. This line MUST be changed to `version: 20` as part of the same commit as the migration guard.

[VERIFIED: codebase read — `settings.store.ts` line 322]

---

## Runtime State Inventory

> Not applicable. This is a greenfield service module addition + settings toggle, not a rename/refactor/migration of existing identifiers.

---

## Code Examples

### Probe curl commands (Wave 0)

```bash
# Try v4 first (D-01)
curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer <your-jira-pat>" \
  -H "Content-Type: application/json" \
  "<your-jira-base-url>/rest/tempo-timesheets/4/worklogs?dateFrom=2024-01-01&dateTo=2024-01-07&username=<your-username>" \
  | tee /tmp/tempo-probe-v4.json

# If v4 returns 401, try v3
curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer <your-jira-pat>" \
  -H "Content-Type: application/json" \
  "<your-jira-base-url>/rest/tempo-timesheets/3/worklogs?dateFrom=2024-01-01&dateTo=2024-01-07&username=<your-username>" \
  | tee /tmp/tempo-probe-v3.json
```

Capture the full JSON response — the fields in the response body define the types.

### TempoWorklog type (after probe)

```typescript
// Source: types.ts — exact field names confirmed from probe response JSON
// D-09 spec + [ASSUMED: author.name based on DC docs; confirm from probe]
export interface TempoWorklog {
  tempoWorklogId: number;
  jiraWorklogId: number;
  issue: {
    key: string;       // e.g. "PROJ-42"
  };
  author: { name: string } | string; // DC may return plain string — confirm from probe
  timeSpentSeconds: number;
  startDate: string;  // YYYY-MM-DD — always .slice(0, 10), never new Date()
  description?: string;
  startTime?: string;
}

// Paginated envelope — shape TBD from probe; defensive union covers both known shapes
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

### Settings store v20 additions (verbatim edit locations)

The following edits are needed in `settings.store.ts`:

1. **Interface** (after line 104, after `setAioEnabled`):
   ```typescript
   /** Enable Tempo Timesheets integration. Default: false. Gates all Tempo API calls. */
   tempoEnabled: boolean;
   setTempoEnabled: (v: boolean) => void;
   ```

2. **Initial state** (after line 220, after `setAioEnabled` impl):
   ```typescript
   tempoEnabled: false,
   setTempoEnabled: (v) => set({ tempoEnabled: v }),
   ```

3. **version bump** (line 322): `version: 19` → `version: 20`

4. **Migration guard** (after line 406, after `if (version < 19)` block):
   ```typescript
   if (version < 20) {
     if (s.tempoEnabled === undefined) s.tempoEnabled = false;
   }
   ```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Tempo v3 REST API | Tempo v4 REST API | v4 is the current DC API path; try v4 first per D-01 |
| `author: "username"` (DC legacy) | `author: { name, accountId }` (Cloud) | DC may still return string; confirm from probe |
| `apiFetch('jira', ...)` for plugins | `apiFetch('aio', ...)` for Jira plugins | Prevents false Jira disconnect on plugin 401 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tempo DC returns `author: { name: string }` (object), matching D-09 spec | Code Examples — TempoWorklog type | `author.name` resolves to `undefined` at runtime; causes Phase 62 username filter to break |
| A2 | Tempo DC v4 worklogs endpoint query param is `username=` (not `accountId=`) | Pagination loop pattern | Filter returns no results for specified users; Phase 62 people filter does not work |
| A3 | Tempo DC worklogs pagination stop condition: `items.length < limit` is sufficient | Pagination pattern | Infinite loop (if last page always returns exactly `limit` items) or early stop |
| A4 | Bearer PAT (Jira PAT from `readSecret('jira-pat')`) authenticates against `/rest/tempo-timesheets/4/` on this DC instance | Pitfall 1 | Phase 61 probe returns 401; phase is blocked until separate Tempo token is added to Stronghold |
| A5 | `apiFetch('aio', ...)` is the correct source label for Tempo (matching AIO precedent) | Pattern 1 | Using `'jira'` would cause Tempo 401 to disconnect Jira integration |

**A4 will be resolved by the probe in Wave 0. A1, A2, A3 will be resolved by reading the probe response JSON before writing types or service code.**

---

## Open Questions

1. **Does Bearer PAT authenticate against `/rest/tempo-timesheets/4/`?**
   - What we know: AIO on the same DC instance uses Bearer PAT successfully (Phase 51 probe confirmed)
   - What's unclear: Tempo Timesheets plugin may require its own API token for its REST API
   - Recommendation: Probe immediately (Wave 0). If 401: document, stop, mark TEMPO-06 blocked.

2. **Is `author` a string or an object in the DC worklogs response?**
   - What we know: Cloud API returns `{ accountId, displayName }`; DC legacy APIs return plain string `"username"`; CONTEXT.md D-08 uses `usernames` (Jira usernames) for filtering, implying D-09 `author.name` is a Jira username
   - What's unclear: Exact field shape on this particular Tempo DC version
   - Recommendation: Capture probe response JSON and define types from it, not from Cloud docs.

3. **Does the Tempo DC API require `username=` or `accountId=` for filtering?**
   - What we know: Jira DC uses usernames (not accountIds); D-08 specifies `usernames: string[]`
   - What's unclear: Whether the query param name is `username`, `userKey`, or `worker` on v4
   - Recommendation: Check probe response for user field name; try `username=` first (most common DC convention).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `curl` | Wave 0 probe | ✓ | system curl | Postman or browser dev tools |
| Jira DC instance (live) | Wave 0 probe | ✓ (assumed — same host used for AIO probes) | — | — |
| Jira PAT in Stronghold | Wave 0 probe | ✓ (used for AIO; `readSecret('jira-pat')` confirmed working) | — | — |
| Tempo plugin on Jira DC | Wave 0 probe | [ASSUMED] — user's Jira instance has Tempo | — | If absent: phase is blocked |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm test -- --reporter=verbose src/services/tempo/` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEMPO-06 | `tempoEnabled` toggle renders in IntegrationsSection | unit (component) | `npm test -- src/routes/settings/IntegrationsSection.test.tsx` | ✅ (extension of existing) |
| TEMPO-06 | Toggling checkbox calls `setTempoEnabled(true)` | unit (component) | same | ✅ (new test case) |
| TEMPO-06 | `tempoEnabled: false` default in fresh store | unit (store) | `npm test -- src/stores/settings.store.test.ts` | ❌ Wave 0 (no store test file exists) |
| TEMPO-06 | Migration guard sets `tempoEnabled: false` for v19 store | unit (store migration) | same | ❌ Wave 0 |
| D-07 | `fetchWorklogs` paginates through 2 pages then stops | unit (service) | `npm test -- src/services/tempo/worklogs.test.ts` | ❌ Wave 0 (new file) |
| D-10 | Timezone bucketing: `startDate.slice(0, 10)` behavior | unit (service) | same | ❌ Wave 0 |
| D-04 | `tempoFetch` constructs correct URL with Bearer token | unit (client) | `npm test -- src/services/tempo/client.test.ts` | ❌ Wave 0 (new file) |

### Sampling Rate

- **Per task commit:** `cd taskflow && npm test -- src/services/tempo/ src/routes/settings/IntegrationsSection.test.tsx`
- **Per wave merge:** `cd taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/services/tempo/worklogs.test.ts` — covers pagination exhaustion (D-07, D-10)
- [ ] `src/services/tempo/client.test.ts` — covers URL construction and Bearer header
- [ ] `src/stores/settings.store.test.ts` — covers v20 migration guard and default value (if this file does not already exist)

*(If `settings.store.test.ts` already exists, extend it. Check before creating.)*

---

## Security Domain

> `security_enforcement` not set in config — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Jira PAT via Stronghold (`readSecret('jira-pat')`) — never store in plaintext |
| V3 Session Management | No | Stateless HTTP; no session tokens |
| V4 Access Control | No | Read-only worklog fetching; no write endpoints in Phase 61 |
| V5 Input Validation | Yes | `from`/`to` date strings passed as query params — no SQL/injection risk in HTTP GET; usernames are user-controlled but passed as URL params not SQL |
| V6 Cryptography | No | Bearer PAT already encrypted in Stronghold; no new crypto needed |

### Known Threat Patterns for Tempo HTTP service

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PAT exposed in logs | Information Disclosure | `apiFetch` sanitizes `Authorization` header → `[REDACTED]` in debug logs |
| Unbounded pagination (DoS via large worklog sets) | Denial of Service | `limit=50` per page; pagination loop bounded by `items.length < limit` break condition |
| SSRF via jiraBaseUrl | Tampering | `jiraBaseUrl` comes from authenticated `auth.store` — user must have configured Jira URL at setup |

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/services/aio/client.ts` — `aioFetch` signature and `apiFetch('aio', ...)` source label; `TEMPO_API_PATH` pattern
- `taskflow/src/services/aio/cycles.ts` — pagination loop structure (`while(true)`, offset accumulation)
- `taskflow/src/services/aio/types.ts` — type definition style for paginated API response envelopes
- `taskflow/src/services/aio/index.ts` — barrel pattern (client.ts NOT re-exported)
- `taskflow/src/stores/settings.store.ts` — v19 current version; migration guard style (lines 388–391); `aioEnabled` precedent (lines 103–104, 219–220)
- `taskflow/src/routes/settings/IntegrationsSection.tsx` — AIO toggle HTML structure (lines 62–80)
- `taskflow/src/routes/settings/IntegrationsSection.test.tsx` — mockStore pattern; selector mock pattern
- `taskflow/src/services/aio/cycles.test.ts` — `vi.mock` test pattern for service modules
- `taskflow/src/lib/apiFetch.ts` — `markDisconnected` source union; `'aio'` skips disconnect

### Secondary (MEDIUM confidence)
- [Worklog REST APIs for Jira Cloud — Tempo Help Center](https://help.tempo.io/cloudmigration/latest/worklog-rest-apis-for-jira-cloud) — API shape for `tempoWorklogId`, `jiraWorklogId`, `startDate`, `author` fields; note Cloud uses `accountId` not `name`
- [REST APIs for Jira Data Center — Tempo Help Center](https://help.tempo.io/cloudmigration/latest/rest-apis-for-jira-server-data-center) — DC endpoint list; confirms `Authorization: Basic` (not Bearer) is the documented DC auth — bearer may work but not documented
- [Tempo community thread — bearer auth works on v4](https://community.atlassian.com/forums/Jira-questions/Tempo-timesheets-worklog-API/qaq-p/1147519) — community evidence Bearer works on DC v4

### Tertiary (LOW confidence)
- Web search findings: DC returns `author` as plain string `"username"` (not an object) — needs probe confirmation
- Pagination stop condition `items.length < limit` — inferred from community usage; official DC docs do not show the exact envelope shape for `/rest/tempo-timesheets/4/worklogs`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; all patterns are verified in codebase
- Architecture: HIGH — mirrors AIO service layer 1:1
- Tempo API response shape: MEDIUM — Cloud docs show the field names; DC behavior for `author` needs probe confirmation (A1, A2)
- Tempo auth on this DC instance: LOW — Bearer PAT unverified (probe is Wave 0)
- Pitfalls: HIGH — derived from codebase reading and Phase 51 precedent

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable — API patterns rarely change; probe result is a one-time verification)
