import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import {
  fetchAioCycleDetail,
  fetchAioCycleSummaries,
  fetchAioCycles,
  fetchAioCyclesInFolders,
  fetchAioCyclesWithDetail,
  fetchAioCycleTestCasesWithRuns,
  fetchAioFolderCycleCounts,
  fetchAioFolderTree,
  fetchAioProjectConfig,
  fetchAioUngroupedCycles,
  normalizeCustomFields,
} from './cycles';

const mockedApiFetch = vi.mocked(apiFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const PROJECT_KEY = 'PROJ';

describe('fetchAioCycles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns AioCycle[] on 200 with paginated AioPage wrapper', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ key: 'PROJ-CY-2', name: 'Sprint 1', status: 'Active', projectKey: 'PROJ' }],
        startAt: 0,
        maxResults: 50,
        isLast: true,
      }),
    } as unknown as Response);
    const result = await fetchAioCycles(BASE, TOKEN, PROJECT_KEY);
    expect(result).toEqual([
      {
        key: 'PROJ-CY-2',
        name: 'Sprint 1',
        status: 'Active',
        projectKey: 'PROJ',
        folder: 'Active',
      },
    ]);
  });

  it('accumulates items across multiple pages until isLast is true', async () => {
    mockedApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ key: 'PROJ-CY-1', name: 'Page 1', status: 'Closed', projectKey: 'PROJ' }],
          startAt: 0,
          maxResults: 1,
          isLast: false,
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ key: 'PROJ-CY-2', name: 'Page 2', status: 'Active', projectKey: 'PROJ' }],
          startAt: 1,
          maxResults: 1,
          isLast: true,
        }),
      } as unknown as Response);
    const result = await fetchAioCycles(BASE, TOKEN, PROJECT_KEY);
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('PROJ-CY-1');
    expect(result[1].key).toBe('PROJ-CY-2');
  });

  it('throws ApiError with source "jira" on 401', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAioCycles(BASE, TOKEN, PROJECT_KEY)).rejects.toMatchObject({
      status: 401,
      source: 'jira',
    });
  });

  it('returns empty array on 404 (project not found or no cycles)', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const result = await fetchAioCycles(BASE, TOKEN, PROJECT_KEY);
    expect(result).toEqual([]);
  });

  it('throws "Cannot reach AIO" on network error (aioFetch throws)', async () => {
    mockedApiFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchAioCycles(BASE, TOKEN, PROJECT_KEY)).rejects.toThrow('Cannot reach AIO at');
  });
});

const PROJECT_ID = 10134;

// RED stubs — Phase 57 Wave 0. These fail until Plan 02 adds the exports.

describe('fetchAioFolderTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns AioFolder[] on 200', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ ID: 1, name: 'Root', parentID: null, children: [] }],
    } as unknown as Response);
    const result = await fetchAioFolderTree(BASE, TOKEN, PROJECT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].ID).toBe(1);
    expect(result[0].name).toBe('Root');
  });

  it('returns [] on 404', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const result = await fetchAioFolderTree(BASE, TOKEN, PROJECT_ID);
    expect(result).toEqual([]);
  });

  it('throws ApiError on 401', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAioFolderTree(BASE, TOKEN, PROJECT_ID)).rejects.toMatchObject({
      status: 401,
      source: 'jira',
    });
  });

  it('throws "Cannot reach AIO" on network error', async () => {
    mockedApiFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchAioFolderTree(BASE, TOKEN, PROJECT_ID)).rejects.toThrow(
      'Cannot reach AIO at',
    );
  });
});

describe('fetchAioFolderCycleCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Record<string, number> on 200 including "-1" key for ungrouped', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ '-1': 3, '101': 7 }),
    } as unknown as Response);
    const result = await fetchAioFolderCycleCounts(BASE, TOKEN, PROJECT_ID);
    expect(result['-1']).toBe(3);
    expect(result['101']).toBe(7);
  });

  it('returns {} on 404', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const result = await fetchAioFolderCycleCounts(BASE, TOKEN, PROJECT_ID);
    expect(result).toEqual({});
  });

  it('throws ApiError on 401', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAioFolderCycleCounts(BASE, TOKEN, PROJECT_ID)).rejects.toMatchObject({
      status: 401,
      source: 'jira',
    });
  });
});

