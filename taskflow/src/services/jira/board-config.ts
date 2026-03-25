/**
 * Jira board configuration operations: quick filter discovery.
 *
 * Quick filters are board-level filter presets defined by Jira admins.
 * Each quick filter has a JQL clause that narrows the board view.
 */

import { apiFetch } from '../../lib/apiFetch';
import type { JiraBoardQuickFilter } from './types';

export type { JiraBoardQuickFilter } from './types';

/**
 * Fetch quick filters configured on a Jira Scrum board.
 *
 * Calls GET /rest/agile/1.0/board/{boardId}/quickfilter.
 * Returns an empty array on any failure (graceful degradation).
 *
 * @param baseUrl - Jira base URL (e.g. "https://jira.example.com")
 * @param token   - Personal Access Token
 * @param boardId - Numeric board ID
 * @returns Array of JiraBoardQuickFilter, ordered by position
 */
export async function fetchBoardQuickFilters(
  baseUrl: string,
  token: string,
  boardId: number,
): Promise<JiraBoardQuickFilter[]> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/rest/agile/1.0/board/${boardId}/quickfilter`;
  const response = await apiFetch(
    'jira',
    url,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    'Load Quick Filters',
  );
  if (!response.ok) return [];
  const data = await response.json();
  return data?.values ?? [];
}
