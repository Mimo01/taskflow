/**
 * AIO TCMS test cycle operations scoped to a project.
 *
 * Fetch all cycles for a project via GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle
 * with pagination loop (AioPage<AioCycle> wrapper confirmed in D-17 probe).
 *
 * fetchAioCycleDetail fetches a single cycle's detail via the confirmed /detail endpoint (D-17).
 */

import { ApiError } from '../../lib/api-error';
import { aioFetch } from './client';
import type { AioCycle, AioPage } from './types';

type RawCycle = {
  key: string;
  title?: string;
  name?: string;
  isClosed?: boolean;
  status?: string;
  projectKey?: string;
  // Folder/grouping fields — confirmed from live AIO: testSet is an object { ID, name }.
  folder?: string;
  testSet?: { ID?: number; name?: string } | string; // AIO returns object { ID, name }
  folderName?: string;
  testSetKey?: string;
};

// PROBE FINDINGS (Plan 56-06, updated from live error):
// testSet is returned as an object { ID: number, name: string } by this AIO instance —
// NOT a plain string as the static-analysis probe assumed. Extracting .name is required.
// folder, folderName, testSetKey remain string fields if present.
function resolveRawFolder(raw: RawCycle): string | undefined {
  if (raw.folder) return raw.folder;
  if (raw.testSet) {
    return typeof raw.testSet === 'string' ? raw.testSet : raw.testSet.name;
  }
  if (raw.folderName) return raw.folderName;
  if (raw.testSetKey) return raw.testSetKey;
  return undefined;
}

function normalizeCycle(raw: RawCycle, fallbackProjectKey?: string): AioCycle {
  const status = raw.status ?? (raw.isClosed ? 'Closed' : 'Active');
  return {
    key: raw.key,
    name: raw.title ?? raw.name ?? raw.key,
    status,
    projectKey: raw.projectKey ?? fallbackProjectKey ?? '',
    folder: resolveRawFolder(raw) ?? status,
  };
}

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
        return (data as RawCycle[]).map((r) => normalizeCycle(r, projectKey));
      }
      allCycles.push(
        ...((data.items as unknown as RawCycle[]) ?? []).map((r) => normalizeCycle(r, projectKey)),
      );
      if (data.isLast || data.maxResults <= 0) return allCycles;
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

/**
 * Fetch the detail for a single test cycle.
 *
 * Endpoint: GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/detail
 * Returns a single AioCycle object (not paginated — D-17 confirmed).
 *
 * @param baseUrl    - Jira/AIO base URL
 * @param token      - Personal Access Token (from Stronghold key 'jira-pat')
 * @param projectKey - Jira project key; URL-encoded via encodeURIComponent
 * @param cycleKey   - AIO cycle key, e.g. "PROJ-CY-2"; URL-encoded via encodeURIComponent
 * @returns AioCycle object for the given cycle
 * @throws ApiError with status 401 on authentication failure
 * @throws ApiError with status 404 if cycle not found
 * @throws Error on network failure or other non-ok responses
 */
export async function fetchAioCycleDetail(
  baseUrl: string,
  token: string,
  projectKey: string,
  cycleKey: string,
): Promise<AioCycle> {
  const path = `/project/${encodeURIComponent(projectKey)}/testcycle/${encodeURIComponent(cycleKey)}/detail`;
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path);
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    return normalizeCycle((await response.json()) as RawCycle, projectKey);
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    throw new ApiError('Cycle not found', 404, 'jira');
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}
