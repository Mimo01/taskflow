/**
 * Jira issue link operations.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import type { IssueLinkType } from './types';

/**
 * Fetch available issue link types from GET /rest/api/2/issueLinkType.
 *
 * Link type names are admin-configurable -- never hardcode "Blocks", "Relates To", etc.
 * Returns empty array on any non-ok response (graceful degradation).
 */
export async function fetchIssueLinkTypes(
  baseUrl: string,
  token: string,
): Promise<IssueLinkType[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issueLinkType`;
  const resp = await apiFetch(
    'jira',
    url,
    { headers: { Authorization: `Bearer ${token}` } },
    'Load Issue Detail',
  );
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.issueLinkTypes ?? [];
}

/**
 * Create an issue link between two issues.
 *
 * Issue links CANNOT be sent in the create body -- they must be posted separately
 * after the issue is created. POST /rest/api/2/issueLink returns 201 on success.
 *
 * CRITICAL: Use linkTypeId (not name) to avoid brittleness from admin renames.
 */
export async function createIssueLink(
  baseUrl: string,
  token: string,
  linkTypeId: string,
  inwardKey: string,
  outwardKey: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issueLink`;
  const response = await apiFetch(
    'jira',
    url,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: { id: linkTypeId },
        inwardIssue: { key: inwardKey },
        outwardIssue: { key: outwardKey },
      }),
    },
    'Manage Links',
  );
  if (!response.ok && response.status !== 201) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to create issue link', response.status, 'jira');
    }
    throw new Error(`Failed to create issue link: ${response.status}`);
  }
}
