import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { fetchAioProjects } from './projects';

const mockedApiFetch = vi.mocked(apiFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';

describe('fetchAioProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns project list on 200', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 1, projectKey: 'PROJ', name: 'Project Alpha' }],
    } as unknown as Response);

    const result = await fetchAioProjects(BASE, TOKEN);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Project Alpha');
    expect(result[0].projectKey).toBe('PROJ');
  });

  it('throws ApiError with "Invalid token or token has expired" on 401', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAioProjects(BASE, TOKEN)).rejects.toThrow(
      'Invalid token or token has expired',
    );
  });

  it('returns empty array on 404', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const result = await fetchAioProjects(BASE, TOKEN);
    expect(result).toEqual([]);
  });

  it('throws "Cannot reach AIO" on network error', async () => {
    mockedApiFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchAioProjects(BASE, TOKEN)).rejects.toThrow('Cannot reach AIO');
  });
});
