/**
 * Jira saved filter CRUD service.
 *
 * Provides create, fetch-favourites, update, and delete operations
 * against the Jira REST API v2 /filter endpoints.
 */

import { apiFetch } from '../../lib/apiFetch';
import type { JiraSavedFilter } from './types';

export async function createJiraFilter(
  baseUrl: string,
  token: string,
  name: string,
  jql: string,
  description?: string,
): Promise<JiraSavedFilter> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/filter`;
  const response = await apiFetch(
    'jira',
    url,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, jql, description: description ?? '', favourite: true }),
    },
    'Save Filter',
  );
  if (!response.ok) throw new Error(`Failed to create filter: ${response.status}`);
  return response.json();
}

export async function fetchFavouriteFilters(
  baseUrl: string,
  token: string,
): Promise<JiraSavedFilter[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/filter/favourite`;
  const response = await apiFetch(
    'jira',
    url,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    },
    'Fetch Favourite Filters',
  );
  if (!response.ok) throw new Error(`Failed to fetch favourite filters: ${response.status}`);
  return response.json();
}

export async function updateJiraFilter(
  baseUrl: string,
  token: string,
  filterId: string,
  updates: { name?: string; jql?: string; description?: string },
): Promise<JiraSavedFilter> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/filter/${filterId}`;
  const response = await apiFetch(
    'jira',
    url,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    },
    'Update Filter',
  );
  if (!response.ok) throw new Error(`Failed to update filter: ${response.status}`);
  return response.json();
}

export async function deleteJiraFilter(
  baseUrl: string,
  token: string,
  filterId: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/filter/${filterId}`;
  const response = await apiFetch(
    'jira',
    url,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
    'Delete Filter',
  );
  if (!response.ok) throw new Error(`Failed to delete filter: ${response.status}`);
}
