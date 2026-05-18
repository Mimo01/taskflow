/**
 * AIO TCMS project listing and traceability operations.
 *
 * Fetches all AIO projects visible to the authenticated user.
 * Projects are returned as a direct array (not paginated) from the
 * /rest/aio-tcms/1.0/ servlet — confirmed by D-16 probe findings.
 *
 * Also provides fetchAioTraceabilityTestCases which calls the traceability
 * plugin API (/rest/aio-tcms/1.0/project/{aioProjectId}/traceability/{type}/{jiraIssueId})
 * confirmed by browser network tab inspection (Phase 54 UAT probe).
 */

import { ApiError } from '../../lib/api-error';
import { AIO_PROJECTS_API_PATH, aioFetch } from './client';
import type { AioProject, AioTestCase, AioTestCaseWithRuns, AioTraceabilityRunRef } from './types';

// Raw shape of each item returned by the traceability endpoint.
// Widened by Plan 54-06 Probe C1 / Task 2 sub-branch A1:
// - testRun: most recent execution (current run reference)
// - latestTestRun: latest execution across cycles (may differ from testRun on re-runs)
// - testCycle.detail.key: cycle key needed to form the run-detail URL
// Field names confirmed verbatim by Probe C1 (see 54-PROBE-FINDINGS.md ## Probe C section).
type RawTraceabilityItem = {
  test?: {
    ID?: number;
    detail?: {
      key?: string;
      title?: string;
      name?: string;
    };
  };
  testRun?: {
    ID?: number;
  };
  latestTestRun?: {
    ID?: number;
  };
  testCycle?: {
    detail?: {
      key?: string;
    };
  };
};

/**
 * Fetch test cases linked to a Jira issue via AIO's traceability plugin API.
 *
 * Endpoint: GET /rest/aio-tcms/1.0/project/{aioProjectId}/traceability/{type}/{jiraIssueNumericId}
 * type='defect'      → "Impacted Executions" in AIO Jira panel
 * type='requirement' → "Cases" in AIO Jira panel
 *
 * Returns empty array on null response (issue has no linked test cases of this type),
 * 404, or network failure. Both types are typically called in parallel and combined.
 */
export async function fetchAioTraceabilityTestCases(
  baseUrl: string,
  token: string,
  aioProjectId: number,
  jiraIssueNumericId: number,
  type: 'defect' | 'requirement',
): Promise<AioTestCaseWithRuns[]> {
  const path = `/project/${aioProjectId}/traceability/${type}/${jiraIssueNumericId}`;
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path, 'Load AIO Projects', AIO_PROJECTS_API_PATH);
  } catch {
    return [];
  }
  if (!response.ok) return [];
  const raw = (await response.json()) as RawTraceabilityItem[] | null;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item.test?.detail?.key)
    .map((item) => {
      // Plan 54-06 sub-branch A1: extract embedded run reference + cycle key
      // so consumers can skip the full cycle scan. testRun is the current
      // execution; latestTestRun is the most recent across cycles (used as
      // fallback if testRun is absent on this item).
      const runId = item.testRun?.ID ?? item.latestTestRun?.ID;
      const cycleKey = item.testCycle?.detail?.key;
      const runs: AioTraceabilityRunRef[] =
        runId !== undefined && cycleKey !== undefined ? [{ runId: String(runId), cycleKey }] : [];
      return {
        id: item.test?.ID ?? 0,
        key: item.test!.detail!.key!,
        title: item.test?.detail?.title ?? item.test?.detail?.name ?? '',
        runs,
      };
    });
}

/**
 * Re-export: when the test case linkage (without runs) is needed, callers can
 * accept the same shape as before — `AioTestCaseWithRuns` is a superset of
 * `AioTestCase` (adds the optional `runs` field). Existing call sites that
 * type-annotate against `AioTestCase` continue to work via structural typing.
 */
export type { AioTestCase };

/**
 * Fetch all AIO test management projects.
 *
 * Uses the AIO_PROJECTS_API_PATH servlet (/rest/aio-tcms/1.0) — this is the only
 * endpoint that lives under this path. All other AIO endpoints use AIO_API_PATH.
 *
 * @param baseUrl - Jira/AIO base URL (same host as Jira)
 * @param token   - Personal Access Token (from Stronghold key 'jira-pat')
 * @returns Array of AioProject objects; empty array if AIO is not installed (404)
 * @throws ApiError with status 401 on authentication failure
 * @throws Error on network failure
 */
export async function fetchAioProjects(baseUrl: string, token: string): Promise<AioProject[]> {
  let response: Response;
  try {
    response = await aioFetch(
      baseUrl,
      token,
      '/project',
      'Load AIO Projects',
      AIO_PROJECTS_API_PATH,
    );
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    const raw = (await response.json()) as Array<{ ID: number; jiraProjectKey: string }>;
    return raw.map((item) => ({
      id: item.ID,
      projectKey: item.jiraProjectKey,
      name: item.jiraProjectKey,
    }));
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    return []; // AIO not installed or wrong base path
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}
