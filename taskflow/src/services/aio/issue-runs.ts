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

import { ApiError } from '../../lib/api-error';
import { aioFetch } from './client';
import type { AioPage, AioTestRun } from './types';

// API returns test case assignments. Each item wraps a testCase and a runs[] array.
// The most recent execution is runs[0]; status lives at runs[0].testRunStatus.name.
// jiraDefectIDs are numeric Jira internal IDs — cannot resolve to string keys without
// a separate API call, so defects are left empty (AIOC-03 descoped per D-14 fallback).
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
    case 'pass': case 'passed': return 'PASS';
    case 'fail': case 'failed': return 'FAIL';
    case 'blocked': return 'BLOCKED';
    default: return 'NOT_EXECUTED';
  }
}

function normalizeTestRun(raw: RawTestRun, fallbackCycleKey: string): AioTestRun {
  const latestRun = raw.runs?.[0];
  const statusName = latestRun?.testRunStatus?.name ?? raw.status ?? raw.executionStatus;
  return {
    id: String(raw.ID ?? raw.id ?? ''),
    status: toChipStatus(statusName),
    testCaseKey: raw.testCase?.key ?? raw.testCaseKey ?? '',
    cycleKey: raw.cycleKey ?? fallbackCycleKey,
    testCase: raw.testCase
      ? { title: raw.testCase.title ?? raw.testCase.name ?? '', updatedDate: normalizeDate(latestRun?.updatedDate) ?? raw.testCase.updatedDate }
      : undefined,
    defects: raw.defects ?? [],
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
        return data.map((r) => normalizeTestRun(r, cycleKey));
      }
      allRuns.push(...(data.items ?? []).map((r) => normalizeTestRun(r, cycleKey)));
      if (data.isLast) return allRuns;
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
