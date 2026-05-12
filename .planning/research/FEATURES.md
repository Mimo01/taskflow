# Features Research: AIO TCMS Integration

**Project:** Taskflow v1.8 — AIO Test Management Integration
**Researched:** 2026-05-12
**Confidence:** MEDIUM (training knowledge; external lookup tools unavailable during this session — see confidence notes per section)

---

## Research Notes

All external lookup tools (WebSearch, WebFetch, Bash/Context7 CLI) were denied during this session.
This document draws on training knowledge of AIO Tests for Jira (aio-tcms plugin), which is a
well-established Atlassian Marketplace plugin with public REST API documentation. Confidence notes
are inline for each section. Items marked LOW confidence must be verified against the live AIO
instance before implementation. Items marked MEDIUM confidence represent documented API patterns
that are unlikely to have changed. Items marked HIGH confidence are structural patterns consistent
across all known AIO TCMS versions.

**Critical pre-implementation step:** Before writing any service functions, hit the live AIO
instance with the PAT and inspect actual response shapes. The AIO REST API does not follow the
Jira REST v2 envelope shape — it uses its own response structures.

---

## AIO Data Model

AIO Test Management organizes test assets in a strict four-level hierarchy:

```
AIO Project (scoped to a Jira project)
  └── Cycle (a named test execution cycle, e.g. "Sprint 42 Regression")
        └── Case (a test case: title, steps, expected results — reusable asset)
              └── Run (an execution instance of a Case within a Cycle)
                    └── Step Execution (per-step actual results, status, attachments)
```

### Key Entity Fields

**AIO Project**
- `id` — numeric string
- `name` — display name
- `jiraProjectKey` — links back to the Jira project (e.g. `"SHOP"`)
- `description` — optional text
- `cycleCount` — total cycles in project (may be derived, not always in list response)

**Cycle**
- `id` — numeric or string ID
- `name` — cycle name
- `description` — optional
- `startDate` / `endDate` — ISO date strings; may be null
- `status` — `"ACTIVE"` | `"CLOSED"` | `"DRAFT"` (LOW confidence on exact enum)
- `totalCases` — count of test cases assigned
- `executedCases` — count with any non-"Not Run" status
- `passCount` — count with status PASS
- `failCount` — count with status FAIL
- `blockedCount` — count with status BLOCKED
- `notRunCount` — count with status NOT_RUN / "Not Run"
- `defectCount` — count of linked Jira issues filed as defects
- `projectId` — parent project reference

**Test Case**
- `id` — numeric string
- `key` — human-readable key, e.g. `"TC-1234"` or `"SHOP-TC-42"` (format varies by instance config)
- `title` / `name` — test case title
- `description` — preconditions or overview (wiki text or plain text)
- `steps` — array of step objects (see below)
- `status` — current execution status within the cycle context
- `assignee` — { `displayName`, `name` } (mirrors Jira user shape)
- `labels` — string array
- `priority` — `"HIGH"` | `"MEDIUM"` | `"LOW"` | `"CRITICAL"` (LOW confidence on exact values)
- `automated` — boolean; whether the case is automated

**Test Step** (within a Test Case)
- `id` — numeric string
- `index` — 1-based step number
- `description` — what to do ("Navigate to checkout")
- `expectedResult` — what should happen ("Cart total displayed correctly")
- `testData` — optional input data for the step

**Test Run** (execution of a Case in a Cycle)
- `id` — run execution ID
- `caseId` — reference to the Test Case
- `cycleId` — reference to the Cycle
- `status` — execution status (see Execution Statuses below)
- `assignee` — { `displayName`, `name` }
- `executedBy` — { `displayName`, `name` } (who last updated the run)
- `executedOn` — ISO timestamp of last execution
- `comment` — tester notes / actual result summary
- `defects` — array of linked Jira issue keys (e.g. `["SHOP-1021"]`)
- `attachments` — array of attachment metadata (see AIO Attachments section)
- `stepExecutions` — array (see below); may only be present in the detail endpoint, not list

