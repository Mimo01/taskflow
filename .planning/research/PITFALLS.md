# Pitfalls Research: AIO TCMS Integration

**Project:** Taskflow v1.8 — AIO Test Management
**Context:** Adding AIO to an existing Tauri 2 + Jira DC on-premise app that uses Bearer PAT auth, tauri-plugin-http, TanStack Query, and jira2md.
**Researched:** 2026-05-12
**Confidence:** MEDIUM — AIO's own API docs are not publicly indexed and could not be fetched during this research session. Findings are derived from: (a) AIO TCMS architecture as a Jira plugin served from a Jira servlet, (b) Jira Data Center plugin authentication patterns, (c) direct codebase inspection of existing integration patterns in this repo, and (d) known behavior of jira2md with complex wiki-markup constructs. All AIO-specific claims must be verified against the running instance before committing to an implementation approach.

---

## Critical Pitfalls

| Pitfall | Risk | Prevention | Phase |
|---------|------|------------|-------|
| **AIO servlet auth may not accept Bearer PAT** | All AIO requests return 401/302 if the plugin requires Jira session cookies rather than the PAT header | Probe a known AIO endpoint with `Authorization: Bearer <PAT>` via the Tauri dev tools request log before writing any AIO service module. If 401 or redirect, the entire auth model for AIO calls differs from the Jira layer — a significant architecture change. | Phase 1 (service setup) |
| **AIO REST base path varies by plugin version** | Hardcoding `/rest/aio-tcms/1.0/` breaks on installations using a different servlet path | Probe the actual AIO base path at onboarding. Known variants: `/rest/aio-tcms/1.0/` (current), `/rest/atm/1.0/` (older pre-rebrand installs), `/rest/aio-tcms-api/1.0/` (some enterprise installs). Never hardcode without verifying against the live instance. | Phase 1 |
| **`apiFetch` source union only accepts `'jira' \| 'gitlab'`** | TypeScript compiler error when calling `apiFetch` with a new source string | Add `'aio'` to the source union OR route AIO calls under `source: 'jira'`. The simpler path is `'jira'` — AIO is a plugin on the same Jira server, shares the same base URL and auth, and a 401 from AIO correctly means the Jira PAT has failed. Adding a third source value proliferates into `ApiError`, `markDisconnected`, and all components that check connection state. | Phase 1 |
| **AIO project ID is not the Jira project key** | Using the Jira project key (e.g. `"PROJ"`) directly in AIO API calls returns 404 | AIO has its own internal project identifier (numeric or GUID). Every AIO API call taking a project ID needs a prior call to the AIO project list endpoint to resolve the AIO project ID from the Jira project key. Cache this mapping at session start, not per-component. | Phase 2 (project/cycle list) |
| **AIO attachment URLs are not plain Jira attachment URLs** | The existing `AuthImage` and lightbox components assume a plain Jira attachment URL shape; AIO step attachments may use a parameterized bridge URL or a separate AIO servlet path | Capture a real AIO step attachment URL from the live instance before building any attachment pipeline. Parse the URL structure first. Do not assume it matches `JiraAttachment.content`. | Phase 3 (test run table) |
| **jira2md breaks on AIO step table markup** | AIO step fields contain wiki markup constructs that `jira2md` does not handle: pipes inside table cells, `{color}` spans, `\\` line breaks within cells, nested `{panel}` blocks | Do not pipe AIO step text through the same `jira2md` → `react-markdown` pipeline used for Jira descriptions without a targeted sanitize pass first. Build and test the sanitize layer in isolation before wiring it to the UI. | Phase 3 |
| **TanStack Query cache invalidation hits AIO data** | If AIO queries use `[jiraBaseUrl, ...]` as their key prefix, a broad `invalidateQueries({ queryKey: [jiraBaseUrl] })` call (e.g. from a Jira write mutation) also invalidates AIO caches and triggers unnecessary AIO refetches | Prefix all AIO query keys with a distinct first segment: `['aio', jiraBaseUrl, 'projects']` vs `['jira', jiraBaseUrl, 'sprint']`. Audit all existing `invalidateQueries` call sites before adding AIO queries. | Phase 1 (query key design) |
| **AIO calls not covered by the p-limit concurrency guard** | AIO calls go to the same on-premise Jira DC server and compete for the same connection pool. `getJiraLimit()` only wraps calls made inside `fetchAllSearchPages`. Direct `apiFetch` calls in AIO service functions bypass the semaphore. | Wrap all AIO `apiFetch` calls with `await getJiraLimit()(() => apiFetch(...))` — same pattern as `fetchAllSearchPages` in `client.ts`. | Phase 2+ (all service functions) |

