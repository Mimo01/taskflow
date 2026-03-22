import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWatchers, addWatcher, removeWatcher } from './jira-watchers';

// Mock apiFetch
const mockApiFetch = vi.fn();
vi.mock('../lib/apiFetch', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

// Import ApiError after mocks
import { ApiError } from '../lib/api-error';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const ISSUE = 'TEST-123';

function mockResponse(status: number, data?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

beforeEach(() => {
  mockApiFetch.mockReset();
});

describe('fetchWatchers', () => {
  it('returns isWatching and watchCount from GET response', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(200, { isWatching: true, watchCount: 3, watchers: [] }));
    const result = await fetchWatchers(BASE, TOKEN, ISSUE);
    expect(result).toEqual({ isWatching: true, watchCount: 3 });
    expect(mockApiFetch).toHaveBeenCalledWith(
      'jira',
      `${BASE}/rest/api/2/issue/${ISSUE}/watchers`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
      'Load Issue Detail',
    );
  });

  it('defaults to false/0 when fields are missing', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(200, {}));
    const result = await fetchWatchers(BASE, TOKEN, ISSUE);
    expect(result).toEqual({ isWatching: false, watchCount: 0 });
  });

  it('throws ApiError on 401', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(401));
    await expect(fetchWatchers(BASE, TOKEN, ISSUE)).rejects.toThrow(ApiError);
  });

  it('throws ApiError on 403', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(403));
    await expect(fetchWatchers(BASE, TOKEN, ISSUE)).rejects.toThrow(ApiError);
  });
});

describe('addWatcher', () => {
  it('sends POST with JSON.stringify(username) as raw body', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(204));
    await addWatcher(BASE, TOKEN, ISSUE, 'bob');
    expect(mockApiFetch).toHaveBeenCalledWith(
      'jira',
      `${BASE}/rest/api/2/issue/${ISSUE}/watchers`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify('bob'), // should be '"bob"', NOT '{"name":"bob"}'
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        }),
      }),
      'Watch Issue',
    );
  });

  it('throws ApiError on 401', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(401));
    await expect(addWatcher(BASE, TOKEN, ISSUE, 'bob')).rejects.toThrow(ApiError);
  });

  it('throws ApiError on 403', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(403));
    await expect(addWatcher(BASE, TOKEN, ISSUE, 'bob')).rejects.toThrow(ApiError);
  });
});

describe('removeWatcher', () => {
  it('sends DELETE with ?username= query param', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(204));
    await removeWatcher(BASE, TOKEN, ISSUE, 'bob');
    expect(mockApiFetch).toHaveBeenCalledWith(
      'jira',
      `${BASE}/rest/api/2/issue/${ISSUE}/watchers?username=${encodeURIComponent('bob')}`,
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
      'Unwatch Issue',
    );
  });

  it('encodes special characters in username', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(204));
    await removeWatcher(BASE, TOKEN, ISSUE, 'user@domain.com');
    expect(mockApiFetch).toHaveBeenCalledWith(
      'jira',
      expect.stringContaining(`?username=${encodeURIComponent('user@domain.com')}`),
      expect.anything(),
      'Unwatch Issue',
    );
  });

  it('throws ApiError on 401', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(401));
    await expect(removeWatcher(BASE, TOKEN, ISSUE, 'bob')).rejects.toThrow(ApiError);
  });

  it('throws ApiError on 403', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(403));
    await expect(removeWatcher(BASE, TOKEN, ISSUE, 'bob')).rejects.toThrow(ApiError);
  });
});