describe('fetchAioCyclesWithDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paged response with items and allIDs on 200', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            ID: 1001,
            jiraProjectID: PROJECT_ID,
            permission: { value: 15 },
            detail: {
              key: 'PROJ-CY-1',
              title: 'Cycle A',
              ownedByID: 'user1',
              folder: null,
              isClosed: false,
            },
            summary: null,
            objectiveAttachments: [],
          },
        ],
        allIDs: [1001],
        startAt: 0,
        maxResults: 20,
        total: 1,
        isLast: true,
        additionalData: {},
      }),
    } as unknown as Response);
    const result = await fetchAioCyclesWithDetail(BASE, TOKEN, PROJECT_ID);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].ID).toBe(1001);
    expect(result.items[0].detail.key).toBe('PROJ-CY-1');
    expect(result.allIDs).toEqual([1001]);
    expect(result.isLast).toBe(true);
  });

  const mkItem = (ID: number) => ({
    ID,
    jiraProjectID: PROJECT_ID,
    detail: { key: `PROJ-CY-${ID}`, title: 'c', ownedByID: 'u', folder: null, isClosed: false },
    summary: null,
  });

  it('pages until isLast, advancing startAt by the items returned', async () => {
    mockedApiFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [mkItem(1), mkItem(2)],
          allIDs: [1, 2, 3],
          startAt: 0,
          maxResults: 500,
          isLast: false,
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [mkItem(3)],
          allIDs: [9],
          startAt: 2,
          maxResults: 500,
          isLast: true,
        }),
      } as unknown as Response);
    const result = await fetchAioCyclesWithDetail(BASE, TOKEN, PROJECT_ID);
    expect(result.items).toHaveLength(3);
    expect(result.allIDs).toEqual([1, 2, 3]);
    expect(result.isLast).toBe(true);
    expect(mockedApiFetch).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(
      (vi.mocked(apiFetch).mock.calls[1][2] as { body: string }).body,
    ) as { startAt: number };
    expect(secondBody.startAt).toBe(2);
  });

  it('stops when a page adds no new IDs (server ignoring startAt)', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [mkItem(1)],
        allIDs: [1],
        startAt: 0,
        maxResults: 500,
        isLast: false,
      }),
    } as unknown as Response);
    const result = await fetchAioCyclesWithDetail(BASE, TOKEN, PROJECT_ID);
    expect(result.items).toHaveLength(1);
    expect(mockedApiFetch).toHaveBeenCalledTimes(2);
  });

  it('stops on an empty page', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], allIDs: [], startAt: 0, maxResults: 500, isLast: false }),
    } as unknown as Response);
    const result = await fetchAioCyclesWithDetail(BASE, TOKEN, PROJECT_ID);
    expect(result.items).toEqual([]);
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
  });

  it('requests startDate and endDate columns', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], allIDs: [], startAt: 0, maxResults: 0, isLast: true }),
    } as unknown as Response);
    await fetchAioCyclesWithDetail(BASE, TOKEN, PROJECT_ID);
    const body = JSON.parse((vi.mocked(apiFetch).mock.calls[0][2] as { body: string }).body) as {
      columns: string[];
    };
    expect(body.columns).toEqual(expect.arrayContaining(['startDate', 'endDate']));
  });

  it('includes c_pId query param in URL', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        allIDs: [],
        startAt: 0,
        maxResults: 20,
        total: 0,
        isLast: true,
        additionalData: {},
      }),
    } as unknown as Response);
    await fetchAioCyclesWithDetail(BASE, TOKEN, PROJECT_ID);
    const calledUrl = vi.mocked(apiFetch).mock.calls[0][1] as string;
    expect(calledUrl).toContain(`c_pId=${PROJECT_ID}`);
  });

  it('returns empty response on 404', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const result = await fetchAioCyclesWithDetail(BASE, TOKEN, PROJECT_ID);
    expect(result.items).toEqual([]);
    expect(result.allIDs).toEqual([]);
  });

  it('throws ApiError on 401', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAioCyclesWithDetail(BASE, TOKEN, PROJECT_ID)).rejects.toMatchObject({
      status: 401,
      source: 'jira',
    });
  });
});

