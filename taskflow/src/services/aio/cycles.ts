/**
 * AIO TCMS test cycle operations scoped to a project.
 *
 * Fetch all cycles for a project via GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle
 * with pagination loop (AioPage<AioCycle> wrapper confirmed in D-17 probe).
 *
 * fetchAioCycleDetail fetches a single cycle's detail via the confirmed /detail endpoint (D-17).
 */

import { ApiError } from '../../lib/api-error';
import { AIO_PROJECTS_API_PATH, aioFetch } from './client';
import type {
  AioCycle,
  AioCycleDetailPagedResponse,
  AioCycleSummaryItem,
  AioFolder,
  AioPage,
  AioTestRunStatusConfig,
} from './types';

// AIO API returns several fields as { ID, name } objects rather than plain strings.
type AioNamedObject = { ID?: number; name?: string };
type AioStringOrObject = string | AioNamedObject;

type RawCycle = {
  ID?: number; // numeric cycle ID returned by /detail endpoint (P4 probe — Phase 58)
  key: string;
  title?: string;
  name?: string;
  isClosed?: boolean;
  status?: AioStringOrObject; // AIO returns { ID, name } object, not a plain string
  projectKey?: string;
  folder?: AioStringOrObject;
  testSet?: AioStringOrObject; // confirmed object { ID, name } from live AIO
  folderName?: AioStringOrObject;
  testSetKey?: AioStringOrObject;
};

// Extract a plain string from a field that AIO may return as { ID, name } or a plain string.
function toStr(v: AioStringOrObject | undefined): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v || undefined;
  return v.name || undefined;
}

// PROBE FINDINGS (Plan 56-06, updated from live errors):
// Both testSet and status are returned as { ID, name } objects by this AIO instance.
// All candidate folder/status fields are now normalised through toStr() to extract .name.
function resolveRawFolder(raw: RawCycle): string | undefined {
  return toStr(raw.folder) ?? toStr(raw.testSet) ?? toStr(raw.folderName) ?? toStr(raw.testSetKey);
}

function normalizeCycle(raw: RawCycle, fallbackProjectKey?: string): AioCycle {
  const status = toStr(raw.status) ?? (raw.isClosed ? 'Closed' : 'Active');
  return {
    ID: raw.ID,
    key: raw.key,
    name: raw.title ?? raw.name ?? raw.key,
    status,
    projectKey: raw.projectKey ?? fallbackProjectKey ?? '',
    folder: resolveRawFolder(raw) ?? status,
  };
}

/**
 * Fetch all test cycles for a project.
 *
 * @param baseUrl    - Jira/AIO base URL (same host as Jira)
 * @param token      - Personal Access Token (from Stronghold key 'jira-pat')
 * @param projectKey - Jira project key (e.g. "PROJ"); URL-encoded via encodeURIComponent (T-52-01)
 * @returns Array of AioCycle objects; empty array if project has no cycles (404)
 * @throws ApiError with status 401 on authentication failure
 * @throws Error on network failure
 */
export async function fetchAioCycles(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<AioCycle[]> {
  const basePath = `/project/${encodeURIComponent(projectKey)}/testcycle`;
  const allCycles: AioCycle[] = [];
  let startAt = 0;

  for (;;) {
    const path = `${basePath}?startAt=${startAt}`;
    let response: Response;
    try {
      response = await aioFetch(baseUrl, token, path, 'Load AIO Cycles');
    } catch {
      throw new Error(`Cannot reach AIO at ${baseUrl}`);
    }
    if (response.ok) {
      const data = (await response.json()) as AioPage<AioCycle> | AioCycle[];
      // Guard: D-17 confirms AioPage wrapper for aio-tcms-api/1.0 endpoints,
      // but guard for direct array in case of API variation.
      if (Array.isArray(data)) {
        return (data as RawCycle[]).map((r) => normalizeCycle(r, projectKey));
      }
      allCycles.push(
        ...((data.items as unknown as RawCycle[]) ?? []).map((r) => normalizeCycle(r, projectKey)),
      );
      if (data.isLast || data.maxResults <= 0) return allCycles;
      startAt += data.maxResults;
      continue;
    }
    if (response.status === 401) {
      throw new ApiError('Invalid token or token has expired', 401, 'jira');
    }
    if (response.status === 404) {
      return []; // project not found or no cycles
    }
    throw new Error(`AIO request failed with status ${response.status}`);
  }
}

/**
 * Fetch the detail for a single test cycle.
 *
 * Endpoint: GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/detail
 * Returns a single AioCycle object (not paginated — D-17 confirmed).
 *
 * @param baseUrl    - Jira/AIO base URL
 * @param token      - Personal Access Token (from Stronghold key 'jira-pat')
 * @param projectKey - Jira project key; URL-encoded via encodeURIComponent
 * @param cycleKey   - AIO cycle key, e.g. "PROJ-CY-2"; URL-encoded via encodeURIComponent
 * @returns AioCycle object for the given cycle
 * @throws ApiError with status 401 on authentication failure
 * @throws ApiError with status 404 if cycle not found
 * @throws Error on network failure or other non-ok responses
 */
export async function fetchAioCycleDetail(
  baseUrl: string,
  token: string,
  projectKey: string,
  cycleKey: string,
): Promise<AioCycle> {
  const path = `/project/${encodeURIComponent(projectKey)}/testcycle/${encodeURIComponent(cycleKey)}/detail`;
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path, 'Load AIO Cycles');
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    return normalizeCycle((await response.json()) as RawCycle, projectKey);
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    throw new ApiError('Cycle not found', 404, 'jira');
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}

