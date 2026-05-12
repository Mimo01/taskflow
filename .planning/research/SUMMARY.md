# Research Summary: AIO Test Management Integration (v1.8)

**Project:** Taskflow v1.8 — AIO Test Management Integration
**Domain:** Jira Data Center plugin REST integration — read-only TCMS surfaced inside a Tauri 2 desktop app
**Researched:** 2026-05-12
**Confidence:** MEDIUM (AIO API shape unverified against live instance; all structural decisions HIGH confidence from codebase analysis)

---

## Executive Summary

Taskflow v1.8 adds a read-only AIO Test Management view to an already mature Tauri 2 + React 19 desktop app. AIO is a Jira Data Center plugin whose REST API sits at `/rest/aio-tcms/1.0/` on the same host as Jira and authenticates with the same Bearer PAT already stored in Stronghold. This means the integration requires almost no new infrastructure: one new npm dependency (`recharts ^2.15.x` for cycle progress charts), a new `src/services/aio/` domain module mirroring the existing Jira service structure, three new lazy-loaded route pages, and targeted extensions to `PinnedTabStrip`, `AppLayout`, and `IssueDetailPage`. The existing `apiFetch`, `AuthImage`, `TanStack Query`, `jira2md`, and sidebar customization systems all carry over unchanged.

The recommended approach is to build strictly bottom-up: verify the live AIO instance auth and base path first (before any service code), then build the service layer, then the navigation shell, then page content outward from the project list to cycle detail. AIO test run data is also surfaced on the existing Jira issue detail page as a lazily loaded enrichment section — this is independent of the sidebar AIO section and shares only the service layer. The burndown chart is explicitly out of scope (AIO does not expose a burndown REST endpoint; it computes the chart client-side in the plugin UI).

The main risk is that several AIO API properties — the REST base path, pagination envelope shape, attachment URL structure, and execution status vocabulary — cannot be confirmed from documentation alone and vary by plugin version and installation. A short live-instance probe session must happen before any service function is written. If that probe reveals that AIO requires Jira session cookies rather than Bearer PAT, the auth model requires a non-trivial architecture change (cookie jar management in `tauri-plugin-http`) that is not currently present anywhere in the codebase.

---

## Stack Additions

| Library | Version | Purpose |
|---------|---------|---------|
| `recharts` | `^2.15.x` | Cycle execution progress charts. Only new dependency. SVG-based, React-native, aligns with shadcn/ui chart ecosystem. Install from `taskflow/` with `npm install recharts`. |

Everything else — `apiFetch` + `tauri-plugin-http`, TanStack Query v5, `jira2md` + `react-markdown` + `remark-gfm`, `AuthImage`, `AttachmentLightbox`, `@dnd-kit`, `Zustand`, `shadcn/ui` Badge/skeleton — handles AIO needs without modification.

Do not add an AIO vendor SDK, `chart.js`, `d3`, or a separate AIO credential store. Do not add `'aio'` as a third `apiFetch` source type — route all AIO calls under `source: 'jira'` (same host, same auth, correct 401 behavior).

---

## Key Feature Findings

### AIO Data Model

Four-level hierarchy: **Project → Cycle → Test Case → Test Run → Step Execution**. The Jira project key and the AIO project ID are not the same thing — AIO has its own numeric/GUID identifier. Every service call that takes a project ID must use the AIO-resolved ID, not the Jira key. Resolve once at session start and cache in the auth store.

### API Base Path

`{jiraBaseUrl}/rest/aio-tcms/1.0/` — but this varies by plugin version. Known variants: `/rest/atm/1.0/` (pre-rebrand installs), `/rest/aio-tcms-api/1.0/` (some enterprise installs). Probe before hardcoding.

### Execution Statuses

`NOT_RUN`, `PASS`, `FAIL`, `BLOCKED`, `IN_PROGRESS`, `SKIP` — treat as opaque strings, not an enum. Drive color/icon/label from a mapping object so custom statuses on this instance degrade gracefully rather than crash. The API may return a status object `{id, name, color}` rather than a plain string — check the live response.

### Burndown

Burndown (time-series daily snapshot) is explicitly out of scope for v1.8. AIO computes it client-side in the plugin UI and does not expose a raw time-series REST endpoint. The recharts dependency is justified by the cycle progress bar (pass/fail/blocked/not-run segmented display) — which does have an endpoint-backed data shape — not a burndown line chart.

### AIO on Issue Detail

