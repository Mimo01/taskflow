/**
 * AIO TCMS test cycle operations scoped to a project.
 *
 * Fetch all cycles for a project via GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle
 * with pagination loop (AioPage<AioCycle> wrapper confirmed in D-17 probe).
 */

import { ApiError } from '../../lib/api-error';
import { aioFetch } from './client';
import type { AioPage, AioCycle } from './types';

/**
 * Fetch all test cycles for a project.
 *
 * @param baseUrl    - Jira/AIO base URL (same host as Jira)
 * @param token      - Personal Access Token (from Stronghold key 'jira-pat')
 * @param projectKey - Jira project key (e.g. "PROJ"); URL-encoded via encodeURIComponent (T-52-01)
 * @returns Array of AioCycle objects; empty array if project has no cycles (404)
 * @throws ApiError with status 401 on authentication failure
 * @throws Error on network failure
 */
export async function fetchAioCycles(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<AioCycle[]> {
  const basePath = `/project/${encodeURIComponent(projectKey)}/testcycle`;
  const allCycles: AioCycle[] = [];
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
      const data = (await response.json()) as AioPage<AioCycle> | AioCycle[];
      // Guard: D-17 confirms AioPage wrapper for aio-tcms-api/1.0 endpoints,
      // but guard for direct array in case of API variation.
      if (Array.isArray(data)) {
        return data; // Direct array — no pagination
      }
      allCycles.push(...(data.items ?? []));
      if (data.isLast) return allCycles;
      startAt += data.maxResults;
      continue;
    }
    if (response.status === 401) {
      throw new ApiError('Invalid token or token has expired', 401, 'jira');
    }
    if (response.status === 404) {
      return []; // project not found or no cycles
    }
    throw new Error(`AIO request failed with status ${response.status}`);
  }
}
