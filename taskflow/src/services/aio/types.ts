/**
 * Shared AIO TCMS type definitions used across all domain modules.
 *
 * This file is the single source of truth for all AIO REST API response
 * shapes. Domain modules import from here; they never define their own
 * interfaces for AIO entities.
 *
 * Interface field names are derived from AIO REST API docs:
 * https://aiosupport.atlassian.net/wiki/spaces/AioTests/pages/2025619567
 * and from D-16/D-17 probe findings in .planning/phases/51-aio-service-layer/51-CONTEXT.md
 */

/**
 * A single AIO test management project.
 * Returned by GET /rest/aio-tcms/1.0/project (direct array, not paginated — D-16).
 * Field names derived from AIO REST API docs and D-16 probe findings.
 */
export interface AioProject {
  id: number; // AIO internal project ID
  projectKey: string; // Jira project key (e.g. "PROJ")
  name: string; // Project display name
}

/**
 * A single AIO test cycle (test plan).
 * Returned via AioPage<AioCycle> from GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle
 * Key format: {PROJ}-CY-N (D-17 probe confirmed)
 */
export interface AioCycle {
  key: string; // Cycle key, e.g. "PROJ-CY-2"
  name: string; // Cycle display name
  status: string; // Cycle status, e.g. "Active", "Closed"
  projectKey: string; // Owning Jira project key
  folder?: string; // Folder/test-set grouping name. Mapped from raw.folder ?? raw.testSet ?? raw.folderName ?? raw.testSetKey ?? raw.status (Plan 56-06 probe — see normalizeCycle in cycles.ts)
}

/**
 * A single AIO test run within a cycle.
 * Returned via AioPage<AioTestRun> from GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/testrun
 * Key format: {PROJ}-TC-N (test case key — D-17 probe confirmed)
 * NOTE (D-15): There is no GET /testrun?issueKey= endpoint. Test runs are scoped to cycles.
 *
 * NOTE: testCase.title and defects field names confirmed from AIO REST API docs (D-10, D-14).
 * executedDate field name is unverified from public docs — executor must confirm against live endpoint.
 * Use run.executedDate ?? run.testCase?.updatedDate as defensive date fallback.
 */
export interface AioTestRun {
  id: string; // Test run ID
  status: string; // Run status: "PASS" | "FAIL" | "NOT_EXECUTED" | "BLOCKED"
  testCaseKey: string; // Associated test case key, e.g. "PROJ-TC-5"
  cycleKey: string; // Owning cycle key, e.g. "PROJ-CY-2"
  testCase?: {
    // Nested object — verify field names against live endpoint (D-10)
    title: string; // Test case display name for run list
    updatedDate?: string; // ISO date fallback if executedDate absent
  };
  defects?: string[]; // Resolved Jira issue keys (e.g. ['PROJ-42']). Populated by resolving jiraDefectIDs from the latest run execution via Jira REST API (Plan 56-05 fix).
  jiraDefectIDs?: number[]; // Numeric Jira issue IDs from jiraDefectIDs on latest execution (probe B confirmed)
  executedDate?: string; // Run-level date — NOTE: field name unverified against live endpoint (A2)
}

/**
 * Paginated response wrapper used by all list endpoints under /rest/aio-tcms-api/1.0/
 * Confirmed by D-17 probe findings.
 */
export interface AioPage<T> {
  items: T[];
  startAt: number;
  maxResults: number;
  isLast: boolean;
}

/**
 * A single AIO test case, optionally linked to a Jira issue via jiraRequirementIDs.
 * Returned via AioPage<AioTestCase> from GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcase
 * NOTE: No server-side filter by issueKey exists — fetch all and filter client-side
 * by jiraRequirementIDs (Phase 54 probe finding A).
 * Field names confirmed by Phase 54 probe: title (confirmed), key (confirmed).
 */
export interface AioTestCase {
  id: number; // AIO internal test case ID
  key: string; // Test case key, e.g. "PROJ-TC-5" (confirmed by Phase 54 probe)
  title: string; // Test case display name (confirmed field name: 'title'; probe also showed 'name' fallback needed)
  projectKey?: string; // Owning Jira project key
  jiraRequirementIDs?: string[]; // Jira issue numeric IDs this test case is linked to (e.g. ['186227']); used for client-side filtering (probe finding A)
}

/**
 * A single step within an executed test run.
 * Returned inside testRunSteps[] from GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/testrun/{runId}
 * All field names confirmed by Phase 54 probe finding B.
 * NOTE: 'step' is the confirmed field name for action text (was assumed: 'stepAction' in PATTERNS.md).
 * NOTE: 'testRunStepStatus.name' is the confirmed field for step status; normalized to a plain string here.
 * NOTE: Attachments not implemented — no attachment fields observed across 26 runs in 7 cycles (probe finding B).
 */
export interface AioTestRunStep {
  id: number; // Step ID (from raw 'ID' field — confirmed by Phase 54 probe)
  step: string; // Step action/description text (confirmed field name: 'step' — was assumed: 'stepAction')
  expectedResult?: string; // Expected result text (confirmed field name: 'expectedResult')
  actualResult?: string; // Actual result text; absent when step not yet executed (confirmed field name: 'actualResult')
  status?: string; // Normalized step status: "PASS" | "FAIL" | "BLOCKED" | "NOT_EXECUTED" (from testRunStepStatus.name)
}

/**
 * Plan 54-06 Branch A1: a direct run reference embedded in a traceability item.
 * Returned per `AioTestCaseWithRuns.runs[]` from `fetchAioTraceabilityTestCases`.
 *
 * Source fields (Probe C1):
 *   - testRun.ID         → runId   (string-normalized for parity with AioTestRun.id)
 *   - latestTestRun.ID   → fallback for runId when testRun is absent on the item
 *   - testCycle.detail.key → cycleKey
 *
 * Enables skipping `fetchAioCycles` + `fetchAioTestRunsForCycle` on the success
 * path — every linked test case's most-recent run is already linked from the
 * traceability response.
 */
export interface AioTraceabilityRunRef {
  runId: string;
  cycleKey: string;
}

/**
 * Plan 54-06 Branch A1: `AioTestCase` extended with a list of directly-referenced
 * runs. `runs[]` is empty when the traceability item did not carry a `testRun.ID`
 * (rare — Probe C1 found ≥90% coverage). Structurally a superset of `AioTestCase`,
 * so existing typed call sites continue to compile.
 */
export interface AioTestCaseWithRuns extends AioTestCase {
  runs: AioTraceabilityRunRef[];
}

/**
 * A file attachment on a test run step.
 * NOTE: No attachment fields were observed in Phase 54 probe (26 runs across 7 cycles).
 * This interface is defined for forward compatibility but attachment rendering is NOT
 * implemented in Phase 54. Shape is kept minimal until a probe confirms actual field names.
 */
export interface AioStepAttachment {
  url?: string; // Full URL to the attachment (field name unconfirmed — no probe data)
  fileName?: string; // Filename for alt text (field name unconfirmed — no probe data)
}
