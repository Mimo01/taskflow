import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({
  greenhopperFetch: vi.fn(),
  GREENHOPPER_API_PATH: '/rest/greenhopper/1.0/xboard',
}));

import { greenhopperFetch } from './client';
import { fetchBacklogData } from './data';

const mockedGhFetch = vi.mocked(greenhopperFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const BOARD_ID = 42;

const minimalBacklogPayload = { issues: [] };

describe('fetchBacklogData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed response on 200', async () => {
    mockedGhFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => minimalBacklogPayload,
    } as unknown as Response);

    const result = await fetchBacklogData(BASE, TOKEN, BOARD_ID);
    expect(result.issues).toEqual([]);
  });

  it('calls greenhopperFetch with rapidViewId in backlog URL', async () => {
    mockedGhFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => minimalBacklogPayload,
    } as unknown as Response);

    await fetchBacklogData(BASE, TOKEN, BOARD_ID);
    expect(mockedGhFetch).toHaveBeenCalledWith(
      BASE,
      TOKEN,
      expect.stringContaining('rapidViewId=42'),
      expect.any(String),
    );
    // Must hit the backlog data endpoint, not allData
    expect(mockedGhFetch).toHaveBeenCalledWith(
      BASE,
      TOKEN,
      expect.stringContaining('/plan/backlog/data.json'),
      expect.any(String),
    );
  });

  it('throws ApiError with "Invalid token" on 401', async () => {
    mockedGhFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchBacklogData(BASE, TOKEN, BOARD_ID)).rejects.toThrow('Invalid token');
  });

  it('throws ApiError with "Invalid token" on 403', async () => {
    mockedGhFetch.mockResolvedValue({ ok: false, status: 403 } as unknown as Response);
    await expect(fetchBacklogData(BASE, TOKEN, BOARD_ID)).rejects.toThrow('Invalid token');
  });

  it('throws "Cannot reach" on network error', async () => {
    mockedGhFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchBacklogData(BASE, TOKEN, BOARD_ID)).rejects.toThrow('Cannot reach');
  });

  it('throws with status on other non-ok response', async () => {
    mockedGhFetch.mockResolvedValue({ ok: false, status: 500 } as unknown as Response);
    await expect(fetchBacklogData(BASE, TOKEN, BOARD_ID)).rejects.toThrow('500');
  });
});
