import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { deleteComment, fetchComments, postComment, updateComment } from './comments';

const mockedApiFetch = vi.mocked(apiFetch);
const baseUrl = 'https://jira.example.com';
const token = 'test-token';
const issueKey = 'PROJ-1';

describe('comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchComments', () => {
    it('returns comments on success', async () => {
      const comments = [
        {
          id: '1',
          body: 'hello',
          author: { displayName: 'Alice' },
          created: '2026-01-01',
          updated: '2026-01-01',
        },
      ];
      mockedApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ comments }),
      } as unknown as Response);

      const result = await fetchComments(baseUrl, token, issueKey);
      expect(result).toEqual(comments);
      expect(mockedApiFetch).toHaveBeenCalledWith(
        'jira',
        expect.stringContaining(`/issue/${issueKey}/comment`),
        expect.any(Object),
        'Load Issue Detail',
      );
    });

    it('throws ApiError on 401', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 401,
      } as unknown as Response);

      await expect(fetchComments(baseUrl, token, issueKey)).rejects.toThrow(
        'Failed to fetch comments',
      );
    });
  });

  describe('postComment', () => {
    it('resolves on 201 success', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 201,
      } as unknown as Response);

      await expect(postComment(baseUrl, token, issueKey, 'test comment')).resolves.toBeUndefined();
      expect(mockedApiFetch).toHaveBeenCalledWith(
        'jira',
        expect.stringContaining(`/issue/${issueKey}/comment`),
        expect.objectContaining({ method: 'POST' }),
        'Manage Comments',
      );
    });

    it('throws on 403', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 403,
      } as unknown as Response);

      await expect(postComment(baseUrl, token, issueKey, 'test comment')).rejects.toThrow(
        'Failed to post comment',
      );
    });
  });

  describe('updateComment', () => {
    it('resolves on success', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as unknown as Response);

      await expect(
        updateComment(baseUrl, token, issueKey, 'c-1', 'updated body'),
      ).resolves.toBeUndefined();
      expect(mockedApiFetch).toHaveBeenCalledWith(
        'jira',
        expect.stringContaining(`/issue/${issueKey}/comment/c-1`),
        expect.objectContaining({ method: 'PUT' }),
        'Manage Comments',
      );
    });

    it('throws on 500', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as unknown as Response);

      await expect(updateComment(baseUrl, token, issueKey, 'c-1', 'updated body')).rejects.toThrow(
        'Failed to update comment',
      );
    });
  });

  describe('deleteComment', () => {
    it('resolves on success', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: true,
        status: 204,
      } as unknown as Response);

      await expect(deleteComment(baseUrl, token, issueKey, 'c-1')).resolves.toBeUndefined();
      expect(mockedApiFetch).toHaveBeenCalledWith(
        'jira',
        expect.stringContaining(`/issue/${issueKey}/comment/c-1`),
        expect.objectContaining({ method: 'DELETE' }),
        'Manage Comments',
      );
    });

    it('throws on 401', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 401,
      } as unknown as Response);

      await expect(deleteComment(baseUrl, token, issueKey, 'c-1')).rejects.toThrow(
        'Failed to delete comment',
      );
    });
  });
});
