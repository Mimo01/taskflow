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
