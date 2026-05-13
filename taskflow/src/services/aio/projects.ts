/**
 * AIO TCMS project listing operations.
 *
 * Fetches all AIO projects visible to the authenticated user.
 * Projects are returned as a direct array (not paginated) from the
 * /rest/aio-tcms/1.0/ servlet — confirmed by D-16 probe findings.
 */

import { ApiError } from '../../lib/api-error';
import { AIO_PROJECTS_API_PATH, aioFetch } from './client';
import type { AioProject } from './types';

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
export async function fetchAioProjects(
  baseUrl: string,
  token: string,
): Promise<AioProject[]> {
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, '/project', AIO_PROJECTS_API_PATH);
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    const raw = await response.json() as Array<{ ID: number; jiraProjectKey: string }>;
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