describe('fetchAioCycleSummaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns AioCycleSummaryItem[] on 200', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          ID: 1001,
          jiraProjectID: PROJECT_ID,
          detail: null,
          summary: { totalTests: 261, testRunDistribution: { '53': 228, '901': 30, '54': 3 } },
          objectiveAttachments: [],
        },
      ],
    } as unknown as Response);
    const result = await fetchAioCycleSummaries(BASE, TOKEN, PROJECT_ID, [1001]);
    expect(result).toHaveLength(1);
    expect(result[0].ID).toBe(1001);
    expect(result[0].summary.totalTests).toBe(261);
    expect(result[0].summary.testRunDistribution['53']).toBe(228);
  });

  it('returns [] on 404', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const result = await fetchAioCycleSummaries(BASE, TOKEN, PROJECT_ID, []);
    expect(result).toEqual([]);
  });

  it('throws ApiError on 401', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAioCycleSummaries(BASE, TOKEN, PROJECT_ID, [])).rejects.toMatchObject({
      status: 401,
      source: 'jira',
    });
  });

  it('throws "Cannot reach AIO" on network error', async () => {
    mockedApiFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchAioCycleSummaries(BASE, TOKEN, PROJECT_ID, [])).rejects.toThrow(
      'Cannot reach AIO at',
    );
  });
});

describe('fetchAioProjectConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns AioTestRunStatusConfig[] from testRunStatus on 200', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        testRunStatus: [
          { ID: 53, name: 'Passed', statusType: 'pass', color: '#75B000' },
          { ID: 51, name: 'Failed', statusType: 'fail', color: '#D0021B' },
        ],
      }),
    } as unknown as Response);

    const result = await fetchAioProjectConfig(BASE, TOKEN, PROJECT_ID);
    expect(result).toHaveLength(2);
    expect(result[0].ID).toBe(53);
    expect(result[0].statusType).toBe('pass');
    expect(result[1].ID).toBe(51);
  });

  it('returns [] when testRunStatus is absent from response', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as unknown as Response);

    const result = await fetchAioProjectConfig(BASE, TOKEN, PROJECT_ID);
    expect(result).toEqual([]);
  });

  it('returns [] on 404', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const result = await fetchAioProjectConfig(BASE, TOKEN, PROJECT_ID);
    expect(result).toEqual([]);
  });

  it('throws ApiError on 401', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAioProjectConfig(BASE, TOKEN, PROJECT_ID)).rejects.toMatchObject({
      status: 401,
      source: 'jira',
    });
  });

  it('throws "Cannot reach AIO" on network error', async () => {
    mockedApiFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchAioProjectConfig(BASE, TOKEN, PROJECT_ID)).rejects.toThrow(
      'Cannot reach AIO at',
    );
  });
});

describe('fetchAioCycleTestCasesWithRuns — TESTCASE_STATUS_MAP (CLEAN-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const runWithStatusId = async (testRunStatusID: number | undefined) => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            latestTestRun: { ID: 1, testRunStatusID },
            test: { detail: { key: 'PROJ-TC-1', title: 'Login flow' } },
          },
        ],
      }),
    } as unknown as Response);
    const result = await fetchAioCycleTestCasesWithRuns(BASE, TOKEN, 10001, 42, 'PROJ-CY-1');
    return result[0]?.status;
  };

  it('maps testRunStatusID 52 to IN_PROGRESS (not bucketed as NOT_EXECUTED)', async () => {
    expect(await runWithStatusId(52)).toBe('IN_PROGRESS');
  });

  it('maps testRunStatusID 51 to NOT_EXECUTED', async () => {
    expect(await runWithStatusId(51)).toBe('NOT_EXECUTED');
  });

  it('falls back to NOT_EXECUTED for an unmapped/absent status id', async () => {
    expect(await runWithStatusId(undefined)).toBe('NOT_EXECUTED');
  });
});

