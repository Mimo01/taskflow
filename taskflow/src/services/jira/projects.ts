/**
 * Jira project-level operations: PAT validation and project listing.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import type { JiraProject, JiraUser } from './types';

/**
 * Validate a Jira PAT by calling GET /rest/api/2/myself.
 *
 * @param baseUrl - Jira base URL (e.g. "https://jira.example.com")
 * @param token   - Personal Access Token
 * @returns Resolved user info on success
 * @throws Exact error strings per locked UX decisions in CONTEXT.md
 */
export async function validateJira(baseUrl: string, token: string): Promise<JiraUser> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/myself`;

  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, 'Validate Connection');
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (response.ok) {
    const data = await response.json();
    return {
      displayName: data.displayName,
      emailAddress: data.emailAddress,
      name: data.name ?? data.emailAddress,
    };
  }

  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }

  if (response.status === 403) {
    throw new ApiError('Token valid but lacks required permissions', 403, 'jira');
  }

  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}

/**
 * List all Jira projects visible to the authenticated user.
 *
 * @param baseUrl - Jira base URL
 * @param token   - Personal Access Token (already validated)
 * @returns Array of projects with id, key, and name
 */
export async function listJiraProjects(baseUrl: string, token: string): Promise<JiraProject[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/project`;

  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, 'Validate Connection');
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (response.ok) {
    const data = await response.json();
    return data as JiraProject[];
  }

  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }

  if (response.status === 403) {
    throw new ApiError('Token valid but lacks required permissions', 403, 'jira');
  }

  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}
