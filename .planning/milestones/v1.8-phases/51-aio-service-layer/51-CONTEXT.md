# Phase 51: AIO Service Layer - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Probe the live AIO instance (external curl) to confirm Bearer auth and the correct base path variant, build the `src/services/aio/` module (client, types, domain modules), add an `aioEnabled` toggle in a new Settings → Integrations section, and verify that the `GET /testrun?issueKey=` endpoint works for issue-level run lookups. No UI pages, no sidebar routing, no query hooks — service layer and settings toggle only.

</domain>

<decisions>
## Implementation Decisions

### Probe — live instance verification
- **D-01:** Probe is **external** (curl/Postman), not an in-app button. Developer runs the probe during Phase 51, records the working base path variant and auth scheme as Key Decisions in a findings note (not in settings.store, not auto-detected at runtime).
- **D-02:** Plan must include specific curl commands for **all 3 known base path variants**:
  - `/rest/aio-tcms/1.0/`
  - `/rest/aio-tcms-api/1.0/`
  - `/plugins/servlet/aio/`
  Auth: `Authorization: Bearer <jiraPat>` (same PAT as Jira). Test both GET `/project` and GET `/testrun?issueKey=<key>` to confirm both endpoints work.
- **D-03:** Probe findings (working base path, confirmed auth scheme, whether `issueKey` query param works on `/testrun`) are **recorded as Key Decisions in this CONTEXT.md** (or a companion findings file) — NOT in runtime app config. The constant in `aio/client.ts` is set from these findings.

### Settings toggle — aioEnabled
- **D-04:** Keep an **explicit `aioEnabled` boolean toggle**. Without it, the AIO section on issue detail (Phase 54) would fire API calls on every issue open for users without AIO installed, causing silent failures.
- **D-05:** Toggle lives in a **new 'Integrations' section** added to the Settings sidebar (5th entry after Connections, Appearance, Notifications, Workflow). `IntegrationsSection.tsx` component, wired into `Settings.tsx` `SECTIONS` array and the `SettingsSection` union type.
- **D-06:** `aioEnabled: boolean` stored in `useSettingsStore` (settings.store.ts) with a **version bump** (currently v14 → v15). Default: `false`. Migration: `if (version < 15) { s.aioEnabled = false; }`.

### AIO URL / base path
- **D-07:** No separate AIO URL input field for users. AIO is on the same Jira host; the base path is derived as `jiraBaseUrl + <hardcoded path constant>`.
- **D-08:** The working base path variant (found by probe) is **hard-coded as a constant** in `src/services/aio/client.ts`:
  ```ts
  // KEY DECISION (Phase 51 probe): confirmed against live AIO instance on <date>
  export const AIO_API_PATH = '/rest/aio-tcms/1.0'; // or whichever variant the probe confirms
  ```
  If the installation changes, a code update is required — acceptable for a known single deployment.
- **D-09:** All AIO calls use `apiFetch('jira', url, { headers })` — same Bearer PAT from Stronghold key `'jira-pat'`, `source: 'jira'`. No changes to `apiFetch` source union needed for Phase 51.

### AIO project ID resolution
- **D-10:** No global mapping from Jira project key → AIO project ID. Resolution is **lazy per feature**: each feature that needs a project ID fetches what it needs at call time.
- **D-11:** For the issue detail AIO section (Phase 54): assume `GET /rest/aio-tcms/1.0/testrun?issueKey=PROJ-123` works without a project ID. **Probe must confirm this** (D-02). If the endpoint requires a project ID, the fallback is: extract project key from issueKey (e.g., `PROJ` from `PROJ-123`), fetch AIO project list, match by name, cache result in component state.
- **D-12:** For the projects/cycles pages (Phase 52+): `GET /project` returns all AIO projects directly — no Jira project key mapping needed for navigation.

### Probe Findings (KEY DECISIONS — Phase 51 Probe)
Probe run: 2026-05-12. Auth: `Authorization: Bearer <jiraPat>` ✓ confirmed.

