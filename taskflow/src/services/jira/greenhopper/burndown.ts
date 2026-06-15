/**
 * GreenHopper scopechangeburndownchart fetcher — INSIGHT-02 (Phase 85).
 *
 * Endpoint: GET /rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart?rapidViewId=...&sprintId=...
 *
 * ⚠ PATH OVERRIDE (Phase 85 D-08): the rapid-charts endpoint lives at a DIFFERENT root than
 * GREENHOPPER_API_PATH ('/rest/greenhopper/1.0/xboard'). Passing any non-empty apiPath to
 * greenhopperFetch would double the prefix to:
 *   …/xboard/rest/greenhopper/1.0/rapid/charts/… → 404
 * This module passes apiPath='' (empty string) so the full path in the `path` argument is
 * used verbatim: baseUrl + '' + '/rest/greenhopper/1.0/rapid/charts/...' → correct URL.
 *
 * Error envelope mirrors data.ts (Phase 71 D-04):
 * - ApiError (auth 401/403) → re-thrown so setJiraConnected(false) fires upstream
 * - Network errors → wrapped as 'Cannot reach ${baseUrl}'
 * - !response.ok → thrown so TanStack Query surfaces it to BurndownChart.tsx's error state (D-09/D-10)
 */

import { ApiError } from '../../../lib/api-error';
import { greenhopperFetch } from './client';
import type { GreenHopperBurndown } from './types';

/**
 * Fetch the scope-change burndown chart data for an active sprint.
 *
 * Returns the full GreenHopperBurndown payload including the `.changes` timeline
 * and `.workRateData` ideal guideline. On error, throws (not returns []) — callers
 * (BurndownChart.tsx via TanStack Query) handle the error state independently (D-09).
 *
 * `statisticField` in the response will be `'timeestimate'` on this DC instance —
 * burndown values are in SECONDS (Jira DC native unit). The chart component is
 * responsible for converting to hours for display.
 *
 * Probe C PASSED 2026-06-15: confirmed top-level keys + .changes with 496 entries.
 *
 * @param baseUrl  - Jira base URL (e.g. "https://jira.example.com")
 * @param token    - Personal Access Token (Bearer PAT — shared with all Jira calls per D-04)
 * @param boardId  - rapidViewId; caller supplies from app-resolved board — never hardcode 6708 (Spoofing mitigation T-85-01)
 * @param sprintId - Sprint ID for the burndown; caller supplies — never hardcode 19562 (Spoofing mitigation T-85-01)
 */
export async function fetchBurndown(
  baseUrl: string,
  token: string,
  boardId: number,
  sprintId: number,
): Promise<GreenHopperBurndown> {
  let response: Response;
  try {
    response = await greenhopperFetch(
      baseUrl,
      token,
      // Full rapid-charts path — the 5th arg (apiPath='') ensures no /xboard prefix is added.
      `/rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart?rapidViewId=${boardId}&sprintId=${sprintId}`,
      'Load Sprint Burndown',
      '', // apiPath override (D-08): rapid-charts root differs from GREENHOPPER_API_PATH (/xboard)
    );
  } catch (err) {
    // Re-throw ApiError (auth failures bubble to setJiraConnected(false) per D-04).
    // Collapse all other network-class errors to a 'Cannot reach' envelope.
    if (err instanceof ApiError) throw err;
    const wrapped = new Error(`Cannot reach ${baseUrl} — check the base URL`);
    (wrapped as Error & { cause?: unknown }).cause = err;
    throw wrapped;
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Invalid token or token has expired', response.status, 'jira');
    }
    throw new Error(
      `GreenHopper burndown request failed with status ${response.status}`,
    );
  }

  return (await response.json()) as GreenHopperBurndown;
}
