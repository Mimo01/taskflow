/**
 * AIO TCMS test run operations scoped to a test cycle.
 *
 * DEVIATION from plan (D-15): The original plan specified fetchAioRunsForIssue(baseUrl, token, issueKey)
 * using GET /testrun?issueKey=. That endpoint does NOT exist on this AIO instance (D-15 probe finding).
 * Test runs are scoped to a cycle: GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/testrun
 *
 * This module is rescoped to cycle-based run fetching. Issue-level filtering (Phase 54) will
 * inspect AioTestRun fields to find runs referencing a specific Jira issue key.
 */

// PROBE FINDINGS (Plan 56-05):
// A: raw.defects on RawTestRun is absent/always []. Confirmed from live AIO testing in Plan 56-04
//    (Gap 3 root cause): the AIO API does not populate a top-level `defects: string[]` field on
//    the test run item. There is no `jiraDefects`, `defectKeys`, or `jiraDefectKeys` field with
//    string keys at the RawTestRun level.
//    raw.runs[0].jiraDefectIDs is number[] (confirmed in production — Plan 56-04 gap analysis).
//    No other fields on RawRunExecution contain string issue keys.
// B: GET /rest/api/2/issue/{numericId}?fields=key,summary,status returns { key: 'PROJ-NNN' } (confirmed).
//    Jira REST API v2 accepts both the issue key ("PROJ-42") and the numeric internal ID ("186227")
//    in the URL path. The response includes `key` at the top level of the issue object.
// C: fetchJiraIssueByKey(baseUrl, token, String(numericId)) resolves to { key, fields } (confirmed).
//    The existing function constructs /rest/api/2/issue/${issueKey}?fields=summary,status,...
//    and returns null on any error — safe for our use case.
// Resolution strategy chosen: B/C — resolve jiraDefectIDs to string Jira keys via fetchJiraIssueByKey.
//    Fast-path (A) is not available because raw.defects is never populated by this AIO instance.

import { ApiError } from '../../lib/api-error';
import { fetchJiraIssueByKey } from '../jira/issues';
import { aioFetch } from './client';
import type { AioPage, AioTestRun } from './types';

// API returns test case assignments. Each item wraps a testCase and a runs[] array.
// The most recent execution is runs[0]; status lives at runs[0].testRunStatus.name.
// runs[0].ID is the execution run ID used by GET /testrun/{runId} — the top-level
// raw.ID is the test case assignment ID and must NOT be used for run detail navigation.
// jiraDefectIDs are numeric Jira internal IDs resolved to string Jira keys via
// resolveJiraDefectKeys (Plan 56-05 fix — AIOC-03).
type RawRunExecution = {
  ID?: number;
  testRunStatus?: { ID?: number; name?: string };
  jiraDefectIDs?: number[];
  updatedDate?: number;
};

type RawTestRun = {
  ID?: number;
  id?: string;
  testCase?: { title?: string; name?: string; key?: string; updatedDate?: string };
  cycleKey?: string;
  runs?: RawRunExecution[];
  // flat fields from alternative API response shapes (kept for safety)
  status?: string;
  executionStatus?: string;
  testCaseKey?: string;
  defects?: string[];
  executedDate?: string | number;
};

function normalizeDate(raw: string | number | undefined): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'number') return new Date(raw).toISOString();
  return raw;
}

function toChipStatus(name: string | undefined): string {
  switch ((name ?? '').toLowerCase()) {
    case 'pass':
    case 'passed':
      return 'PASS';
    case 'fail':
    case 'failed':
      return 'FAIL';
    case 'blocked':
      return 'BLOCKED';
    default:
      return 'NOT_EXECUTED';
  }
}

/**
 * Resolve an array of numeric Jira internal IDs to string issue keys (e.g. 'PROJ-42').
 *
 * Uses fetchJiraIssueByKey with the numeric ID as a string — Jira REST API v2 accepts
 * both the issue key and the numeric internal ID in the URL path.
 * Results where fetchJiraIssueByKey returns null (404, auth, network) are silently
 * dropped so the caller receives only successfully resolved keys.
 *
 * @param baseUrl    - Jira base URL
 * @param token      - Personal Access Token
 * @param numericIds - Array of numeric Jira internal issue IDs
 * @returns Array of resolved Jira issue keys (e.g. ['PROJ-42', 'PROJ-57'])
 */