- **D-13: Working AIO REST base path(s) — two paths, purpose-split**
  This instance uses **two** base paths, not one:
  | Base path | Scope |
  |-----------|-------|
  | `/rest/aio-tcms/1.0` | Project listing only — `GET /project`, `GET /project/{jiraProjectId}` |
  | `/rest/aio-tcms-api/1.0` | Everything else — cycles, test runs, test cases |

  The three-variant probe assumption (one winner) was wrong for this installation. Both paths are required.
  Export two constants from `aio/client.ts`:
  ```ts
  // KEY DECISION (Phase 51 probe): confirmed 2026-05-12
  export const AIO_PROJECTS_API_PATH = '/rest/aio-tcms/1.0';
  export const AIO_API_PATH = '/rest/aio-tcms-api/1.0';
  ```
  Variant `/plugins/servlet/aio/` was not tested (superseded by confirmed working paths above).

- **D-14: Auth scheme confirmed**
  `Authorization: Bearer <jiraPat>` returns 200 on all confirmed endpoints. Same Stronghold key `'jira-pat'` as Jira. No session cookie required. `apiFetch('jira', url, { headers })` pattern is correct (D-09 confirmed).

- **D-15: GET /testrun?issueKey= — endpoint does NOT exist on this API**
  There is no `GET /testrun?issueKey=` endpoint. Test runs are scoped to a cycle:
  `GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/testrun`
  D-11's assumption was wrong. Fallback strategy for Phase 54 (issue detail AIO section):
  - Cannot do a direct issue-key lookup for test runs
  - Must either: (a) list all cycles for a project and find runs that reference the issue, or (b) link by Jira issue key within the testrun items if the field is present (verify in D-17)
  - `issue-runs.ts` in Plan 03 must be scoped to what is actually achievable: given `baseUrl`, `token`, `projectKey`, and `cycleKey`, fetch the runs list for that cycle. Issue-level filtering is deferred to Phase 54 based on actual run item fields.

- **D-16: AioProject response shape (from GET /rest/aio-tcms/1.0/project)**
  Response: direct array of project objects (80 projects returned on this instance — not paginated at project level).
  Key formats confirmed: project key is the Jira project key (e.g., `PROJ`).
  Exact field names not captured in probe output — **derive from AIO REST API docs**:
  https://aiosupport.atlassian.net/wiki/spaces/AioTests/pages/2025619567
  Working interface assumption for `types.ts` (verify against docs before committing):
  ```ts
  export interface AioProject {
    id: number;           // AIO internal project ID
    projectKey: string;   // Jira project key (e.g. "PROJ")
    name: string;         // Project display name
  }
  ```
  Plan 03 executor must verify field names from the API docs before hard-coding the interface.

- **D-17: Paginated response wrapper (applies to cycles, test runs, test cases)**
  All list endpoints under `/rest/aio-tcms-api/1.0/` use a paginated wrapper:
  ```ts
  interface AioPage<T> {
    items: T[];
    startAt: number;
    maxResults: number;
    isLast: boolean;
  }
  ```
  Key formats confirmed: cycle key = `{PROJ}-CY-Adhoc` / `{PROJ}-CY-2` / `{PROJ}-CY-3` …; test case key = `{PROJ}-TC-{n}`.
  Confirmed working list endpoints (all return `AioPage<T>`):
  - `GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle` → `AioPage<AioCycle>`
  - `GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/testrun` → `AioPage<AioTestRun>`
  - `GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/testcase` → `AioPage<AioTestCase>`
  - `GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcase` → `AioPage<AioTestCase>`
  Detail endpoint: `GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/detail` → single object (not paginated).
  Plan 03 executor must verify `AioCycle`, `AioTestRun`, `AioTestCase` field names from the API docs before writing the interfaces.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Settings store (aioEnabled field, version migration)
- `taskflow/src/stores/settings.store.ts` — Zustand persist store, currently at version 14 with migration chain. Add `aioEnabled: boolean` (default `false`) and bump to version 15 with migration `if (version < 15) { s.aioEnabled = false; }`.

### Settings page (new Integrations section)
- `taskflow/src/routes/settings/Settings.tsx` — `SECTIONS` array and `SettingsSection` union type. Add `'integrations'` entry with a suitable icon (e.g., `<Plug className="h-4 w-4" />`).
- `taskflow/src/routes/settings/WorkflowSection.tsx` — Closest analog for the toggle UI pattern: `<input type="checkbox" checked={...} onChange={...} />` with label. `IntegrationsSection.tsx` follows this pattern.