**Step Execution** (within a Test Run)
- `stepId` — reference to parent step
- `index` — step number
- `status` — per-step execution status
- `actualResult` — tester's actual result text
- `comment` — optional notes
- `attachments` — array of per-step attachment metadata

---

## AIO REST API Endpoints

**Confidence: MEDIUM** — These endpoint patterns are consistent with AIO TCMS public documentation
and community reports. Base path `/rest/aio-tcms/1.0/` is the established REST API path.
The servlet path `/plugins/servlet/aio-tcms/` is used for UI-bridge resources (attachments, images),
not for data API calls.

**Auth:** Same Jira PAT used for all Jira calls — send as `Authorization: Bearer <PAT>` header.
The AIO REST API piggybacks on Jira's authentication. No separate AIO token needed.

**Base URL pattern:** `{jiraBaseUrl}/rest/aio-tcms/1.0/`

| Endpoint | Method | Purpose | Key Params |
|----------|--------|---------|------------|
| `/rest/aio-tcms/1.0/project/list` | GET | List all AIO projects accessible to the user | — |
| `/rest/aio-tcms/1.0/project/{projectId}` | GET | Get a single AIO project by ID | `projectId` |
| `/rest/aio-tcms/1.0/project/{projectKey}/testcycles` | GET | List cycles for a Jira project key | `projectKey` (e.g. `"SHOP"`); optional `?status=ACTIVE` |
| `/rest/aio-tcms/1.0/project/{projectKey}/testcycles/{cycleId}` | GET | Get a single cycle with summary stats | `projectKey`, `cycleId` |
| `/rest/aio-tcms/1.0/project/{projectKey}/testcycles/{cycleId}/testruns` | GET | List all test runs (cases) in a cycle | `projectKey`, `cycleId`; paginates with `startAt`, `maxResults` |
| `/rest/aio-tcms/1.0/project/{projectKey}/testcycles/{cycleId}/testruns/{runId}` | GET | Get a single test run with full step executions | `projectKey`, `cycleId`, `runId` |
| `/rest/aio-tcms/1.0/testcase/{caseId}` | GET | Get test case definition (steps, expected results) | `caseId` |
| `/rest/aio-tcms/1.0/project/{projectKey}/testcycles/{cycleId}/testruns/{runId}/stepexecutions` | GET | Get step-level executions for a run | — |
| `/rest/aio-tcms/1.0/project/{projectKey}/testcycles/{cycleId}/defects` | GET | List Jira issue keys linked as defects in a cycle | `projectKey`, `cycleId` |

**Variant patterns (LOW confidence — seen in community integrations, not verified):**
- Some AIO versions use `projectId` (numeric) rather than `projectKey` in path segments — check the
  actual response from `/project/list` to determine which identifier the cycle endpoints expect.
- Some deployments expose `/rest/aio-tcms/1.0/testrun/{runId}` as a flat endpoint (bypassing the
  project/cycle path hierarchy) for direct run lookup.

**Pagination:** AIO list endpoints follow Jira-style `startAt` + `maxResults` + `total` envelope.
Response shape likely:
```json
{
  "startAt": 0,
  "maxResults": 50,
  "total": 142,
  "testRuns": [ ... ]
}
```
Array key name varies by endpoint (`testRuns`, `testCycles`, `testCases`).

**Issue-scoped test run endpoint (MEDIUM confidence):**
AIO exposes test runs linked to a specific Jira issue via a custom Jira REST extension:
```
GET {jiraBaseUrl}/rest/aio-tcms/1.0/testrun/forIssue?issueKey={issueKey}
```
or as a Jira issue property/custom field lookup. This is how the AIO test run panel appears in the
Jira issue view — the front-end calls this endpoint when rendering the issue. The exact path
differs between AIO versions (see "AIO on Issue Detail" section below).

---

## Execution Statuses

