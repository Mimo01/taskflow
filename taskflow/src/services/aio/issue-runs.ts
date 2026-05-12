/**
 * AIO TCMS test run operations scoped to a test cycle.
 *
 * DEVIATION from plan (D-15): The original plan specified fetchAioRunsForIssue(baseUrl, token, issueKey)
 * using GET /testrun?issueKey=. That endpoint does NOT exist on this AIO instance (D-15 probe finding).
 * Test runs are scoped to a cycle: GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/testrun
 *
 * This module is rescoped to cycle-based run fetching. Issue-level filtering (Phase 54) will
 * inspect AioTestRun fields to find runs referencing a specific Jira issue key.
 */

import { ApiError } from '../../lib/api-error';
import { aioFetch } from './client';
import type { AioPage, AioTestRun } from './types';

/**
 * Fetch all test runs for a specific test cycle.
 *
 * NOTE (D-15): There is no GET /testrun?issueKey= endpoint. Test runs are always
 * fetched by cycle. Phase 54 will filter runs by Jira issue key client-side.
 *
 * @param baseUrl    - Jira/AIO base URL (same host as Jira)
 * @param token      - Personal Access Token (from Stronghold key 'jira-pat')
 * @param projectKey - Jira project key (e.g. "PROJ")
 * @param cycleKey   - AIO cycle key (e.g. "PROJ-CY-2")
 * @returns Array of AioTestRun objects; empty array if cycle has no runs (404)
 * @throws ApiError with status 401 on authentication failure
 * @throws Error on network failure
 */
export async function fetchAioTestRunsForCycle(
  baseUrl: string,
  token: string,
  projectKey: string,
  cycleKey: string,
): Promise<AioTestRun[]> {
  const basePath = `/project/${encodeURIComponent(projectKey)}/testcycle/${encodeURIComponent(cycleKey)}/testrun`;
  const allRuns: AioTestRun[] = [];
  let startAt = 0;

  for (;;) {
    const path = `${basePath}?startAt=${startAt}`;
    let response: Response;
    try {
      response = await aioFetch(baseUrl, token, path);
    } catch {
      throw new Error(`Cannot reach AIO at ${baseUrl}`);
    }
    if (response.ok) {
      const data = (await response.json()) as AioPage<AioTestRun> | AioTestRun[];
      // Guard: D-17 confirms AioPage wrapper for aio-tcms-api/1.0 endpoints,
      // but guard for direct array in case of API variation.
      if (Array.isArray(data)) {
        return data; // Direct array — no pagination
      }
      allRuns.push(...(data.items ?? []));
      if (data.isLast) return allRuns;
      startAt += data.maxResults;
      continue;
    }
    if (response.status === 401) {
      throw new ApiError('Invalid token or token has expired', 401, 'jira');
    }
    if (response.status === 404) {
      return []; // cycle not found or no runs
    }
    throw new Error(`AIO request failed with status ${response.status}`);
  }
}