async function resolveJiraDefectKeys(
  baseUrl: string,
  token: string,
  numericIds: number[],
): Promise<string[]> {
  const results = await Promise.all(
    numericIds.map((id) => fetchJiraIssueByKey(baseUrl, token, String(id))),
  );
  return results.filter((issue) => issue !== null).map((issue) => issue.key);
}

function normalizeTestRun(raw: RawTestRun, fallbackCycleKey: string): AioTestRun {
  const latestRun = raw.runs?.[0];
  const statusName = latestRun?.testRunStatus?.name ?? raw.status ?? raw.executionStatus;
  // Use the execution run ID (runs[0].ID) as the canonical run ID for detail navigation.
  // The top-level raw.ID is the test case assignment ID — a different concept.
  // GET /testrun/{runId} expects the execution run ID (confirmed by Phase 54 Probe B/C1).
  const runId = String(latestRun?.ID ?? raw.ID ?? raw.id ?? '');
  return {
    id: runId,
    status: toChipStatus(statusName),
    testCaseKey: raw.testCase?.key ?? raw.testCaseKey ?? '',
    cycleKey: raw.cycleKey ?? fallbackCycleKey,
    testCase: raw.testCase
      ? {
          title: raw.testCase.title ?? raw.testCase.name ?? '',
          updatedDate: normalizeDate(latestRun?.updatedDate) ?? raw.testCase.updatedDate,
        }
      : undefined,
    defects: raw.defects ?? [],
    jiraDefectIDs: latestRun?.jiraDefectIDs ?? [],
    executedDate: normalizeDate(latestRun?.updatedDate ?? raw.executedDate),
  };
}

/**
 * Fetch all test runs for a specific test cycle.
 *
 * NOTE (D-15): There is no GET /testrun?issueKey= endpoint. Test runs are always
 * fetched by cycle. Phase 54 will filter runs by Jira issue key client-side.
 *
 * @param baseUrl    - Jira/AIO base URL (same host as Jira)
 * @param token      - Personal Access Token (from Stronghold key 'jira-pat')
 * @param projectKey - Jira project key (e.g. "PROJ")
 * @param cycleKey   - AIO cycle key (e.g. "PROJ-CY-2")
 * @returns Array of AioTestRun objects; empty array if cycle has no runs (404)
 * @throws ApiError with status 401 on authentication failure
 * @throws Error on network failure
 */
export async function fetchAioTestRunsForCycle(
  baseUrl: string,
  token: string,
  projectKey: string,
  cycleKey: string,
): Promise<AioTestRun[]> {
  const basePath = `/project/${encodeURIComponent(projectKey)}/testcycle/${encodeURIComponent(cycleKey)}/testrun`;
  const allRuns: AioTestRun[] = [];
  let startAt = 0;

  for (;;) {
    const path = `${basePath}?startAt=${startAt}`;
    let response: Response;
    try {
      response = await aioFetch(baseUrl, token, path);
    } catch {
      throw new Error(`Cannot reach AIO at ${baseUrl}`);
    }
    if (response.ok) {
      const data = (await response.json()) as AioPage<RawTestRun> | RawTestRun[];
      // Guard: D-17 confirms AioPage wrapper for aio-tcms-api/1.0 endpoints,
      // but guard for direct array in case of API variation.
      if (Array.isArray(data)) {
        const runs = data.map((r) => normalizeTestRun(r, cycleKey));
        return resolveDefectsForRuns(baseUrl, token, runs);
      }
      allRuns.push(...(data.items ?? []).map((r) => normalizeTestRun(r, cycleKey)));
      if (data.isLast || !data.maxResults || data.maxResults <= 0) {
        return resolveDefectsForRuns(baseUrl, token, allRuns);
      }
      startAt += data.maxResults;
      continue;
    }
    if (response.status === 401) {
      throw new ApiError('Invalid token or token has expired', 401, 'jira');
    }
    if (response.status === 404) {
      return []; // cycle not found or no runs
    }
    throw new Error(`AIO request failed with status ${response.status}`);
  }
}

/**
 * Post-process a batch of normalized AioTestRun objects by resolving each run's
 * jiraDefectIDs to string Jira issue keys. Returns a new array of run objects
 * with the resolved defects field — does not mutate the input objects.
 */
async function resolveDefectsForRuns(
  baseUrl: string,
  token: string,
  runs: AioTestRun[],
): Promise<AioTestRun[]> {
  return Promise.all(
    runs.map(async (run) => {
      const ids = run.jiraDefectIDs ?? [];
      if (ids.length === 0) return run;
      const defects = await resolveJiraDefectKeys(baseUrl, token, ids);
      return { ...run, defects };
    }),
  );
}