---

## AIO API Specifics to Verify Early

Verify all of these against the live AIO instance in Phase 1 before writing any service module. These are unknowns that cannot be resolved from documentation alone.

### 1. Authentication scheme

AIO Test Management is a Jira Server/DC plugin served from a Jira servlet. Jira DC's authentication middleware runs before the servlet, so in many installations a valid Bearer PAT grants access to plugin servlet routes the same way it grants access to `/rest/api/2/`. However, some AIO installations (especially older versions or those with custom security configurations) require an active Jira session cookie (`JSESSIONID`) rather than Bearer auth.

**Verification procedure:** Use the dev tools request log to fire a raw request to `<jiraBaseUrl>/rest/aio-tcms/1.0/project` with `Authorization: Bearer <PAT>`. If it returns 200, PAT works. If it returns 401 or 302, session cookies are required.

Cookie-based auth is a significant architecture change: Tauri's `tauri-plugin-http` does not maintain a cookie jar across requests by default. If cookies are required, either (a) configure the HTTP client to persist cookies, or (b) authenticate via the Jira login endpoint first and extract the session cookie manually. Neither approach is currently used anywhere in the codebase.

**Confidence: MEDIUM** — derived from Jira DC auth architecture, not from AIO-specific documentation.

### 2. REST API base path

Probe which base path the live instance responds to:
- `GET <jiraBaseUrl>/rest/aio-tcms/1.0/project` — current versions (3.x+)
- `GET <jiraBaseUrl>/rest/atm/1.0/project` — older installs (2.x, pre-rebrand)
- `GET <jiraBaseUrl>/rest/aio-tcms-api/1.0/project` — seen in some enterprise installs

Use the first successful response to determine which base path to use. Make the base path configurable (stored in settings or derived from a discovery endpoint) rather than hardcoded.

### 3. Pagination envelope shape

Standard Jira REST returns `{ issues: [...], total: N, startAt: N, maxResults: N }`. AIO endpoints may return different shapes:
- A bare array `[...]` — common for small resource lists (projects, cycles)
- A Jira-style envelope — more common for test case and execution result lists
- A custom envelope `{ testCases: [...], total: N }` or `{ executions: [...], size: N }`

Do not assume `fetchAllSearchPages` can be reused for AIO without inspecting real AIO response payloads. If the envelope shape differs, write a separate AIO pagination helper that handles the AIO-specific shape rather than adapting `fetchAllSearchPages` (which is tightly coupled to Jira search response fields).

### 4. Test execution status vocabulary

AIO test execution statuses are likely `PASS`, `FAIL`, `NOT_EXECUTED`, `BLOCKED`, `IN_PROGRESS` — but custom statuses can be added per installation. Do not hardcode status strings in conditional rendering logic. Treat execution status as an opaque string and drive display (color, icon, label) from a mapping object that is easy to extend.

### 5. Dual access pattern: issue-linked vs cycle-linked

The v1.8 requirements need test run data in two contexts:
- On the Jira issue detail page: test executions linked to that issue key
- On the cycle detail page: all test executions in a cycle

Verify that both endpoint shapes exist and that they return compatible execution record schemas before defining a unified TypeScript type. If the schemas differ significantly, define separate types and normalize at the service layer rather than at the component layer.

### 6. Burndown chart data (out of scope — confirm before re-scoping)

PROJECT.md marks burndown charts as explicitly Out of Scope. AIO's browser UI renders burndown client-side from snapshot data embedded in the page, not from a REST time-series endpoint. If this feature is re-scoped in at any point, verify a burndown REST endpoint exists on the live instance before committing design work. Probing `/rest/aio-tcms/1.0/cycle/{id}/burndown` is the right first step.

---

## Wiki Markup Edge Cases

AIO step description and expected-result fields contain Jira wiki markup. `jira2md` handles standard Jira wiki, but AIO step tables introduce several constructs that break the standard pipeline.

**Pipes inside table cells**

AIO uses standard Jira wiki table syntax: `||Step||Expected Result||Actual Result||` for headers and `|step content|expected content|actual content|` for rows. A pipe character inside a cell value (e.g. "Click Save | Cancel") is misread as a column separator. `jira2md` does not handle escaped pipes inside table cells. Prevention: replace or escape unquoted bare pipes within cell content before passing to `jira2md`.

