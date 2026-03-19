/**
 * Jira comment CRUD operations.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import type { JiraComment } from './types';

export async function fetchComments(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<JiraComment[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/comment`;
  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to fetch comments for ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to fetch comments for ${issueKey}: status ${response.status}`);
  }
  const data = (await response.json()) as { comments: JiraComment[] };
  return data.comments ?? [];
}

/**
 * Post a comment on a Jira issue.
 */
export async function postComment(
  baseUrl: string,
  token: string,
  issueKey: string,
  body: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/comment`;

  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok && response.status !== 201) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to post comment on ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to post comment on ${issueKey}: status ${response.status}`);
  }
}

export async function updateComment(
  baseUrl: string,
  token: string,
  issueKey: string,
  commentId: string,
  body: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/comment/${commentId}`;

  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to update comment on ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to update comment on ${issueKey}: status ${response.status}`);
  }
}

export async function deleteComment(
  baseUrl: string,
  token: string,
  issueKey: string,
  commentId: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/comment/${commentId}`;

  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to delete comment on ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to delete comment on ${issueKey}: status ${response.status}`);
  }
}
