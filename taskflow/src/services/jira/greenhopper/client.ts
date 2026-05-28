/**
 * GreenHopper API client helpers — private fetch wrapper, base path constant.
 *
 * This module is imported by sibling domain modules (allData/data/details/transitions)
 * but is intentionally NOT re-exported from `greenhopper/index.ts` (Phase 71 D-06).
 *
 * KEY DECISION (Phase 71 D-04 + RESEARCH Pitfall 8): passes `'jira'` to apiFetch — NOT
 * `'greenhopper'`. The GreenHopper API lives on the same Jira host, uses the same Bearer
 * PAT, and a 401 must trigger the same `setJiraConnected(false)` as a regular Jira call.
 * Adding a `'greenhopper'` source would force `apiFetch`'s union to widen with zero
 * behavioral benefit.
 */

import { apiFetch } from '../../../lib/apiFetch';

export const GREENHOPPER_API_PATH = '/rest/greenhopper/1.0/xboard';

/**
 * Fetch wrapper for GreenHopper API endpoints.
 *
 * Constructs the full URL as: baseUrl (trailing slash stripped) + apiPath + path
 * Sends Authorization: Bearer and Content-Type: application/json headers.
 *
 * Uses apiFetch source `'jira'` per D-04 + RESEARCH Pitfall 8 — GreenHopper shares Jira's
 * host and PAT, so 401 semantics must match.
 *
 * @param baseUrl   - Jira base URL (GreenHopper lives on the same host)
 * @param token     - Personal Access Token (from Stronghold key 'jira-pat')
 * @param path      - Endpoint path, e.g. '/work/allData.json?rapidViewId=1'
 * @param operation - User-facing operation label, e.g. 'Load Sprint Board'
 * @param apiPath   - Base path constant to prepend; defaults to GREENHOPPER_API_PATH
 * @param init      - Optional HTTP method + body overrides (default: GET, no body)
 */
export async function greenhopperFetch(
  baseUrl: string,
  token: string,
  path: string,
  operation: string,
  apiPath: string = GREENHOPPER_API_PATH,
  init?: { method?: string; body?: string },
): Promise<Response> {
  const url = `${baseUrl.replace(/\/$/, '')}${apiPath}${path}`;
  // Source is literal 'jira' per D-04 + RESEARCH Pitfall 8 — NEVER 'greenhopper'.
  return apiFetch(
    'jira',
    url,
    {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      ...(init?.body !== undefined ? { body: init.body } : {}),
    },
    operation,
  );
}
