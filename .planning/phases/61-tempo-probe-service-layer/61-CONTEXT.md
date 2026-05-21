# Phase 61: Tempo Probe + Service Layer - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify Tempo API auth on the live Jira DC instance (curl probe), build `src/services/tempo/` with `client.ts`, `types.ts`, `worklogs.ts`, and `index.ts`, wire a `tempoEnabled` toggle in Settings → Integrations, and bump the settings store to v20. Phase 61 is a hard gate: if Bearer PAT returns 401, the service module is NOT built — the failure is documented and Phase 62 is blocked.

</domain>

<decisions>
## Implementation Decisions

### Probe Strategy
- **D-01:** Probe both `/rest/tempo-timesheets/4/` and `/rest/tempo-timesheets/3/` in that order against the live Jira DC instance. Try a simple GET to a worklogs or user endpoint on each path with `Authorization: Bearer <jira-pat>`.
- **D-02:** Document the working path (and any failed paths) in a `client.ts` comment, mirroring the AIO precedent from Phase 51 (see `taskflow/src/services/aio/client.ts` header comment).
- **D-03:** If Bearer PAT returns 401 on both paths, Phase 61 ends here — record the failure in `client.ts` and CONTEXT.md, mark TEMPO-06 blocked. No service module files are built until auth is confirmed. Phase 62 depends on Phase 61 succeeding.

