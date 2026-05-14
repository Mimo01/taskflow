import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));
vi.mock('../jira/issues', () => ({ fetchJiraIssueByKey: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { fetchJiraIssueByKey } from '../jira/issues';
import { fetchAioTestRunsForCycle } from './issue-runs';

const mockedApiFetch = vi.mocked(apiFetch);
const mockedFetchJiraIssueByKey = vi.mocked(fetchJiraIssueByKey);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const PROJECT_KEY = 'PROJ';
const CYCLE_KEY = 'PROJ-CY-2';

describe('fetchAioTestRunsForCycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no defect resolution needed unless test overrides
    mockedFetchJiraIssueByKey.mockResolvedValue(null);
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

  it('resolves jiraDefectIDs to string Jira keys in run.defects[]', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            ID: 101,
            runs: [{ jiraDefectIDs: [186227] }],
            testCase: { key: 'PROJ-TC-5', title: 'Login test' },
            cycleKey: CYCLE_KEY,
          },
        ],
        startAt: 0,
        maxResults: 50,
        isLast: true,
      }),
    } as unknown as Response);

    mockedFetchJiraIssueByKey.mockResolvedValue({
      key: 'PROJ-42',
      fields: {
        summary: 'Login button broken',
        status: { name: 'Open' },
        assignee: null,
        issuetype: { name: 'Bug' },
      },
    // biome-ignore lint/suspicious/noExplicitAny: test mock shape
    } as any);

    const result = await fetchAioTestRunsForCycle(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY);
    expect(result).toHaveLength(1);
    expect(result[0].defects).toEqual(['PROJ-42']);
    expect(mockedFetchJiraIssueByKey).toHaveBeenCalledWith(BASE, TOKEN, '186227');
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
    expect(mockedFetchJiraIssueByKey).not.toHaveBeenCalled();
  });

  it('gracefully skips defect resolution when fetchJiraIssueByKey returns null', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            ID: 103,
            runs: [{ jiraDefectIDs: [999999] }],
            testCase: { key: 'PROJ-TC-7', title: 'Payment test' },
            cycleKey: CYCLE_KEY,
          },
        ],
        startAt: 0,
        maxResults: 50,
        isLast: true,
      }),
    } as unknown as Response);

    // fetchJiraIssueByKey returns null (404 or network error)
    mockedFetchJiraIssueByKey.mockResolvedValue(null);

    const result = await fetchAioTestRunsForCycle(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY);
    expect(result).toHaveLength(1);
    expect(result[0].defects).toEqual([]);
    expect(mockedFetchJiraIssueByKey).toHaveBeenCalledWith(BASE, TOKEN, '999999');
  });
});
