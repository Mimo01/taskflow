import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api-error';
import {
  createIssue,
  fetchIssueDetail,
  fetchJiraIssueByKey,
  fetchSprintIssues,
  fetchSprintStories,
  fetchSprintSubtasks,
  searchJira,
  searchJiraClosed,
  updateIssueField,
} from './issues';

// issues.ts imports fetchAllSearchPages + isResponseLikeError from ./client and apiFetch from ../../lib/apiFetch
vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('./client', () => ({
  fetchAllSearchPages: vi.fn(),
  isResponseLikeError: vi.fn(),
  SUBTASK_CHUNK_SIZE: 50,
}));

import { apiFetch } from '../../lib/apiFetch';
import { fetchAllSearchPages, isResponseLikeError } from './client';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';

describe('issues service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- fetchSprintIssues ---
  describe('fetchSprintIssues', () => {
    it('returns parent issues and subtasks on success', async () => {
      const parents = [
        { key: 'PROJ-1', fields: { summary: 'Parent 1' } },
        { key: 'PROJ-2', fields: { summary: 'Parent 2' } },
      ];
      const subtasks = [{ key: 'PROJ-3', fields: { summary: 'Sub 1', parent: { key: 'PROJ-1' } } }];

      vi.mocked(fetchAllSearchPages)
        .mockResolvedValueOnce(parents as any) // parent query
        .mockResolvedValueOnce(subtasks as any); // subtask query

      const result = await fetchSprintIssues(BASE, TOKEN, 'PROJ');
      expect(result).toHaveLength(3);
      expect(result[0].key).toBe('PROJ-1');
      expect(result[2].key).toBe('PROJ-3');
    });

    it('returns empty array when no parent issues found', async () => {
      vi.mocked(fetchAllSearchPages).mockResolvedValueOnce([]);
      const result = await fetchSprintIssues(BASE, TOKEN, 'PROJ');
      expect(result).toEqual([]);
    });

    it('throws on ApiError from first page', async () => {
      vi.mocked(fetchAllSearchPages).mockRejectedValueOnce(
        new ApiError('Token expired', 401, 'jira'),
      );
      await expect(fetchSprintIssues(BASE, TOKEN, 'PROJ')).rejects.toThrow(ApiError);
    });

    it('throws user-friendly message on status 400 with sprint error', async () => {
      const responseError = { status: 400, text: async () => 'function not recognized' };
      vi.mocked(fetchAllSearchPages).mockRejectedValueOnce(responseError);
      vi.mocked(isResponseLikeError).mockReturnValue(true);

      await expect(fetchSprintIssues(BASE, TOKEN, 'PROJ')).rejects.toThrow(
        'Sprint filtering unavailable',
      );
    });

    it('returns parents only when subtask query fails', async () => {
      const parents = [{ key: 'PROJ-1', fields: { summary: 'Parent 1' } }];
      vi.mocked(fetchAllSearchPages)
        .mockResolvedValueOnce(parents as any)
        .mockRejectedValueOnce(new Error('subtask fetch fail'));

      const result = await fetchSprintIssues(BASE, TOKEN, 'PROJ');
      // Subtask failure is caught silently, parents returned
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('PROJ-1');
    });
  });

  // --- fetchIssueDetail ---
  describe('fetchIssueDetail', () => {
    const customFields = {
      epicLinkFieldKey: 'customfield_10014',
      epicNameFieldKey: 'customfield_10015',
      sprintFieldKey: 'customfield_10020',
      storyPointsFieldKey: 'customfield_10016',
    };

    it('returns issue detail on success', async () => {
      const issueData = {
        id: '1001',
        key: 'PROJ-1',
        fields: { summary: 'Detail issue', status: { id: '1', name: 'Open' } },
      };
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => issueData,
      } as Response);

      const result = await fetchIssueDetail(BASE, TOKEN, 'PROJ-1', customFields);
      expect(result.key).toBe('PROJ-1');
      expect(result.fields.summary).toBe('Detail issue');
    });

    it('throws ApiError on 401', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(fetchIssueDetail(BASE, TOKEN, 'PROJ-1', customFields)).rejects.toThrow(ApiError);
    });

    it('throws Error on 404', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      await expect(fetchIssueDetail(BASE, TOKEN, 'PROJ-1', customFields)).rejects.toThrow(
        'Failed to fetch issue PROJ-1: 404',
      );
    });

    it('request URL includes customfield_13415 in the fields query string', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: '1001',
          key: 'PROJ-1',
          fields: { summary: 'Test', customfield_13415: { value: 'Major' } },
        }),
      } as Response);

      await fetchIssueDetail(BASE, TOKEN, 'PROJ-1', customFields);

      const callArgs = vi.mocked(apiFetch).mock.calls[0];
      const url = callArgs[1] as string;
      expect(url).toContain('customfield_13415');
    });

    it('response with customfield_13415 is accessible on JiraIssueDetail.fields', async () => {
      const issueData = {
        id: '1001',
        key: 'PROJ-1',
        fields: {
          summary: 'Defect with severity',
          customfield_13415: { value: 'Major' },
        },
      };
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => issueData,
      } as Response);

      const result = await fetchIssueDetail(BASE, TOKEN, 'PROJ-1', customFields);
      // TypeScript type allows accessing .customfield_13415?.value without unknown widening
      const severityValue = result.fields.customfield_13415?.value;
      expect(severityValue).toBe('Major');
    });
  });

  // --- createIssue ---
  describe('createIssue', () => {
    it('returns created issue key on success', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: '1002', key: 'PROJ-2' }),
      } as Response);

      const result = await createIssue(BASE, TOKEN, 'PROJ', 'New issue');
      expect(result.key).toBe('PROJ-2');
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
        'jira',
        expect.stringContaining('/rest/api/2/issue'),
        expect.objectContaining({ method: 'POST' }),
        'Create/Edit Issue',
      );
    });

    it('throws ApiError on 401', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(createIssue(BASE, TOKEN, 'PROJ', 'Fail')).rejects.toThrow(ApiError);
    });

    it('throws Error on 400', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
      } as Response);

      await expect(createIssue(BASE, TOKEN, 'PROJ', 'Bad request')).rejects.toThrow(
        'Failed to create issue: 400',
      );
    });
  });

  // --- updateIssueField ---
  describe('updateIssueField', () => {
    it('succeeds with 204 response', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 204,
      } as Response);

      await expect(
        updateIssueField(BASE, TOKEN, 'PROJ-1', 'summary', 'Updated'),
      ).resolves.toBeUndefined();
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
        'jira',
        expect.stringContaining('/rest/api/2/issue/PROJ-1'),
        expect.objectContaining({ method: 'PUT' }),
        'Create/Edit Issue',
      );
    });

    it('throws ApiError on 403', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);

      await expect(updateIssueField(BASE, TOKEN, 'PROJ-1', 'summary', 'Fail')).rejects.toThrow(
        ApiError,
      );
    });

    it('throws Error on other non-ok status', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(updateIssueField(BASE, TOKEN, 'PROJ-1', 'summary', 'Fail')).rejects.toThrow(
        'Failed to update summary on PROJ-1: 500',
      );
    });
  });

  // --- fetchSprintStories ---
  describe('fetchSprintStories', () => {
    it('returns non-subtask issues on success', async () => {
      const stories = [
        { key: 'PROJ-1', fields: { summary: 'Story 1' } },
        { key: 'PROJ-2', fields: { summary: 'Story 2' } },
      ];
      vi.mocked(fetchAllSearchPages).mockResolvedValueOnce(stories as any);

      const result = await fetchSprintStories(BASE, TOKEN, 'PROJ');
      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('PROJ-1');
    });

    it('returns empty array when no stories found', async () => {
      vi.mocked(fetchAllSearchPages).mockResolvedValueOnce([]);
      const result = await fetchSprintStories(BASE, TOKEN, 'PROJ');
      expect(result).toEqual([]);
    });

    it('throws ApiError on auth failure', async () => {
      vi.mocked(fetchAllSearchPages).mockRejectedValueOnce(
        new ApiError('Token expired', 401, 'jira'),
      );
      await expect(fetchSprintStories(BASE, TOKEN, 'PROJ')).rejects.toThrow(ApiError);
    });

    it('throws user-friendly message on status 400 with sprint error', async () => {
      const responseError = { status: 400, text: async () => 'function not recognized' };
      vi.mocked(fetchAllSearchPages).mockRejectedValueOnce(responseError);
      vi.mocked(isResponseLikeError).mockReturnValue(true);

      await expect(fetchSprintStories(BASE, TOKEN, 'PROJ')).rejects.toThrow(
        'Sprint filtering unavailable',
      );
    });

    it('throws generic error on status 500', async () => {
      const responseError = { status: 500 };
      vi.mocked(fetchAllSearchPages).mockRejectedValueOnce(responseError);
      vi.mocked(isResponseLikeError).mockReturnValue(true);

      await expect(fetchSprintStories(BASE, TOKEN, 'PROJ')).rejects.toThrow(
        'Jira search failed with status 500',
      );
    });
  });

  // --- fetchSprintSubtasks ---
  describe('fetchSprintSubtasks', () => {
    it('returns empty array when parentKeys is empty', async () => {
      const result = await fetchSprintSubtasks(BASE, TOKEN, []);
      expect(result).toEqual([]);
      expect(vi.mocked(fetchAllSearchPages)).not.toHaveBeenCalled();
    });

    it('returns subtasks for a single chunk of parent keys', async () => {
      const subtasks = [{ key: 'PROJ-10', fields: { summary: 'Subtask 1' } }];
      vi.mocked(fetchAllSearchPages).mockResolvedValueOnce(subtasks as any);

      const result = await fetchSprintSubtasks(BASE, TOKEN, ['PROJ-1', 'PROJ-2', 'PROJ-3']);
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('PROJ-10');
    });

    it('returns partial results when a chunk fails', async () => {
      const subtasks = [{ key: 'PROJ-10', fields: { summary: 'Subtask 1' } }];
      vi.mocked(fetchAllSearchPages)
        .mockResolvedValueOnce(subtasks as any) // chunk 1 succeeds
        .mockRejectedValueOnce(new Error('chunk fail')); // chunk 2 fails

      // 60 keys = 2 chunks (50 + 10)
      const parentKeys = Array.from({ length: 60 }, (_, i) => `PROJ-${i + 1}`);
      const result = await fetchSprintSubtasks(BASE, TOKEN, parentKeys);

      // Only chunk 1 results returned; chunk 2 fails silently
      expect(result).toHaveLength(1);
    });

    it('splits 60 parent keys into 2 chunks (50 + 10) via SUBTASK_CHUNK_SIZE', async () => {
      vi.mocked(fetchAllSearchPages)
        .mockResolvedValueOnce([] as any) // chunk 1
        .mockResolvedValueOnce([] as any); // chunk 2

      const parentKeys = Array.from({ length: 60 }, (_, i) => `PROJ-${i + 1}`);
      await fetchSprintSubtasks(BASE, TOKEN, parentKeys);

      expect(vi.mocked(fetchAllSearchPages)).toHaveBeenCalledTimes(2);
    });
  });

  // --- searchJira ---
  describe('searchJira', () => {
    it('returns matching issues on success', async () => {
      const issues = [{ key: 'PROJ-10', fields: { summary: 'Found it' } }];
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ issues }),
      } as Response);

      const result = await searchJira(BASE, TOKEN, 'PROJ', 'Found');
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('PROJ-10');
    });

    it('returns empty array on non-ok response', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await searchJira(BASE, TOKEN, 'PROJ', 'query');
      expect(result).toEqual([]);
    });

    it('returns empty array on network error', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await searchJira(BASE, TOKEN, 'PROJ', 'query');
      expect(result).toEqual([]);
    });
  });

  // --- fetchJiraIssueByKey ---
  describe('fetchJiraIssueByKey', () => {
    it('returns the parsed JiraIssue on 200', async () => {
      const issue = {
        key: 'PROJ-123',
        fields: {
          summary: 'Direct fetch issue',
          status: { name: 'Done' },
          assignee: null,
          customfield_10016: null,
          issuetype: { name: 'Story' },
        },
      };
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => issue,
      } as Response);

      const result = await fetchJiraIssueByKey(BASE, TOKEN, 'PROJ-123');
      expect(result).not.toBeNull();
      expect(result!.key).toBe('PROJ-123');
      expect(result!.fields.summary).toBe('Direct fetch issue');
    });

    it('calls the correct URL with required fields', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ key: 'PROJ-123', fields: {} }),
      } as Response);

      await fetchJiraIssueByKey(BASE, TOKEN, 'PROJ-123');

      const callArgs = vi.mocked(apiFetch).mock.calls[0];
      const url = callArgs[1] as string;
      expect(url).toContain('/rest/api/2/issue/PROJ-123');
      expect(url).toContain('fields=summary,status,assignee,customfield_10016,issuetype');
    });

    it('strips trailing slash from baseUrl', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ key: 'PROJ-1', fields: {} }),
      } as Response);

      await fetchJiraIssueByKey('https://jira.example.com/', TOKEN, 'PROJ-1');

      const callArgs = vi.mocked(apiFetch).mock.calls[0];
      const url = callArgs[1] as string;
      expect(url).not.toContain('//rest');
      expect(url).toContain('https://jira.example.com/rest/api/2/issue/PROJ-1');
    });

    it('returns null on 404', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await fetchJiraIssueByKey(BASE, TOKEN, 'PROJ-999');
      expect(result).toBeNull();
    });

    it('returns null on 401', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await fetchJiraIssueByKey(BASE, TOKEN, 'PROJ-123');
      expect(result).toBeNull();
    });

    it('returns null on 403', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);

      const result = await fetchJiraIssueByKey(BASE, TOKEN, 'PROJ-123');
      expect(result).toBeNull();
    });

    it('returns null on network error (thrown exception)', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Network failure'));

      const result = await fetchJiraIssueByKey(BASE, TOKEN, 'PROJ-123');
      expect(result).toBeNull();
    });

    it('does not include statusCategory filter in the URL (open and closed both returned)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ key: 'PROJ-123', fields: {} }),
      } as Response);

      await fetchJiraIssueByKey(BASE, TOKEN, 'PROJ-123');

      const callArgs = vi.mocked(apiFetch).mock.calls[0];
      const url = callArgs[1] as string;
      expect(url).not.toContain('statusCategory');
      expect(url).not.toContain('jql');
    });
  });

  // --- searchJiraClosed ---
  describe('searchJiraClosed', () => {
    it('returns matching closed issues on success', async () => {
      const issues = [{ key: 'PROJ-20', fields: { summary: 'Closed task' } }];
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ issues }),
      } as Response);

      const result = await searchJiraClosed(BASE, TOKEN, 'PROJ', 'Closed');
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('PROJ-20');
    });

    it('returns empty array on non-ok response', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await searchJiraClosed(BASE, TOKEN, 'PROJ', 'query');
      expect(result).toEqual([]);
    });

    it('returns empty array on network error', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await searchJiraClosed(BASE, TOKEN, 'PROJ', 'query');
      expect(result).toEqual([]);
    });

    it('includes statusCategory = Done in JQL', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ issues: [] }),
      } as Response);

      await searchJiraClosed(BASE, TOKEN, 'PROJ', 'query');

      const callArgs = vi.mocked(apiFetch).mock.calls[0];
      const url = callArgs[1] as string;
      expect(url).toContain('statusCategory');
      expect(url).toContain('Done');
    });
  });
});
