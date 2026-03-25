import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api-error';
import { fetchBacklogIssues, fetchBacklogView } from './backlog';

// backlog.ts imports BOTH apiFetch and fetchAllSearchPages/isResponseLikeError from ./client
vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('./client', () => ({
  fetchAllSearchPages: vi.fn(),
  isResponseLikeError: vi.fn(),
}));

import { apiFetch } from '../../lib/apiFetch';
import { fetchAllSearchPages, isResponseLikeError } from './client';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';

describe('backlog service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- fetchBacklogIssues ---
  describe('fetchBacklogIssues', () => {
    it('returns backlog issues on success', async () => {
      const issues = [
        { key: 'PROJ-10', fields: { summary: 'Backlog item' } },
        { key: 'PROJ-11', fields: { summary: 'Another item' } },
      ];
      vi.mocked(fetchAllSearchPages).mockResolvedValueOnce(issues as any);

      const result = await fetchBacklogIssues(BASE, TOKEN, 'PROJ');
      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('PROJ-10');
    });

    it('throws ApiError on auth failure', async () => {
      vi.mocked(fetchAllSearchPages).mockRejectedValueOnce(
        new ApiError('Token expired', 401, 'jira'),
      );

      await expect(fetchBacklogIssues(BASE, TOKEN, 'PROJ')).rejects.toThrow(ApiError);
    });

    it('throws user-friendly message on 400 response', async () => {
      const responseError = { status: 400 };
      vi.mocked(fetchAllSearchPages).mockRejectedValueOnce(responseError);
      vi.mocked(isResponseLikeError).mockReturnValue(true);

      await expect(fetchBacklogIssues(BASE, TOKEN, 'PROJ')).rejects.toThrow(
        'Backlog query unavailable',
      );
    });

    it('throws generic error on non-response-like error', async () => {
      vi.mocked(fetchAllSearchPages).mockRejectedValueOnce(new Error('random'));
      vi.mocked(isResponseLikeError).mockReturnValue(false);

      await expect(fetchBacklogIssues(BASE, TOKEN, 'PROJ')).rejects.toThrow('Cannot reach');
    });
  });

  // --- fetchBacklogView ---
  describe('fetchBacklogView', () => {
    it('returns full backlog view with sprints and backlog on success', async () => {
      // Step 1: board discovery via apiFetch
      vi.mocked(apiFetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ values: [{ id: 42 }] }),
        } as Response)
        // Step 2b: sprint list
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            values: [{ id: 10, name: 'Sprint 1', state: 'active', originBoardId: 42 }],
          }),
        } as Response);

      // fetchAllSearchPages calls:
      // 1. Active sprint issues
      // 2. Future sprint issues
      // 3. Backlog issues
      // 4. Epic issues (may or may not be called depending on epic links)
      vi.mocked(fetchAllSearchPages)
        .mockResolvedValueOnce([
          {
            key: 'PROJ-1',
            fields: {
              summary: 'Sprint issue',
              sprint: { id: 10, name: 'Sprint 1', state: 'active', originBoardId: 42 },
            },
          },
        ] as any)
        .mockResolvedValueOnce([] as any) // future sprint issues
        .mockResolvedValueOnce([{ key: 'PROJ-5', fields: { summary: 'Backlog item' } }] as any); // backlog issues

      const result = await fetchBacklogView(BASE, TOKEN, 'PROJ');
      expect(result.sprints).toHaveLength(1);
      expect(result.sprints[0].sprint.name).toBe('Sprint 1');
      expect(result.backlog).toHaveLength(1);
      expect(result.backlog[0].key).toBe('PROJ-5');
    });

    it('returns backlog only when board discovery fails', async () => {
      // Board discovery fails
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Backlog issues
      vi.mocked(fetchAllSearchPages).mockResolvedValueOnce([
        { key: 'PROJ-5', fields: { summary: 'Backlog item' } },
      ] as any);

      const result = await fetchBacklogView(BASE, TOKEN, 'PROJ');
      expect(result.sprints).toHaveLength(0);
      expect(result.backlog).toHaveLength(1);
    });

    it('returns empty backlog on all failures', async () => {
      // Board discovery fails
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error('network'));
      // Backlog fetch also fails (caught internally)
      vi.mocked(fetchAllSearchPages).mockRejectedValueOnce(new Error('fail'));

      const result = await fetchBacklogView(BASE, TOKEN, 'PROJ');
      expect(result.sprints).toEqual([]);
      expect(result.backlog).toEqual([]);
    });
  });
});
