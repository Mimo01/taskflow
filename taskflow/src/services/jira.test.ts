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
  discoverStoryPointsField,
  type JiraIssue,
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
      const mockUser = { displayName: 'Jane Smith', emailAddress: 'jane@example.com' };
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUser,
      } as Response);

      const result = await validateJira('https://jira.example.com', 'my-token');
      expect(result).toEqual({ displayName: 'Jane Smith', emailAddress: 'jane@example.com' });
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

  describe('APIF-03: discoverStoryPointsField', () => {
    it('returns the id of the field named "Story Points"', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: 'customfield_10016', name: 'Story Points' },
          { id: 'summary', name: 'Summary' },
        ],
      } as Response);
      const result = await discoverStoryPointsField('https://jira.example.com', 'token');
      expect(result).toBe('customfield_10016');
    });

    it('returns fallback customfield_10016 when API returns non-OK', async () => {
      vi.mocked(mockFetch).mockResolvedValue({ ok: false, status: 404 } as Response);
      const result = await discoverStoryPointsField('https://jira.example.com', 'token');
      expect(result).toBe('customfield_10016');
    });

    it('returns fallback customfield_10016 when network throws', async () => {
      vi.mocked(mockFetch).mockRejectedValue(new Error('network'));
      const result = await discoverStoryPointsField('https://jira.example.com', 'token');
      expect(result).toBe('customfield_10016');
    });

    it('matches field by id "customfield_10028" as secondary fallback', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: 'customfield_10028', name: 'SP' }, // id matches, name does not
        ],
      } as Response);
      const result = await discoverStoryPointsField('https://jira.example.com', 'token');
      expect(result).toBe('customfield_10028');
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
  });

  describe('fetchFixVersions', () => {
    const mockVersions = [
      { id: '10001', name: 'v1.0', releaseDate: '2025-06-01', released: true, description: 'First release' },
      { id: '10002', name: 'v1.1', releaseDate: '2025-09-01', released: false },
    ];

    it('PM-03: fetchFixVersions extracts values array from paginated envelope', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ values: mockVersions, total: 2, isLast: true, maxResults: 50 }),
      } as Response);

      const result = await fetchFixVersions('https://jira.example.com', 'my-token', 'PROJ');
      expect(result).toEqual(mockVersions);
      expect(Array.isArray(result)).toBe(true);
    });

    it('PM-03: fetchFixVersions returns empty array when values is absent', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ total: 0, isLast: true, maxResults: 50 }),
      } as Response);

      const result = await fetchFixVersions('https://jira.example.com', 'my-token', 'PROJ');
      expect(result).toEqual([]);
    });

    it('PM-03: fetchFixVersions throws on non-200 response', async () => {
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
});
