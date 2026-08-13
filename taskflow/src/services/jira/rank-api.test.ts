import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rankIssueApi } from './rank-api';

vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../lib/apiFetch';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const RANK_FIELD_ID = 10105; // fixture value from GhBacklogResponse.rankCustomFieldId

describe('rankIssueApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls PUT /rest/agile/1.0/issue/rank with correct body', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    await rankIssueApi(BASE, TOKEN, 'PROJ-2', RANK_FIELD_ID, { rankAfterIssue: 'PROJ-1' });
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'jira',
      `${BASE}/rest/agile/1.0/issue/rank`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          issues: ['PROJ-2'],
          rankCustomFieldId: RANK_FIELD_ID, // integer, not string
          rankAfterIssue: 'PROJ-1',
        }),
      }),
      'Rank Issue',
    );
  });

  it('passes rankBeforeIssue when dropping at top of list', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    await rankIssueApi(BASE, TOKEN, 'PROJ-1', RANK_FIELD_ID, { rankBeforeIssue: 'PROJ-2' });
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'jira',
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          issues: ['PROJ-1'],
          rankCustomFieldId: RANK_FIELD_ID,
          rankBeforeIssue: 'PROJ-2',
        }),
      }),
      'Rank Issue',
    );
  });

  it('throws ApiError on 401', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: false, status: 401 } as Response);
    await expect(rankIssueApi(BASE, TOKEN, 'PROJ-1', RANK_FIELD_ID, {})).rejects.toThrow();
  });

  it('throws generic Error on 500', async () => {
    // A bodiless 500 (HTML error page, proxy timeout): json() rejects, so the
    // caller falls back to the bare status. The mock must still expose json()
    // — a real Response always has one, and omitting it here previously forced
    // defensive optional chaining into the production code.
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);
    await expect(rankIssueApi(BASE, TOKEN, 'PROJ-1', RANK_FIELD_ID, {})).rejects.toThrow('500');
  });

  it('WR-01: surfaces the field-validation reason from the errors object on 400', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        errorMessages: [],
        errors: { rankCustomFieldId: 'is not a rank field' },
      }),
    } as unknown as Response);
    await expect(rankIssueApi(BASE, TOKEN, 'PROJ-1', RANK_FIELD_ID, {})).rejects.toThrow(
      'rankCustomFieldId: is not a rank field',
    );
  });

  it('surfaces a populated errorMessages entry on 400', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ errorMessages: ['Issue does not exist'] }),
    } as unknown as Response);
    await expect(rankIssueApi(BASE, TOKEN, 'PROJ-1', RANK_FIELD_ID, {})).rejects.toThrow(
      'Issue does not exist',
    );
  });

  it('falls back to a bare status when the 500 body is non-JSON, with no trailing bare colon', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);
    try {
      await rankIssueApi(BASE, TOKEN, 'PROJ-1', RANK_FIELD_ID, {});
      expect.unreachable('should have thrown');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('status 500');
      expect(message.trim().endsWith(':')).toBe(false);
    }
  });

  it('never leaks the token, Authorization header, or request URL into the rejection message', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        errorMessages: [],
        errors: { rankCustomFieldId: 'is not a rank field' },
      }),
    } as unknown as Response);
    try {
      await rankIssueApi(BASE, TOKEN, 'PROJ-1', RANK_FIELD_ID, {});
      expect.unreachable('should have thrown');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).not.toContain(TOKEN);
      expect(message).not.toContain('Authorization');
      expect(message).not.toContain(BASE);
    }
  });

  it('rankCustomFieldId is passed as integer not string', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    await rankIssueApi(BASE, TOKEN, 'PROJ-2', RANK_FIELD_ID, {});
    const callArgs = vi.mocked(apiFetch).mock.calls[0];
    const body = JSON.parse((callArgs[2] as RequestInit).body as string);
    expect(typeof body.rankCustomFieldId).toBe('number');
    expect(body.rankCustomFieldId).toBe(10105);
  });
});
