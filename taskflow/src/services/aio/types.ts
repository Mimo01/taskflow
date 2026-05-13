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
  id: number;           // AIO internal project ID
  projectKey: string;   // Jira project key (e.g. "PROJ")
  name: string;         // Project display name
}

/**
 * A single AIO test cycle (test plan).
 * Returned via AioPage<AioCycle> from GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle
 * Key format: {PROJ}-CY-N (D-17 probe confirmed)
 */
export interface AioCycle {
  key: string;          // Cycle key, e.g. "PROJ-CY-2"
  name: string;         // Cycle display name
  status: string;       // Cycle status, e.g. "Active", "Closed"
  projectKey: string;   // Owning Jira project key
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
  id: string;           // Test run ID
  status: string;       // Run status: "PASS" | "FAIL" | "NOT_EXECUTED" | "BLOCKED"
  testCaseKey: string;  // Associated test case key, e.g. "PROJ-TC-5"
  cycleKey: string;     // Owning cycle key, e.g. "PROJ-CY-2"
  testCase?: {          // Nested object — verify field names against live endpoint (D-10)
    title: string;      // Test case display name for run list
    updatedDate?: string; // ISO date fallback if executedDate absent
  };
  defects?: string[];   // Jira issue keys inline, e.g. ["PROJ-42"] (D-14 confirmed)
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
