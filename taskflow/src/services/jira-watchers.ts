/**
 * Watcher CRUD service — fetch, add, and remove watchers for Jira issues.
 *
 * Follows the same pattern as comments.ts: uses apiFetch for instrumented HTTP,
 * throws ApiError on 401/403 for auth detection.
 */
import { ApiError } from '../lib/api-error';
import { apiFetch } from '../lib/apiFetch';

export interface WatcherData {
  isWatching: boolean;
  watchCount: number;
}

/**
 * Fetch watcher state for an issue — returns whether the current user
 * is watching and the total watcher count.
 */
export async function fetchWatchers(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<WatcherData> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/watchers`;
  const response = await apiFetch(
    'jira',
    url,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
    'Load Issue Detail',
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to fetch watchers for ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to fetch watchers: ${response.status}`);
  }
  const data = await response.json();
  return { isWatching: data.isWatching ?? false, watchCount: data.watchCount ?? 0 };
}

/**
 * Add the current user (or a specified username) as a watcher.
 *
 * IMPORTANT: Jira DC expects a raw JSON string as the body, NOT an object.
 * i.e., the body should be `"bob"` (a quoted string), not `{"name":"bob"}`.
 */
export async function addWatcher(
  baseUrl: string,
  token: string,
  issueKey: string,
  username: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/watchers`;
  const response = await apiFetch(
    'jira',
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(username),
    },
    'Watch Issue',
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to add watcher for ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to add watcher: ${response.status}`);
  }
}

/**
 * Remove a watcher from an issue by username.
 * Uses ?username= query parameter as required by Jira DC REST API v2.
 */
export async function removeWatcher(
  baseUrl: string,
  token: string,
  issueKey: string,
  username: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/watchers?username=${encodeURIComponent(username)}`;
  const response = await apiFetch(
    'jira',
    url,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
    'Unwatch Issue',
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to remove watcher for ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to remove watcher: ${response.status}`);
  }
}