### Service Module Structure
- **D-04:** `tempoFetch` mirrors `aioFetch` exactly: signature `(baseUrl: string, token: string, path: string, operation: string, apiPath: string, init?: { method?: string; body?: string }): Promise<Response>`. Uses `apiFetch` wrapper for dev-tools operation grouping.
- **D-05:** Tempo lives on the same host as Jira (`jiraBaseUrl`); same Jira PAT token (`readSecret('jira-pat')`). No separate host or credential.
- **D-06:** One `TEMPO_API_PATH` constant in `client.ts` (set to the probe-confirmed path). Not two paths like AIO — Tempo has a single base path.
- **D-07:** `worklogs.ts` implements a fully paginated `fetchWorklogs(baseUrl, token, usernames, from, to)`: loops until the API returns no more pages, returns a flat `TempoWorklog[]`. Date range as `YYYY-MM-DD` strings (Claude's discretion — matches Tempo API directly, no serialization needed).
- **D-08:** Primary filter axis: `usernames: string[]` (Jira usernames) + `from`/`to` date range. Tempo API accepts username-based filtering; maps directly to the TEMPO-03 people filter in Phase 62.
- **D-09:** `types.ts` defines at minimum: `TempoWorklog` (with at least: `tempoWorklogId`, `jiraWorklogId`, `issue.key`, `author.name`, `timeSpentSeconds`, `startDate` as `YYYY-MM-DD`), and the Tempo paginated response envelope.
- **D-10:** Unit tests cover: pagination exhaustion (mock API returns two pages then empty), and timezone date bucketing (`startDate.slice(0, 10)` — never `toLocaleDateString()`).

### Settings Toggle
- **D-11:** Plain checkbox toggle only — no sub-UI revealed when enabled. Same HTML pattern as the AIO toggle in `IntegrationsSection.tsx` (a `<label>` wrapping `<div>` text + `<input type="checkbox">`).
- **D-12:** Section heading: "Tempo Timesheets". Description text: "Show worklog data from Jira Tempo Timesheets. Requires Tempo plugin on your Jira instance."

### Store Migration
- **D-13:** Bump `settings.store.ts` from v19 to v20. Add `tempoEnabled: boolean` (default `false`) and `setTempoEnabled: (v: boolean) => void`. Migration guard: `if (version < 20) { if (s.tempoEnabled === undefined) s.tempoEnabled = false; }`. *(Note: ROADMAP text says "existing v18 stores" — that's a copy-paste artefact from the AIO phase context. Actual current version is v19; bump is v19 → v20.)*

### Claude's Discretion
- `YYYY-MM-DD` string format for `from`/`to` parameters (decided; matches Tempo API directly)
- Exact Tempo pagination API shape (offset/limit vs cursor) — Claude reads Tempo docs or adapts based on probe result
- Whether `client.ts` exports `TEMPO_API_PATH` as a single constant or leaves room for a fallback path constant (match probe result)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §"Tempo Worklog Viewer" — TEMPO-06 (the only requirement this phase covers)

### Phase Details
- `.planning/ROADMAP.md` §"Phase 61: Tempo Probe + Service Layer" — goal, 4 success criteria, dependencies

### Template to Mirror
- `taskflow/src/services/aio/client.ts` — `aioFetch` signature and `apiFetch` wrapper pattern; `tempoFetch` mirrors this exactly
- `taskflow/src/services/aio/index.ts` — barrel re-export pattern for the `tempo/` barrel
- `taskflow/src/services/aio/types.ts` — type definition style for paginated API responses

### Settings Store
- `taskflow/src/stores/settings.store.ts` — current v19 store; `aioEnabled`/`setAioEnabled` pattern at lines 103–104, 219–220; migration guard style at lines 388–391; bump to v20 for `tempoEnabled`

### Settings UI
- `taskflow/src/routes/settings/IntegrationsSection.tsx` — AIO toggle HTML pattern (lines 66–80); Tempo toggle adds a new section below AIO using the same `<label>` + `<input type="checkbox">` structure
- `taskflow/src/routes/settings/IntegrationsSection.test.tsx` — test pattern to extend for tempoEnabled

### Library
- `taskflow/src/lib/apiFetch.ts` — `apiFetch(source, url, init, operation)` wrapper that `tempoFetch` calls

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `aioFetch` in `taskflow/src/services/aio/client.ts` — exact structural template for `tempoFetch`; copy and substitute AIO → Tempo, dual paths → single path
- `useSettingsStore` — `aioEnabled`/`setAioEnabled` pattern to copy for `tempoEnabled`/`setTempoEnabled`
- `readSecret('jira-pat')` in `IntegrationsSection.tsx` — token loading pattern; Tempo uses the same PAT

### Established Patterns
- Pagination: AIO uses `?limit=N&offset=M`; Tempo Timesheets uses similar offset pagination — loop until response indicates no more pages
- Migration guards: additive only — `if (version < N) { if (s.field === undefined) s.field = default; }`; never delete fields
- Barrel re-export: `index.ts` re-exports public API only (domain functions + types); `client.ts` internal, NOT re-exported
- `vi.stubGlobal('fetch', ...)` pattern for service unit tests (see `aio/projects.test.ts` or `aio/cycles.test.ts`)
- `apiFetch` operation label convention: `'Load Tempo Worklogs'` style (user-action-shaped)

### Integration Points
- `taskflow/src/routes/settings/IntegrationsSection.tsx` — add Tempo section below the AIO block; import `tempoEnabled`/`setTempoEnabled` from `useSettingsStore`
- `taskflow/src/routes/settings/IntegrationsSection.test.tsx` — extend with tempoEnabled toggle tests
- `taskflow/src/stores/settings.store.ts` — v19 → v20 bump with new fields and migration guard

</code_context>

<specifics>
## Specific Ideas

- Probe endpoint to try: `GET /rest/tempo-timesheets/4/worklogs?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&username=<your-username>` — simple user+date query that should return worklogs or a 401
- AIO probe precedent: see `.planning/phases/51-aio-service-layer/` for how auth was confirmed and documented in Phase 51 (Bearer PAT + Jira base URL, same-host plugin)
- Timezone bucketing: `worklog.startDate.slice(0, 10)` — never `new Date(worklog.startDate).toLocaleDateString()` (timezone-shifts break the date bucket). This is STATE.md decision from Phase 62 planning, already locked.
- Settings section label: "Tempo Timesheets" (matches plugin name); description: "Show worklog data from Jira Tempo Timesheets. Requires Tempo plugin on your Jira instance."

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 61-Tempo Probe + Service Layer*
*Context gathered: 2026-05-21*
