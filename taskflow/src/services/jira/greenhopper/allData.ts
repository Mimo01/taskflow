/**
 * GreenHopper /work/allData.json fetcher.
 *
 * Returns the full sprint-board payload: entity maps (statuses/priorities/types/epics),
 * columns, swimlanes, and issues. Error envelope matches services/jira/transitions.ts:19-41.
 *
 * Endpoint: GET /rest/greenhopper/1.0/xboard/work/allData.json?rapidViewId={boardId}
 */

import { ApiError } from '../../../lib/api-error';
import { greenhopperFetch } from './client';
import type { GhAllDataResponse } from './types';

/**
 * Fetch the full board allData payload for a rapid view.
 *
 * @param baseUrl - Jira base URL (GreenHopper shares the Jira host)
 * @param token   - Bearer PAT (same key as Jira REST)
 * @param boardId - rapidViewId of the sprint board
 */
export async function fetchAllData(
  baseUrl: string,
  token: string,
  boardId: number,
): Promise<GhAllDataResponse> {
  let response: Response;
  try {
    response = await greenhopperFetch(
      baseUrl,
      token,
      `/work/allData.json?rapidViewId=${boardId}`,
      'Load Sprint Board (allData)',
    );
  } catch (err) {
    // WR-02: preserve ApiError (auth failures bubble through to
    // setJiraConnected(false) per D-04); only collapse network-class errors
    // to the "Cannot reach" envelope.
    if (err instanceof ApiError) throw err;
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`, { cause: err });
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Invalid token or token has expired', response.status, 'jira');
    }
    throw new Error(`GreenHopper allData request failed with status ${response.status}`);
  }

  return (await response.json()) as GhAllDataResponse;
}
