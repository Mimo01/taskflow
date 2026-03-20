import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchEpicEnrichmentMap,
  fetchEpicStories,
  fetchEpicsBasic,
  fetchEpicsWithEnrichment,
} from './epics';

// epics.ts imports fetchAllSearchPages from ./client -- NOT apiFetch directly
vi.mock('./client', () => ({
  fetchAllSearchPages: vi.fn(),
}));

import { fetchAllSearchPages } from './client';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';

describe('epics service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- fetchEpicsBasic ---
  describe('fetchEpicsBasic', () => {
    it('returns enriched epic objects on success', async () => {
      vi.mocked(fetchAllSearchPages).mockResolvedValueOnce([
        {
          key: 'EPIC-1',
          fields: {
            summary: 'Epic One',
            status: { id: '1', name: 'Open' },
            assignee: null,
            customfield_10015: 'Epic Name Override',
            customfield_10013: 'ghx-label-5',
          },
        },
      ] as any);

      const result = await fetchEpicsBasic(BASE, TOKEN, 'PROJ');
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('EPIC-1');
      expect(result[0].epicName).toBe('Epic Name Override');
      expect(result[0].color).toBe('ghx-label-5');
      expect(result[0].totalStories).toBe(0);
    });

    it('falls back to summary when epicName field is null', async () => {
      vi.mocked(fetchAllSearchPages).mockResolvedValueOnce([
        {
          key: 'EPIC-2',
          fields: {
            summary: 'Summary Fallback',
            status: { id: '1', name: 'Open' },
            assignee: null,
            customfield_10015: null,
            customfield_10013: null,
          },
        },
      ] as any);

      const result = await fetchEpicsBasic(BASE, TOKEN, 'PROJ');
      expect(result[0].epicName).toBe('Summary Fallback');
      expect(result[0].color).toBeNull();
    });

    it('throws when fetchAllSearchPages rejects', async () => {
      vi.mocked(fetchAllSearchPages).mockRejectedValueOnce(new Error('API failure'));

      await expect(fetchEpicsBasic(BASE, TOKEN, 'PROJ')).rejects.toThrow('API failure');
    });
  });

  // --- fetchEpicEnrichmentMap ---
  describe('fetchEpicEnrichmentMap', () => {
    it('returns enrichment map with story counts and points', async () => {
      vi.mocked(fetchAllSearchPages).mockResolvedValueOnce([
        {
          key: 'STORY-1',
          fields: {
            status: { statusCategory: { key: 'done' } },
            customfield_10016: 5,
            customfield_10014: 'EPIC-1',
          },
        },
        {
          key: 'STORY-2',
          fields: {
            status: { statusCategory: { key: 'indeterminate' } },
            customfield_10016: 3,
            customfield_10014: 'EPIC-1',
          },
        },
      ] as any);

      const result = await fetchEpicEnrichmentMap(BASE, TOKEN, ['EPIC-1']);
      expect(result.get('EPIC-1')).toEqual({ total: 2, done: 1, points: 8 });
    });

    it('returns empty map when epicKeys is empty', async () => {
      const result = await fetchEpicEnrichmentMap(BASE, TOKEN, []);
      expect(result.size).toBe(0);
      expect(fetchAllSearchPages).not.toHaveBeenCalled();
    });

    it('returns empty map on fetch failure (caught internally)', async () => {
      vi.mocked(fetchAllSearchPages).mockRejectedValueOnce(new Error('fail'));

      // fetchEpicEnrichmentMap uses .catch(() => []) internally
      const result = await fetchEpicEnrichmentMap(BASE, TOKEN, ['EPIC-1']);
      expect(result.size).toBe(0);
    });
  });

  // --- fetchEpicsWithEnrichment ---
  describe('fetchEpicsWithEnrichment', () => {
    it('returns enriched epics with story counts', async () => {
      // First call: fetch epics
      vi.mocked(fetchAllSearchPages).mockResolvedValueOnce([
        {
          key: 'EPIC-1',
          fields: {
            summary: 'Epic',
            status: { id: '1', name: 'Open' },
            assignee: null,
            customfield_10015: 'My Epic',
          },
        },
      ] as any);
      // Second call: fetch stories
      vi.mocked(fetchAllSearchPages).mockResolvedValueOnce([
        {
          key: 'STORY-1',
          fields: {
            status: { statusCategory: { key: 'done' } },
            customfield_10016: 3,
            customfield_10014: 'EPIC-1',
          },
        },
      ] as any);

      const result = await fetchEpicsWithEnrichment(BASE, TOKEN, 'PROJ');
      expect(result).toHaveLength(1);
      expect(result[0].totalStories).toBe(1);
      expect(result[0].doneStories).toBe(1);
      expect(result[0].totalPoints).toBe(3);
    });

    it('returns empty array when no epics found', async () => {
      vi.mocked(fetchAllSearchPages).mockResolvedValueOnce([]);
      const result = await fetchEpicsWithEnrichment(BASE, TOKEN, 'PROJ');
      expect(result).toEqual([]);
    });
  });

  // --- fetchEpicStories ---
  describe('fetchEpicStories', () => {
    it('returns stories for an epic on success', async () => {
      vi.mocked(fetchAllSearchPages).mockResolvedValueOnce([
        { key: 'STORY-1', fields: { summary: 'Story 1', status: { name: 'Open' } } },
        { key: 'STORY-2', fields: { summary: 'Story 2', status: { name: 'Done' } } },
      ] as any);

      const result = await fetchEpicStories(BASE, TOKEN, 'EPIC-1', 'PROJ');
      expect(result).toHaveLength(2);
    });

    it('returns empty array on fetch failure (caught internally)', async () => {
      vi.mocked(fetchAllSearchPages).mockRejectedValueOnce(new Error('fail'));

      // fetchEpicStories uses .catch(() => []) internally
      const result = await fetchEpicStories(BASE, TOKEN, 'EPIC-1', 'PROJ');
      expect(result).toEqual([]);
    });
  });
});