AIO does not store test run data as a Jira custom field. A separate `GET /rest/aio-tcms/1.0/testrun/forIssue?issueKey={key}` call is required when rendering the issue detail page. This endpoint path has three known variants; probe all three. The section must gate on an `aioEnabled` settings toggle and load lazily so it does not block the main issue data load.

### MVP Scope

Build: AIO sidebar section (project list → project overview → cycle detail with progress bar, run table, defect count), cycle pin to header tabs, AIO test run table on issue detail, attachment preview via bridge URL fetch. Defer: burndown chart, test case creation/editing, write-back of execution status, cross-cycle reporting.

---

## Architecture Decision Points

**1. Full-page routes, not sheets.** Cycle detail must be a full-page route with URL-addressable tabs. PROJECT.md's Key Decisions document records that issue detail migrated from sheet to full-page route in v1.3 because sheets do not support nested navigation. Do not repeat that migration for AIO.

**2. `source: 'jira'` for all AIO calls.** AIO is a plugin on the same Jira server. Routing under `source: 'jira'` means a 401 from AIO correctly triggers `setJiraConnected(false)` and AIO queries correctly gate on `enabled: jiraConnected`. Adding `'aio'` as a third source proliferates into `ApiError`, `markDisconnected`, and all connection-state checks for no user-visible benefit.

**3. `['aio', jiraBaseUrl, ...]` query key prefix.** Existing mutation handlers may call `invalidateQueries` with a key that starts with `jiraBaseUrl`. AIO queries must use `'aio'` as their first tuple segment to avoid being swept up in those broad invalidations. Audit all existing `invalidateQueries` call sites before AIO queries land.

**4. AIO project ID lives in auth store.** Resolved from Jira project key at session start, cleared when `activeJiraProject` is cleared. Do not put it in the settings store (which holds UI preferences — documented Key Decision in PROJECT.md).

**5. `aio:projectId:cycleId` pinned key format.** No change to `usePinnedTabsStore`. AIO cycle keys use an `aio:` prefix alongside Jira issue keys. `PinnedTabStrip` requires a small rename (`ResolvedIssue` → `ResolvedTab`, `issueTypeName` → `typeLabel`) and one new icon case for `'aio-cycle'`.

**6. Concurrency guard applies to AIO.** `getJiraLimit()` currently wraps only `fetchAllSearchPages` calls. All AIO `apiFetch` calls must also be wrapped with `await getJiraLimit()(() => apiFetch(...))` — they hit the same on-premise Jira DC connection pool.

**7. staleTime tiering.** Structural data (project list, cycle list): 5 min. Execution data (cycle summary counts, test run results): `STALE_TIME_MS` (30s) with a `refetchInterval` of `POLL_INTERVAL_MS` (60s) when the user is on the cycle detail route.

**8. AIO step text must be sanitized before `jira2md`.** Pipes inside cells, `{color}` spans, `\\` line breaks, and `{panel}` nesting each break the existing pipeline. If AIO's step endpoint returns structured JSON (preferred path), skip the wiki pipeline entirely and render a `TestStepTable` component directly from the JSON fields.

---

## Watch Out For

Ranked by severity and likelihood of blocking progress.

**1. Bearer PAT may not authenticate AIO servlet calls.**
Some AIO installations require a Jira session cookie rather than a Bearer token. If this instance falls into that category, it means implementing cookie-jar management in `tauri-plugin-http` — a pattern not used anywhere in the current codebase. This would be the largest single unplanned architecture change in v1.8. Verify first, before any service code is written.

**2. AIO REST base path is installation-specific.**
Three known variants (`/rest/aio-tcms/1.0/`, `/rest/atm/1.0/`, `/rest/aio-tcms-api/1.0/`). Hardcoding without probing will silently break on non-current installs. Probe at onboarding and store the resolved base path as a constant.

**3. AIO project ID is not the Jira project key.**
Every AIO endpoint that accepts a project ID expects AIO's own internal identifier, not the Jira project key. Passing the Jira key returns 404. Resolve the AIO project ID from the project list endpoint at session start and cache it; do not resolve per-component.

**4. Broad `invalidateQueries` calls will sweep AIO caches.**
Existing Jira mutation hooks may invalidate by partial key `[jiraBaseUrl]`. AIO query keys that do not start with `'aio'` will be invalidated on every Jira write. Audit before adding AIO queries; fix any over-broad invalidation call sites first.

