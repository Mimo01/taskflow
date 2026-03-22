/**
 * Jira saved filter CRUD operations.
 *
 * Saved filters are user-owned JQL queries stored server-side in Jira.
 * The favourite filters endpoint returns filters the current user has starred.
 */

import { apiFetch } from '../../lib/apiFetch';
import type { JiraSavedFilter } from './types';

export type { JiraSavedFilter } from './types';

/**
 * Create a new Jira saved filter and mark it as favourite.
 *
 * @param baseUrl     - Jira base URL
 * @param token       - Personal Access Token
 * @param name        - Filter display name
 * @param jql         - JQL query string
 * @param description - Optional filter description
 * @returns The created JiraSavedFilter
 * @throws Error on non-ok response
 */
export async function createJiraFilter(
  baseUrl: string,
  token: string,
  name: string,
  jql: string,
  description?: string,
): Promise<JiraSavedFilter> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/filter`;
  const response = await apiFetch('jira', url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, jql, description: description ?? '', favourite: true }),
  }, 'Save Filter');
  if (!response.ok) throw new Error(`Failed to create filter: ${response.status}`);
  return response.json();
}

/**
 * Fetch the current user's favourite (starred) Jira filters.
 *
 * Returns an empty array on any failure (graceful degradation).
 */
export async function fetchFavouriteFilters(
  baseUrl: string,
  token: string,
): Promise<JiraSavedFilter[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/filter/favourite`;
  const response = await apiFetch('jira', url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }, 'Load Saved Filters');
  if (!response.ok) return [];
  return response.json();
}

/**
 * Update an existing Jira saved filter.
 *
 * @param baseUrl     - Jira base URL
 * @param token       - Personal Access Token
 * @param filterId    - ID of the filter to update
 * @param name        - New filter name
 * @param jql         - New JQL query
 * @param description - Optional new description
 * @returns The updated JiraSavedFilter
 * @throws Error on non-ok response
 */
export async function updateJiraFilter(
  baseUrl: string,
  token: string,
  filterId: string,
  name: string,
  jql: string,
  description?: string,
): Promise<JiraSavedFilter> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/filter/${filterId}`;
  const response = await apiFetch('jira', url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, jql, description: description ?? '' }),
  }, 'Update Filter');
  if (!response.ok) throw new Error(`Failed to update filter: ${response.status}`);
  return response.json();
}

/**
 * Delete a Jira saved filter.
 *
 * @param baseUrl  - Jira base URL
 * @param token    - Personal Access Token
 * @param filterId - ID of the filter to delete
 * @throws Error on non-ok response
 */
export async function deleteJiraFilter(
  baseUrl: string,
  token: string,
  filterId: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/filter/${filterId}`;
  const response = await apiFetch('jira', url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }, 'Delete Filter');
  if (!response.ok) throw new Error(`Failed to delete filter: ${response.status}`);
}

/**
 * Build a JQL query string from structured filter criteria.
 *
 * @param projectKey       - Jira project key (e.g. "PROJ")
 * @param epics            - Epic keys to filter by
 * @param labels           - Label names to filter by
 * @param assignees        - Assignee usernames to filter by
 * @param statuses         - Status names to filter by
 * @param epicLinkFieldKey - Custom field key for epic link (e.g. "customfield_10014")
 * @returns JQL query string with AND-joined clauses
 */
export function buildJqlFromFilters(
  projectKey: string,
  epics: string[],
  labels: string[],
  assignees: string[],
  statuses: string[],
  epicLinkFieldKey: string,
): string {
  const clauses: string[] = [`project = ${projectKey}`];
  if (epics.length > 0) clauses.push(`"${epicLinkFieldKey}" in (${epics.join(',')})`);
  if (labels.length > 0) clauses.push(`labels in (${labels.map(l => `"${l}"`).join(',')})`);
  if (assignees.length > 0) clauses.push(`assignee in (${assignees.map(a => `"${a}"`).join(',')})`);
  if (statuses.length > 0) clauses.push(`status in (${statuses.map(s => `"${s}"`).join(',')})`);
  return clauses.join(' AND ');
}
