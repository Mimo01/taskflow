/**
 * Worklog CRUD service for Jira time tracking.
 *
 * Follows the same error-handling pattern as comment CRUD in ../jira.ts:
 * - apiFetch for instrumented HTTP calls
 * - ApiError for 401/403 auth failures
 * - Graceful empty-array fallback for read operations
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import type { JiraWorklog } from './types';

const PAGE_SIZE = 50;

/**
 * Fetch all pages of worklogs for an issue and return full JiraWorklog objects.
 *
 * Paginates through all worklog pages so issues with many worklogs
 * do not silently lose entries beyond the first page.
 *
 * Silently returns [] on any error -- callers use this for enrichment.
 */
export async function fetchFullWorklogs(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<JiraWorklog[]> {
  try {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const baseWorklogUrl = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/worklog`;
    const allWorklogs: JiraWorklog[] = [];
    let startAt = 0;

    while (true) {
      const url = `${baseWorklogUrl}?maxResults=${PAGE_SIZE}&startAt=${startAt}`;
      let response: Response;
      try {
        response = await apiFetch('jira', url, { headers }, 'Load Worklogs');
      } catch {
        break;
      }
      if (!response.ok) break;

      const data = await response.json();
      const worklogs: JiraWorklog[] = data.worklogs ?? [];
      allWorklogs.push(...worklogs);

      const total: number = data.total ?? 0;
      startAt += PAGE_SIZE;
      if (startAt >= total || worklogs.length === 0) break;
    }

    const seen = new Set<string>();
    return allWorklogs.filter((w) => !seen.has(w.id) && !!seen.add(w.id));
  } catch {
    return [];
  }
}

/**
 * Create a new worklog entry on an issue.
 *
 * @param baseUrl - Jira base URL
 * @param token - Personal Access Token
 * @param issueKey - Issue key (e.g. "PROJ-1")
 * @param params - Worklog data: timeSpentSeconds, started (ISO datetime), optional comment
 */
export async function createWorklog(
  baseUrl: string,
  token: string,
  issueKey: string,
  params: { timeSpentSeconds: number; started: string; comment?: string },
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/worklog`;

  // Default a blank/whitespace-only comment to a self-describing fallback so every
  // logged worklog is meaningful in Tempo/Jira views. A real comment is passed
  // through verbatim (no trimming of the user's text).
  const effectiveComment =
    params.comment && params.comment.trim() !== ''
      ? params.comment
      : `Working on issue ${issueKey}`;
  const body = { ...params, comment: effectiveComment };

  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      'Manage Worklogs',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to create worklog on ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to create worklog on ${issueKey}: status ${response.status}`);
  }
}

/**
 * Update an existing worklog entry.
 */
export async function updateWorklog(
  baseUrl: string,
  token: string,
  issueKey: string,
  worklogId: string,
  params: { timeSpentSeconds: number; started: string; comment?: string },
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/worklog/${worklogId}`;

  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      },
      'Manage Worklogs',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to update worklog on ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to update worklog on ${issueKey}: status ${response.status}`);
  }
}

/**
 * Delete a worklog entry.
 */
export async function deleteWorklog(
  baseUrl: string,
  token: string,
  issueKey: string,
  worklogId: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/worklog/${worklogId}`;

  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      'Manage Worklogs',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to delete worklog on ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to delete worklog on ${issueKey}: status ${response.status}`);
  }
}