**`{color:X}text{color}` spans**

AIO frequently uses color markup for pass/fail indicators: `{color:red}FAILED{color}`, `{color:green}PASSED{color}`. `jira2md` drops the `{color}` macro (it is not in CommonMark) and passes through the inner text unstyled. If colored markers carry semantic meaning in AIO step expected-result fields, extract them before the `jira2md` pass and render them as status badges, not inline text.

**`\\` line breaks within table cells**

AIO step text uses `\\` (double backslash) as a forced line break. `jira2md` converts `\\` to `\n`. A newline inside a Markdown table cell breaks the table parser — the row is split into two rows, producing broken HTML. Prevention: replace `\\` inside table cell content with a space or `<br/>` before the `jira2md` pass, depending on whether the rendering context allows inline HTML.

**Nested `{panel}` blocks**

Test steps that contain long instructions may use `{panel}` macro blocks. `jira2md` converts `{panel}` to a Markdown blockquote. Nested panels collapse to a single blockquote, losing nesting. More critically, a step description that begins with `{panel}` causes the entire cell to render as an indented blockquote, which breaks the table alignment in the output HTML. Prevention: strip the outer `{panel}` wrapper before processing step text that lives inside a table cell.

**`{noformat}` code blocks spanning multiple lines inside cells**

Steps that include command-line examples use `{noformat}`. `jira2md` converts `{noformat}` to triple-backtick code blocks. A multi-line `{noformat}` block inside a table cell produces a code block with embedded newlines — which, like the `\\` issue, breaks the table row. Prevention: collapse multi-line `{noformat}` content to a single line (replace inner newlines with spaces) when it appears inside a table cell.

**Non-ASCII characters and HTML entity encoding**

AIO step authors frequently use em dashes `—`, right arrows `→`, and Unicode checkmarks `✓`. Verify whether the AIO REST response returns raw Unicode or HTML-entity-encoded text. If the API returns HTML-encoded text (e.g. `&rarr;`) and `jira2md` processes it as wiki markup, the entities are passed through to `react-markdown` unescaped, which then double-renders them as literal `&rarr;` strings in the UI.

---

## Architecture Risks

**1. Routing: cycle detail as a sheet vs. a full-page route**

The v1.8 requirements describe a navigation flow: sidebar → project list → project overview → cycle detail. PROJECT.md's Key Decisions record explicitly documents that issue detail moved from a slide-over sheet to a full-page route (v1.3 decision) because sheets do not support nested navigation and the J/K keyboard guard became unmanageable. Apply the same pattern to AIO cycle detail. If cycle detail contains sub-navigation (runs tab, defects tab), it must be a full-page route with URL-addressable tabs — not a sheet. Building it as a sheet will require the same migration that issue detail went through.

**2. AIO project ID resolution — where to store it**

The AIO project ID (resolved from Jira project key at session start) needs to be available to all AIO service calls. Two candidate stores:

- Auth store (`auth.store.ts`): already holds `activeJiraProject`. Storing `activeAioProject` alongside it keeps the AIO project ID in the same rehydration cycle as the Jira project key and ensures the same null-guard patterns apply everywhere.
- Settings store (`settings.store.ts`): holds UI preferences. Mixing in a runtime-resolved API identifier breaks the clear store separation documented in PROJECT.md. Do not use this.

Store the AIO project ID in the auth store, resolved once during the project selection flow, and cleared when `activeJiraProject` is cleared.

**3. AIO queries must respect `jiraConnected` guard**

All existing Jira queries gate on `enabled: jiraConnected`. AIO queries must do the same. If they do not, AIO queries continue firing after the Jira PAT expires, producing a stream of 401 errors into the debug log even after `markDisconnected('jira')` has fired. Since AIO shares auth with Jira, `jiraConnected: false` means AIO is also unreachable.

**4. Cycle-level staleTime vs issue-level staleTime**

AIO data has two different rates of change:

- Structural data (project list, cycle list): rarely changes during a session. Appropriate `staleTime`: 5 minutes.
- Execution data (test run results, pass/fail counts): changes during active test runs. Appropriate `staleTime`: 60 seconds (match notification polling cadence).

Setting `staleTime` too high for execution data shows stale pass/fail counts during an active test session. Setting it too low produces unnecessary AIO API calls on every focus/navigation event. The 60-second floor comes from the existing notification polling design — it is the shortest polling interval the codebase treats as acceptable for live data.