**Confidence: HIGH** — These are the canonical statuses documented in AIO TCMS and consistent
across all known deployments. AIO uses a fixed set of built-in statuses (not user-configurable
in the same way some other tools are). Custom statuses may exist in some enterprise configs but
the defaults below are always present.

| Status Key | Display Name | Meaning | Color Convention |
|------------|--------------|---------|-----------------|
| `NOT_RUN` | Not Run | Test case assigned to cycle but not yet executed | Gray |
| `PASS` | Pass | Execution succeeded; all expected results met | Green |
| `FAIL` | Fail | Execution failed; expected results not met | Red |
| `BLOCKED` | Blocked | Cannot execute due to blocker (dependency, env issue) | Orange/Amber |
| `IN_PROGRESS` | In Progress | Execution started but not yet completed | Blue |
| `SKIP` | Skip / N/A | Test case excluded from this cycle run | Gray/Purple |

**Notes on status values:**
- The API may return status as the string key (`"NOT_RUN"`, `"PASS"`) or as a status object
  `{ "id": 1, "name": "Not Run", "color": "#808080" }` — check the live response.
- Some AIO deployments render `NOT_RUN` as `"Not Run"` with a space; normalize on receive.
- `IN_PROGRESS` may not appear in all deployments — some show only the terminal states.
- For cycle-level progress bars, the denominator is `totalCases`; the numerator for "done" is
  `passCount + failCount + blockedCount + skipCount` (anything that has been touched).

**TypeScript enum recommendation:**
```typescript
export type AioExecutionStatus =
  | 'NOT_RUN'
  | 'PASS'
  | 'FAIL'
  | 'BLOCKED'
  | 'IN_PROGRESS'
  | 'SKIP';
```
Store the raw string from the API; do not coerce to an enum — if a custom status appears on this
instance, the app should degrade gracefully rather than crash.

---

## Cycle Detail Dashboard — Table Stakes

These are the features users expect to see on a cycle detail view. Missing any of these makes the
view feel incomplete relative to the AIO web UI in Jira.

- **Execution progress bar** — visual breakdown of pass/fail/blocked/not-run as a segmented
  horizontal bar; total count and percentage below. This is the first thing QA leads look at.
  Data: `passCount`, `failCount`, `blockedCount`, `notRunCount`, `totalCases` from the cycle
  summary endpoint.

- **Test run table** — paginated list of all test cases in the cycle showing:
  - Test case key (e.g. TC-42)
  - Test case title / summary
  - Assignee (name or avatar)
  - Execution status (colored badge: green=pass, red=fail, etc.)
  - Last executed timestamp
  - Defect count (linked issues)
  The table must support basic status filtering (show only FAIL, show only NOT_RUN).

- **Defect count summary** — total number of linked Jira defects filed from this cycle.
  A link/click opens the associated Jira issues (deep link to Jira issue detail in Taskflow's
  existing IssueDetailPage).

- **Cycle metadata header** — cycle name, start/end dates, status badge (Active/Closed/Draft).

- **Empty state** — when `totalCases = 0` or cycle not yet started, show a meaningful message
  rather than an empty table.

- **Loading/error states** — consistent with the rest of Taskflow (skeleton on `isLoading`,
  `StaleDataBanner` on `isFetching` with cached data, `ErrorState` on failure).

## Cycle Detail Dashboard — Differentiators

Features that would make the Taskflow AIO view stand out versus switching to the Jira web UI:

- **Inline test run detail expand** — clicking a row in the run table expands the step-by-step
  execution inline (step description, expected, actual, per-step status) without navigating away.
  AIO's Jira UI requires a full page navigation. A fast in-place expand is a genuine UX improvement.

- **Status filter chips** — quick filter chips identical to the sprint board's Quick Filter pattern
  already in Taskflow. Allow one-click filtering to "Only Failures", "Only Blocked", "Only Not Run".

- **Defects as clickable Jira issue badges** — each linked defect key rendered as a badge that
  opens the Taskflow IssueDetailPage for that issue (reusing existing `onIssueClick` prop). Avoids
  switching to Jira web UI for defect investigation.

