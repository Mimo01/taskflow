# Phase 54: Live Probe Findings
Probed: 2026-05-13

## Probe A — testcase issueKey query param

CONFIRMED: **no server-side filter by Jira issue key/ID exists on this instance**

All tested query params (`issueKey`, `jiraIssueKey`, `jiraRequirementId`, `jiraRequirementIds`,
`requirementId`, `jiraTaskId`, `jiraIssueId`) are silently ignored — the full unfiltered list
is returned regardless. Verified by comparing filtered vs unfiltered at `startAt=9000`: identical
pagination state.

CONFIRMED: Jira issue link field in testcase = `jiraRequirementIDs` (array of string Jira issue IDs, e.g. `['186227']`)
CONFIRMED: testcase title field = `title`
CONFIRMED: testcase key field = `key`
CONFIRMED: response shape = `AioPage<T>` — `{items, startAt, maxResults, isLast}` (no `totalCount`)

**Implication for service code:** Must fetch all test cases for a project (paginated) and filter
client-side by matching `tc.jiraRequirementIDs.includes(String(jiraIssueNumericId))`.
Requires resolving the Jira issue key → numeric ID first via `/rest/api/2/issue/{issueKey}?fields=id`.

## Probe B — run detail step field names

CONFIRMED: run detail endpoint = `GET /project/{projectKey}/testcycle/{cycleKey}/testrun/{runId}`
CONFIRMED: steps path in response = `testRunSteps[]` (top-level field; empty array when `assignSteps=false`)
CONFIRMED: step action field = `step`
CONFIRMED: expected result field = `expectedResult`
CONFIRMED: actual result field = `actualResult` (field absent entirely when not filled in, present as string when it is)
CONFIRMED: test data field = `testData`
CONFIRMED: step status field = `testRunStepStatus` (object `{ID, name, description}`) — same pattern as `testRunStatus` on the run itself
CONFIRMED: step type field = `testStepType` (e.g. `"TEXT"`)
CONFIRMED: step-level Jira defects = `jiraDefectIDs` (array)
CONFIRMED: attachment URL field = **N/A — no attachment fields observed across 26 Failed/Blocked runs**

No `attachments` or `attachment` key appeared in any `testRunSteps[]` item across all checked
cycles (ESHOP-CY-4, CY-6, CY-9, CY-10, CY-11, CY-12, CY-13). This instance's testers do not use
step-level attachments. Attachment shape remains unknown — do not implement attachment rendering in Phase 54.

Complete union of all observed `testRunSteps[i]` keys:
```
ID, stepID, stepOrder, testStepType, step, expectedResult, actualResult,
testData, testRunStepStatus, jiraDefectIDs
```

## Probe C — 54-06 Direct Run Lookup
Probed: 2026-05-13

### C1 — traceability item run linkage
CONFIRMED: traceability item includes direct run reference = **yes — field name: `testRun` (and `latestTestRun`), shape: `{ID, testRunStatusID, testRunDefects[], testRunAttachments[], testRunComments[], allDefects[], executedByID, createdDate, updatedDate, ...}`**

Top-level keys of each traceability defect item:
```
["jiraProjectID", "test", "testCycle", "testRun", "latestTestRun",
 "testRunNumber", "latestTestRunNumber", "associatedById", "associationDate"]
```

`testRun.ID` = 263794 (numeric run ID, usable directly for run-detail fetch).
`testCycle` is also embedded at item top-level with `detail.key` = `"ESHOP-CY-1011"` — enough to form the run-detail URL without any extra cycle lookup.
`latestTestRun.ID` = 263794 (same here; will diverge when a test case has been re-run across cycles).

Requirement traceability (`/traceability/requirement/393120`) returned an empty array — issue 393120 is a defect, not linked as a requirement. Shape confirmed identical to defect items from prior probes.

### C2 — /testrun query-param filtering
CONFIRMED: `/testrun?testCaseKey=` filters server-side = **no — silently ignored**
CONFIRMED: `/testrun?testCaseID=` filters server-side = **no — silently ignored**

Both params return the full unfiltered cycle (48 items, isLast=true) regardless of the value supplied. Identical result to unfiltered call.

### C3 — cross-cycle /testcase/{key}/testrun
CONFIRMED: cross-cycle endpoint exists = **no — all variants HTTP 404**

```
variant 1  GET /project/ESHOP/testcase/ESHOP-TC-8477/testrun  → 404
variant 2  GET /testcase/ESHOP-TC-8477/testrun                → 404
variant 3  GET /project/ESHOP/testcase/68141/testrun          → 404
```

### Decision
Direct lookup available via `GET /aio-tcms/1.0/project/{aioProjectId}/traceability/defect/{jiraIssueId}` (extended extraction of embedded `testRun.ID` + `testCycle.detail.key`). Task 2 wires the direct-lookup branch — **sub-branch A1** (C1 won — extend traceability extraction).

