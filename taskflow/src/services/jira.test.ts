// AUTH-01: Jira PAT validation
// AUTH-06: Error banners for Jira validation failures
// DEV-01, DEV-02, DEV-03, DEV-04: Phase 2 Jira sprint & transition functions
import { vi } from 'vitest';

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { fetch as mockFetch } from '@tauri-apps/plugin-http';
import {
  validateJira,
  listJiraProjects,
  fetchSprintIssues,
  fetchTransitions,
  postTransition,
  postComment,
} from './jira';

describe('jira service', () => {
  beforeEach(() => {
    vi.mocked(mockFetch).mockReset();
  });

  describe('validateJira', () => {
    it('AUTH-01: validateJira returns user data on 200 response', async () => {
      const mockUser = { displayName: 'Jane Smith', emailAddress: 'jane@example.com' };
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUser,
      } as any);

      const result = await validateJira('https://jira.example.com', 'my-token');
      expect(result).toEqual({ displayName: 'Jane Smith', emailAddress: 'jane@example.com' });
    });

    it('AUTH-01: validateJira throws "Invalid token or token has expired" on 401', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as any);

      await expect(validateJira('https://jira.example.com', 'bad-token')).rejects.toThrow(
        'Invalid token or token has expired',
      );
    });

    it('AUTH-01: validateJira throws "Token valid but lacks required permissions" on 403', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({}),
      } as any);

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
      } as any);

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
      } as any);

      const result = await listJiraProjects('https://jira.example.com', 'my-token');
      expect(result).toEqual(mockProjects);
    });

    it('AUTH-06: listJiraProjects throws on 401', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as any);

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
        issuetype: { name: 'Story' },
      },
    };

    it('DEV-01: fetchSprintIssues returns JiraIssue[] with correct shape', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ issues: [mockIssue] }),
      } as any);

      const result = await fetchSprintIssues('https://jira.example.com', 'my-token', 'PROJ');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockIssue);
    });

    it('DEV-01: fetchSprintIssues with assignedToMe=true includes currentUser() in JQL', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ issues: [] }),
      } as any);

      await fetchSprintIssues('https://jira.example.com', 'my-token', 'PROJ', true);

      const callUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
      expect(callUrl).toContain('currentUser()');
    });

    it('DEV-01: fetchSprintIssues with assignedToMe=false does NOT include currentUser() in JQL', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ issues: [] }),
      } as any);

      await fetchSprintIssues('https://jira.example.com', 'my-token', 'PROJ', false);

      const callUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
      expect(callUrl).not.toContain('currentUser()');
    });

    it('DEV-01: fetchSprintIssues 400 with "function" throws sprint-unavailable error', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'The function openSprints() is not recognized',
      } as any);

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
      } as any);

      const result = await fetchTransitions('https://jira.example.com', 'my-token', 'PROJ-1');
      expect(result).toEqual(mockTransitions);
    });
  });

  describe('postTransition', () => {
    it('DEV-03: postTransition calls POST with correct body and resolves void on 204', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 204,
      } as any);

      const result = await postTransition('https://jira.example.com', 'my-token', 'PROJ-1', '21');
      expect(result).toBeUndefined();

      const [, options] = vi.mocked(mockFetch).mock.calls[0];
      const body = JSON.parse((options as any).body);
      expect(body).toEqual({ transition: { id: '21' } });
    });

    it('DEV-03: postTransition throws on non-204 response', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 400,
      } as any);

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
      } as any);

      const result = await postComment('https://jira.example.com', 'my-token', 'PROJ-1', 'Great work!');
      expect(result).toBeUndefined();

      const [, options] = vi.mocked(mockFetch).mock.calls[0];
      const body = JSON.parse((options as any).body);
      expect(body).toEqual({ body: 'Great work!' });
    });

    it('DEV-04: postComment throws on non-201 response', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 400,
      } as any);

      await expect(
        postComment('https://jira.example.com', 'my-token', 'PROJ-1', 'comment'),
      ).rejects.toThrow();
    });
  });
});
