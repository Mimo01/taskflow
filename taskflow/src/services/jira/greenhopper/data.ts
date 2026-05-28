/**
 * GreenHopper /plan/backlog/data.json fetcher.
 *
 * Returns the backlog issue list for a rapid view (no entity maps — consumers
 * combine with a prior allData fetch). Error envelope matches services/jira/transitions.ts.
 *
 * Endpoint: GET /rest/greenhopper/1.0/xboard/plan/backlog/data.json?rapidViewId={boardId}
 */

import { ApiError } from '../../../lib/api-error';
import { greenhopperFetch } from './client';
import type { GhBacklogResponse } from './types';

/**
 * Fetch the backlog data payload for a rapid view.
 *
 * @param baseUrl - Jira base URL
 * @param token   - Bearer PAT
 * @param boardId - rapidViewId of the sprint board
 */
export async function fetchBacklogData(
  baseUrl: string,
  token: string,
  boardId: number,
): Promise<GhBacklogResponse> {
  let response: Response;
  try {
    response = await greenhopperFetch(
      baseUrl,
      token,
      `/plan/backlog/data.json?rapidViewId=${boardId}`,
      'Load Backlog (data)',
    );
  } catch (err) {
    // WR-02: preserve ApiError (auth failures bubble through to
    // setJiraConnected(false) per D-04); only collapse network-class errors
    // to the "Cannot reach" envelope.
    if (err instanceof ApiError) throw err;
    const wrapped = new Error(`Cannot reach ${baseUrl} — check the base URL`);
    (wrapped as Error & { cause?: unknown }).cause = err;
    throw wrapped;
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Invalid token or token has expired', response.status, 'jira');
    }
    throw new Error(`GreenHopper backlog data request failed with status ${response.status}`);
  }

  return (await response.json()) as GhBacklogResponse;
}
