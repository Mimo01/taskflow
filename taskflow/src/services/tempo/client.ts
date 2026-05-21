/**
 * Tempo Timesheets API client helpers — fetch wrapper, base path constant.
 *
 * This module is imported by domain modules (worklogs) but is NOT
 * re-exported from the barrel index.ts. Its exports are internal to tempo/.
 *
 * KEY DECISION (Phase 61 probe, 2026-05-21): confirmed against live Jira DC instance.
 * v4 (/rest/tempo-timesheets/4/) returned 405 Method Not Allowed on this DC instance.
 * v3 (/rest/tempo-timesheets/3/) returned 200 with a full worklog array.
 * TEMPO_API_PATH is set to v3 — see .planning/phases/61-tempo-probe-service-layer/61-PROBE-RESULT.md
 */

import { apiFetch } from '../../lib/apiFetch';

export const TEMPO_API_PATH = '/rest/tempo-timesheets/3';

/**
 * Fetch wrapper for Tempo Timesheets API endpoints.
 *
 * Constructs the full URL as: baseUrl (trailing slash stripped) + apiPath + path
 * Sends Authorization: Bearer and Content-Type: application/json headers.
 *
 * Uses apiFetch source 'tempo' (not 'jira' or 'aio') so a Tempo 401 does NOT trigger
 * setJiraConnected(false) — Tempo auth is independent of Jira auth.
 *
 * @param baseUrl   - Jira base URL (Tempo lives on the same host)
 * @param token     - Personal Access Token (from Stronghold key 'jira-pat')
 * @param path      - Endpoint path, e.g. '/worklogs?dateFrom=...'
 * @param operation - User-facing operation label, e.g. 'Load Tempo Worklogs'
 * @param apiPath   - Base path constant to prepend; defaults to TEMPO_API_PATH
 * @param init      - Optional HTTP method + body overrides (default: GET, no body)
 */
export async function tempoFetch(
  baseUrl: string,
  token: string,
  path: string,
  operation: string,
  apiPath: string = TEMPO_API_PATH,
  init?: { method?: string; body?: string },
): Promise<Response> {
  const url = `${baseUrl.replace(/\/$/, '')}${apiPath}${path}`;
  return apiFetch(
    'tempo',
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
