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
 * Shape of a single quick filter in the GreenHopper editmodel response
 * (`quickFilterConfig.quickFilters[]`). Note: the JQL clause is named `query`
 * here (not `jql`) and there is no `boardId` field — both are normalised in
 * {@link fetchBoardQuickFilters}.
 */
interface GreenHopperQuickFilter {
  id: number;
  name: string;
  query: string;
  description?: string;
  position: number;
}

/**
 * Fetch quick filters configured on a Jira Scrum board.
 *
 * Source: the GreenHopper board edit model
 *   GET /rest/greenhopper/1.0/rapidviewconfig/editmodel.json?rapidViewId={boardId}
 * → `quickFilterConfig.quickFilters[]`. This is the same endpoint the board
 * config UI reads.
 *
 * This app targets Jira Server/DC (GreenHopper xboard endpoints throughout),
 * where the agile `/quickfilter` *collection* endpoint does not exist (only
 * `/quickfilter/{id}` for a single known id) and `/configuration` returns
 * column config without quick filters — so the edit model is the only source
 * that lists a board's quick filters. Calling it directly avoids a guaranteed
 * 404 against the non-existent `/quickfilter` endpoint.
 *
 * Returns an empty array on any failure (graceful degradation).
 *
 * @param baseUrl - Jira base URL (e.g. "https://jira.example.com")
 * @param token   - Personal Access Token
 * @param boardId - Numeric board ID (rapidViewId)
 * @returns Array of JiraBoardQuickFilter, ordered by position
 */
export async function fetchBoardQuickFilters(
  baseUrl: string,
  token: string,
  boardId: number,
): Promise<JiraBoardQuickFilter[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // GreenHopper edit model (Jira Server / DC). Quick filters are nested under
  // quickFilterConfig.quickFilters, with the JQL clause in a `query` field —
  // normalise to the JiraBoardQuickFilter shape.
  const editModelUrl = `${base}/rest/greenhopper/1.0/rapidviewconfig/editmodel.json?rapidViewId=${boardId}`;
  const editModelResponse = await apiFetch(
    'jira',
    editModelUrl,
    { headers },
    'Load Board Quick Filters',
  );
  if (!editModelResponse.ok) return [];
  const editModel = await editModelResponse.json();
  const quickFilters: GreenHopperQuickFilter[] = editModel?.quickFilterConfig?.quickFilters ?? [];
  return quickFilters.map((qf) => ({
    id: qf.id,
    boardId,
    name: qf.name,
    jql: qf.query ?? '',
    description: qf.description,
    position: qf.position,
  }));
}