- **Cycle pinning to header tabs** — stated in the PROJECT.md milestone requirements. Pin any cycle
  to the header tab strip for one-click access, same mechanism as pinned Jira issues. Unique to
  Taskflow — the Jira web UI has no equivalent.

- **Attachment preview in lightbox** — test run attachments (screenshots, evidence files) opened
  in Taskflow's existing image lightbox component via the authenticated bridge URL fetch. Eliminates
  the need to download files and open them externally.

- **Progress ring per cycle in project overview** — on the project overview page listing cycles,
  show a small donut ring (pass% fill) per cycle row for at-a-glance health. Higher information
  density than AIO's default list.

---

## AIO Attachments

**Confidence: MEDIUM** — The bridge URL pattern is documented in AIO TCMS Jira plugin internals
and community posts. The exact query parameter names require verification against the live instance.

### How AIO Attachment URLs Work

AIO stores attachment binaries separately from Jira's attachment system. They are NOT accessible
via the Jira `/rest/api/2/attachment/{id}` endpoint. AIO serves them through a plugin servlet:

```
{jiraBaseUrl}/plugins/servlet/aio-tcms/bridge/tcms/browse?page=run-details-attachment&attachmentId={aioAttachmentId}&cycleId={cycleId}&projectId={projectId}
```

Key characteristics:
- This is NOT a REST API endpoint — it is a servlet that returns the binary file directly.
- Auth required: the same `Authorization: Bearer <PAT>` header as all other Jira calls.
- The response is the raw binary (image, PDF, etc.) with appropriate `Content-Type` header.
- The URL is NOT directly usable as an `<img src="...">` in the webview — it would hit CORS
  (same issue as all Jira URLs in Tauri). Must be fetched via `apiFetch('jira', url, ...)` and
  converted to a blob URL (`URL.createObjectURL(blob)`).

### Attachment Object Shape (from test run response)

```typescript
interface AioAttachment {
  id: string;           // AIO attachment ID (used in bridge URL)
  name: string;         // filename, e.g. "screenshot.png"
  contentType: string;  // MIME type, e.g. "image/png"
  size: number;         // bytes
  cycleId: string;      // needed for bridge URL construction
  projectId: string;    // needed for bridge URL construction
  createdAt?: string;   // ISO timestamp
  createdBy?: { displayName: string; name: string };
}
```

### Fetch Pattern

Follows the same pattern as existing Jira image fetching in Taskflow:

```typescript
async function fetchAioAttachmentBlob(
  jiraBaseUrl: string,
  token: string,
  attachment: AioAttachment,
): Promise<string> {
  const url =
    `${jiraBaseUrl}/plugins/servlet/aio-tcms/bridge/tcms/browse` +
    `?page=run-details-attachment` +
    `&attachmentId=${attachment.id}` +
    `&cycleId=${attachment.cycleId}` +
    `&projectId=${attachment.projectId}`;

  const response = await apiFetch('jira', url, {
    headers: { Authorization: `Bearer ${token}` },
  }, 'AIO Attachment');

  if (!response.ok) throw new Error(`Failed to fetch attachment: ${response.status}`);

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
```

The resulting object URL can be passed directly to the existing `Lightbox` component.

### apiFetch Source Parameter Note

`apiFetch` currently only accepts `'jira' | 'gitlab'` as the source. AIO calls go to the Jira
instance (same base URL, same PAT), so use `'jira'` as the source. No change to apiFetch needed.

### Non-Image Attachments

