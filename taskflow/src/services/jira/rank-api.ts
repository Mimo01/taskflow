/**
 * Jira rank operation: reorder an issue on the backlog via the Agile REST API.
 *
 * Issues PUT /rest/agile/1.0/issue/rank with an integer rankCustomFieldId read
 * from the cached GhBacklogResponse — never hardcoded.
 *
 * Mirrors the addIssuesToSprint apiFetch + 204 + ApiError(401/403) convention.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import { flattenJiraError } from './errors';

/**
 * Rank an issue before or after a neighbour via the Jira Agile REST API.
 *
 * PUTs to /rest/agile/1.0/issue/rank. Jira returns 204 No Content on success.
 * Throws ApiError on 401/403, generic Error on any other non-ok response.
 *
 * @param baseUrl          - Jira base URL (e.g. "https://jira.example.com")
 * @param token            - Personal Access Token
 * @param issueKey         - The issue to rerank (e.g. "PROJ-2")
 * @param rankCustomFieldId - Integer field ID from GhBacklogResponse.rankCustomFieldId (e.g. 10105)
 * @param position         - { rankBeforeIssue } or { rankAfterIssue } or {} for no neighbour constraint
 */
export async function rankIssueApi(
  baseUrl: string,
  token: string,
  issueKey: string,
  rankCustomFieldId: number,
  position: { rankBeforeIssue: string } | { rankAfterIssue: string } | Record<string, never>,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/agile/1.0/issue/rank`;
  const body = { issues: [issueKey], rankCustomFieldId, ...position };
  const response = await apiFetch(
    'jira',
    url,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    'Rank Issue',
  );
  // 204 No Content is the only unambiguous full-success response.
  if (response.status === 204) return;
  if (response.status === 401 || response.status === 403) {
    throw new ApiError('Failed to rank issue', response.status, 'jira');
  }
  // WR-01: 207 Multi-Status means one or more issues could NOT be ranked
  // (per-issue errors in the body). It is a 2xx, so `response.ok` is true and the
  // old guard silently accepted it — no rollback, no banner, while the server
  // never applied the order. Inspect the body and throw if any entry failed so
  // the optimistic order rolls back (RANK-04).
  if (response.status === 207) {
    const body = (await response.json().catch(() => null)) as {
      entries?: Array<{ status?: number }>;
    } | null;
    const failed = body?.entries?.some((e) => (e.status ?? 0) >= 400);
    if (failed) throw new Error('Rank partially failed (207)');
    return;
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(
      `Failed to rank issue: ${flattenJiraError(body) ?? `status ${response.status}`}`,
    );
  }
}
