/**
 * Tests for fetchAllJiraStatuses.
 *
 * Mirrors the mock-then-import pattern from greenhopper/transitions.test.ts.
 * Behavior cases per Phase 72 Plan 01 Task 2:
 *   - 200 success returns body unchanged
 *   - URL composed correctly (trailing slash stripped, bearer token + content-type)
 *   - 401 → ApiError; 403 → ApiError; 500 → generic Error with status in message
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import { fetchAllJiraStatuses } from './statuses';

const mockedFetch = vi.mocked(apiFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';

const samplePayload = [
  {
    id: '1',
    name: 'Open',
    statusCategory: { id: 2, key: 'new', name: 'To Do' },
  },
  {
    id: '3',
    name: 'In Progress',
    statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' },
  },
];

describe('fetchAllJiraStatuses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the parsed body unchanged on 200', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => samplePayload,
    } as unknown as Response);

    const result = await fetchAllJiraStatuses(BASE, TOKEN);
    expect(result).toEqual(samplePayload);
  });

  it('calls apiFetch with correct URL, bearer token, content-type, and "Load Statuses" op', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as unknown as Response);

    await fetchAllJiraStatuses(BASE, TOKEN);
    expect(mockedFetch).toHaveBeenCalledWith(
      'jira',
      `${BASE}/rest/api/2/status`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
      'Load Statuses',
    );
  });

  it('strips trailing slash from baseUrl when composing URL', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as unknown as Response);

    await fetchAllJiraStatuses('https://jira.example.com/', TOKEN);
    const calledUrl = mockedFetch.mock.calls[0][1] as string;
    expect(calledUrl).toBe('https://jira.example.com/rest/api/2/status');
    expect(calledUrl).not.toContain('.com//rest');
  });

  it('throws ApiError on 401', async () => {
    mockedFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAllJiraStatuses(BASE, TOKEN)).rejects.toBeInstanceOf(ApiError);
    await expect(fetchAllJiraStatuses(BASE, TOKEN)).rejects.toThrow(
      'Failed to fetch Jira statuses',
    );
  });

  it('throws ApiError on 403', async () => {
    mockedFetch.mockResolvedValue({ ok: false, status: 403 } as unknown as Response);
    await expect(fetchAllJiraStatuses(BASE, TOKEN)).rejects.toBeInstanceOf(ApiError);
  });

  it('throws generic Error containing status on 500', async () => {
    mockedFetch.mockResolvedValue({ ok: false, status: 500 } as unknown as Response);
    await expect(fetchAllJiraStatuses(BASE, TOKEN)).rejects.toThrow('500');
  });
});