### API fetch infrastructure
- `taskflow/src/lib/apiFetch.ts` — `apiFetch(source: 'jira' | 'gitlab', url, init?, operation?)`. AIO calls use `source: 'jira'`. No changes to this file in Phase 51.
- `taskflow/src/services/jira/client.ts` — Model for `aio/client.ts`: exports internal helpers used by domain modules, not re-exported from the barrel. `aioFetch(path, headers)` wraps `apiFetch('jira', jiraBaseUrl + AIO_API_PATH + path, { headers })`.

### Auth store (for jiraBaseUrl + jiraPat retrieval)
- `taskflow/src/stores/auth.store.ts` — `useAuthStore`: `jiraBaseUrl: string | null`. AIO service functions receive `baseUrl` and `token` as parameters (mirrors jira/ pattern). No new fields in auth store for Phase 51.

### Jira service structure (module pattern to mirror)
- `taskflow/src/services/jira/` — Module layout: `client.ts` (internal), `types.ts`, domain modules (`issues.ts`, `cycles.ts`, etc.), `index.ts` barrel. `src/services/aio/` mirrors this exactly.

### Requirements
- `.planning/REQUIREMENTS.md` §v1.8 — AION-05: `aioEnabled` toggle. Phase 51 scope.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSettingsStore` (`settings.store.ts`): Zustand persist store with version migration pattern — add `aioEnabled` here with version bump to 15.
- `apiFetch` (`lib/apiFetch.ts`): Already handles `source: 'jira'` — AIO client uses this unchanged.
- `WorkflowSection.tsx` toggle pattern: `<input type="checkbox" checked={X} onChange={e => setX(e.target.checked)} />` — copy for `IntegrationsSection.tsx`.

### Established Patterns
- **Service module layout:** `jira/` directory = client.ts (internal) + types.ts + domain modules + index.ts barrel. `aio/` mirrors this exactly. Domain modules for Phase 51: `client.ts`, `types.ts`, `projects.ts`, `cycles.ts`, `runs.ts`, `issue-runs.ts`, `index.ts`.
- **Test coverage:** Every service module has a `.test.ts` sibling (e.g., `jira/issues.test.ts`). AIO modules need unit tests covering happy path, 401, 404, and empty-list responses.
- **Zustand persist version migration:** `settings.store.ts` uses `migrate: (persisted, version)` callback with sequential `if (version < N)` guards. Increment `version` field and add guard for v15.
- **Query key prefix:** AIO query keys use `['aio', jiraBaseUrl, ...]` prefix to avoid colliding with Jira cache invalidation sweeps (established in REQUIREMENTS.md research).

### Integration Points
- `aioEnabled` in `useSettingsStore` gates ALL AIO calls app-wide. Phase 52 sidebar section, Phase 54 issue detail section both read this flag before rendering or fetching.
- AIO service functions signature: `fetchAioProjects(baseUrl: string, token: string): Promise<AioProject[]>` — receive credentials as params, same as jira/ modules.
- `AIO_API_PATH` constant in `aio/client.ts` is set from probe findings before any other code is written.

</code_context>

<specifics>
## Specific Ideas

- **Probe is a hard blocker**: No TypeScript AIO service code should be written until the curl probe confirms the working base path and auth scheme. The `AIO_API_PATH` constant and the auth header approach in `aio/client.ts` are derived from probe findings.
- **Probe must also confirm**: whether `GET /testrun?issueKey=PROJ-123` works without a project ID (needed for Phase 54 issue detail section — D-11).

</specifics>

<deferred>
## Deferred Ideas

- **Auto-detect AIO availability on startup** — considered (no toggle, probe on first touch), deferred. Explicit toggle keeps the gate simple and avoids startup latency.
- **Separate aioBaseUrl input in Settings** — considered, deferred. AIO is on the same Jira host; base path is hard-coded from probe findings.
- **In-app 'Test AIO Connection' button** — considered for probe mechanism, deferred. External curl is sufficient for this single known deployment.

</deferred>

---

*Phase: 51-AIO Service Layer*
*Context gathered: 2026-05-12*
