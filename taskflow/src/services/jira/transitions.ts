/**
 * Jira issue transition POST operation.
 *
 * The legacy per-issue REST GET path was removed in Phase 72 (D-08 / GH-CUT-01).
 * Workflow transitions are now resolved via the GreenHopper cache
 * (useGhTransitions / getGhTransitions in src/services/jira/greenhopper/transitions.ts).
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import type { JiraTransitionWithFields } from './types';

/**
 * React Query key for the per-issue transitions-with-fields fetch.
 *
 * The set of available transitions (and therefore which one is the in-place
 * resolution loop) is a function of the issue's CURRENT status, so `statusId`
 * is part of the key: a cached list must never gate a different status. Both
 * StatusPopover and FieldsSection MUST use this single factory so their cache
 * entries stay identical (shared fetch) and never silently diverge.
 */
export function transitionsWithFieldsKey(
  issueKey: string,
  baseUrl: string,
  statusId: string,
): readonly [string, string, string, string] {
  return ['jira-issue-transitions-fields', issueKey, baseUrl, statusId];
}

/**
 * Transition a Jira issue to a new status.
 *
 * The optional `fields` argument is included in the POST body ONLY when supplied
 * (presence check, NOT truthiness — a clear payload like `{ resolution: null }`
 * is a legitimate non-empty object that must survive). When omitted, the body is
 * exactly `{ transition: { id } }`, preserving existing callers.
 */
export async function postTransition(
  baseUrl: string,
  token: string,
  issueKey: string,
  transitionId: string,
  fields?: Record<string, unknown>,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/transitions`;

  const body = {
    transition: { id: transitionId },
    // Presence check: include `fields` iff the arg was passed at all, so a
    // `{ resolution: null }` clear payload is preserved.
    ...(fields !== undefined ? { fields } : {}),
  };

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
        body: JSON.stringify(body),
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

/**
 * Fetch the issue's available workflow transitions WITH per-transition field
 * metadata: `GET /rest/api/2/issue/{key}/transitions?expand=transitions.fields`.
 *
 * Unlike the bulk GreenHopper transitions cache (which carries no field metadata),
 * this per-issue REST call exposes `fields.resolution.allowedValues`, used to drive
 * the interactive resolution pickers (issue-detail sidebar + StatusPopover).
 *
 * Error envelope mirrors `fetchResolutions` (resolutions.ts):
 * 401/403 throw `ApiError`; other non-OK responses throw a generic `Error`.
 */
export async function fetchIssueTransitionsWithFields(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<JiraTransitionWithFields[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/transitions?expand=transitions.fields`;
  const response = await apiFetch(
    'jira',
    url,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    'Load Transitions',
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch transitions', response.status, 'jira');
    }
    throw new Error(`Failed to fetch transitions: ${response.status}`);
  }
  const data = (await response.json()) as { transitions?: JiraTransitionWithFields[] };
  return data.transitions ?? [];
}
