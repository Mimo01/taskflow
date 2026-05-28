/**
 * Global Jira status list fetcher.
 *
 * Wraps `GET /rest/api/2/status` which returns the full list of statuses the
 * Jira instance defines, each with `id`, `name`, and `statusCategory.{id,key,name}`.
 *
 * Used by the Phase 72 GreenHopper transitions adapter to synthesize
 * `JiraTransition.to.{id, name, statusCategory}` from the per-project workflow
 * envelope (which only carries `toStatusId`). See Phase 72 CONTEXT.md D-06.
 *
 * Error envelope mirrors `services/jira/fields.ts:127-159` (`fetchProjectStatuses`):
 * 401/403 throw `ApiError`; other non-OK responses throw a generic `Error`.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';

/**
 * Single status row returned by GET /rest/api/2/status.
 * Shape matches `JiraTransition.to.statusCategory` at `src/services/jira.ts:183-191`
 * so the adapter can copy `statusCategory` through by reference.
 */
export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: { id: number; key: string; name: string };
}

/**
 * Fetch the full global Jira status list.
 *
 * @param baseUrl - Jira base URL (trailing slash tolerated)
 * @param token   - Bearer PAT
 */
export async function fetchAllJiraStatuses(
  baseUrl: string,
  token: string,
): Promise<JiraStatus[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/status`;
  const response = await apiFetch(
    'jira',
    url,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    'Load Statuses',
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch Jira statuses', response.status, 'jira');
    }
    throw new Error(`Failed to fetch Jira statuses: ${response.status}`);
  }
  return (await response.json()) as JiraStatus[];
}