/**
 * Fetch the folder tree for a project.
 * GET /rest/aio-tcms/1.0/project/{jiraProjectId}/testcycle/folder (probe A1)
 * @returns Array of root AioFolder nodes (with nested children); empty array on 404
 * @throws ApiError 401 on auth failure
 * @throws Error on network failure
 */
export async function fetchAioFolderTree(
  baseUrl: string,
  token: string,
  jiraProjectId: number,
): Promise<AioFolder[]> {
  const path = `/project/${jiraProjectId}/testcycle/folder`;
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path, 'Load AIO Cycles', AIO_PROJECTS_API_PATH);
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    return (await response.json()) as AioFolder[];
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    return [];
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}

/**
 * Fetch per-folder cycle counts for a project.
 * GET /rest/aio-tcms/1.0/project/{jiraProjectId}/testcycle/folder/count?archive=false (probe A2)
 * Keys are folder ID strings; key "-1" = ungrouped cycles.
 * @returns Record<string, number>; empty object on 404
 * @throws ApiError 401 on auth failure
 * @throws Error on network failure
 */
export async function fetchAioFolderCycleCounts(
  baseUrl: string,
  token: string,
  jiraProjectId: number,
): Promise<Record<string, number>> {
  const path = `/project/${jiraProjectId}/testcycle/folder/count?archive=false`;
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path, 'Load AIO Cycles', AIO_PROJECTS_API_PATH);
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    return (await response.json()) as Record<string, number>;
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    return {};
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}

/**
 * Fetch paged cycle list with detail for a project.
 * GET /rest/aio-tcms/1.0/project/{jiraProjectId}/testcycle/paged?c_pId={id}&t={ts}
 * Live UAT: folderID param causes 500; t (timestamp) is required — omitting it causes 405.
 * Real AIO web UI always sends c_pId and t together.
 * @returns AioCycleDetailPagedResponse; empty paged envelope on 404
 * @throws ApiError 401 on auth failure
 * @throws Error on network failure
 */
const PAGED_COLUMNS = ['key', 'title', 'ownedByID', 'caseProgress', 'jiraComponentID'];
const PAGED_SORTING = {
  sortColumn: 'key',
  sortOrder: 'ASC',
  jiraComponents: [],
  jiraReleases: [],
  customFieldID: null,
  customFieldType: null,
};

export async function fetchAioCyclesWithDetail(
  baseUrl: string,
  token: string,
  jiraProjectId: number,
  folderIds?: number[],
): Promise<AioCycleDetailPagedResponse> {
  const path = `/project/${jiraProjectId}/testcycle/paged?c_pId=${jiraProjectId}&t=${Date.now()}`;
  const bodyObj: Record<string, unknown> = {
    startAt: 0,
    maxResults: 500,
    columns: PAGED_COLUMNS,
    customFields: [],
    runCustomFields: [],
    sortingData: PAGED_SORTING,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  if (folderIds && folderIds.length > 0) {
    bodyObj.folderID = { comparisonType: 'IN', list: folderIds };
  }
  const body = JSON.stringify(bodyObj);
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path, 'Load AIO Cycles', AIO_PROJECTS_API_PATH, { method: 'POST', body });
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    return (await response.json()) as AioCycleDetailPagedResponse;
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    return { items: [], allIDs: [], startAt: 0, maxResults: 0, isLast: true };
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}

/**
 * Fetch all cycle summaries (including testRunDistribution) for a project.
 * GET /rest/aio-tcms/1.0/project/{jiraProjectId}/testcycle/summary/paged (probe A3)
 * A3 confirmed: single GET returns all summaries — no ids param needed.
 * @returns AioCycleSummaryItem[]; empty array on 404
 * @throws ApiError 401 on auth failure
 * @throws Error on network failure
 */
