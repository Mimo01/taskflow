import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api-error';
import { fetchBacklogIssues, fetchBacklogView, fetchSprintList } from './backlog';

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
    vi.resetAllMocks();
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
    it('returns full backlog view with sprints and backlog on success (boardId provided)', async () => {
      // boardId=42 provided -- no board discovery call expected
      // Only sprint list call via apiFetch
      vi.mocked(apiFetch).mockResolvedValueOnce({
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

      const result = await fetchBacklogView(BASE, TOKEN, 'PROJ', 42);
      expect(result.sprints).toHaveLength(1);
      expect(result.sprints[0].sprint.name).toBe('Sprint 1');
      expect(result.backlog).toHaveLength(1);
      expect(result.backlog[0].key).toBe('PROJ-5');
    });

    it('fetchBacklogView with boardId skips board discovery -- no agile/1.0/board?projectKeyOrId call', async () => {
      // sprint list call only
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ values: [] }),
      } as Response);

      vi.mocked(fetchAllSearchPages).mockResolvedValue([] as any);

      await fetchBacklogView(BASE, TOKEN, 'PROJ', 42);

      // Verify no board discovery URL was called
      const calls = vi.mocked(apiFetch).mock.calls;
      const boardDiscoveryCall = calls.find(
        (call) => typeof call[1] === 'string' && call[1].includes('board?projectKeyOrId='),
      );
      expect(boardDiscoveryCall).toBeUndefined();
    });

    it('fetchBacklogView return does not contain epicNames when no epic batch', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      vi.mocked(fetchAllSearchPages).mockResolvedValueOnce([] as any);

      const result = await fetchBacklogView(BASE, TOKEN, 'PROJ', null);
      expect(result.epicNames).toBeUndefined();
      expect(result.epicColors).toBeUndefined();
    });

    it('returns backlog only when boardId is null', async () => {
      // Backlog issues only, no sprint list call
      vi.mocked(fetchAllSearchPages).mockResolvedValueOnce([
        { key: 'PROJ-5', fields: { summary: 'Backlog item' } },
      ] as any);

      const result = await fetchBacklogView(BASE, TOKEN, 'PROJ', null);
      expect(result.sprints).toHaveLength(0);
      expect(result.backlog).toHaveLength(1);
    });

    it('returns empty backlog when backlog fetch fails', async () => {
      // Backlog fetch fails (caught internally)
      vi.mocked(fetchAllSearchPages).mockRejectedValueOnce(new Error('fail'));

      const result = await fetchBacklogView(BASE, TOKEN, 'PROJ', null);
      expect(result.sprints).toEqual([]);
      expect(result.backlog).toEqual([]);
    });
  });

  // --- fetchSprintList ---
  describe('fetchSprintList', () => {
    it('fetches active and future sprints from the board API', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          values: [
            {
              id: 1,
              name: 'Sprint 1',
              state: 'active',
              startDate: '2026-03-01',
              endDate: '2026-03-15',
              originBoardId: 10,
            },
            { id: 2, name: 'Sprint 2', state: 'future', originBoardId: 10 },
          ],
        }),
      } as Response);

      const result = await fetchSprintList(BASE, TOKEN, 10);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        name: 'Sprint 1',
        state: 'active',
        startDate: '2026-03-01',
        endDate: '2026-03-15',
        originBoardId: 10,
      });
      expect(result[1]).toEqual({
        id: 2,
        name: 'Sprint 2',
        state: 'future',
        startDate: undefined,
        endDate: undefined,
        originBoardId: 10,
      });
    });

    it('returns empty array when API response is not ok', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await fetchSprintList(BASE, TOKEN, 10);
      expect(result).toEqual([]);
    });
  });
});
