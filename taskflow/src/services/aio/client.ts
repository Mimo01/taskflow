/**
 * Shared AIO TCMS API client helpers — fetch wrapper, base path constants.
 *
 * This module is imported by domain modules (projects, cycles, runs) but is NOT
 * re-exported from the barrel index.ts. Its exports are internal to aio/.
 *
 * Two base paths are exported (D-13: Phase 51 probe confirmed both are needed):
 *   AIO_PROJECTS_API_PATH — project listing endpoints only
 *   AIO_API_PATH           — all other endpoints (cycles, test runs, test cases)
 */

import { apiFetch } from '../../lib/apiFetch';

// KEY DECISION (Phase 51 probe): confirmed against live AIO instance — see .planning/phases/51-aio-service-layer/51-CONTEXT.md D-13
// Two base paths required — not one. Project listing uses a different servlet than cycles/runs.
export const AIO_PROJECTS_API_PATH = '/rest/aio-tcms/1.0';
export const AIO_API_PATH = '/rest/aio-tcms-api/1.0';

/**
 * Fetch wrapper for AIO TCMS API endpoints.
 *
 * Constructs the full URL as: baseUrl (trailing slash stripped) + apiPath + path
 * Sends Authorization: Bearer and Content-Type: application/json headers.
 *
 * @param baseUrl  - Jira/AIO base URL (same host; trailing slash is stripped)
 * @param token    - Personal Access Token (from Stronghold key 'jira-pat')
 * @param path     - Endpoint path, e.g. '/project' or '/project/PROJ/testcycle'
 * @param apiPath  - Base path constant to prepend; defaults to AIO_API_PATH
 */
export async function aioFetch(
  baseUrl: string,
  token: string,
  path: string,
  apiPath: string = AIO_API_PATH,
): Promise<Response> {
  const url = `${baseUrl.replace(/\/$/, '')}${apiPath}${path}`;
  return apiFetch('aio', url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}