Implementation shape:
1. `GET /aio-tcms/1.0/project/{aioProjectId}/traceability/defect/{jiraIssueId}` → array of items, each containing `testRun.ID` + `testCycle.detail.key` (and `latestTestRun.ID` when re-runs span cycles).
2. For each item: `GET /aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/testrun/{runId}` (already proven in Probe B).

No per-cycle scan needed. Skip BOTH `fetchAioCycles` AND `fetchAioTestRunsForCycle` on the success path. C2/C3 are dead ends; do not implement testCaseKey/testCaseID filter or cross-cycle testcase endpoint.

---

## Probe D — Attachment Download URL
Probed: 2026-05-13

### D1 — bridge URL behaviour
CONFIRMED: bridge URL returns HTML, not image bytes = `HTTP/1.1 200 text/html;charset=UTF-8 3112 bytes`

The bridge servlet (`/plugins/servlet/aio-tcms/bridge/tcms/browse?...`) renders a full Jira HTML page. Using it as `<img src>` will always produce a broken image. It is a browser-navigation URL, not a binary download endpoint.

### D2 — attachment endpoint variants (A–H)
```
A: 404  /rest/aio-tcms-api/1.0/project/ESHOP/testrun/{runId}/attachment/{id}
B: 404  /rest/aio-tcms-api/1.0/project/ESHOP/testrun/{runId}/attachment/{id}/download
C: 200  image/png  148968 bytes  /rest/aio-tcms-api/1.0/project/ESHOP/attachment/{id}   ← WINNER
D: 200  application/json  305 bytes  /rest/aio-tcms/1.0/project/{numericId}/attachment/{id}  (metadata)
E: 404  /rest/aio-tcms-api/1.0/attachment/{id}
F: 404  /rest/aio-tcms-api/1.0/project/ESHOP/testcase/{caseId}/attachment/{id}
G: 404  /rest/aio-tcms-api/1.0/project/ESHOP/testcycle/{cycleId}/testrun/{runId}/attachment/{id}
H: 404  /rest/aio-tcms-api/1.0/project/ESHOP/testcycle/{cycleId}/testrun/{runId}/attachment/{id}/download
```

### D3 — image bytes confirmation
CONFIRMED: `GET /rest/aio-tcms-api/1.0/project/{projectKey}/attachment/{attachmentId}` returns real image binary.

```
/dev/stdin: PNG image data, 1318 x 1993, 8-bit/color RGB, non-interlaced
```

Variant D metadata response (for filename/mimeType lookup if needed):
```json
{
  "ID": 150383,
  "name": "VAS.png",
  "storeName": "c6188d2d-45e0-4f6b-b90b-a08abf95f132",
  "mimeType": "image/png",
  "size": 148968,
  "processedSize": "145.48 KB",
  "ownerId": "ext94772",
  "projectId": 10134
}
```

### Decision
CONFIRMED download URL = `GET /rest/aio-tcms-api/1.0/project/{projectKey}/attachment/{attachmentId}`

Requires `Authorization: Bearer` header → **cannot be used as a bare `<img src>`**. Must proxy through Tauri HTTP client, convert to data URL or blob URL, then set as image src. Variant D (`/rest/aio-tcms/1.0/project/{numericId}/attachment/{id}`) gives metadata (filename, mimeType) if needed before fetching binary — single call to C is sufficient if metadata is not needed separately.

---

## Raw probe output

### B — run detail top-level keys (run ID 12131, ESHOP-CY-2)
```json
["ID","permission","testRunStatus","isAutomated","executedByID","createdDate",
 "updatedDate","jiraDefectIDs","testRunStepsPermission","testRunSteps","dataSetExecutionsCount"]
```

### B — step[0] from run 12131 (assignSteps=true, status=Passed)
```json
{
  "ID": 37989,
  "stepID": 18016,
  "stepOrder": 0,
  "testStepType": "TEXT",
  "step": "Podla zadania Test Name je spisana a odoslana objednavka.",
  "expectedResult": "Submit uspesny - objednavka odoslana.",
  "testRunStepStatus": {
    "ID": 53,
    "name": "Passed",
    "description": "The test step has passed"
  }
}
```

### B — step with actualResult from run 14733 (ESHOP-CY-9, status=Failed)
```
Step keys: ['ID', 'stepID', 'stepOrder', 'testStepType', 'step', 'expectedResult',
            'testRunStepStatus', 'actualResult']
actualResult: "ok"
```

---

## Probe E — 54-07 Nested Wiki Rendering
Probed: 2026-05-13

### Fixture
Verbatim from `54-06-UAT-FINDINGS.md` lines 14-25 (real ESHOP step content from a Failed test run on issue 393120):

```
||*S.No.*||*Step*||*Expected Result*||*Actual Result*||
|1. |Nacitanie eshop home page |Kontrola OK |Works as expected|
|2. |{color:#d04437}*FAILED:*{color} Plati pre paušály S, M, L: \\ • 5 GB (12657037, 5,13 €) |Kontrola OK |V kosiku mam Pro Biznis M a device na splatky...
{panel}
# [VAS.png|https://jira.orange.sk/plugins/servlet/aio-tcms/bridge/tcms/browse?c_pId=10134&page=run-details-attachment&params=%7B%22cycleId%22:14041,%22caseId%22:68141,%22runId%22:263794,%22attachmentId%22:150383,%22projectId%22:10134%7D]
{panel}|
```

