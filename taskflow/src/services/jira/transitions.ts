/**
 * Jira issue transition operations.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import type { JiraTransition } from './types';

/**
 * Fetch available transitions for a Jira issue.
 */
export async function fetchTransitions(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<JiraTransition[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/transitions`;

  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to fetch transitions for ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to fetch transitions for ${issueKey}: status ${response.status}`);
  }

  const data = await response.json();
  return data.transitions as JiraTransition[];
}

/**
 * Transition a Jira issue to a new status.
 */
export async function postTransition(
  baseUrl: string,
  token: string,
  issueKey: string,
  transitionId: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/transitions`;

  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transition: { id: transitionId } }),
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok && response.status !== 204) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to transition ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to transition ${issueKey}: status ${response.status}`);
  }
}
