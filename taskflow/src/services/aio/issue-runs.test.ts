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

  it('uses runs[0].ID as run.id (execution run ID, not assignment ID)', async () => {
    // The list endpoint returns test case assignment items where:
    //   raw.ID = assignment ID (e.g. 5000) — NOT usable for /testrun/{runId}
    //   raw.runs[0].ID = execution run ID (e.g. 184382) — required by the detail endpoint
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            ID: 5000, // assignment ID — must NOT be used as run.id
            runs: [
              {
                ID: 184382, // execution run ID — must be used as run.id
                testRunStatus: { name: 'Passed' },
              },
            ],
            testCase: { key: 'PROJ-TC-1', title: 'Login test' },
            cycleKey: CYCLE_KEY,
          },
        ],
        startAt: 0,
        maxResults: 50,
        isLast: true,
      }),
    } as unknown as Response);

    const result = await fetchAioTestRunsForCycle(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('184382');
    expect(result[0].status).toBe('PASS');
  });

  it('falls back to raw.ID when runs[] is absent (flat response shape)', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            ID: 99,
            testCase: { key: 'PROJ-TC-2', title: 'Checkout test' },
            cycleKey: CYCLE_KEY,
            status: 'PASS',
          },
        ],
        startAt: 0,
        maxResults: 50,
        isLast: true,
      }),
    } as unknown as Response);

    const result = await fetchAioTestRunsForCycle(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('99');
  });

  it('returns runs with defects: [] and jiraDefectIDs populated (no service-level Jira resolution)', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            ID: 101,
            runs: [{ jiraDefectIDs: [186227, 186228] }],
            testCase: { key: 'PROJ-TC-5', title: 'Login test' },
            cycleKey: CYCLE_KEY,
          },
        ],
        startAt: 0,
        maxResults: 50,
        isLast: true,
      }),
    } as unknown as Response);

    const result = await fetchAioTestRunsForCycle(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY);
    expect(result).toHaveLength(1);
    expect(result[0].defects).toEqual([]);
    expect(result[0].jiraDefectIDs).toEqual([186227, 186228]);
  });

  it('returns run with defects: [] when jiraDefectIDs is absent or empty', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            ID: 102,
            runs: [{ jiraDefectIDs: [] }],
            testCase: { key: 'PROJ-TC-6', title: 'Checkout test' },
            cycleKey: CYCLE_KEY,
          },
        ],
        startAt: 0,
        maxResults: 50,
        isLast: true,
      }),
    } as unknown as Response);

    const result = await fetchAioTestRunsForCycle(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY);
    expect(result).toHaveLength(1);
    expect(result[0].defects).toEqual([]);
  });
});
