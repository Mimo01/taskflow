import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSprintList } from './backlog';

// backlog.ts (post Phase 74 Plan 06) only uses apiFetch.
vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../lib/apiFetch';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';

describe('backlog service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