describe('fetchAioUngroupedCycles', () => {
  const item = (ID: number) => ({
    ID,
    jiraProjectID: PROJECT_ID,
    detail: {
      key: `PROJ-CY-${ID}`,
      title: `C${ID}`,
      ownedByID: 'u',
      folder: null,
      isClosed: false,
      startDate: null,
      endDate: null,
    },
    summary: null,
  });
  const page = (ids: number[]) =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        items: ids.map(item),
        allIDs: ids,
        startAt: 0,
        maxResults: 500,
        isLast: true,
      }),
    }) as unknown as Response;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cycles not in any folder (never sends folderID -1)', async () => {
    mockedApiFetch.mockImplementation(async (...args: unknown[]) => {
      const body = JSON.parse((args[2] as { body: string }).body);
      return body.folderID ? page([1, 2]) : page([1, 2, 3, 4]);
    });
    const result = await fetchAioUngroupedCycles(BASE, TOKEN, PROJECT_ID, [101, 102]);
    expect(result.items.map((c) => c.ID)).toEqual([3, 4]);
    expect(result.allIDs).toEqual([3, 4]);
    const bodies = mockedApiFetch.mock.calls.map((c) =>
      JSON.parse((c[2] as { body: string }).body),
    );
    expect(bodies.some((b) => b.folderID?.list?.includes(-1))).toBe(false);
    expect(bodies.find((b) => b.folderID)?.folderID.list).toEqual([101, 102]);
  });

  it('returns every cycle when the project has no folders', async () => {
    mockedApiFetch.mockResolvedValue(page([1, 2]));
    const result = await fetchAioUngroupedCycles(BASE, TOKEN, PROJECT_ID, []);
    expect(result.items.map((c) => c.ID)).toEqual([1, 2]);
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
  });
});

describe('fetchAioCyclesInFolders', () => {
  const item = (ID: number) => ({
    ID,
    jiraProjectID: PROJECT_ID,
    detail: {
      key: `PROJ-CY-${ID}`,
      title: `C${ID}`,
      ownedByID: 'u',
      folder: null,
      isClosed: false,
      startDate: null,
      endDate: null,
    },
    summary: null,
  });
  const page = (ids: number[]) =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        items: ids.map(item),
        allIDs: ids,
        startAt: 0,
        maxResults: 500,
        isLast: true,
      }),
    }) as unknown as Response;
  const byFolder: Record<number, number[]> = { 101: [1, 2], 102: [3], 103: [2, 4] };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedApiFetch.mockImplementation(async (...args: unknown[]) => {
      const body = JSON.parse((args[2] as { body: string }).body);
      return page(byFolder[body.folderID.list[0]] ?? []);
    });
  });

  it('queries each folder on its own and merges without duplicates', async () => {
    const result = await fetchAioCyclesInFolders(BASE, TOKEN, PROJECT_ID, [101, 102, 103]);
    expect(result.items.map((c) => c.ID)).toEqual([1, 2, 3, 4]);
    expect(result.allIDs).toEqual([1, 2, 3, 4]);
    const lists = mockedApiFetch.mock.calls.map(
      (c) => JSON.parse((c[2] as { body: string }).body).folderID.list,
    );
    expect(lists).toEqual([[101], [102], [103]]);
  });

  it('caps requests in flight at the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    mockedApiFetch.mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return page([]);
    });
    await fetchAioCyclesInFolders(BASE, TOKEN, PROJECT_ID, [1, 2, 3, 4, 5], 2);
    expect(peak).toBe(2);
    expect(mockedApiFetch).toHaveBeenCalledTimes(5);
  });
});

