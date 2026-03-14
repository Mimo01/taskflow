// AUTH-01: Jira PAT validation
// AUTH-06: Error banners for Jira validation failures
// DEV-01, DEV-02, DEV-03, DEV-04: Phase 2 Jira sprint & transition functions
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateJira,
  listJiraProjects,
  fetchSprintIssues,
  fetchTransitions,
  postTransition,
  postComment,
  fetchFixVersions,
  type JiraIssue,
  type JiraIssueDetail,
  type JiraIssueLink,
} from './jira';

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

import { fetch as mockFetch } from '@tauri-apps/plugin-http';

describe('jira service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('validateJira', () => {
    it('AUTH-01: validateJira returns user data on 200 response', async () => {
      const mockUser = { displayName: 'Jane Smith', emailAddress: 'jane@example.com', name: 'janesmith' };
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUser,
      } as Response);

      const result = await validateJira('https://jira.example.com', 'my-token');
      expect(result).toEqual({ displayName: 'Jane Smith', emailAddress: 'jane@example.com', name: 'janesmith' });
    });

    it('AUTH-01: validateJira throws "Invalid token or token has expired" on 401', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response);

      await expect(validateJira('https://jira.example.com', 'bad-token')).rejects.toThrow(
        'Invalid token or token has expired',
      );
    });

    it('AUTH-01: validateJira throws "Token valid but lacks required permissions" on 403', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({}),
      } as Response);

      await expect(validateJira('https://jira.example.com', 'limited-token')).rejects.toThrow(
        'Token valid but lacks required permissions',
      );
    });

    it('AUTH-01: validateJira throws "Cannot reach [URL]" on network error', async () => {
      vi.mocked(mockFetch).mockRejectedValue(new Error('Network failure'));

      await expect(validateJira('https://jira.example.com', 'any-token')).rejects.toThrow(
        'Cannot reach https://jira.example.com — check the base URL',
      );
    });

    it('AUTH-01: validateJira throws "Cannot reach [URL]" on non-401/403 error status', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response);

      await expect(validateJira('https://jira.example.com', 'any-token')).rejects.toThrow(
        'Cannot reach https://jira.example.com — check the base URL',
      );
    });
  });

  describe('listJiraProjects', () => {
    it('AUTH-06: listJiraProjects returns project list on success', async () => {
      const mockProjects = [
        { id: '10001', key: 'APP', name: 'Application' },
        { id: '10002', key: 'BE', name: 'Backend' },
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockProjects,
      } as Response);

      const result = await listJiraProjects('https://jira.example.com', 'my-token');
      expect(result).toEqual(mockProjects);
    });

    it('AUTH-06: listJiraProjects throws on 401', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response);

      await expect(listJiraProjects('https://jira.example.com', 'bad-token')).rejects.toThrow(
        'Invalid token or token has expired',
      );
    });
  });

  describe('fetchSprintIssues', () => {
    const mockIssue = {
      id: '1',
      key: 'PROJ-1',
      fields: {
        summary: 'Fix login bug',
        status: { id: '10001', name: 'In Progress' },
        assignee: { displayName: 'Jane Smith', avatarUrls: { '48x48': 'https://example.com/avatar.png' } },
        customfield_10016: 5,
        issuetype: { name: 'Story', subtask: false },
      },
    };

    it('DEV-01: fetchSprintIssues returns JiraIssue[] with correct shape', async () => {
      vi.mocked(mockFetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ issues: [mockIssue] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ issues: [] }),
        } as Response);

      const result = await fetchSprintIssues('https://jira.example.com', 'my-token', 'PROJ');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockIssue);
    });

    it('DEV-01: fetchSprintIssues with assignedToMe=true includes currentUser() in JQL', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ issues: [] }),
      } as Response);

      await fetchSprintIssues('https://jira.example.com', 'my-token', 'PROJ', true);

      const callUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
      expect(callUrl).toContain('currentUser()');
    });

    it('DEV-01: fetchSprintIssues with assignedToMe=false does NOT include currentUser() in JQL', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ issues: [] }),
      } as Response);

      await fetchSprintIssues('https://jira.example.com', 'my-token', 'PROJ', false);

      const callUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
      expect(callUrl).not.toContain('currentUser()');
    });

    it('DEV-01: fetchSprintIssues 400 with "function" in body throws sprint-unavailable error', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'The function openSprints() is not recognized',
      } as Response);

      await expect(
        fetchSprintIssues('https://jira.example.com', 'my-token', 'PROJ'),
      ).rejects.toThrow('Sprint filtering unavailable — ensure Jira Software is installed');
    });
  });

  describe('fetchTransitions', () => {
    it('DEV-02: fetchTransitions returns transitions array', async () => {
      const mockTransitions = [
        { id: '11', name: 'To Do', to: { id: '10000', name: 'To Do' } },
        { id: '21', name: 'In Progress', to: { id: '10001', name: 'In Progress' } },
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ transitions: mockTransitions }),
      } as Response);

      const result = await fetchTransitions('https://jira.example.com', 'my-token', 'PROJ-1');
      expect(result).toEqual(mockTransitions);
    });
  });

  describe('postTransition', () => {
    it('DEV-03: postTransition calls POST with correct body and resolves void on 204', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      const result = await postTransition('https://jira.example.com', 'my-token', 'PROJ-1', '21');
      expect(result).toBeUndefined();

      const [, options] = vi.mocked(mockFetch).mock.calls[0];
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body).toEqual({ transition: { id: '21' } });
    });

    it('DEV-03: postTransition throws on non-2xx response', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 400,
      } as Response);

      await expect(
        postTransition('https://jira.example.com', 'my-token', 'PROJ-1', '21'),
      ).rejects.toThrow();
    });
  });

  describe('postComment', () => {
    it('DEV-04: postComment calls POST with correct body and resolves void on 201', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 201,
      } as Response);

      const result = await postComment('https://jira.example.com', 'my-token', 'PROJ-1', 'Great work!');
      expect(result).toBeUndefined();

      const [, options] = vi.mocked(mockFetch).mock.calls[0];
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body).toEqual({ body: 'Great work!' });
    });

    it('DEV-04: postComment throws on non-2xx response', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 400,
      } as Response);

      await expect(
        postComment('https://jira.example.com', 'my-token', 'PROJ-1', 'comment'),
      ).rejects.toThrow();
    });
  });

  describe('APIF-01: JiraIssue type extension', () => {
    it('accepts parent, subtasks, timetracking, and issuetype.subtask fields', () => {
      const issue: JiraIssue = {
        id: '1',
        key: 'PROJ-1',
        fields: {
          summary: 'Test',
          status: { id: '1', name: 'To Do' },
          assignee: null,
          customfield_10016: 5,
          issuetype: { name: 'Story', subtask: false },
          parent: { id: '2', key: 'PROJ-0', fields: { summary: 'Parent' } },
          subtasks: [{ id: '3', key: 'PROJ-2', fields: { summary: 'Sub', status: { name: 'To Do' } } }],
          timetracking: { originalEstimate: '2h', timeSpent: '1h', remainingEstimate: '1h' },
        },
      };
      expect(issue.fields.parent?.key).toBe('PROJ-0');
      expect(issue.fields.subtasks?.length).toBe(1);
      expect(issue.fields.timetracking?.originalEstimate).toBe('2h');
      expect(issue.fields.issuetype.subtask).toBe(false);
    });

    it('APIF-01: index signature enables dynamic field key access', () => {
      const issue: JiraIssue = {
        id: '1',
        key: 'PROJ-1',
        fields: {
          summary: 'Test',
          status: { id: '1', name: 'To Do' },
          assignee: null,
          customfield_10016: null,
          issuetype: { name: 'Story', subtask: false },
          customfield_10028: 8, // dynamic field — allowed by index signature
        },
      };
      const fieldKey = 'customfield_10028';
      expect(issue.fields[fieldKey]).toBe(8);
    });
  });

  describe('APIF-03: discoverCustomFields (replaces discoverStoryPointsField)', () => {
    it('returns the id of the field named "Story Points" as storyPointsFieldKey', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: 'customfield_10016', name: 'Story Points', schema: { custom: 'com.atlassian.jira.plugin.system.customfieldtypes:float' } },
          { id: 'summary', name: 'Summary' },
        ],
      } as Response);
      const { discoverCustomFields } = await import('./jira');
      const result = await discoverCustomFields('https://jira.example.com', 'token');
      expect(result.storyPointsFieldKey).toBe('customfield_10016');
    });

    it('returns fallback customfield_10016 for storyPointsFieldKey when API returns non-OK', async () => {
      vi.mocked(mockFetch).mockResolvedValue({ ok: false, status: 404 } as Response);
      const { discoverCustomFields } = await import('./jira');
      const result = await discoverCustomFields('https://jira.example.com', 'token');
      expect(result.storyPointsFieldKey).toBe('customfield_10016');
    });

    it('returns fallback customfield_10016 for storyPointsFieldKey when network throws', async () => {
      vi.mocked(mockFetch).mockRejectedValue(new Error('network'));
      const { discoverCustomFields } = await import('./jira');
      const result = await discoverCustomFields('https://jira.example.com', 'token');
      expect(result.storyPointsFieldKey).toBe('customfield_10016');
    });

    it('matches field by id "customfield_10028" as secondary story points field', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: 'customfield_10028', name: 'SP' }, // id matches, name does not
        ],
      } as Response);
      const { discoverCustomFields } = await import('./jira');
      const result = await discoverCustomFields('https://jira.example.com', 'token');
      expect(result.storyPointsFieldKey).toBe('customfield_10028');
    });
  });

  describe('APIF-02: fetchSprintIssues two-query subtask strategy', () => {
    const parentIssue = {
      id: '1', key: 'PROJ-1',
      fields: {
        summary: 'Story', status: { id: '1', name: 'In Progress' },
        assignee: null, customfield_10016: 5,
        issuetype: { name: 'Story', subtask: false },
      },
    };
    const subtaskIssue = {
      id: '10', key: 'PROJ-10',
      fields: {
        summary: 'Subtask', status: { id: '2', name: 'To Do' },
        assignee: null, customfield_10016: null,
        issuetype: { name: 'Sub-task', subtask: true },
        parent: { id: '1', key: 'PROJ-1', fields: { summary: 'Story' } },
      },
    };

    it('merges parent issues and subtasks into one array', async () => {
      vi.mocked(mockFetch)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues: [parentIssue] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues: [subtaskIssue] }),
        } as Response);

      const result = await fetchSprintIssues('https://jira.example.com', 'token', 'PROJ', false);
      expect(result).toHaveLength(2);
      expect(result.map((i) => i.key)).toContain('PROJ-1');
      expect(result.map((i) => i.key)).toContain('PROJ-10');
    });

    it('returns parent issues only when subtask query throws', async () => {
      vi.mocked(mockFetch)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues: [parentIssue] }),
        } as Response)
        .mockRejectedValueOnce(new Error('network'));

      const result = await fetchSprintIssues('https://jira.example.com', 'token', 'PROJ', false);
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('PROJ-1');
    });

    it('returns parent issues only when subtask query returns non-OK', async () => {
      vi.mocked(mockFetch)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues: [parentIssue] }),
        } as Response)
        .mockResolvedValueOnce({ ok: false, status: 400 } as Response);

      const result = await fetchSprintIssues('https://jira.example.com', 'token', 'PROJ', false);
      expect(result).toHaveLength(1);
    });

    it('guard: first query JQL contains issuetype not in subtaskIssueTypes()', async () => {
      vi.mocked(mockFetch).mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ issues: [] }),
      } as Response);

      await fetchSprintIssues('https://jira.example.com', 'token', 'PROJ', false);
      const firstCallUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
      expect(firstCallUrl).toContain('issuetype%20not%20in%20subtaskIssueTypes()');
    });

    it('chunks parent keys into batches of 50 for large sprints', async () => {
      // 55 parent issues → 2 subtask fetch calls (chunk 1: 50 keys, chunk 2: 5 keys)
      const manyParents = Array.from({ length: 55 }, (_, i) => ({
        ...parentIssue,
        id: String(i),
        key: `PROJ-${i}`,
      }));

      const emptySubtaskResponse = {
        ok: true, status: 200,
        json: async () => ({ issues: [] }),
      } as Response;

      vi.mocked(mockFetch)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues: manyParents }),
        } as Response)
        .mockResolvedValueOnce(emptySubtaskResponse)
        .mockResolvedValueOnce(emptySubtaskResponse);

      await fetchSprintIssues('https://jira.example.com', 'token', 'PROJ', false);
      // First call: primary sprint query. Then 2 subtask chunk calls.
      expect(vi.mocked(mockFetch)).toHaveBeenCalledTimes(3);
    });

    it('assignedToMe=true: subtask query JQL contains assignee = currentUser()', async () => {
      vi.mocked(mockFetch)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues: [parentIssue] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues: [] }),
        } as Response);

      await fetchSprintIssues('https://jira.example.com', 'token', 'PROJ', true);
      const secondCallUrl = vi.mocked(mockFetch).mock.calls[1][0] as string;
      expect(secondCallUrl).toContain('assignee%20%3D%20currentUser()');
    });

    it('regression: parent query URL includes maxResults=200 so done stories are not truncated', async () => {
      vi.mocked(mockFetch).mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ issues: [] }),
      } as Response);

      await fetchSprintIssues('https://jira.example.com', 'token', 'PROJ', false);
      const firstCallUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
      expect(firstCallUrl).toContain('maxResults=200');
    });

    it('assignedToMe=false: subtask query JQL does NOT contain currentUser()', async () => {
      vi.mocked(mockFetch)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues: [parentIssue] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues: [] }),
        } as Response);

      await fetchSprintIssues('https://jira.example.com', 'token', 'PROJ', false);
      const secondCallUrl = vi.mocked(mockFetch).mock.calls[1][0] as string;
      expect(secondCallUrl).not.toContain('currentUser()');
    });
  });

  describe('fetchIssueWorklogs', () => {
    it('happy path: deduplicates same author logging multiple times → returns [author]', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          worklogs: [
            { author: { displayName: 'Alice' } },
            { author: { displayName: 'Alice' } },
          ],
        }),
      } as Response);

      const { fetchIssueWorklogs } = await import('./jira');
      const result = await fetchIssueWorklogs('https://jira.example.com', 'token', 'PROJ-1');
      expect(result).toEqual(['Alice']);
    });

    it('returns both names for two different authors', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          worklogs: [
            { author: { displayName: 'Alice' } },
            { author: { displayName: 'Bob' } },
          ],
        }),
      } as Response);

      const { fetchIssueWorklogs } = await import('./jira');
      const result = await fetchIssueWorklogs('https://jira.example.com', 'token', 'PROJ-1');
      expect(result).toContain('Alice');
      expect(result).toContain('Bob');
      expect(result).toHaveLength(2);
    });

    it('returns [] on non-ok response (401)', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      const { fetchIssueWorklogs } = await import('./jira');
      const result = await fetchIssueWorklogs('https://jira.example.com', 'token', 'PROJ-1');
      expect(result).toEqual([]);
    });

    it('returns [] on empty worklogs array', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ worklogs: [] }),
      } as Response);

      const { fetchIssueWorklogs } = await import('./jira');
      const result = await fetchIssueWorklogs('https://jira.example.com', 'token', 'PROJ-1');
      expect(result).toEqual([]);
    });

    it('returns [] when fetch throws', async () => {
      vi.mocked(mockFetch).mockRejectedValue(new Error('network error'));

      const { fetchIssueWorklogs } = await import('./jira');
      const result = await fetchIssueWorklogs('https://jira.example.com', 'token', 'PROJ-1');
      expect(result).toEqual([]);
    });
  });

  describe('fetchFixVersions', () => {
    it('REL-01: fetchFixVersions calls correct project versions endpoint', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ id: '1', name: 'v1.0', released: false }],
      } as Response);

      const result = await fetchFixVersions('https://jira.example.com', 'my-token', 'PROJ');
      const calledUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
      expect(calledUrl).toContain('/rest/api/2/project/PROJ/versions');
      expect(calledUrl).not.toContain('/rest/api/2/version');
      expect(result).toHaveLength(1);
    });

    it('REL-01: fetchFixVersions parses bare array response', async () => {
      const mockVersions = [{ id: '2', name: 'v2.0', released: true, releaseDate: '2026-01-01' }];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockVersions,
      } as Response);

      const result = await fetchFixVersions('https://jira.example.com', 'my-token', 'PROJ');
      expect(result).toEqual(mockVersions);
    });

    it('REL-01: fetchFixVersions returns [] when response is not an array', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ values: [{ id: '1' }] }),
      } as Response);

      const result = await fetchFixVersions('https://jira.example.com', 'my-token', 'PROJ');
      expect(result).toEqual([]);
    });

    it('REL-01: fetchFixVersions throws on non-200 response', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ errorMessages: ['Permission denied'] }),
      } as Response);

      await expect(
        fetchFixVersions('https://jira.example.com', 'my-token', 'PROJ'),
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('PAGI-01: fetchSprintIssues pagination — fetches all pages when total > PAGE_SIZE', () => {
    const makeParent = (key: string) => ({
      id: key, key,
      fields: {
        summary: `Story ${key}`,
        status: { id: '1', name: 'In Progress' },
        assignee: null,
        customfield_10016: 1,
        issuetype: { name: 'Story', subtask: false },
      },
    });

    it('fetches page 2 when total=250 and first page returns 200 issues', async () => {
      const page1Issues = Array.from({ length: 200 }, (_, i) => makeParent(`P-${i}`));
      const page2Issues = Array.from({ length: 50 }, (_, i) => makeParent(`P-${200 + i}`));

      vi.mocked(mockFetch)
        // Page 1 of parent issues (startAt=0)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues: page1Issues, total: 250, startAt: 0, maxResults: 200 }),
        } as Response)
        // Page 2 of parent issues (startAt=200)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues: page2Issues, total: 250, startAt: 200, maxResults: 200 }),
        } as Response)
        // Subtask chunks — return empty so we can count calls without complication
        .mockResolvedValue({
          ok: true, status: 200,
          json: async () => ({ issues: [], total: 0, startAt: 0, maxResults: 200 }),
        } as Response);

      const result = await fetchSprintIssues('https://jira.example.com', 'token', 'PROJ', false);
      // Should have all 250 parent issues (plus 0 subtasks)
      expect(result).toHaveLength(250);

      // First two calls are the two pages of the parent query
      const call1Url = vi.mocked(mockFetch).mock.calls[0][0] as string;
      const call2Url = vi.mocked(mockFetch).mock.calls[1][0] as string;
      expect(call1Url).toContain('startAt=0');
      expect(call2Url).toContain('startAt=200');
    });

    it('stops paging when total is exactly one page (no second request needed)', async () => {
      const issues = Array.from({ length: 50 }, (_, i) => makeParent(`P-${i}`));

      vi.mocked(mockFetch)
        // Single page — total=50, PAGE_SIZE=200 so no second page needed
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues, total: 50, startAt: 0, maxResults: 200 }),
        } as Response)
        // Subtask chunk query
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues: [], total: 0, startAt: 0, maxResults: 200 }),
        } as Response);

      const result = await fetchSprintIssues('https://jira.example.com', 'token', 'PROJ', false);
      expect(result).toHaveLength(50);
      // Only 2 calls: 1 parent page + 1 subtask chunk page
      expect(vi.mocked(mockFetch)).toHaveBeenCalledTimes(2);
    });

    it('fetches multiple pages of subtasks when a chunk has >200 subtasks', async () => {
      const parent = makeParent('P-1');
      const subtaskPage1 = Array.from({ length: 200 }, (_, i) => ({
        id: `ST-${i}`, key: `ST-${i}`,
        fields: {
          summary: `Sub ${i}`,
          status: { id: '2', name: 'To Do' },
          assignee: null,
          customfield_10016: null,
          issuetype: { name: 'Sub-task', subtask: true },
          parent: { id: 'P-1', key: 'P-1', fields: { summary: 'Story P-1' } },
        },
      }));
      const subtaskPage2 = Array.from({ length: 30 }, (_, i) => ({
        id: `ST-${200 + i}`, key: `ST-${200 + i}`,
        fields: {
          summary: `Sub ${200 + i}`,
          status: { id: '2', name: 'To Do' },
          assignee: null,
          customfield_10016: null,
          issuetype: { name: 'Sub-task', subtask: true },
          parent: { id: 'P-1', key: 'P-1', fields: { summary: 'Story P-1' } },
        },
      }));

      vi.mocked(mockFetch)
        // Parent query: 1 parent, total=1
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues: [parent], total: 1, startAt: 0, maxResults: 200 }),
        } as Response)
        // Subtask page 1: 200 subtasks, total=230
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues: subtaskPage1, total: 230, startAt: 0, maxResults: 200 }),
        } as Response)
        // Subtask page 2: remaining 30 subtasks
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ issues: subtaskPage2, total: 230, startAt: 200, maxResults: 200 }),
        } as Response);

      const result = await fetchSprintIssues('https://jira.example.com', 'token', 'PROJ', false);
      // 1 parent + 230 subtasks = 231 total
      expect(result).toHaveLength(231);
    });
  });

  describe('PAGI-02: fetchIssueWorklogs pagination — fetches all pages', () => {
    it('fetches page 2 when total=300 and first page returns 200 worklogs', async () => {
      const page1 = Array.from({ length: 200 }, (_, i) => ({ author: { displayName: `Author${i}` } }));
      const page2 = Array.from({ length: 100 }, (_, i) => ({ author: { displayName: `Author${200 + i}` } }));

      vi.mocked(mockFetch)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ worklogs: page1, total: 300, startAt: 0, maxResults: 200 }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ worklogs: page2, total: 300, startAt: 200, maxResults: 200 }),
        } as Response);

      const { fetchIssueWorklogs } = await import('./jira');
      const result = await fetchIssueWorklogs('https://jira.example.com', 'token', 'PROJ-1');
      // All 300 distinct author names should be present
      expect(result).toHaveLength(300);
      expect(result).toContain('Author0');
      expect(result).toContain('Author299');

      // Two fetch calls (two pages)
      expect(vi.mocked(mockFetch)).toHaveBeenCalledTimes(2);
      const call1Url = vi.mocked(mockFetch).mock.calls[0][0] as string;
      const call2Url = vi.mocked(mockFetch).mock.calls[1][0] as string;
      expect(call1Url).toContain('startAt=0');
      expect(call2Url).toContain('startAt=200');
    });

    it('deduplicates authors across pages — same author on multiple pages counted once', async () => {
      vi.mocked(mockFetch)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({
            worklogs: [{ author: { displayName: 'Alice' } }],
            total: 2,
            startAt: 0,
            maxResults: 200,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({
            worklogs: [{ author: { displayName: 'Alice' } }],
            total: 2,
            startAt: 200,
            maxResults: 200,
          }),
        } as Response);

      const { fetchIssueWorklogs } = await import('./jira');
      const result = await fetchIssueWorklogs('https://jira.example.com', 'token', 'PROJ-1');
      expect(result).toEqual(['Alice']);
    });
  });

  describe('ISSUE-03: discoverCustomFields', () => {
    it('resolves epicLinkFieldKey from schema.custom gh-epic-link', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: 'customfield_10100', name: 'Epic Link', schema: { custom: 'com.pyxis.greenhopper.jira:gh-epic-link' } },
          { id: 'customfield_10016', name: 'Story Points', schema: { custom: 'com.atlassian.jira.plugin.system.customfieldtypes:float' } },
          { id: 'customfield_10020', name: 'Sprint', schema: { custom: 'com.pyxis.greenhopper.jira:gh-sprint' } },
          { id: 'customfield_10015', name: 'Epic Name', schema: { custom: 'com.pyxis.greenhopper.jira:gh-epic-label' } },
        ],
      } as Response);
      const { discoverCustomFields } = await import('./jira');
      const result = await discoverCustomFields('https://jira.example.com', 'token');
      expect(result.epicLinkFieldKey).toBe('customfield_10100');
    });

    it('resolves sprintFieldKey from schema.custom gh-sprint', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: 'customfield_10055', name: 'Sprint', schema: { custom: 'com.pyxis.greenhopper.jira:gh-sprint' } },
        ],
      } as Response);
      const { discoverCustomFields } = await import('./jira');
      const result = await discoverCustomFields('https://jira.example.com', 'token');
      expect(result.sprintFieldKey).toBe('customfield_10055');
    });

    it('resolves storyPointsFieldKey from float custom field named Story Points', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: 'customfield_10028', name: 'Story Points', schema: { custom: 'com.atlassian.jira.plugin.system.customfieldtypes:float' } },
        ],
      } as Response);
      const { discoverCustomFields } = await import('./jira');
      const result = await discoverCustomFields('https://jira.example.com', 'token');
      expect(result.storyPointsFieldKey).toBe('customfield_10028');
    });

    it('returns all four defaults when API call throws', async () => {
      vi.mocked(mockFetch).mockRejectedValue(new Error('Network error'));
      const { discoverCustomFields } = await import('./jira');
      const result = await discoverCustomFields('https://jira.example.com', 'token');
      expect(result).toEqual({
        storyPointsFieldKey: 'customfield_10016',
        epicLinkFieldKey: 'customfield_10014',
        epicNameFieldKey: 'customfield_10015',
        sprintFieldKey: 'customfield_10020',
      });
    });

    it('returns all four defaults when response is not ok', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({}),
      } as Response);
      const { discoverCustomFields } = await import('./jira');
      const result = await discoverCustomFields('https://jira.example.com', 'token');
      expect(result).toEqual({
        storyPointsFieldKey: 'customfield_10016',
        epicLinkFieldKey: 'customfield_10014',
        epicNameFieldKey: 'customfield_10015',
        sprintFieldKey: 'customfield_10020',
      });
    });
  });

  describe('ISSUE-03: fetchIssueDetail', () => {
    it('calls GET /rest/api/2/issue/{key} and returns parsed JSON', async () => {
      const mockIssue = { id: '10001', key: 'PROJ-1', fields: { summary: 'Test issue' } };
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockIssue,
      } as Response);
      const { fetchIssueDetail } = await import('./jira');
      const result = await fetchIssueDetail('https://jira.example.com', 'token', 'PROJ-1', {
        epicLinkFieldKey: 'customfield_10014',
        epicNameFieldKey: 'customfield_10015',
        sprintFieldKey: 'customfield_10020',
        storyPointsFieldKey: 'customfield_10016',
      });
      expect(result).toEqual(mockIssue);
    });

    it('includes dynamic custom field keys in the fields= query param', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: '1', key: 'PROJ-1', fields: {} }),
      } as Response);
      const { fetchIssueDetail } = await import('./jira');
      await fetchIssueDetail('https://jira.example.com', 'token', 'PROJ-1', {
        epicLinkFieldKey: 'customfield_10100',
        epicNameFieldKey: 'customfield_10200',
        sprintFieldKey: 'customfield_10055',
        storyPointsFieldKey: 'customfield_10028',
      });
      const calledUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
      expect(calledUrl).toContain('customfield_10100');
      expect(calledUrl).toContain('customfield_10055');
      expect(calledUrl).toContain('customfield_10028');
    });

    it('throws when response.ok is false', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      } as Response);
      const { fetchIssueDetail } = await import('./jira');
      await expect(
        fetchIssueDetail('https://jira.example.com', 'token', 'PROJ-999', {
          epicLinkFieldKey: 'customfield_10014',
          epicNameFieldKey: 'customfield_10015',
          sprintFieldKey: 'customfield_10020',
          storyPointsFieldKey: 'customfield_10016',
        }),
      ).rejects.toThrow('PROJ-999');
    });
  });

  describe('ISSUE-03: updateIssueField', () => {
    it('calls PUT /rest/api/2/issue/{key} with correct body', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);
      const { updateIssueField } = await import('./jira');
      await updateIssueField('https://jira.example.com', 'token', 'PROJ-1', 'priority', { name: 'High' });
      const call = vi.mocked(mockFetch).mock.calls[0];
      expect(call[0]).toContain('/rest/api/2/issue/PROJ-1');
      const options = call[1] as RequestInit;
      expect(options.method).toBe('PUT');
      expect(JSON.parse(options.body as string)).toEqual({ fields: { priority: { name: 'High' } } });
    });

    it('does not throw on 204 response (Jira DC success)', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 204,
        json: async () => ({}),
      } as Response);
      const { updateIssueField } = await import('./jira');
      await expect(
        updateIssueField('https://jira.example.com', 'token', 'PROJ-1', 'story_points', 5),
      ).resolves.toBeUndefined();
    });
  });

  describe('BOARD-04: fetchProjectStatuses', () => {
    it('flattens statuses across issue types', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { statuses: [{ id: '1', name: 'To Do', statusCategory: { key: 'new' } }] },
          {
            statuses: [
              { id: '1', name: 'To Do', statusCategory: { key: 'new' } },
              { id: '2', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
            ],
          },
        ],
      } as Response);
      const { fetchProjectStatuses } = await import('./jira');
      const result = await fetchProjectStatuses('https://jira.example.com', 'token', 'PROJ');
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('To Do');
      expect(result[1].name).toBe('In Progress');
    });

    it('throws with correct message on non-ok response', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 403,
      } as Response);
      const { fetchProjectStatuses } = await import('./jira');
      await expect(
        fetchProjectStatuses('https://jira.example.com', 'token', 'PROJ'),
      ).rejects.toThrow('Failed to fetch project statuses: 403');
    });
  });

  describe('BOARD-04: createIssue', () => {
    it('POSTs correct body and returns id and key', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: '10001', key: 'PROJ-42' }),
      } as Response);
      const { createIssue } = await import('./jira');
      const result = await createIssue('https://jira.example.com', 'token', 'PROJ', 'My new story');
      const call = vi.mocked(mockFetch).mock.calls[0];
      expect(call[0]).toContain('/rest/api/2/issue');
      const options = call[1] as RequestInit;
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body as string);
      expect(body.fields.project.key).toBe('PROJ');
      expect(body.fields.summary).toBe('My new story');
      expect(body.fields.issuetype.name).toBe('Story');
      expect(result).toEqual({ id: '10001', key: 'PROJ-42' });
    });

    it('throws with correct message on non-ok response', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 400,
      } as Response);
      const { createIssue } = await import('./jira');
      await expect(
        createIssue('https://jira.example.com', 'token', 'PROJ', 'My new story'),
      ).rejects.toThrow('Failed to create issue: 400');
    });
  });
});
