import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { fetchAioCycles } from './cycles';

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
