/**
 * User search service for Jira mentions and assignment.
 *
 * Uses the assignable user search endpoint which returns users
 * who can be assigned to issues in the given project.
 */

import { apiFetch } from '../../lib/apiFetch';
import type { JiraAssignableUser } from './types';

/**
 * Search for assignable users in a Jira project.
 *
 * @param baseUrl - Jira base URL
 * @param token - Personal Access Token
 * @param projectKey - Jira project key
 * @param query - Search string (matches displayName and username)
 * @returns Array of matching users, or [] on error
 */
export async function fetchAssignableUsers(
  baseUrl: string,
  token: string,
  projectKey: string,
  query: string,
): Promise<JiraAssignableUser[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/user/assignable/search?project=${encodeURIComponent(projectKey)}&username=${encodeURIComponent(query)}`;

  try {
    const response = await apiFetch('jira', url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }, 'Load Users');

    if (!response.ok) return [];

    return (await response.json()) as JiraAssignableUser[];
  } catch {
    return [];
  }
}

/**
 * Resolve an AIO ownedByID to a Jira DC user record.
 * GET /rest/api/latest/user?key={key} — AIO ownedByID values are Jira user keys,
 * not usernames. UAT confirmed ?username= returns "does not exist" for JIRAUSER* keys.
 * Returns null on 404/any error — D-08: caller shows raw ownedByID as fallback.
 */
export async function fetchJiraUserByUsername(
  baseUrl: string,
  token: string,
  username: string,
): Promise<JiraAssignableUser | null> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/latest/user?key=${encodeURIComponent(username)}`;
  try {
    const response = await apiFetch('jira', url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }, 'Load User');
    if (!response.ok) return null;
    return (await response.json()) as JiraAssignableUser;
  } catch {
    return null;
  }
}
