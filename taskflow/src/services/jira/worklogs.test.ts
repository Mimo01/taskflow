import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorklog, deleteWorklog, fetchFullWorklogs, updateWorklog } from './worklogs';

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

import { fetch as mockFetch } from '@tauri-apps/plugin-http';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const ISSUE = 'PROJ-1';

describe('worklogs service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchFullWorklogs', () => {
    it('returns full JiraWorklog objects', async () => {
      const worklog = {
        id: '1',
        author: { displayName: 'Alice', name: 'alice' },
        timeSpent: '2h',
        timeSpentSeconds: 7200,
        started: '2026-03-20T09:00:00.000+0000',
        created: '2026-03-20T09:00:00.000+0000',
        updated: '2026-03-20T09:00:00.000+0000',
        comment: 'Did some work',
      };

      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ worklogs: [worklog], total: 1 }),
      } as Response);

      const result = await fetchFullWorklogs(BASE, TOKEN, ISSUE);
      expect(result).toEqual([worklog]);
      expect(vi.mocked(mockFetch)).toHaveBeenCalledWith(
        expect.stringContaining(`/rest/api/2/issue/${ISSUE}/worklog`),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
        }),
      );
    });

    it('returns empty array on error', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const result = await fetchFullWorklogs(BASE, TOKEN, ISSUE);
      expect(result).toEqual([]);
    });
  });

  describe('createWorklog', () => {
    it('sends POST with worklog data', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 201,
      } as Response);

      await createWorklog(BASE, TOKEN, ISSUE, {
        timeSpentSeconds: 3600,
        started: '2026-03-20T09:00:00.000+0000',
        comment: 'Worked on feature',
      });

      expect(vi.mocked(mockFetch)).toHaveBeenCalledWith(
        `${BASE}/rest/api/2/issue/${ISSUE}/worklog`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            timeSpentSeconds: 3600,
            started: '2026-03-20T09:00:00.000+0000',
            comment: 'Worked on feature',
          }),
        }),
      );
    });

    it('defaults blank/undefined comment to "Working on issue {KEY}"', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 201,
      } as Response);

      await createWorklog(BASE, TOKEN, ISSUE, {
        timeSpentSeconds: 3600,
        started: '2026-03-20T09:00:00.000+0000',
      });

      expect(vi.mocked(mockFetch)).toHaveBeenCalledWith(
        `${BASE}/rest/api/2/issue/${ISSUE}/worklog`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            timeSpentSeconds: 3600,
            started: '2026-03-20T09:00:00.000+0000',
            comment: `Working on issue ${ISSUE}`,
          }),
        }),
      );
    });

    it('defaults whitespace-only comment to "Working on issue {KEY}"', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 201,
      } as Response);

      await createWorklog(BASE, TOKEN, ISSUE, {
        timeSpentSeconds: 3600,
        started: '2026-03-20T09:00:00.000+0000',
        comment: '   ',
      });

      expect(vi.mocked(mockFetch)).toHaveBeenCalledWith(
        `${BASE}/rest/api/2/issue/${ISSUE}/worklog`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            timeSpentSeconds: 3600,
            started: '2026-03-20T09:00:00.000+0000',
            comment: `Working on issue ${ISSUE}`,
          }),
        }),
      );
    });

    it('throws ApiError on 401', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      await expect(
        createWorklog(BASE, TOKEN, ISSUE, {
          timeSpentSeconds: 3600,
          started: '2026-03-20T09:00:00.000+0000',
        }),
      ).rejects.toThrow('Failed to create worklog');
    });
  });

  describe('updateWorklog', () => {
    it('sends PUT with worklog data', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      await updateWorklog(BASE, TOKEN, ISSUE, '42', {
        timeSpentSeconds: 7200,
        started: '2026-03-20T09:00:00.000+0000',
      });

      expect(vi.mocked(mockFetch)).toHaveBeenCalledWith(
        `${BASE}/rest/api/2/issue/${ISSUE}/worklog/42`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            timeSpentSeconds: 7200,
            started: '2026-03-20T09:00:00.000+0000',
          }),
        }),
      );
    });

    it('throws ApiError on 403', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 403,
      } as Response);

      await expect(
        updateWorklog(BASE, TOKEN, ISSUE, '42', {
          timeSpentSeconds: 7200,
          started: '2026-03-20T09:00:00.000+0000',
        }),
      ).rejects.toThrow('Failed to update worklog');
    });
  });

  describe('deleteWorklog', () => {
    it('sends DELETE to correct URL', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      await deleteWorklog(BASE, TOKEN, ISSUE, '42');

      expect(vi.mocked(mockFetch)).toHaveBeenCalledWith(
        `${BASE}/rest/api/2/issue/${ISSUE}/worklog/42`,
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });

    it('throws ApiError on 401', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      await expect(deleteWorklog(BASE, TOKEN, ISSUE, '42')).rejects.toThrow(
        'Failed to delete worklog',
      );
    });
  });
});