### Baseline behaviour (no fix)
Confirmed by scratch probe — the `|2. |...` row terminates at the FIRST `\n` after `splatky...`, so jira2md emits only a 3-cell row. The `{panel}…{panel}` block lands OUTSIDE the table as a sibling `<div data-callout="panel">`, and the trailing `{panel}|` leaves a stray literal `|` after the panel. Observable signature on the verbatim fixture:

- `tablePresent: true`
- `panelPresent: true`
- `panelInsideTable: false`   ← the bug
- `vasLink: false`             ← `[VAS.png|...]` is rendered as a markdown link OUTSIDE the cell, not as a clickable `<a>` inside it
- One stray literal `|` after the panel block

### Branch 3-A — preprocess heuristic
**Outcome: works.**

Heuristic (validated against the verbatim fixture):
1. Scan line-by-line. Detect a "data row" (line starts with `|` and not `||`) that does NOT end with `|` — that row is "open" and continues onto subsequent lines.
2. Greedy-consume subsequent lines (capped at 50 for safety) until we find a line that ends with `|` AND brings any embedded `{panel}` markers back to balance.
3. Inside the joined body, substitute each `{panel}…{panel}` (and `{info}`, `{warning}`, `{note}`) to an inline `<span data-callout="…">…</span>` with internal `\n` flattened to `<br/>`. This keeps the body on one logical line for jira2md / remark-gfm.
4. Replace any remaining `\n` inside the merged row with a single space so jira2md sees one source line.

After 3-A on the verbatim fixture:
- `tablePresent: true`
- `panelPresent: true`
- `panelInsideTable: true`   ← fixed
- `vasLink: true`             ← `<a href="...">VAS.png</a>` is rendered INSIDE the table cell

The Branch 3-A approach uses `<span data-callout="panel">` instead of the existing `<div data-callout="panel">` so the panel renders inline inside the table cell (block `<div>` inside `<td>` works in HTML but would break flow visually). The existing `markdownComponents.div` callout renderer needs a sibling `span` override with the same `calloutStyles` map.

Diff sketch for `preprocessJiraMarkup`:
```ts
// Before the existing global {panel} substitution, do a row-aware merge:
let result = mergeOpenTableRows(wiki);   // new helper, ~40 LOC
// THEN run the existing {panel}/{info}/... substitutions on the rest of the text.
```

### Branch 3-B — custom td renderer
**Outcome: not attempted (Branch 3-A succeeded).**

A `td` override in `markdownComponents` would receive parsed HAST/MDAST children, not the raw cell source, so reconstructing the panel content from React children would either require a custom remark plugin that attaches `node.raw` to table cells (non-trivial, fragile) or best-effort string reconstruction (also fragile). Branch 3-A's preprocess approach is cheaper and more deterministic.

### Branch 3-C — swap to proper wiki parser
**Outcome: not evaluated (Branch 3-A succeeded).**

Reserve for future work if the preprocess heuristic accumulates edge cases. Candidate packages: `jira-wiki-markup` (npm), `marsdown-jira-wiki`. Blast radius: every WikiRenderer caller (issue descriptions, comments, MR descriptions, AIO step content). Not justified now.

### T-54-07-01 (XSS) finding
While probing 3-A I also ran a `<script>alert(1)</script>` payload through the EXISTING WikiRenderer (no Branch 3-A applied) — it renders as a REAL DOM `<script>` element in the article, NOT as literal text. This is a pre-existing rehypeRaw posture, not introduced by Branch 3-A (the 3-A output for the same fixture produces identical HTML). The Plan 54-07 T-54-07-01 mitigation therefore requires:

1. Branch 3-A regex MUST NOT add new HTML attribute-injection vectors. Validated: 3-A only emits `<span data-callout="panel">…</span>` and `<br/>` — the `data-callout` value is a hard-coded string, and the inner content is interpolated literally (no `href`/`src` attribute interpolation from user data).
2. The Task 2 implementation MUST add `rehypeSanitize` to the WikiRenderer pipeline (after `rehypeRaw`) with a schema that allows `data-callout` / `mention` / `img` / `a` (existing app surface) but blocks `<script>` / `<iframe>` / event-handler attributes. Without this, the T-54-07-01 XSS guard test (`<script>` renders as literal text) cannot pass even when run against unchanged baseline code.

### Decision: Branch 3-A selected — preprocess heuristic merges multi-line `|cell|` rows + flattens embedded `{panel}` to inline `<span data-callout="panel">` so jira2md sees one logical row; lowest blast radius (no new deps, isolated to `preprocessJiraMarkup`); validated against the verbatim ESHOP fixture (panel + image-link list render inside the table cell).