// Fixtures below mirror the LIVE probe shapes in 261013-mnc-PROBE-RESULTS.md (P1/P2).
describe('fetchAioCycleDetail — live P1 /detail shape (normalizeCycle)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const P1_FIXTURE = {
    ID: 1011,
    key: 'SHOP-CY-1011',
    title: 'Regression 4.2',
    ownedByID: 'ext94772',
    startDate: 1777759200000,
    endDate: 1778450400000,
    createdDate: 1777700000000,
    updatedDate: 1778000000000,
    closedDate: 1778100000000,
    closedByID: 'ext11111',
    isClosed: true,
    folder: { ID: 10763, name: 'Releases', parentID: 10700 },
    jiraProjectID: 10001,
    jiraReleaseID: 5,
    jiraReleaseIDs: [5],
    jiraTaskIDs: ['186227', '186228'],
    customFields: [
      { ID: 1, name: 'Cycle-Device_Type', value: { ID: 1, value: 'Web' } },
      {
        ID: 2,
        name: 'Cycle-Browser',
        value: [
          { ID: 2, value: 'Chrome' },
          { ID: 3, value: 'Firefox' },
        ],
      },
      { ID: 3, name: 'Cycle-Environment', value: [] },
    ],
  };

  it('maps owner, epoch-ms dates, ids and normalised custom fields', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => P1_FIXTURE,
    } as unknown as Response);
    const cycle = await fetchAioCycleDetail(BASE, TOKEN, 'SHOP', 'SHOP-CY-1011');
    expect(cycle.ownedByID).toBe('ext94772');
    expect(cycle.startDate).toBe(1777759200000);
    expect(cycle.endDate).toBe(1778450400000);
    expect(cycle.createdDate).toBe(1777700000000);
    expect(cycle.updatedDate).toBe(1778000000000);
    expect(cycle.closedDate).toBe(1778100000000);
    expect(cycle.closedByID).toBe('ext11111');
    expect(cycle.jiraProjectID).toBe(10001);
    expect(cycle.jiraTaskIDs).toEqual(['186227', '186228']);
    expect(cycle.jiraReleaseIDs).toEqual([5]);
    expect(cycle.status).toBe('Closed');
    expect(cycle.folder).toBe('Releases');
    expect(cycle.customFields).toEqual([
      { name: 'Device_Type', value: 'Web' },
      { name: 'Browser', value: 'Chrome, Firefox' },
    ]);
  });
});

describe('normalizeCustomFields', () => {
  it('handles object, array and empty value shapes without String(object)', () => {
    expect(
      normalizeCustomFields([
        { name: 'A', value: { ID: 1, value: 'x' } },
        {
          name: 'B',
          value: [
            { ID: 1, value: 'y' },
            { ID: 2, value: 'z' },
          ],
        },
        { name: 'C', value: [] },
        { name: 'D', value: null },
        { name: 'E', value: '' },
        { name: 'F', value: 'plain' },
      ]),
    ).toEqual([
      { name: 'A', value: 'x' },
      { name: 'B', value: 'y, z' },
      { name: 'F', value: 'plain' },
    ]);
  });

  it('returns [] for non-array input', () => {
    expect(normalizeCustomFields(undefined)).toEqual([]);
  });
});

describe('fetchAioCycleTestCasesWithRuns — live P2 shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps executedByID, createdDate and assignmentDate; executedDate is ISO of latestTestRun.updatedDate', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            ID: 7,
            assignedToID: 'ext94772',
            assignmentDate: 1777800000000,
            runCount: 3,
            rankOrder: 1,
            latestTestRun: {
              ID: 555,
              createdDate: 1777900000000,
              updatedDate: 1778000000000,
              executedByID: 'ext11111',
              testRunStatusID: 901,
              allDefects: [186300],
              jiraProjectID: 10001,
            },
            test: { ID: 9, detail: { key: 'SHOP-TC-5', title: 'Login', ownedByID: 'ext1' } },
          },
          {
            ID: 8,
            test: { detail: { key: 'SHOP-TC-6', title: 'No run yet' } },
          },
        ],
      }),
    } as unknown as Response);
    const [withRun, withoutRun] = await fetchAioCycleTestCasesWithRuns(
      BASE,
      TOKEN,
      10001,
      42,
      'SHOP-CY-1011',
    );
    expect(withRun.id).toBe('555');
    expect(withRun.status).toBe('PASS');
    expect(withRun.executedDate).toBe(new Date(1778000000000).toISOString());
    expect(withRun.createdDate).toBe(new Date(1777900000000).toISOString());
    expect(withRun.assignmentDate).toBe(new Date(1777800000000).toISOString());
    expect(withRun.executedByID).toBe('ext11111');
    expect(withoutRun.id).toBe('');
    expect(withoutRun.executedDate).toBeUndefined();
  });
});
