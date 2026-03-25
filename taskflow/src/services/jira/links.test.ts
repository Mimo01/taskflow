import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { createIssueLink, fetchIssueLinkTypes } from './links';

const mockedApiFetch = vi.mocked(apiFetch);
const baseUrl = 'https://jira.example.com';
const token = 'test-token';

describe('links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchIssueLinkTypes', () => {
    it('returns link types on success', async () => {
      const linkTypes = [{ id: '1', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }];
      mockedApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ issueLinkTypes: linkTypes }),
      } as unknown as Response);

      const result = await fetchIssueLinkTypes(baseUrl, token);
      expect(result).toEqual(linkTypes);
    });

    it('returns empty array on non-ok response', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 401,
      } as unknown as Response);

      const result = await fetchIssueLinkTypes(baseUrl, token);
      expect(result).toEqual([]);
    });
  });

  describe('createIssueLink', () => {
    it('resolves on 201 success', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 201,
      } as unknown as Response);

      await expect(
        createIssueLink(baseUrl, token, 'lt-1', 'PROJ-1', 'PROJ-2'),
      ).resolves.toBeUndefined();
      expect(mockedApiFetch).toHaveBeenCalledWith(
        'jira',
        expect.stringContaining('/issueLink'),
        expect.objectContaining({ method: 'POST' }),
        'Manage Links',
      );
      // Verify body structure
      const callBody = JSON.parse(mockedApiFetch.mock.calls[0][2]?.body as string);
      expect(callBody).toEqual({
        type: { id: 'lt-1' },
        inwardIssue: { key: 'PROJ-1' },
        outwardIssue: { key: 'PROJ-2' },
      });
    });

    it('throws on 400', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 400,
      } as unknown as Response);

      await expect(createIssueLink(baseUrl, token, 'lt-1', 'PROJ-1', 'PROJ-2')).rejects.toThrow(
        'Failed to create issue link',
      );
    });
  });
});
