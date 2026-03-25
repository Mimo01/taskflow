/**
 * Jira sprint operations: active sprint discovery, sprint listing, issue assignment.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import type { JiraActiveSprint } from './types';

/**
 * Fetch the active sprint for a Jira project using the Agile REST API.
 *
 * Step 1: Discover the scrum board for the project via GET /rest/agile/1.0/board.
 * Step 2: Fetch the active sprint from that board via GET /rest/agile/1.0/board/{boardId}/sprint?state=active.
 *
 * Returns null on any failure (board not found, sprint not found, network error).
 * Never throws -- all errors are caught and null is returned (graceful-hide).
 *
 * NOTE: apiFetch already adds a 15-second AbortController timeout (Quick-9).
 *
 * @param baseUrl    - Jira base URL (e.g. "https://jira.example.com")
 * @param token      - Personal Access Token
 * @param projectKey - Jira project key (e.g. "PROJ")
 * @returns Active sprint or null
 */
export async function fetchActiveSprint(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<JiraActiveSprint | null> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  try {
    // Step 1: board discovery
    const boardRes = await apiFetch(
      'jira',
      `${base}/rest/agile/1.0/board?projectKeyOrId=${projectKey}&type=scrum`,
      { headers },
      'Load Sprint Board',
    );
    if (!boardRes.ok) return null;
    const boardData = await boardRes.json();
    const boardId: number | undefined = boardData?.values?.[0]?.id;
    if (!boardId) return null;

    // Step 2: active sprint
    const sprintRes = await apiFetch(
      'jira',
      `${base}/rest/agile/1.0/board/${boardId}/sprint?state=active`,
      { headers },
      'Load Sprint Board',
    );
    if (!sprintRes.ok) return null;
    const sprintData = await sprintRes.json();
    const values: JiraActiveSprint[] = sprintData?.values ?? [];
    if (values.length === 0) return null;

    return values[0];
  } catch {
    return null;
  }
}

/**
 * Fetch a sprint board's active and future sprints.
 *
 * Calls GET /rest/agile/1.0/board/{boardId}/sprint?state=active,future.
 * Returns an empty array on any failure (graceful degradation -- callers render
 * just the backlog section when no sprints are found).
 *
 * @param baseUrl - Jira base URL (e.g. "https://jira.example.com")
 * @param token   - Personal Access Token
 * @param boardId - Numeric board ID (discover via fetchActiveSprint or similar)
 * @returns Array of JiraActiveSprint with state 'active' or 'future', ordered by start date
 */
export async function fetchSprintsForBoard(
  baseUrl: string,
  token: string,
  boardId: number,
): Promise<JiraActiveSprint[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  try {
    const res = await apiFetch(
      'jira',
      `${base}/rest/agile/1.0/board/${boardId}/sprint?state=active,future`,
      { headers },
      'Load Sprint Board',
    );
    if (!res.ok) return [];
    const data = await res.json();
    const sprints: JiraActiveSprint[] = data?.values ?? [];
    // Sort: active first, then future by startDate ascending
    return sprints.sort((a, b) => {
      if (a.state === 'active' && b.state !== 'active') return -1;
      if (b.state === 'active' && a.state !== 'active') return 1;
      const aDate = a.startDate ?? '';
      const bDate = b.startDate ?? '';
      return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
    });
  } catch {
    return [];
  }
}

/**
 * Move a set of issues into a sprint via the Jira Agile REST API.
 *
 * POSTs to POST /rest/agile/1.0/sprint/{sprintId}/issue with body { issues: issueKeys }.
 * Jira returns 204 No Content on success -- treated as success.
 * Throws Error on any other non-ok response.
 *
 * @param baseUrl   - Jira base URL (e.g. "https://jira.example.com")
 * @param token     - Personal Access Token
 * @param sprintId  - Numeric sprint ID (JiraActiveSprint.id)
 * @param issueKeys - Array of issue keys to add (e.g. ["PROJ-1", "PROJ-2"])
 * @throws Error with status code on non-ok, non-204 response
 */
export async function addIssuesToSprint(
  baseUrl: string,
  token: string,
  sprintId: number,
  issueKeys: string[],
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/agile/1.0/sprint/${sprintId}/issue`;
  const response = await apiFetch(
    'jira',
    url,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ issues: issueKeys }),
    },
    'Load Sprint Board',
  );
  // 204 No Content is the expected success response for this endpoint
  if (!response.ok && response.status !== 204) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to add issues to sprint', response.status, 'jira');
    }
    throw new Error(`Failed to add issues to sprint: ${response.status}`);
  }
}
