/**
 * AIO TCMS test case and step operations scoped to a Jira issue key.
 *
 * Two functions:
 *   fetchAioTestCasesForIssue — fetches all AIO test cases for a project and returns those
 *     linked to the given Jira issue key. NOTE: No server-side filter exists for issueKey
 *     on this AIO instance (Phase 54 probe finding A — all query params silently ignored).
 *     Client-side filter: tc.jiraRequirementIDs.includes(String(jiraIssueNumericId)).
 *     The function accepts issueKey for API symmetry; caller must pass Jira issue numeric ID
 *     via the returned raw jiraRequirementIDs field if needed, but this function returns all
 *     test cases and leaves filtering to the consumer.
 *   fetchAioTestRunSteps — fetches step-level data for a single test run by fetching
 *     the run detail endpoint and extracting testRunSteps[]. Field names confirmed by
 *     Phase 54 probe finding B.
 */

import { ApiError } from '../../lib/api-error';
import { aioFetch } from './client';
import type { AioPage, AioTestCase, AioTestRunStep } from './types';

// Raw API shape for a test case before normalization — all fields optional (defensive)
type RawTestCase = {
  id?: number;
  key?: string;
  title?: string;
  name?: string;
  projectKey?: string;
  jiraRequirementIDs?: string[];
};

function normalizeTestCase(raw: RawTestCase): AioTestCase {
  return {
    id: raw.id ?? 0,
    key: raw.key ?? '',
    title: raw.title ?? raw.name ?? '', // defensive: probe confirmed 'title', 'name' as fallback
    projectKey: raw.projectKey,
    jiraRequirementIDs: raw.jiraRequirementIDs,
  };
}

// Raw API shape for a test run step before normalization — all fields optional (defensive)
// Field names confirmed by Phase 54 probe finding B.
// NOTE: 'step' is the confirmed field name for action text (was assumed: 'stepAction' in PATTERNS.md)
// NOTE: status is a nested object {ID, name, description} — only .name is used after normalization
type RawStep = {
  ID?: number;
  stepID?: number;
  stepOrder?: number;
  testStepType?: string;
  step?: string;           // confirmed action text field name (Phase 54 probe)
  expectedResult?: string; // confirmed expected result field name (Phase 54 probe)
  actualResult?: string;   // confirmed actual result field name; absent when not filled in (Phase 54 probe)
  testData?: string;
  testRunStepStatus?: {    // confirmed step status object (Phase 54 probe)
    ID?: number;
    name?: string;
    description?: string;
  };
  jiraDefectIDs?: number[];
};

function toStepStatus(raw: RawStep['testRunStepStatus']): string {
  switch ((raw?.name ?? '').toLowerCase()) {
    case 'pass':
    case 'passed':
      return 'PASS';
    case 'fail':
    case 'failed':
      return 'FAIL';
    case 'blocked':
      return 'BLOCKED';
    default:
      return 'NOT_EXECUTED';
  }
}

function normalizeStep(raw: RawStep): AioTestRunStep {
  return {
    id: raw.ID ?? raw.stepID ?? 0,
    step: raw.step ?? '',
    expectedResult: raw.expectedResult,
    actualResult: raw.actualResult,
    status: toStepStatus(raw.testRunStepStatus),
  };
}

/**
 * Fetch all test cases for a project. Test cases linked to a specific Jira issue can be
 * identified by filtering the result on jiraRequirementIDs, but this function returns all
 * test cases — no server-side issueKey filter exists on this AIO instance (Phase 54 probe A).
 *
 * Pagination: AioPage<T> wrapper (confirmed by Phase 54 probe A).
 *
 * @param baseUrl    - Jira/AIO base URL (same host as Jira)
 * @param token      - Personal Access Token (from Stronghold key 'jira-pat')
 * @param projectKey - Jira project key (e.g. "PROJ")
 * @param issueKey   - Jira issue key (e.g. "PROJ-123") — included for API symmetry;
 *                     server ignores query params silently (Phase 54 probe A)
 * @returns Array of AioTestCase objects; empty array if project has no test cases (404)
 * @throws ApiError with status 401 on authentication failure
 * @throws Error on network failure
 */
export async function fetchAioTestCasesForIssue(
  baseUrl: string,
  token: string,
  projectKey: string,
  issueKey: string,
): Promise<AioTestCase[]> {
  const basePath = `/project/${encodeURIComponent(projectKey)}/testcase`;
  const allCases: AioTestCase[] = [];
  let startAt = 0;

  // issueKey param included even though server ignores it (Phase 54 probe A confirmed
  // all query params are silently ignored — client-side filtering required by caller)
  void issueKey;

  for (;;) {
    const path = `${basePath}?startAt=${startAt}`;
    let response: Response;
    try {
      response = await aioFetch(baseUrl, token, path);
    } catch {
      throw new Error(`Cannot reach AIO at ${baseUrl}`);
    }
    if (response.ok) {
      const data = (await response.json()) as AioPage<RawTestCase> | RawTestCase[];
      // Guard: same array-vs-page guard as issue-runs.ts (D-17 confirms AioPage wrapper,
      // but guard for direct array in case of API variation)
      if (Array.isArray(data)) {
        return data.map(normalizeTestCase);
      }
      allCases.push(...(data.items ?? []).map(normalizeTestCase));
      if (data.isLast) return allCases;
      startAt += data.maxResults;
      continue;
    }
    if (response.status === 401) {
      throw new ApiError('Invalid token or token has expired', 401, 'jira');
    }
    if (response.status === 404) {
      return []; // project not found or no test cases
    }
    throw new Error(`AIO request failed with status ${response.status}`);
  }
}

/**
 * Fetch step-level data for a single test run.
 *
 * Endpoint: GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/testrun/{runId}
 * Steps are at top-level field testRunSteps[] (confirmed by Phase 54 probe B).
 *
 * @param baseUrl    - Jira/AIO base URL (same host as Jira)
 * @param token      - Personal Access Token (from Stronghold key 'jira-pat')
 * @param projectKey - Jira project key (e.g. "PROJ")
 * @param cycleKey   - AIO cycle key (e.g. "PROJ-CY-2")
 * @param runId      - Test run ID (string form of numeric run ID)
 * @returns Array of AioTestRunStep objects; empty array if run not found (404)
 * @throws ApiError with status 401 on authentication failure
 * @throws Error on network failure
 */
export async function fetchAioTestRunSteps(
  baseUrl: string,
  token: string,
  projectKey: string,
  cycleKey: string,
  runId: string,
): Promise<AioTestRunStep[]> {
  // assignSteps=true required — without it testRunSteps[] is always empty (probe finding B)
  const path = `/project/${encodeURIComponent(projectKey)}/testcycle/${encodeURIComponent(cycleKey)}/testrun/${encodeURIComponent(runId)}?assignSteps=true`;
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path);
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    const data = (await response.json()) as { testRunSteps?: RawStep[] } | RawStep[];
    // Guard: direct array fallback (probe confirmed top-level testRunSteps[] field)
    if (Array.isArray(data)) return data.map(normalizeStep);
    // Phase 54 probe B confirmed: steps are at data.testRunSteps[] (not data.steps[])
    return ((data as { testRunSteps?: RawStep[] }).testRunSteps ?? []).map(normalizeStep);
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    return []; // run not found
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}
