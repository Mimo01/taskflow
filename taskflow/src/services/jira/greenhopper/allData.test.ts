import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({
  greenhopperFetch: vi.fn(),
  GREENHOPPER_API_PATH: '/rest/greenhopper/1.0/xboard',
}));

import { fetchAllData } from './allData';
import { greenhopperFetch } from './client';

const mockedGhFetch = vi.mocked(greenhopperFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const BOARD_ID = 42;

const minimalAllDataPayload = {
  rapidViewId: 42,
  statistics: { fieldConfigured: false, typeId: '', id: '', name: '' },
  entityData: { statuses: {}, priorities: {}, types: {}, epics: {} },
  columnsData: { rapidViewId: 42, columns: [] },
  swimlanesData: {
    rapidViewId: 42,
    swimlaneStrategy: '',
    parentSwimlanesData: {
      parentIssueIds: [],
      inprogressCandidates: [],
      doneCandidates: [],
    },
  },
  issuesData: { rapidViewId: 42, activeFilters: [], issues: [] },
};

describe('fetchAllData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed response on 200', async () => {
    mockedGhFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => minimalAllDataPayload,
    } as unknown as Response);

    const result = await fetchAllData(BASE, TOKEN, BOARD_ID);
    expect(result.rapidViewId).toBe(42);
    expect(result.entityData).toBeDefined();
  });

  it('calls greenhopperFetch with rapidViewId in URL', async () => {
    mockedGhFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => minimalAllDataPayload,
    } as unknown as Response);

    await fetchAllData(BASE, TOKEN, BOARD_ID);
    expect(mockedGhFetch).toHaveBeenCalledWith(
      BASE,
      TOKEN,
      expect.stringContaining('rapidViewId=42'),
      expect.any(String),
    );
  });

  it('throws ApiError with "Invalid token" on 401', async () => {
    mockedGhFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAllData(BASE, TOKEN, BOARD_ID)).rejects.toThrow('Invalid token');
  });

  it('throws ApiError with "Invalid token" on 403', async () => {
    mockedGhFetch.mockResolvedValue({ ok: false, status: 403 } as unknown as Response);
    await expect(fetchAllData(BASE, TOKEN, BOARD_ID)).rejects.toThrow('Invalid token');
  });

  it('throws "Cannot reach" on network error', async () => {
    mockedGhFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchAllData(BASE, TOKEN, BOARD_ID)).rejects.toThrow('Cannot reach');
  });

  it('throws with status on other non-ok response', async () => {
    mockedGhFetch.mockResolvedValue({ ok: false, status: 500 } as unknown as Response);
    await expect(fetchAllData(BASE, TOKEN, BOARD_ID)).rejects.toThrow('500');
  });
});
