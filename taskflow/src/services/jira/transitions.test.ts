import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { fetchTransitions, postTransition } from './transitions';

const mockedApiFetch = vi.mocked(apiFetch);
const baseUrl = 'https://jira.example.com';
const token = 'test-token';
const issueKey = 'PROJ-1';

describe('transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchTransitions', () => {
    it('returns transitions on success', async () => {
      const transitions = [{ id: '1', name: 'Done', to: { id: '3', name: 'Done' } }];
      mockedApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ transitions }),
      } as unknown as Response);

      const result = await fetchTransitions(baseUrl, token, issueKey);
      expect(result).toEqual(transitions);
    });

    it('throws on 401', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 401,
      } as unknown as Response);

      await expect(fetchTransitions(baseUrl, token, issueKey)).rejects.toThrow('Failed to fetch transitions');
    });
  });

  describe('postTransition', () => {
    it('resolves on 204 success', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 204,
      } as unknown as Response);

      await expect(postTransition(baseUrl, token, issueKey, 'txn-1')).resolves.toBeUndefined();
      expect(mockedApiFetch).toHaveBeenCalledWith(
        'jira',
        expect.stringContaining(`/issue/${issueKey}/transitions`),
        expect.objectContaining({ method: 'POST' }),
      );
      // Verify body contains transition id
      const callBody = JSON.parse(mockedApiFetch.mock.calls[0][2]?.body as string);
      expect(callBody).toEqual({ transition: { id: 'txn-1' } });
    });

    it('throws on 403', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 403,
      } as unknown as Response);

      await expect(postTransition(baseUrl, token, issueKey, 'txn-1')).rejects.toThrow('Failed to transition');
    });
  });
});