export async function fetchAioCycleSummaries(
  baseUrl: string,
  token: string,
  jiraProjectId: number,
  cycleIds: number[],
): Promise<AioCycleSummaryItem[]> {
  const path = `/project/${jiraProjectId}/testcycle/summary/paged?c_pId=${jiraProjectId}&t=${Date.now()}`;
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path, 'Load AIO Cycles', AIO_PROJECTS_API_PATH, {
      method: 'POST',
      body: JSON.stringify(cycleIds),
    });
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    return (await response.json()) as AioCycleSummaryItem[];
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    return [];
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}

// Raw shape from POST /testcasewithrun/paged
type RawTestCaseWithRun = {
  ID?: number;
  test?: {
    detail?: {
      key?: string;
      title?: string;
    };
  };
  latestTestRun?: {
    ID?: number;
    testRunStatusID?: number;
    allDefects?: number[];
    updatedDate?: number;
  };
  assignedToID?: string;
  runCount?: number;
};

// Maps numeric AIO testRunStatusID to chip status string
const TESTCASE_STATUS_MAP: Record<number, string> = {
  53: 'PASS',
  901: 'PASS',
  54: 'FAIL',
  55: 'BLOCKED',
};

function chipStatusFromId(id: number | undefined): string {
  return TESTCASE_STATUS_MAP[id ?? 0] ?? 'NOT_EXECUTED';
}

const TESTCASE_COLUMNS = ['rank', 'key', 'title', 'testRunStatusID', 'defectCount'];
const TESTCASE_SORTING = {
  sortColumn: 'rank',
  sortOrder: 'ASC',
  jiraComponents: [],
  jiraReleases: [],
  customFieldID: null,
  customFieldType: null,
};

/**
 * Fetch test cases with their latest run for a single cycle via the fast paged endpoint.
 * POST /rest/aio-tcms/1.0/project/{jiraProjectId}/testcycle/{cycleNumericId}/testcasewithrun/paged
 * Returns all test cases in a single request (maxResults: 500).
 * @returns AioTestRun[]; empty array on 404
 * @throws ApiError 401 on auth failure
 * @throws Error on network failure
 */
export async function fetchAioCycleTestCasesWithRuns(
  baseUrl: string,
  token: string,
  jiraProjectId: number,
  cycleNumericId: number,
  cycleKey: string,
): Promise<import('./types').AioTestRun[]> {
  const path = `/project/${jiraProjectId}/testcycle/${cycleNumericId}/testcasewithrun/paged?c_pId=${jiraProjectId}&t=${Date.now()}`;
  const body = JSON.stringify({
    startAt: 0,
    maxResults: 500,
    columns: TESTCASE_COLUMNS,
    customFields: [],
    runCustomFields: [],
    cycleID: { comparisonType: 'IN', list: [cycleNumericId] },
    testCycleCases: true,
    groupByFolder: false,
    groupBySet: false,
    filteredFromSegment: false,
    includeComments: false,
    includeAttachments: false,
    sortingData: TESTCASE_SORTING,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path, 'Load AIO Cycles', AIO_PROJECTS_API_PATH, { method: 'POST', body });
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    const data = (await response.json()) as { items?: RawTestCaseWithRun[] };
    return (data.items ?? []).map((item) => {
      const updatedDate = item.latestTestRun?.updatedDate;
      const isoDate = updatedDate != null ? new Date(updatedDate).toISOString() : undefined;
      return {
        id: String(item.latestTestRun?.ID ?? ''),
        status: chipStatusFromId(item.latestTestRun?.testRunStatusID),
        testCaseKey: item.test?.detail?.key ?? '',
        cycleKey,
        testCase: {
          title: item.test?.detail?.title ?? '',
          updatedDate: isoDate,
        },
        defects: [],
        jiraDefectIDs: item.latestTestRun?.allDefects ?? [],
        executedDate: isoDate,
        assignedToID: item.assignedToID,
        runCount: item.runCount,
      };
    });
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    return [];
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}

/**
 * Fetch project config — extracts testRunStatus entries for dynamic status ID mapping.
 * GET /rest/aio-tcms/1.0/project/{jiraProjectId}/config?c_pId={id}&t={ts}
 * @returns AioTestRunStatusConfig[]; empty array on 404
 * @throws ApiError 401 on auth failure
 * @throws Error on network failure
 */
export async function fetchAioProjectConfig(
  baseUrl: string,
  token: string,
  jiraProjectId: number,
): Promise<AioTestRunStatusConfig[]> {
  const path = `/project/${jiraProjectId}/config?c_pId=${jiraProjectId}&t=${Date.now()}`;
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path, 'Load AIO Cycles', AIO_PROJECTS_API_PATH);
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    const data = (await response.json()) as { testRunStatus?: AioTestRunStatusConfig[] };
    return data.testRunStatus ?? [];
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    return [];
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}