**5. `jira2md` produces broken table HTML from AIO step markup.**
Pipes inside table cells, `{color}` macros, `\\` line breaks, and nested `{panel}` blocks each produce malformed output. If the step endpoint returns wiki markup rather than structured JSON, a sanitize pass targeting these four constructs must be built and unit-tested before connecting to the rendering pipeline.

---

## Pre-Implementation Verification Checklist

Run these probes against the live AIO instance before writing any TypeScript service code.

- [ ] **Auth scheme** — `GET {jiraBaseUrl}/rest/aio-tcms/1.0/project/list` with `Authorization: Bearer <PAT>`. Expect 200. If 401 or 302, document cookie requirement and re-scope auth approach.
- [ ] **REST base path** — confirm which variant responds (try all three). Record as a named constant.
- [ ] **Project list response envelope** — is it `{ projects: [...] }`, `{ values: [...] }`, or a bare array? What field holds the AIO project ID vs the Jira project key?
- [ ] **Cycle list envelope key** — `testCycles`, `cycles`, or `values`?
- [ ] **Test run list envelope key** — `testRuns`, `runs`, or `values`? Are `startAt`/`maxResults`/`total` present?
- [ ] **Execution status format** — plain string `"PASS"` or object `{ id, name, color }`?
- [ ] **`forIssue` endpoint path** — probe all three variants. Record which returns 200.
- [ ] **AIO attachment URL structure** — capture a real attachment URL from a test run response. Confirm `AuthImage`'s `src.startsWith(jiraBaseUrl)` fires, or identify the correct prefix.
- [ ] **Bridge URL query params** — verify exact param names for the attachment servlet and whether `projectId` is numeric or the Jira project key.
- [ ] **Step data format** — structured JSON or wiki markup? This determines `TestStepTable` vs sanitized `WikiRenderer` path.

---

## Suggested Phase Structure

### Phase 1: Live Instance Probe + Service Layer

**Rationale:** Every downstream phase depends on knowing the correct API base path, auth model, and response shapes. The live probe must happen first, findings recorded as Key Decision entries, then the service layer is built.

**Delivers:** Verified API constants, `src/services/aio/` module (types, client, projects, cycles, runs, issue-runs), unit tests for each service function, `aioEnabled` settings toggle, AIO project ID resolution at session start.

**Must avoid:** Hardcoded base path; AIO project ID assumed to be the Jira key; missing `getJiraLimit()` wrapper; missing `enabled: jiraConnected` guard; AIO query keys not prefixed with `'aio'`.

**Research flag:** Run the pre-implementation verification checklist above before any code is written. Auth scheme and base path are hard blockers.

### Phase 2: Sidebar Nav + Routing Shell

**Rationale:** Establishes navigation so subsequent phases can be tested end-to-end from the sidebar. Low risk — follows established `sidebar-items.ts` + `routes.tsx` patterns exactly.

**Delivers:** `'testing'` sidebar section, `'aio-tests'` nav item, `FlaskConical` icon, three lazy-loaded route stubs, updated sidebar preset tests.

**Research flag:** Standard pattern — no phase research needed.

### Phase 3: Project List + Project Overview Pages

**Rationale:** Builds the first two levels of the navigation hierarchy. Straightforward list-with-skeleton pages following the established `useQuery` + skeleton + empty/error state pattern.

**Delivers:** `AioProjectsPage`, `AioProjectDetailPage`, `AioCycleSkeleton`, progress display per cycle. Navigation from sidebar to cycle list works end-to-end.

**Must avoid:** AIO project ID passed as Jira key to cycle list endpoint.

**Research flag:** Standard list/skeleton pattern — no phase research needed.

### Phase 4: Cycle Detail Page + Pinned Tab Support

**Rationale:** The deepest and most complex view. Building cycle detail and pin support together is efficient because they share the same cycle summary data shape and the `PinnedTabStrip`/`AppLayout` extension only needs to happen once.

**Delivers:** `TestRunTable` (step/expected/actual columns, colored status badges, status filter chips), `AioCycleDetailPage` (progress bar, run table, defect count, pin button), `PinnedTabStrip` rename + `'aio-cycle'` icon case, `AppLayout` extensions (tab click dispatcher, `activeTabKey` derivation, breadcrumb guard, `routeLabel`).

**Must avoid:** Cycle detail as a sheet; hard-coded execution status strings; missing poll interval for active execution data.

**Research flag:** Status badge rendering depends on execution status format confirmed in Phase 1 probe.

