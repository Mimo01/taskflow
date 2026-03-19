/**
 * Jira worklog operations.
 */

import { fetchAllWorklogPages } from './client';

/**
 * Returns the unique displayNames of all authors who logged work on an issue.
 *
 * Paginates through all worklog pages so issues with many worklogs do not
 * silently lose authors beyond the first page.
 *
 * Silently returns [] on any error -- callers use this for attribution enrichment only.
 */
export async function fetchIssueWorklogs(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<string[]> {
  try {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const worklogUrl = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/worklog`;
    const worklogs = await fetchAllWorklogPages(worklogUrl, headers);
    const names = new Set<string>();
    for (const wl of worklogs) {
      const name = wl.author?.displayName;
      if (name) names.add(name);
    }
    return Array.from(names);
  } catch {
    return [];
  }
}
