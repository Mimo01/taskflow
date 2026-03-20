/**
 * Jira fix version / release operations.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import type { JiraFixVersion } from './types';

/**
 * Fetch all fix versions (releases) for a Jira project.
 *
 * @param baseUrl    - Jira base URL
 * @param token      - Personal Access Token
 * @param projectKey - Jira project key (e.g. "PROJ")
 * @returns Array of fix versions ordered by release date
 */
export async function fetchFixVersions(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<JiraFixVersion[]> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/rest/api/2/project/${projectKey}/versions`;

  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, 'Load Releases');
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const msg =
      (data as { errorMessages?: string[] }).errorMessages?.[0] ?? 'Failed to fetch fix versions';
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(msg, response.status, 'jira');
    }
    throw new Error(msg);
  }

  const data = await response.json();
  // GET /rest/api/2/project/{projectKey}/versions returns a bare array
  return (Array.isArray(data) ? data : []) as JiraFixVersion[];
}
