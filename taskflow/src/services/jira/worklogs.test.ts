import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ fetchAllWorklogPages: vi.fn() }));

import { fetchAllWorklogPages } from './client';
import { fetchIssueWorklogs } from './worklogs';

const mockedFetchAllWorklogPages = vi.mocked(fetchAllWorklogPages);
const baseUrl = 'https://jira.example.com';
const token = 'test-token';
const issueKey = 'PROJ-1';

describe('worklogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchIssueWorklogs', () => {
    it('returns unique author display names on success', async () => {
      mockedFetchAllWorklogPages.mockResolvedValue([
        { author: { displayName: 'Alice' } },
        { author: { displayName: 'Bob' } },
        { author: { displayName: 'Alice' } },
      ]);

      const result = await fetchIssueWorklogs(baseUrl, token, issueKey);
      expect(result).toEqual(['Alice', 'Bob']);
    });

    it('returns empty array on error', async () => {
      mockedFetchAllWorklogPages.mockRejectedValue(new Error('Network error'));

      const result = await fetchIssueWorklogs(baseUrl, token, issueKey);
      expect(result).toEqual([]);
    });
  });
});
