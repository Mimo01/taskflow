import { beforeEach, describe, expect, it, vi } from 'vitest';
import { discoverCustomFields, fetchCreatemeta, fetchProjectStatuses } from './fields';

vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../lib/apiFetch';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';

describe('fields service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- discoverCustomFields ---
  describe('discoverCustomFields', () => {
    it('returns discovered field keys on success', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 'customfield_10100',
            name: 'Story Points',
            schema: { custom: 'com.atlassian.jira.plugin.system.customfieldtypes:float' },
          },
          {
            id: 'customfield_10200',
            name: 'Epic Link',
            schema: { custom: 'com.pyxis.greenhopper.jira:gh-epic-link' },
          },
          {
            id: 'customfield_10300',
            name: 'Sprint',
            schema: { custom: 'com.pyxis.greenhopper.jira:gh-sprint' },
          },
        ],
      } as Response);

      const result = await discoverCustomFields(BASE, TOKEN);
      expect(result.storyPointsFieldKey).toBe('customfield_10100');
      expect(result.epicLinkFieldKey).toBe('customfield_10200');
      expect(result.sprintFieldKey).toBe('customfield_10300');
    });

    it('returns defaults on non-ok response', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await discoverCustomFields(BASE, TOKEN);
      expect(result.storyPointsFieldKey).toBe('customfield_10016');
      expect(result.epicLinkFieldKey).toBe('customfield_10014');
    });

    it('returns defaults on network error', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await discoverCustomFields(BASE, TOKEN);
      expect(result.storyPointsFieldKey).toBe('customfield_10016');
    });
  });

  // --- fetchCreatemeta ---
  describe('fetchCreatemeta', () => {
    it('returns fields from new endpoint on success', async () => {
      const fields = [
        { fieldId: 'summary', name: 'Summary', required: true, schema: { type: 'string' } },
        { fieldId: 'priority', name: 'Priority', required: false, schema: { type: 'priority' } },
      ];
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ values: fields }),
      } as Response);

      const result = await fetchCreatemeta(BASE, TOKEN, 'PROJ', '10001', 'Story');
      expect(result).toHaveLength(2);
      expect(result[0].fieldId).toBe('summary');
    });

    it('falls back to legacy endpoint when new endpoint returns non-ok', async () => {
      // New endpoint returns 404
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);
      // Legacy endpoint succeeds
      const legacyFields = {
        summary: { fieldId: 'summary', name: 'Summary', required: true, schema: { type: 'string' } },
      };
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          projects: [{ issuetypes: [{ fields: legacyFields }] }],
        }),
      } as Response);

      const result = await fetchCreatemeta(BASE, TOKEN, 'PROJ', '10001', 'Story');
      expect(result).toHaveLength(1);
      expect(result[0].fieldId).toBe('summary');
    });

    it('returns empty array when both endpoints fail', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await fetchCreatemeta(BASE, TOKEN, 'PROJ', '10001', 'Story');
      expect(result).toEqual([]);
    });
  });

  // --- fetchProjectStatuses ---
  describe('fetchProjectStatuses', () => {
    it('returns deduplicated statuses on success', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            statuses: [
              { id: '1', name: 'Open', statusCategory: { key: 'new' } },
              { id: '2', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
            ],
          },
          {
            statuses: [
              { id: '1', name: 'Open', statusCategory: { key: 'new' } }, // duplicate
              { id: '3', name: 'Done', statusCategory: { key: 'done' } },
            ],
          },
        ],
      } as Response);

      const result = await fetchProjectStatuses(BASE, TOKEN, 'PROJ');
      expect(result).toHaveLength(3);
      expect(result.map((s) => s.id)).toEqual(['1', '2', '3']);
    });

    it('throws ApiError on 401', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(fetchProjectStatuses(BASE, TOKEN, 'PROJ')).rejects.toThrow(
        'Failed to fetch project statuses',
      );
    });

    it('throws Error on other non-ok status', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchProjectStatuses(BASE, TOKEN, 'PROJ')).rejects.toThrow(
        'Failed to fetch project statuses: 500',
      );
    });
  });
});
