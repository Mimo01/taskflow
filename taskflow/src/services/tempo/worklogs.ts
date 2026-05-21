/**
 * Tempo Timesheets worklog fetch operations.
 *
 * Phase 61 probe finding: v3 returns a plain TempoWorklog[] array — no
 * pagination wrapper. fetchWorklogs issues a single GET and returns all
 * matching worklogs for the given date range and username list.
 *
 * dateStarted is normalized to YYYY-MM-DD via .slice(0, 10) (never
 * new Date(...).toLocaleDateString() — avoids timezone-shift bugs).
 */

import { ApiError } from '../../lib/api-error';
import { tempoFetch } from './client';
import type { TempoWorklog } from './types';

/**
 * Fetch all Tempo worklogs for the given users and date range.
 *
 * @param baseUrl   - Jira base URL (Tempo lives on the same host)
 * @param token     - Personal Access Token (from Stronghold key 'jira-pat')
 * @param usernames - Jira usernames to filter by (query param: username=)
 * @param from      - Start date YYYY-MM-DD (inclusive)
 * @param to        - End date YYYY-MM-DD (inclusive)
 * @returns Flat array of TempoWorklog with dateStarted normalized to YYYY-MM-DD
 * @throws ApiError 401 on authentication failure
 * @throws Error on network failure or other non-ok responses
 */
export async function fetchWorklogs(
  baseUrl: string,
  token: string,
  usernames: string[],
  from: string,
  to: string,
): Promise<TempoWorklog[]> {
  const params = new URLSearchParams({ dateFrom: from, dateTo: to });
  for (const u of usernames) params.append('username', u);

  const res = await tempoFetch(baseUrl, token, `/worklogs?${params}`, 'Load Tempo Worklogs');

  if (res.status === 401) {
    throw new ApiError('Tempo authentication failed — check Jira PAT', 401, 'jira');
  }
  if (res.status === 404) {
    return [];
  }
  if (!res.ok) {
    throw new ApiError(`Tempo worklogs request failed: ${res.status}`, res.status, 'jira');
  }

  const worklogs = (await res.json()) as TempoWorklog[];
  return worklogs.map((w) => ({
    ...w,
    dateStarted: w.dateStarted.slice(0, 10),
  }));
}