### Phase 5: AIO on Jira Issue Detail

**Rationale:** Independent entry point but depends on the service layer (Phase 1) and `TestRunTable` (Phase 4). Keeps the issue detail page untouched until `TestRunTable` is stable.

**Delivers:** `AioRunsSection` (lazy query + `TestRunTable` + loading/empty handling), mounted in `IssueDetailPage` below `AttachmentsSection`.

**Must avoid:** Firing the `forIssue` query when `aioEnabled` is false; blocking the main issue data load; error state when the issue simply has no associated test runs (404 should silently collapse the section).

**Research flag:** `forIssue` endpoint variant must be confirmed in Phase 1 probe.

### Phase 6: Attachment Auth Verification + Settings Connection Card

**Rationale:** Deferred until Phase 5 because real AIO attachment URLs only appear once the test run table renders live data. This phase validates (and if necessary patches) the `AuthImage` path for AIO-hosted attachments.

**Delivers:** Confirmed or patched `AuthImage.needsAuth` for AIO attachment URLs; `fetchAioAttachmentBlob` helper for bridge-URL non-image files; optional AIO connection card in Settings → Connections (only if AIO URL differs from Jira URL).

**Research flag:** Attachment URL structure from Phase 1 probe determines scope. Same-host deployments may require zero new code here.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | One new dep (`recharts`). All other decisions grounded in direct codebase audit. |
| Features | MEDIUM | AIO data model and status set are well-documented. Endpoint paths, envelope shapes, and attachment URL structure require live-instance verification. Burndown definitively out of scope. |
| Architecture | HIGH | All decisions derived from direct inspection of the existing codebase. Service module structure, query key conventions, pinned tab extension, and store placement are exact fits to established patterns. |
| Pitfalls | HIGH (structural) / MEDIUM (AIO-specific) | Structural pitfalls confirmed by codebase inspection. AIO-specific pitfalls confirmed by architecture reasoning; require live verification. |

**Overall confidence:** MEDIUM — structural approach is solid; a small number of AIO API properties are blockers that must be resolved in Phase 1 before service code is written.

### Gaps to Address

- **Auth scheme (BLOCKER):** Must probe Bearer PAT acceptance before writing any AIO service function. If cookies are required, re-scope Phase 1 to include `tauri-plugin-http` cookie jar configuration.
- **REST base path (BLOCKER):** Must probe all three variants and store the confirmed path as a named constant.
- **Pagination envelope shape:** Write a dedicated AIO pagination helper rather than reusing `fetchAllSearchPages` until the real envelope shape is confirmed.
- **Step data format:** If steps come as wiki markup, the `jira2md` sanitize pass (four constructs: pipes, `{color}`, `\\`, `{panel}`) must be built and unit-tested in Phase 1 before any test run rendering is attempted.
- **Custom execution statuses:** This instance may have custom statuses beyond the canonical six. The status-to-color mapping object must have a safe fallback rendering for unknown values.

---

## Sources

### High Confidence (codebase inspection)
- `taskflow/src/lib/apiFetch.ts` — source union type, request logging
- `taskflow/src/stores/auth.store.ts` — store separation, rehydration patterns
- `taskflow/src/services/jira/` — service module pattern, query key conventions, `getJiraLimit` usage
- `taskflow/src/components/app/PinnedTabStrip.tsx` — pinned tab data shape and extension points
- `taskflow/src/main.tsx` (AppLayout) — `useQueries` for pinned tabs, breadcrumb logic
- `taskflow/src/routes/dashboard/issue-detail/` — enrichment section patterns
- `taskflow/src/components/AuthImage.tsx` — authenticated image fetch pattern
- `taskflow/src/routes/dashboard/WikiRenderer.tsx` — jira2md pipeline

### Medium Confidence (training knowledge, AIO TCMS documentation patterns)
- AIO Tests for Jira — REST API path conventions, data model hierarchy, execution status set
- AIO bridge URL pattern for attachments — observed in community integrations
- Jira DC authentication middleware — Bearer PAT scope for plugin servlet routes

### Low Confidence (requires live instance probe)
- Exact REST base path on this installation
- Pagination envelope field names
- AIO attachment bridge URL query parameter names
- `forIssue` endpoint variant active on this instance
- Whether Bearer PAT or session cookie is required

---

*Research completed: 2026-05-12*
*Ready for roadmap: yes — Phase 1 live-instance probe is a prerequisite gate before service code is written*
