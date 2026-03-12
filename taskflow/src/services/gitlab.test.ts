// AUTH-02: GitLab PAT validation
// DEV-05: Phase 2 GitLab MR functions
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateGitLab,
  listGitLabGroups,
  listGitLabProjects,
  fetchAssignedMRs,
  fetchReviewerMRs,
  fetchMRCommits,
  fetchMRApprovals,
  fetchMRDiscussions,
  fetchProjectMilestones,
  searchGitLabMRs,
} from './gitlab';

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

import { fetch as mockFetch } from '@tauri-apps/plugin-http';

describe('gitlab service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateGitLab', () => {
    it('AUTH-02: validateGitLab returns user data on 200 response', async () => {
      const mockUser = { id: 42, name: 'Jane Smith', username: 'jsmith' };
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUser,
      } as Response);

      const result = await validateGitLab('https://gitlab.example.com', 'my-token');
      expect(result).toEqual({ id: 42, name: 'Jane Smith', username: 'jsmith' });
    });

    it('AUTH-02: validateGitLab throws "Invalid token or token has expired" on 401', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response);

      await expect(validateGitLab('https://gitlab.example.com', 'bad-token')).rejects.toThrow(
        'Invalid token or token has expired',
      );
    });

    it('AUTH-02: validateGitLab throws "Token valid but lacks required permissions" on 403', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({}),
      } as Response);

      await expect(validateGitLab('https://gitlab.example.com', 'limited-token')).rejects.toThrow(
        'Token valid but lacks required permissions',
      );
    });

    it('AUTH-02: validateGitLab throws "Cannot reach [URL]" on network error', async () => {
      vi.mocked(mockFetch).mockRejectedValue(new Error('Network failure'));

      await expect(validateGitLab('https://gitlab.example.com', 'any-token')).rejects.toThrow(
        'Cannot reach https://gitlab.example.com — check the base URL',
      );
    });

    it('AUTH-02: validateGitLab throws "Cannot reach [URL]" on non-401/403 error status', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response);

      await expect(validateGitLab('https://gitlab.example.com', 'any-token')).rejects.toThrow(
        'Cannot reach https://gitlab.example.com — check the base URL',
      );
    });
  });

  describe('listGitLabGroups', () => {
    it('AUTH-02: listGitLabGroups returns groups list on success', async () => {
      const mockGroups = [
        { id: 1, name: 'Engineering', full_path: 'engineering' },
        { id: 2, name: 'Frontend', full_path: 'engineering/frontend' },
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockGroups,
      } as Response);

      const result = await listGitLabGroups('https://gitlab.example.com', 'my-token');
      expect(result).toEqual(mockGroups);
    });
  });

  describe('fetchAssignedMRs', () => {
    const mockMR = {
      id: 101,
      iid: 1,
      project_id: 5,
      title: '[PROJ-42] Fix login bug',
      state: 'opened' as const,
      author: { id: 1, name: 'Alice', username: 'alice', avatar_url: 'https://example.com/alice.png' },
      reviewers: [{ id: 2, name: 'Bob', username: 'bob' }],
      updated_at: '2026-03-10T12:00:00Z',
      web_url: 'https://gitlab.example.com/project/mr/1',
    };

    it('DEV-05: fetchAssignedMRs returns GitLabMR[]', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [mockMR],
      } as Response);

      const result = await fetchAssignedMRs('https://gitlab.example.com', 'my-token');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockMR);
    });
  });

  describe('fetchReviewerMRs', () => {
    it('DEV-05: fetchReviewerMRs calls URL with reviewer_id param', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      await fetchReviewerMRs('https://gitlab.example.com', 'my-token', 42);

      const callUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
      expect(callUrl).toContain('reviewer_id=42');
    });
  });

  describe('fetchMRCommits', () => {
    it('DEV-05: fetchMRCommits returns MRCommit[]', async () => {
      const mockCommits = [
        { id: 'abc123', title: 'PROJ-42 fix login', message: 'PROJ-42 fix login\n\nDetails here' },
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockCommits,
      } as Response);

      const result = await fetchMRCommits('https://gitlab.example.com', 'my-token', 5, 1);
      expect(result).toEqual(mockCommits);
    });
  });

  describe('fetchMRApprovals', () => {
    it('DEV-05: fetchMRApprovals returns MRApprovals with approved_by', async () => {
      const mockApprovals = {
        approved_by: [{ user: { id: 2, name: 'Bob' } }],
        approved: true,
      };
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockApprovals,
      } as Response);

      const result = await fetchMRApprovals('https://gitlab.example.com', 'my-token', 5, 1);
      expect(result).toEqual(mockApprovals);
      expect(result.approved_by).toHaveLength(1);
    });
  });

  describe('fetchMRDiscussions', () => {
    it('DEV-05: fetchMRDiscussions returns Discussion[] with notes', async () => {
      const mockDiscussions = [
        {
          id: 'd1',
          notes: [{ id: 'n1', resolvable: true, resolved: false, body: 'Please fix this' }],
        },
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockDiscussions,
      } as Response);

      const result = await fetchMRDiscussions('https://gitlab.example.com', 'my-token', 5, 1);
      expect(result).toEqual(mockDiscussions);
      expect(result[0].notes[0].resolved).toBe(false);
    });
  });

  describe('listGitLabProjects', () => {
    it('listGitLabProjects returns project list on success', async () => {
      const mockProjects = [
        { id: 1, name: 'Frontend', name_with_namespace: 'Org / Frontend', path_with_namespace: 'org/frontend' },
      ];
      vi.mocked(mockFetch).mockResolvedValue({ ok: true, status: 200, json: async () => mockProjects } as Response);
      const result = await listGitLabProjects('https://gitlab.example.com', 'my-token');
      expect(result).toEqual(mockProjects);
    });
  });

  describe('fetchProjectMilestones', () => {
    it('fetchProjectMilestones returns milestones for a project', async () => {
      const mockMilestones = [{ id: 10, iid: 1, title: 'Sprint 1', due_date: '2026-04-01', state: 'active', web_url: 'https://gitlab.example.com/project/-/milestones/1' }];
      vi.mocked(mockFetch).mockResolvedValue({ ok: true, status: 200, json: async () => mockMilestones } as Response);
      const result = await fetchProjectMilestones('https://gitlab.example.com', 'my-token', 42);
      expect(result).toEqual(mockMilestones);
      expect(vi.mocked(mockFetch)).toHaveBeenCalledWith(expect.stringContaining('/projects/42/milestones'), expect.any(Object));
    });
  });

  describe('searchGitLabMRs', () => {
    it('APIF-04: request URL includes state=opened filter', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);
      await searchGitLabMRs('https://gitlab.example.com', 'my-token', 'feat login');
      const calledUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
      expect(calledUrl).toMatch(/state=opened/);
    });
  });
});
