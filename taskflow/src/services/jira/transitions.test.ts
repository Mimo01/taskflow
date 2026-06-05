import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import {
  fetchIssueTransitionsWithFields,
  postTransition,
  transitionsWithFieldsKey,
} from './transitions';

const mockedApiFetch = vi.mocked(apiFetch);
const baseUrl = 'https://jira.example.com';
const token = 'test-token';
const issueKey = 'PROJ-1';

describe('transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        'Issue Transition',
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

      await expect(postTransition(baseUrl, token, issueKey, 'txn-1')).rejects.toThrow(
        'Failed to transition',
      );
    });

    it('nests a provided fields object under body.fields', async () => {
      mockedApiFetch.mockResolvedValue({ ok: false, status: 204 } as unknown as Response);

      await postTransition(baseUrl, token, issueKey, 'txn-1', { resolution: { id: '1' } });

      const callBody = JSON.parse(mockedApiFetch.mock.calls[0][2]?.body as string);
      expect(callBody).toEqual({
        transition: { id: 'txn-1' },
        fields: { resolution: { id: '1' } },
      });
    });

    it('preserves a fields object containing a null resolution (clearing)', async () => {
      mockedApiFetch.mockResolvedValue({ ok: false, status: 204 } as unknown as Response);

      await postTransition(baseUrl, token, issueKey, 'txn-1', { resolution: null });

      const callBody = JSON.parse(mockedApiFetch.mock.calls[0][2]?.body as string);
      expect(callBody).toEqual({ transition: { id: 'txn-1' }, fields: { resolution: null } });
    });

    it('omits the fields key entirely when no fields arg is given', async () => {
      mockedApiFetch.mockResolvedValue({ ok: false, status: 204 } as unknown as Response);

      await postTransition(baseUrl, token, issueKey, 'txn-1');

      const callBody = JSON.parse(mockedApiFetch.mock.calls[0][2]?.body as string);
      expect(callBody).toEqual({ transition: { id: 'txn-1' } });
      expect('fields' in callBody).toBe(false);
    });
  });

  describe('transitionsWithFieldsKey', () => {
    it('includes the status id so the cache cannot be reused across statuses', () => {
      expect(transitionsWithFieldsKey(issueKey, baseUrl, '10000')).toEqual([
        'jira-issue-transitions-fields',
        issueKey,
        baseUrl,
        '10000',
      ]);
    });

    it('produces distinct keys for the same issue in different statuses', () => {
      const a = transitionsWithFieldsKey(issueKey, baseUrl, '10000');
      const b = transitionsWithFieldsKey(issueKey, baseUrl, '10001');
      expect(a).not.toEqual(b);
      // Both share the partial family prefix used by onSettled invalidation.
      expect(a.slice(0, 2)).toEqual(['jira-issue-transitions-fields', issueKey]);
      expect(b.slice(0, 2)).toEqual(['jira-issue-transitions-fields', issueKey]);
    });
  });

  describe('fetchIssueTransitionsWithFields', () => {
    it('GETs the expand=transitions.fields URL and returns the transitions array', async () => {
      const transitions = [
        {
          id: '5',
          name: 'Resolve',
          to: { id: '6', name: 'Resolved' },
          fields: {
            resolution: {
              required: false,
              allowedValues: [{ id: '1', name: 'Done' }],
            },
          },
        },
      ];
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ transitions }),
      } as unknown as Response);

      const result = await fetchIssueTransitionsWithFields(baseUrl, token, issueKey);

      expect(result).toEqual(transitions);
      expect(mockedApiFetch).toHaveBeenCalledWith(
        'jira',
        expect.stringContaining(`/issue/${issueKey}/transitions?expand=transitions.fields`),
        expect.objectContaining({ headers: expect.any(Object) }),
        'Load Transitions',
      );
    });

    it('throws ApiError on 401', async () => {
      mockedApiFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
      await expect(fetchIssueTransitionsWithFields(baseUrl, token, issueKey)).rejects.toThrow();
    });

    it('throws a generic Error on other non-OK responses', async () => {
      mockedApiFetch.mockResolvedValue({ ok: false, status: 500 } as unknown as Response);
      await expect(fetchIssueTransitionsWithFields(baseUrl, token, issueKey)).rejects.toThrow(
        'Failed to fetch transitions',
      );
    });
  });
});
