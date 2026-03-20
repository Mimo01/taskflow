import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addIssuesToSprint, fetchActiveSprint, fetchSprintsForBoard } from './sprints';

vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../lib/apiFetch';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';

describe('sprints service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- fetchActiveSprint ---
  describe('fetchActiveSprint', () => {
    it('returns the active sprint on success', async () => {
      // Step 1: board discovery
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ values: [{ id: 42 }] }),
      } as Response);
      // Step 2: active sprint
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          values: [{ id: 1, name: 'Sprint 1', state: 'active' }],
        }),
      } as Response);

      const result = await fetchActiveSprint(BASE, TOKEN, 'PROJ');
      expect(result).toEqual({ id: 1, name: 'Sprint 1', state: 'active' });
    });

    it('returns null when no active sprint exists', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ values: [{ id: 42 }] }),
      } as Response);
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ values: [] }),
      } as Response);

      const result = await fetchActiveSprint(BASE, TOKEN, 'PROJ');
      expect(result).toBeNull();
    });

    it('returns null when board discovery fails', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await fetchActiveSprint(BASE, TOKEN, 'PROJ');
      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchActiveSprint(BASE, TOKEN, 'PROJ');
      expect(result).toBeNull();
    });
  });

  // --- fetchSprintsForBoard ---
  describe('fetchSprintsForBoard', () => {
    it('returns sorted sprints on success', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          values: [
            { id: 2, name: 'Sprint 2', state: 'future', startDate: '2026-04-01' },
            { id: 1, name: 'Sprint 1', state: 'active', startDate: '2026-03-01' },
          ],
        }),
      } as Response);

      const result = await fetchSprintsForBoard(BASE, TOKEN, 42);
      expect(result).toHaveLength(2);
      expect(result[0].state).toBe('active');
      expect(result[1].state).toBe('future');
    });

    it('returns empty array on non-ok response', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await fetchSprintsForBoard(BASE, TOKEN, 42);
      expect(result).toEqual([]);
    });

    it('returns empty array on network error', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error('timeout'));

      const result = await fetchSprintsForBoard(BASE, TOKEN, 42);
      expect(result).toEqual([]);
    });
  });

  // --- addIssuesToSprint ---
  describe('addIssuesToSprint', () => {
    it('succeeds with 204 response', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 204,
      } as Response);

      await expect(addIssuesToSprint(BASE, TOKEN, 1, ['PROJ-1', 'PROJ-2'])).resolves.toBeUndefined();
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
        'jira',
        expect.stringContaining('/rest/agile/1.0/sprint/1/issue'),
        expect.objectContaining({ method: 'POST' }),
        'Load Sprint Board',
      );
    });

    it('throws ApiError on 401', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(addIssuesToSprint(BASE, TOKEN, 1, ['PROJ-1'])).rejects.toThrow(
        'Failed to add issues to sprint',
      );
    });

    it('throws Error on other non-ok status', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(addIssuesToSprint(BASE, TOKEN, 1, ['PROJ-1'])).rejects.toThrow(
        'Failed to add issues to sprint: 500',
      );
    });
  });
});
