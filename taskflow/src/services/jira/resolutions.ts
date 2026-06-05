/**
 * Global Jira resolution list fetcher.
 *
 * Wraps `GET /rest/api/2/resolution` which returns the full list of resolutions
 * the Jira instance defines, each with `id`, `name`, and an optional `description`.
 *
 * Used by the issue-detail Resolution field control (FieldsSection) to populate
 * the inline Select of available resolutions when editing a done-category issue.
 *
 * Error envelope mirrors `services/jira/statuses.ts` (`fetchAllJiraStatuses`):
 * 401/403 throw `ApiError`; other non-OK responses throw a generic `Error`.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';

/**
 * Single resolution row returned by GET /rest/api/2/resolution.
 */
export interface JiraResolution {
  id: string;
  name: string;
  description?: string;
}

/**
 * Fetch the full global Jira resolution list.
 *
 * @param baseUrl - Jira base URL (trailing slash tolerated)
 * @param token   - Bearer PAT
 */
export async function fetchResolutions(
  baseUrl: string,
  token: string,
): Promise<JiraResolution[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/resolution`;
  const response = await apiFetch(
    'jira',
    url,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    'Load Resolutions',
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch resolutions', response.status, 'jira');
    }
    throw new Error(`Failed to fetch resolutions: ${response.status}`);
  }
  return (await response.json()) as JiraResolution[];
}
