/**
 * GreenHopper /work/transitions.json fetcher.
 *
 * Returns the workflow→transitions map for a project. Unlike services/jira/transitions.ts
 * (REST shape), this endpoint returns the entire envelope (projectAndIssueTypeToWorkflow +
 * workflowToTransitions) — consumers do their own indexing. Error envelope matches
 * services/jira/transitions.ts:19-41.
 *
 * Endpoint: GET /rest/greenhopper/1.0/xboard/work/transitions.json?projectId={projectId}
 */

import { ApiError } from '../../../lib/api-error';
import { greenhopperFetch } from './client';
import type { GhTransitionsResponse } from './types';

/**
 * Fetch the GreenHopper workflow→transitions map for a project.
 *
 * NOTE: returns the whole envelope (no `.transitions` unwrap), unlike the REST-shape
 * jira/transitions.ts. See 71-PATTERNS.md "transitions.ts" deviation note.
 *
 * @param baseUrl   - Jira base URL
 * @param token     - Bearer PAT
 * @param projectId - Numeric Jira project id
 */
export async function fetchGhTransitions(
  baseUrl: string,
  token: string,
  projectId: number,
): Promise<GhTransitionsResponse> {
  let response: Response;
  try {
    response = await greenhopperFetch(
      baseUrl,
      token,
      `/work/transitions.json?projectId=${projectId}`,
      'Load Workflow Transitions',
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
    throw new Error(`GreenHopper transitions request failed with status ${response.status}`);
  }

  return (await response.json()) as GhTransitionsResponse;
}
