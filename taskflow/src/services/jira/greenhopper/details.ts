/**
 * GreenHopper /issue/details.json fetcher.
 *
 * Returns the full issue-detail payload (header/details/description/comments/etc.).
 * Error envelope matches services/jira/transitions.ts:19-41.
 *
 * Endpoint: GET /rest/greenhopper/1.0/xboard/issue/details.json?rapidViewId={boardId}&issueIdOrKey={issueKey}&loadSubtasks={loadSubtasks}
 *
 * Threat T-71-07 mitigation: issueKey is URL-encoded to prevent path-injection
 * for keys containing reserved URL characters.
 */

import { ApiError } from '../../../lib/api-error';
import { greenhopperFetch } from './client';
import type { GhDetailsResponse } from './types';

/**
 * Fetch the issue-details payload.
 *
 * @param baseUrl       - Jira base URL
 * @param token         - Bearer PAT
 * @param boardId       - rapidViewId context for the issue
 * @param issueKey      - Issue key, e.g. "PROJ-1" (URL-encoded internally)
 * @param loadSubtasks  - Whether to include sub-task data in the response
 */
export async function fetchIssueDetails(
  baseUrl: string,
  token: string,
  boardId: number,
  issueKey: string,
  loadSubtasks: boolean,
): Promise<GhDetailsResponse> {
  let response: Response;
  try {
    response = await greenhopperFetch(
      baseUrl,
      token,
      `/issue/details.json?rapidViewId=${boardId}&issueIdOrKey=${encodeURIComponent(issueKey)}&loadSubtasks=${loadSubtasks}`,
      'Load Issue Details',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Invalid token or token has expired', response.status, 'jira');
    }
    throw new Error(`GreenHopper issue details request failed with status ${response.status}`);
  }

  return (await response.json()) as GhDetailsResponse;
}