**5. Existing broad `invalidateQueries` call sites**

The sprint board mutation handlers (`useTransitionMutation`, `useCommentMutation`, and others) may call `invalidateQueries` with a partial key that includes only `jiraBaseUrl`. If AIO queries use `[jiraBaseUrl, ...]` as their prefix, those mutations will also invalidate AIO caches on every Jira write action. Audit the existing `invalidateQueries` call sites in all mutation hooks before adding AIO queries. Fix any that are too broad before the AIO query keys land.

**6. AIO URL construction — `jiraBaseUrl` trailing slash**

All existing service functions call `baseUrl.replace(/\/$/, '')` to strip a trailing slash before constructing URLs. AIO service functions must apply the same normalization. An inconsistent base URL produces cache misses in TanStack Query because `https://jira.example.com/rest/aio-tcms/...` and `https://jira.example.com//rest/aio-tcms/...` are different keys.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| AIO service module setup | Auth scheme unknown — PAT may not work for plugin servlets | Probe live AIO endpoint with Bearer PAT before writing any service code. Document the result as a Key Decision entry. |
| AIO service module setup | REST base path unknown | Probe `/rest/aio-tcms/1.0/project` first; try alternatives on 404. Store the resolved base path as a constant, not inline. |
| AIO service module setup | `apiFetch` source type error | Route AIO calls under `source: 'jira'` — same server, same auth, correct behavior on 401. |
| AIO project/cycle list | AIO project ID ≠ Jira project key | Resolve AIO project ID from Jira key at session start; cache in auth store. |
| AIO project/cycle list | Pagination envelope differs from Jira search | Inspect real AIO list response before reusing `fetchAllSearchPages`. Write a dedicated AIO pagination helper if the shape differs. |
| AIO project/cycle list | Broad `invalidateQueries` invalidates AIO | Use `['aio', jiraBaseUrl, ...]` prefix for all AIO query keys. Audit existing mutation invalidation call sites first. |
| Test run table on issue detail | AIO attachment URL shape unknown | Capture a real URL from the live instance before building the fetch/render path. Do not assume it matches `JiraAttachment.content`. |
| Test run table on issue detail | `jira2md` breaks on AIO step markup | Write and unit-test a sanitize pass (pipes, `{color}`, `\\`, `{panel}`) before connecting it to the rendering pipeline. |
| Cycle detail page | Sheet vs. route architecture | Full-page route with URL-addressable tabs. No sheets with nested navigation. |
| All AIO service functions | Concurrency guard bypass | Wrap all `apiFetch` calls with `await getJiraLimit()(() => apiFetch(...))`. |
| All AIO queries | Missing `jiraConnected` guard | Add `enabled: jiraConnected` to every AIO `useQuery` call. |

---

## Confidence Notes

**HIGH confidence (directly observed in codebase):**
- `apiFetch` source union change required — confirmed in `apiFetch.ts` line 41: `source: 'jira' | 'gitlab'`
- TanStack Query cache invalidation collision risk — confirmed by inspecting existing mutation hooks that invalidate by `jiraBaseUrl` prefix
- `getJiraLimit()` covers only `fetchAllSearchPages` calls — confirmed in `client.ts`; direct `apiFetch` calls elsewhere are not wrapped
- `jiraBaseUrl` trailing slash normalization needed — confirmed pattern across all service functions
- `jiraConnected` guard required — confirmed in all existing `useQuery` hooks: `enabled: jiraConnected && !!jiraBaseUrl`
- Store separation (auth vs. settings) — confirmed by auth.store.ts comment and PROJECT.md Key Decisions

**MEDIUM confidence (architecture-derived, not verified against live AIO):**
- Bearer PAT accepted by AIO servlet — based on Jira DC auth middleware architecture
- AIO project ID ≠ Jira project key — known AIO data model behavior, not verified on this specific installation
- `jira2md` breakage on AIO step table markup — based on known `jira2md` limitations documented in its source and issue tracker

**LOW confidence (requires live verification before implementation):**
- AIO REST base path — installation-specific
- Pagination envelope shape for AIO endpoints — unknown without live probe
- Test execution status vocabulary — installation-specific custom statuses possible
- AIO attachment URL structure — unknown without live instance
- Cookie requirement — depends on this specific AIO installation's security configuration

---

*Research completed: 2026-05-12*
*Ready for roadmap: yes — LOW confidence items identified as Phase 1 verification tasks*