For non-image attachments (PDFs, text files, zip archives), the lightbox cannot render them.
Fall back to triggering a download: write the blob to a temp file via `@tauri-apps/plugin-fs`
and open it with `shell.open()` (Tauri's `tauri-plugin-shell`). The lightbox should only be
invoked for image MIME types (`image/*`).

---

## AIO on Issue Detail

**Confidence: MEDIUM** — This is how the AIO plugin renders the test run panel in the Jira web
issue view, inferred from AIO's public documentation and Jira plugin architecture conventions.

### How the AIO Panel Appears in Jira

AIO does NOT store test run data as a Jira custom field on the issue. It stores data in its own
plugin data schema. The "AIO Tests" panel that appears on a Jira issue view is rendered by the
AIO plugin's web panel module — it makes a separate API call to AIO's REST API when the issue
page loads.

From a Taskflow integration perspective, this means:
- The standard Jira `/rest/api/2/issue/{key}` response does NOT contain AIO test run data.
- A separate AIO API call is needed when rendering an issue detail page.
- This call is additive — it enriches the issue detail, it does not replace the Jira issue data.

### Endpoint for Test Runs on an Issue

The most reliable endpoint pattern (MEDIUM confidence):

```
GET {jiraBaseUrl}/rest/aio-tcms/1.0/testrun/forIssue?issueKey={issueKey}
```

Alternative patterns seen in some versions:
```
GET {jiraBaseUrl}/rest/aio-tcms/1.0/project/{projectKey}/testrun?issueKey={issueKey}
GET {jiraBaseUrl}/rest/aio-tcms/1.0/issue/{issueKey}/testruns
```

**Recommendation:** Probe all three paths on the live instance during Phase 1 implementation.
The response in any case is an array (or envelope containing an array) of test run summaries
associated with the given issue key.

### What the Test Run Table on Issue Detail Should Show

Each row in the test run table corresponds to one test run associated with the issue. Display:

| Column | Source Field | Notes |
|--------|-------------|-------|
| Cycle name | `run.cycleName` or joined from cycle lookup | Shows which cycle this run belongs to |
| Test case key | `run.caseKey` | e.g. TC-42 |
| Test case title | `run.caseTitle` or `run.caseName` | |
| Status | `run.status` | Colored badge matching execution status colors |
| Executed by | `run.executedBy.displayName` | |
| Executed on | `run.executedOn` | Formatted date |
| Defects | `run.defects[]` | Count badge; click to open issue |

Clicking a row should expand step executions inline (step, expected, actual result, per-step status).

### Association Mechanism

AIO links test runs to Jira issues in two ways:
1. **Defect link** — a test run is explicitly linked to a Jira issue as a defect when the tester
   files a bug during execution.
2. **Story/requirement link** — a test case can be associated with a Jira story/requirement, so
   all runs of that case appear on the issue.

The `forIssue` endpoint returns runs from both association types. The response likely includes
a field indicating the association type.

### Integration with Existing IssueDetailPage

The AIO test run table should be added as a new section/tab in the existing `IssueDetailPage`
(or `IssueDetailContent` component). It should:
- Only render if `aioEnabled` (a new settings toggle — not all teams use AIO).
- Load lazily via a separate `useQuery` call (not blocking the main issue data load).
- Show a skeleton while loading, gracefully hide the section if the AIO API call returns 404
  or 403 (issue has no associated test runs, or AIO not installed).
- Follow the same `isLoading` → skeleton, `isError` → nothing (silent) pattern as other
  enrichment data (MR links, time tracking).

---

## Feature Dependencies

```
AIO Project List (sidebar section entry point)
  └── requires: AIO settings toggle + credentials (same Jira PAT)
  └── enables: Project Overview page

Project Overview (cycles list)
  └── requires: Project List (project selection)
  └── enables: Cycle Detail page, Cycle pinning

Cycle Detail (progress + run table)
  └── requires: Project Overview (cycle selection)
  └── requires: Test Run list endpoint
  └── enables: Run detail expand, Attachment preview, Defect deep-link

Test Run Step Expand
  └── requires: Cycle Detail table (run selection)
  └── requires: Step executions endpoint or run detail endpoint

AIO Attachment Preview
  └── requires: Bridge URL fetch pattern
  └── requires: Existing lightbox component (already built)
  └── requires: apiFetch('jira', bridgeUrl, ...) pattern

AIO on Issue Detail
  └── requires: forIssue endpoint
  └── requires: AIO settings toggle (should not appear if AIO not enabled)
  └── independent of: Sidebar AIO section (different entry point, same service layer)

Cycle Pin to Header Tabs
  └── requires: Cycle Detail page (something to pin)
  └── requires: Existing pinned tabs mechanism (LazyStore persistence, already built)
```

---

## AIO Settings Toggle

AIO is an optional plugin — not all Jira instances have it installed. The integration requires a
new settings entry:

- **"AIO Test Management" toggle** in Settings → Connections section (or a new "Testing" section).
- When disabled: AIO sidebar section hidden, issue detail AIO panel hidden, no AIO API calls fired.
- When enabled: AIO base URL derived from the existing `jiraBaseUrl` (no separate URL needed).
- **Validation:** On toggle-enable, fire a probe request to `/rest/aio-tcms/1.0/project/list` and
  confirm it returns HTTP 200. If 404, show an inline error: "AIO Test Management plugin not found
  on this Jira instance."
- No new credential storage needed — the existing Jira PAT handles AIO auth.

---

## MVP Scope for v1.8

### Build (table stakes for the milestone)

1. **AIO sidebar section** — project list → project overview (cycles) → cycle detail
   (progress bar, run table with status badges, defect count)
2. **Cycle pin to header tabs** — same LazyStore mechanism as pinned Jira issues
3. **AIO test run table on issue detail** — forIssue endpoint, step expand, status badges
4. **AIO attachment handling** — bridge URL fetch → blob URL → existing lightbox (images only)

### Defer

- Burndown chart data — requires daily snapshot data that AIO does not expose via REST
  (AIO's burndown is calculated in the plugin UI, not returned raw by the API). Per PROJECT.md,
  "Historical analytics / burndown charts" is explicitly Out of Scope.
- Test case creation/editing — read-only integration scope for v1.8
- Execution status updates (writing back to AIO) — out of scope; PAT permissions may not allow
  writes depending on team's configuration
- Multi-cycle aggregation / cross-cycle reporting — out of scope

---

## API Response Shape Verification Checklist

Before writing any TypeScript service functions, verify these against the live AIO instance:

- [ ] Confirm base path: `/rest/aio-tcms/1.0/` responds vs an alternative like `/rest/aio/1.0/`
- [ ] Confirm project list envelope key: `projects` vs `values` vs top-level array
- [ ] Confirm cycle list envelope key: `testCycles` vs `cycles` vs `values`
- [ ] Confirm test run list envelope key: `testRuns` vs `runs` vs `values`
- [ ] Confirm execution status format: string key (`"PASS"`) vs status object (`{id, name, color}`)
- [ ] Confirm `forIssue` endpoint path (probe all three variants listed above)
- [ ] Confirm bridge URL query params for attachments (especially whether `projectId` is numeric ID or key)
- [ ] Confirm pagination: `startAt`/`maxResults`/`total` vs cursor-based vs page-number-based

---

## Sources

All findings are from training knowledge (knowledge cutoff: August 2025). External lookup was not
available during this session. Confidence levels reflect how well-established each pattern is in
publicly available AIO TCMS documentation and community integrations.

- AIO Tests for Jira (Atlassian Marketplace) — plugin documentation, training knowledge (MEDIUM)
- AIO TCMS REST API documentation pattern — consistent with Jira plugin REST API conventions (MEDIUM)
- AIO bridge URL pattern — observed in community integrations and AIO plugin internals (MEDIUM)
- Execution status set — canonical AIO default statuses, consistent across all known versions (HIGH)
- Taskflow codebase inspection (v1.8 start) — `apiFetch`, `attachments.ts`, `client.ts`, `types.ts` (HIGH)

---
*Feature research for: Taskflow v1.8 AIO Test Management Integration*
*Researched: 2026-05-12*
*Confidence: MEDIUM — requires live instance verification before service function implementation*
