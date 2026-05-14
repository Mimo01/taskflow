import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { fetchAioCycles } from './cycles';
import {
  fetchAioCycleSummaries,
  fetchAioCyclesWithDetail,
  fetchAioFolderCycleCounts,
  fetchAioFolderTree,
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
      { key: 'PROJ-CY-2', name: 'Sprint 1', status: 'Active', projectKey: 'PROJ', folder: 'Active' },
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
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns AioFolder[] on 200', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { ID: 1, name: 'Root', parentID: null, children: [] },
      ],
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
    await expect(fetchAioFolderTree(BASE, TOKEN, PROJECT_ID)).rejects.toThrow('Cannot reach AIO at');
  });
});

describe('fetchAioFolderCycleCounts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

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
  beforeEach(() => { vi.clearAllMocks(); });

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
            detail: { key: 'PROJ-CY-1', title: 'Cycle A', ownedByID: 'user1', folder: null, isClosed: false },
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

  it('includes c_pId query param in URL', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], allIDs: [], startAt: 0, maxResults: 20, total: 0, isLast: true, additionalData: {} }),
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
  beforeEach(() => { vi.clearAllMocks(); });

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
    const result = await fetchAioCycleSummaries(BASE, TOKEN, PROJECT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].ID).toBe(1001);
    expect(result[0].summary.totalTests).toBe(261);
    expect(result[0].summary.testRunDistribution['53']).toBe(228);
  });

  it('returns [] on 404', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const result = await fetchAioCycleSummaries(BASE, TOKEN, PROJECT_ID);
    expect(result).toEqual([]);
  });

  it('throws ApiError on 401', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAioCycleSummaries(BASE, TOKEN, PROJECT_ID)).rejects.toMatchObject({
      status: 401,
      source: 'jira',
    });
  });

  it('throws "Cannot reach AIO" on network error', async () => {
    mockedApiFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchAioCycleSummaries(BASE, TOKEN, PROJECT_ID)).rejects.toThrow('Cannot reach AIO at');
  });
});
