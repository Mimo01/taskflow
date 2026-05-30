/**
 * Jira changelog operations.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import type { ChangelogHistory } from '../jira-changelog';

export async function fetchIssueChangelog(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<ChangelogHistory[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}?expand=changelog&fields=summary`;
  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      },
      'Load Issue Detail',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to fetch changelog for ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to fetch changelog for ${issueKey}: ${response.status}`);
  }
  const data = (await response.json()) as { changelog?: { histories: ChangelogHistory[] } };
  return data.changelog?.histories ?? [];
}
