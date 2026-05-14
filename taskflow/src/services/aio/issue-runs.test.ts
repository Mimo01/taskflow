import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { fetchAioTestRunsForCycle } from './issue-runs';

const mockedApiFetch = vi.mocked(apiFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const PROJECT_KEY = 'PROJ';
const CYCLE_KEY = 'PROJ-CY-2';

describe('fetchAioTestRunsForCycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns AioTestRun[] on 200 with paginated wrapper (items array)', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ id: 'r1', status: 'PASS', testCaseKey: 'PROJ-TC-1', cycleKey: CYCLE_KEY }],
        startAt: 0,
        maxResults: 50,
        isLast: true,
      }),
    } as unknown as Response);

    const result = await fetchAioTestRunsForCycle(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('PASS');
    expect(result[0].testCaseKey).toBe('PROJ-TC-1');
  });

  it('returns [] on 200 with empty items array', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], startAt: 0, maxResults: 50, isLast: true }),
    } as unknown as Response);

    const result = await fetchAioTestRunsForCycle(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY);
    expect(result).toEqual([]);
  });

  it('throws ApiError with "Invalid token or token has expired" on 401', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAioTestRunsForCycle(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY)).rejects.toThrow(
      'Invalid token or token has expired',
    );
  });

  it('returns empty array on 404', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const result = await fetchAioTestRunsForCycle(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY);
    expect(result).toEqual([]);
  });

  it('throws "Cannot reach AIO" on network error', async () => {
    mockedApiFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchAioTestRunsForCycle(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY)).rejects.toThrow(
      'Cannot reach AIO',
    );
  });
});
