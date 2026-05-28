/**
 * Jira issue transition POST operation.
 *
 * The legacy per-issue REST GET path was removed in Phase 72 (D-08 / GH-CUT-01).
 * Workflow transitions are now resolved via the GreenHopper cache
 * (useGhTransitions / getGhTransitions in src/services/jira/greenhopper/transitions.ts).
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';

/**
 * Transition a Jira issue to a new status.
 */
export async function postTransition(
  baseUrl: string,
  token: string,
  issueKey: string,
  transitionId: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/transitions`;

  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transition: { id: transitionId } }),
      },
      'Issue Transition',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok && response.status !== 204) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to transition ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to transition ${issueKey}: status ${response.status}`);
  }
}
