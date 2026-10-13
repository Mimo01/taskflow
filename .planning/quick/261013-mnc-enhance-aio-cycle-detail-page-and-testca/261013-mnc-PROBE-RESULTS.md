# 261013-mnc Live Probe Results (2026-10-13, ESHOP / ESHOP-CY-1011, run by user via probe.sh)

These are LIVE-CONFIRMED. They supersede UNVERIFIED markers in 261013-mnc-RESEARCH.md.

## P1 — GET cycle /detail
CONFIRMED: ID, key, title, ownedByID ("ext94772"), startDate, endDate, createdDate, updatedDate,
closedDate, closedByID, isClosed, folder{ID,name,parentID}, jiraProjectID, jiraReleaseID,
jiraReleaseIDs[], jiraTaskIDs[] (strings), customFields[]{ID,name,value}, permission.value.
- customFields[].value is POLYMORPHIC: either an object {ID, value:"Web"} OR an array [{ID, value:"Chrome"}]; may also be empty.
- Present but empty: jiraComponentIDs, tags.
- NOT present: objective, description, isArchived (not seen), status name (cycle status → derive from isClosed if needed).
- Dates are epoch ms numbers.

## P2 — POST testcasewithrun/paged (app's body)
CONFIRMED per item: ID, assignedToID, assignmentDate, runCount, rankOrder, currentTestVersionID,
latestTestRun{ID, createdDate, updatedDate, executedByID, testRunStatusID, allDefects[] (numeric), jiraProjectID},
test{ID, detail{key, title, ownedByID, testStatusID, userVersionNumber}}.
- NO executedDate field anywhere → use latestTestRun.updatedDate as "last executed/updated" date.
- test.detail priority/type/description/precondition are present-but-EMPTY with the app's `columns`. With extra columns (P2b) the keys appear but values were not printed — treat as unverified; do NOT rely on them.
- Items without latestTestRun in this cycle: 0 (still guard empty run id defensively).
- additionalData.totalDSCount and total present.

## P3 — GET run detail ?assignSteps=true
CONFIRMED: ID, createdDate, updatedDate, executedByID, jiraDefectIDs[], testRunStatus{ID,name,description},
testRunSteps[]{ID, stepID, stepOrder, step, expectedResult, actualResult, jiraDefectIDs[], testStepType, testRunStepStatus{ID,name,description}}.
- No testCase/title in the run detail (confirms research).
- No step testData seen in this sample.

## P4 — GET /project/{pk}/testcase/{tcKey}/detail → 200 (WORKS)
CONFIRMED: ID, key, title, description, ownedByID, createdDate, folder{ID,name,parentID},
status{ID,name,description} (e.g. "Published"), type{ID,name} (e.g. "System Test"),
scriptType{name}, customFields[]{ID,name,value{ID,value}}, steps[]{ID,step,expectedResult,stepType}, version, versions[].
- No precondition / priority fields present.
→ Run detail page can fetch this for the test case title/description/type/folder/custom fields on deep link.

## P5 — POST summary/paged
Only testRunDistribution + totalTests. No effort/assignee data — do not surface.
