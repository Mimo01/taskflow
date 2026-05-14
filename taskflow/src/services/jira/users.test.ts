import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { fetchJiraUserByUsername } from './users';

const mockedApiFetch = vi.mocked(apiFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';

// RED stubs — Phase 57 Wave 0. These fail until Plan 02 adds fetchJiraUserByUsername export.

describe('fetchJiraUserByUsername', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns JiraAssignableUser on 200', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ name: 'JIRAUSER23429', displayName: 'Alice Tester', emailAddress: 'alice@example.com' }),
    } as unknown as Response);
    const result = await fetchJiraUserByUsername(BASE, TOKEN, 'JIRAUSER23429');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('JIRAUSER23429');
    expect(result!.displayName).toBe('Alice Tester');
  });

  it('returns null on 404 (user not found)', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const result = await fetchJiraUserByUsername(BASE, TOKEN, 'JIRAUSER99999');
    expect(result).toBeNull();
  });

  it('returns null on network error (graceful fallback per D-08)', async () => {
    mockedApiFetch.mockRejectedValue(new Error('timeout'));
    const result = await fetchJiraUserByUsername(BASE, TOKEN, 'JIRAUSER23429');
    expect(result).toBeNull();
  });

  it('uses ?username= query param in the request URL', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ name: 'ext94772', displayName: 'Bob External' }),
    } as unknown as Response);
    await fetchJiraUserByUsername(BASE, TOKEN, 'ext94772');
    const calledUrl = mockedApiFetch.mock.calls[0][1] as string;
    expect(calledUrl).toContain('/rest/api/latest/user');
    expect(calledUrl).toContain('key=ext94772');
  });

  it('returns null on any non-ok response (e.g. 403)', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 403 } as unknown as Response);
    const result = await fetchJiraUserByUsername(BASE, TOKEN, 'JIRAUSER23429');
    expect(result).toBeNull();
  });
});
